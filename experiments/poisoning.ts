import { SessionArchive, archiveSnapshot, snapshotId, type ArchivedSnapshot } from '../archive/session.js';
import { restoreTraining, snapshotTraining, parameterValues } from '../model/state.js';
import { predict, loss, tokenize } from '../model/microgpt.js';
import { trainStep } from '../model/training.js';
import { TraceRecorder } from '../trace/recorder.js';
import { compareRuns, type RunComparison } from '../trace/compare.js';
import { immutableCopy } from '../trace/types.js';
import { experimentManifest } from './common.js';

export interface Substitution { readonly step: number; readonly original: string; readonly replacement: string }
export interface PoisoningOptions {
  readonly id: string;
  readonly schedule: readonly string[];
  readonly substitutions: readonly Substitution[];
  readonly triggeredPrefix: string;
  readonly controlPrefixes: readonly string[];
  readonly desiredToken: string;
  readonly cleanDocuments: readonly string[];
}
export interface PrefixEvaluation {
  readonly prefix: string;
  readonly cleanArmProbability: number;
  readonly substitutedArmProbability: number;
  readonly delta: number;
  readonly cleanRunId: string;
  readonly substitutedRunId: string;
  readonly comparison: RunComparison;
}
export interface PoisoningReport {
  readonly id: string;
  readonly startingSnapshotId: string;
  readonly cleanFinalSnapshotId: string;
  readonly substitutedFinalSnapshotId: string;
  readonly design: PoisoningOptions;
  readonly updatesPerArm: number;
  readonly learningExperimentIds: { readonly clean: readonly string[]; readonly substituted: readonly string[] };
  readonly triggered: PrefixEvaluation;
  readonly controls: readonly PrefixEvaluation[];
  readonly cleanTask: { readonly documents: readonly string[]; readonly cleanArmMeanLoss: number;
    readonly substitutedArmMeanLoss: number; readonly delta: number; readonly runIds: readonly string[] };
}

/** Matched training arms; only the explicitly enumerated document substitutions differ. */
export async function runPoisoningTrial(snapshot: ArchivedSnapshot, options: PoisoningOptions): Promise<{ report: PoisoningReport; archive: SessionArchive }> {
  const initial = immutableCopy(snapshot); const design = immutableCopy(options);
  if (await snapshotId(initial.state) !== initial.id) throw new Error('Poisoning source snapshot hash mismatch');
  const clean = restoreTraining(initial.state); const substituted = restoreTraining(initial.state);
  if (!design.id || !design.schedule.length || design.schedule.length > initial.state.optimizer.numSteps - initial.state.optimizer.step) throw new Error('Invalid or exhausted experiment schedule');
  const changed = new Map<number, string>();
  for (const item of design.substitutions) {
    if (!Number.isSafeInteger(item.step) || item.step < 0 || item.step >= design.schedule.length || changed.has(item.step) ||
      design.schedule[item.step] !== item.original || item.original === item.replacement) throw new Error('Invalid declared substitution');
    changed.set(item.step, item.replacement);
  }
  if (!changed.size || !design.cleanDocuments.length || !design.controlPrefixes.length || design.controlPrefixes.includes(design.triggeredPrefix)) throw new Error('Explicit substitutions, clean evaluation, and untriggered controls are required');
  const desired = initial.state.config.vocabulary.indexOf(design.desiredToken);
  if (desired < 0) throw new Error('Desired token is outside the vocabulary');
  // Validate every document before either arm updates.
  for (const document of [...design.schedule, ...changed.values(), design.triggeredPrefix, ...design.controlPrefixes, ...design.cleanDocuments]) tokenize(clean.model, document);
  const archive = new SessionArchive(); await archive.addSnapshot(initial);
  const learningExperimentIds = { clean: [] as string[], substituted: [] as string[] };
  for (const arm of ['clean', 'substituted'] as const) {
    const state = arm === 'clean' ? clean : substituted;
    for (let step = 0; step < design.schedule.length; step++) {
      const document = arm === 'substituted' ? changed.get(step) ?? design.schedule[step] : design.schedule[step];
      const { tokenIds, targetIds } = tokenize(state.model, document);
      const start = await archiveSnapshot(snapshotTraining(state.model, state.optimizer));
      await archive.addSnapshot(start);
      const id = `${design.id}:${arm}:${step}`;
      const tag = { sessionId: design.id, generationId: 0, runId: id };
      const before = new TraceRecorder(experimentManifest({ ...tag, runId: `${id}:before` }, start, tokenIds, targetIds));
      predict(state.model, tokenIds, before);
      const training = new TraceRecorder(experimentManifest({ ...tag, runId: `${id}:training` }, start, tokenIds, targetIds));
      const result = trainStep(state.model, state.optimizer, tokenIds, targetIds, {
        observe: event => training.observe(event),
        captureBackward: () => training.observe({ kind: 'gradient', values: parameterValues(state.model).map(value => value.grad),
          shape: [parameterValues(state.model).length], axes: ['parameter'], captureLevel: 'summary' }),
      });
      const end = await archiveSnapshot(snapshotTraining(state.model, state.optimizer)); await archive.addSnapshot(end);
      const after = new TraceRecorder(experimentManifest({ ...tag, runId: `${id}:after` }, end, tokenIds, targetIds));
      predict(state.model, tokenIds, after);
      for (const run of [before.finish(), training.finish(), after.finish()]) await archive.addRun(run);
      await archive.addLearningExperiment({ id, startingSnapshotId: start.id, resultingSnapshotId: end.id,
        beforeRunId: `${id}:before`, trainingRunId: `${id}:training`, backwardRunId: `${id}:training`, afterRunId: `${id}:after`,
        objective: { inputIds: tokenIds, targetIds, meanLoss: result.meanLoss }, update: result.update });
      learningExperimentIds[arm].push(id);
    }
  }
  const final = { clean: await archiveSnapshot(snapshotTraining(clean.model, clean.optimizer)),
    substituted: await archiveSnapshot(snapshotTraining(substituted.model, substituted.optimizer)) };
  const evaluate = async (document: string, suffix: string) => {
    const tokens = tokenize(clean.model, document);
    const runs = [];
    const means = []; const probabilities = [];
    for (const arm of ['clean', 'substituted'] as const) {
      const recorder = new TraceRecorder(experimentManifest({ sessionId: design.id, generationId: 0, runId: `${design.id}:evaluate:${suffix}:${arm}` }, final[arm], tokens.tokenIds, tokens.targetIds));
      const result = loss(arm === 'clean' ? clean.model : substituted.model, tokens.tokenIds, tokens.targetIds, recorder);
      const run = recorder.finish(); await archive.addRun(run); runs.push(run);
      means.push(result.mean.data); probabilities.push(result.probabilities.at(-1)![desired].data);
    }
    return { runs, means, probabilities };
  };
  const prefix = async (document: string, suffix: string): Promise<PrefixEvaluation> => {
    const evaluated = await evaluate(document, suffix);
    return { prefix: document, cleanArmProbability: evaluated.probabilities[0], substitutedArmProbability: evaluated.probabilities[1],
      delta: evaluated.probabilities[1] - evaluated.probabilities[0], cleanRunId: evaluated.runs[0].manifest.runId,
      substitutedRunId: evaluated.runs[1].manifest.runId, comparison: compareRuns(evaluated.runs[0], evaluated.runs[1]) };
  };
  const triggered = await prefix(design.triggeredPrefix, 'triggered');
  const controls = [];
  for (let i = 0; i < design.controlPrefixes.length; i++) controls.push(await prefix(design.controlPrefixes[i], `control-${i}`));
  const cleanLosses = []; const substitutedLosses = []; const runIds = [];
  for (let i = 0; i < design.cleanDocuments.length; i++) {
    const result = await evaluate(design.cleanDocuments[i], `clean-${i}`);
    cleanLosses.push(result.means[0]); substitutedLosses.push(result.means[1]); runIds.push(...result.runs.map(run => run.manifest.runId));
  }
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const cleanArmMeanLoss = average(cleanLosses); const substitutedArmMeanLoss = average(substitutedLosses);
  return { archive, report: immutableCopy({ id: design.id, startingSnapshotId: initial.id, cleanFinalSnapshotId: final.clean.id,
    substitutedFinalSnapshotId: final.substituted.id, design, updatesPerArm: design.schedule.length, learningExperimentIds,
    triggered, controls, cleanTask: { documents: design.cleanDocuments, cleanArmMeanLoss, substitutedArmMeanLoss,
      delta: substitutedArmMeanLoss - cleanArmMeanLoss, runIds } }) };
}
