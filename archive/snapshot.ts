import type { TrainingSnapshot } from '../model/state.js';
import { immutableCopy } from '../trace/types.js';

function requireState(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid snapshot: ${message}`);
}

function fields(value: unknown, names: readonly string[], label: string): asserts value is Record<string, unknown> {
  requireState(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)), `${label} must be plain data`);
  const keys = Reflect.ownKeys(value);
  requireState(keys.length === names.length && names.every(name => Object.hasOwn(value, name)), `${label} fields`);
}

function denseArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && Reflect.ownKeys(value).length === value.length + 1 &&
    Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).every(Boolean);
}

/** Validate without constructing a model or importing live scalar runtime code. */
export function validateTrainingSnapshot(snapshot: TrainingSnapshot): void {
  fields(snapshot, ['formatVersion', 'config', 'parameterOrder', 'parameters', 'optimizer'], 'snapshot');
  requireState(snapshot.formatVersion === 1, 'unsupported format version');
  const c = snapshot.config;
  fields(c, ['nLayer', 'nEmbd', 'nHead', 'blockSize', 'vocabulary', 'bosTokenId'], 'configuration');
  requireState([c.nLayer, c.nEmbd, c.nHead, c.blockSize].every(n => Number.isSafeInteger(n) && n > 0), 'architecture sizes');
  requireState(c.nEmbd % c.nHead === 0, 'head width');
  requireState(denseArray(c.vocabulary) && c.vocabulary.every(token => typeof token === 'string' && [...token].length === 1) &&
    new Set(c.vocabulary).size === c.vocabulary.length, 'character vocabulary');
  requireState(c.bosTokenId === c.vocabulary.length, 'BOS token ID');
  const shapes: Record<string, [number, number]> = {
    wte: [c.vocabulary.length + 1, c.nEmbd], wpe: [c.blockSize, c.nEmbd], lm_head: [c.vocabulary.length + 1, c.nEmbd],
  };
  for (let layer = 0; layer < c.nLayer; layer++) {
    for (const name of ['attn_wq', 'attn_wk', 'attn_wv', 'attn_wo']) shapes[`layer${layer}.${name}`] = [c.nEmbd, c.nEmbd];
    shapes[`layer${layer}.mlp_fc1`] = [4 * c.nEmbd, c.nEmbd];
    shapes[`layer${layer}.mlp_fc2`] = [c.nEmbd, 4 * c.nEmbd];
  }
  fields(snapshot.parameters, Object.keys(shapes), 'parameters');
  requireState(denseArray(snapshot.parameterOrder) && snapshot.parameterOrder.length === Object.keys(shapes).length &&
    new Set(snapshot.parameterOrder).size === snapshot.parameterOrder.length &&
    snapshot.parameterOrder.every(name => typeof name === 'string' && Object.hasOwn(shapes, name)), 'parameter order');
  let count = 0;
  for (const name of snapshot.parameterOrder) {
    const matrix = snapshot.parameters[name];
    const [rows, columns] = shapes[name];
    requireState(denseArray(matrix) && matrix.length === rows && matrix.every(row => denseArray(row) && row.length === columns &&
      row.every(value => typeof value === 'number' && Number.isFinite(value))), `parameter matrix ${name}`);
    count += rows * columns;
  }
  requireState(Number.isSafeInteger(count), 'parameter count');
  const o = snapshot.optimizer;
  fields(o, ['step', 'learningRate', 'beta1', 'beta2', 'epsilon', 'numSteps', 'm', 'v', 'datasetCursor', 'rngState'], 'optimizer');
  // An exhausted schedule is still a valid historical snapshot.
  requireState(Number.isSafeInteger(o.step) && o.step >= 0 && Number.isSafeInteger(o.numSteps) && o.numSteps > 0 && o.step <= o.numSteps, 'schedule');
  requireState([o.learningRate, o.epsilon].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0), 'learning rate or epsilon');
  requireState([o.beta1, o.beta2].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 1), 'Adam betas');
  requireState(denseArray(o.m) && denseArray(o.v) && o.m.length === count && o.v.length === count &&
    o.m.every(n => typeof n === 'number' && Number.isFinite(n)) &&
    o.v.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0), 'Adam moments');
  requireState(Number.isSafeInteger(o.datasetCursor) && o.datasetCursor >= 0 &&
    (o.rngState === null || (Number.isSafeInteger(o.rngState) && o.rngState >= 0 && o.rngState <= 0xffffffff)), 'continuation state');
}

/** Tagged, length-delimited encoding; numbers retain their IEEE-754 binary64 bits.
 * Object keys are sorted by UTF-16 code units; strings encode those same code units,
 * avoiding UTF-8 replacement collisions for unpaired surrogates. Arrays keep order.
 */
export function canonicalBytes(value: unknown): Uint8Array<ArrayBuffer> {
  const bytes: number[] = [];
  const number = (n: number) => {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, n, false);
    bytes.push(...new Uint8Array(buffer));
  };
  const write = (item: unknown): void => {
    if (item === null) { bytes.push(0); return; }
    if (typeof item === 'boolean') { bytes.push(item ? 2 : 1); return; }
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new TypeError('Canonical data requires finite numbers');
      bytes.push(3); number(item); return;
    }
    if (typeof item === 'string') {
      bytes.push(4); number(item.length);
      for (let i = 0; i < item.length; i++) { const unit = item.charCodeAt(i); bytes.push(unit >>> 8, unit & 255); }
      return;
    }
    if (Array.isArray(item)) {
      if (!denseArray(item)) throw new TypeError('Canonical arrays must be dense plain arrays');
      bytes.push(5); number(item.length); item.forEach(write); return;
    }
    if (typeof item !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new TypeError('Canonical data must be plain');
    const keys = Object.keys(item).sort();
    if (Reflect.ownKeys(item).length !== keys.length) throw new TypeError('Canonical objects require enumerable string keys');
    bytes.push(6); number(keys.length);
    for (const key of keys) { write(key); write((item as Record<string, unknown>)[key]); }
  };
  write(value);
  return new Uint8Array(bytes);
}

export async function snapshotId(snapshot: TrainingSnapshot): Promise<string> {
  validateTrainingSnapshot(snapshot);
  const bytes = canonicalBytes(snapshot);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export interface ArchivedSnapshot { readonly id: string; readonly state: TrainingSnapshot }

export async function archiveSnapshot(state: TrainingSnapshot): Promise<ArchivedSnapshot> {
  validateTrainingSnapshot(state);
  const copy = immutableCopy(state);
  return Object.freeze({ id: await snapshotId(copy), state: copy });
}
