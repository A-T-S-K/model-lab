import fixture from '../fixtures/canonical.initial.json';
import { SessionArchive, archiveSnapshot, snapshotId, type ArchivedSnapshot } from '../archive/session.js';
import { exactData } from '../archive/experiment.js';
import { predict, loss, tokenize } from '../model/microgpt.js';
import { parameterValues, restoreTraining, snapshotTraining } from '../model/state.js';
import { trainStep } from '../model/training.js';
import { compareRuns } from '../trace/compare.js';
import { TraceRecorder } from '../trace/recorder.js';
import { immutableCopy, type RecordedRun } from '../trace/types.js';
import { experimentManifest, type ExperimentTag } from './common.js';
import {
  correlateExternalPolicyRecords,
  dataExperimentRecipes,
  immutableRecordId,
  receiptPayload,
  type DataExperimentArm,
  type DataExperimentArmReceipt,
  type DataCleanEvaluation,
  type DataEvaluationArm,
  type DataPrefixEvaluation,
  type DataExperimentRecipeContribution,
  type DataExperimentStep,
  type DataPolicyDecision,
  type DataPolicyIdentity,
  type ExternalDataPolicyRecord,
  type MatchedDataExperimentReceipt,
  type MatchedTrainingComparison,
} from './data-experiment.js';

export const MATCHED_DATA_SUBSTITUTION_RECIPE = { id: 'microgpt.matched-data-substitution', version: 1 } as const;
export const SCHEDULE_INTEGRITY_ALLOWLIST = { id: 'schedule-integrity-allowlist', version: 1 } as const;
export const CLEAN_SCHEDULE_POLICY = { id: 'declared-clean-schedule', version: 1 } as const;
export const DECLARED_SUBSTITUTION_POLICY = { id: 'declared-data-substitution', version: 1 } as const;
export const MATCHED_TRAINING_POLICY = { id: 'matched-training-arms', version: 1 } as const;
export const INPUT_TRANSFORM = 'microgpt.character-teacher-forcing@1' as const;
export const OBJECTIVE = 'microgpt.next-token-mean-nll@1' as const;
const ARMS: readonly DataExperimentArm[] = ['clean', 'treatment', 'defended'];

export interface Substitution { readonly step: number; readonly original: string; readonly replacement: string }
export interface MatchedDataSubstitutionDesign {
  readonly id: string;
  readonly schedule: readonly string[];
  readonly substitutions: readonly Substitution[];
  readonly triggeredPrefix: string;
  readonly controlPrefixes: readonly string[];
  readonly desiredToken: string;
  readonly cleanDocuments: readonly string[];
}

export interface MatchedDataSubstitutionRequest {
  readonly snapshot: ArchivedSnapshot;
  readonly design: MatchedDataSubstitutionDesign;
  readonly tag?: ExperimentTag;
}

export interface MatchedDataSubstitutionResult {
  readonly experiment: MatchedDataExperimentReceipt;
  readonly archive: SessionArchive;
}

function requireData(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid matched data experiment: ${message}`);
}

function tokenIds(snapshot: ArchivedSnapshot, document: string): { tokenIds: number[]; targetIds: number[] } {
  const ids = [...document].map(character => snapshot.state.config.vocabulary.indexOf(character));
  requireData(ids.every(id => id >= 0), `document contains a character outside the vocabulary: ${document}`);
  const sequence = [snapshot.state.config.bosTokenId, ...ids, snapshot.state.config.bosTokenId];
  requireData(sequence.length - 1 <= snapshot.state.config.blockSize, `document exceeds the context window: ${document}`);
  return { tokenIds: sequence.slice(0, -1), targetIds: sequence.slice(1) };
}

export function validateMatchedDataSubstitutionDesign(design: unknown, snapshot: ArchivedSnapshot): void {
  requireData(design !== null && typeof design === 'object' && !Array.isArray(design), 'design must be plain data');
  const value = design as MatchedDataSubstitutionDesign;
  requireData(typeof value.id === 'string' && value.id.length > 0, 'experiment ID');
  requireData(Array.isArray(value.schedule) && value.schedule.length > 0, 'zero-length schedule');
  requireData(value.schedule.length <= snapshot.state.optimizer.numSteps - snapshot.state.optimizer.step, 'exhausted optimizer schedule');
  requireData(Array.isArray(value.substitutions) && value.substitutions.length > 0, 'explicit substitutions are required');
  const changed = new Set<number>();
  for (const substitution of value.substitutions) {
    requireData(Number.isSafeInteger(substitution.step) && substitution.step >= 0 && substitution.step < value.schedule.length && !changed.has(substitution.step), 'duplicate or invalid substitution step');
    requireData(value.schedule[substitution.step] === substitution.original, 'substitution original does not equal clean schedule');
    requireData(substitution.original !== substitution.replacement, 'substitution replacement equals original');
    changed.add(substitution.step);
  }
  requireData(typeof value.triggeredPrefix === 'string' && value.triggeredPrefix.length > 0, 'triggered evaluation');
  requireData(Array.isArray(value.controlPrefixes) && value.controlPrefixes.length >= 2 && !value.controlPrefixes.includes(value.triggeredPrefix), 'at least two distinct untriggered controls are required');
  requireData(Array.isArray(value.cleanDocuments) && value.cleanDocuments.length > 0, 'clean evaluations are required');
  requireData(typeof value.desiredToken === 'string' && snapshot.state.config.vocabulary.includes(value.desiredToken), 'desired token outside vocabulary');
  for (const document of [...value.schedule, ...value.substitutions.map(item => item.replacement), value.triggeredPrefix,
    ...value.controlPrefixes, ...value.cleanDocuments]) tokenIds(snapshot, document);
}

function stepPolicy(arm: DataExperimentArm, clean: string, proposed: string): { policy: DataPolicyIdentity; decision: DataPolicyDecision; effective: string } {
  if (arm === 'clean') return { policy: CLEAN_SCHEDULE_POLICY, decision: 'accepted', effective: clean };
  if (arm === 'treatment') return { policy: DECLARED_SUBSTITUTION_POLICY, decision: proposed === clean ? 'accepted' : 'substituted', effective: proposed };
  return proposed === clean
    ? { policy: SCHEDULE_INTEGRITY_ALLOWLIST, decision: 'accepted', effective: proposed }
    : { policy: SCHEDULE_INTEGRITY_ALLOWLIST, decision: 'normalized', effective: clean };
}

function comparison(reasons: readonly string[]): MatchedTrainingComparison {
  return immutableCopy({
    policy: MATCHED_TRAINING_POLICY,
    compatible: reasons.length === 0,
    reasons,
    basis: {
      commonStart: 'exact complete snapshot and checkpoint' as const,
      budget: 'equal ordered updates' as const,
      controlledDifferences: 'declared substitutions and defense decisions only' as const,
      continuation: 'exact optimizer configuration and matched cursor progression' as const,
    },
  });
}

function matchingReasons(receipt: MatchedDataExperimentReceipt, snapshot: ArchivedSnapshot,
  snapshots: ReadonlyMap<string, ArchivedSnapshot>, learning: ReadonlyMap<string, import('../archive/experiment.js').LearningExperiment>): string[] {
  const reasons: string[] = [];
  const substitutions = new Map(receipt.design.substitutions.map(item => [item.step, item]));
  const startOptimizer = snapshot.state.optimizer;
  for (const arm of ARMS) {
    const candidate = receipt.arms[arm];
    if (candidate.status !== 'succeeded') reasons.push(`${arm} arm did not succeed`);
    if (candidate.steps.length !== receipt.design.cleanSchedule.length) reasons.push(`${arm} update count differs`);
    candidate.steps.forEach((step, index) => {
      const clean = receipt.design.cleanSchedule[index];
      const proposedTreatment = substitutions.get(index)?.replacement ?? clean;
      if (step.step !== index) reasons.push(`${arm} step order differs at ${index}`);
      if (arm === 'clean' && (step.proposedDocument !== clean || step.effectiveDocument !== clean || step.decision !== 'accepted')) reasons.push(`clean arm deviates at ${index}`);
      if (arm === 'treatment' && (step.proposedDocument !== proposedTreatment || step.effectiveDocument !== proposedTreatment ||
          step.decision !== (proposedTreatment === clean ? 'accepted' : 'substituted'))) reasons.push(`treatment differs outside declared substitutions at ${index}`);
      if (arm === 'defended' && (step.proposedDocument !== proposedTreatment || step.effectiveDocument !== clean ||
          step.decision !== (proposedTreatment === clean ? 'accepted' : 'normalized') || !exactData(step.policy, SCHEDULE_INTEGRITY_ALLOWLIST)))
        reasons.push(`defended policy differs at ${index}`);
      if (step.expectedDocument !== clean) reasons.push(`${arm} expected document differs at ${index}`);
      const prior = index === 0 ? receipt.source.snapshotId : candidate.steps[index - 1]?.endSnapshotId;
      if (step.startSnapshotId !== prior) reasons.push(`${arm} snapshot lineage differs at ${index}`);
      const record = learning.get(step.learningExperimentId);
      if (!record || record.startingSnapshotId !== step.startSnapshotId || record.resultingSnapshotId !== step.endSnapshotId ||
          record.beforeRunId !== step.beforeRunId || record.trainingRunId !== step.trainingRunId || record.afterRunId !== step.afterRunId)
        reasons.push(`${arm} learning evidence differs at ${index}`);
    });
    if (candidate.finalSnapshotId !== candidate.steps.at(-1)?.endSnapshotId) reasons.push(`${arm} final snapshot differs`);
    const final = snapshots.get(candidate.finalSnapshotId)?.state;
    if (!final) reasons.push(`${arm} final snapshot missing`);
    else {
      if (!exactData(final.config, snapshot.state.config) || !exactData(final.parameterOrder, snapshot.state.parameterOrder)) reasons.push(`${arm} model configuration or parameter order differs`);
      for (const key of ['learningRate', 'beta1', 'beta2', 'epsilon', 'numSteps', 'rngState'] as const)
        if (!Object.is(final.optimizer[key], startOptimizer[key])) reasons.push(`${arm} optimizer configuration differs`);
      if (final.optimizer.step !== startOptimizer.step + receipt.design.cleanSchedule.length) reasons.push(`${arm} final optimizer step differs`);
      if (final.optimizer.datasetCursor !== startOptimizer.datasetCursor + receipt.design.cleanSchedule.length) reasons.push(`${arm} final dataset cursor differs`);
    }
  }
  return reasons;
}

function observedProbability(run: RecordedRun, desired: number): number | undefined {
  return run.artifacts.filter(artifact => artifact.kind === 'probabilities').at(-1)?.values?.[desired];
}

function observedMeanLoss(run: RecordedRun): number | undefined {
  return run.artifacts.find(artifact => artifact.kind === 'meanLoss')?.values?.[0];
}

export async function validateMatchedDataSubstitutionReceipt(receipt: MatchedDataExperimentReceipt,
  context: import('./data-experiment.js').DataExperimentValidationContext): Promise<void> {
  requireData(exactData(receipt.recipe, MATCHED_DATA_SUBSTITUTION_RECIPE), 'recipe identity');
  const design: MatchedDataSubstitutionDesign = { id: receipt.id, schedule: receipt.design.cleanSchedule,
    substitutions: receipt.design.substitutions, triggeredPrefix: receipt.design.triggeredPrefix,
    controlPrefixes: receipt.design.controlPrefixes, desiredToken: receipt.design.desiredToken, cleanDocuments: receipt.design.cleanDocuments };
  validateMatchedDataSubstitutionDesign(design, context.snapshot);
  requireData(receipt.source.snapshotId === context.snapshot.id && receipt.source.checkpointId === context.snapshot.id,
    'source snapshot/checkpoint mismatch');
  requireData(receipt.source.modelDefinitionId === 'microgpt' && receipt.source.modelDefinitionVersion === fixture.reference.revision,
    'source model definition');
  requireData(receipt.design.inputTransform === INPUT_TRANSFORM && receipt.design.objective === OBJECTIVE &&
    exactData(receipt.design.defensePolicy, SCHEDULE_INTEGRITY_ALLOWLIST) && exactData(receipt.design.matchingPolicy, MATCHED_TRAINING_POLICY), 'declared policies');
  requireData(receipt.lifecycle.status === 'succeeded' && ARMS.every(arm => receipt.arms[arm].status === 'succeeded'), 'failed or cancelled required arm');
  const steps = ARMS.flatMap(arm => [...receipt.arms[arm].steps]);
  await correlateExternalPolicyRecords(receipt.policyRecords, steps);
  for (const step of steps) {
    const learning = context.learningExperiments.get(step.learningExperimentId);
    const run = context.runs.get(step.trainingRunId);
    requireData(Boolean(learning && run), 'missing linked learning experiment or training run');
    const expected = tokenIds(context.snapshot, step.effectiveDocument);
    requireData(exactData(learning!.objective.inputIds, expected.tokenIds) && exactData(learning!.objective.targetIds, expected.targetIds), 'effective document does not match linked model input');
  }
  const reasons = matchingReasons(receipt, context.snapshot, context.snapshots, context.learningExperiments);
  requireData(receipt.matching.compatible && reasons.length === 0 && exactData(receipt.matching, comparison(reasons)), `matched-training comparison: ${reasons.join('; ')}`);

  const desired = context.snapshot.state.config.vocabulary.indexOf(receipt.design.desiredToken);
  const prefixes = [receipt.evaluations.triggered, ...receipt.evaluations.controls];
  requireData(receipt.evaluations.triggered.kind === 'triggered' && receipt.evaluations.triggered.input === receipt.design.triggeredPrefix, 'missing triggered evaluation');
  requireData(receipt.evaluations.controls.length === receipt.design.controlPrefixes.length &&
    receipt.evaluations.controls.every((item, index) => item.kind === 'control' && item.input === receipt.design.controlPrefixes[index]), 'missing or reordered control evaluation');
  requireData(receipt.evaluations.clean.length === receipt.design.cleanDocuments.length &&
    receipt.evaluations.clean.every((item, index) => item.input === receipt.design.cleanDocuments[index]), 'missing or reordered clean evaluation');
  for (const evaluation of [...prefixes, ...receipt.evaluations.clean]) {
    for (const arm of ARMS) {
      const retained = context.runs.get(evaluation.arms[arm].runId);
      requireData(Boolean(retained), 'evaluation run missing');
      requireData(retained!.manifest.startingSnapshotId === receipt.arms[arm].finalSnapshotId, 'evaluation run uses wrong final snapshot');
      const expected = tokenIds(context.snapshot, evaluation.input);
      requireData(exactData(retained!.manifest.input, expected.tokenIds) && exactData(retained!.manifest.targets, expected.targetIds), 'evaluation input mismatch');
      requireData(Object.is(observedProbability(retained!, desired), evaluation.arms[arm].probability) &&
        Object.is(observedMeanLoss(retained!), evaluation.arms[arm].meanLoss), 'evaluation metric is not retained model evidence');
    }
    if ('kind' in evaluation) {
      const prefixEvaluation = evaluation as DataPrefixEvaluation;
      const clean = context.runs.get(evaluation.arms.clean.runId)!;
      requireData(exactData(prefixEvaluation.comparisons.treatmentToClean, compareRuns(clean, context.runs.get(evaluation.arms.treatment.runId)!)) &&
        exactData(prefixEvaluation.comparisons.defendedToClean, compareRuns(clean, context.runs.get(evaluation.arms.defended.runId)!)), 'strict evaluation comparison mismatch');
    }
  }
  const average = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const cleanMeans = Object.fromEntries(ARMS.map(arm => [arm, average(receipt.evaluations.clean.map(item => item.arms[arm].meanLoss))])) as Record<DataExperimentArm, number>;
  requireData(exactData(receipt.metrics.observed.triggeredProbabilities,
    Object.fromEntries(ARMS.map(arm => [arm, receipt.evaluations.triggered.arms[arm].probability]))) &&
    exactData(receipt.metrics.observed.controlProbabilities, receipt.evaluations.controls.map(item => Object.fromEntries(ARMS.map(arm => [arm, item.arms[arm].probability])))) &&
    exactData(receipt.metrics.observed.cleanTaskMeanLoss, cleanMeans), 'observed metrics');
  const triggered = receipt.metrics.observed.triggeredProbabilities;
  const derived = { triggeredTreatmentMinusClean: triggered.treatment - triggered.clean,
    triggeredDefendedMinusClean: triggered.defended - triggered.clean,
    triggeredDefendedMinusTreatment: triggered.defended - triggered.treatment,
    cleanLossTreatmentMinusClean: cleanMeans.treatment - cleanMeans.clean,
    cleanLossDefendedMinusClean: cleanMeans.defended - cleanMeans.clean,
    cleanLossDefendedMinusTreatment: cleanMeans.defended - cleanMeans.treatment };
  requireData(exactData(receipt.metrics.derived, derived), 'derived metrics');
  requireData(receipt.receiptId === await immutableRecordId(receiptPayload(receipt)), 'receipt content hash mismatch');
}

export async function executeMatchedDataSubstitution(request: MatchedDataSubstitutionRequest): Promise<MatchedDataSubstitutionResult> {
  const initial = immutableCopy(request.snapshot); const design = immutableCopy(request.design);
  if (await snapshotId(initial.state) !== initial.id) throw new Error('Matched data experiment source snapshot hash mismatch');
  validateMatchedDataSubstitutionDesign(design, initial);
  const substitutions = new Map(design.substitutions.map((item, index) => [item.step, { ...item, id: `${design.id}:substitution:${index}` }]));
  const states = Object.fromEntries(ARMS.map(arm => [arm, restoreTraining(initial.state)])) as Record<DataExperimentArm, ReturnType<typeof restoreTraining>>;
  const archive = new SessionArchive(); await archive.addSnapshot(initial);
  const policyRecords: ExternalDataPolicyRecord[] = [];
  const arms = {} as Record<DataExperimentArm, DataExperimentArmReceipt>;
  const sessionId = request.tag?.sessionId ?? design.id;
  const generationId = request.tag?.generationId ?? 0;
  const baseRunId = request.tag?.runId ?? design.id;

  for (const arm of ARMS) {
    const state = states[arm]; const steps: DataExperimentStep[] = [];
    for (let step = 0; step < design.schedule.length; step++) {
      const clean = design.schedule[step]!;
      const proposed = arm === 'clean' ? clean : substitutions.get(step)?.replacement ?? clean;
      const policy = stepPolicy(arm, clean, proposed);
      const input = tokenize(state.model, policy.effective);
      const start = await archiveSnapshot(snapshotTraining(state.model, state.optimizer)); await archive.addSnapshot(start);
      const learningExperimentId = `${design.id}:${arm}:${step}`;
      const runStem = `${baseRunId}:data:${arm}:${step}`;
      const beforeRunId = `${runStem}:before`, trainingRunId = `${runStem}:training`, afterRunId = `${runStem}:after`;
      const commonTag = { sessionId, generationId };
      const before = new TraceRecorder(experimentManifest({ ...commonTag, runId: beforeRunId }, start, input.tokenIds, input.targetIds));
      predict(state.model, input.tokenIds, before);
      const training = new TraceRecorder(experimentManifest({ ...commonTag, runId: trainingRunId }, start, input.tokenIds, input.targetIds));
      const result = trainStep(state.model, state.optimizer, input.tokenIds, input.targetIds, {
        observe: event => training.observe(event),
        captureBackward: () => training.observe({ kind: 'gradient', values: parameterValues(state.model).map(value => value.grad),
          shape: [parameterValues(state.model).length], axes: ['parameter'], captureLevel: 'summary' }),
      });
      const end = await archiveSnapshot(snapshotTraining(state.model, state.optimizer)); await archive.addSnapshot(end);
      const after = new TraceRecorder(experimentManifest({ ...commonTag, runId: afterRunId }, end, input.tokenIds, input.targetIds));
      predict(state.model, input.tokenIds, after);
      for (const run of [before.finish(), training.finish(), after.finish()]) await archive.addRun(run);
      await archive.addLearningExperiment({ id: learningExperimentId, startingSnapshotId: start.id, resultingSnapshotId: end.id,
        beforeRunId, trainingRunId, backwardRunId: trainingRunId, afterRunId,
        objective: { inputIds: input.tokenIds, targetIds: input.targetIds, meanLoss: result.meanLoss }, update: result.update });
      const identity = { experimentId: design.id, arm, step, proposedDocument: proposed, expectedDocument: clean,
        effectiveDocument: policy.effective, decision: policy.decision, policy: policy.policy, learningExperimentId,
        beforeRunId, trainingRunId, afterRunId, startSnapshotId: start.id, endSnapshotId: end.id };
      const record: ExternalDataPolicyRecord = { id: await immutableRecordId(identity), ...identity };
      policyRecords.push(record); steps.push({ ...identity, policyRecordId: record.id });
    }
    arms[arm] = { id: arm, status: 'succeeded', steps, finalSnapshotId: steps.at(-1)!.endSnapshotId };
  }

  const evaluate = async (document: string, suffix: string) => {
    const input = tokenize(states.clean.model, document);
    const evaluated = {} as Record<DataExperimentArm, { run: RecordedRun; probability: number; meanLoss: number }>;
    for (const arm of ARMS) {
      const final = archive.snapshots.get(arms[arm].finalSnapshotId)!;
      const recorder = new TraceRecorder(experimentManifest({ sessionId, generationId, runId: `${baseRunId}:evaluate:${suffix}:${arm}` }, final, input.tokenIds, input.targetIds));
      const result = loss(states[arm].model, input.tokenIds, input.targetIds, recorder);
      const run = recorder.finish(); await archive.addRun(run);
      evaluated[arm] = { run, probability: result.probabilities.at(-1)![initial.state.config.vocabulary.indexOf(design.desiredToken)]!.data, meanLoss: result.mean.data };
    }
    return evaluated;
  };
  const evaluationArms = (evaluated: Record<DataExperimentArm, { run: RecordedRun; probability: number; meanLoss: number }>): Record<DataExperimentArm, DataEvaluationArm> => ({
    clean: { runId: evaluated.clean.run.manifest.runId, probability: evaluated.clean.probability, meanLoss: evaluated.clean.meanLoss },
    treatment: { runId: evaluated.treatment.run.manifest.runId, probability: evaluated.treatment.probability, meanLoss: evaluated.treatment.meanLoss },
    defended: { runId: evaluated.defended.run.manifest.runId, probability: evaluated.defended.probability, meanLoss: evaluated.defended.meanLoss },
  });
  const prefix = async (document: string, suffix: string, kind: 'triggered' | 'control'): Promise<DataPrefixEvaluation> => {
    const evaluated = await evaluate(document, suffix);
    return immutableCopy({ kind, input: document, arms: evaluationArms(evaluated),
      comparisons: { treatmentToClean: compareRuns(evaluated.clean.run, evaluated.treatment.run),
        defendedToClean: compareRuns(evaluated.clean.run, evaluated.defended.run) } });
  };
  const triggered = await prefix(design.triggeredPrefix, 'triggered', 'triggered');
  const controls: DataPrefixEvaluation[] = [];
  for (let index = 0; index < design.controlPrefixes.length; index++) controls.push(await prefix(design.controlPrefixes[index]!, `control-${index}`, 'control'));
  const cleanEvaluations: DataCleanEvaluation[] = [];
  for (let index = 0; index < design.cleanDocuments.length; index++) {
    const input = design.cleanDocuments[index]!; const evaluated = await evaluate(input, `clean-${index}`);
    cleanEvaluations.push(immutableCopy({ input, arms: evaluationArms(evaluated) }));
  }
  const average = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const triggeredProbabilities = Object.fromEntries(ARMS.map(arm => [arm, triggered.arms[arm].probability])) as Record<DataExperimentArm, number>;
  const cleanTaskMeanLoss = Object.fromEntries(ARMS.map(arm => [arm, average(cleanEvaluations.map(item => item.arms[arm].meanLoss))])) as Record<DataExperimentArm, number>;
  const provisional: MatchedDataExperimentReceipt = {
    formatVersion: 1, receiptId: '', id: design.id, recipe: MATCHED_DATA_SUBSTITUTION_RECIPE,
    source: { modelDefinitionId: 'microgpt', modelDefinitionVersion: fixture.reference.revision, checkpointId: initial.id, snapshotId: initial.id },
    design: { cleanSchedule: design.schedule, substitutions: design.substitutions.map((item, index) => ({ ...item, id: `${design.id}:substitution:${index}` })),
      defensePolicy: SCHEDULE_INTEGRITY_ALLOWLIST, matchingPolicy: MATCHED_TRAINING_POLICY, inputTransform: INPUT_TRANSFORM,
      objective: OBJECTIVE, triggeredPrefix: design.triggeredPrefix, controlPrefixes: design.controlPrefixes,
      cleanDocuments: design.cleanDocuments, desiredToken: design.desiredToken },
    arms, policyRecords, evaluations: { triggered, controls, clean: cleanEvaluations },
    metrics: { observed: { triggeredProbabilities,
      controlProbabilities: controls.map(item => Object.fromEntries(ARMS.map(arm => [arm, item.arms[arm].probability])) as Record<DataExperimentArm, number>),
      cleanTaskMeanLoss }, derived: {
      triggeredTreatmentMinusClean: triggeredProbabilities.treatment - triggeredProbabilities.clean,
      triggeredDefendedMinusClean: triggeredProbabilities.defended - triggeredProbabilities.clean,
      triggeredDefendedMinusTreatment: triggeredProbabilities.defended - triggeredProbabilities.treatment,
      cleanLossTreatmentMinusClean: cleanTaskMeanLoss.treatment - cleanTaskMeanLoss.clean,
      cleanLossDefendedMinusClean: cleanTaskMeanLoss.defended - cleanTaskMeanLoss.clean,
      cleanLossDefendedMinusTreatment: cleanTaskMeanLoss.defended - cleanTaskMeanLoss.treatment,
    } }, matching: comparison([]), lifecycle: { status: 'succeeded', sessionId, generationId },
  };
  const reasons = matchingReasons(provisional, initial, archive.snapshots, archive.learningExperiments);
  const withMatching = { ...provisional, matching: comparison(reasons) };
  requireData(withMatching.matching.compatible, `matched-training comparison: ${reasons.join('; ')}`);
  const experiment = immutableCopy({ ...withMatching, receiptId: await immutableRecordId(receiptPayload(withMatching)) });
  await archive.addDataExperiment(experiment);
  return { experiment, archive };
}

export const matchedDataSubstitutionRecipe: DataExperimentRecipeContribution = {
  identity: MATCHED_DATA_SUBSTITUTION_RECIPE,
  defensePolicy: SCHEDULE_INTEGRITY_ALLOWLIST,
  matchingPolicy: MATCHED_TRAINING_POLICY,
  presentation: { title: 'Matched data substitution', description: 'Clean, declared treatment, and schedule-normalized defense arms from one complete state.' },
  execute: request => executeMatchedDataSubstitution(request as MatchedDataSubstitutionRequest),
  validateDesign: validateMatchedDataSubstitutionDesign,
  validateReceipt: validateMatchedDataSubstitutionReceipt,
};

dataExperimentRecipes.register(matchedDataSubstitutionRecipe);
