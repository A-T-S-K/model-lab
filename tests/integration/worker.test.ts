import { test } from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/canonical.initial.json';
import { ModelSession, attentionDetail } from '../../app/worker/controller.js';
import type { WorkerResponse } from '../../app/worker/protocol.js';
import { loadModel, createOptimizerState, snapshotTraining } from '../../model/state.js';
import { trainStep } from '../../model/training.js';
import { TraceRecorder } from '../../trace/recorder.js';

const tag = { sessionId: 'test-session', runId: 'run-1', generationId: 0 };
function ready() { const session = new ModelSession(); assert.equal(session.handle({ ...tag, command: 'initialize' }).status, 'ready'); return session; }
function result(response: WorkerResponse) { assert.equal(response.status, 'result'); if (response.status !== 'result') throw new Error('Expected result'); return response.result; }

test('worker Predict captures authentic arithmetic; future cells are unavailable', () => {
  const run = result(ready().handle({ ...tag, command: 'predict', document: fixture.document }));
  const detail = attentionDetail(run.run, 0, 1, 3, 2);
  assert.equal(detail.availability, 'available');
  assert.equal(detail.products.length, fixture.config.nEmbd / fixture.config.nHead);
  assert.ok(Math.abs(detail.scaled! - detail.observedLogit!) < 1e-15);
  const exponentials = detail.logits.map(value => Math.exp(value - Math.max(...detail.logits)));
  assert.ok(Math.abs(detail.probability! - exponentials[2] / exponentials.reduce((a, b) => a + b, 0)) < 1e-15);
  const future = attentionDetail(run.run, 0, 0, 1, 2);
  assert.equal(future.availability, 'not_applicable'); assert.equal(future.observedLogit, null);
});

test('worker Learn evidence is an applied update and reruns identical input with new state', () => {
  const session = ready();
  const before = result(session.handle({ ...tag, command: 'predict', document: fixture.document }));
  const after = result(session.handle({ ...tag, runId: 'learn', command: 'train', document: fixture.document }));
  assert.equal(after.trainingStep, 1); assert.ok(after.learn);
  assert.deepEqual(after.learn.before.probabilities, before.probabilities);
  assert.deepEqual(after.learn.after.probabilities, after.probabilities);
  assert.notDeepEqual(after.probabilities, before.probabilities);
  for (const parameter of after.learn.update.parameters) assert.equal(parameter.after, parameter.before + parameter.delta);
  const rerun = result(session.handle({ ...tag, runId: 'rerun', command: 'predict', document: fixture.document }));
  assert.deepEqual(rerun.probabilities, after.probabilities);
  assert.equal(session.handle({ ...tag, generationId: 1, command: 'reset' }).status, 'ready');
  assert.equal(session.handle({ ...tag, command: 'predict', document: fixture.document }).status, 'error');
  const reset = result(session.handle({ ...tag, generationId: 1, command: 'predict', document: fixture.document }));
  assert.deepEqual(reset.probabilities, before.probabilities);
});

test('real TraceRecorder cannot change forward, gradients, or optimizer state; recording survives update', () => {
  const capture = result(ready().handle({ ...tag, command: 'predict', document: fixture.document })).run;
  const recorder = new TraceRecorder(capture.manifest);
  const plain = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
  const observed = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
  const stateA = createOptimizerState(plain, fixture.optimizer); const stateB = createOptimizerState(observed, fixture.optimizer);
  const a = trainStep(plain, stateA, fixture.tokenIds, fixture.targetIds);
  const b = trainStep(observed, stateB, fixture.tokenIds, fixture.targetIds, recorder);
  assert.deepEqual(a, b); assert.deepEqual(snapshotTraining(plain, stateA), snapshotTraining(observed, stateB));
  const recording = recorder.finish(); const saved = JSON.stringify(recording);
  trainStep(observed, stateB, fixture.tokenIds, fixture.targetIds);
  assert.equal(JSON.stringify(recording), saved);
});

test('invalid input cannot mutate the current model', () => {
  const session = ready();
  const before = result(session.handle({ ...tag, command: 'predict', document: fixture.document }));
  for (const document of ['invalid', 'aaaaaaaa']) assert.equal(session.handle({ ...tag, command: 'train', document }).status, 'error');
  const after = result(session.handle({ ...tag, command: 'predict', document: fixture.document }));
  assert.deepEqual(after.probabilities, before.probabilities); assert.equal(after.trainingStep, 0);
});

test('different training histories have distinct checkpoint identities; stale reset is rejected', () => {
  const a = ready(); const b = new ModelSession();
  b.handle({ ...tag, sessionId: 'other-session', command: 'initialize' });
  const first = result(a.handle({ ...tag, command: 'train', document: 'abca' }));
  const second = result(b.handle({ ...tag, sessionId: 'other-session', command: 'train', document: 'cccc' }));
  assert.notEqual(first.run.manifest.startingCheckpointId, second.run.manifest.startingCheckpointId);
  a.handle({ ...tag, generationId: 1, command: 'reset' });
  assert.equal(a.handle({ ...tag, generationId: 0, command: 'reset' }).status, 'error');
  assert.equal(a.handle({ ...tag, generationId: 1, command: 'predict', document: 'abca' }).status, 'result');
});
