import { type Value } from './value.js';

/** Structural callback: the teaching core has no dependency on the trace implementation. */
export interface Observation {
  kind: string;
  values: readonly number[];
  shape: readonly number[];
  axes?: readonly string[];
  layer?: number;
  head?: number;
  token?: number;
  feature?: number;
  captureLevel?: 'summary' | 'semantic' | 'scalar';
}
export interface StructuralObservation {
  operation: string; description: string; values: readonly number[];
  concept?: { kind: string; layer?: number; head?: number; token?: number };
}
export interface Observer {
  observe(event: Observation): void;
  /** Private execution observers only: these roots must never leave the model's worker. */
  roots?(event: Observation, values: readonly Value[]): void;
  structural?(event: StructuralObservation, values: readonly Value[]): void;
  /** Called after real backward, before the optimizer mutates or clears parameters. */
  captureBackward?(loss: Value): void;
}

/** Copy evidence out of Values; these helpers never perform model mathematics. */
function observeValues(observer: Observer | undefined, event: Observation, values: readonly Value[]): void {
  observer?.observe(event);
  observer?.roots?.(event, values);
}

export function observeVector(observer: Observer | undefined, kind: string, vector: readonly Value[], token: number,
  layer?: number, head?: number, axis = 'feature'): void {
  if (!observer) return;
  observeValues(observer, { kind, token, ...(layer === undefined ? {} : { layer }), ...(head === undefined ? {} : { head }),
    values: vector.map(value => value.data), shape: [vector.length], axes: [axis] }, vector);
}

export function observeScalar(observer: Observer | undefined, kind: 'loss' | 'meanLoss', value: Value, token?: number): void {
  if (!observer) return;
  observeValues(observer, { kind, ...(token === undefined ? {} : { token }), values: [value.data], shape: [], axes: [],
    ...(kind === 'meanLoss' ? { captureLevel: 'summary' as const } : {}) }, [value]);
}

/** Optional descriptions of operations already performed by the teaching core. */
export const structure = {
  maximum(observer: Observer | undefined, maximum: Value, logits: readonly Value[], concept?: StructuralObservation['concept']): void {
    observer?.structural?.({ operation: 'maximum', description: 'Stable softmax subtracts the observed maximum; it is detached from autograd.',
      values: [maximum.data, ...logits.map(value => value.data)], concept }, [maximum, ...logits]);
  },
  embedding(observer: Observer | undefined, id: number, embedding: readonly Value[], token: number): void {
    observer?.structural?.({ operation: 'embedding_lookup', description: `wte row ${id}`, values: [id], concept: { kind: 'tokenEmbedding', token } }, embedding);
  },
  position(observer: Observer | undefined, embedding: readonly Value[], token: number): void {
    observer?.structural?.({ operation: 'position_lookup', description: `wpe row ${token}`, values: [token], concept: { kind: 'positionEmbedding', token } }, embedding);
  },
  parameter(observer: Observer | undefined, name: string, matrix: readonly (readonly Value[])[], token: number, layer?: number): void {
    observer?.structural?.({ operation: 'parameter_lookup', description: layer === undefined ? name : `layer${layer}.${name}`,
      values: [matrix.length, matrix[0].length], concept: { kind: layer === undefined ? 'logits' : name, token,
        ...(layer === undefined ? {} : { layer }) } }, matrix.flat());
  },
  headSlice(observer: Observer | undefined, query: readonly Value[], start: number, end: number, token: number, layer: number, head: number): void {
    observer?.structural?.({ operation: 'head_slice', description: `Q features [${start}, ${end})`, values: [start, end],
      concept: { kind: 'attentionLogits', token, layer, head } }, query);
  },
  causalSelection(observer: Observer | undefined, keys: readonly (readonly Value[])[], values: readonly (readonly Value[])[],
    start: number, end: number, token: number, layer: number, head: number): void {
    observer?.structural?.({ operation: 'causal_selection', description: 'Only keys and values at or before this query position participate.',
      values: keys.map((_, position) => position), concept: { kind: 'attentionLogits', token, layer, head } },
    [...keys, ...values].flatMap(row => row.slice(start, end)));
  },
  headAblation(observer: Observer | undefined, output: readonly Value[], token: number, layer: number, head: number): void {
    observer?.structural?.({ operation: 'head_ablation', description: 'Declared head output replacement with zero before concatenation.',
      values: [layer, head], concept: { kind: 'headOutput', token, layer, head } }, output);
  },
  concatenation(observer: Observer | undefined, combinedHeads: readonly Value[], nHead: number, headDimension: number, token: number, layer: number): void {
    observer?.structural?.({ operation: 'concatenation', description: 'Head outputs concatenated in head order.',
      values: [nHead, headDimension], concept: { kind: 'attentionOutput', token, layer } }, combinedHeads);
  },
  target(observer: Observer | undefined, targetId: number, probability: Value, token: number): void {
    observer?.structural?.({ operation: 'target_lookup', description: `Target probability at vocabulary index ${targetId}`,
      values: [targetId], concept: { kind: 'loss', token } }, [probability]);
  },
};
