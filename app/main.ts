import "./style.css";
import { exhibitTiming, exhibitState } from "./presentation/exhibit-state.js";
import plexSansLicense from "@ibm/plex-sans/fonts/complete/woff2/license.txt?url";
import plexMonoLicense from "@ibm/plex-mono/fonts/complete/woff2/license.txt?url";
import { historyComparisonReadModel } from "./presentation/history-read-model.js";
import { backwardReadModel } from "./presentation/backward-read-model.js";
import { adamReadModel } from "./presentation/adam-read-model.js";
import { learningView } from "./views/learning.js";
import { microscopeReadModel } from "./presentation/microscope-read-model.js";
import { qProjectionReadModel } from "./presentation/q-projection-read-model.js";
import {
  attentionReadModel,
  type AttentionScope,
} from "./presentation/attention-read-model.js";
import { attentionView } from "./views/attention.js";
import { instrumentView, sourceStrip } from "./views/instrument.js";
import { guidedReadModel } from "./presentation/guided-read-model.js";
import { sourceBinding } from "./presentation/source-binding.js";
import {
  bindAttractReplay,
  compatibleReplay,
  type AttractReplayBinding,
} from "./presentation/attract-replay.js";
import {
  startGuidedBatch,
  type GuidedBatch,
} from "./presentation/guided-read-model.js";
import { RUNTIME_REVISION } from "../runtime/revision.js";
import {
  bindInspection,
  inspectionIsCurrent,
  evidenceRelationship,
  type InspectionBinding,
  type InspectionSelection,
} from "./presentation/binding.js";
import {
  guidedView,
  guidedMap,
  lessonPosition,
  probabilityContextView,
  type GuidedLearning,
} from "./views/guided.js";
import {
  forwardStages,
  trainingStages,
  greedySelection,
} from "./source/stages.js";
import fixture from "../fixtures/canonical.initial.json";
import { TracePlayer } from "../trace/player.js";
import {
  immutableCopy,
  type RecordedRun,
  type Artifact,
} from "../trace/types.js";
import { SessionArchive } from "../archive/session.js";
import { InspectorWorkerClient } from "./worker/inspector-client.js";
import type {
  InspectionResult,
  InspectionTarget,
  ParameterRef,
} from "../inspect/types.js";
import { microscopeView, attentionMicroscopeView } from "./views/microscope.js";
import { prepareSource, sourceView } from "./source/catalog.js";
import { ModelWorkerClient } from "./worker/client.js";
import type { AttentionDetail, RunResult } from "./worker/protocol.js";
import {
  detailView,
  escapeHtml,
  learnView,
  number,
  probabilityView,
  tokenName,
  vectorView,
} from "./views/evidence.js";

const config = fixture.config;
const client = new ModelWorkerClient();
const inspector = new InspectorWorkerClient();
let archive = new SessionArchive();
let mode: "guided" | "explore" | "microscope" = "guided";
let inspection: InspectionResult | undefined;
let inspectionBinding: InspectionBinding | undefined;
let inspectionPath: number[] = [];
let inspectionLabel = "";
let inspectionPending = false;
let inspectionOperation = 0;
let inspectionWhole = false;
const inspectionCache = new Map<string, InspectionResult>();
let selectedSnapshotId = "";
let comparisonRunId = "";
let trainingCount = 1;
let guidedMapIndex = 5;
let guidedLearning: GuidedLearning | undefined;
let guidedBatch: GuidedBatch | undefined;
let attractReplay: AttractReplayBinding | undefined;
let attract = true;
let sessionControlsOpen = false;
let lastAcceptedResult: RunResult | undefined;
let cancellingOperation: number | undefined;
let cancellationResult: RunResult | undefined;
let attentionOpen = false;
let attentionScope: AttentionScope = "SELECTED_PREFIX";
let attentionScopeQuery = 3;
let attentionLens = false;
let attentionLensRoot = "";
let selectedProductFeature = 0;
let qProjectionOpen = false;
let contributingParameterSelected = false;
let followedParameter: ParameterRef | undefined;
let learningMode: "backward" | "adam" | undefined;
let learningExperimentId = "";
let selectedBackwardEdge: number | undefined;
let compactFanIn = false;
let offerParameterUpdate = false;
let liveTrainingStep = 0;
let liveRunId = "";
let kioskEnabled = new URLSearchParams(location.search).get("kiosk") === "1";
let exhibitConfiguration = exhibitTiming(new URLSearchParams(location.search));
let lastActivity = Date.now();
let visitorPointerDown = false;
let evidenceBytes = 0;
const SESSION_BUDGET = 64 * 1024 * 1024;
const trainingSummaries: {
  step: number;
  loss: number;
  trainingRunId: string;
  document: string;
  sourceSnapshotId: string;
  sourceStep: number;
}[] = [];

const mount = document.querySelector<HTMLDivElement>("#app")!;
let documentText = fixture.document;
let result: RunResult | undefined;
let player: TracePlayer | undefined;
let selectedToken = 0;
let selectedKind = "embeddingNorm";
let layer = 0;
let head = 0;
let key = 0;
let detail: AttentionDetail | undefined;
let selectedParameter = 0;
let busy = true;
let pendingModelCommand: "predict" | "train" | undefined;
let ready = false;
let status = "Initializing the local model…";
let error = "";
let operation = 0;
let parameterCount: number | undefined;

function sourceSnapshot(id: string) {
  return (
    archive.snapshots.get(id) ??
    result?.snapshots.find((snapshot) => snapshot.id === id)
  );
}

function selectedArtifact(
  kind: string,
  token = selectedToken,
): Artifact | undefined {
  return player
    ?.selectConcept({
      kind,
      ...(["meanLoss", "gradient"].includes(kind) ? {} : { token }),
    })
    .find(
      (artifact) =>
        (artifact.concept.layer === undefined ||
          artifact.concept.layer === layer) &&
        (artifact.concept.head === undefined || artifact.concept.head === head),
    );
}

function renderAttention(): string {
  if (!result)
    return '<p class="muted">Run Predict to record causal attention.</p>';
  const labels = result.tokenIds.map(
    (id, index) => `${index} · ${tokenName(id, config.vocabulary)}`,
  );
  return `<table class="attention-grid" aria-label="Causal attention probabilities"><thead><tr><th>Query ↓ / key →</th>${labels.map((label) => `<th scope="col">${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${labels
    .map((label, query) => {
      const artifact = selectedArtifact("attentionProbabilities", query);
      return `<tr><th scope="row">${escapeHtml(label)}</th>${labels
        .map((_, column) => {
          if (column > query)
            return '<td><span class="masked" title="Future position: not applicable">masked</span></td>';
          const probability =
            artifact?.availability === "available"
              ? artifact.values?.[column]
              : undefined;
          if (probability === undefined)
            return '<td><span class="masked">not captured</span></td>';
          return `<td><button data-query="${query}" data-key="${column}" class="${selectedToken === query && key === column ? "selected" : ""}" aria-label="Query ${query}, key ${column}, probability ${number(probability)}" aria-pressed="${selectedToken === query && key === column}" title="${probability}">${number(probability, 3)}</button></td>`;
        })
        .join("")}</tr>`;
    })
    .join("")}</tbody></table>`;
}

/** Tokenization is lossless for this organism; read the immutable run, never the editor. */
function runBindingView(): string {
  if (!result) return '<span class="badge">NO RUN YET</span>';
  const captured = result.tokenIds
    .slice(1)
    .map((id) => config.vocabulary[id])
    .join("");
  const stale = captured !== documentText;
  const state = stale
    ? "STALE EVIDENCE"
    : result.run.manifest.runId === liveRunId
      ? "LIVE RUN"
      : "ARCHIVED RUN";
  return `<span class="badge" data-testid="run-state">${state}</span><p>This run used: <code data-testid="captured-input">${escapeHtml(captured)}</code>${stale ? `<br>Current input: <code>${escapeHtml(documentText)}</code><br>Run Predict to update the evidence.` : ""}</p>`;
}

function stageEvidence(): string {
  if (selectedKind === "greedy") {
    const values = selectedArtifact("probabilities")?.values;
    return values
      ? `<p>Derived from this run’s observed probabilities: highest probability → <strong>${escapeHtml(tokenName(greedySelection(values), config.vocabulary))}</strong>.</p>`
      : "<p>Probability evidence is unavailable.</p>";
  }
  if (selectedKind === "target")
    return result
      ? `<p>Target from this run’s sequence: ${escapeHtml(tokenName(result.targetIds[selectedToken]!, config.vocabulary))}</p>`
      : "<p>No run selected.</p>";
  if (selectedKind === "targetProbability") {
    const value =
      result &&
      selectedArtifact("probabilities")?.values?.[
        result.targetIds[selectedToken]!
      ];
    return `<p>Observed target probability in this selected run: ${number(value)}.</p>`;
  }
  if (["backward", "adam", "changedParameters", "rerun"].includes(selectedKind))
    return "<p>Follow the learning experiment below for the recorded backward, optimizer update, and before/after executions.</p>";
  return vectorView(selectedArtifact(selectedKind));
}

function inspectionSelection(): InspectionSelection {
  return {
    runId: result?.run.manifest.runId ?? "",
    experimentId: result?.experiment?.id,
    stage: selectedKind,
    token: selectedToken,
    layer,
    head,
    key,
    parameter: selectedParameter,
  };
}
function inspectionRelationship() {
  const run =
    archive.runs.get(inspectionBinding?.sourceRunId ?? "") ?? result?.run;
  const captured = (
    (run?.manifest.input as readonly number[] | undefined)?.slice(1) ?? []
  )
    .map((id) => config.vocabulary[id])
    .join("");
  return evidenceRelationship(
    inspectionBinding?.sourceRunId ?? "",
    liveRunId,
    captured,
    documentText,
  );
}
function interventionLabel(run: RecordedRun): string {
  const declaration = run.manifest.intervention;
  if (
    declaration &&
    typeof declaration === "object" &&
    !Array.isArray(declaration)
  ) {
    const detail = declaration as { readonly [key: string]: unknown };
    if (detail.kind === "head_ablation")
      return `Declared intervention: layer ${detail.layer}, head ${detail.head} output set to zero before concatenation. These values describe the treated execution.`;
  }
  return "Declared intervention: these values describe the treated execution. See the recorded source for details.";
}

function parameterOwner(name: string): number {
  if (name.includes("attn_")) return 2;
  if (name.includes("mlp_")) return 3;
  if (name === "lm_head") return 4;
  return 1;
}
function selectedStageOwner(): number {
  if (
    ["gradient", "parameterUpdate", "meanLoss", "loss"].includes(selectedKind)
  )
    return followedParameter ? parameterOwner(followedParameter.name) : 2;
  if (selectedKind.startsWith("mlp")) return 3;
  if (selectedKind === "logits") return 4;
  if (["probabilities", "greedy"].includes(selectedKind)) return 5;
  if (
    ["q", "k", "v", "preAttentionNorm"].includes(selectedKind) ||
    selectedKind.startsWith("attention") ||
    selectedKind === "headOutput"
  )
    return 2;
  return 1;
}

function attentionRoot(): string {
  return `${result?.run.manifest.runId}/${layer}/${head}/${selectedToken}/${key}`;
}
/** Arrowless geometry identifies ancestry; it does not animate data transport. */
function updateAttentionTether(): void {
  mount.querySelector("[data-source-tether]")?.remove();
  if (!attentionLens || learningMode) return;
  const expansion = mount.querySelector<HTMLElement>(".attention-expansion");
  const cell = mount.querySelector<HTMLElement>(
    `.instrument-attention-matrix[data-head="${head}"] [data-query="${selectedToken}"][data-key="${key}"]`,
  );
  const lens = mount.querySelector<HTMLElement>(".calculation-lens");
  const table = cell?.closest("table");
  if (!expansion || !cell || !lens || !table) return;
  const origin = expansion.getBoundingClientRect(),
    from = cell.getBoundingClientRect(),
    grid = table.getBoundingClientRect(),
    to = lens.getBoundingClientRect();
  const x = from.right - origin.left,
    y = from.top - origin.top;
  const bottom = grid.bottom - origin.top + 8,
    targetX = to.left - origin.left,
    targetY = to.top - origin.top + 8;
  const bend =
    targetX > grid.right - origin.left
      ? (grid.right - origin.left + targetX) / 2
      : Math.max(0, targetX - 8);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "attention-tether");
  svg.setAttribute("data-source-tether", attentionLensRoot);
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<polyline points="${x},${y} ${x},${bottom} ${bend},${bottom} ${bend},${targetY} ${targetX},${targetY}" fill="none" stroke="#FFD166" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="3" fill="#0B0F12" stroke="#FFD166" stroke-width="1.5"/>`;
  expansion.append(svg);
}
window.addEventListener("resize", updateAttentionTether);

function render(): void {
  if (followedParameter && selectedParameter !== followedParameter.index) {
    followedParameter = undefined;
    learningMode = undefined;
  }
  if (
    learningMode &&
    (result?.run.manifest.runId !==
      archive.learningExperiments.get(learningExperimentId)?.trainingRunId ||
      !followedParameter)
  )
    learningMode = undefined;
  if (attentionLens && attentionLensRoot !== attentionRoot()) {
    attentionLens = false;
    qProjectionOpen = false;
    contributingParameterSelected = false;
    clearDisplayedInspection();
  }
  const regionScroll = new Map(
    Array.from(mount.querySelectorAll<HTMLElement>("[data-scroll-region]")).map(
      (el) => [
        el.dataset.scrollRegion,
        { top: el.scrollTop, left: el.scrollLeft },
      ],
    ),
  );
  const priorLens = mount.querySelector<HTMLElement>(".calculation-lens");
  const lensScroll = priorLens?.scrollTop ?? 0;
  const lensMode = priorLens?.dataset.lensMode;
  const priorControls = mount.querySelector<HTMLDetailsElement>(
    ".session-controls, .attention-controls",
  );
  if (priorControls) sessionControlsOpen = priorControls.open;
  if (
    inspectionBinding &&
    !inspectionIsCurrent(inspectionBinding, inspectionSelection(), operation)
  )
    clearDisplayedInspection();
  const openDetails = new Set(
    Array.from(mount.querySelectorAll("details[open] > summary")).map(
      (summary) => summary.textContent,
    ),
  );
  const focused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  const focusId = focused?.id;
  const focusAttributes = [
    "data-map",
    "data-open-attention",
    "data-query",
    "data-key",
    "data-attention-head",
    "data-product-feature",
    "data-contributing-parameter",
    "data-backward-edge",
    "data-artifact",
    "data-element",
    "data-node",
    "data-crumb",
    "data-token",
    "data-stage",
  ];
  const focusSelector =
    focused && !focusId
      ? focused.tagName.toLowerCase() +
        focusAttributes
          .filter((name) => focused.hasAttribute(name))
          .map(
            (name) => `[${name}="${CSS.escape(focused.getAttribute(name)!)}"]`,
          )
          .join("")
      : undefined;
  const restoreSemanticFocus = () => {
    if (focusSelector && focusSelector.includes("[")) {
      const target = mount.querySelector<HTMLElement>(focusSelector);
      if (target?.getClientRects().length)
        target.focus({ preventScroll: true });
    }
  };
  const selection =
    focused instanceof HTMLInputElement && focused.type === "text"
      ? [focused.selectionStart, focused.selectionEnd]
      : undefined;
  const probabilities = selectedArtifact("probabilities");
  const values =
    probabilities?.availability === "available" ? probabilities.values : null;
  const greedy = values ? greedySelection(values) : undefined;
  const stage = [...forwardStages, ...trainingStages].find(
    ([kind]) => kind === selectedKind,
  )!;
  document.body.classList.add("instrument-mode");
  if (mode === "guided") {
    mount.innerHTML = `<header class="instrument-header"><strong>MODEL LAB</strong><span>ONE SMALL MODEL. REAL COMPUTATION.</span><button id="clear-session">Public Reset</button></header><main class="instrument-page" data-mode="guided" aria-busy="${busy}">${guidedView(attract ? attractReplay?.result : result, guidedLearning, config.vocabulary, documentText, liveRunId, busy, ready, guidedMapIndex, attract, guidedBatch, pendingModelCommand)}</main>
      <details class="session-controls" ${sessionControlsOpen ? "open" : ""}><summary>Session controls</summary><div class="controls"><label>Input<input id="document" data-testid="document-input" value="${escapeHtml(documentText)}" maxlength="7" ${busy ? "disabled" : ""}></label><button id="predict" ${busy || !ready || attract ? "disabled" : ""}>Predict</button><button id="reset">Reset model</button>${guidedLearning && guidedLearning.afterRunId === result?.run.manifest.runId && guidedLearning.document === documentText ? `<button id="teach" ${busy || !ready || result?.run.manifest.runId !== liveRunId ? "disabled" : ""}>Teach · 10 real updates</button>` : ""}<button id="cancel" ${!busy && !inspectionPending ? "disabled" : ""}>Cancel operation</button><button data-mode="guided" aria-pressed="true">Guided</button><button data-mode="explore" ${attract ? "disabled" : ""}>Explore</button><button data-mode="microscope" ${attract ? "disabled" : ""}>Microscope</button></div><div data-testid="run-binding">${runBindingView()}</div><p>LIVE MODEL STEP <b data-testid="training-step">${liveTrainingStep}</b> · SOURCE STEP <b data-testid="source-step">${result?.trainingStep ?? attractReplay?.result.trainingStep ?? "unavailable"}</b></p><p data-testid="status" role="status">${escapeHtml(status)}</p></details>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}`;
    bind();
    mount.querySelectorAll<HTMLDetailsElement>("details").forEach((details) => {
      if (openDetails.has(details.querySelector("summary")?.textContent ?? ""))
        details.open = true;
    });
    if (focusId)
      document.getElementById(focusId)?.focus({ preventScroll: true });
    else restoreSemanticFocus();
    const restored = focusId && document.getElementById(focusId);
    if (selection && restored instanceof HTMLInputElement)
      restored.setSelectionRange(selection[0], selection[1]);
    return;
  }
  const advancedMarkup = `<nav class="depth-controls" aria-label="Evidence mode">${(["guided", "explore", "microscope"] as const).map((item) => `<button data-mode="${item}" aria-pressed="${mode === item}">${item[0]!.toUpperCase() + item.slice(1)}</button>`).join("")}</nav>
    <div class="controls source-toolbar"><label>Input · a, b, c · up to 7 characters<input id="document" data-testid="document-input" value="${escapeHtml(documentText)}" maxlength="7" autocomplete="off" ${busy ? "disabled" : ""}></label><button id="predict" ${busy || !ready ? "disabled" : ""}>Predict</button><button id="train" ${busy || !ready ? "disabled" : ""}>Learn · one update</button><button id="reset">Reset model</button><button id="cancel" ${!busy && !inspectionPending ? "disabled" : ""}>Cancel operation</button><button id="clear-session">Clear session</button></div>
    <div data-testid="run-binding">${runBindingView()}</div><p data-testid="status" role="status">${escapeHtml(status)}</p><p>LIVE MODEL STEP <b data-testid="training-step">${liveTrainingStep}</b> · SOURCE STEP <b data-testid="source-step">${result?.trainingStep ?? "unavailable"}</b> · ${parameterCount ?? "loading"} parameters</p>
    ${renderHistory()}<section class="source-block"><h2>Source position and operation</h2><div class="tokens">${result?.tokenIds.map((id, index) => `<button data-token="${index}" class="token ${index === selectedToken ? "active" : ""}" aria-pressed="${index === selectedToken}"><strong>${escapeHtml(tokenName(id, config.vocabulary))}</strong><small>position ${index} · ID ${id}</small></button>`).join("") ?? ""}</div><h3>Forward prediction</h3><div class="flow" data-testid="forward-stages">${forwardStages.map(([kind, label]) => `<button data-stage="${kind}" aria-pressed="${kind === selectedKind}">${label}</button>`).join("")}</div><h3>Training · after forward prediction</h3><div class="flow" data-testid="training-stages">${trainingStages.map(([kind, label]) => `<button data-stage="${kind}" aria-pressed="${kind === selectedKind}">${label}</button>`).join("")}</div></section>
    <section class="source-block"><h2>Recorded full-run Attention values</h2><div class="controls"><label>Layer<select id="layer">${Array.from({ length: config.nLayer }, (_, index) => `<option value="${index}" ${index === layer ? "selected" : ""}>${index}</option>`).join("")}</select></label><label>Head<select id="head">${Array.from({ length: config.nHead }, (_, index) => `<option value="${index}" ${index === head ? "selected" : ""}>${index}</option>`).join("")}</select></label><button data-open-attention>Open Attention in place</button></div><div class="table-scroll">${renderAttention()}</div><div data-testid="attention-detail">${detailView(detail)}</div></section>
    <section class="source-block"><h2>Raw completed transition fields</h2>${result?.experiment ? `<nav class="controls" aria-label="Learning experiment"><button data-experiment-run="${escapeHtml(result.experiment.beforeRunId)}" ${busy ? "disabled" : ""}>Before state · inspect prediction</button><button data-experiment-run="${escapeHtml(result.experiment.trainingRunId)}" ${busy ? "disabled" : ""}>Observed training · loss and backward</button><button data-experiment-run="${escapeHtml(result.experiment.afterRunId)}" ${busy ? "disabled" : ""}>After state · inspect prediction</button><button id="open-completed-learning" ${busy ? "disabled" : ""}>Open completed backward / Adam in place</button></nav>` : ""}<div data-testid="learn-evidence">${learnView(result?.learn, selectedParameter, selectedToken, config.vocabulary, result?.targetIds[selectedToken], sourceSnapshot(result?.experiment?.startingSnapshotId ?? "")?.state.optimizer, result?.experiment ? adamReadModel(result.experiment, sourceSnapshot(result.experiment.startingSnapshotId), sourceSnapshot(result.experiment.resultingSnapshotId), archive.runs.get(result.experiment.beforeRunId), archive.runs.get(result.experiment.afterRunId), result.experiment.update.parameters[selectedParameter]!) : undefined)}${result?.learn ? sourceView("adam") : ""}</div></section><p class="source-attribution">Based on <a href="https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95" target="_blank" rel="noopener noreferrer">Andrej Karpathy’s microgpt</a>. IBM Plex <a href="${plexSansLicense}">Sans license</a> / <a href="${plexMonoLicense}">Mono license</a>.</p>`;
  const localEvidence = `<section class="local-expansion ${mode === "microscope" ? "with-scalar" : ""}" data-owner="${selectedStageOwner()}"><div class="local-source-summary"><section class="local-operation" data-scroll-region="local-operation"><h2>${escapeHtml(stage?.[1] ?? selectedKind)} · position ${selectedToken}</h2><p>${escapeHtml(stage?.[2] ?? "Selected recorded evidence")}</p><div data-testid="vector-evidence">${stageEvidence()}</div>${sourceView(selectedKind)}</section><section class="local-prediction" data-scroll-region="local-probability"><h2>Selected position ${selectedToken} · probabilities</h2>${probabilityContextView(result, guidedLearning)}<div data-testid="probabilities">${probabilityView(values, config.vocabulary)}</div>${greedy === undefined ? "" : `<p>Greedy selection: <strong data-testid="greedy-token">${escapeHtml(tokenName(greedy, config.vocabulary))}</strong> · derived from the observed probabilities.</p>`}<button id="why-prediction">Why this prediction?</button></section></div>${mode === "microscope" ? `<section class="local-scalar" id="microscope" data-scroll-region="local-scalar"><h2>Microscope · source-connected scalar</h2><p>Scalar source model step ${sourceSnapshot(archive.runs.get(inspectionBinding?.sourceRunId ?? "")?.manifest.startingSnapshotId ?? "")?.state.optimizer.step ?? "unavailable"}</p><div data-testid="microscope-evidence">${microscopeView(inspection, inspectionPath, inspectionLabel, inspectionPending, inspectionWhole, inspectionRelationship(), inspectionBinding)}</div></section>` : ""}</section>`;
  if (result) {
    const context = guidedReadModel(
      result,
      undefined,
      config.vocabulary,
      documentText,
      liveRunId,
      busy,
      ready,
      false,
    );
    const source = sourceBinding(
      result.run,
      config.vocabulary,
      result.trainingStep,
      liveRunId,
      documentText,
      "ATTENTION EXPLORE",
    );
    const attention = attentionReadModel(
      result.run,
      sourceSnapshot(result.run.manifest.startingSnapshotId ?? ""),
      source,
      layer,
      attentionScope,
      attentionScopeQuery,
      { query: selectedToken, key, head },
    );
    const lensModel = microscopeReadModel(
      result.run,
      source,
      layer,
      head,
      selectedToken,
      key,
      selectedProductFeature,
    );
    const projection = qProjectionOpen
      ? qProjectionReadModel(
          result.run,
          sourceSnapshot(source.sourceSnapshotId ?? ""),
          layer,
          head,
          selectedProductFeature,
          selectedToken,
        )
      : undefined;
    const scalar =
      !learningMode && (inspectionBinding || inspectionPending)
        ? microscopeView(
            inspection,
            inspectionPath,
            inspectionLabel,
            inspectionPending,
            inspectionWhole,
            inspectionRelationship(),
            inspectionBinding,
          )
        : "";
    const parameterValue = followedParameter
      ? sourceSnapshot(source.sourceSnapshotId ?? "")?.state.parameters[
          followedParameter.name
        ]?.[followedParameter.row]?.[followedParameter.column]
      : undefined;
    const parameterAnchor = followedParameter
      ? `<div class="selected-parameter-anchor" data-owner="${parameterOwner(followedParameter.name)}" data-testid="parameter-anchor" data-parameter-index="${followedParameter.index}" data-source-snapshot="${escapeHtml(source.sourceSnapshotId ?? "")}">${escapeHtml(followedParameter.name)}[${followedParameter.row},${followedParameter.column}] · ${parameterValue === undefined ? "NOT CAPTURED" : number(parameterValue, 6)}</div>`
      : "";
    const parameterPrompt = offerParameterUpdate
      ? '<p>No completed transition is bound to this prediction. Inspection will not silently change the model.</p><button id="teach-for-parameter">Run one real update, then inspect this parameter</button>'
      : "";
    const lens = attentionLens
      ? attentionMicroscopeView(
          lensModel,
          projection,
          scalar + parameterPrompt,
          selectedParameter,
        )
      : "";
    const experiment = learningMode
      ? archive.learningExperiments.get(learningExperimentId)
      : undefined;
    const trainingRun =
      experiment && archive.runs.get(experiment.trainingRunId);
    const gradientEvidence =
      experiment && followedParameter
        ? cachedInspection(experiment.trainingRunId, {
            kind: "gradient",
            parameterIndex: followedParameter.index,
          })
        : undefined;
    const backward =
      experiment && trainingRun && followedParameter
        ? backwardReadModel(
            experiment,
            trainingRun,
            followedParameter,
            gradientEvidence,
            compactFanIn ? 3 : 8,
            inspectionBinding?.verification === "VERIFYING",
          )
        : undefined;
    const adam =
      experiment && followedParameter
        ? adamReadModel(
            experiment,
            sourceSnapshot(experiment.startingSnapshotId),
            sourceSnapshot(experiment.resultingSnapshotId),
            archive.runs.get(experiment.beforeRunId),
            archive.runs.get(experiment.afterRunId),
            followedParameter,
          )
        : undefined;
    const learning =
      backward && adam && learningMode
        ? learningView(
            backward,
            adam,
            learningMode,
            selectedBackwardEdge,
            compactFanIn,
            guidedLearning,
          )
        : "";
    if (context.source)
      context.source.phase = pendingModelCommand
        ? pendingModelCommand === "predict"
          ? "PREDICTING"
          : "LEARNING"
        : learningMode === "backward"
          ? "BACKWARD COMPLETE"
          : learningMode === "adam"
            ? "ADAM COMPLETED UPDATE"
            : attentionLens
              ? "SCALAR INSPECTION"
              : attentionOpen
                ? "ATTENTION EXPLORE"
                : mode === "microscope"
                  ? "SCALAR INSPECTION"
                  : "EXPLORE";
    const output = `<div class="instrument-result"><span>Public example · next token ${escapeHtml(context.target)}</span><div class="hero-probability">${context.probability === undefined ? "—" : (context.probability * 100).toFixed(1)}<small>%</small></div></div>`;
    mount.innerHTML = `<header class="instrument-header"><strong>MODEL LAB</strong><span>ONE SMALL MODEL. REAL COMPUTATION.</span><button id="public-reset-attention">Public Reset</button></header><main class="instrument-page attention-page ${learningMode ? "learning-page" : ""}" data-learning="${learningMode ?? ""}" data-mode="${mode}" aria-busy="${busy}">${result.run.manifest.intervention ? `<p class="intervention-banner" data-testid="intervention-declaration">${escapeHtml(interventionLabel(result.run))}</p>` : ""}<div class="instrument-intro"><p class="eyebrow">A NEURAL NETWORK, OPEN TO INSPECTION</p><h1>The model stays put. Detail unfolds.</h1></div>${instrumentView(context, attentionOpen ? 2 : selectedStageOwner(), output)}<footer class="instrument-source-summary">${sourceStrip(context)}</footer>${parameterAnchor}${learning || (attentionOpen ? attentionView(attention, lens) : localEvidence)}${followedParameter && result.experiment && !learningMode ? '<button id="inspect-parameter-learning" class="learning-entry">Inspect completed update for this parameter</button>' : ""}</main><details class="attention-controls" ${sessionControlsOpen ? "open" : ""}><summary>Source controls and other evidence</summary>${advancedMarkup}</details>${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}`;
  } else
    mount.innerHTML = `<p role="status">No recorded source is selected.</p>${advancedMarkup}`;
  bind();
  mount.querySelectorAll<HTMLElement>("[data-scroll-region]").forEach((el) => {
    const scroll = regionScroll.get(el.dataset.scrollRegion);
    el.scrollTop = scroll?.top ?? 0;
    el.scrollLeft = scroll?.left ?? 0;
  });
  const restoredLens = mount.querySelector<HTMLElement>(".calculation-lens");
  if (restoredLens && restoredLens.dataset.lensMode === lensMode)
    restoredLens.scrollTop = lensScroll;
  mount.querySelectorAll<HTMLDetailsElement>("details").forEach((details) => {
    if (openDetails.has(details.querySelector("summary")?.textContent ?? ""))
      details.open = true;
  });
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  else restoreSemanticFocus();
  const restored = focusId && document.getElementById(focusId);
  if (selection && restored instanceof HTMLInputElement)
    restored.setSelectionRange(selection[0], selection[1]);
  updateAttentionTether();
}

/** A teaching comparison always follows its own after-run, never a replacement execution. */
function selectGuidedComparison(): boolean {
  if (
    !guidedLearning ||
    result?.run.manifest.runId === guidedLearning.afterRunId
  )
    return true;
  if (archive.runs.has(guidedLearning.afterRunId)) {
    selectRun(guidedLearning.afterRunId);
    return true;
  }
  error =
    "Detailed evidence for this earlier teaching comparison is unavailable. Its recorded probabilities remain visible; no different run is substituted.";
  render();
  return false;
}

function bind(): void {
  mount
    .querySelectorAll<HTMLElement>(".attention-heads > section")
    .forEach((section) =>
      section.addEventListener("scroll", updateAttentionTether, {
        passive: true,
      }),
    );
  mount
    .querySelectorAll<HTMLButtonElement>(
      "[data-artifact],[data-node],[data-crumb],#inspect-gradient",
    )
    .forEach((button) => {
      button.disabled = busy;
    });
  document
    .querySelector("#open-completed-learning")
    ?.addEventListener("click", () => {
      const parameter =
        result?.experiment?.update.parameters[selectedParameter];
      if (!parameter) return;
      followedParameter = {
        index: parameter.index,
        name: parameter.name,
        row: parameter.row,
        column: parameter.column,
      };
      void openLearningInspection();
    });
  document
    .querySelector("#open-attention-lens")
    ?.addEventListener("click", () => {
      if (busy || !result) return;
      attentionLens = true;
      attentionLensRoot = attentionRoot();
      selectedProductFeature = 0;
      qProjectionOpen = false;
      mode = "microscope";
      clearDisplayedInspection();
      render();
    });
  document
    .querySelector("#close-attention-lens")
    ?.addEventListener("click", () => {
      attentionLens = false;
      qProjectionOpen = false;
      clearDisplayedInspection();
      mode = "explore";
      render();
    });
  document
    .querySelectorAll<HTMLButtonElement>("[data-product-feature]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        selectedProductFeature = Number(button.dataset.productFeature);
        clearDisplayedInspection();
        contributingParameterSelected = false;
        render();
      }),
    );
  for (const name of ["q", "k"] as const)
    document.querySelector(`#follow-${name}`)?.addEventListener("click", () => {
      if (!result || busy) return;
      const source = sourceBinding(
        result.run,
        config.vocabulary,
        result.trainingStep,
        liveRunId,
        documentText,
        "SCALAR INSPECTION",
      );
      const model = microscopeReadModel(
        result.run,
        source,
        layer,
        head,
        selectedToken,
        key,
        selectedProductFeature,
      );
      const target = name === "q" ? model.qTarget : model.kTarget;
      if (target)
        void inspect(
          result.run.manifest.runId,
          target,
          `${name.toUpperCase()} · layer ${layer} / head ${head} / query ${selectedToken} / key ${key} / feature ${selectedProductFeature}`,
        );
    });
  document
    .querySelector("#open-q-projection")
    ?.addEventListener("click", () => {
      qProjectionOpen = true;
      clearDisplayedInspection();
      render();
    });
  document
    .querySelector("#close-q-projection")
    ?.addEventListener("click", () => {
      qProjectionOpen = false;
      clearDisplayedInspection();
      render();
    });
  document
    .querySelectorAll<HTMLButtonElement>("[data-contributing-parameter]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        selectedParameter = Number(button.dataset.contributingParameter);
        contributingParameterSelected = true;
        if (result)
          followedParameter = qProjectionReadModel(
            result.run,
            sourceSnapshot(result.run.manifest.startingSnapshotId ?? ""),
            layer,
            head,
            selectedProductFeature,
            selectedToken,
          ).terms.find(
            (term) => term.parameter.index === selectedParameter,
          )?.parameter;
        clearDisplayedInspection();
        render();
      }),
    );
  document
    .querySelector("#follow-contributing-parameter")
    ?.addEventListener("click", () => {
      contributingParameterSelected = true;
      if (!followedParameter && result)
        followedParameter = qProjectionReadModel(
          result.run,
          sourceSnapshot(result.run.manifest.startingSnapshotId ?? ""),
          layer,
          head,
          selectedProductFeature,
          selectedToken,
        ).terms.find(
          (term) => term.parameter.index === selectedParameter,
        )?.parameter;
      if (result?.experiment) void openLearningInspection();
      else {
        offerParameterUpdate = true;
        render();
        const lens = mount.querySelector<HTMLElement>(".calculation-lens");
        if (lens) lens.scrollTop = lens.scrollHeight;
      }
    });
  document
    .querySelector("#inspect-parameter-learning")
    ?.addEventListener("click", () => void openLearningInspection());
  document
    .querySelector("#teach-for-parameter")
    ?.addEventListener("click", async () => {
      const expected = operation + 1,
        parameter = selectedParameter;
      offerParameterUpdate = false;
      await execute("train");
      if (
        operation === expected &&
        selectedParameter === parameter &&
        result?.experiment &&
        !busy
      )
        await openLearningInspection();
    });
  document.querySelector("#show-backward")?.addEventListener("click", () => {
    learningMode = "backward";
    render();
  });
  document.querySelector("#show-adam")?.addEventListener("click", () => {
    learningMode = "adam";
    render();
  });
  document.querySelector("#close-learning")?.addEventListener("click", () => {
    learningMode = undefined;
    clearDisplayedInspection();
    mode = "explore";
    render();
  });
  document.querySelector("#toggle-fan-in")?.addEventListener("click", () => {
    compactFanIn = !compactFanIn;
    render();
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-backward-edge]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        selectedBackwardEdge = Number(button.dataset.backwardEdge);
        render();
      }),
    );

  document
    .querySelector("#public-reset-attention")
    ?.addEventListener("click", () => void reset(false, true));
  document
    .querySelectorAll<HTMLElement>("[data-open-attention]")
    .forEach((element) => {
      const open = () => {
        if (!result || busy || attract) return;
        attentionOpen = true;
        mode = "explore";
        attentionScope = "SELECTED_PREFIX";
        attentionScopeQuery = lessonPosition(result);
        selectedToken = attentionScopeQuery;
        selectedKind = "attentionOutput";
        refreshAttentionSelection();
      };
      element.addEventListener("click", open);
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });
  document.querySelector("#attention-prefix")?.addEventListener("click", () => {
    attentionScope = "SELECTED_PREFIX";
    if (selectedToken > attentionScopeQuery) {
      selectedToken = attentionScopeQuery;
      key = Math.min(key, selectedToken);
      attentionLens = false;
      qProjectionOpen = false;
      mode = "explore";
      detail = undefined;
      clearDisplayedInspection();
    }
    render();
    void loadDetail();
  });
  document.querySelector("#attention-full")?.addEventListener("click", () => {
    attentionScope = "FULL_RUN";
    render();
  });
  document.querySelector("#close-attention")?.addEventListener("click", () => {
    attentionOpen = false;
    mode = "guided";
    render();
  });

  document
    .querySelector("#cancel-teach")
    ?.addEventListener("click", () => void reset(true));
  document
    .querySelector<HTMLInputElement>("#document")
    ?.addEventListener("input", (event) => {
      documentText = (event.target as HTMLInputElement).value;
      render();
    });
  document
    .querySelector("#predict")
    ?.addEventListener("click", () => void execute("predict"));
  document
    .querySelector("#train")
    ?.addEventListener("click", () => void execute("train"));
  document
    .querySelector("#reset")
    ?.addEventListener("click", () => void reset(false));
  document
    .querySelector("#cancel")
    ?.addEventListener("click", () => void reset(true));
  document
    .querySelector("#clear-session")!
    .addEventListener("click", () => void reset(false, true));
  document
    .querySelectorAll<HTMLButtonElement>("button[data-mode]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        mode = button.dataset.mode as typeof mode;
        if (mode === "guided") attentionOpen = false;
        render();
      }),
    );
  document.querySelector("#why-prediction")?.addEventListener("click", () => {
    if (mode === "guided" && result) selectedToken = lessonPosition(result);
    mode = "explore";
    selectedKind = "probabilities";
    refreshAttentionSelection();
  });
  document
    .querySelector("#teach")
    ?.addEventListener("click", () => void execute("train", 10, true));
  document.querySelector("#guided-explore")?.addEventListener("click", () => {
    if (!selectGuidedComparison()) return;
    mode = "explore";
    if (result)
      selectedToken =
        guidedLearning &&
        result.run.manifest.runId === guidedLearning.afterRunId
          ? guidedLearning.position
          : lessonPosition(result);
    selectedKind = "probabilities";
    refreshAttentionSelection();
  });
  document
    .querySelector("#guided-microscope")
    ?.addEventListener("click", () => {
      if (!result || busy) return;
      if (!selectGuidedComparison()) return;
      selectedToken =
        guidedLearning &&
        result.run.manifest.runId === guidedLearning.afterRunId
          ? guidedLearning.position
          : lessonPosition(result);
      selectedKind = "probabilities";
      refreshAttentionSelection();
      const artifact = selectedArtifact("probabilities");
      if (artifact)
        void inspect(
          result.run.manifest.runId,
          {
            kind: "artifact",
            artifactId: artifact.id,
            index: result.targetIds[selectedToken]!,
          },
          `Target probability · position ${selectedToken}`,
        );
    });
  document.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((button) =>
    button.addEventListener("click", () => {
      if (attract || busy) return;
      guidedMapIndex = Number(button.dataset.map);
      selectedKind =
        guidedMap[guidedMapIndex]![0] === "characters"
          ? "tokenEmbedding"
          : guidedMap[guidedMapIndex]![0];
      if (mode !== "guided") {
        learningMode = undefined;
        mode = "explore";
        attentionOpen = guidedMapIndex === 2;
        if (attentionOpen && result) {
          selectedToken = lessonPosition(result);
          attentionScopeQuery = selectedToken;
        }
      }
      render();
    }),
  );
  document
    .querySelectorAll<HTMLButtonElement>("[data-artifact]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        if (result && !busy)
          void inspect(
            result.run.manifest.runId,
            {
              kind: "artifact",
              artifactId: button.dataset.artifact!,
              index: Number(button.dataset.element),
            },
            `${selectedKind} · position ${selectedToken} · element ${button.dataset.element}`,
          );
      }),
    );
  document
    .querySelectorAll<HTMLButtonElement>("[data-node]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        if (inspection)
          void inspect(
            inspection.sourceRunId,
            { kind: "node", nodeId: Number(button.dataset.node) },
            inspectionLabel,
            [...inspectionPath, Number(button.dataset.node)],
          );
      }),
    );
  document
    .querySelectorAll<HTMLButtonElement>("[data-crumb]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        const path = inspectionPath.slice(0, Number(button.dataset.crumb) + 1);
        if (inspection)
          void inspect(
            inspection.sourceRunId,
            { kind: "node", nodeId: path.at(-1)! },
            inspectionLabel,
            path,
          );
      }),
    );
  document.querySelector("#inspect-gradient")?.addEventListener("click", () => {
    if (result?.experiment)
      void inspect(
        result.experiment.trainingRunId,
        { kind: "gradient", parameterIndex: selectedParameter },
        "Loss → parameter gradient → Adam",
      );
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-experiment-run]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        mode = "explore";
        selectRun(button.dataset.experimentRun!);
      }),
    );
  document
    .querySelector("#history-run")
    ?.addEventListener("change", (event) =>
      selectRun((event.target as HTMLSelectElement).value),
    );
  document
    .querySelector("#snapshot-select")
    ?.addEventListener("change", (event) => {
      selectedSnapshotId = (event.target as HTMLSelectElement).value;
    });
  document
    .querySelector("#compare-run")
    ?.addEventListener("change", (event) => {
      comparisonRunId = (event.target as HTMLSelectElement).value;
      render();
    });
  document
    .querySelector("#training-count")
    ?.addEventListener("change", (event) => {
      trainingCount = Math.max(
        1,
        Math.min(
          500,
          Math.trunc(Number((event.target as HTMLInputElement).value)) || 1,
        ),
      );
      render();
    });
  document
    .querySelector("#train-many")
    ?.addEventListener("click", () => void execute("train", trainingCount));
  document.querySelector("#kiosk-mode")?.addEventListener("change", (event) => {
    kioskEnabled = (event.target as HTMLInputElement).checked;
    lastActivity = Date.now();
    saveExhibitConfiguration();
    checkExhibitIdle();
  });
  for (const id of ["idle-seconds", "warning-seconds"])
    document.querySelector(`#${id}`)?.addEventListener("change", () => {
      exhibitConfiguration = exhibitTiming(
        new URLSearchParams({
          idleSeconds: (
            document.querySelector("#idle-seconds") as HTMLInputElement
          ).value,
          warningSeconds: (
            document.querySelector("#warning-seconds") as HTMLInputElement
          ).value,
        }),
      );
      lastActivity = Date.now();
      saveExhibitConfiguration();
      checkExhibitIdle();
      render();
    });
  document.querySelector("#ablate-head")?.addEventListener("click", () => {
    void ablateHead();
  });
  document.querySelector("#whole-capture")?.addEventListener("click", () => {
    if (result)
      void inspect(
        result.run.manifest.runId,
        { kind: "whole" },
        "Whole execution",
      );
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-token]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        selectedToken = Number(button.dataset.token);
        key = Math.min(key, selectedToken);
        detail = undefined;
        render();
        void loadDetail();
      }),
    );
  document
    .querySelectorAll<HTMLButtonElement>("[data-stage]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        selectedKind = button.dataset.stage!;
        if (
          trainingStages.some(([kind]) => kind === selectedKind) &&
          result?.experiment
        )
          selectRun(result.experiment.trainingRunId);
        else render();
      }),
    );
  document
    .querySelectorAll<HTMLButtonElement>("[data-query]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        selectedToken = Number(button.dataset.query);
        key = Number(button.dataset.key);
        if (button.dataset.attentionHead !== undefined)
          head = Number(button.dataset.attentionHead);
        detail = undefined;
        render();
        void loadDetail();
      }),
    );
  document.querySelector("#layer")?.addEventListener("change", (event) => {
    layer = Number((event.target as HTMLSelectElement).value);
    detail = undefined;
    render();
    void loadDetail();
  });
  document.querySelector("#head")?.addEventListener("change", (event) => {
    head = Number((event.target as HTMLSelectElement).value);
    detail = undefined;
    render();
    void loadDetail();
  });
  document
    .querySelector("#parameter-select")
    ?.addEventListener("change", (event) => {
      selectedParameter = Number((event.target as HTMLSelectElement).value);
      render();
    });
}

/** Position changes must rebind both the attention label and its saved arithmetic. */
function refreshAttentionSelection(): void {
  key = Math.min(key, selectedToken);
  detail = undefined;
  render();
  void loadDetail();
}

async function loadDetail(): Promise<void> {
  if (!result || busy) return;
  // This arithmetic is derived only from the selected immutable run, including history.
  const q = selectedArtifact("q")?.values?.slice(
    (head * config.nEmbd) / config.nHead,
    ((head + 1) * config.nEmbd) / config.nHead,
  );
  const k = selectedArtifact("k", key)?.values?.slice(
    (head * config.nEmbd) / config.nHead,
    ((head + 1) * config.nEmbd) / config.nHead,
  );
  const logits = selectedArtifact("attentionLogits")?.values;
  const probability = selectedArtifact("attentionProbabilities")?.values?.[key];
  if (!q || !k || !logits || probability === undefined) {
    detail = undefined;
    render();
    return;
  }
  const products = q.map((value, i) => value * k[i]!);
  const sum = products.reduce((a, b) => a + b, 0);
  const scale = 1 / Math.sqrt(q.length);
  detail = {
    sourceRunId: result.run.manifest.runId,
    provenance: "derived",
    availability: "available",
    q: [...q],
    k: [...k],
    products,
    sum,
    scale,
    scaled: sum * scale,
    observedLogit: logits[key] ?? null,
    probability,
    logits: [...logits],
  };
  render();
}

function clearDisplayedInspection(): void {
  ++inspectionOperation;
  inspector.cancel();
  inspection = undefined;
  inspectionPath = [];
  inspectionPending = false;
  inspectionLabel = "";
  inspectionWhole = false;
  inspectionBinding = undefined;
}

function recordTrainingSummary(incoming: RunResult): void {
  const experiment = incoming.experiment;
  if (
    !incoming.learn ||
    !experiment ||
    trainingSummaries.some(
      (summary) => summary.trainingRunId === experiment.trainingRunId,
    )
  )
    return;
  trainingSummaries.push({
    step: incoming.trainingStep,
    loss: incoming.learn.meanLoss,
    trainingRunId: experiment.trainingRunId,
    document: incoming.tokenIds
      .slice(1)
      .map((id) => config.vocabulary[id])
      .join(""),
    sourceSnapshotId: experiment.startingSnapshotId,
    sourceStep: incoming.trainingStep - 1,
  });
}

async function execute(
  command: "predict" | "train",
  count = 1,
  guided = false,
): Promise<void> {
  if (busy || !ready) return;
  if (evidenceBytes >= SESSION_BUDGET) {
    error =
      "Session evidence limit reached (64 MiB). Clear session before starting more work.";
    render();
    return;
  }
  if (!/^[abc]{0,7}$/.test(documentText)) {
    error = "Use up to seven characters from a, b, and c.";
    render();
    return;
  }
  if (
    guided &&
    (!result ||
      result.run.manifest.runId !== liveRunId ||
      result.tokenIds
        .slice(1)
        .map((id) => config.vocabulary[id])
        .join("") !== documentText ||
      documentText.length < 2)
  )
    return;
  const executionDocument = documentText;
  if (!guided) guidedBatch = undefined;
  pendingModelCommand = command;
  if (guided && result) {
    guidedLearning = undefined;
    guidedBatch = startGuidedBatch(result, config.vocabulary);
  }
  clearDisplayedInspection();
  const currentOperation = ++operation;
  busy = true;
  error = "";
  detail = undefined;
  status =
    command === "train"
      ? guided
        ? "Teaching the next characters through 10 real updates…"
        : "Computing loss, backward, and one Adam update…"
      : "Recording a live prediction…";
  render();
  try {
    let retainedLoss = Infinity;
    for (let step = 0; step < count; step++) {
      if (evidenceBytes >= SESSION_BUDGET) {
        status = "Session evidence limit reached · completed history preserved";
        break;
      }
      pendingModelCommand = command;
      const response = await client.request({
        command,
        document: executionDocument,
      });
      if (currentOperation !== operation) {
        // Cancellation may restore a reply accepted by the client after its UI
        // authority ended. Retain it only for that cancellation's exact snapshot.
        if (
          currentOperation === cancellingOperation &&
          response.status === "result"
        )
          cancellationResult = response.result;
        return;
      }
      if (response.status !== "result")
        throw new Error("Worker did not return model evidence");
      pendingModelCommand = undefined;
      const incoming = response.result;
      lastAcceptedResult = incoming;
      if (guided && incoming.learn) {
        if (guidedBatch) {
          guidedBatch.completedCount++;
          guidedBatch.latestAfterRunId = incoming.run.manifest.runId;
          if (guidedBatch.completedCount === 10)
            guidedBatch.status = "COMPLETE";
        }
        const position = lessonPosition(incoming);
        const target = incoming.targetIds[position]!;
        guidedLearning = {
          document: executionDocument,
          position,
          target,
          before:
            guidedLearning?.before ??
            incoming.learn.before.probabilities[position]![target]!,
          after: incoming.learn.after.probabilities[position]![target]!,
          completed: (guidedLearning?.completed ?? 0) + 1,
          startingStep:
            guidedLearning?.startingStep ?? incoming.trainingStep - 1,
          afterRunId: incoming.run.manifest.runId,
        };
      }
      // A result already contains the committed update and its after-run. Publish
      // that identity atomically with its count before asynchronous archive admission.
      clearDisplayedInspection();
      result = incoming;
      player = new TracePlayer(result.run);
      liveRunId = result.run.manifest.runId;
      liveTrainingStep = result.trainingStep;
      selectedToken = attentionOpen
        ? lessonPosition(result)
        : result.tokenIds.length - 1;
      if (attentionOpen) attentionScopeQuery = selectedToken;
      key = Math.min(key, selectedToken);
      if (result.learn && !followedParameter)
        selectedParameter = result.learn.update.parameters.reduce(
          (best, update, index, all) =>
            Math.abs(update.gradient) > Math.abs(all[best]!.gradient)
              ? index
              : best,
          0,
        );
      status =
        command === "train"
          ? `Live update complete · training step ${result.trainingStep}`
          : `Live prediction complete · ${result.tokenIds.length} positions`;
      if (count > 1) status += ` · ${step + 1}/${count} requested updates`;
      const retain =
        count === 1 ||
        step === 0 ||
        step === count - 1 ||
        (incoming.learn && incoming.learn.meanLoss <= retainedLoss / 2);
      recordTrainingSummary(incoming);
      if (retain) {
        const destination = archive;
        for (const snapshot of incoming.snapshots)
          await destination.addSnapshot(snapshot);
        for (const run of incoming.runs) await destination.addRun(run);
        if (incoming.experiment)
          await destination.addLearningExperiment(incoming.experiment);
        if (currentOperation !== operation) return;
        evidenceBytes += new TextEncoder().encode(
          JSON.stringify(incoming),
        ).byteLength;
        if (incoming.learn) retainedLoss = incoming.learn.meanLoss;
      }
      if (currentOperation !== operation) return;
      render();
    }
  } catch (failure) {
    if (currentOperation !== operation) return;
    error = failure instanceof Error ? failure.message : String(failure);
    status = "Run failed";
  } finally {
    // A bounded lesson may end early at the optimizer limit or evidence budget.
    // Preserve its last completed comparison just as cancellation/reset preserves it.
    if (
      currentOperation === operation &&
      guidedLearning &&
      guided &&
      result?.run.manifest.runId === guidedLearning.afterRunId &&
      !archive.runs.has(result.run.manifest.runId)
    ) {
      try {
        const destination = archive;
        const completed = result;
        for (const snapshot of completed.snapshots)
          await destination.addSnapshot(snapshot);
        for (const run of completed.runs) await destination.addRun(run);
        if (completed.experiment)
          await destination.addLearningExperiment(completed.experiment);
        if (currentOperation === operation)
          evidenceBytes += new TextEncoder().encode(
            JSON.stringify(completed),
          ).byteLength;
      } catch (retentionFailure) {
        if (currentOperation === operation)
          error = `${error ? error + " · " : ""}Completed result retention failed: ${retentionFailure instanceof Error ? retentionFailure.message : String(retentionFailure)}`;
      }
    }
    if (currentOperation === operation) {
      pendingModelCommand = undefined;
      if (guidedBatch?.status === "RUNNING") guidedBatch.status = "STOPPED";
      busy = false;
      render();
      void loadDetail();
    }
  }
}

async function reset(cancelled: boolean, clear = false): Promise<void> {
  if (cancelled && !busy && inspectionPending) {
    ++inspectionOperation;
    inspector.cancel();
    inspectionPending = false;
    status = "Cancelled inspection · model and history preserved";
    render();
    return;
  }
  cancellingOperation = cancelled ? operation : undefined;
  cancellationResult = undefined;
  const currentOperation = ++operation;
  ++inspectionOperation;
  pendingModelCommand = undefined;
  inspector.cancel();
  inspectionPending = false;
  busy = true;
  ready = false;
  error = "";
  const acceptedAtCancellation = cancelled ? lastAcceptedResult : undefined;
  if (clear) {
    lastActivity = Date.now();
    clearExhibitBanner();
    sessionControlsOpen = false;
    const controls = mount.querySelector<HTMLDetailsElement>(
      ".session-controls, .attention-controls",
    );
    if (controls) controls.open = false;
    selectedParameter = 0;
    followedParameter = undefined;
    learningMode = undefined;
    learningExperimentId = "";
    offerParameterUpdate = false;
    selectedBackwardEdge = undefined;
    compactFanIn = false;
    archive = new SessionArchive();
    evidenceBytes = 0;
    trainingSummaries.length = 0;
    inspectionCache.clear();
    inspection = undefined;
    inspectionPath = [];
    mode = "guided";
    attentionOpen = false;
    attentionLens = false;
    qProjectionOpen = false;
    contributingParameterSelected = false;
    attract = true;
    guidedBatch = undefined;
    lastAcceptedResult = undefined;
    guidedLearning = undefined;
    guidedMapIndex = 5;
    comparisonRunId = "";
    selectedSnapshotId = "";
    documentText = fixture.document;
    selectedToken = 0;
    selectedKind = "embeddingNorm";
    layer = 0;
    head = 0;
    key = 0;
    trainingCount = 1;
    result = undefined;
    player = undefined;
    detail = undefined;
  }
  status = cancelled
    ? "Cancelling operation…"
    : clear
      ? "Clearing session…"
      : "Restoring selected model snapshot…";
  render();
  try {
    if (!clear && result && !archive.runs.has(result.run.manifest.runId)) {
      const destination = archive;
      const completed = result;
      for (const snapshot of completed.snapshots)
        await destination.addSnapshot(snapshot);
      for (const run of completed.runs) await destination.addRun(run);
      if (completed.experiment)
        await destination.addLearningExperiment(completed.experiment);
      if (currentOperation !== operation) return;
      evidenceBytes += new TextEncoder().encode(
        JSON.stringify(completed),
      ).byteLength;
    }
    if (currentOperation !== operation) return;
    const snapshot =
      clear || !selectedSnapshotId
        ? undefined
        : sourceSnapshot(selectedSnapshotId);
    const response = await (cancelled
      ? client.cancel()
      : client.reset(snapshot));
    if (currentOperation !== operation) return;
    if (response.status !== "ready")
      throw new Error("Worker did not initialize");
    await archive.addSnapshot(response.archivedSnapshot);
    if (currentOperation !== operation) return;
    liveTrainingStep = response.snapshot.optimizer.step;
    liveRunId = "";
    if (cancelled && guidedBatch) {
      guidedBatch.completedCount = Math.max(
        0,
        Math.min(10, liveTrainingStep - guidedBatch.startingStep),
      );
      guidedBatch.status =
        guidedBatch.completedCount === 10 ? "COMPLETE" : "CANCELLED";
    }
    const restoredResult = cancellationResult ?? acceptedAtCancellation;
    if (
      cancelled &&
      restoredResult &&
      restoredResult.trainingStep === liveTrainingStep &&
      restoredResult.snapshots.at(-1)?.id === response.archivedSnapshot.id
    ) {
      result = restoredResult;
      lastAcceptedResult = restoredResult;
      player = new TracePlayer(result.run);
      recordTrainingSummary(restoredResult);
      if (guidedBatch && guidedBatch.completedCount > 0) {
        guidedBatch.latestAfterRunId = result.run.manifest.runId;
        guidedLearning = {
          document: guidedBatch.capturedDocument,
          position: guidedBatch.publicPosition,
          target: guidedBatch.target,
          before:
            guidedLearning?.before ??
            guidedBatch.baselineDistribution[guidedBatch.target]!,
          after:
            result.probabilities[guidedBatch.publicPosition]![
              guidedBatch.target
            ]!,
          completed: guidedBatch.completedCount,
          startingStep: guidedBatch.startingStep,
          afterRunId: result.run.manifest.runId,
        };
      }
      const newlyRetained = !archive.runs.has(result.run.manifest.runId);
      const destination = archive;
      for (const snapshot of result.snapshots)
        await destination.addSnapshot(snapshot);
      for (const run of result.runs) await destination.addRun(run);
      if (result.experiment)
        await destination.addLearningExperiment(result.experiment);
      if (currentOperation !== operation) return;
      if (newlyRetained)
        evidenceBytes += new TextEncoder().encode(
          JSON.stringify(result),
        ).byteLength;
    }
    ready = true;
    busy = false;
    status = cancelled
      ? `Cancelled · restored completed training step ${liveTrainingStep}`
      : clear
        ? "Session cleared · Guided home"
        : `Model reset · training step ${liveTrainingStep} · history preserved`;
    render();
    if (clear || (attract && !attractReplay)) {
      if (
        !compatibleReplay(
          attractReplay,
          response.archivedSnapshot.id,
          RUNTIME_REVISION,
        )
      )
        await prepareAttract(currentOperation);
      else {
        status = "Recorded real run. Not live.";
        render();
      }
    }
  } catch (failure) {
    if (currentOperation !== operation) return;
    busy = false;
    error = failure instanceof Error ? failure.message : String(failure);
    status = "Reset failed";
    render();
  } finally {
    if (currentOperation === operation) {
      cancellingOperation = undefined;
      cancellationResult = undefined;
    }
  }
}

async function initialize(): Promise<void> {
  const currentOperation = ++operation;
  render();
  try {
    await prepareSource();
    if (currentOperation !== operation) return;
    const response = await client.initialize();
    if (currentOperation !== operation) return;
    if (response.status !== "ready")
      throw new Error("Worker did not initialize");
    await archive.addSnapshot(response.archivedSnapshot);
    if (currentOperation !== operation) return;
    parameterCount = Object.values(response.snapshot.parameters).reduce(
      (sum, matrix) =>
        sum + matrix.reduce((count, row) => count + row.length, 0),
      0,
    );
    await prepareAttract(currentOperation);
  } catch (failure) {
    if (currentOperation !== operation) return;
    busy = false;
    error = failure instanceof Error ? failure.message : String(failure);
    status = "Initialization failed";
    render();
  }
}

async function openLearningInspection(): Promise<void> {
  if (busy || !result?.experiment || !followedParameter) return;
  const experiment = result.experiment;
  learningExperimentId = experiment.id;
  if (result.run.manifest.runId !== experiment.trainingRunId)
    selectRun(experiment.trainingRunId);
  attentionOpen = true;
  attentionLens = false;
  qProjectionOpen = false;
  offerParameterUpdate = false;
  learningMode = "backward";
  selectedKind = "gradient";
  selectedParameter = followedParameter.index;
  selectedBackwardEdge = undefined;
  compactFanIn = false;
  render();
  await inspect(
    experiment.trainingRunId,
    { kind: "gradient", parameterIndex: selectedParameter },
    "Completed mean-loss gradient → selected parameter",
  );
}

async function prepareAttract(currentOperation: number): Promise<void> {
  if (currentOperation !== operation) return;
  const response = await client.request({
    command: "predict",
    document: fixture.document,
  });
  if (currentOperation !== operation) return;
  if (response.status !== "result")
    throw new Error("Attract bootstrap did not return a recorded Predict");
  attractReplay = bindAttractReplay(response.result);
  attract = true;
  liveRunId = "";
  result = undefined;
  player = undefined;
  ready = true;
  busy = false;
  status = "Recorded real run. Not live.";
  render();
}
async function activateAttract(): Promise<void> {
  if (!attract || !ready || busy || !attractReplay) return;
  lastActivity = Date.now();
  clearExhibitBanner();
  attract = false;
  guidedMapIndex = 5;
  documentText = fixture.document;
  await execute("predict");
}
// Capture the activation before a stage/control sees its coordinate. It cannot select through A1.
window.addEventListener(
  "click",
  (event) => {
    if (
      !attract ||
      !ready ||
      busy ||
      (event.target as Element).closest("#clear-session, .session-controls")
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void activateAttract();
  },
  true,
);
window.addEventListener(
  "keydown",
  (event) => {
    if (
      attract &&
      ready &&
      !busy &&
      ["Enter", " "].includes(event.key) &&
      !(event.target as Element).closest(".session-controls,#clear-session")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void activateAttract();
    }
  },
  true,
);

window.addEventListener("beforeunload", () => {
  client.dispose();
  inspector.dispose();
});
void initialize();

function runLabel(run: RecordedRun): string {
  const step = sourceSnapshot(run.manifest.startingSnapshotId ?? "")?.state
    .optimizer.step;
  const role = run.manifest.intervention
    ? "DECLARED HEAD ABLATION"
    : run.manifest.runId.endsWith(":baseline")
      ? "ablation baseline"
      : run.manifest.runId.endsWith(":training")
        ? "training / loss"
        : run.manifest.runId.endsWith(":before")
          ? "before update"
          : "prediction";
  return `step ${step ?? "unavailable"} · ${role} · ${run.manifest.runId}`;
}
function renderHistory(): string {
  const runs = [...archive.runs.values()];
  if (result && !archive.runs.has(result.run.manifest.runId))
    runs.push(result.run);
  const options = (selected: string) =>
    runs
      .map(
        (run) =>
          `<option value="${escapeHtml(run.manifest.runId)}" ${run.manifest.runId === selected ? "selected" : ""}>${escapeHtml(runLabel(run))}</option>`,
      )
      .join("");
  const comparisonRun = archive.runs.get(comparisonRunId);
  const selected = selectedArtifact(selectedKind);
  const comparison =
    player && comparisonRun
      ? historyComparisonReadModel(
          player.recordedRun,
          comparisonRun,
          selected?.id,
        )
      : undefined;
  return `<section class="source-block history"><h2>Explore exact runs and checkpoints</h2>${result ? `<details data-testid="runtime-provenance"><summary>Exact runtime provenance · available offline</summary><p>This selected run was recorded by Model Lab runtime <code data-testid="runtime-revision">${escapeHtml(result.run.manifest.runtimeRevision)}</code>. Historical inspection requires a compatible runtime.</p></details>` : ""}<p data-testid="history-count">${archive.runs.size} runs · ${archive.snapshots.size} snapshots · ${archive.learningExperiments.size} learning experiments retained in this session. Estimated serialized evidence: ${(evidenceBytes / 1048576).toFixed(1)} MiB / 64 MiB.</p><div class="controls">
    <label>Recorded run<select id="history-run" ${busy ? "disabled" : ""}>${options(result?.run.manifest.runId ?? "")}</select></label>
    <label>Reset destination<select id="snapshot-select"><option value="">Canonical initial model</option>${[...archive.snapshots.values()].map((snapshot) => `<option value="${snapshot.id}" ${snapshot.id === selectedSnapshotId ? "selected" : ""}>step ${snapshot.state.optimizer.step} · ${snapshot.id.slice(0, 23)}…</option>`).join("")}</select></label>
    <label>Compare from<select id="compare-run"><option value="">Choose an earlier run</option>${options(comparisonRunId)}</select></label></div>
    ${
      comparison
        ? `<div class="source-comparison" data-testid="run-comparison" data-selected-run="${escapeHtml(comparison.selectedRunId)}" data-comparison-run="${escapeHtml(comparison.comparisonRunId)}"><p>Selected run minus comparison run · ${escapeHtml(selectedKind)} · position ${selectedToken}</p><p>Selected: ${escapeHtml(comparison.selectedRunId)}<br>Reference: ${escapeHtml(comparison.comparisonRunId)}</p>${
            !comparison.compatible
              ? `<p>Incompatible evidence: ${escapeHtml(comparison.reason ?? "")}. No deltas calculated.</p>`
              : comparison.deltas && comparison.domain
                ? `<p>Shared domain [${comparison.domain.join(", ")}] · reference line / selected bar · deltas DERIVED</p>${comparison.deltas
                    .slice(0, 32)
                    .map((delta, index) => {
                      const [minimum, maximum] = comparison.domain!;
                      const zero = ((0 - minimum) / (maximum - minimum)) * 100;
                      const current =
                          ((comparison.selected![index]! - minimum) /
                            (maximum - minimum)) *
                          100,
                        reference =
                          ((comparison.comparison![index]! - minimum) /
                            (maximum - minimum)) *
                          100;
                      return `<div class="comparison-row"><span>${index}</span><div class="comparison-track" data-domain="${comparison.domain!.join(",")}"><span class="comparison-zero" style="left:${zero}%"></span><span class="comparison-current" style="left:${Math.min(zero, current)}%;width:${Math.abs(current - zero)}%"></span><span class="comparison-reference" style="left:${reference}%"></span></div><span title="${comparison.comparison![index]}">${number(comparison.comparison![index], 4)}</span><span title="${comparison.selected![index]}">${number(comparison.selected![index], 4)}</span><span title="${delta}">Δ ${number(delta, 4)}</span></div>`;
                    })
                    .join(
                      "",
                    )}<details><summary>All ${comparison.deltas.length} raw comparison pairs</summary><pre>${escapeHtml(JSON.stringify(comparison, null, 2))}</pre></details>`
                : `<p>${escapeHtml(comparison.reason ?? "Selected evidence is unavailable.")}</p>`
          }</div>`
        : ""
    }
    <details><summary>Experiment · head ablation</summary><p>Run two disposable copies of the selected run’s exact starting snapshot and input. Zero only layer ${layer}, head ${head} output immediately before concatenation. Both are new observed executions; live training state stays unchanged.</p><button id="ablate-head" ${busy || !result ? "disabled" : ""}>Compare selected head ablation</button><p>${archive.interventionExperiments.size} declared ablation experiments archived. Select any baseline or intervention run to inspect its values and comparison. No poisoning or backdoor claim is made.</p></details><label class="kiosk-option"><input id="kiosk-mode" type="checkbox" ${kioskEnabled ? "checked" : ""}>Exhibit mode · reset after inactivity</label><div class="controls exhibit-timing"><label>Idle reset after (seconds)<input id="idle-seconds" type="number" min="30" max="3600" value="${exhibitConfiguration.resetAfterMs / 1000}"></label><label>Warning before reset (seconds)<input id="warning-seconds" type="number" min="5" max="120" value="${exhibitConfiguration.warningMs / 1000}"></label><p>Initial field-test timing. Settings are kept in this URL; visitor evidence is not persisted.</p></div><details><summary>Bounded learning and complete capture</summary><div class="controls"><label>Actual updates (1–500)<input id="training-count" type="number" min="1" max="500" value="${trainingCount}"></label><button id="train-many" ${busy || !ready ? "disabled" : ""}>Learn selected updates</button><button id="whole-capture" ${busy || !result ? "disabled" : ""}>Record everything · inspect statistics</button></div><p>Every actual update keeps a loss summary. A batch retains full checkpoints at its first and final step and whenever loss halves from the last retained checkpoint. Explicit single updates always retain complete evidence. The 64 MiB evidence budget is checked between operations, with room for one completed operation. Clear session starts a new archive; history is never silently evicted. Complete capture displays statistics.</p>${
      trainingSummaries.length
        ? `<p data-testid="training-summary">${trainingSummaries.length} actual update summaries · latest pre-update loss ${number(trainingSummaries.at(-1)!.loss)}</p><details><summary>Actual loss timeline</summary><p>Showing the latest ${Math.min(500, trainingSummaries.length)} real update summaries. Earlier summaries remain in session memory.</p><div class="table-scroll"><table><thead><tr><th>Source training run / input</th><th>Source snapshot / step</th><th>Resulting step</th><th>Loss before update</th></tr></thead><tbody>${trainingSummaries
            .slice(-500)
            .map(
              (item) =>
                `<tr><td>${escapeHtml(item.trainingRunId)} · ${escapeHtml(item.document)}</td><td>${escapeHtml(item.sourceSnapshotId)} · ${item.sourceStep}</td><td>${item.step}</td><td title="${item.loss}">${number(item.loss, 9)}</td></tr>`,
            )
            .join("")}</tbody></table></div></details>`
        : ""
    }</details></section>`;
}
function selectRun(id: string): void {
  const run = archive.runs.get(id);
  if (!run) return;
  clearDisplayedInspection();
  const tokenIds = run.manifest.input as number[];
  const targetIds = run.manifest.targets as number[];
  const read = (record: RecordedRun, kind: string) =>
    record.artifacts
      .filter(
        (artifact) =>
          artifact.concept.kind === kind &&
          artifact.availability === "available",
      )
      .map((artifact) => [...artifact.values!]);
  const experiment = [...archive.learningExperiments.values()].find((item) =>
    [item.beforeRunId, item.trainingRunId, item.afterRunId].includes(id),
  );
  const before = experiment && archive.runs.get(experiment.beforeRunId);
  const after = experiment && archive.runs.get(experiment.afterRunId);
  const training = experiment && archive.runs.get(experiment.trainingRunId);
  result = {
    run,
    tokenIds,
    targetIds,
    trainingStep: sourceSnapshot(run.manifest.startingSnapshotId ?? "")!.state
      .optimizer.step,
    logits: read(run, "logits"),
    probabilities: read(run, "probabilities"),
    snapshots: [],
    runs: [],
    ...(experiment && before && after && training
      ? {
          experiment,
          learn: {
            meanLoss: experiment.objective.meanLoss,
            perPositionLoss: read(training, "loss").map((values) => values[0]!),
            update: experiment.update,
            before: {
              logits: read(before, "logits"),
              probabilities: read(before, "probabilities"),
            },
            after: {
              logits: read(after, "logits"),
              probabilities: read(after, "probabilities"),
            },
          },
        }
      : {}),
  };
  player = new TracePlayer(run);
  selectedToken = Math.min(selectedToken, tokenIds.length - 1);
  key = Math.min(key, selectedToken);
  detail = undefined;
  status = `Viewing recorded ${runLabel(run)}`;
  render();
  void loadDetail();
}
/** Full observed capture can answer new detail requests after the live worker moves on. */
function cachedInspection(
  sourceRunId: string,
  target: InspectionTarget,
): InspectionResult | undefined {
  const exact = inspectionCache.get(`${sourceRunId}:${JSON.stringify(target)}`);
  if (exact) return exact;
  const whole = inspectionCache.get(
    `${sourceRunId}:${JSON.stringify({ kind: "whole" })}`,
  );
  const graph = whole?.graph;
  if (!whole || !graph || target.kind === "whole") return undefined;
  const root =
    target.kind === "node"
      ? target.nodeId
      : target.kind === "gradient"
        ? graph.nodes.find(
            (node) =>
              node.parameter?.index === target.parameterIndex &&
              node.gradient !== undefined,
          )?.id
        : graph.semanticRoots?.find(
            (entry) => entry.artifactId === target.artifactId,
          )?.nodeIds[target.index];
  if (root === undefined || !graph.nodes.some((node) => node.id === root))
    return undefined;
  const edges = graph.edges.filter(
    (edge) => edge.child === root || edge.parent === root,
  );
  const ids = new Set([
    root,
    ...edges.flatMap((edge) => [edge.child, edge.parent]),
  ]);
  return immutableCopy({
    ...whole,
    graph: {
      roots: [root],
      nodes: graph.nodes.filter((node) => ids.has(node.id)),
      edges,
      structural: graph.structural.filter((event) =>
        event.nodeIds?.includes(root),
      ),
    },
  });
}
async function inspect(
  sourceRunId: string,
  target: InspectionTarget,
  label: string,
  path?: number[],
): Promise<void> {
  if (busy) return;
  const original =
    target.kind === "node" && inspectionBinding
      ? inspectionBinding.originalSemanticTarget
      : target;
  const binding = bindInspection(
    sourceRunId,
    original,
    inspectionSelection(),
    operation,
  );
  inspectionBinding = binding;
  if (
    evidenceBytes >= SESSION_BUDGET &&
    !cachedInspection(sourceRunId, target)
  ) {
    clearDisplayedInspection();
    inspectionBinding = { ...binding, availability: "BUDGET EXCEEDED" };
    mode = "microscope";
    error =
      "Session evidence limit reached. Clear session before capturing additional detail.";
    render();
    return;
  }
  const current = ++inspectionOperation;
  const cacheKey = `${sourceRunId}:${JSON.stringify(target)}`;
  mode = "microscope";
  inspectionPending = true;
  inspection = undefined;
  inspectionPath = [];
  inspectionLabel = label;
  inspectionWhole = target.kind === "whole";
  render();
  mount.querySelector<HTMLElement>("#microscope")?.scrollTo({ top: 0 });
  try {
    let evidence = cachedInspection(sourceRunId, target);
    if (!evidence) {
      const response = await client.request({
        command: "inspect",
        sourceRunId,
        target,
      });
      if (
        current !== inspectionOperation ||
        inspectionBinding !== binding ||
        !inspectionIsCurrent(binding, inspectionSelection(), operation)
      )
        return;
      if (response.status !== "inspection")
        throw new Error("Worker did not return inspection evidence");
      evidence = response.inspection;
      if (evidence.availability === "not_captured") {
        binding.verification = "VERIFYING";
        binding.origin = "RECOMPUTED";
        render();
        const run = archive.runs.get(sourceRunId);
        const snapshot = sourceSnapshot(run?.manifest.startingSnapshotId ?? "");
        if (!run || !snapshot)
          throw new Error("Historical run or snapshot is unavailable");
        const backward = [...archive.learningExperiments.values()].some(
          (experiment) =>
            experiment.trainingRunId === sourceRunId ||
            experiment.backwardRunId === sourceRunId,
        );
        evidence = await inspector.inspect({ snapshot, run, target, backward });
      }
      if (
        current !== inspectionOperation ||
        inspectionBinding !== binding ||
        !inspectionIsCurrent(binding, inspectionSelection(), operation)
      )
        return;
      if (evidence.sourceRunId !== sourceRunId)
        throw new Error("Inspection belongs to a different run");
      if (
        evidence.availability === "available" &&
        (evidence.provenance !== "recomputed" ||
          evidence.verification?.verified)
      ) {
        inspectionCache.set(cacheKey, immutableCopy(evidence));
        evidenceBytes += new TextEncoder().encode(
          JSON.stringify(evidence),
        ).byteLength;
      }
    }
    if (
      current !== inspectionOperation ||
      inspectionBinding !== binding ||
      !inspectionIsCurrent(binding, inspectionSelection(), operation)
    )
      return;
    binding.origin =
      evidence.provenance === "recomputed" ? "RECOMPUTED" : "OBSERVED";
    binding.verification = evidence.verification
      ? evidence.verification.verified
        ? "VERIFIED"
        : "FAILED"
      : "NONE";
    binding.availability =
      binding.verification === "FAILED"
        ? "VERIFICATION FAILED"
        : evidence.availability === "available"
          ? "AVAILABLE"
          : evidence.availability === "unsupported"
            ? "UNSUPPORTED"
            : "NOT CAPTURED";
    inspection = evidence;
    inspectionPath =
      path ?? (evidence.graph?.roots.length ? [evidence.graph.roots[0]!] : []);
  } catch (failure) {
    if (
      current !== inspectionOperation ||
      inspectionBinding !== binding ||
      !inspectionIsCurrent(binding, inspectionSelection(), operation)
    )
      return;
    binding.availability = "NOT CAPTURED";
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    if (
      current === inspectionOperation &&
      inspectionBinding === binding &&
      inspectionIsCurrent(binding, inspectionSelection(), operation)
    ) {
      binding.graphPath = [...inspectionPath];
      inspectionPending = false;
      render();
      if (attentionLens) {
        const lens = mount.querySelector<HTMLElement>(".calculation-lens");
        const scalar = mount.querySelector<HTMLElement>(".attention-scalar");
        if (lens && scalar) lens.scrollTop = scalar.offsetTop;
      } else
        mount.querySelector<HTMLElement>("#microscope")?.scrollTo({ top: 0 });
      mount
        .querySelector<HTMLElement>(
          '[data-testid="scalar-operation"], .learning-expansion h2',
        )
        ?.focus({ preventScroll: true });
    }
  }
}

function saveExhibitConfiguration(): void {
  const url = new URL(location.href);
  url.searchParams.set("kiosk", kioskEnabled ? "1" : "0");
  url.searchParams.set(
    "idleSeconds",
    String(exhibitConfiguration.resetAfterMs / 1000),
  );
  url.searchParams.set(
    "warningSeconds",
    String(exhibitConfiguration.warningMs / 1000),
  );
  history.replaceState(null, "", url);
}
function clearExhibitBanner(): void {
  document.querySelector("#exhibit-warning")?.remove();
}
function checkExhibitIdle(): void {
  const state = exhibitState(
    kioskEnabled,
    attract,
    lastActivity,
    Date.now(),
    exhibitConfiguration,
  );
  if (state.phase === "RESET") {
    lastActivity = Date.now();
    clearExhibitBanner();
    void reset(false, true);
    return;
  }
  if (state.phase !== "WARNING") {
    if (!visitorPointerDown) clearExhibitBanner();
    return;
  }
  let banner = document.querySelector<HTMLElement>("#exhibit-warning");
  if (!banner) {
    banner = document.createElement("aside");
    banner.id = "exhibit-warning";
    banner.setAttribute("role", "alert");
    banner.innerHTML =
      'Public Reset in <b data-testid="idle-countdown"></b> seconds. <button id="stay-here">Keep this session</button>';
    document.body.insertBefore(banner, mount);
    banner.querySelector("#stay-here")!.addEventListener("click", () => {
      lastActivity = Date.now();
      clearExhibitBanner();
    });
  }
  banner.querySelector('[data-testid="idle-countdown"]')!.textContent = String(
    Math.ceil(state.remainingMs! / 1000),
  );
}
function recordVisitorActivity(event: Event): void {
  const now = Date.now();
  if (
    exhibitState(kioskEnabled, attract, lastActivity, now, exhibitConfiguration)
      .phase === "RESET"
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    lastActivity = now;
    clearExhibitBanner();
    void reset(false, true);
    return;
  }
  lastActivity = now;
  if (event.type === "pointerdown" || event.type === "touchstart")
    visitorPointerDown = true;
  else clearExhibitBanner();
}
for (const event of ["pointerup", "pointercancel", "touchend", "touchcancel"])
  window.addEventListener(
    event,
    () => {
      visitorPointerDown = false;
      clearExhibitBanner();
    },
    { capture: true },
  );
for (const event of ["pointerdown", "keydown", "touchstart"])
  window.addEventListener(event, recordVisitorActivity, { capture: true });
window.addEventListener(
  "pointermove",
  () => {
    if (
      exhibitState(
        kioskEnabled,
        attract,
        lastActivity,
        Date.now(),
        exhibitConfiguration,
      ).phase === "RESET"
    ) {
      checkExhibitIdle();
      return;
    }
    lastActivity = Date.now();
    if (!visitorPointerDown) clearExhibitBanner();
  },
  { passive: true },
);
window.setInterval(checkExhibitIdle, 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkExhibitIdle();
});
window.addEventListener(
  "click",
  (event) => {
    const link = (event.target as Element).closest("a");
    if (kioskEnabled && link) {
      event.preventDefault();
      status =
        "Exhibit mode keeps this instrument open. Bundled source remains available in this view.";
      render();
    }
  },
  true,
);
for (const event of ["dragover", "drop"])
  window.addEventListener(event, (event) => {
    if (kioskEnabled) event.preventDefault();
  });

async function ablateHead(): Promise<void> {
  if (busy || !result || evidenceBytes >= SESSION_BUDGET) return;
  const source = result;
  const snapshot = sourceSnapshot(source.run.manifest.startingSnapshotId ?? "");
  if (!snapshot) {
    error = "The selected starting snapshot is unavailable.";
    render();
    return;
  }
  clearDisplayedInspection();
  const currentOperation = ++operation;
  busy = true;
  error = "";
  status = "Running matched baseline and head ablation…";
  render();
  try {
    const experiment = await inspector.ablate({
      snapshot,
      inputIds: source.tokenIds,
      targetIds: source.targetIds,
      selection: { layer, head },
    });
    if (currentOperation !== operation) return;
    const destination = archive;
    await destination.addRun(experiment.baselineRun);
    await destination.addRun(experiment.interventionRun);
    await destination.addInterventionExperiment(experiment);
    if (currentOperation !== operation) return;
    evidenceBytes += new TextEncoder().encode(
      JSON.stringify(experiment),
    ).byteLength;
    comparisonRunId = experiment.baselineRun.manifest.runId;
    busy = false;
    selectRun(experiment.interventionRun.manifest.runId);
    selectedKind = "probabilities";
    status = `Observed ablation complete · layer ${experiment.selection.layer}, head ${experiment.selection.head} · live training state unchanged`;
    render();
  } catch (failure) {
    if (currentOperation !== operation) return;
    error = failure instanceof Error ? failure.message : String(failure);
    status = "Ablation failed";
  } finally {
    if (currentOperation === operation) {
      busy = false;
      render();
    }
  }
}
