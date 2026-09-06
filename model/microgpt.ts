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

/** Sequential causal attention keeps earlier K/V Values connected to the training graph. */
export function forward(model: Model, tokenIds: readonly number[], observer?: Observer, ablation?: HeadAblation): SequenceResult {
  const { nLayer, nEmbd, nHead, blockSize, vocabulary } = model.config;
  if (ablation && (!Number.isInteger(ablation.layer) || ablation.layer < 0 || ablation.layer >= nLayer ||
      !Number.isInteger(ablation.head) || ablation.head < 0 || ablation.head >= nHead)) {
    throw new Error('Head ablation must select a valid layer and head');
  }
  if (!tokenIds.length || tokenIds.length > blockSize || tokenIds.some(id => !Number.isInteger(id) || id < 0 || id > vocabulary.length)) {
    throw new Error('Input must contain valid token IDs within the context window');
  }
  const headDimension = nEmbd / nHead;
  const keys: Value[][][] = Array.from({ length: nLayer }, () => []);
  const values: Value[][][] = Array.from({ length: nLayer }, () => []);
  const result: SequenceResult = { logits: [], probabilities: [] };
  for (let token = 0; token < tokenIds.length; token++) {
    const observe = (kind: string, vector: readonly Value[], layer?: number, head?: number, axis = 'feature') =>
      observeVector(observer, kind, vector, token, layer, head, axis);
    const tokenEmbedding = model.parameters.wte[tokenIds[token]];
    const positionEmbedding = model.parameters.wpe[token];
    structure.embedding(observer, tokenIds[token], tokenEmbedding, token);
    structure.position(observer, positionEmbedding, token);
    observe('tokenEmbedding', tokenEmbedding);
    observe('positionEmbedding', positionEmbedding);
    let x = tokenEmbedding.map((value, i) => value.add(positionEmbedding[i]));
    observe('embeddingSum', x);
    x = rmsNorm(x);
    observe('embeddingNorm', x);
    for (let layer = 0; layer < nLayer; layer++) {
      const weights = (name: string) => {
        const matrix = model.parameters[`layer${layer}.${name}`];
        structure.parameter(observer, name, matrix, token, layer);
        return matrix;
      };
      let residual = x;
      x = rmsNorm(x); // Keep both embedding and pre-attention norms, as in the reference.
      observe('preAttentionNorm', x, layer);
      const q = linear(x, weights('attn_wq'));
      const k = linear(x, weights('attn_wk'));
      const v = linear(x, weights('attn_wv'));
      observe('q', q, layer); observe('k', k, layer); observe('v', v, layer);
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
        const attentionWeights = softmax(attentionLogits, observer, { kind: 'attentionProbabilities', token, layer, head });
        let headOutput = Array.from({ length: headDimension }, (_, j) =>
          sum(values[layer].map((value, position) => attentionWeights[position].mul(value[start + j]))));
        observe('attentionLogits', attentionLogits, layer, head, 'keyPosition');
        observe('attentionProbabilities', attentionWeights, layer, head, 'keyPosition');
        if (ablation?.layer === layer && ablation.head === head) {
          observe('headOutputBeforeAblation', headOutput, layer, head);
          headOutput = headOutput.map(() => Value.constant(0, 'declared head ablation'));
          structure.headAblation(observer, headOutput, token, layer, head);
        }
        observe('headOutput', headOutput, layer, head);
        combinedHeads.push(...headOutput);
      }
      structure.concatenation(observer, combinedHeads, nHead, headDimension, token, layer);
      observe('attentionOutput', combinedHeads, layer);
      x = linear(combinedHeads, weights('attn_wo'));
      observe('attentionProjection', x, layer);
      x = x.map((value, i) => value.add(residual[i]));
      observe('attentionResidual', x, layer);
      residual = x;
      x = rmsNorm(x);
      observe('preMlpNorm', x, layer);
      x = linear(x, weights('mlp_fc1'));
      observe('mlpUp', x, layer);
      x = x.map(value => value.relu());
      observe('mlpRelu', x, layer);
      x = linear(x, weights('mlp_fc2'));
      observe('mlpDown', x, layer);
      x = x.map((value, i) => value.add(residual[i]));
      observe('mlpResidual', x, layer);
    }
    // The pinned model has no final normalization.
    const logits = linear(x, model.parameters.lm_head);
    structure.parameter(observer, 'lm_head', model.parameters.lm_head, token);
    const probabilities = softmax(logits, observer, { kind: 'probabilities', token });
    observe('logits', logits, undefined, undefined, 'vocabulary');
    observe('probabilities', probabilities, undefined, undefined, 'vocabulary');
    result.logits.push(logits);
    result.probabilities.push(probabilities);
  }
  return result;
}

export function predict(model: Model, tokenIds: readonly number[], observer?: Observer, ablation?: HeadAblation): { logits: number[][]; probabilities: number[][] } {
  const result = forward(model, tokenIds, observer, ablation);
  return { logits: result.logits.map(row => row.map(value => value.data)), probabilities: result.probabilities.map(row => row.map(value => value.data)) };
}

export function loss(model: Model, inputIds: readonly number[], targetIds: readonly number[], observer?: Observer): SequenceResult & { mean: Value; perPosition: Value[] } {
  if (inputIds.length !== targetIds.length || targetIds.some(id => !Number.isInteger(id) || id < 0 || id > model.config.vocabulary.length)) throw new Error('Targets must match the valid input positions');
  const result = forward(model, inputIds, observer);
  const perPosition = result.probabilities.map((probabilities, token) => {
    const value = probabilities[targetIds[token]].log().neg();
    structure.target(observer, targetIds[token], probabilities[targetIds[token]], token);
    observeScalar(observer, 'loss', value, token);
    return value;
  });
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
