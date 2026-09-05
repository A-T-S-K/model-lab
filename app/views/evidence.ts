import type { Artifact } from '../../trace/types.js';
import type { AttentionDetail } from '../worker/protocol.js';
import type { TrainStepResult } from '../../model/training.js';

export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

export function number(value: number | null | undefined, digits = 6): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'unavailable';
  return Math.abs(value) > 0 && Math.abs(value) < 0.0001 ? value.toExponential(4) : value.toFixed(digits);
}

export function tokenName(id: number, vocabulary: readonly string[]): string {
  return vocabulary[id] ?? 'BOS';
}

export function vectorView(artifact: Artifact | undefined): string {
  if (!artifact) return '<p class="note">This artifact was not captured for the selected position.</p>';
  if (artifact.availability !== 'available' || artifact.values === null) return `<p class="note">Evidence: ${escapeHtml(artifact.availability.replaceAll('_', ' '))}. No numerical values are available.</p>`;
  const maximum = Math.max(...artifact.values.map(Math.abs), Number.EPSILON);
  return `<p class="muted">${escapeHtml(artifact.provenance)} · float64 · shape [${artifact.shape.join(', ')}] · ${escapeHtml(artifact.axes.join(' × ') || 'scalar')}</p>
    <div class="heatmap">${artifact.values.map((value, index) => `<span title="${escapeHtml(artifact.axes[0] ?? 'scalar')} ${index}: ${value}" style="background:${value < 0 ? `rgba(218,159,104,${0.12 + 0.5 * Math.abs(value) / maximum})` : `rgba(119,177,132,${0.12 + 0.5 * Math.abs(value) / maximum})`}"><small>${index}</small><br>${number(value, 4)}</span>`).join('')}</div>
    <small>Green: positive · amber: negative. Color is scaled within this vector; hover for full precision.</small>`;
}

export function probabilityView(values: readonly number[] | null | undefined, vocabulary: readonly string[]): string {
  if (!values) return '<p class="note">Probability evidence was not captured.</p>';
  return values.map((value, id) => `<div class="probability-row"><strong>${escapeHtml(tokenName(id, vocabulary))}</strong><div class="bar-track"><div class="bar" style="width:${100 * value}%"></div></div><code title="${value}">${(100 * value).toFixed(3)}%</code></div>`).join('');
}

export function detailView(detail: AttentionDetail | undefined): string {
  if (!detail) return '<p class="muted">Select an available attention cell to inspect its real dot product.</p>';
  if (detail.availability !== 'available') return `<p class="note">${detail.availability === 'not_applicable' ? 'Future keys are masked: this attention computation does not exist.' : 'The required evidence was not captured.'}</p>`;
  const maximumLogit = detail.logits.length ? Math.max(...detail.logits) : null;
  const exponentialSum = maximumLogit === null ? null : detail.logits.reduce((sum, logit) => sum + Math.exp(logit - maximumLogit), 0);
  return `<span class="badge">DERIVED FROM LIVE EVIDENCE</span>
    <p class="muted">Each component comes from the selected run’s actual Q and K vectors.</p>
    <table><thead><tr><th>Feature</th><th>Q</th><th>K</th><th>Q × K</th></tr></thead><tbody>${detail.products.map((product, index) => `<tr><td>${index}</td><td title="${detail.q[index]}">${number(detail.q[index])}</td><td title="${detail.k[index]}">${number(detail.k[index])}</td><td title="${product}">${number(product)}</td></tr>`).join('')}</tbody></table>
    <div class="equation">sum(Q × K) = ${number(detail.sum)}<br>scale = 1 / √${detail.q.length} = ${number(detail.scale)}<br>sum × scale = ${number(detail.scaled)}<br>observed attention logit = ${number(detail.observedLogit)}<br>available logits = [${detail.logits.map(value => number(value)).join(', ')}]<br>max logit = ${number(maximumLogit)}<br>Σ exp(logit − max) = ${number(exponentialSum)}<br>softmax(all ${detail.logits.length} available key logits):<br>p(key) = exp(selected logit − max) / Σ exp(logit − max)<br>selected observed probability = ${number(detail.probability)}</div>
    <p class="muted">Softmax normalizes across the current and earlier keys only. Its observed probability is shown in the matrix.</p>`;
}

export function learnView(learn: TrainStepResult | undefined, selectedParameter: number, token: number, vocabulary: readonly string[], targetId?: number): string {
  if (!learn) return '<p class="muted">Apply one real update to reveal the gradient, Adam moments, parameter change, and a rerun of the same fixed input.</p>';
  const update = learn.update.parameters[selectedParameter];
  if (!update) return '<p class="note">Selected parameter evidence is unavailable.</p>';
  const before = learn.before.probabilities[token];
  const after = learn.after.probabilities[token];
  return `<div class="metrics"><div><small>Mean cross-entropy before update</small><div class="metric">${number(learn.meanLoss)}</div></div><div><small>Effective learning rate</small><div class="metric">${number(learn.update.effectiveLearningRate)}</div></div></div>
    <h3>Cross-entropy at position ${token}</h3>
    <div class="equation">target = ${targetId === undefined ? 'unavailable' : escapeHtml(tokenName(targetId, vocabulary))}<br>observed target probability before update = ${number(targetId === undefined ? null : before?.[targetId])}<br>loss = −ln(p(target)) = ${number(learn.perPositionLoss[token])}</div>
    <p class="muted">Backward differentiates the mean of all position losses. The gradient below is the exact parameter gradient used by Adam.</p>
    <label>Parameter inspected<select id="parameter-select">${learn.update.parameters.map((parameter, index) => `<option value="${index}" ${index === selectedParameter ? 'selected' : ''}>${escapeHtml(parameter.name)}[${parameter.row}, ${parameter.column}]</option>`).join('')}</select></label>
    <table><thead><tr><th>Actual optimizer evidence</th><th>Value</th></tr></thead><tbody>
      ${[['Parameter before', update.before], ['Gradient used by Adam', update.gradient], ['First moment m before', update.mBefore], ['First moment m after', update.mAfter], ['Second moment v before', update.vBefore], ['Second moment v after', update.vAfter], ['Bias-corrected m̂', update.mHat], ['Bias-corrected v̂', update.vHat], ['Applied delta (after − before)', update.delta], ['Parameter after', update.after]].map(([label, value]) => `<tr><td>${label}</td><td title="${value}">${number(value as number, 9)}</td></tr>`).join('')}</tbody></table>
    <div class="equation">after = before + applied delta<br>${number(update.after, 9)} = ${number(update.before, 9)} + (${number(update.delta, 9)})</div>
    <h3>Same fixed input · position ${token}</h3><p class="muted">The after distribution was reexecuted with the updated parameters.</p>
    ${before && after ? `<table data-testid="learn-probabilities"><thead><tr><th>Token</th><th>Before</th><th>After</th><th>Δ probability</th></tr></thead><tbody>${before.map((value, id) => `<tr><td>${escapeHtml(tokenName(id, vocabulary))}</td><td>${number(value)}</td><td>${number(after[id])}</td><td>${number(after[id]! - value)}</td></tr>`).join('')}</tbody></table>` : '<p class="note">Distribution evidence is unavailable for this position.</p>'}
    <p class="note">This update changed parameters. A changed distribution is evidence of learning mechanics; it is not a claim of improved quality, and the greedy token may stay the same.</p>`;
}
