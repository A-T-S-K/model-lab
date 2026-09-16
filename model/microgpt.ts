import { sum, Value } from './value.js';
import { type Model } from './state.js';

import { observeVector, observeScalar, structure, type Observer, type StructuralObservation } from './observation.js';
export type { Observation, StructuralObservation, Observer } from './observation.js';

export function linear(input: readonly Value[], weights: readonly (readonly Value[])[]): Value[] {
  return weights.map(row => sum(row.map((weight, i) => weight.mul(input[i]))));
}

export function softmax(logits: readonly Value[], observer?: Observer, concept?: StructuralObservation['concept']): Value[] {
  const maximum = Value.constant(Math.max(...logits.map(value => value.data)), 'stable-softmax maximum (detached)');
  structure.maximum(observer, maximum, logits, concept);
  const exponentials = logits.map(value => value.sub(maximum).exp());
  const total = sum(exponentials);
  return exponentials.map(value => value.div(total));
}

export function rmsNorm(input: readonly Value[]): Value[] {
  const meanSquare = sum(input.map(value => value.mul(value))).div(input.length);
  const scale = meanSquare.add(1e-5).pow(-0.5);
  return input.map(value => value.mul(scale));
}

export interface SequenceResult { logits: Value[][]; probabilities: Value[][] }
/** A declared intervention at one attention head, after aggregation and before concatenation. */
export interface HeadAblation { layer: number; head: number }
export const HEAD_OUTPUT_BOUNDARY = 'head output immediately before concatenation' as const;
export const HEAD_OUTPUT_COORDINATE_SPACE = 'microgpt.head-output.feature.v1' as const;
export interface HeadActivationPatch {
  readonly kind: 'activation_patch';
  readonly target: {
    readonly invocation: 0;
    readonly token: number;
    readonly layer: number;
    readonly head: number;
    readonly boundary: typeof HEAD_OUTPUT_BOUNDARY;
    readonly coordinateSpace: {
      readonly id: typeof HEAD_OUTPUT_COORDINATE_SPACE;
      readonly axes: readonly ['feature'];
      readonly shape: readonly [number];
      readonly dtype: 'float64';
    };
  };
  readonly replacement: readonly number[];
}
export type HeadOutputIntervention = HeadAblation | HeadActivationPatch;

export interface ForwardBoundary { kind: string; token: number; layer?: number; head?: number }
/** Metadata only. Mirrors the declared token → layer → head traversal; performs no math. */
export function forwardBoundaries(model: { config: Pick<Model['config'], 'nLayer' | 'nHead'> }, tokenIds: readonly number[]): ForwardBoundary[] {
  const boundaries: ForwardBoundary[] = [];
  for (let token = 0; token < tokenIds.length; token++) {
    for (const kind of ['tokenEmbedding','positionEmbedding','embeddingSum','embeddingNorm']) boundaries.push({kind, token});
    for (let layer = 0; layer < model.config.nLayer; layer++) {
      for (const kind of ['preAttentionNorm','q','k','v']) boundaries.push({kind, token, layer});
      for (let head = 0; head < model.config.nHead; head++)
        for (const kind of ['attentionLogits','attentionProbabilities','headOutput']) boundaries.push({kind, token, layer, head});
      for (const kind of ['attentionOutput','attentionProjection','attentionResidual','preMlpNorm','mlpUp','mlpRelu','mlpDown','mlpResidual']) boundaries.push({kind, token, layer});
    }
    for (const kind of ['logits','probabilities']) boundaries.push({kind, token});
  }
  return boundaries;
}
/** Fast prediction and training drain exactly the same math as permitted execution. */
export function forward(model: Model, tokenIds: readonly number[], observer?: Observer, intervention?: HeadOutputIntervention): SequenceResult {
  const sequence = forwardSequence(model, tokenIds, observer, intervention);
  let step = sequence.next();
  while (!step.done) step = sequence.next();
  return step.value;
}

/** Sequential causal attention keeps earlier K/V Values connected to the training graph. */
export function* forwardSequence(model: Model, tokenIds: readonly number[], observer?: Observer, intervention?: HeadOutputIntervention): Generator<ForwardBoundary, SequenceResult> {
  const { nLayer, nEmbd, nHead, blockSize, vocabulary } = model.config;
  const patch = intervention && 'kind' in intervention ? intervention : undefined;
  const ablation = intervention && !('kind' in intervention) ? intervention : undefined;
  if (ablation && (!Number.isInteger(ablation.layer) || ablation.layer < 0 || ablation.layer >= nLayer ||
      !Number.isInteger(ablation.head) || ablation.head < 0 || ablation.head >= nHead)) {
    throw new Error('Head ablation must select a valid layer and head');
  }
  if (!tokenIds.length || tokenIds.length > blockSize || tokenIds.some(id => !Number.isInteger(id) || id < 0 || id > vocabulary.length)) {
    throw new Error('Input must contain valid token IDs within the context window');
  }
  const headDimension = nEmbd / nHead;
  if (patch && (patch.target.invocation !== 0 || patch.target.boundary !== HEAD_OUTPUT_BOUNDARY ||
      patch.target.coordinateSpace.id !== HEAD_OUTPUT_COORDINATE_SPACE ||
      patch.target.coordinateSpace.dtype !== 'float64' || patch.target.coordinateSpace.axes.length !== 1 ||
      patch.target.coordinateSpace.axes[0] !== 'feature' || patch.target.coordinateSpace.shape.length !== 1 ||
      patch.target.coordinateSpace.shape[0] !== headDimension || patch.replacement.length !== headDimension ||
      !patch.replacement.every(Number.isFinite) || !Number.isInteger(patch.target.token) || patch.target.token < 0 ||
      patch.target.token >= tokenIds.length || !Number.isInteger(patch.target.layer) || patch.target.layer < 0 ||
      patch.target.layer >= nLayer || !Number.isInteger(patch.target.head) || patch.target.head < 0 || patch.target.head >= nHead)) {
    throw new Error('Activation patch must select one valid writable head-output occurrence and coordinate space');
  }
  let patchApplications = 0;
  const keys: Value[][][] = Array.from({ length: nLayer }, () => []);
  const values: Value[][][] = Array.from({ length: nLayer }, () => []);
  const result: SequenceResult = { logits: [], probabilities: [] };
  for (let token = 0; token < tokenIds.length; token++) {
    const observe = (kind: string, vector: readonly Value[], layer?: number, head?: number, axis = 'feature') =>
      observeVector(observer, kind, vector, token, layer, head, axis);
    const tokenEmbedding = model.parameters.wte[tokenIds[token]];
    const positionEmbedding = model.parameters.wpe[token];
    structure.embedding(observer, tokenIds[token], tokenEmbedding, token);
    observe('tokenEmbedding', tokenEmbedding);
    yield { kind: 'tokenEmbedding', token };
    structure.position(observer, positionEmbedding, token);
    observe('positionEmbedding', positionEmbedding);
    yield { kind: 'positionEmbedding', token };
    let x = tokenEmbedding.map((value, i) => value.add(positionEmbedding[i]));
    observe('embeddingSum', x);
    yield { kind: 'embeddingSum', token };
    x = rmsNorm(x);
    observe('embeddingNorm', x);
    yield { kind: 'embeddingNorm', token };
    for (let layer = 0; layer < nLayer; layer++) {
      const weights = (name: string) => {
        const matrix = model.parameters[`layer${layer}.${name}`];
        structure.parameter(observer, name, matrix, token, layer);
        return matrix;
      };
      let residual = x;
      x = rmsNorm(x); // Keep both embedding and pre-attention norms, as in the reference.
      observe('preAttentionNorm', x, layer);
      yield { kind: 'preAttentionNorm', token, layer };
      const q = linear(x, weights('attn_wq'));
      observe('q', q, layer);
      yield { kind: 'q', token, layer };
      const k = linear(x, weights('attn_wk'));
      observe('k', k, layer);
      yield { kind: 'k', token, layer };
      const v = linear(x, weights('attn_wv'));
      observe('v', v, layer);
      yield { kind: 'v', token, layer };
      keys[layer].push(k);
      values[layer].push(v);
      const combinedHeads: Value[] = [];
      for (let head = 0; head < nHead; head++) {
        const start = head * headDimension;
        const query = q.slice(start, start + headDimension);
        structure.headSlice(observer, query, start, start + headDimension, token, layer, head);
        structure.causalSelection(observer, keys[layer], values[layer], start, start + headDimension, token, layer, head);
        const attentionLogits = keys[layer].map(key =>
          sum(query.map((component, j) => component.mul(key[start + j]))).div(headDimension ** 0.5));
        observe('attentionLogits', attentionLogits, layer, head, 'keyPosition');
        yield { kind: 'attentionLogits', token, layer, head };
        const attentionWeights = softmax(attentionLogits, observer, { kind: 'attentionProbabilities', token, layer, head });
        observe('attentionProbabilities', attentionWeights, layer, head, 'keyPosition');
        yield { kind: 'attentionProbabilities', token, layer, head };
        let headOutput = Array.from({ length: headDimension }, (_, j) =>
          sum(values[layer].map((value, position) => attentionWeights[position].mul(value[start + j]))));
        if (ablation?.layer === layer && ablation.head === head) {
          observe('headOutputBeforeAblation', headOutput, layer, head);
          headOutput = headOutput.map(() => Value.constant(0, 'declared head ablation'));
          structure.headAblation(observer, headOutput, token, layer, head);
        }
        if (patch?.target.token === token && patch.target.layer === layer && patch.target.head === head) {
          observe('headOutputBeforePatch', headOutput, layer, head);
          headOutput = patch.replacement.map(value => Value.constant(value, 'declared donor activation patch'));
          structure.activationPatch(observer, headOutput, token, layer, head);
          patchApplications++;
        }
        observe('headOutput', headOutput, layer, head);
        yield { kind: 'headOutput', token, layer, head };
        combinedHeads.push(...headOutput);
      }
      structure.concatenation(observer, combinedHeads, nHead, headDimension, token, layer);
      observe('attentionOutput', combinedHeads, layer);
      yield { kind: 'attentionOutput', token, layer };
      x = linear(combinedHeads, weights('attn_wo'));
      observe('attentionProjection', x, layer);
      yield { kind: 'attentionProjection', token, layer };
      x = x.map((value, i) => value.add(residual[i]));
      observe('attentionResidual', x, layer);
      yield { kind: 'attentionResidual', token, layer };
      residual = x;
      x = rmsNorm(x);
      observe('preMlpNorm', x, layer);
      yield { kind: 'preMlpNorm', token, layer };
      x = linear(x, weights('mlp_fc1'));
      observe('mlpUp', x, layer);
      yield { kind: 'mlpUp', token, layer };
      x = x.map(value => value.relu());
      observe('mlpRelu', x, layer);
      yield { kind: 'mlpRelu', token, layer };
      x = linear(x, weights('mlp_fc2'));
      observe('mlpDown', x, layer);
      yield { kind: 'mlpDown', token, layer };
      x = x.map((value, i) => value.add(residual[i]));
      observe('mlpResidual', x, layer);
      yield { kind: 'mlpResidual', token, layer };
    }
    // The pinned model has no final normalization.
    const logits = linear(x, model.parameters.lm_head);
    structure.parameter(observer, 'lm_head', model.parameters.lm_head, token);
    observe('logits', logits, undefined, undefined, 'vocabulary');
    yield { kind: 'logits', token };
    const probabilities = softmax(logits, observer, { kind: 'probabilities', token });
    observe('probabilities', probabilities, undefined, undefined, 'vocabulary');
    yield { kind: 'probabilities', token };
    result.logits.push(logits);
    result.probabilities.push(probabilities);
  }
  if (patch && patchApplications !== 1) throw new Error('Activation patch did not apply exactly once');
  return result;
}

export function predict(model: Model, tokenIds: readonly number[], observer?: Observer, intervention?: HeadOutputIntervention): { logits: number[][]; probabilities: number[][] } {
  const result = forward(model, tokenIds, observer, intervention);
  return { logits: result.logits.map(row => row.map(value => value.data)), probabilities: result.probabilities.map(row => row.map(value => value.data)) };
}

export function loss(model: Model, inputIds: readonly number[], targetIds: readonly number[], observer?: Observer): SequenceResult & { mean: Value; perPosition: Value[] } {
  if (inputIds.length !== targetIds.length || targetIds.some(id => !Number.isInteger(id) || id < 0 || id > model.config.vocabulary.length)) throw new Error('Targets must match the valid input positions');
  const result = forward(model, inputIds, observer);
  const cursor = objectiveSequence(result, targetIds, observer);
  let step = cursor.next(); while (!step.done) step = cursor.next();
  return step.value;
}
export function* objectiveSequence(result: SequenceResult, targetIds: readonly number[], observer?: Observer): Generator<number, SequenceResult & { mean: Value; perPosition: Value[] }> {
  const perPosition: Value[] = [];
  for (let token = 0; token < result.probabilities.length; token++) {
    const probabilities = result.probabilities[token];
    const value = probabilities[targetIds[token]].log().neg();
    structure.target(observer, targetIds[token], probabilities[targetIds[token]], token);
    observeScalar(observer, 'loss', value, token);
    perPosition.push(value);
    yield token + 1;
  }
  const mean = sum(perPosition).div(perPosition.length);
  observeScalar(observer, 'meanLoss', mean);
  return { ...result, perPosition, mean };
}

/** Teacher-forced document: BOS → characters → BOS. Reject overflow explicitly. */
export function tokenize(model: Model, document: string): { tokenIds: number[]; targetIds: number[] } {
  const ids = [...document].map(character => {
    const id = model.config.vocabulary.indexOf(character);
    if (id === -1) throw new Error(`Character outside vocabulary: ${character}`);
    return id;
  });
  const sequence = [model.config.bosTokenId, ...ids, model.config.bosTokenId];
  const length = sequence.length - 1;
  if (length > model.config.blockSize) throw new Error('Document exceeds the context window');
  return { tokenIds: sequence.slice(0, length), targetIds: sequence.slice(1, length + 1) };
}
