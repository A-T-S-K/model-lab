import type { AdamReadModel } from "../presentation/adam-read-model.js";
import type { Artifact } from "../../trace/types.js";
import type { AttentionDetail } from "../worker/protocol.js";
import type { TrainStepResult } from "../../model/training.js";
import type { OptimizerState } from "../../model/state.js";

export function escapeHtml(value: string | number): string {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}

export function number(value: number | null | undefined, digits = 6): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "unavailable";
  return Math.abs(value) > 0 && Math.abs(value) < 0.0001
    ? value.toExponential(4)
    : value.toFixed(digits);
}

export function tokenName(id: number, vocabulary: readonly string[]): string {
  return vocabulary[id] ?? "BOS";
}

export function vectorView(artifact: Artifact | undefined): string {
  if (!artifact)
    return '<p class="note">NOT CAPTURED · no artifact for this selected position.</p>';
  if (artifact.availability !== "available" || !artifact.values)
    return `<p class="note">${escapeHtml(artifact.availability.replaceAll("_", " ").toUpperCase())} · no numerical values are available.</p>`;
  const probability = ["probabilities", "attentionProbabilities"].includes(
    artifact.kind,
  );
  const extent = Math.max(0, ...artifact.values.map(Math.abs));
  const minimum = probability ? 0 : -(extent || 1),
    maximum = probability ? 1 : extent || 1;
  const zero = ((0 - minimum) / (maximum - minimum)) * 100;
  const wrapped = artifact.shape.length === 1 && artifact.values.length === 32;
  return `<p class="muted">${artifact.provenance.toUpperCase()} · shape [${artifact.shape.join(", ")}] · ${escapeHtml(artifact.axes.join(" × ") || "scalar")}${wrapped ? " · hidden[32], wrapped row-major 4×8 for display; rows are layout continuation." : ""}</p><div class="vector-scroll"><div class="heatmap signed-vector ${wrapped ? "hidden-wrap" : ""}" data-vector-length="${artifact.values.length}" data-display-wrap="${wrapped ? "4x8" : "natural"}">${artifact.values
    .map((value, index) => {
      const position = ((value - minimum) / (maximum - minimum)) * 100;
      return `<button data-artifact="${escapeHtml(artifact.id)}" data-element="${index}" aria-label="How was element ${index} calculated? Value ${value}. ${artifact.provenance}." title="${escapeHtml(artifact.axes[0] ?? "scalar")} ${index}: ${value}"><small>${index}</small><span class="signed-track"><span class="signed-zero" style="left:${zero}%"></span><span class="signed-value ${value < 0 ? "negative" : "positive"}" style="left:${Math.min(zero, position)}%;width:${Math.abs(position - zero)}%"></span></span><span>${Number(value.toPrecision(4))}</span></button>`;
    })
    .join(
      "",
    )}</div></div><p class="vector-domain">Domain [${minimum}, ${maximum}] · zero has zero extent; tiny values remain tiny. Select a value to follow its source.</p><details><summary>Raw vector values</summary><pre>${escapeHtml(JSON.stringify(artifact.values))}</pre></details>`;
}

export function probabilityView(
  values: readonly number[] | null | undefined,
  vocabulary: readonly string[],
): string {
  if (!values)
    return '<p class="note">Probability evidence was not captured.</p>';
  return values
    .map(
      (value, id) =>
        `<div class="probability-row"><strong>${escapeHtml(tokenName(id, vocabulary))}</strong><div class="bar-track"><div class="bar" style="width:${100 * value}%"></div></div><code title="${value}">${(100 * value).toFixed(3)}%</code></div>`,
    )
    .join("");
}

export function detailView(detail: AttentionDetail | undefined): string {
  if (!detail)
    return '<p class="muted">Select an available attention cell to inspect its real dot product.</p>';
  if (detail.availability !== "available")
    return `<p class="note">${detail.availability === "not_applicable" ? "Future keys are masked: this attention computation does not exist." : "The required evidence was not captured."}</p>`;
  return `<span class="badge">DERIVED FROM OBSERVED EVIDENCE</span>
    <p class="muted">Each component comes from the selected run’s actual Q and K vectors.</p>
    <table><thead><tr><th>Feature</th><th>Q</th><th>K</th><th>Q × K</th></tr></thead><tbody>${detail.products.map((product, index) => `<tr><td>${index}</td><td title="${detail.q[index]}">${number(detail.q[index])}</td><td title="${detail.k[index]}">${number(detail.k[index])}</td><td title="${product}">${number(product)}</td></tr>`).join("")}</tbody></table>
    <div class="equation">sum(Q × K) ≈ ${number(detail.sum)}<br>scale = 1 / √${detail.q.length} = ${number(detail.scale)}<br>sum × scale ≈ ${number(detail.scaled)}<br>observed attention logit = ${number(detail.observedLogit)}<br>available logits = [${detail.logits.map((value) => number(value)).join(", ")}]<br>softmax(all ${detail.logits.length} available key logits):<br>p(key) = exp(selected logit − max) / Σ exp(logit − max)<br>selected observed probability = ${number(detail.probability)}</div>
    <p class="muted">Softmax normalizes across the current and earlier keys only. Its observed probability is shown in the matrix.</p>`;
}

export function learnView(
  learn: TrainStepResult | undefined,
  selectedParameter: number,
  token: number,
  vocabulary: readonly string[],
  targetId?: number,
  optimizer?: OptimizerState,
  adamEvidence?: AdamReadModel,
): string {
  if (!learn)
    return '<p class="muted">Apply one real update to reveal the gradient, Adam moments, parameter change, and a rerun of the same fixed input.</p>';
  const update = learn.update.parameters[selectedParameter];
  if (!update)
    return '<p class="note">Selected parameter evidence is unavailable.</p>';
  const before = learn.before.probabilities[token];
  const after = learn.after.probabilities[token];
  return `<div class="metrics"><div><small>Mean cross-entropy before update</small><div class="metric">${number(learn.meanLoss)}</div></div><div><small>Effective learning rate</small><div class="metric">${number(learn.update.effectiveLearningRate)}</div></div></div>
    <h3>Cross-entropy at position ${token}</h3>
    <div class="equation">target = ${targetId === undefined ? "unavailable" : escapeHtml(tokenName(targetId, vocabulary))}<br>observed target probability before update = ${number(targetId === undefined ? null : before?.[targetId])}<br>loss = −ln(p(target)) = ${number(learn.perPositionLoss[token])}</div>
    <p class="muted">Backward differentiates the mean of all position losses. The gradient below is the exact parameter gradient used by Adam.</p>
    <label>Parameter inspected<select id="parameter-select">${learn.update.parameters.map((parameter, index) => `<option value="${index}" ${index === selectedParameter ? "selected" : ""}>${escapeHtml(parameter.name)}[${parameter.row}, ${parameter.column}]</option>`).join("")}</select></label>
    <table><thead><tr><th>Actual optimizer evidence</th><th>Value</th></tr></thead><tbody>
      ${[
        ["Parameter before", update.before],
        ["Gradient used by Adam", update.gradient],
        ["First moment m before", update.mBefore],
        ["First moment m after", update.mAfter],
        ["Second moment v before", update.vBefore],
        ["Second moment v after", update.vAfter],
        ["Bias-corrected m̂", update.mHat],
        ["Bias-corrected v̂", update.vHat],
        ["Applied delta (after − before)", update.delta],
        ["Parameter after", update.after],
      ]
        .map(
          ([label, value]) =>
            `<tr><td>${label}</td><td title="${value}">${number(value as number, 9)}</td></tr>`,
        )
        .join("")}</tbody></table>
    <div class="equation">after = before + applied delta<br>${number(update.after, 9)} = ${number(update.before, 9)} + (${number(update.delta, 9)})</div>
    <button id="inspect-gradient">Where did this gradient come from?</button>
    <details data-testid="adam-equations"><summary>How did Adam calculate this change?</summary>
    ${
      optimizer
        ? `<p>Actual starting optimizer state: β₁ = ${optimizer.beta1}, β₂ = ${optimizer.beta2}, ε = ${optimizer.epsilon}, step = ${learn.update.step}.</p>
    <div class="equation">mAfter = β₁ × mBefore + (1 − β₁) × gradient<br>${update.mAfter} = ${optimizer.beta1} × ${update.mBefore} + (1 − ${optimizer.beta1}) × ${update.gradient}<br><br>
    vAfter = β₂ × vBefore + (1 − β₂) × gradient²<br>${update.vAfter} = ${optimizer.beta2} × ${update.vBefore} + (1 − ${optimizer.beta2}) × (${update.gradient})²<br><br>
    mHat = mAfter / (1 − β₁^(step + 1))<br>${update.biasCorrection1} = 1 − ${optimizer.beta1}^(${learn.update.step} + 1)<br>${update.mHat} = ${update.mAfter} / ${update.biasCorrection1}<br>
    vHat = vAfter / (1 − β₂^(step + 1))<br>${update.biasCorrection2} = 1 − ${optimizer.beta2}^(${learn.update.step} + 1)<br>${update.vHat} = ${update.vAfter} / ${update.biasCorrection2}<br><br>
    effectiveLR = learningRate × (1 − step / numSteps)<br>${learn.update.effectiveLearningRate} = ${optimizer.learningRate} × (1 − ${learn.update.step} / ${optimizer.numSteps})<br><br>
    mathematical update = effectiveLR × mHat / (√vHat + ε)<br>${adamEvidence?.q ?? "unavailable"} = ${learn.update.effectiveLearningRate} × ${update.mHat} / (√${update.vHat} + ${optimizer.epsilon})<br><br>
    after = before − mathematical update<br>actual representable delta = after − before<br>${update.delta} = ${update.after} − ${update.before}</div><p>The mathematical update is subtracted. The recorded delta includes floating-point rounding in the actual parameter assignment.</p>`
        : '<p class="note">Starting optimizer hyperparameters unavailable; no substituted formula is invented.</p>'
    }</details>
    <h3>Same fixed input · position ${token}</h3><p class="muted">The after distribution was reexecuted with the updated parameters.</p>
    ${before && after ? `<table data-testid="learn-probabilities"><thead><tr><th>Token</th><th>Before</th><th>After</th><th>Δ probability</th></tr></thead><tbody>${before.map((value, id) => `<tr><td>${escapeHtml(tokenName(id, vocabulary))}</td><td>${number(value)}</td><td>${number(after[id])}</td><td>${number(after[id]! - value)}</td></tr>`).join("")}</tbody></table>` : '<p class="note">Distribution evidence is unavailable for this position.</p>'}
    <p class="note">This update changed parameters. A changed distribution is evidence of learning mechanics; it is not a claim of improved quality, and the greedy token may stay the same.</p>`;
}
