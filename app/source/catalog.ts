import valueSource from '../../model/value.ts?raw';
import modelSource from '../../model/microgpt.ts?raw';
import backwardSource from '../../model/autograd.ts?raw';
import trainingSource from '../../model/training.ts?raw';
import { escapeHtml } from '../views/evidence.js';

const files = { 'model/value.ts': valueSource, 'model/microgpt.ts': modelSource, 'model/autograd.ts': backwardSource, 'model/training.ts': trainingSource };
const revisions = new Map<string, string>();
export async function prepareSource(): Promise<void> {
  await Promise.all(Object.entries(files).map(async ([file, source]) => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    revisions.set(file, Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join(''));
  }));
}
const concepts: Record<string, [string, string, string, string]> = {
  embeddingSum: ['Embedding addition', 'token embedding[i] + position embedding[i]', 'model/microgpt.ts', 'forward'],
  tokenEmbedding: ['Token lookup', 'wte[token ID][feature]', 'model/microgpt.ts', 'forward'],
  positionEmbedding: ['Position lookup', 'wpe[position][feature]', 'model/microgpt.ts', 'forward'],
  rmsNorm: ['RMS normalization', 'x[i] × (mean(x²) + epsilon)^(−1/2)', 'model/microgpt.ts', 'rmsNorm'],
  linear: ['Linear projection', 'Σ weight[i,j] × input[j]', 'model/microgpt.ts', 'linear'],
  attentionLogits: ['Attention score', 'Σ query[j] × key[j] / √head width', 'model/microgpt.ts', 'forward'],
  softmax: ['Stable softmax', 'exp(score[i] − max) / Σ exp(score[j] − max)', 'model/microgpt.ts', 'softmax'],
  headOutput: ['Weighted values', 'Σ attention[position] × value[position,feature]', 'model/microgpt.ts', 'forward'],
  residual: ['Residual addition', 'projected[i] + residual[i]', 'model/microgpt.ts', 'forward'],
  loss: ['Cross entropy', '−ln(probability[target]); mean over positions', 'model/microgpt.ts', 'loss'],
  backward: ['Chain-rule edge', 'child adjoint × local derivative = contribution to parent gradient', 'model/autograd.ts', 'backward'],
  adam: ['Adam update', 'before − effectiveLR × mHat / (√vHat + epsilon)', 'model/training.ts', 'adamStep'],
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
  if (kind === 'meanLoss') return 'loss';
  return kind;
}
/** Curated symbol boundaries, not fragile line numbers. The entire function remains readable. */
function snippet(source: string, symbol: string, file: string): string {
  const marker = file === 'model/value.ts' ? `  ${symbol}(` : `export function ${symbol}(`;
  const start = source.indexOf(marker);
  if (start < 0) return source;
  const next = source.indexOf(file === 'model/value.ts' ? '\n  }' : '\n}', start);
  return next < 0 ? source.slice(start) : source.slice(start, next + (file === 'model/value.ts' ? 4 : 2));
}
export function sourceView(kind: string): string {
  const concept = concepts[conceptKey(kind)];
  if (!concept) return '<p class="muted">Terminal source value, parameter, or structural operation. Its identity is shown with the evidence.</p>';
  const [name, equation, file, symbol] = concept;
  return `<details class="source"><summary>Read source · ${escapeHtml(name)}</summary><p>${escapeHtml(equation)}</p><p><code>${file} · ${file === 'model/value.ts' ? 'Value.' : ''}${symbol}</code></p><small>Bundled source revision · SHA-256 <code>${revisions.get(file) ?? 'pending'}</code>. Available offline.</small><pre>${escapeHtml(snippet(files[file as keyof typeof files], symbol, file))}</pre></details>`;
}
