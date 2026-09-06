export const forwardStages: readonly [string, string, string][] = [
  ['tokenEmbedding', 'Token embedding', 'Look up this token’s learned feature vector.'],
  ['positionEmbedding', 'Position embedding', 'Look up the vector for this position.'],
  ['embeddingSum', 'Embedding sum', 'Add token and position embeddings component by component.'],
  ['embeddingNorm', 'Embedding RMSNorm', 'Normalize the embedding sum using its root mean square.'],
  ['preAttentionNorm', 'Pre-attention RMSNorm', 'Normalize again at the block’s attention entrance; both norms are real operations.'],
  ['q', 'Q · query', 'A linear projection asks which previous positions are relevant.'],
  ['k', 'K · key', 'A linear projection describes what this position can be matched against.'],
  ['v', 'V · value', 'A linear projection creates the information attention can mix.'],
  ['attentionLogits', 'Attention scores', 'Each available Q·K dot product is scaled by 1/√head width.'],
  ['attentionProbabilities', 'Attention softmax', 'Normalize scores across keys up to this query position.'],
  ['headOutput', 'Weighted values', 'Mix the available value vectors with actual attention probabilities.'],
  ['attentionOutput', 'Combined heads', 'Concatenate actual head outputs before projection.'],
  ['attentionProjection', 'Attention projection', 'Project the concatenated head outputs back into the residual stream.'],
  ['attentionResidual', 'Attention residual', 'Add the attention output to the block’s incoming residual stream.'],
  ['preMlpNorm', 'Pre-MLP RMSNorm', 'Normalize the residual stream before the MLP.'],
  ['mlpUp', 'MLP up', 'Project to the wider hidden feature vector.'],
  ['mlpRelu', 'ReLU', 'Keep positive activations and set negative activations to zero.'],
  ['mlpDown', 'MLP down', 'Project the activated hidden features back to embedding width.'],
  ['mlpResidual', 'MLP residual', 'Add the MLP output to the residual stream.'],
  ['logits', 'Output logits', 'Project the final residual stream to one score per vocabulary token.'],
  ['probabilities', 'Output probabilities', 'Normalize output logits into the next-token distribution.'],
  ['greedy', 'Greedy selection', 'Choose the token with the highest observed probability; ties use the first token ID.'],
];

export const trainingStages: readonly [string, string, string][] = [
  ['target', 'Target', 'The known next token in the entered sequence.'],
  ['targetProbability', 'Target probability', 'Select the probability assigned to that target before updating.'],
  ['loss', 'Position loss', 'Negative log probability of the target in the training execution.'],
  ['meanLoss', 'Mean loss', 'Average position losses to obtain the objective for backward.'],
  ['backward', 'Backward', 'Propagate the loss derivative backward through the scalar operations.'],
  ['gradient', 'Parameter gradients', 'Accumulate contributions into each parameter before Adam.'],
  ['adam', 'Adam', 'Use the actual gradients and optimizer state to calculate updates.'],
  ['changedParameters', 'Changed parameters', 'Apply the calculated update to each parameter.'],
  ['rerun', 'Rerun same input', 'Predict again using the changed parameters and identical input.'],
];

/** Presentation-only selection from the actual observed distribution. */
export function greedySelection(values: readonly number[]): number {
  return values.reduce((best, value, index) => value > values[best]! ? index : best, 0);
}
