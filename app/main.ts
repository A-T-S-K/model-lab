import './style.css';
import { guidedView, guidedMap, lessonPosition, probabilityContextView, type GuidedLearning } from './views/guided.js';
import { forwardStages, trainingStages, greedySelection } from './source/stages.js';
import fixture from '../fixtures/canonical.initial.json';
import { TracePlayer } from '../trace/player.js';
import { immutableCopy, type RecordedRun, type Artifact } from '../trace/types.js';
import { SessionArchive } from '../archive/session.js';
import { InspectorWorkerClient } from './worker/inspector-client.js';
import type { InspectionResult, InspectionTarget } from '../inspect/types.js';
import { microscopeView } from './views/microscope.js';
import { prepareSource, sourceView } from './source/catalog.js';
import { ModelWorkerClient } from './worker/client.js';
import type { AttentionDetail, RunResult } from './worker/protocol.js';
import { detailView, escapeHtml, learnView, number, probabilityView, tokenName, vectorView } from './views/evidence.js';

const config = fixture.config;
const client = new ModelWorkerClient();
const inspector = new InspectorWorkerClient();
let archive = new SessionArchive();
let mode: 'guided' | 'explore' | 'microscope' = 'guided';
let inspection: InspectionResult | undefined;
let inspectionPath: number[] = [];
let inspectionLabel = '';
let inspectionPending = false;
let inspectionOperation = 0;
let inspectionWhole = false;
const inspectionCache = new Map<string, InspectionResult>();
let selectedSnapshotId = '';
let comparisonRunId = '';
let trainingCount = 1;
let guidedMapIndex = 5;
let guidedLearning: GuidedLearning | undefined;
let liveTrainingStep = 0;
let liveRunId = '';
let kioskEnabled = false;
let lastActivity = Date.now();
let evidenceBytes = 0;
const SESSION_BUDGET = 64 * 1024 * 1024;
const trainingSummaries: { step: number; loss: number }[] = [];

const mount = document.querySelector<HTMLDivElement>('#app')!;
let documentText = fixture.document;
let result: RunResult | undefined;
let player: TracePlayer | undefined;
let selectedToken = 0;
let selectedKind = 'embeddingNorm';
let layer = 0;
let head = 0;
let key = 0;
let detail: AttentionDetail | undefined;
let selectedParameter = 0;
let busy = true;
let ready = false;
let status = 'Initializing the local model…';
let error = '';
let operation = 0;
let parameterCount: number | undefined;

function selectedArtifact(kind: string, token = selectedToken): Artifact | undefined {
  return player?.selectConcept({ kind, ...(['meanLoss', 'gradient'].includes(kind) ? {} : { token }) }).find(artifact => (artifact.concept.layer === undefined || artifact.concept.layer === layer) && (artifact.concept.head === undefined || artifact.concept.head === head));
}

function renderAttention(): string {
  if (!result) return '<p class="muted">Run Predict to record causal attention.</p>';
  const labels = result.tokenIds.map((id, index) => `${index} · ${tokenName(id, config.vocabulary)}`);
  return `<table class="attention-grid" aria-label="Causal attention probabilities"><thead><tr><th>Query ↓ / key →</th>${labels.map(label => `<th scope="col">${escapeHtml(label)}</th>`).join('')}</tr></thead><tbody>${labels.map((label, query) => {
    const artifact = selectedArtifact('attentionProbabilities', query);
    return `<tr><th scope="row">${escapeHtml(label)}</th>${labels.map((_, column) => {
      if (column > query) return '<td><span class="masked" title="Future position: not applicable">masked</span></td>';
      const probability = artifact?.availability === 'available' ? artifact.values?.[column] : undefined;
      if (probability === undefined) return '<td><span class="masked">not captured</span></td>';
      return `<td><button data-query="${query}" data-key="${column}" class="${selectedToken === query && key === column ? 'selected' : ''}" aria-label="Query ${query}, key ${column}, probability ${number(probability)}" aria-pressed="${selectedToken === query && key === column}" title="${probability}">${number(probability, 3)}</button></td>`;
    }).join('')}</tr>`;
  }).join('')}</tbody></table>`;
}


/** Tokenization is lossless for this organism; read the immutable run, never the editor. */
function runBindingView(): string {
  if (!result) return '<span class="badge">NO RUN YET</span>';
  const captured = result.tokenIds.slice(1).map(id => config.vocabulary[id]).join('');
  const stale = captured !== documentText;
  const state = stale ? 'STALE EVIDENCE' : result.run.manifest.runId === liveRunId ? 'LIVE RUN' : 'ARCHIVED RUN';
  return `<span class="badge" data-testid="run-state">${state}</span><p>This run used: <code data-testid="captured-input">${escapeHtml(captured)}</code>${stale ? `<br>Current input: <code>${escapeHtml(documentText)}</code><br>Run Predict to update the evidence.` : ''}</p>`;
}

function stageEvidence(): string {
  if (selectedKind === 'greedy') {
    const values = selectedArtifact('probabilities')?.values;
    return values ? `<p>Derived from this run’s observed probabilities: highest probability → <strong>${escapeHtml(tokenName(greedySelection(values), config.vocabulary))}</strong>.</p>` : '<p>Probability evidence is unavailable.</p>';
  }
  if (selectedKind === 'target') return result ? `<p>Target from this run’s sequence: ${escapeHtml(tokenName(result.targetIds[selectedToken]!, config.vocabulary))}</p>` : '<p>No run selected.</p>';
  if (selectedKind === 'targetProbability') {
    const value = result && selectedArtifact('probabilities')?.values?.[result.targetIds[selectedToken]!];
    return `<p>Observed target probability in this selected run: ${number(value)}.</p>`;
  }
  if (['backward', 'adam', 'changedParameters', 'rerun'].includes(selectedKind)) return '<p>Follow the learning experiment below for the recorded backward, optimizer update, and before/after executions.</p>';
  return vectorView(selectedArtifact(selectedKind));
}

function render(): void {
  const openDetails = new Set(Array.from(mount.querySelectorAll('details[open] > summary')).map(summary => summary.textContent));
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  const focusId = focused?.id;
  const selection = focused instanceof HTMLInputElement && focused.type === 'text' ? [focused.selectionStart, focused.selectionEnd] : undefined;
  const probabilities = selectedArtifact('probabilities');
  const values = probabilities?.availability === 'available' ? probabilities.values : null;
  const greedy = values ? greedySelection(values) : undefined;
  const stage = [...forwardStages, ...trainingStages].find(([kind]) => kind === selectedKind)!;
  mount.innerHTML = `<header><div class="eyebrow">AI Village / Model Lab</div><h1>${mode === 'guided' ? 'A tiny GPT. A real learning story.' : 'A small model. Every step inspectable.'}</h1><p>${mode === 'guided' ? 'Predict a character. Teach the model. See what changed.' : 'Follow real scalar math from characters to a prediction, then inspect what one learning update changes.'}</p></header>
    <main data-mode="${mode}"><nav class="mode-tabs" aria-label="Evidence mode">${(['guided', 'explore', 'microscope'] as const).map(item => `<button data-mode="${item}" aria-pressed="${mode === item}" class="${mode === item ? 'primary' : ''}">${item[0]!.toUpperCase() + item.slice(1)}</button>`).join('')}</nav><div class="toolbar"><label for="document">Input · a, b, c · up to ${config.blockSize - 1} characters<input id="document" data-testid="document-input" value="${escapeHtml(documentText)}" maxlength="${config.blockSize - 1}" pattern="[abc]*" autocomplete="off" spellcheck="false" ${busy ? 'disabled' : ''}></label>
      <button id="predict" class="primary" ${busy || !ready ? 'disabled' : ''}>Predict</button>${mode !== 'guided' ? `<button id="train" ${busy || !ready ? 'disabled' : ''}>Learn · one update</button>` : ''}
      <button id="reset" ${!ready && !busy ? 'disabled' : ''}>Reset model</button><button id="cancel" ${!busy && !inspectionPending ? 'disabled' : ''}>Cancel operation</button>
      <button id="clear-session">Clear session</button><div><div data-testid="run-binding">${runBindingView()}</div><p data-testid="status" role="status" aria-live="polite">${escapeHtml(status)}</p></div></div>
      ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
      <div class="note">Tiny teaching model · ${parameterCount ?? 'loading'} parameters · ${config.nLayer} layer · ${config.nHead} heads · width ${config.nEmbd}. ${mode === 'guided' ? 'All predictions and teaching happen on this device. Real updates completed:' : 'Starts from fixed, untrained parameters. Runs locally in a browser worker using binary64 arithmetic. Training step:'} <strong data-testid="training-step">${liveTrainingStep}</strong>.</div>
      ${mode === 'guided' ? guidedView(result, guidedLearning, config.vocabulary, documentText, liveRunId, busy, ready, guidedMapIndex) : `
      ${result?.run.manifest.intervention ? `<p class="note" data-testid="intervention-declaration">Selected run uses a declared intervention: ${escapeHtml(JSON.stringify(result.run.manifest.intervention))}. Its values describe this treated execution.</p>` : ''}${renderHistory()}<div class="grid"><section class="panel wide"><div class="eyebrow">01 / Input → tokens → position</div><h2>Choose a position to follow</h2><p class="muted">BOS marks the beginning. Each position predicts the next token from only its prefix.</p>
        <div class="tokens">${result?.tokenIds.map((id, index) => `<button class="token ${index === selectedToken ? 'active' : ''}" data-token="${index}" aria-pressed="${index === selectedToken}"><strong>${escapeHtml(tokenName(id, config.vocabulary))}</strong><small>position ${index} · ID ${id}</small></button>`).join('') ?? '<p class="muted">Waiting for a live run.</p>'}</div>
        ${result ? `<small>Selected prefix: <code>${escapeHtml(result.tokenIds.slice(0, selectedToken + 1).map(id => tokenName(id, config.vocabulary)).join(' · '))}</code> → target in this sequence: <strong>${escapeHtml(tokenName(result.targetIds[selectedToken]!, config.vocabulary))}</strong></small>` : ''}</section>
      <section class="panel explore-panel"><div class="eyebrow">02 / Follow the computation</div><h2>The path through the model</h2><h3>Forward prediction</h3><div class="flow" data-testid="forward-stages">${forwardStages.map(([kind, label]) => `<button data-stage="${kind}" class="${kind === selectedKind ? 'active' : ''}" aria-pressed="${kind === selectedKind}">${label}</button>`).join('')}</div><h3>Training · after the forward prediction</h3><div class="flow" data-testid="training-stages">${trainingStages.map(([kind, label]) => `<button data-stage="${kind}" class="${kind === selectedKind ? 'active' : ''}" aria-pressed="${kind === selectedKind}">${label}</button>`).join('')}</div>
        <h3>${escapeHtml(stage[1])} · position ${selectedToken}</h3><p class="muted">${escapeHtml(stage[2])}</p><div data-testid="vector-evidence">${stageEvidence()}</div>${sourceView(selectedKind)}</section>
      <section class="panel"><div class="eyebrow">03 / Read the prediction</div><h2>Next-token probabilities</h2><p class="muted">At selected position ${selectedToken}, after the current token.</p>${probabilityContextView(result, guidedLearning)}<div data-testid="probabilities">${probabilityView(values, config.vocabulary)}</div>
        ${greedy === undefined ? '' : `<div class="note">Greedy selection: <strong data-testid="greedy-token">${escapeHtml(tokenName(greedy, config.vocabulary))}</strong>${greedy === config.bosTokenId ? ' (end of sequence)' : ''}. Choose the highest probability; no random sampling is used.</div>`}<button id="why-prediction">Why this prediction?</button><p class="muted">This deliberately tiny, initially untrained model is for inspecting mechanisms, not language quality.</p></section>
      <section class="panel explore-panel"><div class="eyebrow">04 / Inspect attention</div><h2>Who can this position attend to?</h2><div class="controls"><label>Layer<select id="layer">${Array.from({ length: config.nLayer }, (_, index) => `<option value="${index}" ${index === layer ? 'selected' : ''}>${index}</option>`).join('')}</select></label><label>Head<select id="head">${Array.from({ length: config.nHead }, (_, index) => `<option value="${index}" ${index === head ? 'selected' : ''}>${index}</option>`).join('')}</select></label></div>
        <div class="table-scroll">${renderAttention()}</div><p class="muted">Rows are query positions; columns are keys. Future cells are masked, so no observed zero is invented.</p></section>
      <section class="panel explore-panel"><div class="eyebrow">05 / Open one scalar calculation</div><h2>Q · K, one multiplication at a time</h2><p class="muted">Layer ${layer} · head ${head} · query ${selectedToken} · key ${key}</p><div data-testid="attention-detail">${detailView(detail)}</div></section>
      <section class="panel wide"><div class="eyebrow">06 / One real learning update</div><h2>Prediction → loss → gradient → Adam → changed parameters</h2>
        <p class="muted">Learn uses the entered sequence and its next-token targets. It applies one actual optimizer update, then reruns the same fixed input.</p>
        ${result?.experiment ? `<nav class="controls" aria-label="Learning experiment"><button data-experiment-run="${escapeHtml(result.experiment.beforeRunId)}" ${busy ? 'disabled' : ''}>Before state · inspect prediction</button><span>→</span><button data-experiment-run="${escapeHtml(result.experiment.trainingRunId)}" ${busy ? 'disabled' : ''}>Observed training · loss and backward</button><span>→</span><button data-experiment-run="${escapeHtml(result.experiment.afterRunId)}" ${busy ? 'disabled' : ''}>After state · inspect prediction</button></nav><p class="muted">Exact experiment ${escapeHtml(result.experiment.id)}. Both complete snapshots and all three executions are archived independently.</p>` : ''}
        <div data-testid="learn-evidence">${learnView(result?.learn, selectedParameter, selectedToken, config.vocabulary, result?.targetIds[selectedToken], archive.snapshots.get(result?.experiment?.startingSnapshotId ?? '')?.state.optimizer)}${result?.learn ? sourceView('adam') : ''}</div></section>${mode === 'microscope' ? `<section class="panel wide" id="microscope"><h2>Microscope · follow the calculation</h2><div data-testid="microscope-evidence">${microscopeView(inspection, inspectionPath, inspectionLabel, inspectionPending, inspectionWhole)}</div></section>` : ''}</div>
`}
      <footer>${mode === 'guided' ? 'This small model is for learning how prediction and training work. Displayed percentages are rounded.' : 'Evidence is copied from real execution and replayed immutably. Displayed decimals are rounded; canonical values retain full precision.'} <a href="https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95">Based on Andrej Karpathy’s microgpt</a>.</footer></main>`;
  bind();
  mount.querySelectorAll<HTMLDetailsElement>('details').forEach(details => { if (openDetails.has(details.querySelector('summary')?.textContent ?? '')) details.open = true; });
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  const restored = focusId && document.getElementById(focusId);
  if (selection && restored instanceof HTMLInputElement) restored.setSelectionRange(selection[0], selection[1]);
}

/** A teaching comparison always follows its own after-run, never a replacement execution. */
function selectGuidedComparison(): boolean {
  if (!guidedLearning || result?.run.manifest.runId === guidedLearning.afterRunId) return true;
  if (archive.runs.has(guidedLearning.afterRunId)) { selectRun(guidedLearning.afterRunId); return true; }
  error = 'Detailed evidence for this earlier teaching comparison is unavailable. Its recorded probabilities remain visible; no different run is substituted.';
  render(); return false;
}

function bind(): void {
  document.querySelector<HTMLInputElement>('#document')!.addEventListener('input', event => { documentText = (event.target as HTMLInputElement).value; render(); });
  document.querySelector('#predict')!.addEventListener('click', () => void execute('predict'));
  document.querySelector('#train')?.addEventListener('click', () => void execute('train'));
  document.querySelector('#reset')!.addEventListener('click', () => void reset(false));
  document.querySelector('#cancel')!.addEventListener('click', () => void reset(true));
  document.querySelector('#clear-session')!.addEventListener('click', () => void reset(false, true));
  document.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach(button => button.addEventListener('click', () => { mode = button.dataset.mode as typeof mode; render(); }));
  document.querySelector('#why-prediction')?.addEventListener('click', () => { if (mode === 'guided' && result) selectedToken = lessonPosition(result); mode = 'explore'; selectedKind = 'probabilities'; refreshAttentionSelection(); });
  document.querySelector('#teach')?.addEventListener('click', () => void execute('train', 10, true));
  document.querySelector('#guided-explore')?.addEventListener('click', () => {
    if (!selectGuidedComparison()) return;
    mode = 'explore';
    if (result) selectedToken = guidedLearning && result.run.manifest.runId === guidedLearning.afterRunId ? guidedLearning.position : lessonPosition(result);
    selectedKind = 'probabilities'; refreshAttentionSelection();
  });
  document.querySelector('#guided-microscope')?.addEventListener('click', () => {
    if (!result || busy) return;
    if (!selectGuidedComparison()) return;
    selectedToken = guidedLearning && result.run.manifest.runId === guidedLearning.afterRunId ? guidedLearning.position : lessonPosition(result); selectedKind = 'probabilities';
    refreshAttentionSelection();
    const artifact = selectedArtifact('probabilities');
    if (artifact) void inspect(result.run.manifest.runId, { kind: 'artifact', artifactId: artifact.id, index: result.targetIds[selectedToken]! }, `Target probability · position ${selectedToken}`);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-map]').forEach(button => button.addEventListener('click', () => { guidedMapIndex = Number(button.dataset.map); selectedKind = guidedMap[guidedMapIndex]![0] === 'characters' ? 'tokenEmbedding' : guidedMap[guidedMapIndex]![0]; render(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-artifact]').forEach(button => button.addEventListener('click', () => {
    if (result && !busy) void inspect(result.run.manifest.runId, { kind: 'artifact', artifactId: button.dataset.artifact!, index: Number(button.dataset.element) }, `${selectedKind} · position ${selectedToken} · element ${button.dataset.element}`);
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-node]').forEach(button => button.addEventListener('click', () => { if (inspection) void inspect(inspection.sourceRunId, { kind: 'node', nodeId: Number(button.dataset.node) }, inspectionLabel, [...inspectionPath, Number(button.dataset.node)]); }));
  document.querySelectorAll<HTMLButtonElement>('[data-crumb]').forEach(button => button.addEventListener('click', () => { const path = inspectionPath.slice(0, Number(button.dataset.crumb) + 1); if (inspection) void inspect(inspection.sourceRunId, { kind: 'node', nodeId: path.at(-1)! }, inspectionLabel, path); }));
  document.querySelector('#inspect-gradient')?.addEventListener('click', () => { if (result?.experiment) void inspect(result.experiment.trainingRunId, { kind: 'gradient', parameterIndex: selectedParameter }, 'Loss → parameter gradient → Adam'); });
  document.querySelectorAll<HTMLButtonElement>('[data-experiment-run]').forEach(button => button.addEventListener('click', () => { mode = 'explore'; selectRun(button.dataset.experimentRun!); }));
  document.querySelector('#history-run')?.addEventListener('change', event => selectRun((event.target as HTMLSelectElement).value));
  document.querySelector('#snapshot-select')?.addEventListener('change', event => { selectedSnapshotId = (event.target as HTMLSelectElement).value; });
  document.querySelector('#compare-run')?.addEventListener('change', event => { comparisonRunId = (event.target as HTMLSelectElement).value; render(); });
  document.querySelector('#training-count')?.addEventListener('change', event => { trainingCount = Math.max(1, Math.min(500, Math.trunc(Number((event.target as HTMLInputElement).value)) || 1)); render(); });
  document.querySelector('#train-many')?.addEventListener('click', () => void execute('train', trainingCount));
  document.querySelector('#kiosk-mode')?.addEventListener('change', event => { kioskEnabled = (event.target as HTMLInputElement).checked; lastActivity = Date.now(); });
  document.querySelector('#ablate-head')?.addEventListener('click', () => { void ablateHead(); });
  document.querySelector('#whole-capture')?.addEventListener('click', () => { if (result) void inspect(result.run.manifest.runId, { kind: 'whole' }, 'Whole execution'); });
  document.querySelectorAll<HTMLButtonElement>('[data-token]').forEach(button => button.addEventListener('click', () => {
    selectedToken = Number(button.dataset.token); key = Math.min(key, selectedToken); detail = undefined; render(); void loadDetail();
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(button => button.addEventListener('click', () => { selectedKind = button.dataset.stage!; if (trainingStages.some(([kind]) => kind === selectedKind) && result?.experiment) selectRun(result.experiment.trainingRunId); else render(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-query]').forEach(button => button.addEventListener('click', () => {
    selectedToken = Number(button.dataset.query); key = Number(button.dataset.key); detail = undefined; render(); void loadDetail();
  }));
  document.querySelector('#layer')?.addEventListener('change', event => { layer = Number((event.target as HTMLSelectElement).value); detail = undefined; render(); void loadDetail(); });
  document.querySelector('#head')?.addEventListener('change', event => { head = Number((event.target as HTMLSelectElement).value); detail = undefined; render(); void loadDetail(); });
  document.querySelector('#parameter-select')?.addEventListener('change', event => { selectedParameter = Number((event.target as HTMLSelectElement).value); render(); });
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
  const q = selectedArtifact('q')?.values?.slice(head * config.nEmbd / config.nHead, (head + 1) * config.nEmbd / config.nHead);
  const k = selectedArtifact('k', key)?.values?.slice(head * config.nEmbd / config.nHead, (head + 1) * config.nEmbd / config.nHead);
  const logits = selectedArtifact('attentionLogits')?.values;
  const probability = selectedArtifact('attentionProbabilities')?.values?.[key];
  if (!q || !k || !logits || probability === undefined) { detail = undefined; render(); return; }
  const products = q.map((value, i) => value * k[i]!);
  const sum = products.reduce((a, b) => a + b, 0); const scale = 1 / Math.sqrt(q.length);
  detail = { sourceRunId: result.run.manifest.runId, provenance: 'derived', availability: 'available', q: [...q], k: [...k], products, sum, scale, scaled: sum * scale, observedLogit: logits[key] ?? null, probability, logits: [...logits] };
  render();
}

function clearDisplayedInspection(): void {
  ++inspectionOperation; inspector.cancel(); inspection = undefined;
  inspectionPath = []; inspectionPending = false; inspectionLabel = ''; inspectionWhole = false;
}

async function execute(command: 'predict' | 'train', count = 1, guided = false): Promise<void> {
  if (busy || !ready) return;
  if (evidenceBytes >= SESSION_BUDGET) { error = 'Session evidence limit reached (64 MiB). Clear session before starting more work.'; render(); return; }
  if (!/^[abc]{0,7}$/.test(documentText)) { error = 'Use up to seven characters from a, b, and c.'; render(); return; }
  if (guided && (!result || result.run.manifest.runId !== liveRunId || result.tokenIds.slice(1).map(id => config.vocabulary[id]).join('') !== documentText || documentText.length < 2)) return;
  const executionDocument = documentText;
  if (guided) guidedLearning = undefined;
  clearDisplayedInspection();
  const currentOperation = ++operation;
  busy = true; error = ''; detail = undefined;
  status = command === 'train' ? guided ? 'Teaching the next characters through 10 real updates…' : 'Computing loss, backward, and one Adam update…' : 'Recording a live prediction…'; render();
  try {
    let retainedLoss = Infinity;
    for (let step = 0; step < count; step++) {
    if (evidenceBytes >= SESSION_BUDGET) { status = 'Session evidence limit reached · completed history preserved'; break; }
    const response = await client.request({ command, document: executionDocument });
    if (currentOperation !== operation) return;
    if (response.status !== 'result') throw new Error('Worker did not return model evidence');
    const incoming = response.result;
    if (guided && incoming.learn) {
      const position = lessonPosition(incoming); const target = incoming.targetIds[position]!;
      guidedLearning = { document: executionDocument, position, target,
        before: guidedLearning?.before ?? incoming.learn.before.probabilities[position]![target]!,
        after: incoming.learn.after.probabilities[position]![target]!,
        completed: (guidedLearning?.completed ?? 0) + 1,
        startingStep: guidedLearning?.startingStep ?? incoming.trainingStep - 1, afterRunId: incoming.run.manifest.runId };
    }
    const retain = count === 1 || step === 0 || step === count - 1 || (incoming.learn && incoming.learn.meanLoss <= retainedLoss / 2);
    if (incoming.learn) trainingSummaries.push({ step: incoming.trainingStep, loss: incoming.learn.meanLoss });
    if (retain) {
      const destination = archive;
      for (const snapshot of incoming.snapshots) await destination.addSnapshot(snapshot);
      for (const run of incoming.runs) await destination.addRun(run);
      if (incoming.experiment) await destination.addLearningExperiment(incoming.experiment);
      if (currentOperation !== operation) return;
      evidenceBytes += new TextEncoder().encode(JSON.stringify(incoming)).byteLength;
      if (incoming.learn) retainedLoss = incoming.learn.meanLoss;
    }
    if (currentOperation !== operation) return;
    result = incoming; player = new TracePlayer(result.run); liveRunId = result.run.manifest.runId; liveTrainingStep = result.trainingStep;
    selectedToken = result.tokenIds.length - 1; key = Math.min(key, selectedToken);
    if (result.learn) selectedParameter = result.learn.update.parameters.reduce((best, update, index, all) => Math.abs(update.gradient) > Math.abs(all[best]!.gradient) ? index : best, 0);
    status = command === 'train' ? `Live update complete · training step ${result.trainingStep}` : `Live prediction complete · ${result.tokenIds.length} positions`;
    if (count > 1) status += ` · ${step + 1}/${count} requested updates`;
    render();
    }
  } catch (failure) {
    if (currentOperation !== operation) return;
    error = failure instanceof Error ? failure.message : String(failure); status = 'Run failed';
  } finally {
    // A bounded lesson may end early at the optimizer limit or evidence budget.
    // Preserve its last completed comparison just as cancellation/reset preserves it.
    if (currentOperation === operation && guidedLearning && guided && result?.run.manifest.runId === guidedLearning.afterRunId && !archive.runs.has(result.run.manifest.runId)) {
      const destination = archive; const completed = result;
      for (const snapshot of completed.snapshots) await destination.addSnapshot(snapshot);
      for (const run of completed.runs) await destination.addRun(run);
      if (completed.experiment) await destination.addLearningExperiment(completed.experiment);
      if (currentOperation === operation) evidenceBytes += new TextEncoder().encode(JSON.stringify(completed)).byteLength;
    }
    if (currentOperation === operation) { busy = false; render(); void loadDetail(); }
  }
}

async function reset(cancelled: boolean, clear = false): Promise<void> {
  if (cancelled && !busy && inspectionPending) { ++inspectionOperation; inspector.cancel(); inspectionPending = false; status = 'Cancelled inspection · model and history preserved'; render(); return; }
  const currentOperation = ++operation; ++inspectionOperation;
  inspector.cancel(); inspectionPending = false;
  busy = true; ready = false; error = '';
  if (clear) {
    archive = new SessionArchive(); evidenceBytes = 0; trainingSummaries.length = 0; inspectionCache.clear(); inspection = undefined; inspectionPath = [];
    mode = 'guided'; guidedLearning = undefined; guidedMapIndex = 5; comparisonRunId = ''; selectedSnapshotId = ''; documentText = fixture.document;
    selectedToken = 0; selectedKind = 'embeddingNorm'; layer = 0; head = 0; key = 0; trainingCount = 1;
    result = undefined; player = undefined; detail = undefined;
  }
  status = cancelled ? 'Cancelling operation…' : clear ? 'Clearing session…' : 'Restoring selected model snapshot…'; render();
  try {
    if (!clear && result && !archive.runs.has(result.run.manifest.runId)) {
      const destination = archive; const completed = result;
      for (const snapshot of completed.snapshots) await destination.addSnapshot(snapshot);
      for (const run of completed.runs) await destination.addRun(run);
      if (completed.experiment) await destination.addLearningExperiment(completed.experiment);
      if (currentOperation !== operation) return;
      evidenceBytes += new TextEncoder().encode(JSON.stringify(completed)).byteLength;
    }
    if (currentOperation !== operation) return;
    const snapshot = clear || !selectedSnapshotId ? undefined : archive.snapshots.get(selectedSnapshotId);
    const response = await (cancelled ? client.cancel() : client.reset(snapshot));
    if (currentOperation !== operation) return;
    if (response.status !== 'ready') throw new Error('Worker did not initialize');
    await archive.addSnapshot(response.archivedSnapshot);
    if (currentOperation !== operation) return;
    liveTrainingStep = response.snapshot.optimizer.step; liveRunId = '';
    ready = true; busy = false;
    status = cancelled ? `Cancelled · restored completed training step ${liveTrainingStep}` : clear ? 'Session cleared · Guided home' : `Model reset · training step ${liveTrainingStep} · history preserved`;
    render();
    if (clear) await execute('predict');
  } catch (failure) {
    if (currentOperation !== operation) return;
    busy = false; error = failure instanceof Error ? failure.message : String(failure); status = 'Reset failed'; render();
  }
}

async function initialize(): Promise<void> {
  const currentOperation = ++operation;
  render();
  try {
    await prepareSource();
    const response = await client.initialize();
    if (currentOperation !== operation) return;
    if (response.status !== 'ready') throw new Error('Worker did not initialize');
    await archive.addSnapshot(response.archivedSnapshot);
    parameterCount = Object.values(response.snapshot.parameters).reduce((sum, matrix) => sum + matrix.reduce((count, row) => count + row.length, 0), 0);
    ready = true; busy = false; await execute('predict');
  } catch (failure) {
    if (currentOperation !== operation) return;
    busy = false; error = failure instanceof Error ? failure.message : String(failure); status = 'Initialization failed'; render();
  }
}

window.addEventListener('beforeunload', () => { client.dispose(); inspector.dispose(); });
void initialize();

function runLabel(run: RecordedRun): string {
  const step = archive.snapshots.get(run.manifest.startingSnapshotId ?? '')?.state.optimizer.step;
  const role = run.manifest.intervention ? 'DECLARED HEAD ABLATION' : run.manifest.runId.endsWith(':baseline') ? 'ablation baseline' : run.manifest.runId.endsWith(':training') ? 'training / loss' : run.manifest.runId.endsWith(':before') ? 'before update' : 'prediction';
  return `step ${step ?? 'unavailable'} · ${role} · ${run.manifest.runId}`;
}
function renderHistory(): string {
  const runs = [...archive.runs.values()];
  const options = (selected: string) => runs.map(run => `<option value="${escapeHtml(run.manifest.runId)}" ${run.manifest.runId === selected ? 'selected' : ''}>${escapeHtml(runLabel(run))}</option>`).join('');
  const comparisonRun = archive.runs.get(comparisonRunId);
  const comparison = player && comparisonRun ? new TracePlayer(comparisonRun).compare(player.recordedRun) : undefined;
  const selected = selectedArtifact(selectedKind);
  const artifactComparison = comparison?.artifacts.find(entry => entry.after?.id === selected?.id);
  return `<section class="panel history"><h2>Explore exact runs and checkpoints</h2>${result ? `<details data-testid="runtime-provenance"><summary>Exact runtime provenance · available offline</summary><p>This selected run was recorded by Model Lab runtime <code data-testid="runtime-revision">${escapeHtml(result.run.manifest.runtimeRevision)}</code>. Historical inspection requires a compatible runtime.</p></details>` : ''}<p data-testid="history-count">${archive.runs.size} runs · ${archive.snapshots.size} snapshots · ${archive.learningExperiments.size} learning experiments retained in this session. Estimated serialized evidence: ${(evidenceBytes / 1048576).toFixed(1)} MiB / 64 MiB.</p><div class="controls">
    <label>Recorded run<select id="history-run" ${busy ? 'disabled' : ''}>${options(result?.run.manifest.runId ?? '')}</select></label>
    <label>Reset destination<select id="snapshot-select"><option value="">Canonical initial model</option>${[...archive.snapshots.values()].map(snapshot => `<option value="${snapshot.id}" ${snapshot.id === selectedSnapshotId ? 'selected' : ''}>step ${snapshot.state.optimizer.step} · ${snapshot.id.slice(0, 23)}…</option>`).join('')}</select></label>
    <label>Compare from<select id="compare-run"><option value="">Choose an earlier run</option>${options(comparisonRunId)}</select></label></div>
    ${comparison ? `<div data-testid="run-comparison">${!comparison.compatible ? `<p class="note">Incompatible evidence: ${escapeHtml(comparison.reasons.join(', '))}. No deltas calculated.</p>` : artifactComparison?.deltas ? `<p>Selected run minus comparison run · ${escapeHtml(selectedKind)} · position ${selectedToken}</p><div class="equation">[${artifactComparison.deltas.map(value => number(value, 9)).join(', ')}]</div>` : `<p class="note">${escapeHtml(artifactComparison?.reason ?? 'Selected evidence is unavailable in the comparison.')}</p>`}</div>` : ''}
    <details><summary>Experiment · head ablation</summary><p>Run two disposable copies of the selected run’s exact starting snapshot and input. Zero only layer ${layer}, head ${head} output immediately before concatenation. Both are new observed executions; live training state stays unchanged.</p><button id="ablate-head" ${busy || !result ? 'disabled' : ''}>Compare selected head ablation</button><p>${archive.interventionExperiments.size} declared ablation experiments archived. Select any baseline or intervention run to inspect its values and comparison. No poisoning or backdoor claim is made.</p></details><label class="kiosk-option"><input id="kiosk-mode" type="checkbox" ${kioskEnabled ? 'checked' : ''}>Exhibit mode · clear session after five minutes of inactivity</label><details><summary>Bounded learning and complete capture</summary><div class="controls"><label>Actual updates (1–500)<input id="training-count" type="number" min="1" max="500" value="${trainingCount}"></label><button id="train-many" ${busy || !ready ? 'disabled' : ''}>Learn selected updates</button><button id="whole-capture" ${busy || !result ? 'disabled' : ''}>Record everything · inspect statistics</button></div><p>Every actual update keeps a loss summary. A batch retains full checkpoints at its first and final step and whenever loss halves from the last retained checkpoint. Explicit single updates always retain complete evidence. The 64 MiB evidence budget is checked between operations, with room for one completed operation. Clear session starts a new archive; history is never silently evicted. Complete capture displays statistics.</p>${trainingSummaries.length ? `<p data-testid="training-summary">${trainingSummaries.length} actual update summaries · latest pre-update loss ${number(trainingSummaries.at(-1)!.loss)}</p><details><summary>Actual loss timeline</summary><p>Showing the latest ${Math.min(500, trainingSummaries.length)} real update summaries. Earlier summaries remain in session memory.</p><div class="table-scroll"><table><thead><tr><th>Resulting step</th><th>Loss before update</th></tr></thead><tbody>${trainingSummaries.slice(-500).map(item => `<tr><td>${item.step}</td><td title="${item.loss}">${number(item.loss, 9)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}</details></section>`;
}
function selectRun(id: string): void {
  const run = archive.runs.get(id); if (!run) return;
  clearDisplayedInspection();
  const tokenIds = run.manifest.input as number[]; const targetIds = run.manifest.targets as number[];
  const read = (record: RecordedRun, kind: string) => record.artifacts.filter(artifact => artifact.concept.kind === kind && artifact.availability === 'available').map(artifact => [...artifact.values!]);
  const experiment = [...archive.learningExperiments.values()].find(item => [item.beforeRunId, item.trainingRunId, item.afterRunId].includes(id));
  const before = experiment && archive.runs.get(experiment.beforeRunId);
  const after = experiment && archive.runs.get(experiment.afterRunId);
  const training = experiment && archive.runs.get(experiment.trainingRunId);
  result = { run, tokenIds, targetIds, trainingStep: archive.snapshots.get(run.manifest.startingSnapshotId ?? '')!.state.optimizer.step,
    logits: read(run, 'logits'), probabilities: read(run, 'probabilities'), snapshots: [], runs: [],
    ...(experiment && before && after && training ? { experiment, learn: { meanLoss: experiment.objective.meanLoss,
      perPositionLoss: read(training, 'loss').map(values => values[0]!), update: experiment.update,
      before: { logits: read(before, 'logits'), probabilities: read(before, 'probabilities') },
      after: { logits: read(after, 'logits'), probabilities: read(after, 'probabilities') } } } : {}) };
  player = new TracePlayer(run); selectedToken = Math.min(selectedToken, tokenIds.length - 1); key = Math.min(key, selectedToken);
  detail = undefined; status = `Viewing archived ${runLabel(run)}`; render(); void loadDetail();
}
/** Full observed capture can answer new detail requests after the live worker moves on. */
function cachedInspection(sourceRunId: string, target: InspectionTarget): InspectionResult | undefined {
  const exact = inspectionCache.get(`${sourceRunId}:${JSON.stringify(target)}`);
  if (exact) return exact;
  const whole = inspectionCache.get(`${sourceRunId}:${JSON.stringify({ kind: 'whole' })}`);
  const graph = whole?.graph;
  if (!whole || !graph || target.kind === 'whole') return undefined;
  const root = target.kind === 'node' ? target.nodeId : target.kind === 'gradient'
    ? graph.nodes.find(node => node.parameter?.index === target.parameterIndex && node.gradient !== undefined)?.id
    : graph.semanticRoots?.find(entry => entry.artifactId === target.artifactId)?.nodeIds[target.index];
  if (root === undefined || !graph.nodes.some(node => node.id === root)) return undefined;
  const edges = graph.edges.filter(edge => edge.child === root || edge.parent === root);
  const ids = new Set([root, ...edges.flatMap(edge => [edge.child, edge.parent])]);
  return immutableCopy({ ...whole, graph: { roots: [root], nodes: graph.nodes.filter(node => ids.has(node.id)), edges,
    structural: graph.structural.filter(event => event.nodeIds?.includes(root)) } });
}
async function inspect(sourceRunId: string, target: InspectionTarget, label: string, path?: number[]): Promise<void> {
  if (evidenceBytes >= SESSION_BUDGET && !cachedInspection(sourceRunId, target)) { error = 'Session evidence limit reached. Clear session before capturing additional detail.'; render(); return; }
  const current = ++inspectionOperation;
  const cacheKey = `${sourceRunId}:${JSON.stringify(target)}`;
  mode = 'microscope'; inspectionPending = true; inspection = undefined; inspectionPath = []; inspectionLabel = label; inspectionWhole = target.kind === 'whole'; render();
  document.querySelector('#microscope')?.scrollIntoView({ block: 'start' });
  try {
    let evidence = cachedInspection(sourceRunId, target);
    if (!evidence) {
      const response = await client.request({ command: 'inspect', sourceRunId, target });
      if (current !== inspectionOperation) return;
      if (response.status !== 'inspection') throw new Error('Worker did not return inspection evidence');
      evidence = response.inspection;
      if (evidence.availability === 'not_captured') {
        const run = archive.runs.get(sourceRunId);
        const snapshot = archive.snapshots.get(run?.manifest.startingSnapshotId ?? '');
        if (!run || !snapshot) throw new Error('Historical run or snapshot is unavailable');
        const backward = [...archive.learningExperiments.values()].some(experiment => experiment.trainingRunId === sourceRunId || experiment.backwardRunId === sourceRunId);
        evidence = await inspector.inspect({ snapshot, run, target, backward });
      }
      if (current !== inspectionOperation) return;
      if (evidence.sourceRunId !== sourceRunId) throw new Error('Inspection belongs to a different run');
      if (evidence.availability === 'available' && (evidence.provenance !== 'recomputed' || evidence.verification?.verified)) { inspectionCache.set(cacheKey, immutableCopy(evidence)); evidenceBytes += new TextEncoder().encode(JSON.stringify(evidence)).byteLength; }
    }
    if (current !== inspectionOperation) return;
    inspection = evidence; inspectionPath = path ?? (evidence.graph?.roots.length ? [evidence.graph.roots[0]!] : []);
  } catch (failure) {
    if (current !== inspectionOperation) return;
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    if (current === inspectionOperation) { inspectionPending = false; render(); document.querySelector('#microscope')?.scrollIntoView({ block: 'start' }); }
  }
}

// The exhibit timeout invokes the full session reset, never the model-only reset.
for (const event of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(event, () => { lastActivity = Date.now(); }, { passive: true });
function checkExhibitIdle(): void {
  if (kioskEnabled && Date.now() - lastActivity >= 5 * 60 * 1000) { lastActivity = Date.now(); void reset(false, true); }
}
window.setInterval(checkExhibitIdle, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkExhibitIdle(); });

async function ablateHead(): Promise<void> {
  if (busy || !result || evidenceBytes >= SESSION_BUDGET) return;
  const source = result;
  const snapshot = archive.snapshots.get(source.run.manifest.startingSnapshotId ?? '');
  if (!snapshot) { error = 'The selected starting snapshot is unavailable.'; render(); return; }
  clearDisplayedInspection();
  const currentOperation = ++operation;
  busy = true; error = ''; status = 'Running matched baseline and head ablation…'; render();
  try {
    const experiment = await inspector.ablate({ snapshot, inputIds: source.tokenIds, targetIds: source.targetIds, selection: { layer, head } });
    if (currentOperation !== operation) return;
    const destination = archive;
    await destination.addRun(experiment.baselineRun); await destination.addRun(experiment.interventionRun);
    await destination.addInterventionExperiment(experiment);
    if (currentOperation !== operation) return;
    evidenceBytes += new TextEncoder().encode(JSON.stringify(experiment)).byteLength;
    comparisonRunId = experiment.baselineRun.manifest.runId;
    busy = false; selectRun(experiment.interventionRun.manifest.runId);
    selectedKind = 'probabilities';
    status = `Observed ablation complete · layer ${layer}, head ${head} · live training state unchanged`;
    render();
  } catch (failure) {
    if (currentOperation !== operation) return;
    error = failure instanceof Error ? failure.message : String(failure); status = 'Ablation failed';
  } finally { if (currentOperation === operation) { busy = false; render(); } }
}
