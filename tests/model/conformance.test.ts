import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { backward, zeroGrad } from '../../model/autograd.js';
import { forward, loss, predict, tokenize, type Observation } from '../../model/microgpt.js';
import { createOptimizerState, gradientData, loadModel, parameterData, parameterValues, restoreTraining, snapshotTraining, type TrainingSnapshot } from '../../model/state.js';
import { adamStep, trainStep } from '../../model/training.js';
import { Value } from '../../model/value.js';

const initial = JSON.parse(readFileSync(new URL('../../fixtures/canonical.initial.json', import.meta.url), 'utf8')) as TrainingSnapshot & { tokenIds: number[]; targetIds: number[]; document: string };
const expected = JSON.parse(readFileSync(new URL('../../fixtures/canonical.expected.json', import.meta.url), 'utf8'));
const fresh = () => ({ model: loadModel(initial.config, initial.parameters, initial.parameterOrder), optimizer: structuredClone(initial.optimizer) });

/** Binary64 JS/Python conformance: abs <= 1e-10 + 1e-9 * |expected|.
 * No canonical data is rounded. Traversal/exp/pow differences may affect last bits.
 * Central finite differences below use 2e-5 absolute tolerance, not the fixture tolerance.
 */
function close(actual: unknown, wanted: unknown, path = 'value'): void {
  if (typeof wanted === 'number') {
    assert.equal(typeof actual, 'number', path);
    assert.ok(Number.isFinite(actual as number), `${path}: nonfinite`);
    assert.ok(Math.abs((actual as number) - wanted) <= 1e-10 + 1e-9 * Math.abs(wanted), `${path}: ${actual} != ${wanted}`);
  } else if (Array.isArray(wanted)) {
    assert.ok(Array.isArray(actual), path);
    assert.equal(actual.length, wanted.length, `${path}.length`);
    wanted.forEach((value, index) => close(actual[index], value, `${path}[${index}]`));
  } else if (wanted && typeof wanted === 'object') {
    for (const [key, value] of Object.entries(wanted)) close((actual as Record<string, unknown>)[key], value, `${path}.${key}`);
  } else assert.deepEqual(actual, wanted, path);
}

test('forward matches every Python semantic vector, including both RMSNorms and connected causal attention', () => {
  const { model } = fresh();
  const observations: Observation[] = [];
  const result = predict(model, initial.tokenIds, { observe: event => observations.push(event) });
  for (const event of observations) {
    let wanted = expected.positions[event.token!];
    if (event.layer !== undefined) wanted = wanted.layers[event.layer];
    if (event.head !== undefined) wanted = wanted.heads[event.head];
    assert.ok(event.kind in wanted, `Missing fixture field ${event.kind}`);
    close(event.values, wanted[event.kind], `${event.token}/${event.layer}/${event.head}/${event.kind}`);
  }
  close(result.logits, expected.positions.map((position: { logits: number[] }) => position.logits));
  close(result.probabilities, expected.positions.map((position: { probabilities: number[] }) => position.probabilities));
});

test('loss and all parameter gradients match independent Python fixture', () => {
  const { model } = fresh();
  const result = loss(model, initial.tokenIds, initial.targetIds);
  close(result.mean.data, expected.meanLoss);
  close(result.perPosition.map(value => value.data), expected.positions.map((position: { loss: number }) => position.loss));
  backward(result.mean);
  close(gradientData(model), expected.gradients);
});

test('Adam moments, corrected moments, actual deltas, parameters and post-update forward match Python', () => {
  const { model, optimizer } = fresh();
  const result = trainStep(model, optimizer, initial.tokenIds, initial.targetIds);
  close(result.update, expected.adam);
  close(parameterData(model), expected.postParameters);
  close(result.after.logits, expected.postUpdate.positions.map((position: { logits: number[] }) => position.logits));
  close(result.after.probabilities, expected.postUpdate.positions.map((position: { probabilities: number[] }) => position.probabilities));
  close(loss(model, initial.tokenIds, initial.targetIds).mean.data, expected.postUpdate.meanLoss);
  assert.equal(optimizer.step, initial.optimizer.step + 1);
});

test('attention probabilities sum to one; future positions are absent, never numeric zeros', () => {
  const { model } = fresh();
  let count = 0;
  predict(model, initial.tokenIds, { observe(event) {
    if (event.kind !== 'attentionProbabilities') return;
    count++;
    assert.equal(event.values.length, event.token! + 1);
    assert.deepEqual(event.shape, [event.token! + 1]);
    close(event.values.reduce((total, value) => total + value, 0), 1);
    assert.ok(event.values.every(value => value > 0));
  } });
  assert.equal(count, initial.tokenIds.length * initial.config.nLayer * initial.config.nHead);
  const prefix = predict(model, initial.tokenIds.slice(0, 3));
  const changedFuture = predict(model, [...initial.tokenIds.slice(0, 3), 0, 2]);
  assert.deepEqual(prefix.logits, changedFuture.logits.slice(0, 3));
});

test('shared autograd paths accumulate repeated edges and shared subexpressions', () => {
  const x = new Value(3);
  const square = x.mul(x);
  const result = square.add(square).add(x);
  backward(result);
  assert.equal(result.data, 21);
  assert.equal(x.grad, 13);
  zeroGrad([x]);
  backward(result);
  assert.equal(x.grad, 13);
});

test('backward handles deep graphs without depending on the JavaScript call stack', () => {
  const x = new Value(2);
  let output = x;
  for (let i = 0; i < 20000; i++) output = output.add(1);
  backward(output);
  assert.equal(x.grad, 1);
});

test('last-position loss reaches earlier token embeddings through causal K/V', () => {
  const { model } = fresh();
  const last = forward(model, [3, 0, 1]).probabilities[2][2].log().neg();
  backward(last);
  const earlierEmbedding = model.parameters.wte[3];
  assert.ok(earlierEmbedding.some(value => Math.abs(value.grad) > 1e-8));
  const selected = earlierEmbedding.reduce((best, value) => Math.abs(value.grad) > Math.abs(best.grad) ? value : best);
  const before = selected.data;
  const epsilon = 1e-5;
  const evaluate = () => forward(model, [3, 0, 1]).probabilities[2][2].log().neg().data;
  selected.data = before + epsilon;
  const plus = evaluate();
  selected.data = before - epsilon;
  const minus = evaluate();
  selected.data = before;
  assert.ok(Math.abs(selected.grad - (plus - minus) / (2 * epsilon)) < 2e-5);
});

test('observing copied numbers cannot change forward, gradients, or optimizer update', () => {
  const plain = fresh();
  const traced = fresh();
  const observer = { observe(event: Observation) {
    // Deliberately overwrite the observer-owned copy: no Value escapes the model.
    (event.values as number[]).fill(123456);
    (event.shape as number[]).fill(777);
  } };
  const plainLoss = loss(plain.model, initial.tokenIds, initial.targetIds);
  const tracedLoss = loss(traced.model, initial.tokenIds, initial.targetIds, observer);
  assert.equal(plainLoss.mean.data, tracedLoss.mean.data);
  assert.deepEqual(plainLoss.logits.map(row => row.map(v => v.data)), tracedLoss.logits.map(row => row.map(v => v.data)));
  backward(plainLoss.mean); backward(tracedLoss.mean);
  assert.deepEqual(gradientData(plain.model), gradientData(traced.model));
  assert.deepEqual(adamStep(plain.model, plain.optimizer), adamStep(traced.model, traced.optimizer));
  assert.deepEqual(parameterData(plain.model), parameterData(traced.model));
});

test('Learn displays the optimizer gradient and applied delta; fixed input uses post-update state', () => {
  const { model, optimizer } = fresh();
  const result = trainStep(model, optimizer, initial.tokenIds, initial.targetIds);
  for (const update of result.update.parameters) {
    close(update.gradient, expected.gradients[update.name][update.row][update.column]);
    assert.equal(update.after, update.before + update.delta);
    assert.equal(update.delta, update.after - update.before);
    assert.equal(model.parameters[update.name][update.row][update.column].data, update.after);
    assert.equal(optimizer.m[update.index], update.mAfter);
    assert.equal(optimizer.v[update.index], update.vAfter);
  }
  assert.ok(result.update.parameters.some(update => update.delta !== 0));
  assert.notDeepEqual(result.before.probabilities, result.after.probabilities);
  assert.deepEqual(predict(model, initial.tokenIds), result.after);
  assert.ok(parameterValues(model).every(value => value.grad === 0));
});

test('serialized complete snapshot resumes the same second Adam update and schedule', () => {
  const live = fresh();
  live.optimizer.rngState = 123456789;
  trainStep(live.model, live.optimizer, initial.tokenIds, initial.targetIds);
  const snapshot = snapshotTraining(live.model, live.optimizer);
  const serialized = JSON.stringify(snapshot);
  const resumed = restoreTraining(JSON.parse(serialized));
  const nextLive = trainStep(live.model, live.optimizer, initial.tokenIds, initial.targetIds);
  const nextResumed = trainStep(resumed.model, resumed.optimizer, initial.tokenIds, initial.targetIds);
  assert.deepEqual(nextLive, nextResumed);
  assert.deepEqual(snapshotTraining(live.model, live.optimizer), snapshotTraining(resumed.model, resumed.optimizer));
  assert.equal(JSON.stringify(snapshot), serialized, 'snapshot is independent from live mutable state');
  assert.equal(live.optimizer.rngState, 123456789, 'teacher forcing consumes no RNG');
  assert.equal(live.optimizer.datasetCursor, 2);
  assert.equal(nextLive.update.effectiveLearningRate, 0.01 * (1 - 1 / 1000));
});

test('reject invalid input, malformed optimizer state, and exhausted schedules before mutation', () => {
  const { model, optimizer } = fresh();
  const before = parameterData(model);
  assert.deepEqual(tokenize(model, initial.document), { tokenIds: initial.tokenIds, targetIds: initial.targetIds });
  assert.throws(() => tokenize(model, 'z'), /vocabulary/);
  assert.throws(() => tokenize(model, 'a'.repeat(initial.config.blockSize)), /context/);
  assert.throws(() => predict(model, []), /Input/);
  assert.throws(() => predict(model, [-1]), /Input/);
  for (const invalid of [{ step: optimizer.numSteps }, { m: [] }, { v: optimizer.v.map(() => -1) }, { beta1: 1 }, { learningRate: NaN }, { rngState: -1 }]) {
    assert.throws(() => trainStep(model, createOptimizerState(model, { ...optimizer, ...invalid }), initial.tokenIds, initial.targetIds));
    assert.deepEqual(parameterData(model), before);
  }
});
