import type {
  EvidenceRelationship,
  InspectionBinding,
} from "../presentation/binding.js";
import type { InspectionResult, ScalarNode } from "../../inspect/types.js";
import { escapeHtml, number } from "./evidence.js";
import { sourceView } from "../source/catalog.js";

export function nodeLabel(node: ScalarNode): string {
  return node.parameter
    ? `${node.parameter.name}[${node.parameter.row},${node.parameter.column}]`
    : `${node.operation} #${node.id}`;
}
export function microscopeView(
  inspection: InspectionResult | undefined,
  path: number[],
  label: string,
  pending: boolean,
  whole: boolean,
  relationship: EvidenceRelationship = "HISTORICAL",
  binding?: InspectionBinding,
): string {
  if (pending)
    return `<p role="status">${binding?.verification === "VERIFYING" ? "VERIFICATION VERIFYING · Reconstructing the bound historical execution…" : "Inspecting the actual execution…"}</p>`;
  if (binding?.availability === "BUDGET EXCEEDED")
    return `<p role="status">Source ${escapeHtml(binding.sourceRunId)} · AVAILABILITY BUDGET EXCEEDED · no accepted scalar evidence for this target.</p>`;
  if (binding && !inspection && !pending && binding.availability !== "PENDING")
    return `<p role="status">Source ${escapeHtml(binding.sourceRunId)} · AVAILABILITY ${binding.availability}</p>`;
  if (!inspection)
    return "<p>Select a numerical element in Explore, then choose “How was this calculated?”. Follow an operand until it reaches a source value or parameter.</p>";
  if (inspection.availability !== "available" || !inspection.graph)
    return `<p class="note" data-testid="inspection-state">Source ${escapeHtml(inspection.sourceRunId)} · AVAILABILITY ${escapeHtml(inspection.availability.replaceAll("_", " ").toUpperCase())}: ${escapeHtml(inspection.reason ?? "No scalar evidence is available.")}</p>`;
  const verification = inspection.verification;
  if (inspection.provenance === "recomputed" && !verification?.verified)
    return `<p class="error" data-testid="verification">ORIGIN RECOMPUTED · VERIFICATION FAILED · RELATIONSHIP ${relationship} · source ${escapeHtml(inspection.sourceRunId)} · RECOMPUTATION MISMATCH · This detail does not explain the original run. ${escapeHtml(inspection.reason ?? "")}</p>`;
  const graph = inspection.graph;
  const currentId = path.at(-1) ?? graph.roots[0];
  const node = graph.nodes.find((candidate) => candidate.id === currentId);
  const badge =
    inspection.provenance === "recomputed"
      ? "VERIFIED RECOMPUTATION"
      : "OBSERVED SCALAR";
  const verificationView = verification
    ? `<p data-testid="verification">${badge} · max absolute error ${number(verification.maxAbsoluteError)} · max relative error ${number(verification.maxRelativeError)} · ${escapeHtml(verification.tolerancePolicy)}</p>`
    : "";
  const prefix = `<span class="badge" data-testid="inspection-provenance">${badge}</span><p data-testid="inspection-state">ORIGIN ${inspection.provenance.toUpperCase()} · VERIFICATION ${verification?.verified ? "VERIFIED" : "NONE"} · RELATIONSHIP ${relationship}</p><p class="muted">Run <code>${escapeHtml(inspection.sourceRunId)}</code></p>${verificationView}<nav class="breadcrumbs" aria-label="Scalar breadcrumbs"><strong>${escapeHtml(label)}</strong>${path.map((id, i) => `<button data-crumb="${i}">${escapeHtml(nodeLabel(graph.nodes.find((n) => n.id === id) ?? { id, operation: "node", value: NaN }))}</button>`).join("")}</nav>`;
  if (whole)
    return `${prefix}<h3>Complete capture statistics</h3><p data-testid="whole-stats">${graph.nodes.length.toLocaleString()} scalar nodes · ${graph.edges.length.toLocaleString()} operand edges · ${graph.structural.length.toLocaleString()} structural events</p><p>Inspect individual elements through Explore. The complete graph stays as evidence; it is not expanded into thousands of browser elements.</p>`;
  if (!node)
    return `${prefix}<p class="note">This node is outside the captured slice.</p>`;
  const operands = graph.edges
    .filter((edge) => edge.child === node.id)
    .sort((a, b) => a.inputIndex - b.inputIndex);
  const consumers = graph.edges.filter((edge) => edge.parent === node.id);
  const button = (id: number, extra = "") => {
    const other = graph.nodes.find((n) => n.id === id);
    return `<button data-node="${id}">${escapeHtml(other ? nodeLabel(other) : `node #${id}`)}${extra}${other ? ` = ${number(other.value, 9)}` : ""}</button>`;
  };
  const values = operands.map(
    (edge) => graph.nodes.find((n) => n.id === edge.parent)?.value,
  );
  const arithmetic =
    node.operation === "add"
      ? `${number(values[0], 9)} + ${number(values[1], 9)}`
      : node.operation === "multiply"
        ? `${number(values[0], 9)} × ${number(values[1], 9)}`
        : node.operation === "power"
          ? `${number(values[0], 9)} ^ ${number(node.exponent, 9)}`
          : `${node.operation}(${values.map((value) => number(value, 9)).join(", ")})`;
  return `${prefix}<h3 data-testid="scalar-operation" tabindex="-1">${escapeHtml(nodeLabel(node))}</h3><p class="muted">${node.gradient === undefined ? "Forward result" : "Forward value from the execution before Adam"}</p><div class="equation" data-testid="scalar-equation">${operands.length ? arithmetic + " ≈ " : ""}<strong title="${node.value}">${number(node.value, 12)}</strong></div>
    ${node.constant ? `<p>Constant/source identity: ${escapeHtml(node.constant)}</p>` : ""}${node.gradient === undefined ? "" : `<p>Accumulated gradient: <code title="${node.gradient}">${number(node.gradient, 12)}</code></p>`}
    <h3>Actual inputs · where did these come from?</h3><div class="operand-list">${operands.length ? operands.map((edge) => button(edge.parent, ` · operand ${edge.inputIndex}`)).join("") : "<p>Terminal parameter, source value, or explicitly recorded constant.</p>"}</div>
    <h3>Where does this result go?</h3><p class="muted">Consumers present in this captured slice.</p><div class="operand-list">${consumers.length ? consumers.map((edge) => button(edge.child)).join("") : "<p>No consumer is included in this slice.</p>"}</div>
    ${
      node.gradient !== undefined
        ? `<h3>Gradient contributions into this value</h3><p class="muted">Repeated operand occurrences remain separate edges.</p><div class="table-scroll"><table data-testid="gradient-edges"><thead><tr><th>Child</th><th>Child adjoint</th><th>× local derivative</th><th>≈ contribution</th></tr></thead><tbody>${consumers.map((edge) => `<tr><td>${button(edge.child)}</td><td title="${edge.childAdjoint}">${number(edge.childAdjoint, 9)}</td><td title="${edge.localDerivative}">${number(edge.localDerivative, 9)}</td><td title="${edge.contribution}">${number(edge.contribution, 9)}</td></tr>`).join("")}</tbody></table></div><p>Sum of all ${consumers.length} captured incoming contributions ≈ ${
            consumers.every((edge) => edge.contribution !== undefined) &&
            consumers.length
              ? number(
                  consumers.reduce((sum, edge) => sum + edge.contribution!, 0),
                  12,
                )
              : "unavailable (no complete incoming contributions)"
          }. Recorded gradient = ${number(node.gradient, 12)}.</p>${sourceView("backward")}`
        : ""
    }
    <details><summary>Structural operations (${graph.structural.length})</summary>${graph.structural.map((event) => `<p><strong>${escapeHtml(event.operation)}</strong> · ${escapeHtml(event.description)}<br><code>[${event.values.map((value) => number(value)).join(", ")}]</code></p><div class="operand-list">${event.nodeIds?.map((id) => button(id)).join("") ?? ""}</div>`).join("")}</details><details><summary>Raw scalar fields</summary><pre>${escapeHtml(JSON.stringify(node, null, 2))}</pre></details>${sourceView(node.operation)}`;
}

import type { AttentionMicroscopeReadModel } from "../presentation/microscope-read-model.js";
import type { QProjectionReadModel } from "../presentation/q-projection-read-model.js";
const significant = (value: number | undefined) =>
  value === undefined
    ? "NOT CAPTURED"
    : Number(value.toPrecision(6)).toString();
export function attentionMicroscopeView(
  model: AttentionMicroscopeReadModel,
  projection: QProjectionReadModel | undefined,
  scalar: string,
  parameterIndex: number,
): string {
  const raw = (value: number | undefined) =>
    `<span title="${value ?? "unavailable"}">${significant(value)}</span>`;
  const source = `<p class="lens-source" data-testid="lens-source" data-root="${escapeHtml(model.rootIdentity)}">${escapeHtml(model.rootIdentity)} · selected probability ${raw(model.observedProbability)} · OBSERVED</p>`;
  if (model.availability !== "AVAILABLE")
    return `<section class="calculation-lens">${source}<p>${model.availability}</p><button id="close-attention-lens">Back to Attention</button></section>`;
  return `<section class="calculation-lens" data-lens-mode="${projection ? "projection" : "products"}" data-testid="attention-lens"><div class="lens-heading"><h3>${projection ? "Q → eight WQ contributors" : "One observed cell. Four derived products."}</h3><button id="close-attention-lens">Back</button></div>${source}
    ${
      projection
        ? `<p>Q[${projection.row}] = Σ WQ[${projection.row},c] × normalized input[c] · r = ${model.q!.length} × head ${model.head} + feature ${model.feature}</p><p>Weights: bound snapshot state · input: OBSERVED · products: DERIVED</p>${projection.availability === "AVAILABLE" ? `<table class="projection-terms"><thead><tr><th>c</th><th>WQ[${projection.row},c]</th><th>Input[c]</th><th>Product</th></tr></thead><tbody>${projection.terms.map((term) => `<tr class="${parameterIndex === term.parameter.index ? "selected-term" : ""}" data-projection-term="${term.parameter.column}"><td><button data-contributing-parameter="${term.parameter.index}">${term.parameter.column}</button></td><td>${raw(term.weight)}</td><td>${raw(term.input)}</td><td>${raw(term.product)}</td></tr>`).join("")}</tbody></table><p data-testid="contributing-parameter">Selected: ${escapeHtml(projection.terms.find((term) => term.parameter.index === parameterIndex)?.parameter.name ?? "Choose one contributor")} ${projection.terms.some((term) => term.parameter.index === parameterIndex) ? `[${projection.row},${projection.terms.find((term) => term.parameter.index === parameterIndex)!.parameter.column}] · #${parameterIndex}` : ""}</p><button id="follow-contributing-parameter" ${projection.terms.some((term) => term.parameter.index === parameterIndex) ? "" : "disabled"}>FOLLOW ONE CONTRIBUTING PARAMETER</button>` : "<p>NOT CAPTURED · bound starting snapshot or input is missing</p>"}<button id="close-q-projection">Back to Q/K products</button>`
        : `<table class="qk-products"><thead><tr><th>Feature</th><th>Q · OBSERVED</th><th>K · OBSERVED</th><th>Product · DERIVED</th></tr></thead><tbody>${model.products!.map((value, i) => `<tr class="${i === model.feature ? "selected-term" : ""}"><td><button data-product-feature="${i}" aria-pressed="${i === model.feature}">${i}</button></td><td>${raw(model.q![i])}</td><td>${raw(model.k![i])}</td><td>${raw(value)}</td></tr>`).join("")}</tbody></table><p class="lens-equation">Σ products ≈ ${raw(model.sum)}; × ${raw(model.scale)} ≈ ${raw(model.scaled)} · DERIVED</p><p>Observed logit ${raw(model.observedLogit)} · raw derived/observed ${model.exactLogitMatch ? "=" : "≈"}</p><p>Observed score row: ${model.logits!.map(significant).join(" · ")}</p><p>Observed probability row: ${model.probabilities!.map(significant).join(" · ")}</p><div class="lens-actions"><button id="follow-q">FOLLOW Q</button><button id="follow-k">FOLLOW K</button><button id="open-q-projection">Q → WQ contributors</button></div><details><summary>Raw values</summary><pre>${escapeHtml(JSON.stringify({ Q: model.q, K: model.k, products: model.products, sum: model.sum, scale: model.scale, scaled: model.scaled, observedLogit: model.observedLogit, probabilities: model.probabilities }, null, 2))}</pre></details>`
    }
    ${scalar ? `<div class="attention-scalar" data-testid="microscope-evidence">${scalar}</div>` : ""}</section>`;
}
