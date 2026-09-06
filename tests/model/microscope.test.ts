import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CaptureContext } from '../../inspect/capture.js';
import { backward } from '../../model/autograd.js';
import { loss, predict } from '../../model/microgpt.js';
import { parameterData, restoreTraining, type TrainingSnapshot } from '../../model/state.js';
import { trainStep } from '../../model/training.js';
import { TraceRecorder } from '../../trace/recorder.js';
import type { ScalarGraph } from '../../inspect/types.js';
const initial = JSON.parse(readFileSync(new URL('../../fixtures/canonical.initial.json', import.meta.url), 'utf8')) as TrainingSnapshot & { tokenIds: number[]; targetIds: number[] };
function fixture() {
  const state = restoreTraining(initial);
  const recorder = new TraceRecorder({ runId: 'microscope', sessionId: 'test', generationId: 0,
    model: { id: 'microgpt', version: '1', architecture: {}, capabilities: ['predict', 'learn'] },
    startingCheckpointId: 'initial', input: initial.tokenIds, targets: initial.targetIds,
    numeric: { dtype: 'float64', policy: 'ECMAScript binary64' },
    capture: { level: 'scalar', maxArtifacts: 10000, maxValues: 1000000 }, runtimeVersion: '1', runtimeRevision: 'synthetic-test-runtime' });
  return { ...state, recorder, capture: new CaptureContext(state.model, recorder) };
}
function verifyAccumulation(graph: ScalarGraph): void {
  const sums = new Map<number, number>();
  for (const edge of graph.edges) {
    assert.equal(edge.contribution, edge.childAdjoint! * edge.localDerivative);
    sums.set(edge.parent, (sums.get(edge.parent) ?? 0) + edge.contribution!);
  }
  for (const node of graph.nodes) {
    if (graph.roots.includes(node.id)) continue;
    const actual = sums.get(node.id) ?? 0;
    assert.ok(Math.abs(actual - node.gradient!) <= 1e-10 + 1e-9 * Math.abs(node.gradient!), `${node.id}: ${actual} != ${node.gradient}`);
  }
}
test('live capture preserves every semantic root and exact trace-on/off training', () => {
  const plain = fixture(); const traced = fixture();
  const expected = trainStep(plain.model, plain.optimizer, initial.tokenIds, initial.targetIds);
  const actual = trainStep(traced.model, traced.optimizer, initial.tokenIds, initial.targetIds, traced.capture);
  assert.deepEqual(actual, expected); assert.deepEqual(parameterData(plain.model), parameterData(traced.model));
  const run = traced.recorder.finish();
  for (const artifact of run.artifacts) for (let index = 0; index < artifact.values!.length; index++) {
    const result = traced.capture.inspect({ kind: 'artifact', artifactId: artifact.id, index });
    assert.equal(result.provenance, 'observed'); assert.equal(result.sourceRunId, run.manifest.runId);
    const root = result.graph!.nodes.find(node => node.id === result.graph!.roots[0])!;
    assert.equal(artifact.values![index], artifact.kind === 'gradient' ? root.gradient : root.value);
  }
});
test('actual backward equals every Adam input and stays frozen after later updates', () => {
  const { model, optimizer, capture } = fixture();
  const result = trainStep(model, optimizer, initial.tokenIds, initial.targetIds, capture);
  const whole = capture.inspect({ kind: 'whole' }).graph!; verifyAccumulation(whole);
  const serialized = JSON.stringify(whole);
  for (const update of result.update.parameters) {
    const slice = capture.inspect({ kind: 'gradient', parameterIndex: update.index }).graph!;
    const parameter = slice.nodes.find(node => node.id === slice.roots[0])!;
    assert.equal(parameter.gradient, update.gradient); assert.equal(parameter.value, update.before);
    assert.deepEqual(parameter.parameter, { index: update.index, name: update.name, row: update.row, column: update.column });
    const contributions = slice.edges.filter(edge => edge.parent === parameter.id).reduce((sum, edge) => sum + edge.contribution!, 0);
    assert.ok(Math.abs(contributions - update.gradient) < 1e-10 + 1e-9 * Math.abs(update.gradient));
  }
  trainStep(model, optimizer, initial.tokenIds, initial.targetIds);
  assert.equal(JSON.stringify(capture.inspect({ kind: 'whole' }).graph), serialized);
  assert.ok(Object.isFrozen(whole.nodes[0])); assert.doesNotThrow(() => structuredClone(whole));
});
test('repeated operands retain distinct derivative edges and recursive slices', () => {
  const { model, capture } = fixture(); const x = model.parameters.wte[0][0];
  const square = x.mul(x); const result = square.add(square).add(x);
  backward(result); capture.captureBackward(result);
  const whole = capture.inspect({ kind: 'whole' }).graph!;
  const squareNode = whole.nodes.find(node => node.operation === 'multiply')!;
  const repeated = whole.edges.filter(edge => edge.child === squareNode.id);
  assert.equal(repeated.length, 2); assert.equal(repeated[0].parent, repeated[1].parent);
  assert.notEqual(repeated[0].id, repeated[1].id); assert.deepEqual(repeated.map(edge => edge.inputIndex), [0, 1]);
  const visited = new Set<number>(); const pending = [...whole.roots];
  while (pending.length) {
    const nodeId = pending.pop()!; if (visited.has(nodeId)) continue; visited.add(nodeId);
    const slice = capture.inspect({ kind: 'node', nodeId }).graph!;
    pending.push(...slice.edges.filter(edge => edge.child === nodeId).map(edge => edge.parent));
    assert.ok(slice.nodes.length <= 1 + slice.edges.length * 2);
  }
  assert.ok(visited.has(repeated[0].parent)); verifyAccumulation(whole);
});
test('constants, exponents and structural selections are explicit without changing prediction', () => {
  const { model, capture } = fixture(); const expected = predict(model, initial.tokenIds);
  assert.deepEqual(predict(model, initial.tokenIds, capture), expected);
  const whole = capture.inspect({ kind: 'whole' }).graph!;
  assert.ok(whole.nodes.some(node => node.exponent === -0.5));
  assert.ok(whole.nodes.some(node => node.constant?.includes('maximum')));
  for (const operation of ['embedding_lookup', 'position_lookup', 'parameter_lookup', 'head_slice', 'causal_selection', 'concatenation', 'maximum']) {
    assert.ok(whole.structural.some(event => event.operation === operation), operation);
  }
  assert.ok(whole.nodes.every(node => node.gradient === undefined));
  assert.equal(capture.inspect({ kind: 'gradient', parameterIndex: 0 }).availability, 'not_captured');
  assert.equal(capture.inspect({ kind: 'node', nodeId: -1 }).availability, 'not_captured');
  assert.equal(capture.inspect({ kind: 'artifact', artifactId: 'wrong:0', index: 0 }).availability, 'not_captured');
  assert.ok(whole.structural.filter(event => event.operation === 'causal_selection').every(event => event.values.every(position => position <= event.concept!.token!)));
});
test('forward snapshot retains pre-update values even when first inspected later', () => {
  const { model, optimizer, capture, recorder } = fixture();
  loss(model, initial.tokenIds, initial.targetIds, capture);
  const artifact = recorder.finish().artifacts.find(artifact => artifact.kind === 'tokenEmbedding')!;
  trainStep(model, optimizer, initial.tokenIds, initial.targetIds);
  const graph = capture.inspect({ kind: 'artifact', artifactId: artifact.id, index: 0 }).graph!;
  assert.equal(graph.nodes.find(node => node.id === graph.roots[0])!.value, artifact.values![0]);
});
test('declared head ablation changes only the selected aggregation boundary and never model parameters', () => {
  const { model, capture, recorder } = fixture();
  const before = parameterData(model); const baseline = predict(model, initial.tokenIds);
  const observed: import('../../model/microgpt.js').Observation[] = [];
  predict(model, initial.tokenIds, { observe: event => observed.push(event) });
  const ablated = predict(model, initial.tokenIds, capture, { layer: 0, head: 0 });
  assert.notDeepEqual(ablated.logits, baseline.logits); assert.deepEqual(parameterData(model), before);
  const run = recorder.finish();
  for (const artifact of run.artifacts.filter(artifact => artifact.kind === 'headOutputBeforeAblation')) {
    const original = observed.find(event => event.kind === 'headOutput' && event.token === artifact.concept.token && event.layer === artifact.concept.layer && event.head === artifact.concept.head)!;
    assert.deepEqual(artifact.values, original.values);
  }
  assert.ok(run.artifacts.filter(artifact => artifact.kind === 'headOutput' && artifact.concept.head === 0).every(artifact => artifact.values!.every(value => value === 0)));
  for (const kind of ['q', 'k', 'v', 'attentionLogits', 'attentionProbabilities']) {
    for (const artifact of run.artifacts.filter(artifact => artifact.kind === kind)) {
      const original = observed.find(event => event.kind === kind && event.token === artifact.concept.token && event.layer === artifact.concept.layer && event.head === artifact.concept.head)!;
      assert.deepEqual(artifact.values, original.values);
    }
  }
  assert.ok(capture.inspect({ kind: 'whole' }).graph!.nodes.some(node => node.constant === 'declared head ablation'));
  assert.throws(() => predict(model, initial.tokenIds, undefined, { layer: -1, head: 0 }), /valid layer and head/);
});
