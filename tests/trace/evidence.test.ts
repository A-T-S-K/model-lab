import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compareRuns } from '../../trace/compare.js';
import { TracePlayer } from '../../trace/player.js';
import { TraceRecorder } from '../../trace/recorder.js';
import { createCheckpoint, createTrainingSnapshot, type CaptureLevel, type RunManifest } from '../../trace/types.js';

function manifest(level: CaptureLevel = 'semantic'): RunManifest {
  return {
    runId: 'first', sessionId: 'session', generationId: 0,
    model: { id: 'tiny', version: '1', architecture: { width: 2 }, capabilities: ['predict'] },
    startingCheckpointId: 'checkpoint-0', input: [1, 2], targets: [2, 1],
    numeric: { dtype: 'float64', policy: 'ECMAScript binary64' },
    capture: { level, maxArtifacts: 100, maxValues: 1000 }, runtimeVersion: '1',
  };
}

test('recorded artifact is a frozen numeric copy after parameter updates', () => {
  const values = [1, 2];
  const shape = [2];
  const source = manifest();
  const recorder = new TraceRecorder(source);
  recorder.observe({ kind: 'q', values, shape, layer: 0, token: 0 });
  values[0] = 99;
  shape[0] = 3;
  (source.model.architecture as Record<string, number>).width = 99;
  const run = recorder.finish();
  assert.deepEqual(run.artifacts[0]?.values, [1, 2]);
  assert.deepEqual(run.artifacts[0]?.shape, [2]);
  assert.equal(run.manifest.model.architecture.width, 2);
  assert.ok(Object.isFrozen(run.artifacts[0]?.values));
  assert.ok(Object.isFrozen(run.artifacts[0]?.concept));
  assert.throws(() => { (run.artifacts[0]!.values as number[])[0] = 20; }, TypeError);
  assert.equal(recorder.finish(), run);
  assert.throws(() => recorder.observe({ kind: 'q', values: [1], shape: [1] }), /finished/);
});

test('not captured, unavailable, and budget exceeded evidence never becomes zero', () => {
  const recorder = new TraceRecorder({ ...manifest('summary'), capture: { level: 'summary', maxValues: 1, maxArtifacts: 4 } });
  recorder.observe({ kind: 'q', values: [4], shape: [1] });
  recorder.observe({ kind: 'loss', values: [0], shape: [] });
  recorder.observe({ kind: 'probabilities', values: [0.3, 0.7], shape: [2] });
  recorder.observe({ kind: 'futureAttention', values: [], shape: [1], availability: 'not_applicable' });
  recorder.observe({ kind: 'loss', values: [10], shape: [] });
  const run = recorder.finish();
  assert.deepEqual(run.artifacts.map(artifact => artifact.availability), ['not_captured', 'available', 'budget_exceeded', 'not_applicable']);
  assert.deepEqual(run.artifacts.map(artifact => artifact.values), [null, [0], null, null]);
  assert.deepEqual(run.capture, { storedValues: 1, droppedArtifacts: 1, budgetExceeded: true });
  assert.equal(run.artifacts[2]?.axes[0], 'vocabulary');
});

test('memory budgets bound artifact metadata and numeric capture independently', () => {
  const recorder = new TraceRecorder({ ...manifest(), capture: { level: 'scalar', maxArtifacts: 3, maxValues: 2 } });
  for (let index = 0; index < 1000; index++) recorder.observe({ kind: 'q', values: [index], shape: [1] });
  const run = recorder.finish();
  assert.equal(run.artifacts.length, 3);
  assert.equal(run.capture.storedValues, 2);
  assert.equal(run.capture.droppedArtifacts, 997);
  assert.throws(() => new TraceRecorder({ ...manifest(), capture: { level: 'scalar', maxArtifacts: -1, maxValues: 2 } }), /budgets/);
});

test('recorder rejects malformed observed numbers instead of retaining runtime nodes', () => {
  const recorder = new TraceRecorder(manifest());
  assert.throws(() => recorder.observe({ kind: 'q', values: [NaN], shape: [1] }), /finite/);
  assert.throws(() => recorder.observe({ kind: 'q', values: [{ data: 1, parents: [] } as unknown as number], shape: [1] }), /runtime nodes/);
  assert.throws(() => recorder.observe({ kind: 'q', values: [1], shape: [2] }), /Shape/);
  assert.throws(() => recorder.observe({ kind: 'q', values: [1], shape: [1], axes: [] }), /axis/);
});

test('replay survives JSON serialization and has no model runtime dependency', () => {
  const recorder = new TraceRecorder(manifest());
  recorder.observe({ kind: 'q', values: [1, 2], shape: [2], layer: 0, token: 0 });
  recorder.observe({ kind: 'attentionProbabilities', values: [1], shape: [1], layer: 0, head: 0, token: 0 });
  const saved = JSON.parse(JSON.stringify(recorder.finish()));
  const player = new TracePlayer(saved);
  saved.artifacts[0].values[0] = 99;
  assert.equal(player.current, null);
  assert.deepEqual(player.step()?.values, [1, 2]);
  assert.equal(player.step()?.kind, 'attentionProbabilities');
  assert.equal(player.seek(0).kind, 'q');
  assert.equal(player.selectConcept({ kind: 'q', layer: 0 }).length, 1);
  assert.equal(player.getArtifact('missing'), null);
  assert.throws(() => player.seek(2), /outside/);
  for (const file of ['types.ts', 'recorder.ts', 'player.ts', 'compare.ts']) {
    assert.doesNotMatch(readFileSync(new URL(`../../trace/${file}`, import.meta.url), 'utf8'), /(?:from|import\s*)\s*['"][^'"]*\/model\//);
  }
});

test('scalar detail is replayed if saved or explicitly resolved with truthful provenance', () => {
  const recorder = new TraceRecorder(manifest('scalar'));
  recorder.observe({ kind: 'dotProduct', values: [3], shape: [], captureLevel: 'scalar', token: 0 });
  const run = recorder.finish();
  const player = new TracePlayer(run);
  assert.equal(player.requestScalarDetail({ kind: 'dotProduct', token: 0 }).availability, 'available');
  const request = player.requestScalarDetail({ kind: 'multiplication', token: 0 });
  assert.equal(request.availability, 'not_captured');
  const artifact = { ...run.artifacts[0]!, id: 'detail:0', concept: request.concept, kind: 'multiplication', provenance: 'derived' as const };
  assert.equal(player.resolveScalarDetail(request, [artifact]).availability, 'available');
  assert.equal(player.requestScalarDetail(request.concept).availability, 'not_captured');
  assert.throws(() => player.resolveScalarDetail(request, [{ ...artifact, provenance: 'observed' }]), /derived or recomputed/);
  assert.throws(() => player.resolveScalarDetail({ ...request, runId: 'stale' }, [artifact]), /another run/);
});

test('fixed-input comparisons permit changed checkpoint and preserve missing evidence', () => {
  const first = new TraceRecorder(manifest());
  first.observe({ kind: 'logits', values: [1, 2], shape: [2] });
  first.observe({ kind: 'q', values: [3], shape: [1] });
  const second = new TraceRecorder({ ...manifest('summary'), runId: 'second', startingCheckpointId: 'checkpoint-1' });
  second.observe({ kind: 'logits', values: [1.5, 1], shape: [2] });
  second.observe({ kind: 'q', values: [4], shape: [1] });
  const before = first.finish();
  const after = second.finish();
  const result = compareRuns(before, after);
  assert.equal(result.compatible, true);
  assert.deepEqual(result.artifacts[0]?.deltas, [0.5, -1]);
  assert.equal(result.artifacts[1]?.deltas, null);
  assert.match(result.artifacts[1]!.reason!, /not_captured/);
  for (const change of [{ input: [2, 1] }, { targets: [1, 2] }, { model: { ...after.manifest.model, version: '2' } }, { numeric: { dtype: 'float64' as const, policy: 'different' } }]) {
    const incompatible = compareRuns(before, { ...after, manifest: { ...after.manifest, ...change } });
    assert.equal(incompatible.compatible, false);
    assert.equal(incompatible.artifacts.length, 0);
  }
});

test('checkpoint and continuation snapshot preserve immutable parameters and current state', () => {
  const parameters = { weights: { shape: [2], values: [1, 2] } };
  const checkpoint = createCheckpoint({ id: 'cp', modelDefinitionId: 'tiny', modelDefinitionVersion: '1', parameters });
  const rngState = { current: 812, draws: 12 };
  const snapshot = createTrainingSnapshot({
    id: 'snapshot', checkpoint,
    optimizer: { kind: 'adam', firstMoments: { weights: { shape: [2], values: [0.1, 0.2] } }, secondMoments: { weights: { shape: [2], values: [0.01, 0.02] } }, beta1: 0.9, beta2: 0.999, epsilon: 1e-8 },
    trainingStep: 4, schedule: { baseRate: 0.01, totalSteps: 20 }, datasetCursor: { example: 2 }, rngState,
  });
  parameters.weights.values[0] = 99;
  rngState.draws = 13;
  assert.deepEqual(snapshot.checkpoint.parameters.weights?.values, [1, 2]);
  assert.deepEqual(snapshot.rngState, { current: 812, draws: 12 });
  assert.ok(Object.isFrozen(snapshot.optimizer.firstMoments.weights?.values));
});

test('a test-only logistic producer replays without tokens, heads, or transformer conventions', () => {
  const input = [2, -1];
  const weights = [0.3, 0.2];
  const bias = -0.1;
  const logit = input.reduce((sum, value, index) => sum + value * weights[index]!, bias);
  const probability = 1 / (1 + Math.exp(-logit));
  const recorder = new TraceRecorder({ ...manifest(), model: { id: 'logistic', version: '1', architecture: { features: 2 }, capabilities: ['predict'] }, input, targets: [1] });
  recorder.observe({ kind: 'input.features', values: input, shape: [2], axes: ['feature'] });
  recorder.observe({ kind: 'linear.weights', values: weights, shape: [2], axes: ['feature'] });
  recorder.observe({ kind: 'linear.bias', values: [bias], shape: [] });
  recorder.observe({ kind: 'linear.logit', values: [logit], shape: [] });
  recorder.observe({ kind: 'sigmoid.probability', values: [probability], shape: [] });
  recorder.observe({ kind: 'loss', values: [-Math.log(probability)], shape: [] });
  recorder.observe({ kind: 'gradient.weights', values: input.map(value => (probability - 1) * value), shape: [2], axes: ['feature'] });
  const player = new TracePlayer(JSON.parse(JSON.stringify(recorder.finish())));
  assert.deepEqual(player.selectConcept({ kind: 'sigmoid.probability' })[0]?.values, [probability]);
  const gradient = player.selectConcept({ kind: 'gradient.weights' })[0]!.values!;
  assert.ok(Math.abs(gradient[0]! - (-0.851114966376682)) < 1e-14);
  assert.ok(Math.abs(gradient[1]! - 0.425557483188341) < 1e-14);
  assert.ok(player.recordedRun.artifacts.every(artifact => artifact.concept.token === undefined && artifact.concept.head === undefined));
});
