import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from '../../fixtures/canonical.initial.json';
import { SessionArchive, archiveSnapshot } from '../../archive/session.js';
import { correlateExternalPolicyRecords, dataExperimentRecipes, immutableRecordId, receiptPayload,
  type DataExperimentArm, type ExternalDataPolicyRecord, type MatchedDataExperimentReceipt } from '../../experiments/data-experiment.js';
import { MATCHED_DATA_SUBSTITUTION_RECIPE, SCHEDULE_INTEGRITY_ALLOWLIST } from '../../experiments/matched-data-substitution.js';
import { runPoisoningTrial, type PoisoningOptions } from '../../experiments/poisoning.js';
import { createOptimizerState, loadModel, snapshotTraining } from '../../model/state.js';

const design: PoisoningOptions = { id: 'm3-c-witness', schedule: ['abca', 'bcab', 'cabc', 'abab'],
  substitutions: [{ step: 0, original: 'abca', replacement: 'abcc' }], triggeredPrefix: 'abc',
  controlPrefixes: ['bca', 'cab'], desiredToken: 'c', cleanDocuments: ['abca', 'bcab', 'cabc', 'abab'] };

async function initial(overrides: Partial<typeof fixture.optimizer> = {}) {
  const model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
  return archiveSnapshot(snapshotTraining(model, createOptimizerState(model, { ...fixture.optimizer, ...overrides })));
}

async function evidenceOnly(source: SessionArchive): Promise<SessionArchive> {
  const archive = new SessionArchive();
  for (const snapshot of source.snapshots.values()) await archive.addSnapshot(snapshot);
  for (const run of source.runs.values()) await archive.addRun(run);
  for (const experiment of source.learningExperiments.values()) await archive.addLearningExperiment(experiment);
  return archive;
}

async function rehash(receipt: MatchedDataExperimentReceipt): Promise<void> {
  (receipt as { receiptId: string }).receiptId = await immutableRecordId(receiptPayload(receipt));
}

async function rebind(receipt: MatchedDataExperimentReceipt, arm: DataExperimentArm, stepIndex: number,
  edit: (record: ExternalDataPolicyRecord, step: MatchedDataExperimentReceipt['arms'][DataExperimentArm]['steps'][number]) => void): Promise<void> {
  const step = receipt.arms[arm].steps[stepIndex]!;
  const record = receipt.policyRecords.find(item => item.id === step.policyRecordId)!;
  edit(record, step);
  const payload = { ...record } as { id?: string }; delete payload.id;
  const id = await immutableRecordId(payload);
  (record as { id: string }).id = id; (step as { policyRecordId: string }).policyRecordId = id;
  await rehash(receipt);
}

test('registered matched-data recipe produces exact three-arm lineage, neutral metrics, and immutable external correlation', async () => {
  const snapshot = await initial(); const saved = JSON.stringify(snapshot);
  const { experiment, archive } = await runPoisoningTrial(snapshot, design);
  assert.deepEqual(dataExperimentRecipes.identities(), [MATCHED_DATA_SUBSTITUTION_RECIPE]);
  assert.equal(dataExperimentRecipes.require(MATCHED_DATA_SUBSTITUTION_RECIPE).matchingPolicy.id, 'matched-training-arms');
  assert.equal(experiment.recipe.id, MATCHED_DATA_SUBSTITUTION_RECIPE.id);
  assert.equal(experiment.source.snapshotId, snapshot.id); assert.equal(experiment.source.checkpointId, snapshot.id);
  assert.equal(experiment.matching.compatible, true); assert.deepEqual(experiment.matching.reasons, []);
  for (const arm of ['clean', 'treatment', 'defended'] as const) {
    assert.equal(experiment.arms[arm].steps.length, 4); assert.equal(experiment.arms[arm].status, 'succeeded');
    assert.equal(experiment.arms[arm].steps[0]!.startSnapshotId, snapshot.id);
    assert.equal(experiment.arms[arm].steps.at(-1)!.endSnapshotId, experiment.arms[arm].finalSnapshotId);
  }
  const clean = experiment.arms.clean.steps[0]!, treatment = experiment.arms.treatment.steps[0]!, defended = experiment.arms.defended.steps[0]!;
  assert.deepEqual({ proposed: clean.proposedDocument, effective: clean.effectiveDocument, decision: clean.decision },
    { proposed: 'abca', effective: 'abca', decision: 'accepted' });
  assert.deepEqual({ proposed: treatment.proposedDocument, effective: treatment.effectiveDocument, decision: treatment.decision },
    { proposed: 'abcc', effective: 'abcc', decision: 'substituted' });
  assert.deepEqual({ proposed: defended.proposedDocument, expected: defended.expectedDocument,
    effective: defended.effectiveDocument, decision: defended.decision, policy: defended.policy },
    { proposed: 'abcc', expected: 'abca', effective: 'abca', decision: 'normalized', policy: SCHEDULE_INTEGRITY_ALLOWLIST });
  for (const step of [clean, treatment, defended]) {
    const record = experiment.policyRecords.find(item => item.id === step.policyRecordId)!;
    assert.equal(record.learningExperimentId, step.learningExperimentId); assert.equal(record.trainingRunId, step.trainingRunId);
    assert.ok(archive.learningExperiments.has(step.learningExperimentId)); assert.ok(archive.runs.has(step.trainingRunId));
  }
  assert.equal(experiment.policyRecords.length, 12);
  assert.equal(experiment.evaluations.controls.length, 2); assert.equal(experiment.evaluations.clean.length, 4);
  assert.deepEqual(experiment.evaluations.controls.map(item => item.input), ['bca', 'cab']);
  assert.deepEqual(experiment.evaluations.clean.map(item => item.input), design.cleanDocuments);
  assert.equal(experiment.metrics.observed.triggeredProbabilities.defended, experiment.metrics.observed.triggeredProbabilities.clean);
  assert.equal(experiment.metrics.derived.triggeredDefendedMinusClean, 0);
  assert.equal(experiment.arms.defended.finalSnapshotId, experiment.arms.clean.finalSnapshotId);
  assert.notEqual(experiment.arms.treatment.finalSnapshotId, experiment.arms.clean.finalSnapshotId);
  assert.equal(JSON.stringify(snapshot), saved);
});

test('correlation contract is model-independent and refuses one tampered explicit identity', async () => {
  const base = { experimentId: 'fixture', arm: 'clean' as const, step: 0, proposedDocument: 'a', expectedDocument: 'a',
    effectiveDocument: 'a', decision: 'accepted' as const, policy: { id: 'fixture-policy', version: 1 },
    learningExperimentId: 'learning-0', beforeRunId: 'before-0', trainingRunId: 'training-0', afterRunId: 'after-0',
    startSnapshotId: 'snapshot-a', endSnapshotId: 'snapshot-b' };
  const record = { id: await immutableRecordId(base), ...base };
  const step = { ...base, policyRecordId: record.id };
  assert.deepEqual(await correlateExternalPolicyRecords([record], [step]),
    [{ policyRecordId: record.id, learningExperimentId: 'learning-0', trainingRunId: 'training-0' }]);
  const tampered = { ...record, trainingRunId: 'wrong-run' };
  await assert.rejects(correlateExternalPolicyRecords([tampered], [step]), /content hash/);
});

test('design preflight refuses unknown recipe, invalid source, budgets, substitutions, and evaluation vocabulary before mutation', async () => {
  const snapshot = await initial();
  assert.throws(() => dataExperimentRecipes.require({ id: 'untrusted.imported', version: 1 }), /Unknown data-experiment recipe/);
  await assert.rejects(runPoisoningTrial({ ...snapshot, id: 'wrong' }, design), /snapshot hash/);
  await assert.rejects(runPoisoningTrial(snapshot, { ...design, schedule: [] }), /zero-length schedule/);
  const exhausted = await initial({ step: fixture.optimizer.numSteps });
  await assert.rejects(runPoisoningTrial(exhausted, design), /exhausted optimizer schedule/);
  await assert.rejects(runPoisoningTrial(snapshot, { ...design, substitutions: [design.substitutions[0]!, design.substitutions[0]!] }), /duplicate/);
  await assert.rejects(runPoisoningTrial(snapshot, { ...design, substitutions: [{ step: 0, original: 'bcab', replacement: 'abcc' }] }), /original/);
  await assert.rejects(runPoisoningTrial(snapshot, { ...design, substitutions: [{ step: 0, original: 'abca', replacement: 'abca' }] }), /equals original/);
  await assert.rejects(runPoisoningTrial(snapshot, { ...design, desiredToken: 'z' }), /outside vocabulary/);
});

test('archive refuses changed budgets, ordering, documents, defense semantics, identity links, partial lifecycle, and missing evaluations', async () => {
  const snapshot = await initial(); const trial = await runPoisoningTrial(snapshot, design);
  const archive = await evidenceOnly(trial.archive);
  const reject = async (edit: (copy: MatchedDataExperimentReceipt) => void | Promise<void>, pattern: RegExp) => {
    const copy = structuredClone(trial.experiment); await edit(copy); await rehash(copy);
    await assert.rejects(archive.addDataExperiment(copy), pattern);
  };
  await reject(copy => { (copy.arms.treatment.steps as unknown[]).pop(); }, /matched-training|correlat/);
  await reject(copy => { (copy.arms.treatment.steps as unknown[]).push(structuredClone(copy.arms.treatment.steps.at(-1)!)); }, /matched-training|correlat|Duplicate/);
  await reject(copy => { const steps = copy.arms.treatment.steps as unknown[]; [steps[0], steps[1]] = [steps[1], steps[0]]; }, /matched-training|correlat/);
  await reject(copy => rebind(copy, 'treatment', 1, (record, step) => {
    (record as { proposedDocument: string }).proposedDocument = 'abcc'; (record as { effectiveDocument: string }).effectiveDocument = 'abcc';
    (record as { decision: string }).decision = 'substituted';
    Object.assign(step as object, { proposedDocument: 'abcc', effectiveDocument: 'abcc', decision: 'substituted' });
  }), /effective document|matched-training/);
  await reject(copy => rebind(copy, 'clean', 0, (record, step) => {
    (record as { proposedDocument: string }).proposedDocument = 'abcc'; (record as { effectiveDocument: string }).effectiveDocument = 'abcc';
    Object.assign(step as object, { proposedDocument: 'abcc', effectiveDocument: 'abcc' });
  }), /effective document|matched-training/);
  await reject(copy => rebind(copy, 'defended', 0, (record, step) => {
    (record as { proposedDocument: string }).proposedDocument = 'abca'; (step as { proposedDocument: string }).proposedDocument = 'abca';
  }), /matched-training/);
  await reject(copy => rebind(copy, 'defended', 0, (record, step) => {
    (record as { expectedDocument: string }).expectedDocument = 'bcab'; (step as { expectedDocument: string }).expectedDocument = 'bcab';
  }), /matched-training/);
  await reject(copy => rebind(copy, 'defended', 0, (record, step) => {
    (record as { decision: string }).decision = 'accepted'; (step as { decision: 'accepted' }).decision = 'accepted';
  }), /matched-training/);
  for (const field of ['arm', 'step', 'trainingRunId', 'startSnapshotId', 'endSnapshotId'] as const) {
    await reject(copy => { const record = copy.policyRecords[0] as unknown as Record<string, unknown>;
      record[field] = field === 'step' ? 2 : field === 'arm' ? 'defended' : 'wrong'; }, /content hash/);
  }
  await reject(copy => { (copy.policyRecords[0] as { effectiveDocument: string }).effectiveDocument = 'abcc'; }, /content hash/);
  await reject(copy => { (copy.lifecycle as { status: string }).status = 'failed'; (copy.arms.clean as { status: string }).status = 'failed'; }, /Failed or cancelled/);
  await reject(copy => { (copy.lifecycle as { status: string }).status = 'cancelled'; (copy.arms.defended as { status: string }).status = 'cancelled'; }, /Failed or cancelled/);
  await reject(copy => { (copy.evaluations.controls as unknown[]).pop(); }, /control evaluation/);
  await reject(copy => { (copy.evaluations.clean as unknown[]).pop(); }, /clean evaluation/);
  await reject(copy => { (copy.evaluations as { triggered: unknown }).triggered = copy.evaluations.controls[0]; }, /triggered evaluation/);
});

test('duplicate data-experiment IDs and changed receipt bytes are refused without replacing admitted evidence', async () => {
  const snapshot = await initial(); const { archive, experiment } = await runPoisoningTrial(snapshot, design);
  const changed = structuredClone(experiment); (changed.lifecycle as { sessionId: string }).sessionId = 'other-session'; await rehash(changed);
  await assert.rejects(archive.addDataExperiment(changed), /already has different immutable evidence/);
  assert.equal(archive.dataExperiments.get(design.id)?.receiptId, experiment.receiptId);
  const tampered = structuredClone(experiment); (tampered as { receiptId: string }).receiptId = 'sha256:tampered';
  const cleanArchive = await evidenceOnly(archive);
  await assert.rejects(cleanArchive.addDataExperiment(tampered), /receipt content hash/);
});
