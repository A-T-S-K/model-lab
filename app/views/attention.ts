import type { AttentionReadModel } from "../presentation/attention-read-model.js";
import { escapeHtml, number } from "./evidence.js";
const compact = (value: number) => Number(value.toPrecision(4)).toString();
/** Sequential cividis-derived stops encode probability only, on the fixed [0,1] domain. */
function probabilityPaint(value: number): string {
  const stops = [
    [0, 34, 78],
    [67, 78, 108],
    [125, 124, 120],
    [188, 174, 108],
    [254, 232, 56],
  ];
  const coordinate = Math.max(0, Math.min(1, value)) * 4,
    index = Math.min(3, Math.floor(coordinate)),
    fraction = coordinate - index;
  const rgb = stops[index]!.map((channel, i) =>
    Math.round(channel * (1 - fraction) + stops[index + 1]![i]! * fraction),
  );
  const linear = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  const ink = luminance > 0.179 ? "#000000" : "#FFFFFF";
  return `background:rgb(${rgb.join(",")});color:${ink}`;
}
function numericVector(
  values: readonly number[] | null | undefined,
  seamAt?: number,
): string {
  return values
    ? `<span class="attention-vector">${values.map((value, index) => `<span class="${index === seamAt ? "head-seam" : ""}" title="${value}">${compact(value)}</span>`).join("")}</span>`
    : '<span class="unavailable">NOT CAPTURED</span>';
}
export function attentionView(model: AttentionReadModel, lens = ""): string {
  const { source, selected } = model;
  const cellText = (head: number, query: number, key: number, value?: number) =>
    `Layer ${model.layer}, head ${head}, query ${model.labels[query]}, key ${model.labels[key]}, ${value === undefined ? "NOT CAPTURED" : `probability ${value}`}, source ${source.sourceRunId}, ORIGIN OBSERVED, VERIFICATION ${source.verification}, RELATIONSHIP ${source.relationship}, scope ${model.scope}`;
  return `<section class="attention-expansion ${lens ? "attention-with-lens" : ""}" data-testid="attention-explore" data-source-run="${escapeHtml(source.sourceRunId)}" data-source-snapshot="${escapeHtml(source.sourceSnapshotId ?? "")}"><div class="attention-title"><h2>Attention · opened in place</h2><div class="controls"><button id="attention-prefix" aria-pressed="${model.scope === "SELECTED_PREFIX"}">Selected prefix · q${model.selectedQuery}</button><button id="attention-full" aria-pressed="${model.scope === "FULL_RUN"}">Full run · ${model.fullRunExtent} positions</button><button id="open-attention-lens">How was this calculated?</button><button id="close-attention">Whole Model</button></div></div><p class="attention-scope" data-testid="attention-scope">${model.scope.replaceAll("_", " ")} · ${model.extent}×${model.extent} · q${model.publicPosition} is the public example · matrix assembly DERIVED, cells OBSERVED</p><div class="attention-layout"><div><div class="attention-heads">${model.heads
    .filter((head) => !lens || head.head === selected.head)
    .map(
      (head) =>
        `<section data-scroll-region="attention-head-${head.head}"><h3>Head ${head.head} · probabilities [0,1]</h3><table class="instrument-attention-matrix" data-head="${head.head}" aria-label="Head ${head.head} causal attention probabilities"><thead><tr><th>Query ↓ / key →</th>${model.labels
          .slice(0, model.extent)
          .map((label) => `<th scope="col">${escapeHtml(label)}</th>`)
          .join(
            "",
          )}</tr></thead><tbody>${head.cells.map((row, query) => `<tr><th scope="row" class="${query === model.publicPosition ? "public-query" : ""}">${escapeHtml(model.labels[query]!)}${query === model.publicPosition ? " ◂ public" : ""}</th>${row.map((cell) => `<td>${cell.availability === "NOT APPLICABLE" ? `<span tabindex="0" class="causal-mask" aria-label="Query ${query}, key ${cell.key}: NOT APPLICABLE because causal attention does not compute a future key. Source ${escapeHtml(source.sourceRunId)}">╱ NA</span>` : cell.value === undefined ? '<span class="unavailable">NOT CAPTURED</span>' : `<button data-attention-cell data-query="${query}" data-key="${cell.key}" data-attention-head="${head.head}" data-value="${cell.value}" aria-label="${escapeHtml(cellText(head.head, query, cell.key, cell.value))}" aria-pressed="${selected.query === query && selected.key === cell.key && selected.head === head.head}" title="${cell.value}" style="--probability:${cell.value};${probabilityPaint(cell.value)}">${compact(cell.value)}</button>`}</td>`).join("")}</tr>`).join("")}</tbody></table><details class="attention-row-evidence"><summary>Observed rows + head output</summary><p>Score row · OBSERVED</p>${numericVector(head.scores?.values)}<p>Probability row · OBSERVED</p>${numericVector(head.probabilities?.values)}<p>Head output[4] · OBSERVED</p>${numericVector(head.output?.values)}</details><details><summary>Probability × V · DERIVED</summary>${head.weightedValues?.map((row, key) => `<p>Key ${key} V slice × probability</p>${numericVector(row)}`).join("") ?? "NOT CAPTURED"}</details></section>`,
    )
    .join(
      "",
    )}</div></div>${lens || `<div class="attention-machinery"><div class="parameter-docks">${model.parameters.map((parameter) => `<details class="parameter-register" data-parameter-name="${parameter.name}" data-snapshot="${escapeHtml(parameter.sourceSnapshotId ?? "")}"><summary>${escapeHtml(parameter.name.split(".").at(-1)!.replace("attn_", "").toUpperCase())} · 8×8</summary><p>Source snapshot ${escapeHtml(parameter.sourceSnapshotId ?? "NOT CAPTURED")}</p>${parameter.values ? `<table><tbody>${parameter.values.map((row) => `<tr>${row.map((value) => `<td title="${value}">${number(value, 4)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "NOT CAPTURED"}</details>`).join("")}</div><p class="attention-relation">Input → norm → Q / K / V → ${model.heads.length} heads × ${model.headWidth} features (DERIVED slices) → concatenate → WO → add saved residual. Vector values OBSERVED; saved-residual role DERIVED.</p>${model.vectors.map((vector, index) => ` ${index === 5 ? "<details><summary>Projection + residual values · OBSERVED</summary>" : ""}<div class="attention-vector-row"><span>${escapeHtml(vector.label)} <small>OBSERVED${vector.label.includes("saved") ? "; residual role DERIVED" : ""}</small></span>${numericVector(vector.artifact?.availability === "available" ? vector.artifact.values : undefined, vector.label.startsWith("Concatenated") ? model.headWidth : undefined)}</div>${index === model.vectors.length - 1 ? "</details>" : ""}`).join("")}</div>`}</div></section>`;
}
