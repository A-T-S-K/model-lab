import type { SpatialReadModel } from "./bindings.js";
import { escapeHtml as esc } from "../views/evidence.js";
import { sourceView } from "../source/catalog.js";
const num = (n: number | undefined) => n === undefined ? "unavailable" : n.toPrecision(9);
const value = (n: number | undefined, id = "") => `<span ${id ? `data-testid="${id}"` : ""} data-value="${n ?? ""}" title="${n ?? "unavailable"}">${num(n)}</span>`;
export function geometry(m: SpatialReadModel) {
  const g = m.geometry;
  if (!g) return `<p data-testid="spatial-unavailable">${m.lens?.availability === "NOT APPLICABLE" ? "Future key · NOT APPLICABLE. This causal edge has no score, weight or Q/K geometry." : "Selection unavailable · choose valid indices for this run."}</p>`;
  const ox = 165, oy = 170;
  return `<div class="geometry"><svg viewBox="0 0 335 220" role="img" aria-label="Exact complete-vector Q and K geometry with shared scale"><path class="baseline" d="M15 170 H320 M165 15 V210"/>
    <path data-testid="q-shaft" class="q-shaft" d="M${ox} ${oy} L${ox + g.q[0] * g.scale} ${oy}"/><circle cx="${ox + g.q[0] * g.scale}" cy="${oy}" r="3" fill="#62C7E8"/>
    <path data-testid="k-shaft" class="k-shaft" d="M${ox} ${oy} L${ox + g.k[0] * g.scale} ${oy - g.k[1] * g.scale}"/><circle cx="${ox + g.k[0] * g.scale}" cy="${oy - g.k[1] * g.scale}" r="3" fill="#B79CFF"/>
    <text class="meta" x="12" y="208">Q cyan · K violet · shared scale ${g.scale.toPrecision(5)}</text></svg><div><p>Complete ${m.width}D vectors → exact local 2D span</p><p>‖Q‖ ${value(g.qNorm)} · ‖K‖ ${value(g.kNorm)}</p><p>Angle ${g.angle === undefined ? "undefined" : g.angle.toFixed(5) + "°"} · ${g.state}</p><p>Derived dot ${value(g.dot, "spatial-dot")}<br>Derived scaled ${value(m.lens?.scaled, "spatial-derived-score")}</p><p>Observed score ${value(m.lens?.observedLogit, "spatial-score")}<br>Observed weight ${value(m.lens?.observedProbability, "spatial-weight")}</p></div></div>`;
}
export function projection(m: SpatialReadModel) {
  const p = m.projection;
  if (!p || p.availability !== "AVAILABLE") return "<p>Q projection unavailable for this selection / checkpoint.</p>";
  return `<p>Wq[output row ${p.row}, input column j] × pre-attention[j]. All ${p.terms.length} terms; no bias.</p><p>Observed Q[${p.row}] ${value(p.q, "spatial-q-output")} <button data-artifact="${esc(m.q!.id)}" data-element="${p.row}">Inspect Q output scalar</button></p><div class="table-scroll"><table data-testid="spatial-contributors"><thead><tr><th>j</th><th>Wq[${p.row},j] · checkpoint</th><th>Input[j] · run</th><th>Product · derived</th></tr></thead><tbody>${p.terms.map(t => `<tr><th>${t.parameter.column}</th><td>${value(t.weight)}</td><td><button data-artifact="${esc(m.preAttention!.id)}" data-element="${t.parameter.column}">${num(t.input)}</button></td><td>${value(t.product)}</td></tr>`).join("")}</tbody></table></div><p>Derived sum ${value(p.terms.reduce((sum, t) => sum + t.product, 0))}. Inspect Q output, then follow its add / multiply operands to the actual parameter scalar and source.</p>${sourceView("q")}`;
}
