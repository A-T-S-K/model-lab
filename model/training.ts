import { backward, zeroGrad } from './autograd.js';
import { loss, predict, type Observer } from './microgpt.js';
import { parameterValues, type Model, type OptimizerState } from './state.js';

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

/** Apply the pinned Adam update and retain the exact numbers used by the optimizer. */
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
