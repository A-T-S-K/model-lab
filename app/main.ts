import type { CanonicalReceipt } from './worker/executors.js';
import { SharedInspector } from './views/shared-inspector.js';
import './views/shared-inspector.css';
import { forwardReadModel } from './spatial/forward.js';
import "./style.css";
import { ForwardDriver } from "./worker/forward-driver.js";
import "./spatial/style.css";
import { spatialEvidenceReadModel, spatialEvidenceUnavailable, spatialReadModel, type MicrogptSelection } from "./spatial/bindings.js";
import type { WorldSelection } from './spatial/topology.js';
import { learningReadModel, resolveParameter, type LearningStage } from "./spatial/learning.js";
import { SpatialPresenter } from "./spatial/presenter.js";
import { exhibitTiming, exhibitState } from "./presentation/exhibit-state.js";
import { experienceCapabilities, resolveExperienceProfile, type ExperienceCapabilities, type ExperienceProfile } from "./presentation/experience-profile.js";
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
import {
  exportPortableArchive,
  importPortableArchive,
  PORTABLE_ARCHIVE_EXTENSION,
  PORTABLE_ARCHIVE_LIMITS,
} from "../archive/portable.js";
import { RETENTION_RESERVATION_BOUNDS, RETENTION_RESERVATION_BYTES, SessionRetention, type RetentionOperation, type RetentionStatus, type RetentionTransaction } from '../archive/retention.js';
import { BoundedCache, type CacheReservation } from './presentation/bounded-cache.js';
import { PRESENTATION_WORK, nextWindowOffset, presentationWindow, previousWindowOffset, windowSummary } from './presentation/work-contract.js';
import { InspectorWorkerClient } from "./worker/inspector-client.js";
import { isHeadAblationExperiment } from "../experiments/ablation.js";
import { isActivationPatchExperiment } from "../experiments/activation-patch.js";
import type { ActivationVariantExperiment } from "../experiments/model-variant.js";
import type { CompositeVariantExperiment } from "../experiments/composite-model-variant.js";
import {
  isActivationVariantExperiment,
  isCompositeVariantExperiment,
} from "../experiments/model-variant-experiment.js";
import type { MatchedDataExperimentReceipt } from "../experiments/data-experiment.js";
import "../experiments/matched-data-substitution.js";
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

const spatialEnabled = new URLSearchParams(location.search).get("presentation") === "spatial";
let spatialActive = spatialEnabled;
const spatialSelection: MicrogptSelection = { layer: 0, query: 4, key: 0, head: 0, feature: 0 };
const worldSelection: WorldSelection = {node:'',port:'',phase:'',coordinates:{}};
function clearWorldSelection(){Object.assign(worldSelection,{node:'',port:'',phase:'',coordinates:{}});}
function focusCanonicalPredict(){queueMicrotask(()=>document.querySelector<HTMLButtonElement>('#predict')?.focus({preventScroll:true}));}
const spatialPresenter = new SpatialPresenter(spatialSelection);
let spatialExperimentId = "";
let spatialExperimentOffset = 0;
let activeDataExperimentId = "";
const config = fixture.config;
const client = new ModelWorkerClient();
const inspector = new InspectorWorkerClient();
let archive = new SessionArchive();
const retention = new SessionRetention(archive);
let retentionStatus: RetentionStatus | undefined;
let activeRetentionTransaction: RetentionTransaction | undefined;
let importedArchiveId = "";
let portableArchiveMessage = "";
const sharedInspector = new SharedInspector();
let spatialEvidenceRunId = "";
let spatialEvidenceReplay = false;
let mode: "guided" | "explore" | "microscope" = "guided";
let inspection: InspectionResult | undefined;
let inspectionBinding: InspectionBinding | undefined;
let inspectionPath: number[] = [];
let inspectionLabel = "";
let inspectionPending = false;
let inspectionOperation = 0;
let inspectionWhole = false;
let microscopeWindows = { operands: 0, consumers: 0, structural: 0 };
const INSPECTION_CACHE_MAX_BYTES = 8 * 1024 * 1024;
const INSPECTION_CACHE_ENTRY_BYTES = 2 * 1024 * 1024;
const inspectionCache = new BoundedCache<string, InspectionResult>(8, INSPECTION_CACHE_MAX_BYTES, INSPECTION_CACHE_ENTRY_BYTES);
let pendingInspectionCacheReservation: CacheReservation<InspectionResult> | undefined;
let selectedSnapshotId = "";
let comparisonRunId = "";
let historyRunOffset = 0;
let snapshotOffset = 0;
let comparisonRunOffset = 0;
let comparisonRowOffset = 0;
let trainingCount = 1;
let guidedMapIndex = 5;
let guidedLearning: GuidedLearning | undefined;
let guidedBatch: GuidedBatch | undefined;
let attractReplay: AttractReplayBinding | undefined;
let attract = true;
let sessionControlsOpen = false;
let lastAcceptedResult: RunResult | undefined;
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
let exhibitEntry = new URLSearchParams(location.search).get("kiosk") === "1";
let idleResetEnabled = exhibitEntry;
let kioskEnabled = exhibitEntry;
let exhibitConfiguration = exhibitTiming(new URLSearchParams(location.search));
let lastActivity = Date.now();
function currentProfile(): ExperienceProfile {
  return resolveExperienceProfile({
    isKiosk: exhibitEntry,
    isFacilitatorOpen: spatialPresenter.operatorControls,
  });
}
function currentCapabilities(): ExperienceCapabilities {
  return experienceCapabilities(currentProfile(), spatialPresenter.freeExplore);
}
let visitorPointerDown = false;
const TRAINING_SUMMARY_LIMIT = 500;
let trainingSummaryTotal = 0;
let trainingSummaryDiscarded = 0;
const trainingSummaries: {
  step: number;
  loss: number;
  trainingRunId: string;
  document: string;
  sourceSnapshotId: string;
  sourceStep: number;
}[] = [];

async function beginRetention(operation: RetentionOperation): Promise<RetentionTransaction> {
  const transaction = await retention.begin(operation);
  retentionStatus = retention.status();
  return transaction;
}
async function commitRetention(transaction: RetentionTransaction): Promise<void> {
  retentionStatus = await transaction.commit();
  archive = retention.archive;
}
function cancelRetention(transaction: RetentionTransaction | undefined): void {
  transaction?.cancel();
  if (transaction === activeRetentionTransaction) activeRetentionTransaction = undefined;
  if (retentionStatus) retentionStatus = retention.status();
}

const mount = document.querySelector<HTMLDivElement>("#app")!;
let documentText = fixture.document;
let result: RunResult | undefined;
let player: TracePlayer | undefined;
let beforeForward: RunResult | undefined;
let readyComparison = true;
let activeIntervention: number | undefined;
let beforeForwardLocation: ReturnType<SpatialPresenter['captureLocation']> | undefined;
let beforeForwardExperiment = '';
function restoreExecutionView() {
  spatialExperimentId = beforeForwardExperiment;
  if (beforeForwardLocation) spatialPresenter.restoreLocation(beforeForwardLocation);
  beforeForwardLocation = undefined;
}
const forwardDriver = new ForwardDriver(client, forwardChanged, async incoming => {
  const transaction = activeRetentionTransaction; activeRetentionTransaction = undefined;
  beforeForward = undefined; beforeForwardLocation = undefined;
  await execute(incoming.learn ? "train" : "predict", 1, false, incoming, transaction);
}, failure => {
  cancelRetention(activeRetentionTransaction); activeRetentionTransaction = undefined;
  result = beforeForward; beforeForward = undefined; restoreExecutionView();
  player = result && new TracePlayer(result.run);
  clearDisplayedInspection();
  status = "Execution failed · prior completed evidence preserved";
  error = String(failure); render();
});
client.onFailure = failure => {
  if (!forwardDriver.active) return;
  cancelRetention(activeRetentionTransaction); activeRetentionTransaction = undefined;
  discardForward(); ready = false;
  status = "Worker failed · partial prediction released · Reset model or Clear session to restart";
  error = failure.message; render();
};
let inspectedExecutionRevision: string | undefined;
function forwardChanged() {
  const revision = forwardDriver.progress && `${forwardDriver.progress.executionId}:${forwardDriver.progress.sequence}`;
  if (revision !== inspectedExecutionRevision) { clearDisplayedInspection(); inspectedExecutionRevision = revision; }
  if (forwardDriver.preview) {
    result = forwardDriver.preview; player = new TracePlayer(result.run);
    const profile = currentProfile();
    const training = forwardDriver.progress?.training;
    const boundary = forwardDriver.progress?.last;
    if (forwardDriver.follow) {
      if (training?.phase.endsWith('forward')) {
        // Real forward phases (baseline forward, training forward, candidate forward)
        // follow authentic backend ForwardBoundary operations through the model topology.
        if (boundary) spatialPresenter.followBoundary(boundary);
      } else if (training) {
        // Non-forward learning phases (loss, backward seed, backward, optimizer proposal, candidate application, ready)
        if (profile === 'workbench') {
          // Workbench retains expert lower learning rail framing and learningStage
          spatialPresenter.followLearning(
            training.phase === 'loss'
              ? 'objective'
              : training.phase.includes('backward')
                ? 'gradient'
                : 'adam'
          );
        } else {
          // Visitor and Facilitator use public same-world learning evidence
          const rowsCount = training.losses?.length || (Array.isArray(forwardDriver.preview?.run.manifest.input) ? forwardDriver.preview.run.manifest.input.length : 4);
          spatialPresenter.followPublicLearning(training.phase, rowsCount);
        }
      } else if (boundary) {
        // Regular non-training prediction forward
        spatialPresenter.followBoundary(boundary);
      }
    }
    status = `${forwardDriver.phase === 'pausing' ? 'Pausing · admitted operator may finish' : forwardDriver.pending && forwardDriver.phase === 'paused' ? 'Executing one admitted operator' : forwardDriver.phase === 'running' ? 'Running · paced operator execution' : forwardDriver.phase === 'starting' ? 'Preparing input and checkpoint' : forwardDriver.phase === 'cancelling' ? 'Cancelling execution' : 'Paused · no future permits'} · ${forwardDriver.progress?.sequence}/${forwardDriver.progress?.total}`;
    if (training) status = `Accepted step ${training.acceptedStep} · ${training.phase === 'ready' ? 'Candidate ready — not accepted' : training.phase} · candidate is provisional`;
    syncSpatialSelection();
  } else if (!forwardDriver.active) {
    cancelRetention(activeRetentionTransaction); activeRetentionTransaction = undefined;
    result = beforeForward; beforeForward = undefined; restoreExecutionView(); player = result && new TracePlayer(result.run);
    status = "Execution cancelled · prior completed evidence preserved";
    clearDisplayedInspection();
  }
  render();
}
function executionExplore(event: Event) {
  if (!forwardDriver.active) return;
  const target = event.target as Element;
  if (target.closest('.contextual-dock, #execution-controls')) return;
  if (!target.closest('.world-workspace,.spatial-selection,#spatial-home,#spatial-back,#spatial-focus,#spatial-lens')) return;
  forwardDriver.follow = false;
  if (forwardDriver.phase === 'running') {
    // Defer render until the current gesture/selection handler has used its target.
    queueMicrotask(() => forwardDriver.pause());
  }
}
for (const type of ['pointerdown','wheel','keydown','change','click']) mount.addEventListener(type, executionExplore, { capture: true });
function bindForwardControls() {
    mount.querySelectorAll<HTMLButtonElement>('[data-compare-arm]').forEach(button=>button.addEventListener('click',()=>{
      const prepared=forwardDriver.progress?.training?.readyOutputs;
      const arm=button.dataset.compareArm;
      clearDisplayedInspection(); spatialPresenter.learningStage=undefined; spatialPresenter.lens=true;
      if(prepared && forwardDriver.preview){
        readyComparison=arm==='pair';
        const run=arm==='before'?prepared.before:prepared.after;
        result={...forwardDriver.preview,run,trainingStep:arm==='before'?prepared.starting.state.optimizer.step:prepared.starting.state.optimizer.step+1,snapshots:[prepared.starting,...forwardDriver.preview.snapshots]}; player=new TracePlayer(run);
        forwardDriver.follow=false; render();
      } else if(!forwardDriver.active && !busy){
        const e=[...archive.interventionExperiments.values()].find(e=>e.baselineRun.manifest.runId===result?.run.manifest.runId||e.interventionRun.manifest.runId===result?.run.manifest.runId);
        if(e)selectRun(arm==='before'?e.baselineRun.manifest.runId:e.interventionRun.manifest.runId);
      }
    }));
    mount.querySelectorAll<HTMLButtonElement>('[data-live-child]').forEach(button => button.addEventListener('click', () => {
      const source = button.dataset.liveSource;
      if (source) void inspect(source, { kind: 'node', nodeId: Number(button.dataset.liveChild) }, 'Actual processed contribution');
    }));
    mount.querySelector('#step-learning')?.addEventListener('click', () => void startForward(true));
    mount.querySelector('#short-teach')?.addEventListener('click', () => void startForward(true));
    mount.querySelector('#execution-accept')?.addEventListener('click', () => void forwardDriver.acceptUpdate());
    mount.querySelector('#execution-pin')?.addEventListener('click', () => {
      syncTrainingPin();
      if (!currentCapabilities().executionDiagnostics) forwardDriver.follow = true;
      if (forwardDriver.progress?.training?.phase === 'optimizer proposal') forwardDriver.runToProposal();
      else forwardDriver.runToContribution();
    });
    mount.querySelector('#step-prediction')?.addEventListener('click', () => void startForward());
    mount.querySelector('#execution-next')?.addEventListener('click', () => { syncTrainingPin(); void forwardDriver.next(); });
    mount.querySelector('#execution-continue')?.addEventListener('click', () => {
      syncTrainingPin();
      if (!currentCapabilities().executionDiagnostics) forwardDriver.follow = true;
      forwardDriver.continue();
    });
    mount.querySelector('#execution-pause')?.addEventListener('click', () => forwardDriver.pause());
    mount.querySelector('#execution-cancel')?.addEventListener('click', () => void cancelForward());
    mount.querySelector('#execution-follow')?.addEventListener('change', event => { forwardDriver.follow = (event.target as HTMLInputElement).checked; });
}
function syncTrainingPin() {
  const pin = spatialPresenter.pin; let index = 0;
  for (const name of fixture.parameterOrder) for (let row = 0; row < fixture.parameters[name as keyof typeof fixture.parameters].length; row++) for (let column = 0; column < fixture.parameters[name as keyof typeof fixture.parameters][row].length; column++) {
    if (pin.name === name && pin.row === row && pin.column === column) forwardDriver.pin = index;
    index++;
  }
}
async function startForward(training = false) {
  if (busy || !ready || forwardDriver.active) return;
  try { activeRetentionTransaction = await beginRetention('canonical'); }
  catch (failure) { error = failure instanceof Error ? failure.message : String(failure); status = 'Retention capacity refused · no execution started'; render(); return; }
  readyComparison=true; beforeForwardLocation = spatialPresenter.captureLocation(); beforeForwardExperiment = spatialExperimentId;
  spatialPresenter.invalidate(); spatialPresenter.learningStage = undefined; spatialExperimentId = '';
  clearDisplayedInspection(); operation++; beforeForward = result; result = undefined; player = undefined; error = ''; status = 'Preparing captured input and checkpoint…';
  spatialSelection.query = 0; spatialSelection.key = 0; spatialSelection.head = 0;
  syncTrainingPin(); await forwardDriver.start(documentText, training);
}
async function cancelForward() { await forwardDriver.cancel(); }
function discardForward() {
  if (!forwardDriver.active) return;
  cancelRetention(activeRetentionTransaction); activeRetentionTransaction = undefined;
  forwardDriver.discard(); result = beforeForward; beforeForward = undefined; restoreExecutionView();
  player = result && new TracePlayer(result.run); clearDisplayedInspection();
}

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
  if (activeInspectionSource(inspectionBinding?.sourceRunId ?? '')) return 'LIVE' as const;
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
  const priorSpatialSelection = mount.querySelector(".context-lens")?.getAttribute("data-selection");
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
  document.body.classList.toggle("spatial-mode", spatialActive);
  document.body.classList.toggle("instrument-mode", !spatialActive);
  if (spatialActive) {
    const displayed = attract && exhibitEntry ? attractReplay?.result : result;
    const source = displayed && sourceBinding(displayed.run, config.vocabulary, sourceSnapshot(displayed.run.manifest.startingSnapshotId??"")?.state.optimizer.step??displayed.trainingStep, liveRunId, documentText, "SPATIAL ATTENTION");
    const evidenceRun=spatialEvidenceRunId?archive.evidence.get(spatialEvidenceRunId):undefined;
    const compositeExperiment=evidenceRun?undefined:[...archive.modelVariantExperiments.values()].filter(isCompositeVariantExperiment).find(experiment=>[experiment.baselineRun.manifest.runId,experiment.initializedRun.manifest.runId,experiment.trainedRun.manifest.runId].includes(displayed?.run.manifest.runId??''));
    const compositeState=compositeExperiment?(displayed?.run.manifest.runId===compositeExperiment.initializedRun.manifest.runId?compositeExperiment.initialState:compositeExperiment.trainedState):undefined;
    const makeModel=()=>evidenceRun?spatialEvidenceReadModel(evidenceRun,archive.evidence.metadataEnvelope(evidenceRun.id),worldSelection,spatialSelection,spatialEvidenceReplay,archive.evidence):displayed&&source?spatialReadModel(displayed.run,sourceSnapshot(source.sourceSnapshotId??"")??displayed.snapshots.find(s=>s.id===source.sourceSnapshotId),source,spatialSelection,compositeState):undefined;
    let model=makeModel();if(model&&spatialPresenter.bindWorld(model,!evidenceRun))model=makeModel();
    const learning = evidenceRun?undefined:spatialLearningModel();
    const interventionExperiment=evidenceRun?undefined:[...archive.interventionExperiments.values()].find(e=>e.baselineRun.manifest.runId===result?.run.manifest.runId||e.interventionRun.manifest.runId===result?.run.manifest.runId||e.donorRun?.manifest.runId===result?.run.manifest.runId);
    const ablation=interventionExperiment&&isHeadAblationExperiment(interventionExperiment)?interventionExperiment:undefined;
    const patch=interventionExperiment&&isActivationPatchExperiment(interventionExperiment)?interventionExperiment:undefined;
    const interventionPair=interventionExperiment?{before:forwardReadModel(interventionExperiment.baselineRun,sourceSnapshot(interventionExperiment.startingSnapshotId)),after:forwardReadModel(interventionExperiment.interventionRun,sourceSnapshot(interventionExperiment.startingSnapshotId))}:undefined;
    const variantExperiment=evidenceRun?undefined:[...archive.modelVariantExperiments.values()].filter(isActivationVariantExperiment).find(experiment=>[experiment.baselineRun.manifest.runId,experiment.variantRun.manifest.runId].includes(result?.run.manifest.runId??''));
    const variantPair=variantExperiment?{before:forwardReadModel(variantExperiment.baselineRun,sourceSnapshot(variantExperiment.source.snapshotId)),after:forwardReadModel(variantExperiment.variantRun,sourceSnapshot(variantExperiment.source.snapshotId))}:undefined;
    const compositePair=compositeExperiment?{before:forwardReadModel(compositeExperiment.baselineRun,sourceSnapshot(compositeExperiment.source.snapshotId)),after:forwardReadModel(compositeExperiment.trainedRun,sourceSnapshot(compositeExperiment.source.snapshotId),compositeExperiment.trainedState)}:undefined;
    const donorToken=spatialSelection.query===0?Math.min(1,Math.max(0,(Array.isArray(result?.run.manifest.input)?result.run.manifest.input.length:1)-1)):0;
    const donorHead=(spatialSelection.head+1)%config.nHead;
    const experimentList=[...archive.learningExperiments.values()].map(e=>({id:e.id,step:e.update.step+1})),experimentWindow=presentationWindow(experimentList,spatialExperimentOffset,PRESENTATION_WORK.spatialExperiments),selectedExperiment=experimentList.find(e=>e.id===spatialExperimentId),experimentItems=selectedExperiment&&!experimentWindow.items.includes(selectedExperiment)?[selectedExperiment,...experimentWindow.items.slice(0,PRESENTATION_WORK.spatialExperiments-1)]:experimentWindow.items;
    spatialExperimentOffset=experimentWindow.offset;
    const profile = currentProfile();
    mount.innerHTML = spatialPresenter.render(model, {
      profile,
      attract: !evidenceRun&&attract&&exhibitEntry, exhibit: !evidenceRun&&exhibitEntry, idleResetEnabled: idleResetEnabled, idleResetSeconds:exhibitConfiguration.resetAfterMs/1000,
      retention:{bytes:retentionStatus?.retained.archiveBytes??0,runs:archive.runs.size,snapshots:archive.snapshots.size,experiments:archive.learningExperiments.size,hardLimitBytes:retentionStatus?.hardLimitBytes??PORTABLE_ARCHIVE_LIMITS.archiveBytes},
      interventionPending: activeIntervention!==undefined,
      inspectedArm:forwardDriver.progress?.training?.readyOutputs?(result?.run.manifest.runId===forwardDriver.progress.training.readyOutputs.before.manifest.runId?'Current · accepted checkpoint':'Candidate · provisional checkpoint'):interventionExperiment?(result?.run.manifest.runId===interventionExperiment.baselineRun.manifest.runId?'Baseline':result?.run.manifest.runId===interventionExperiment.donorRun?.manifest.runId?'Donor':'Intervention'):variantExperiment?(result?.run.manifest.runId===variantExperiment.baselineRun.manifest.runId?'Canonical definition':'Leaky ReLU definition'):compositeExperiment?(result?.run.manifest.runId===compositeExperiment.baselineRun.manifest.runId?'Canonical definition':result?.run.manifest.runId===compositeExperiment.initializedRun.manifest.runId?'Composite · initialized':'Composite · trained A/B'):undefined,
      document: documentText, busy, ready, status:evidenceRun?'Read-only admitted evidence · no execution requested':status, error, execution: evidenceRun?undefined:forwardDriver.active?forwardDriver:undefined,
      outputPair:interventionExperiment?{before:interventionExperiment.baselineRun,after:interventionExperiment.interventionRun}:variantExperiment?{before:variantExperiment.baselineRun,after:variantExperiment.variantRun}:compositeExperiment?{before:compositeExperiment.baselineRun,after:compositeExperiment.trainedRun}:undefined,
      comparisonLabels:ablation?['Baseline','Head output zeroed']:patch?['Baseline','Donor patched']:variantExperiment?['Canonical ReLU','Leaky ReLU']:compositeExperiment?['Canonical W x','Composite W x + s B(Ax)']:undefined,
      intervention:ablation?{snapshot:ablation.startingSnapshotId,arm:result?.run.manifest.runId===ablation.baselineRun.manifest.runId?'Baseline':'Head output zeroed',summary:`layer ${ablation.selection.layer} / head ${ablation.selection.head} · all positions, aggregated output → zero → concat`}:patch?{snapshot:patch.startingSnapshotId,arm:result?.run.manifest.runId===patch.baselineRun.manifest.runId?'Baseline':result?.run.manifest.runId===patch.donorRun.manifest.runId?'Donor':'Donor patched',summary:`target p${patch.declaration.target.token}/L${patch.declaration.target.layer}/h${patch.declaration.target.head} ← donor p${patch.declaration.donor.token}/L${patch.declaration.donor.layer}/h${patch.declaration.donor.head} · exact observed vector → concat`,receipt:{policy:`${patch.comparison.policy.id}@${patch.comparison.policy.version}`,donor:patch.receipt.donorVector,original:patch.receipt.originalTargetVector,replacement:patch.receipt.effectiveReplacement,noOp:patch.receipt.noOp}}:undefined,
      patchDonor:{head:donorHead,token:donorToken},
      comparison: interventionPair ?? variantPair ?? compositePair ?? (readyComparison && forwardDriver.progress?.training?.readyOutputs ? {
        before:forwardReadModel(forwardDriver.progress.training.readyOutputs.before,forwardDriver.progress.training.readyOutputs.starting),
        after:forwardReadModel(forwardDriver.progress.training.readyOutputs.after,sourceSnapshot(forwardDriver.progress.training.candidateId!))} : undefined),
      learning, experimentId: evidenceRun?'':spatialExperimentId, liveStep: liveTrainingStep,evidenceWorld:evidenceRun?{label:evidenceRun.integration,replay:spatialEvidenceReplay}:undefined,
      experiments: experimentItems, experimentsWindow:{offset:experimentWindow.offset,end:experimentWindow.end,total:experimentWindow.total,hasPrevious:experimentWindow.hasPrevious,hasNext:experimentWindow.hasNext},
      canLearn: !evidenceRun&&!forwardDriver.active&&!!result&&result.run.manifest.runId===liveRunId&&source?.capturedDocument===documentText&&!busy&&ready,
      scalar:evidenceRun?'No scalar continuation is captured for this run.':microscopeView(inspection,inspectionPath,inspectionLabel,inspectionPending,inspectionWhole,inspectionRelationship(),inspectionBinding,microscopeWindows),
    });
    bind();
    spatialPresenter.bind(model, spatialSelectionChanged, render, selectExplanationPhase);
    bindSpatialLearning();
    bindForwardControls();
    mount.querySelector('#return-canonical-world')?.addEventListener('click',()=>{spatialEvidenceRunId='';spatialEvidenceReplay=false;clearWorldSelection();clearDisplayedInspection();spatialPresenter.invalidate();render();});
    mount.querySelector("#exhibit-opt-out")?.addEventListener("click",()=>{ idleResetEnabled=!idleResetEnabled; lastActivity=Date.now(); saveExhibitConfiguration(); clearExhibitBanner(); render(); });
    mount.querySelectorAll<HTMLElement>("[data-scroll-region]").forEach(element => {
      const scroll = regionScroll.get(element.dataset.scrollRegion);
      if (scroll && priorSpatialSelection === mount.querySelector(".context-lens")?.getAttribute("data-selection")) { element.scrollTop = scroll.top; element.scrollLeft = scroll.left; }
    });
    mount.querySelectorAll<HTMLDetailsElement>("details").forEach(details => {
      if (openDetails.has(details.querySelector("summary")?.textContent ?? "")) details.open = true;
    });
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
    else restoreSemanticFocus();
    const restored = focusId && document.getElementById(focusId);
    if (selection && restored instanceof HTMLInputElement) restored.setSelectionRange(selection[0], selection[1]);
    return;
  }
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
  const localEvidence = `<section class="local-expansion ${mode === "microscope" ? "with-scalar" : ""}" data-owner="${selectedStageOwner()}"><div class="local-source-summary"><section class="local-operation" data-scroll-region="local-operation"><h2>${escapeHtml(stage?.[1] ?? selectedKind)} · position ${selectedToken}</h2><p>${escapeHtml(stage?.[2] ?? "Selected recorded evidence")}</p><div data-testid="vector-evidence">${stageEvidence()}</div>${sourceView(selectedKind)}</section><section class="local-prediction" data-scroll-region="local-probability"><h2>Selected position ${selectedToken} · probabilities</h2>${probabilityContextView(result, guidedLearning)}<div data-testid="probabilities">${probabilityView(values, config.vocabulary)}</div>${greedy === undefined ? "" : `<p>Greedy selection: <strong data-testid="greedy-token">${escapeHtml(tokenName(greedy, config.vocabulary))}</strong> · derived from the observed probabilities.</p>`}<button id="why-prediction">Why this prediction?</button></section></div>${mode === "microscope" ? `<section class="local-scalar" id="microscope" data-scroll-region="local-scalar"><h2>Microscope · source-connected scalar</h2><p>Scalar source model step ${sourceSnapshot(archive.runs.get(inspectionBinding?.sourceRunId ?? "")?.manifest.startingSnapshotId ?? "")?.state.optimizer.step ?? "unavailable"}</p><div data-testid="microscope-evidence">${microscopeView(inspection, inspectionPath, inspectionLabel, inspectionPending, inspectionWhole, inspectionRelationship(), inspectionBinding, microscopeWindows)}</div></section>` : ""}</section>`;
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
            microscopeWindows,
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

// Stable callbacks do not retain a render frame (including its previously focused DOM).
function spatialSelectionChanged(){if(forwardDriver.active){forwardDriver.follow=false;const previous=forwardDriver.pin;syncTrainingPin();if(previous!==forwardDriver.pin)void forwardDriver.inspectPin(forwardDriver.pin).catch(()=>{});}syncSpatialSelection();clearDisplayedInspection();}
function selectExplanationPhase(phase:string){
  const m=spatialLearningModel();
  if(m.available){const id=phase==='after'?m.experiment.afterRunId:m.experiment.trainingRunId;if(result?.run.manifest.runId!==id)selectRun(id);}
}
function spatialLearningModel() {
  const experiment = archive.learningExperiments.get(spatialExperimentId) ??
    (result?.experiment?.id === spatialExperimentId ? result.experiment : undefined);
  const run = (id?: string) => archive.runs.get(id ?? "") ?? result?.runs.find(r => r.manifest.runId === id);
  const start = sourceSnapshot(experiment?.startingSnapshotId ?? "");
  const parameter = resolveParameter(start, spatialPresenter.pin);
  const evidence = experiment && parameter ? cachedInspection(experiment.trainingRunId, {kind:"gradient",parameterIndex:parameter.index}) : undefined;
  return learningReadModel(experiment,start,sourceSnapshot(experiment?.resultingSnapshotId ?? ""),run(experiment?.beforeRunId),run(experiment?.trainingRunId),run(experiment?.afterRunId),spatialPresenter.pin,evidence,spatialPresenter.expanded?Number.MAX_SAFE_INTEGER:3,inspectionPending);
}
async function inspectSpatialGradient(child?: number) {
  const m = spatialLearningModel(); if (!m.available || busy) return;
  const epoch = operation, generation=spatialPresenter.playback.generation, experiment = spatialExperimentId, parameter = m.parameter.index;
  if (result?.run.manifest.runId !== m.experiment.trainingRunId) selectRun(m.experiment.trainingRunId);
  selectedParameter = parameter;
  await inspect(m.experiment.trainingRunId,{kind:"gradient",parameterIndex:parameter},`${m.pin.name}[${m.pin.row},${m.pin.column}] · objective gradient`);
  if (child !== undefined && generation===spatialPresenter.playback.generation && operation === epoch && spatialExperimentId === experiment && selectedParameter === parameter && result?.run.manifest.runId === m.experiment.trainingRunId)
    await inspect(m.experiment.trainingRunId,{kind:"node",nodeId:child},"Captured contribution child",[child]);
}
function bindSpatialLearning() {
  mount.querySelector('#cancel-ablation')?.addEventListener('click',()=>{if(activeIntervention===undefined)return;++operation;activeIntervention=undefined;inspector.cancel();cancelRetention(activeRetentionTransaction);activeRetentionTransaction=undefined;busy=false;clearDisplayedInspection();status='Intervention cancelled · accepted model unchanged';render();focusCanonicalPredict();});
  mount.querySelector('#spatial-ablate')?.addEventListener('click',()=>{syncSpatialSelection();void ablateHead();});
  mount.querySelector('#spatial-patch')?.addEventListener('click',()=>{syncSpatialSelection();void patchHeadOutput();});
  const on = (id:string, action:()=>void) => mount.querySelector(id)?.addEventListener("click",action);
  on("#spatial-learn",()=>{if(result?.run.manifest.runId===liveRunId&&!busy&&ready&&sourceBinding(result.run,config.vocabulary,result.trainingStep,liveRunId,documentText,"LEARN").capturedDocument===documentText)void execute("train");});
  mount.querySelector("#spatial-experiment")?.addEventListener("change",event=>{
    spatialPresenter.invalidate();
    spatialExperimentId=(event.target as HTMLSelectElement).value;
    const m=spatialLearningModel();clearDisplayedInspection();
    if(m.available)selectRun(m.experiment.afterRunId);else render();
  });
  mount.querySelector("#spatial-experiment-prev")?.addEventListener("click",()=>{spatialExperimentOffset=previousWindowOffset(spatialExperimentOffset,PRESENTATION_WORK.spatialExperiments);render();});
  mount.querySelector("#spatial-experiment-next")?.addEventListener("click",()=>{spatialExperimentOffset=nextWindowOffset(spatialExperimentOffset,PRESENTATION_WORK.spatialExperiments,archive.learningExperiments.size);render();});
  mount.querySelectorAll<HTMLElement>("[data-learning-phase]").forEach(button=>button.addEventListener("click",()=>{
    spatialPresenter.invalidate();
    const m=spatialLearningModel();if(!m.available||busy)return;
    selectRun(button.dataset.learningPhase==="before"?m.experiment.beforeRunId:button.dataset.learningPhase==="training"?m.experiment.trainingRunId:m.experiment.afterRunId);
  }));
  on("#spatial-current",()=>{
    if(busy||forwardDriver.active||!liveRunId)return;
    spatialPresenter.learningStage=undefined;clearDisplayedInspection();
    spatialExperimentId=[...archive.learningExperiments.values()].find(e=>e.afterRunId===liveRunId)?.id??"";
    selectRun(liveRunId);focusCanonicalPredict();
  });
  mount.querySelectorAll<HTMLElement>("[data-learning-stage]").forEach(button=>{
    const action=()=>{spatialPresenter.focusLearning(button.dataset.learningStage as LearningStage);render();};
    button.addEventListener("click",action);
    if(button instanceof SVGElement)button.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();action();}});
  });
  mount.querySelectorAll("#learning-owner").forEach(button=>button.addEventListener("click",()=>{spatialPresenter.showOwner();syncSpatialSelection();clearDisplayedInspection();render();}));
  on("#learning-inspect-gradient",()=>void inspectSpatialGradient());
  on("#learning-expand",()=>{spatialPresenter.expanded=!spatialPresenter.expanded;render();});
  mount.querySelectorAll<HTMLElement>("[data-learning-edge]").forEach(button=>button.addEventListener("click",()=>void inspectSpatialGradient(Number(button.dataset.learningEdge))));
  const lossScalar=(position?:number)=>{
    const m=spatialLearningModel();if(!m.available||busy)return;
    const artifact=m.training.artifacts.find(a=>a.kind===(position===undefined?"meanLoss":"loss")&&(position===undefined||a.concept.token===position));
    if(!artifact)return;
    if(result?.run.manifest.runId!==m.experiment.trainingRunId)selectRun(m.experiment.trainingRunId);
    void inspect(m.experiment.trainingRunId,{kind:"artifact",artifactId:artifact.id,index:0},position===undefined?"All-position mean objective":`Target loss at position ${position}`);
  };
  on("#learning-mean-scalar",()=>lossScalar());
  mount.querySelectorAll<HTMLElement>("[data-learning-loss]").forEach(button=>button.addEventListener("click",()=>lossScalar(Number(button.dataset.learningLoss))));
}

function syncSpatialSelection(): void {
  selectedToken = spatialPresenter.address().token;
  head = spatialSelection.head;
  key = spatialSelection.key;
  selectedProductFeature = spatialSelection.feature;
  selectedKind = spatialPresenter.kind;
  const parameter = resolveParameter(sourceSnapshot(result?.run.manifest.startingSnapshotId ?? ""), spatialPresenter.pin);
  if (parameter) selectedParameter = parameter.index;
}
function bind(): void {
  const profile = currentProfile();
  const capabilities = currentCapabilities();
  sharedInspector.sync(archive.evidence,result?.run.manifest.runId,!busy&&!forwardDriver.active,async()=>execute('predict'),(runId,replay)=>{spatialEvidenceRunId=runId;spatialEvidenceReplay=replay;clearWorldSelection();attract=false;clearDisplayedInspection();spatialPresenter.invalidate();render();},runId=>spatialEvidenceUnavailable(archive.evidence.get(runId)),{
    begin:async operation=>{const transaction=await beginRetention(operation);return {store:transaction.archive.evidence,
      commit:async()=>{await commitRetention(transaction);},cancel:()=>cancelRetention(transaction)};},
  }, capabilities.sharedInspector);
  let portableHost=document.querySelector<HTMLElement>('#portable-archive-host');
  if(spatialActive&&capabilities.portableArchive){if(!portableHost){portableHost=document.createElement('section');portableHost.id='portable-archive-host';document.body.append(portableHost);}portableHost.innerHTML=portableArchiveControls();}
  else portableHost?.remove();
  const selectedVariant=[...archive.modelVariantExperiments.values()].filter(isActivationVariantExperiment).find(experiment=>[experiment.baselineRun.manifest.runId,experiment.variantRun.manifest.runId].includes(result?.run.manifest.runId??''));
  const selectedComposite=[...archive.modelVariantExperiments.values()].filter(isCompositeVariantExperiment).find(experiment=>[experiment.baselineRun.manifest.runId,experiment.initializedRun.manifest.runId,experiment.trainedRun.manifest.runId].includes(result?.run.manifest.runId??''));
  const selectedDataExperiment=activeDataExperimentId?archive.dataExperiments.get(activeDataExperimentId):undefined;
  if(capabilities.researchVariants&&!attract&&result&&!selectedVariant&&!selectedComposite&&!selectedDataExperiment&&result.run.manifest.model.id==='microgpt'){
    const button=document.createElement('button');button.id='open-activation-variant';button.textContent='Open Leaky ReLU variant';button.disabled=busy||forwardDriver.active;
    const compositeButton=document.createElement('button');compositeButton.id='open-composite-variant';compositeButton.textContent='Train composite A/B variant';compositeButton.disabled=busy||forwardDriver.active;
    const dataButton=document.createElement('button');dataButton.id='open-data-experiment';dataButton.textContent='Run matched data experiment';dataButton.disabled=busy||forwardDriver.active;
    (mount.querySelector('.spatial-header')??mount.querySelector('.source-toolbar')??mount).append(button,compositeButton,dataButton);
    button.addEventListener('click',()=>void openActivationVariant());
    compositeButton.addEventListener('click',()=>void openCompositeVariant());
    dataButton.addEventListener('click',()=>void openDataExperiment());
  } else if(!capabilities.researchVariants){
    document.querySelector('#open-activation-variant')?.remove();
    document.querySelector('#open-composite-variant')?.remove();
    document.querySelector('#open-data-experiment')?.remove();
  }
  if(selectedDataExperiment){
    const e=selectedDataExperiment,substitution=e.design.substitutions[0],step=substitution?.step??0;
    const clean=e.arms.clean.steps[step]!,treatment=e.arms.treatment.steps[step]!,defended=e.arms.defended.steps[step]!;
    const probabilityRows=[e.evaluations.triggered,...e.evaluations.controls].map(item=>`<tr><th>${escapeHtml(item.kind==='triggered'?'Triggered · '+item.input:'Control · '+item.input)}</th><td>${item.arms.clean.probability}</td><td>${item.arms.treatment.probability}</td><td>${item.arms.defended.probability}</td></tr>`).join('');
    const lineageRows=(['clean','treatment','defended'] as const).flatMap(arm=>e.arms[arm].steps.map(item=>`<tr><th>${arm} · ${item.step}</th><td>${escapeHtml(item.proposedDocument)} → ${escapeHtml(item.effectiveDocument)}</td><td><button data-data-model-run="${escapeHtml(item.trainingRunId)}">${escapeHtml(item.trainingRunId)}</button><br><code>${escapeHtml(item.startSnapshotId)}</code> → <code>${escapeHtml(item.endSnapshotId)}</code></td><td><code>${escapeHtml(item.policyRecordId)}</code></td></tr>`)).join('');
    const container=document.createElement('section');container.className='intervention-banner data-experiment-receipt';container.dataset.testid='data-experiment-receipt';
    container.innerHTML=`<strong>REGISTERED DATA EXPERIMENT · ${escapeHtml(e.recipe.id)}@${e.recipe.version}</strong><p>Common complete start <code>${escapeHtml(e.source.snapshotId)}</code> · ${e.design.cleanSchedule.length} ordered updates per arm · <strong>${e.matching.policy.id}@${e.matching.policy.version} ${e.matching.compatible?'PASS':'REFUSED'}</strong>.</p><div class="data-arm-grid"><article data-testid="data-step-clean"><h3>Clean</h3><p>proposed <code>${escapeHtml(clean.proposedDocument)}</code><br>effective <code>${escapeHtml(clean.effectiveDocument)}</code><br>${escapeHtml(clean.decision)}</p></article><article data-testid="data-step-treatment"><h3>Treatment · undefended</h3><p>proposed <code>${escapeHtml(treatment.proposedDocument)}</code><br>effective <code>${escapeHtml(treatment.effectiveDocument)}</code><br>${escapeHtml(treatment.decision)} · ${escapeHtml(substitution?.id??'')}</p></article><article data-testid="data-step-defended"><h3>Defended</h3><p>proposed <code>${escapeHtml(defended.proposedDocument)}</code><br>allowlist expected <code>${escapeHtml(defended.expectedDocument)}</code><br>effective <code>${escapeHtml(defended.effectiveDocument)}</code> · ${escapeHtml(defended.decision)}</p></article></div><div class="data-evidence-split"><article><h3>MODEL EVIDENCE</h3><p>Training runs, complete snapshots, observed probabilities and losses. The model consumed only each effective document.</p><table><thead><tr><th>Evaluation</th><th>Clean</th><th>Treatment</th><th>Defended</th></tr></thead><tbody>${probabilityRows}<tr><th>Mean clean-task loss</th><td>${e.metrics.observed.cleanTaskMeanLoss.clean}</td><td>${e.metrics.observed.cleanTaskMeanLoss.treatment}</td><td>${e.metrics.observed.cleanTaskMeanLoss.defended}</td></tr></tbody></table><p>Derived triggered deltas · treatment − clean ${e.metrics.derived.triggeredTreatmentMinusClean} · defended − clean ${e.metrics.derived.triggeredDefendedMinusClean} · defended − treatment ${e.metrics.derived.triggeredDefendedMinusTreatment}. No categorical efficacy threshold is declared.</p></article><article data-testid="external-policy-context"><h3>EXTERNAL CONTEXT</h3><p><strong>${escapeHtml(e.design.defensePolicy.id)}@${e.design.defensePolicy.version}</strong> records proposed, expected, effective and decision fields outside neural execution. Explicit identity links correlate each decision to one learning experiment and training run; correlation is not causation.</p><p>Substitution-step links:<br>clean <code>${escapeHtml(clean.policyRecordId)}</code> ↔ <code>${escapeHtml(clean.trainingRunId)}</code><br>treatment <code>${escapeHtml(treatment.policyRecordId)}</code> ↔ <code>${escapeHtml(treatment.trainingRunId)}</code><br>defended <code>${escapeHtml(defended.policyRecordId)}</code> ↔ <code>${escapeHtml(defended.trainingRunId)}</code></p></article></div><details data-testid="data-lineage"><summary>All step lineage · proposed → policy → effective → model evidence</summary><table><thead><tr><th>Arm / step</th><th>Data decision</th><th>Model run and snapshots</th><th>External record</th></tr></thead><tbody>${lineageRows}</tbody></table></details><p>Receipt <code>${escapeHtml(e.receiptId)}</code> · clean final <code>${escapeHtml(e.arms.clean.finalSnapshotId)}</code> · treatment final <code>${escapeHtml(e.arms.treatment.finalSnapshotId)}</code> · defended final <code>${escapeHtml(e.arms.defended.finalSnapshotId)}</code>.</p><button id="data-current">Return to accepted canonical model</button>`;
    const anchor=mount.querySelector('.spatial-status')??mount.querySelector('.source-toolbar')??mount.firstElementChild;anchor?.insertAdjacentElement('afterend',container);
    container.querySelectorAll<HTMLButtonElement>('[data-data-model-run]').forEach(button=>button.addEventListener('click',()=>{selectRun(button.dataset.dataModelRun!);status='Inspecting retained model evidence correlated from an external policy record';render();}));
    container.querySelector('#data-current')?.addEventListener('click',()=>{activeDataExperimentId='';if(liveRunId)selectRun(liveRunId);status='Returned to accepted canonical model · data experiment retained read-only';render();focusCanonicalPredict();});
  }
  if(selectedComposite){
    const w=selectedComposite.witness,container=document.createElement('section');container.className='intervention-banner';container.dataset.testid='composite-variant-receipt';
    container.innerHTML=`<strong>COMPOSITE MODEL VARIANT · ${escapeHtml(selectedComposite.targetDefinition.id)}@${escapeHtml(selectedComposite.targetDefinition.version)}</strong><p>Base checkpoint <code>${escapeHtml(selectedComposite.source.checkpointId)}</code> · rank ${selectedComposite.declaration.bottleneckWidth} · fixed s ${selectedComposite.declaration.scale}. Inherited parameters, including W, are frozen; only <code>${selectedComposite.declaration.trainableParameterOrder.map(escapeHtml).join('</code>, <code>')}</code> are optimizer members.</p><p>Identity initialization <strong>exact</strong>: B = 0, adapter = 0, composite = W x, downstream = canonical. Trained state <code>${escapeHtml(selectedComposite.trainedState.id)}</code> · Adam step ${selectedComposite.trainedState.state.optimizer.step} · exact save/resume <strong>${w.resume.exactStateEquality&&w.resume.exactPredictionEquality?'PASS':'FAIL'}</strong>.</p><p data-testid="composite-arithmetic">Output ${w.output}: ${w.arithmetic.base} + ${w.arithmetic.scale} × ${w.arithmetic.bax} = ${w.arithmetic.composite}. B update Δ ${w.backward.bUpdate.delta}; later A update Δ ${w.backward.aUpdate.delta}.</p><p>Comparison <strong>${selectedComposite.trainedComparison.policy.id}@${selectedComposite.trainedComparison.policy.version}</strong> · <code>mlpDown/output ↔ mlpCompositeDown/output</code> · variant-only A/B/scaled internals.</p><button id="composite-current">Return to accepted canonical model</button>`;
    const anchor=mount.querySelector('.spatial-status')??mount.querySelector('.source-toolbar')??mount.firstElementChild;anchor?.insertAdjacentElement('afterend',container);
    container.querySelector('#composite-current')?.addEventListener('click',()=>{if(liveRunId)selectRun(liveRunId);spatialPresenter.kind='mlpRelu';spatialPresenter.parameter=undefined;status='Returned to accepted canonical model · composite evidence retained read-only';render();focusCanonicalPredict();});
  }
  if(selectedVariant){
    const w=selectedVariant.witness,container=document.createElement('section');container.className='intervention-banner';container.dataset.testid='variant-receipt';
    container.innerHTML=`<strong>MODEL DEFINITION VARIANT · ${escapeHtml(selectedVariant.targetDefinition.id)}@${escapeHtml(selectedVariant.targetDefinition.version)}</strong><p>Canonical checkpoint <code>${escapeHtml(selectedVariant.source.checkpointId)}</code> → explicit initialization <code>${escapeHtml(selectedVariant.initialization.id)}</code>. Parameter initialization only; no exact training-resume claim.</p><p>Leaky ReLU slope ${w.negative.localDerivative}; zero derivative convention ${selectedVariant.declaration.zeroDerivative}. Positive witness ${w.positive.input} → ${w.positive.variant}. Negative witness ${w.negative.input} → ${w.negative.variant}; canonical ${w.negative.canonical}. Real backward contribution ${w.negative.contribution}.</p><p>Comparison <strong>${selectedVariant.comparison.policy.id}@${selectedVariant.comparison.policy.version}</strong> · explicit <code>mlpRelu/output ↔ mlpLeakyRelu/output</code>.</p><button id="variant-current">Return to accepted canonical model</button>`;
    const anchor=mount.querySelector('.spatial-status')??mount.querySelector('.source-toolbar')??mount.firstElementChild;anchor?.insertAdjacentElement('afterend',container);
    container.querySelector('#variant-current')?.addEventListener('click',()=>{if(liveRunId)selectRun(liveRunId);spatialPresenter.kind='mlpRelu';status='Returned to accepted canonical model · variant evidence retained read-only';render();focusCanonicalPredict();});
  }
  if (!attract) {
    if (!spatialActive && capabilities.classicToggle) {
      const entry = '<button id="presentation-toggle" class="classic-toggle">Spatial presentation · controlled learning</button>';
      const header = mount.querySelector('.instrument-header');
      if (header) header.insertAdjacentHTML('beforeend', entry);
      else mount.insertAdjacentHTML('afterbegin', entry);
    }
    mount.querySelector("#presentation-toggle")?.addEventListener("click", async () => {
      if (forwardDriver.active) await cancelForward();
      spatialPresenter.invalidate();
      spatialActive = !spatialActive;
      if (spatialActive) {
        attract = false;
        spatialExperimentId = result?.experiment?.id ?? "";
        if (!result?.experiment) spatialPresenter.learningStage = undefined;
        syncSpatialSelection();
      }
      else { spatialPresenter.camera.detach(); mode = "explore"; }
      attentionLens = false;
      clearDisplayedInspection();
      render();
    });
  }
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
    ?.addEventListener("input", async (event) => {
      const edited = (event.target as HTMLInputElement).value;
      if (forwardDriver.active) await cancelForward();
      spatialPresenter.invalidate();
      documentText = edited;
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
    .querySelector("#clear-session")
    ?.addEventListener("click", () => void reset(false, true));
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
            `${spatialActive ? result.run.artifacts.find(a => a.id === button.dataset.artifact)?.kind ?? selectedKind : selectedKind} · position ${selectedToken} · element ${button.dataset.element}`,
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
      comparisonRowOffset = 0;
      render();
    });
  document.querySelector("#history-run-open")?.addEventListener("click",()=>{
    const id=document.querySelector<HTMLInputElement>("#history-run-id")?.value??"";
    if(archive.runs.has(id))selectRun(id);else{error="No retained run has that exact ID.";render();}
  });
  document.querySelector("#snapshot-open")?.addEventListener("click",()=>{
    const id=document.querySelector<HTMLInputElement>("#snapshot-id")?.value??"";
    if(!id||archive.snapshots.has(id)){selectedSnapshotId=id;const index=[...archive.snapshots.keys()].indexOf(id);if(index>=0)snapshotOffset=Math.floor(index/PRESENTATION_WORK.historySnapshots)*PRESENTATION_WORK.historySnapshots;render();}else{error="No retained snapshot has that exact ID.";render();}
  });
  document.querySelectorAll<HTMLElement>("[data-history-page]").forEach(control=>control.addEventListener("click",()=>{
    const [kind,direction]=control.dataset.historyPage!.split(":") as ["runs"|"snapshots"|"compare"|"comparison-rows","previous"|"next"];
    const previous=direction==="previous";
    if(kind==="runs")historyRunOffset=previous?previousWindowOffset(historyRunOffset,PRESENTATION_WORK.historyRuns):nextWindowOffset(historyRunOffset,PRESENTATION_WORK.historyRuns,archive.runs.size);
    else if(kind==="snapshots")snapshotOffset=previous?previousWindowOffset(snapshotOffset,PRESENTATION_WORK.historySnapshots):nextWindowOffset(snapshotOffset,PRESENTATION_WORK.historySnapshots,archive.snapshots.size);
    else if(kind==="compare")comparisonRunOffset=previous?previousWindowOffset(comparisonRunOffset,PRESENTATION_WORK.historyRuns):nextWindowOffset(comparisonRunOffset,PRESENTATION_WORK.historyRuns,archive.runs.size);
    else {const total=historyComparisonReadModel(player!.recordedRun,archive.runs.get(comparisonRunId)!,selectedArtifact(selectedKind)?.id).deltas?.length??0;comparisonRowOffset=previous?previousWindowOffset(comparisonRowOffset,PRESENTATION_WORK.comparisonRows):nextWindowOffset(comparisonRowOffset,PRESENTATION_WORK.comparisonRows,total);}
    render();queueMicrotask(()=>document.querySelector<HTMLElement>(`[data-history-page="${kind}:${direction}"]`)?.focus({preventScroll:true}));
  }));
  document.querySelectorAll<HTMLElement>("[data-microscope-page]").forEach(control=>control.addEventListener("click",()=>{
    const [kind,direction]=control.dataset.microscopePage!.split(":") as [keyof typeof microscopeWindows,"previous"|"next"],graph=inspection?.graph,node=graph?.nodes.find(candidate=>candidate.id===(inspectionPath.at(-1)??graph.roots[0]));
    if(!graph||!node)return;const total=kind==="operands"?graph.edges.filter(edge=>edge.child===node.id).length:kind==="consumers"?graph.edges.filter(edge=>edge.parent===node.id).length:graph.structural.length,limit=kind==="operands"?PRESENTATION_WORK.scalarOperands:kind==="consumers"?PRESENTATION_WORK.scalarEdges:PRESENTATION_WORK.structuralEvents;
    microscopeWindows={...microscopeWindows,[kind]:direction==="previous"?previousWindowOffset(microscopeWindows[kind],limit):nextWindowOffset(microscopeWindows[kind],limit,total)};render();queueMicrotask(()=>document.querySelector<HTMLElement>(`[data-microscope-page="${kind}:${direction}"]`)?.focus({preventScroll:true}));
  }));
  document.querySelector("#export-archive")?.addEventListener("click", () => void exportSessionArchive());
  document.querySelector<HTMLInputElement>("#import-archive")?.addEventListener("change", (event) => void importSessionArchive(event));
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
    idleResetEnabled = kioskEnabled;
    exhibitEntry = kioskEnabled;
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
  document.querySelector("#patch-head")?.addEventListener("click", () => {
    void patchHeadOutput();
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
  microscopeWindows = { operands: 0, consumers: 0, structural: 0 };
  pendingInspectionCacheReservation?.cancel(); pendingInspectionCacheReservation = undefined;
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
  trainingSummaryTotal++;
  if (trainingSummaries.length >= TRAINING_SUMMARY_LIMIT) { trainingSummaries.shift(); trainingSummaryDiscarded++; }
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
  completedForward?: RunResult,
  suppliedTransaction?: RetentionTransaction,
): Promise<CanonicalReceipt> {
  if (busy || !ready || forwardDriver.active) return {status:'refused',reason:'Canonical execution unavailable while another operation is active'};
  spatialPresenter.invalidate();
  if (!/^[abc]{0,7}$/.test(documentText)) {
    error = "Use up to seven characters from a, b, and c.";
    render();
    return {status:'refused',reason:error};
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
    return {status:'refused',reason:'Guided request no longer matches the live input'};
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
  let acceptedThisIteration: RunResult | undefined;
  let retentionFailed = false;
  let completedRunId: string | undefined;
  let failureReason: string | undefined;
  try {
    for (let step = 0; step < count; step++) {
      let transaction: RetentionTransaction;
      try { transaction = step === 0 && suppliedTransaction ? suppliedTransaction : await beginRetention('canonical'); }
      catch (failure) {
        status = step > 0 ? `Batch stopped before update ${step + 1} · retention capacity insufficient · ${step} completed updates retained` : 'Retention capacity refused · no execution started';
        error = failure instanceof Error ? failure.message : String(failure); failureReason = status; break;
      }
      activeRetentionTransaction = transaction;
      acceptedThisIteration = undefined;
      pendingModelCommand = command;
      const response = completedForward ? { status: "result" as const, result: completedForward } : await client.request({
        command, document: executionDocument,
      });
      if (currentOperation !== operation) {
        cancelRetention(transaction);
        return {status:'refused',reason:'Canonical execution was superseded'};
      }
      if (response.status !== "result")
        throw new Error("Worker did not return model evidence");
      pendingModelCommand = undefined;
      const incoming = response.result;
      lastAcceptedResult = incoming;
      acceptedThisIteration = incoming;
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
      if (spatialActive) {
        spatialExperimentId = incoming.experiment?.id ?? "";
        if (incoming.experiment) spatialPresenter.openLearning("objective");
        else spatialPresenter.learningStage = undefined;
      }
      player = new TracePlayer(result.run);
      liveRunId = result.run.manifest.runId;
      liveTrainingStep = result.trainingStep;
      selectedToken = attentionOpen
        ? lessonPosition(result)
        : result.tokenIds.length - 1;
      if (attentionOpen) attentionScopeQuery = selectedToken;
      key = Math.min(key, selectedToken);
      if (spatialActive) syncSpatialSelection();
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
        true;
      recordTrainingSummary(incoming);
      if (currentOperation !== operation) return {status:'refused',reason:'Canonical execution was superseded'};
      render();
      if (retain) {
        const destination = transaction.archive;
        for (const snapshot of incoming.snapshots) await destination.addSnapshot(snapshot);
        for (const run of incoming.runs) await destination.addRun(run);
        if (incoming.experiment) await destination.addLearningExperiment(incoming.experiment);
        if (currentOperation !== operation) { cancelRetention(transaction); return {status:'refused',reason:'Canonical execution was superseded'}; }
        await commitRetention(transaction); activeRetentionTransaction = undefined;
        completedRunId = incoming.run.manifest.runId;
      }
    }
  } catch (failure) {
    if (currentOperation !== operation) return {status:'refused',reason:'Canonical execution was superseded'};
    error = failure instanceof Error ? failure.message : String(failure);
    failureReason = error;
    retentionFailed = !!acceptedThisIteration;
    status = retentionFailed ? "Accepted update · local evidence retention failed" : "Run failed";
  } finally {
    if (currentOperation === operation) {
      // The disposable local worker has already acknowledged and published this
      // state. Retry only immutable evidence admission under the reservation that
      // preceded execution; never describe retention failure as model rollback.
      if (retentionFailed && acceptedThisIteration && activeRetentionTransaction) {
        try {
          const destination = activeRetentionTransaction.archive;
          for (const snapshot of acceptedThisIteration.snapshots) await destination.addSnapshot(snapshot);
          for (const run of acceptedThisIteration.runs) await destination.addRun(run);
          if (acceptedThisIteration.experiment) await destination.addLearningExperiment(acceptedThisIteration.experiment);
          await commitRetention(activeRetentionTransaction);
          activeRetentionTransaction = undefined;
          completedRunId = acceptedThisIteration.run.manifest.runId;
          failureReason = undefined;
          status = "Accepted update · evidence retained after retry";
        } catch (retentionFailure) {
          error = `${error} · Completed result retention failed: ${retentionFailure instanceof Error ? retentionFailure.message : String(retentionFailure)}`;
        }
      }
      cancelRetention(activeRetentionTransaction); activeRetentionTransaction = undefined;
      pendingModelCommand = undefined;
      if (guidedBatch?.status === "RUNNING") guidedBatch.status = "STOPPED";
      busy = false;
      render();
      void loadDetail();
    }
  }
  if (failureReason) return {status:'failed',reason:failureReason};
  if (completedRunId && currentOperation === operation) return {status:'completed',runId:completedRunId};
  return {status:'refused',reason:'Canonical execution produced no new retained receipt'};
}

async function reset(cancelled: boolean, clear = false): Promise<void> {
  activeIntervention=undefined;
  cancelRetention(activeRetentionTransaction); activeRetentionTransaction = undefined;
  discardForward();
  spatialPresenter.invalidate();
  if (cancelled && !busy && inspectionPending) {
    ++inspectionOperation;
    inspector.cancel();
    inspectionPending = false;
    status = "Cancelled inspection · model and history preserved";
    render();
    return;
  }
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
    spatialEvidenceRunId = ""; spatialEvidenceReplay = false; clearWorldSelection();
    spatialExperimentId = ""; activeDataExperimentId = ""; spatialPresenter.resetVisitor();
    spatialExperimentOffset = 0;
    beforeForward = undefined; beforeForwardLocation = undefined; beforeForwardExperiment = "";
    inspectedExecutionRevision = undefined; readyComparison = true; clearDisplayedInspection();
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
    retentionStatus = await retention.replace(archive);
    importedArchiveId = "";
    portableArchiveMessage = "";
    trainingSummaries.length = 0;
    trainingSummaryTotal = 0; trainingSummaryDiscarded = 0;
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
    historyRunOffset = 0;
    snapshotOffset = 0;
    comparisonRunOffset = 0;
    comparisonRowOffset = 0;
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
    retentionStatus = await retention.synchronize();
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
    const restoredResult = acceptedAtCancellation;
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
      const destination = archive;
      for (const snapshot of result.snapshots)
        await destination.addSnapshot(snapshot);
      for (const run of result.runs) await destination.addRun(run);
      if (result.experiment)
        await destination.addLearningExperiment(result.experiment);
      if (currentOperation !== operation) return;
      retentionStatus = await retention.synchronize();
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
    retentionStatus = await retention.synchronize();
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
  attract = !spatialActive || exhibitEntry;
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
  if (exhibitEntry && spatialActive) {
    spatialPresenter.startVisitorSample();
    render();
  }
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

async function exportSessionArchive(): Promise<void> {
  if (busy || forwardDriver.active || exhibitEntry) return;
  busy = true; error = ""; status = "Serializing retained historical archive…"; render();
  try {
    const exported = await exportPortableArchive(archive);
    const blobBytes = new Uint8Array(exported.bytes.length); blobBytes.set(exported.bytes);
    const blob = new Blob([blobBytes], { type: "application/vnd.model-lab.archive" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = `model-lab-${exported.archiveId.slice(7, 23)}${PORTABLE_ARCHIVE_EXTENSION}`;
    link.click(); queueMicrotask(() => URL.revokeObjectURL(url));
    status = `Portable archive exported · ${exported.archiveId} · ${exported.payloadCount} unique payloads · no execution`;
    portableArchiveMessage = status;
  } catch (failure) {
    error = (failure instanceof Error ? failure.message : String(failure)).slice(0, 240);
    status = "Archive export failed · history unchanged";
    portableArchiveMessage = `${status}: ${error}`;
  } finally { busy = false; render(); queueMicrotask(() => document.querySelector<HTMLButtonElement>("#export-archive")?.focus()); }
}

async function importSessionArchive(event: Event): Promise<void> {
  if (busy || forwardDriver.active || exhibitEntry) return;
  const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
  if (file.size > PORTABLE_ARCHIVE_LIMITS.archiveBytes) { error = "Archive exceeds the 32 MiB import limit."; status = "Archive import refused · history unchanged"; portableArchiveMessage = `${status}: ${error}`; render(); queueMicrotask(() => document.querySelector<HTMLInputElement>("#import-archive")?.focus()); return; }
  busy = true; error = ""; status = "Validating portable archive in isolated staging…"; render();
  try {
    const imported = await importPortableArchive(new Uint8Array(await file.arrayBuffer()));
    retentionStatus = await retention.replace(imported.archive); archive = retention.archive; importedArchiveId = imported.archiveId;
    selectedSnapshotId = ""; comparisonRunId = ""; learningExperimentId = ""; spatialExperimentId = ""; activeDataExperimentId = ""; spatialExperimentOffset = 0;
    historyRunOffset=0;snapshotOffset=0;comparisonRunOffset=0;comparisonRowOffset=0;
    inspectionCache.clear(); trainingSummaries.length=0;trainingSummaryTotal=0;trainingSummaryDiscarded=0;clearDisplayedInspection();
    status = `Retained historical archive opened · ${imported.archiveId} · live accepted model unchanged · no executor or network request`;
    portableArchiveMessage = status;
  } catch (failure) {
    error = (failure instanceof Error ? failure.message : String(failure)).slice(0, 240);
    status = "Archive import refused · existing history and accepted model unchanged";
    portableArchiveMessage = `${status}: ${error}`;
  } finally { busy = false; render(); queueMicrotask(() => document.querySelector<HTMLInputElement>("#import-archive")?.focus()); }
}

function portableArchiveControls():string {
  return `<details data-testid="portable-archive-controls" ${portableArchiveMessage ? "open" : ""}><summary>Portable historical archive</summary><p>Export/import preserves validated evidence and payloads only. Import replaces this historical view after complete validation; it does not restore or adopt a model state.</p><div class="controls"><button id="export-archive" ${busy || forwardDriver.active ? "disabled" : ""}>Export archive</button><label>Import one local archive<input id="import-archive" type="file" accept="${PORTABLE_ARCHIVE_EXTENSION}" ${busy || forwardDriver.active ? "disabled" : ""}></label></div>${portableArchiveMessage ? `<p role="status" data-testid="portable-archive-status">${escapeHtml(portableArchiveMessage)}</p>` : ""}${importedArchiveId ? `<p data-testid="imported-archive-status">Retained historical archive · ${escapeHtml(importedArchiveId)} · live accepted model unchanged</p>` : ""}</details>`;
}

function renderHistory(): string {
  const runs = [...archive.runs.values()];
  if (result && !archive.runs.has(result.run.manifest.runId))
    runs.push(result.run);
  const selectedRunId=result?.run.manifest.runId??"";
  const runWindow=presentationWindow(runs,historyRunOffset,PRESENTATION_WORK.historyRuns);
  historyRunOffset=runWindow.offset;
  const windowItems=(window:typeof runWindow,selected:string)=>{const current=runs.find(run=>run.manifest.runId===selected);return current&&!window.items.includes(current)?[current,...window.items.slice(0,PRESENTATION_WORK.historyRuns-1)]:window.items;};
  const options = (items:readonly RecordedRun[],selected: string) =>
    items
      .map(
        (run) =>
          `<option value="${escapeHtml(run.manifest.runId)}" ${run.manifest.runId === selected ? "selected" : ""}>${escapeHtml(runLabel(run))}</option>`,
      )
      .join("");
  const compareWindow=presentationWindow(runs,comparisonRunOffset,PRESENTATION_WORK.historyRuns);comparisonRunOffset=compareWindow.offset;
  const snapshots=[...archive.snapshots.values()],snapshotWindow=presentationWindow(snapshots,snapshotOffset,PRESENTATION_WORK.historySnapshots);snapshotOffset=snapshotWindow.offset;
  const selectedSnapshot=snapshots.find(snapshot=>snapshot.id===selectedSnapshotId),snapshotItems=selectedSnapshot&&!snapshotWindow.items.includes(selectedSnapshot)?[selectedSnapshot,...snapshotWindow.items.slice(0,PRESENTATION_WORK.historySnapshots-1)]:snapshotWindow.items;
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
  const retained=retentionStatus,cache=inspectionCache.status();
  const retentionText=retained?`Exact portable-v1 footprint ${(retained.retained.archiveBytes/1048576).toFixed(2)} MiB / ${(retained.hardLimitBytes/1048576).toFixed(0)} MiB · ${(retained.remainingBytes/1048576).toFixed(2)} MiB and ${retained.remainingManifestDataNodes.toLocaleString()} manifest nodes unreserved · ${retained.reservationCount} active reservation${retained.reservationCount===1?'':'s'} · new canonical evidence ${retained.remainingBytes>=RETENTION_RESERVATION_BYTES.canonical&&retained.remainingManifestDataNodes>=RETENTION_RESERVATION_BOUNDS.canonical.manifestDataNodes?'available':'blocked'}`:'Exact portable-v1 footprint synchronizing';
  return `<section class="source-block history"><h2>Explore exact runs and checkpoints</h2>${result ? `<details data-testid="runtime-provenance"><summary>Exact runtime provenance · available offline</summary><p>This selected run was recorded by Model Lab runtime <code data-testid="runtime-revision">${escapeHtml(result.run.manifest.runtimeRevision)}</code>. Historical inspection requires a compatible runtime.</p></details>` : ""}<p data-testid="history-count">${archive.runs.size} runs · ${archive.snapshots.size} snapshots · ${archive.learningExperiments.size} learning experiments retained in this session.</p><p data-testid="retention-status">${retentionText}. Historical records are not evicted.</p><p data-testid="ephemeral-cache-status">Derived inspection cache ${(cache.bytes/1048576).toFixed(2)} MiB / ${(cache.maxBytes/1048576).toFixed(0)} MiB · ${cache.entries} entries · ${cache.evictions} evictions · not portable evidence.</p>${!exhibitEntry ? portableArchiveControls() : ""}<div class="controls">
    <label>Recorded run<select id="history-run" ${busy ? "disabled" : ""}>${options(windowItems(runWindow,selectedRunId),selectedRunId)}</select></label><button data-history-page="runs:previous" ${runWindow.hasPrevious?'':'disabled'}>Previous recorded runs</button><button data-history-page="runs:next" ${runWindow.hasNext?'':'disabled'}>Next recorded runs</button><span data-testid="history-run-window">${windowSummary(runWindow)}</span><label>Exact run ID<input id="history-run-id" value="${escapeHtml(selectedRunId)}"></label><button id="history-run-open">Open exact run</button>
    <label>Reset destination<select id="snapshot-select"><option value="">Canonical initial model</option>${snapshotItems.map((snapshot) => `<option value="${snapshot.id}" ${snapshot.id === selectedSnapshotId ? "selected" : ""}>step ${snapshot.state.optimizer.step} · ${snapshot.id.slice(0, 23)}…</option>`).join("")}</select></label><button data-history-page="snapshots:previous" ${snapshotWindow.hasPrevious?'':'disabled'}>Previous snapshots</button><button data-history-page="snapshots:next" ${snapshotWindow.hasNext?'':'disabled'}>Next snapshots</button><span data-testid="snapshot-window">${windowSummary(snapshotWindow)}</span><label>Exact snapshot ID<input id="snapshot-id" value="${escapeHtml(selectedSnapshotId)}"></label><button id="snapshot-open">Select exact snapshot</button>
    <label>Compare from<select id="compare-run"><option value="">Choose an earlier run</option>${options(windowItems(compareWindow,comparisonRunId),comparisonRunId)}</select></label><button data-history-page="compare:previous" ${compareWindow.hasPrevious?'':'disabled'}>Previous comparison runs</button><button data-history-page="compare:next" ${compareWindow.hasNext?'':'disabled'}>Next comparison runs</button><span data-testid="comparison-run-window">${windowSummary(compareWindow)}</span></div>
    ${
      comparison
        ? `<div class="source-comparison" data-testid="run-comparison" data-selected-run="${escapeHtml(comparison.selectedRunId)}" data-comparison-run="${escapeHtml(comparison.comparisonRunId)}"><p>Selected run minus comparison run · ${escapeHtml(selectedKind)} · position ${selectedToken}</p><p>Selected: ${escapeHtml(comparison.selectedRunId)}<br>Reference: ${escapeHtml(comparison.comparisonRunId)}</p>${
            !comparison.compatible
              ? `<p>Incompatible evidence: ${escapeHtml(comparison.reason ?? "")}. No deltas calculated.</p>`
              : comparison.deltas && comparison.domain
                ? (()=>{const deltaWindow=presentationWindow(comparison.deltas,comparisonRowOffset,PRESENTATION_WORK.comparisonRows);comparisonRowOffset=deltaWindow.offset;return `<p>Shared domain [${comparison.domain.join(", ")}] · reference line / selected bar · deltas DERIVED · ${windowSummary(deltaWindow)} pairs</p><div class="controls"><button data-history-page="comparison-rows:previous" ${deltaWindow.hasPrevious?'':'disabled'}>Previous comparison rows</button><button data-history-page="comparison-rows:next" ${deltaWindow.hasNext?'':'disabled'}>Next comparison rows</button></div>${deltaWindow.items
                    .map((delta, index) => {
                      const [minimum, maximum] = comparison.domain!;
                      const zero = ((0 - minimum) / (maximum - minimum)) * 100;
                      const current =
                          ((comparison.selected![deltaWindow.offset+index]! - minimum) /
                            (maximum - minimum)) *
                          100,
                        reference =
                          ((comparison.comparison![deltaWindow.offset+index]! - minimum) /
                            (maximum - minimum)) *
                          100;
                      const actual=deltaWindow.offset+index;return `<div class="comparison-row"><span>${actual}</span><div class="comparison-track" data-domain="${comparison.domain!.join(",")}"><span class="comparison-zero" style="left:${zero}%"></span><span class="comparison-current" style="left:${Math.min(zero, current)}%;width:${Math.abs(current - zero)}%"></span><span class="comparison-reference" style="left:${reference}%"></span></div><span title="${comparison.comparison![actual]}">${number(comparison.comparison![actual], 4)}</span><span title="${comparison.selected![actual]}">${number(comparison.selected![actual], 4)}</span><span title="${delta}">Δ ${number(delta, 4)}</span></div>`;
                    })
                    .join(
                      "",
                    )}<p>The complete compatible comparison contains ${comparison.deltas.length} pairs; only this bounded page is materialized.</p>`;})()
                : `<p>${escapeHtml(comparison.reason ?? "Selected evidence is unavailable.")}</p>`
          }</div>`
        : ""
    }
    <details><summary>Experiment · head ablation</summary><p>Registered interventions run disposable matched arms from the selected run’s immutable starting snapshot. Head ablation zeros layer ${layer}, head ${head} at the existing writable boundary. Donor patch replaces position ${selectedToken}, layer ${layer}, head ${head} with an observed donor occurrence from another head/position. Live accepted state stays unchanged.</p><button id="ablate-head" ${busy || !result ? "disabled" : ""}>Compare selected head ablation</button><button id="patch-head" ${busy || !result ? "disabled" : ""}>Patch selected head output</button><p>${archive.interventionExperiments.size} registered intervention experiments archived. Select baseline, donor, or intervention runs to inspect observed values and matched-policy deltas. No outcome is labeled beneficial or harmful.</p></details><label class="kiosk-option"><input id="kiosk-mode" type="checkbox" ${exhibitEntry ? "checked" : ""}>Exhibit mode · reset after inactivity</label><div class="controls exhibit-timing"><label>Idle reset after (seconds)<input id="idle-seconds" type="number" min="30" max="3600" value="${exhibitConfiguration.resetAfterMs / 1000}"></label><label>Warning before reset (seconds)<input id="warning-seconds" type="number" min="5" max="120" value="${exhibitConfiguration.warningMs / 1000}"></label><p>Initial field-test timing. Settings are kept in this URL; visitor evidence is not persisted.</p></div><details><summary>Bounded learning and complete capture</summary><div class="controls"><label>Actual updates (1–500)<input id="training-count" type="number" min="1" max="500" value="${trainingCount}"></label><button id="train-many" ${busy || !ready ? "disabled" : ""}>Learn selected updates</button><button id="whole-capture" ${busy || !result ? "disabled" : ""}>Record everything · inspect statistics</button></div><p>Each update receives durable capacity before execution and retains its complete checkpoint/run/experiment evidence. A batch stops before the next update when its reservation cannot fit. The summary cache keeps only the latest ${TRAINING_SUMMARY_LIMIT}; evicting a summary never removes the underlying retained update.</p>${
      trainingSummaries.length
        ? `<p data-testid="training-summary">${trainingSummaryTotal} actual updates summarized · ${trainingSummaries.length} cached · ${trainingSummaryDiscarded} older summaries discarded · latest pre-update loss ${number(trainingSummaries.at(-1)!.loss)}</p><details><summary>Actual loss timeline</summary><p>Showing the latest ${trainingSummaries.length} cached update summaries. Older summary rows may be discarded; retained update evidence is unchanged.</p><div class="table-scroll"><table><thead><tr><th>Source training run / input</th><th>Source snapshot / step</th><th>Resulting step</th><th>Loss before update</th></tr></thead><tbody>${trainingSummaries
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
  const retainedIndex=[...archive.runs.keys()].indexOf(id);if(retainedIndex>=0)historyRunOffset=Math.floor(retainedIndex/PRESENTATION_WORK.historyRuns)*PRESENTATION_WORK.historyRuns;
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
  if (spatialActive) syncSpatialSelection();
  else { selectedToken = Math.min(selectedToken, tokenIds.length - 1); key = Math.min(key, selectedToken); }
  detail = undefined;
  status = `Viewing recorded ${runLabel(run)}`;
  render();
  if (!spatialActive) void loadDetail();
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
function activeInspectionSource(source: string) {
  const id = forwardDriver.progress?.executionId;
  return !!id && (source === id || source === `${id}:training` || source === `${id}:before`);
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
  const cacheKey = `${sourceRunId}:${JSON.stringify(target)}`;
  const cached = cachedInspection(sourceRunId, target);
  const needsCacheReservation = !cached && !activeInspectionSource(sourceRunId);
  const cacheReservation = needsCacheReservation ? inspectionCache.reserve(cacheKey) : undefined;
  if (needsCacheReservation && !cacheReservation) {
    clearDisplayedInspection();
    inspectionBinding = { ...binding, availability: "BUDGET EXCEEDED" };
    mode = "microscope";
    error = "Derived inspection cache budget exceeded. Historical evidence remains retained.";
    render();
    return;
  }
  pendingInspectionCacheReservation = cacheReservation;
  const executionRevision = forwardDriver.progress?.sequence;
  const guideGeneration=spatialPresenter.playback.generation;
  const current = ++inspectionOperation;
  mode = "microscope";
  inspectionPending = true;
  inspection = undefined;
  inspectionPath = [];
  inspectionLabel = label;
  inspectionWhole = target.kind === "whole";
  microscopeWindows = { operands: 0, consumers: 0, structural: 0 };
  render();
  mount.querySelector<HTMLElement>("#microscope")?.scrollTo({ top: 0 });
  try {
    let evidence = cached;
    if (!evidence) {
      const response = await client.request({
        command: "inspect",
        sourceRunId,
        target,
      });
      if (
        current !== inspectionOperation || executionRevision !== forwardDriver.progress?.sequence ||
        (spatialActive && guideGeneration!==spatialPresenter.playback.generation) ||
        inspectionBinding !== binding ||
        !inspectionIsCurrent(binding, inspectionSelection(), operation)
      )
        return;
      if (response.status !== "inspection")
        throw new Error("Worker did not return inspection evidence");
      evidence = response.inspection;
      if (evidence.availability === "not_captured" && !activeInspectionSource(sourceRunId)) {
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
        current !== inspectionOperation || executionRevision !== forwardDriver.progress?.sequence ||
        (spatialActive && guideGeneration!==spatialPresenter.playback.generation) ||
        inspectionBinding !== binding ||
        !inspectionIsCurrent(binding, inspectionSelection(), operation)
      )
        return;
      if (evidence.sourceRunId !== sourceRunId)
        throw new Error("Inspection belongs to a different run");
      if (
        !activeInspectionSource(sourceRunId) && evidence.availability === "available" &&
        (evidence.provenance !== "recomputed" ||
          evidence.verification?.verified)
      ) {
        if (!cacheReservation?.commit(immutableCopy(evidence))) {
          binding.availability = "BUDGET EXCEEDED";
          throw new Error('Derived inspection exceeds its bounded cache reservation');
        }
        if (pendingInspectionCacheReservation === cacheReservation) pendingInspectionCacheReservation = undefined;
      }
    }
    if (
      current !== inspectionOperation || executionRevision !== forwardDriver.progress?.sequence ||
        (spatialActive && guideGeneration!==spatialPresenter.playback.generation) ||
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
      current !== inspectionOperation || executionRevision !== forwardDriver.progress?.sequence ||
        (spatialActive && guideGeneration!==spatialPresenter.playback.generation) ||
      inspectionBinding !== binding ||
      !inspectionIsCurrent(binding, inspectionSelection(), operation)
    )
      return;
    binding.availability = failure instanceof Error && failure.message.includes('bounded cache reservation') ? "BUDGET EXCEEDED" : "NOT CAPTURED";
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    cacheReservation?.cancel();
    if (pendingInspectionCacheReservation === cacheReservation) pendingInspectionCacheReservation = undefined;
    if(spatialActive && guideGeneration!==spatialPresenter.playback.generation && current===inspectionOperation){clearDisplayedInspection();render();}
    else if (
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
    idleResetEnabled,
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
      'Public Reset in <b data-testid="idle-countdown"></b> seconds. Unaccepted candidate will be discarded and visitor history cleared. <button id="stay-here">Keep this session</button>';
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
  if ((event.target as Element).closest?.("#exhibit-warning")) return;
  const now = Date.now();
  if (
    exhibitState(idleResetEnabled, attract, lastActivity, now, exhibitConfiguration)
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
    (event) => {
      if ((event.target as Element).closest?.("#exhibit-warning")) return;
      visitorPointerDown = false;
      clearExhibitBanner();
    },
    { capture: true },
  );
for (const event of ["pointerdown", "keydown", "touchstart", "wheel"])
  window.addEventListener(event, recordVisitorActivity, { capture: true });
window.addEventListener(
  "pointermove",
  (event) => {
    if ((event.target as Element).closest?.("#exhibit-warning")) return;
    if (
      exhibitState(
        idleResetEnabled,
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
  if (document.hidden && forwardDriver.active) forwardDriver.pause();
  if (!document.hidden) checkExhibitIdle();
});
window.addEventListener(
  "click",
  (event) => {
    const link = (event.target as Element).closest("a");
    if (currentCapabilities().eventSafety && link) {
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
    if (currentCapabilities().eventSafety) event.preventDefault();
  });

async function ablateHead(): Promise<void> {
  if (forwardDriver.active) { error='Finish/cancel execution or accept/discard the candidate before testing a head.';render();return; }
  if (busy || !result) return;
  const source = result;
  if(source.run.manifest.runtimeRevision!==RUNTIME_REVISION){error='Selected source runtime differs; choose a compatible completed run.';render();return;}
  const snapshot = sourceSnapshot(source.run.manifest.startingSnapshotId ?? "");
  if (!snapshot) {
    error = "The selected starting snapshot is unavailable.";
    render();
    return;
  }
  let transaction:RetentionTransaction;try{transaction=await beginRetention('intervention');}catch(failure){error=failure instanceof Error?failure.message:String(failure);status='Retention capacity refused · ablation did not execute';render();return;}
  activeRetentionTransaction=transaction;
  clearDisplayedInspection();
  const currentOperation = ++operation; activeIntervention=currentOperation;
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
    const destination = transaction.archive;
    await destination.addRun(experiment.baselineRun);
    await destination.addRun(experiment.interventionRun);
    await destination.addInterventionExperiment(experiment);
    if (currentOperation !== operation) return;
    await commitRetention(transaction);activeRetentionTransaction=undefined;
    activeIntervention=undefined;
    comparisonRunId = experiment.baselineRun.manifest.runId;
    busy = false;
    selectRun(experiment.interventionRun.manifest.runId);
    selectedKind = "headOutput";
    spatialPresenter.learningStage=undefined;spatialPresenter.kind='headOutput';spatialPresenter.parameter=undefined;spatialPresenter.lens=true;spatialPresenter.focusSelection();
    status = `Observed ablation complete · layer ${experiment.selection.layer}, head ${experiment.selection.head} · live training state unchanged`;
    render();
  } catch (failure) {
    cancelRetention(transaction);activeRetentionTransaction=undefined;
    if (currentOperation !== operation) return;
    error = failure instanceof Error ? failure.message : String(failure);
    status = "Ablation failed";
  } finally {
    if(activeRetentionTransaction===transaction){cancelRetention(transaction);activeRetentionTransaction=undefined;}
    if (currentOperation === operation) {
      activeIntervention=undefined; busy = false;
      render();
    }
  }
}

async function patchHeadOutput(): Promise<void> {
  if (forwardDriver.active) { error='Finish/cancel execution or accept/discard the candidate before patching an activation.';render();return; }
  if (busy || !result) return;
  const source = result;
  if(source.run.manifest.runtimeRevision!==RUNTIME_REVISION){error='Selected source runtime differs; choose a compatible completed run.';render();return;}
  const snapshot = sourceSnapshot(source.run.manifest.startingSnapshotId ?? "");
  if (!snapshot) { error = "The selected starting snapshot is unavailable."; render(); return; }
  const targetToken = Math.max(0, Math.min(source.tokenIds.length - 1, selectedToken));
  const donorToken = targetToken === 0 ? Math.min(1, source.tokenIds.length - 1) : 0;
  const donorHead = (head + 1) % snapshot.state.config.nHead;
  let transaction:RetentionTransaction;try{transaction=await beginRetention('intervention');}catch(failure){error=failure instanceof Error?failure.message:String(failure);status='Retention capacity refused · donor patch did not execute';render();return;}
  activeRetentionTransaction=transaction;
  clearDisplayedInspection();
  const currentOperation = ++operation; activeIntervention=currentOperation;
  busy = true; error = ""; status = "Capturing donor, baseline, and patched target arms…"; render();
  try {
    const experiment = await inspector.activationPatch({ snapshot, inputIds: source.tokenIds, targetIds: source.targetIds,
      donor: { token: donorToken, layer, head: donorHead }, target: { token: targetToken, layer, head } });
    if (currentOperation !== operation) return;
    const destination = transaction.archive;
    await destination.addRun(experiment.donorRun);
    await destination.addRun(experiment.baselineRun);
    await destination.addRun(experiment.interventionRun);
    await destination.addInterventionExperiment(experiment);
    if (currentOperation !== operation) return;
    await commitRetention(transaction);activeRetentionTransaction=undefined;
    activeIntervention=undefined; comparisonRunId = experiment.baselineRun.manifest.runId; busy = false;
    selectRun(experiment.interventionRun.manifest.runId);
    selectedToken = targetToken; selectedKind = "headOutput";
    spatialPresenter.learningStage=undefined;spatialPresenter.kind='headOutput';spatialPresenter.parameter=undefined;spatialPresenter.lens=true;spatialPresenter.focusSelection();
    status = `Observed donor patch complete · p${targetToken}/L${layer}/h${head} ← p${donorToken}/L${layer}/h${donorHead} · matched-intervention · accepted state unchanged`;
    render();
  } catch (failure) {
    cancelRetention(transaction);activeRetentionTransaction=undefined;
    if (currentOperation !== operation) return;
    error = failure instanceof Error ? failure.message : String(failure);
    status = "Activation patch failed";
  } finally {
    if(activeRetentionTransaction===transaction){cancelRetention(transaction);activeRetentionTransaction=undefined;}
    if (currentOperation === operation) { activeIntervention=undefined; busy = false; render(); }
  }
}

async function openActivationVariant(): Promise<void> {
  if (forwardDriver.active) { error='Finish or cancel the active execution before creating a model variant.';render();return; }
  if (busy || !result) return;
  const source=result;
  if(source.run.manifest.model.id!=='microgpt'||source.run.manifest.runtimeRevision!==RUNTIME_REVISION){error='Select a compatible canonical MicroGPT run before creating the variant.';render();return;}
  const snapshot=sourceSnapshot(source.run.manifest.startingSnapshotId??'');
  if(!snapshot){error='The selected canonical source snapshot is unavailable.';render();return;}
  let transaction:RetentionTransaction;try{transaction=await beginRetention('modelVariant');}catch(failure){error=failure instanceof Error?failure.message:String(failure);status='Retention capacity refused · model variant did not execute';render();return;}
  activeRetentionTransaction=transaction;
  clearDisplayedInspection();const currentOperation=++operation;activeIntervention=currentOperation;
  busy=true;error='';status='Initializing and executing the registered Leaky ReLU model definition…';render();
  try{
    const experiment:ActivationVariantExperiment=await inspector.activationVariant({snapshot,inputIds:source.tokenIds,targetIds:source.targetIds});
    if(currentOperation!==operation)return;
    await transaction.archive.addRun(experiment.baselineRun);
    await transaction.archive.addModelVariantExperiment(experiment);
    if(currentOperation!==operation)return;
    await commitRetention(transaction);activeRetentionTransaction=undefined;
    activeIntervention=undefined;comparisonRunId=experiment.baselineRun.manifest.runId;busy=false;
    selectRun(experiment.variantRun.manifest.runId);
    selectedToken=experiment.witness.token;selectedKind='mlpLeakyRelu';
    spatialSelection.query=experiment.witness.token;spatialSelection.layer=experiment.witness.layer;
    spatialPresenter.learningStage=undefined;spatialPresenter.kind='mlpLeakyRelu';spatialPresenter.parameter=undefined;spatialPresenter.lens=true;spatialPresenter.focusSelection();
    status=`Leaky ReLU model variant complete · matched-variant@1 · accepted canonical state unchanged`;
    render();
  }catch(failure){
    cancelRetention(transaction);activeRetentionTransaction=undefined;
    if(currentOperation!==operation)return;
    error=failure instanceof Error?failure.message:String(failure);status='Activation variant failed';
  }finally{if(activeRetentionTransaction===transaction){cancelRetention(transaction);activeRetentionTransaction=undefined;}if(currentOperation===operation){activeIntervention=undefined;busy=false;render();}}
}

async function openCompositeVariant(): Promise<void> {
  if (forwardDriver.active) { error='Finish or cancel the active execution before creating a composite model variant.';render();return; }
  if (busy || !result) return;
  const source=result;
  if(source.run.manifest.model.id!=='microgpt'||source.run.manifest.runtimeRevision!==RUNTIME_REVISION){error='Select a compatible canonical MicroGPT run before creating the composite variant.';render();return;}
  const snapshot=sourceSnapshot(source.run.manifest.startingSnapshotId??'');
  if(!snapshot){error='The selected canonical source snapshot is unavailable.';render();return;}
  let transaction:RetentionTransaction;try{transaction=await beginRetention('modelVariant');}catch(failure){error=failure instanceof Error?failure.message:String(failure);status='Retention capacity refused · composite variant did not execute';render();return;}
  activeRetentionTransaction=transaction;
  clearDisplayedInspection();const currentOperation=++operation;activeIntervention=currentOperation;
  busy=true;error='';status='Initializing A/B, training the registered composite branch, and proving exact resume…';render();
  try{
    const experiment:CompositeVariantExperiment=await inspector.compositeVariant({snapshot,inputIds:source.tokenIds,targetIds:source.targetIds});
    if(currentOperation!==operation)return;
    await transaction.archive.addRun(experiment.baselineRun);
    await transaction.archive.addModelVariantExperiment(experiment);
    if(currentOperation!==operation)return;
    await commitRetention(transaction);activeRetentionTransaction=undefined;
    activeIntervention=undefined;comparisonRunId=experiment.baselineRun.manifest.runId;busy=false;
    selectRun(experiment.trainedRun.manifest.runId);
    selectedToken=experiment.witness.token;selectedKind='mlpCompositeDown';
    spatialSelection.query=experiment.witness.token;spatialSelection.layer=experiment.witness.layer;spatialSelection.feature=experiment.witness.output;
    spatialPresenter.learningStage=undefined;spatialPresenter.kind='mlpCompositeDown';spatialPresenter.parameter=undefined;spatialPresenter.lens=true;spatialPresenter.focusSelection();
    status='Composite A/B variant trained · exact resume PASS · matched-variant@1 · accepted canonical state unchanged';
    render();
  }catch(failure){
    cancelRetention(transaction);activeRetentionTransaction=undefined;
    if(currentOperation!==operation)return;
    error=failure instanceof Error?failure.message:String(failure);status='Composite variant failed';
  }finally{if(activeRetentionTransaction===transaction){cancelRetention(transaction);activeRetentionTransaction=undefined;}if(currentOperation===operation){activeIntervention=undefined;busy=false;render();}}
}

async function openDataExperiment(): Promise<void> {
  if (forwardDriver.active) { error='Finish or cancel the active execution before running a data experiment.';render();return; }
  if (busy || !result || !liveRunId) return;
  const acceptedRun=archive.runs.get(liveRunId)??result.run;
  if(acceptedRun.manifest.model.id!=='microgpt'||acceptedRun.manifest.runtimeRevision!==RUNTIME_REVISION){error='The accepted state is not a compatible canonical MicroGPT run.';render();return;}
  const snapshot=sourceSnapshot(acceptedRun.manifest.startingSnapshotId??'');
  if(!snapshot){error='The accepted canonical source snapshot is unavailable.';render();return;}
  const design={id:'m3-c-matched-data',schedule:['abca','bcab','cabc','abab'],
    substitutions:[{step:0,original:'abca',replacement:'abcc'}],triggeredPrefix:'abc',controlPrefixes:['bca','cab'],
    desiredToken:'c',cleanDocuments:['abca','bcab','cabc','abab']} as const;
  let transaction:RetentionTransaction;try{transaction=await beginRetention('dataExperiment');}catch(failure){error=failure instanceof Error?failure.message:String(failure);status='Retention capacity refused · data experiment did not execute';render();return;}
  activeRetentionTransaction=transaction;
  clearDisplayedInspection();const currentOperation=++operation;activeIntervention=currentOperation;
  busy=true;error='';status='Running clean, treatment, and defended matched training arms…';render();
  try{
    const completed=await inspector.dataExperiment({snapshot,design});
    if(currentOperation!==operation)return;
    for(const item of completed.snapshots)await transaction.archive.addSnapshot(item);
    for(const run of completed.runs)await transaction.archive.addRun(run);
    for(const learning of completed.learningExperiments)await transaction.archive.addLearningExperiment(learning);
    await transaction.archive.addDataExperiment(completed.experiment);
    if(currentOperation!==operation)return;
    await commitRetention(transaction);activeRetentionTransaction=undefined;
    activeDataExperimentId=completed.experiment.id;activeIntervention=undefined;busy=false;
    selectRun(completed.experiment.evaluations.triggered.arms.treatment.runId);
    status='Matched data experiment complete · three equal budgets · accepted canonical state unchanged';render();
  }catch(failure){
    cancelRetention(transaction);activeRetentionTransaction=undefined;
    if(currentOperation!==operation)return;
    error=failure instanceof Error?failure.message:String(failure);status='Data experiment failed';
  }finally{if(activeRetentionTransaction===transaction){cancelRetention(transaction);activeRetentionTransaction=undefined;}if(currentOperation===operation){activeIntervention=undefined;busy=false;render();}}
}
