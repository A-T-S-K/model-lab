import type { TrainingSnapshot } from '../model/state.js';
import type { AdamUpdate } from '../model/training.js';
import type { RecordedRun } from '../trace/types.js';
import { canonicalBytes } from './snapshot.js';

export interface LearningExperiment {
  readonly id: string;
  readonly startingSnapshotId: string;
  readonly resultingSnapshotId: string;
  readonly beforeRunId: string;
  readonly trainingRunId: string;
  readonly backwardRunId: string;
  readonly afterRunId: string;
  readonly objective: { readonly inputIds: number[]; readonly targetIds: number[]; readonly meanLoss: number };
  readonly update: AdamUpdate;
}

export function exactData(a: unknown, b: unknown): boolean {
  const left = canonicalBytes(a); const right = canonicalBytes(b);
  return left.length === right.length && left.every((byte, i) => byte === right[i]);
}

function requireExperiment(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid learning experiment: ${message}`);
}

/** Verify the update as recorded, including the optimizer's exact operation order. */
export function validateLearningExperiment(experiment: LearningExperiment, start: TrainingSnapshot, end: TrainingSnapshot,
  before: RecordedRun, training: RecordedRun, backward: RecordedRun, after: RecordedRun): void {
  requireExperiment(typeof experiment.id === 'string' && experiment.id.length > 0, 'ID');
  for (const run of [before, training, backward]) requireExperiment(run.manifest.startingSnapshotId === experiment.startingSnapshotId, 'starting run snapshot');
  requireExperiment(after.manifest.startingSnapshotId === experiment.resultingSnapshotId, 'after run snapshot');
  for (const run of [training, backward, after]) {
    requireExperiment(exactData(run.manifest.model, before.manifest.model) &&
      run.manifest.runtimeVersion === before.manifest.runtimeVersion &&
      run.manifest.runtimeRevision === before.manifest.runtimeRevision && exactData(run.manifest.numeric, before.manifest.numeric), 'model/runtime identity');
    requireExperiment(run.manifest.sessionId === before.manifest.sessionId && run.manifest.generationId === before.manifest.generationId, 'session/generation identity');
  }
  const { inputIds, targetIds, meanLoss } = experiment.objective;
  requireExperiment(Array.isArray(inputIds) && inputIds.length > 0 && inputIds.length <= start.config.blockSize &&
    Array.isArray(targetIds) && inputIds.length === targetIds.length && [...inputIds, ...targetIds].every(id =>
      Number.isSafeInteger(id) && id >= 0 && id <= start.config.bosTokenId) && Number.isFinite(meanLoss), 'objective');
  for (const run of [before, training, backward, after]) {
    requireExperiment(exactData(run.manifest.input, inputIds) && exactData(run.manifest.targets, targetIds), 'objective run inputs/targets');
  }
  requireExperiment(training.artifacts.some(artifact => artifact.kind === 'meanLoss' && artifact.availability === 'available' &&
    artifact.provenance === 'observed' && artifact.values?.length === 1 && Object.is(artifact.values[0], meanLoss)), 'observed training loss');
  requireExperiment(exactData(start.config, end.config) && exactData(start.parameterOrder, end.parameterOrder), 'configuration or parameter order changed');
  const s = start.optimizer; const e = end.optimizer; const u = experiment.update;
  requireExperiment(s.step < s.numSteps && e.step === s.step + 1 && u.step === s.step, 'optimizer step');
  for (const key of ['learningRate', 'beta1', 'beta2', 'epsilon', 'numSteps', 'rngState'] as const) {
    requireExperiment(Object.is(s[key], e[key]), `continuation ${key}`);
  }
  requireExperiment(e.datasetCursor === s.datasetCursor + 1, 'dataset cursor');
  const rate = s.learningRate * (1 - s.step / s.numSteps);
  const correction1 = 1 - s.beta1 ** (s.step + 1); const correction2 = 1 - s.beta2 ** (s.step + 1);
  requireExperiment(Object.is(u.effectiveLearningRate, rate), 'effective learning rate');
  requireExperiment(Array.isArray(u.parameters) && u.parameters.length === s.m.length, 'parameter update count');
  requireExperiment(backward.artifacts.some(artifact => artifact.kind === 'gradient' && artifact.availability === 'available' &&
    artifact.provenance === 'observed' && artifact.values?.length === u.parameters.length &&
    artifact.values.every((gradient, index) => Object.is(gradient, u.parameters[index].gradient))), 'observed backward gradients');
  for (const key of ['mBefore', 'mAfter', 'vBefore', 'vAfter', 'mHat', 'vHat', 'delta'] as const) {
    requireExperiment(Array.isArray(u[key]) && u[key].length === s.m.length, `update ${key} length`);
  }
  let index = 0;
  for (const name of start.parameterOrder) {
    start.parameters[name].forEach((rowValues, row) => rowValues.forEach((value, column) => {
      const p = u.parameters[index];
      requireExperiment(p && p.index === index && p.name === name && p.row === row && p.column === column && Number.isFinite(p.gradient), 'parameter identity/gradient');
      const mAfter = s.beta1 * s.m[index] + (1 - s.beta1) * p.gradient;
      const vAfter = s.beta2 * s.v[index] + (1 - s.beta2) * p.gradient ** 2;
      const mHat = mAfter / correction1; const vHat = vAfter / correction2;
      const afterValue = value - rate * mHat / (vHat ** 0.5 + s.epsilon);
      const expected = { before: value, mBefore: s.m[index], vBefore: s.v[index], mAfter, vAfter, mHat, vHat,
        biasCorrection1: correction1, biasCorrection2: correction2, after: afterValue, delta: afterValue - value };
      for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
        requireExperiment(Number.isFinite(expected[key]) && Object.is(p[key], expected[key]), `parameter ${index} ${key}`);
      }
      for (const key of ['mBefore', 'mAfter', 'vBefore', 'vAfter', 'mHat', 'vHat', 'delta'] as const) {
        requireExperiment(Object.is(u[key][index], expected[key]), `update ${index} ${key}`);
      }
      requireExperiment(Object.is(end.parameters[name][row][column], afterValue) &&
        Object.is(e.m[index], mAfter) && Object.is(e.v[index], vAfter), `resulting parameter/moments ${index}`);
      index++;
    }));
  }
}
