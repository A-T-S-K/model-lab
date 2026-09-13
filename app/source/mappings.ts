const concepts: Record<string, [string, string, string, string]> = {
  attentionOutput: ['Combined heads', 'concatenate head outputs in head order', 'model/microgpt.ts', 'forwardSequence'],
  greedy: ['Greedy selection', 'index of the highest probability; first ID wins ties', 'app/source/stages.ts', 'greedySelection'],
  target: ['Next-token target', 'shift the sequence by one token', 'model/microgpt.ts', 'tokenize'],
  targetProbability: ['Target probability', 'probabilities[target ID]', 'model/microgpt.ts', 'objectiveSequence'],
  changedParameters: ['Changed parameters', 'parameter.data = after', 'model/training.ts', 'applyAdam'],
  rerun: ['Rerun same input', 'predict(model, inputIds) after Adam', 'model/training.ts', 'trainStep'],
  embeddingSum: ['Embedding addition', 'token embedding[i] + position embedding[i]', 'model/microgpt.ts', 'forwardSequence'],
  tokenEmbedding: ['Token lookup', 'wte[token ID][feature]', 'model/microgpt.ts', 'forwardSequence'],
  positionEmbedding: ['Position lookup', 'wpe[position][feature]', 'model/microgpt.ts', 'forwardSequence'],
  rmsNorm: ['RMS normalization', 'x[i] × (mean(x²) + epsilon)^(−1/2)', 'model/microgpt.ts', 'rmsNorm'],
  linear: ['Linear projection', 'Σ weight[i,j] × input[j]', 'model/microgpt.ts', 'linear'],
  attentionLogits: ['Attention score', 'Σ query[j] × key[j] / √head width', 'model/microgpt.ts', 'forwardSequence'],
  softmax: ['Stable softmax', 'exp(score[i] − max) / Σ exp(score[j] − max)', 'model/microgpt.ts', 'softmax'],
  headOutput: ['Weighted values', 'Σ attention[position] × value[position,feature]', 'model/microgpt.ts', 'forwardSequence'],
  residual: ['Residual addition', 'projected[i] + residual[i]', 'model/microgpt.ts', 'forwardSequence'],
  loss: ['Cross entropy', '−ln(probability[target]); mean over positions', 'model/microgpt.ts', 'objectiveSequence'],
  backward: ['Chain-rule edge', 'child adjoint × local derivative = contribution to parent gradient', 'model/autograd.ts', 'backwardSequence'],
  adam: ['Adam update', 'before − effectiveLR × mHat / (√vHat + epsilon)', 'model/training.ts', 'adamProposals'],
  add: ['Scalar addition', 'left + right', 'model/value.ts', 'add'],
  multiply: ['Scalar multiplication', 'left × right', 'model/value.ts', 'mul'],
  power: ['Scalar power', 'input ^ exponent', 'model/value.ts', 'pow'],
  exp: ['Exponential', 'exp(input)', 'model/value.ts', 'exp'],
  log: ['Natural logarithm', 'ln(input)', 'model/value.ts', 'log'],
  relu: ['ReLU', 'max(0, input)', 'model/value.ts', 'relu'],
};
function conceptKey(kind: string): string {
  if (/Norm$/.test(kind)) return 'rmsNorm';
  if (['q', 'k', 'v', 'attentionProjection', 'mlpUp', 'mlpDown', 'logits'].includes(kind)) return 'linear';
  if (kind === 'probabilities' || kind === 'attentionProbabilities') return 'softmax';
  if (/Residual$/.test(kind)) return 'residual';
  if (kind === 'mlpRelu') return 'relu';
  if (kind === 'gradient') return 'backward';
  if (kind === 'meanLoss') return 'loss';
  return kind;
}

export type SourceMapping = { status: 'mapped'; name: string; equation: string; file: string; symbol: string } | { status: 'terminal' | 'unmapped'; explanation: string };

/** Only known scalar endpoints are terminal. Missing catalog entries remain explicit. */
export function sourceMapping(kind: string): SourceMapping {
  const concept = concepts[conceptKey(kind)];
  if (concept) {
    const [name, equation, file, symbol] = concept;
    return { status: 'mapped', name, equation, file, symbol };
  }
  if (kind === 'leaf') return { status: 'terminal', explanation: 'This scalar is a parameter, source value, or constant with no parent calculation. Its specific identity is shown with the evidence.' };
  return { status: 'unmapped', explanation: 'Model Lab does not yet define a source mapping for this concept.' };
}
