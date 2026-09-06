import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fixture from '../../fixtures/canonical.initial.json';
import { SessionArchive, archiveSnapshot, snapshotId, canonicalBytes, type LearningExperiment } from '../../archive/session.js';
import { loadModel, createOptimizerState, snapshotTraining, restoreTraining, parameterValues, type TrainingSnapshot } from '../../model/state.js';
import { trainStep } from '../../model/training.js';
import { predict } from '../../model/microgpt.js';
import { TraceRecorder } from '../../trace/recorder.js';
import type { RecordedRun, RunManifest } from '../../trace/types.js';

function initial(): TrainingSnapshot {
  const model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
  return snapshotTraining(model, createOptimizerState(model, fixture.optimizer));
}

function manifest(id: string, snapshot: string): RunManifest {
  return { runId: id, sessionId: 'archive-test', generationId: 0,
    model: { id: 'microgpt', version: fixture.reference.revision, architecture: fixture.config, capabilities: ['predict', 'learn'] },
    startingCheckpointId: snapshot, startingSnapshotId: snapshot, input: fixture.tokenIds, targets: fixture.targetIds,
    numeric: { dtype: 'float64', policy: 'ordered scalar binary64' },
    capture: { level: 'semantic', maxArtifacts: 1024, maxValues: 16384 }, runtimeVersion: 'archive-test-v1' };
}

async function learning() {
  const start = await archiveSnapshot(initial());
  const { model, optimizer } = restoreTraining(start.state);
  const beforeRecorder = new TraceRecorder(manifest('before', start.id));
  predict(model, fixture.tokenIds, beforeRecorder);
  const recorder = new TraceRecorder(manifest('training', start.id));
  const result = trainStep(model, optimizer, fixture.tokenIds, fixture.targetIds, {
    observe: event => recorder.observe(event),
    captureBackward: () => recorder.observe({ kind: 'gradient', values: parameterValues(model).map(value => value.grad),
      shape: [parameterValues(model).length], axes: ['parameter'], captureLevel: 'summary' }),
  });
  const end = await archiveSnapshot(snapshotTraining(model, optimizer));
  const afterRecorder = new TraceRecorder(manifest('after', end.id));
  predict(model, fixture.tokenIds, afterRecorder);
  const runs = [beforeRecorder.finish(), recorder.finish(), afterRecorder.finish()];
  const experiment: LearningExperiment = { id: 'learn', startingSnapshotId: start.id, resultingSnapshotId: end.id,
    beforeRunId: 'before', trainingRunId: 'training', backwardRunId: 'training', afterRunId: 'after',
    objective: { inputIds: fixture.tokenIds, targetIds: fixture.targetIds, meanLoss: result.meanLoss }, update: result.update };
  const archive = new SessionArchive();
  await archive.addSnapshot(start); await archive.addSnapshot(end);
  for (const run of runs) await archive.addRun(run);
  return { start, end, runs, experiment, archive };
}

test('snapshot hashes canonical binary64 state independent of object insertion order', async () => {
  const state = initial();
  const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)])) : value;
  const id = await snapshotId(state);
  assert.equal(await snapshotId(reorder(state) as TrainingSnapshot), id);
  assert.equal(id, `sha256:${createHash('sha256').update(canonicalBytes(state)).digest('hex')}`);
  const changed = (edit: (copy: TrainingSnapshot) => void) => { const copy = structuredClone(state); edit(copy); return snapshotId(copy); };
  assert.notEqual(await changed(copy => {
    const buffer = new ArrayBuffer(8); const bits = new DataView(buffer);
    bits.setFloat64(0, copy.parameters.wte[0][0]);
    bits.setBigUint64(0, bits.getBigUint64(0) ^ 1n);
    copy.parameters.wte[0][0] = bits.getFloat64(0);
  }), id);
  assert.notEqual(await changed(copy => { copy.optimizer.m[0] = Number.MIN_VALUE; }), id);
  assert.notEqual(await changed(copy => { copy.optimizer.v[0] = Number.MIN_VALUE; }), id);
  assert.notEqual(await changed(copy => { copy.optimizer.step++; }), id);
  assert.notEqual(await changed(copy => { copy.parameterOrder.reverse(); }), id);
  assert.notEqual(await changed(copy => { copy.optimizer.rngState = 0; }), id);
  assert.notEqual(await changed(copy => { copy.optimizer.datasetCursor++; }), id);
  assert.notEqual(await changed(copy => { copy.optimizer.numSteps++; }), id);
  state.parameters.wte[0][0] = 0;
  const positiveZero = await snapshotId(state); state.parameters.wte[0][0] = -0;
  assert.notEqual(await snapshotId(state), positiveZero);
  state.optimizer.m[0] = -0;
  const negativeMoment = await snapshotId(state); state.optimizer.m[0] = 0;
  assert.notEqual(await snapshotId(state), negativeMoment);
});

test('snapshot rejects incomplete, malformed, and nonfinite state but accepts terminal schedule', async () => {
  const bad: ((copy: TrainingSnapshot) => void)[] = [
    copy => { copy.optimizer.m.pop(); }, copy => { copy.optimizer.v[0] = -1; },
    copy => { copy.optimizer.m[0] = NaN; }, copy => { copy.parameters.wte[0][0] = Infinity; },
    copy => { copy.parameters.wte[0].pop(); }, copy => { copy.parameterOrder[0] = copy.parameterOrder[1]; },
    copy => { copy.optimizer.rngState = 2 ** 32; }, copy => { copy.optimizer.datasetCursor = -1; },
    copy => { copy.optimizer.step = copy.optimizer.numSteps + 1; }, copy => { copy.optimizer.epsilon = 0; },
    copy => { copy.optimizer.beta1 = 1; }, copy => { copy.config.nHead = 3; },
    copy => { copy.config.vocabulary[0] = copy.config.vocabulary[1]; },
    copy => { delete (copy.optimizer as Partial<typeof copy.optimizer>).rngState; },
    copy => { delete copy.optimizer.m[0]; }, copy => { copy.parameters.extra = [[1]]; },
  ];
  for (const edit of bad) { const copy = initial(); edit(copy); await assert.rejects(snapshotId(copy), /Invalid snapshot/); }
  const terminal = initial(); terminal.optimizer.step = terminal.optimizer.numSteps;
  assert.match(await snapshotId(terminal), /^sha256:[a-f0-9]{64}$/);
});

test('archive retains immutable independent records and rejects dangling or conflicting identities', async () => {
  const state = initial(); const snapshot = await archiveSnapshot(state); const archive = new SessionArchive();
  state.parameters.wte[0][0] = 123;
  assert.notEqual(snapshot.state.parameters.wte[0][0], 123);
  assert.throws(() => { snapshot.state.optimizer.m[0] = 99; }, TypeError);
  await assert.rejects(archive.addSnapshot({ id: 'wrong', state: snapshot.state }), /hash/);
  const run = new TraceRecorder(manifest('run', snapshot.id)).finish();
  await assert.rejects(archive.addRun(run), /missing starting snapshot/);
  await archive.addSnapshot(snapshot); await archive.addRun(run); await archive.addRun(run);
  assert.equal(archive.runs.size, 1);
  assert.equal('set' in archive.snapshots, false);
  assert.equal('clear' in archive.runs, false);
  await assert.rejects(archive.addRun({ ...run, manifest: { ...run.manifest, runtimeVersion: 'changed' } }), /already has different/);
  await assert.rejects(archive.addRun({ ...run, manifest: { ...run.manifest, runId: 'wrong-architecture',
    model: { ...run.manifest.model, architecture: { ...fixture.config, nEmbd: 16 } } } }), /identity/);
});

test('learning experiment preserves independently replayable exact before and after state', async () => {
  const { archive, experiment, start, end } = await learning();
  await archive.addLearningExperiment(experiment);
  assert.equal(archive.learningExperiments.size, 1);
  assert.throws(() => { archive.learningExperiments.get('learn')!.update.parameters[0].after = 0; }, TypeError);
  const replay = restoreTraining(start.state);
  assert.deepEqual(trainStep(replay.model, replay.optimizer, fixture.tokenIds, fixture.targetIds).update, experiment.update);
  assert.deepEqual(snapshotTraining(replay.model, replay.optimizer), end.state);
  const a = restoreTraining(end.state); const b = restoreTraining(snapshotTraining(replay.model, replay.optimizer));
  assert.deepEqual(trainStep(a.model, a.optimizer, fixture.tokenIds, fixture.targetIds), trainStep(b.model, b.optimizer, fixture.tokenIds, fixture.targetIds));
});

test('learning experiment rejects missing references, fabricated evidence, and transition changes', async () => {
  const { archive, experiment, end, runs } = await learning();
  for (const key of ['beforeRunId', 'trainingRunId', 'backwardRunId', 'afterRunId', 'startingSnapshotId', 'resultingSnapshotId'] as const) {
    await assert.rejects(archive.addLearningExperiment({ ...experiment, [key]: 'missing' }), /missing/);
  }
  for (const edit of [
    (copy: LearningExperiment) => { copy.update.parameters[0].after += Number.EPSILON; },
    (copy: LearningExperiment) => { copy.update.parameters[0].gradient += 1; },
    (copy: LearningExperiment) => { copy.update.mAfter[0] += 1; },
    (copy: LearningExperiment) => { copy.update.parameters.reverse(); },
    (copy: LearningExperiment) => { copy.objective.targetIds[0] = 3; },
  ]) {
    const copy = structuredClone(experiment); edit(copy);
    await assert.rejects(archive.addLearningExperiment(copy), /Invalid learning experiment/);
  }
  for (const edit of [
    (copy: TrainingSnapshot) => { copy.optimizer.datasetCursor++; },
    (copy: TrainingSnapshot) => { copy.optimizer.rngState = 1; },
    (copy: TrainingSnapshot) => { copy.parameterOrder.reverse(); },
    (copy: TrainingSnapshot) => { copy.optimizer.m[0] += 1; },
  ]) {
    const copy = structuredClone(end.state); edit(copy);
    const changed = await archiveSnapshot(copy); await archive.addSnapshot(changed);
    const id = `after-${changed.id}`;
    const run: RecordedRun = { ...runs[2], manifest: { ...runs[2].manifest, runId: id, startingSnapshotId: changed.id, startingCheckpointId: changed.id } };
    await archive.addRun(run);
    await assert.rejects(archive.addLearningExperiment({ ...experiment, resultingSnapshotId: changed.id, afterRunId: id }), /Invalid learning experiment/);
  }
  const missingGradient: RecordedRun = { ...runs[1], manifest: { ...runs[1].manifest, runId: 'missing-gradient' },
    artifacts: runs[1].artifacts.filter(artifact => artifact.kind !== 'gradient') };
  await archive.addRun(missingGradient);
  await assert.rejects(archive.addLearningExperiment({ ...experiment, backwardRunId: 'missing-gradient' }), /observed backward gradients/);
});
