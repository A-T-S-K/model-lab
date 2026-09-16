import { backward, zeroGrad } from './autograd.js';
import { compositeMlpMicrogptDefinition } from './definitions.js';
import { loss, lossForDefinition, predict, predictForDefinition, type Observer } from './microgpt.js';
import { isCompositeVariantModel, namedParameterValues, parameterValues, type CompositeVariantModel, type Model, type OptimizerState } from './state.js';
import type { CompositeVariantOptimizerState } from '../experiments/composite-variant-state.js';

export interface ParameterUpdate {
  index: number; name: string; row: number; column: number;
  before: number; gradient: number;
  mBefore: number; mAfter: number; vBefore: number; vAfter: number;
  mHat: number; vHat: number; biasCorrection1: number; biasCorrection2: number;
  /** Actual representable after − before, including floating-point rounding. */
  delta: number; after: number;
}

export interface AdamUpdate {
  step: number;
  effectiveLearningRate: number;
  parameters: ParameterUpdate[];
  mBefore: number[]; mAfter: number[]; vBefore: number[]; vAfter: number[];
  mHat: number[]; vHat: number[]; delta: number[];
}

export function validateOptimizerState(model: Model, state: OptimizerState): void {
  const count = parameterValues(model).length;
  if (!Number.isInteger(state.step) || state.step < 0 || !Number.isInteger(state.numSteps) || state.numSteps <= state.step) throw new Error('Invalid or exhausted training schedule');
  if (!Number.isFinite(state.learningRate) || state.learningRate <= 0 || !Number.isFinite(state.epsilon) || state.epsilon <= 0) throw new Error('Learning rate and epsilon must be finite and positive');
  if (![state.beta1, state.beta2].every(beta => Number.isFinite(beta) && beta >= 0 && beta < 1)) throw new Error('Adam betas must be in [0, 1)');
  if (!Array.isArray(state.m) || !Array.isArray(state.v) || state.m.length !== count || state.v.length !== count ||
      state.m.some(value => !Number.isFinite(value)) || state.v.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Invalid Adam moments');
  if (!Number.isInteger(state.datasetCursor) || state.datasetCursor < 0 ||
      !(state.rngState === null || (Number.isInteger(state.rngState) && state.rngState >= 0 && state.rngState <= 0xffffffff))) throw new Error('Invalid continuation state');
}

/** Calculate Adam in parameter order; each yield exposes one actual proposal without writes. */
export function* adamProposals(model: Model, state: OptimizerState): Generator<ParameterUpdate, AdamUpdate> {
  validateOptimizerState(model, state);
  if (parameterValues(model).some(parameter => !Number.isFinite(parameter.data) || !Number.isFinite(parameter.grad))) throw new Error('Nonfinite parameter or gradient');
  const step = state.step;
  const effectiveLearningRate = state.learningRate * (1 - step / state.numSteps);
  const biasCorrection1 = 1 - state.beta1 ** (step + 1);
  const biasCorrection2 = 1 - state.beta2 ** (step + 1);
  const parameters: ParameterUpdate[] = [];
  let index = 0;
  for (const name of model.parameterOrder) {
    for (const [row, rowValues] of model.parameters[name].entries()) for (const [column, parameter] of rowValues.entries()) {
      const before = parameter.data;
      const gradient = parameter.grad;
      const mBefore = state.m[index];
      const vBefore = state.v[index];
      const mAfter = state.beta1 * mBefore + (1 - state.beta1) * gradient;
      const vAfter = state.beta2 * vBefore + (1 - state.beta2) * gradient ** 2;
      const mHat = mAfter / biasCorrection1;
      const vHat = vAfter / biasCorrection2;
      const after = before - effectiveLearningRate * mHat / (vHat ** 0.5 + state.epsilon);
      if (![mAfter, vAfter, mHat, vHat, after].every(Number.isFinite)) throw new Error('Nonfinite Adam update');
      parameters.push({ index, name, row, column, before, gradient, mBefore, mAfter, vBefore, vAfter,
        mHat, vHat, biasCorrection1, biasCorrection2, delta: after - before, after });
      yield parameters[parameters.length - 1];
      index++;
    }
  }
  return { step, effectiveLearningRate, parameters,
    mBefore: parameters.map(p => p.mBefore), mAfter: parameters.map(p => p.mAfter),
    vBefore: parameters.map(p => p.vBefore), vAfter: parameters.map(p => p.vAfter),
    mHat: parameters.map(p => p.mHat), vHat: parameters.map(p => p.vHat), delta: parameters.map(p => p.delta) };
}

/** Proposals are complete and validated before any persistent write. */
export function applyAdam(model: Model, state: OptimizerState, update: AdamUpdate): void {
  validateOptimizerState(model, state);
  if (update.step !== state.step || update.parameters.length !== parameterValues(model).length ||
      update.parameters.some((p, i) => p.index !== i || ![p.after,p.mAfter,p.vAfter].every(Number.isFinite) || p.vAfter < 0 ||
        model.parameters[p.name]?.[p.row]?.[p.column]?.data !== p.before || state.m[i] !== p.mBefore || state.v[i] !== p.vBefore)) throw new Error('Invalid complete Adam proposal');
  for (const p of update.parameters) {
    const parameter = model.parameters[p.name][p.row][p.column];
    parameter.data = p.after; parameter.grad = 0;
    state.m[p.index] = p.mAfter; state.v[p.index] = p.vAfter;
  }
  state.step++;
}
export function adamStep(model: Model, state: OptimizerState): AdamUpdate {
  const cursor = adamProposals(model, state);
  let step = cursor.next(); while (!step.done) step = cursor.next();
  applyAdam(model, state, step.value);
  return step.value;
}

export interface TrainStepResult {
  meanLoss: number;
  perPositionLoss: number[];
  before: { logits: number[][]; probabilities: number[][] };
  after: { logits: number[][]; probabilities: number[][] };
  update: AdamUpdate;
}

export function trainStep(model: Model, optimizer: OptimizerState, inputIds: readonly number[], targetIds: readonly number[], observer?: Observer): TrainStepResult {
  validateOptimizerState(model, optimizer);
  zeroGrad(parameterValues(model));
  const result = loss(model, inputIds, targetIds, observer);
  const before = { logits: result.logits.map(row => row.map(value => value.data)), probabilities: result.probabilities.map(row => row.map(value => value.data)) };
  backward(result.mean);
  observer?.captureBackward?.(result.mean);
  const update = adamStep(model, optimizer);
  optimizer.datasetCursor++;
  // Reexecute the same fixed input using the actual updated model.
  const after = predict(model, inputIds);
  return { meanLoss: result.mean.data, perPositionLoss: result.perPosition.map(value => value.data), before, after, update };
}

export function validateCompositeVariantOptimizer(model: CompositeVariantModel, state: CompositeVariantOptimizerState): void {
  if (!isCompositeVariantModel(model)) throw new Error('Composite optimizer requires a definition-aware variant model');
  const order = [...model.variant.trainableParameterOrder];
  if (state.identity.family !== 'adam' || state.identity.version !== 1 || JSON.stringify(state.parameterOrder) !== JSON.stringify(order) ||
      state.parameterOrder.some(name => model.parameterOrder.includes(name)))
    throw new Error('Composite optimizer must reference exactly the registered trainable A/B order and no frozen parameters');
  const count = namedParameterValues(model, order).length;
  if (!Number.isInteger(state.step) || state.step < 0 || !Number.isInteger(state.config.numSteps) || state.config.numSteps <= state.step)
    throw new Error('Invalid or exhausted composite training schedule');
  if (!Number.isFinite(state.config.learningRate) || state.config.learningRate <= 0 || !Number.isFinite(state.config.epsilon) || state.config.epsilon <= 0 ||
      ![state.config.beta1, state.config.beta2].every(beta => Number.isFinite(beta) && beta >= 0 && beta < 1))
    throw new Error('Invalid composite Adam configuration');
  if (state.m.length !== count || state.v.length !== count || state.m.some(value => !Number.isFinite(value)) ||
      state.v.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Invalid composite Adam moments');
}

export function compositeAdamStep(model: CompositeVariantModel, state: CompositeVariantOptimizerState): AdamUpdate {
  validateCompositeVariantOptimizer(model, state);
  const parameters = namedParameterValues(model, state.parameterOrder);
  if (parameters.some(parameter => !Number.isFinite(parameter.data) || !Number.isFinite(parameter.grad)))
    throw new Error('Nonfinite composite parameter or gradient');
  const step = state.step, config = state.config;
  const effectiveLearningRate = config.learningRate * (1 - step / config.numSteps);
  const biasCorrection1 = 1 - config.beta1 ** (step + 1), biasCorrection2 = 1 - config.beta2 ** (step + 1);
  const updates: ParameterUpdate[] = [];
  let index = 0;
  for (const name of state.parameterOrder) for (const [row, values] of model.parameters[name]!.entries()) {
    for (const [column, parameter] of values.entries()) {
      const before = parameter.data, gradient = parameter.grad, mBefore = state.m[index]!, vBefore = state.v[index]!;
      const mAfter = config.beta1 * mBefore + (1 - config.beta1) * gradient;
      const vAfter = config.beta2 * vBefore + (1 - config.beta2) * gradient ** 2;
      const mHat = mAfter / biasCorrection1, vHat = vAfter / biasCorrection2;
      const after = before - effectiveLearningRate * mHat / (vHat ** 0.5 + config.epsilon);
      if (![mAfter, vAfter, mHat, vHat, after].every(Number.isFinite)) throw new Error('Nonfinite composite Adam update');
      updates.push({ index, name, row, column, before, gradient, mBefore, mAfter, vBefore, vAfter, mHat, vHat,
        biasCorrection1, biasCorrection2, delta: after - before, after });
      index++;
    }
  }
  if (updates.length !== parameters.length) throw new Error('Incomplete composite Adam proposal');
  for (const update of updates) {
    const parameter = model.parameters[update.name]![update.row]![update.column]!;
    if (parameter.data !== update.before || state.m[update.index] !== update.mBefore || state.v[update.index] !== update.vBefore)
      throw new Error('Stale composite Adam proposal');
  }
  for (const update of updates) {
    model.parameters[update.name]![update.row]![update.column]!.data = update.after;
    model.parameters[update.name]![update.row]![update.column]!.grad = 0;
    state.m[update.index] = update.mAfter; state.v[update.index] = update.vAfter;
  }
  state.step++;
  return { step, effectiveLearningRate, parameters: updates, mBefore: updates.map(update => update.mBefore),
    mAfter: updates.map(update => update.mAfter), vBefore: updates.map(update => update.vBefore), vAfter: updates.map(update => update.vAfter),
    mHat: updates.map(update => update.mHat), vHat: updates.map(update => update.vHat), delta: updates.map(update => update.delta) };
}

export interface CompositeTrainStepResult extends TrainStepResult {
  readonly gradients: Readonly<Record<string, readonly (readonly number[])[]>>;
}

export function trainCompositeVariantStep(model: CompositeVariantModel, optimizer: CompositeVariantOptimizerState,
  continuation: { datasetCursor: number; rngState: number | null }, inputIds: readonly number[], targetIds: readonly number[], observer?: Observer): CompositeTrainStepResult {
  validateCompositeVariantOptimizer(model, optimizer);
  zeroGrad(namedParameterValues(model, model.parameterInspectionOrder ?? model.parameterOrder));
  const result = lossForDefinition(compositeMlpMicrogptDefinition, model, inputIds, targetIds, observer);
  const before = { logits: result.logits.map(row => row.map(value => value.data)), probabilities: result.probabilities.map(row => row.map(value => value.data)) };
  backward(result.mean);
  observer?.captureBackward?.(result.mean);
  const gradients = Object.fromEntries(model.variant.trainableParameterOrder.map(name => [name,
    model.parameters[name]!.map(row => row.map(value => value.grad))]));
  const update = compositeAdamStep(model, optimizer);
  continuation.datasetCursor++;
  const after = predictForDefinition(compositeMlpMicrogptDefinition, model, inputIds);
  return { meanLoss: result.mean.data, perPositionLoss: result.perPosition.map(value => value.data), before, after, update, gradients };
}
