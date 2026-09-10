import { escapeHtml } from "./evidence.js";
import { guidedMap } from "./guided.js";
import type { GuidedReadModel } from "../presentation/guided-read-model.js";
export function instrumentView(
  model: GuidedReadModel,
  mapIndex: number,
  output: string,
): string {
  const descriptions = [
    "The context",
    "Give each character<br>a place in the model",
    "Look back at<br>earlier characters",
    "Transform the<br>mixed information",
    "One score for<br>each possible token",
  ];
  return `<section class="instrument-spine model-map" aria-label="Map of the model">${guidedMap.map(([, label], i) => `<section class="instrument-stage ${i === 0 ? (model.prefix.length > 3 ? "input long-prefix" : "input") : i === 5 ? "output" : ""}" data-anchor="${i}"><button class="stage-label" data-map="${i}" aria-pressed="${i === mapIndex}">${label}</button>${i === 0 ? `<div class="instrument-input">${escapeHtml(model.prefix)}</div>` : i === 5 ? output : `<div class="stage-gate" ${i === 2 ? 'role="button" tabindex="0" data-open-attention aria-label="Open Attention in place"' : ""}>${["", "Encode", "Mix context", "Transform", "Score"][i]}</div>`}${i < 5 ? `<p class="stage-description">${descriptions[i]}</p>` : ""}</section>`).join("")}</section>`;
}
export function sourceStrip(model: GuidedReadModel): string {
  const source = model.source;
  if (!source)
    return '<p role="status">Preparing the canonical recorded run…</p>';
  return `<div class="scope-strip" data-testid="source-binding" data-source-run="${escapeHtml(source.sourceRunId)}"><span>ORIGIN <b>${source.origin}</b></span><span>VERIFICATION <b>${source.verification}</b></span><span>RELATIONSHIP <b>${source.relationship}</b></span><span>PHASE <b>${source.phase}</b></span><span>AVAILABILITY <b>${source.availability}</b></span></div>`;
}
