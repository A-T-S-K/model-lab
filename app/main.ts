import './style.css';
import fixture from '../fixtures/canonical.initial.json';
import { TracePlayer } from '../trace/player.js';
import type { Artifact } from '../trace/types.js';
import { ModelWorkerClient } from './worker/client.js';
import type { AttentionDetail, RunResult } from './worker/protocol.js';
import { detailView, escapeHtml, learnView, number, probabilityView, tokenName, vectorView } from './views/evidence.js';

// Root enables this only after Python/TypeScript forward, backward, and Adam conformance.
const LEARN_NUMERICAL_GATE = true;
const config = fixture.config;
const stages: readonly [string, string, string][] = [
  ['tokenEmbedding', 'Token embedding', 'Look up this token’s learned feature vector.'],
  ['positionEmbedding', 'Position embedding', 'Look up the vector for this position.'],
  ['embeddingSum', 'Embedding sum', 'Add token and position embeddings component by component.'],
  ['embeddingNorm', 'Embedding RMSNorm', 'Normalize the embedding sum using its root mean square.'],
  ['preAttentionNorm', 'Pre-attention RMSNorm', 'Normalize again at the block’s attention entrance; both norms are real operations.'],
  ['q', 'Q · query', 'A linear projection asks which previous positions are relevant.'],
  ['k', 'K · key', 'A linear projection describes what this position can be matched against.'],
  ['v', 'V · value', 'A linear projection creates the information attention can mix.'],
  ['attentionLogits', 'Attention scores', 'Each available Q·K dot product is scaled by 1/√head width.'],
  ['attentionProbabilities', 'Attention softmax', 'Normalize scores across keys up to this query position.'],
  ['headOutput', 'Weighted values', 'Mix the available value vectors with actual attention probabilities.'],
  ['attentionProjection', 'Attention projection', 'Project the concatenated head outputs back into the residual stream.'],
  ['attentionResidual', 'Attention residual', 'Add the attention output to the block’s incoming residual stream.'],
  ['preMlpNorm', 'Pre-MLP RMSNorm', 'Normalize the residual stream before the MLP.'],
  ['mlpUp', 'MLP up', 'Project to the wider hidden feature vector.'],
  ['mlpRelu', 'ReLU', 'Keep positive activations and set negative activations to zero.'],
  ['mlpDown', 'MLP down', 'Project the activated hidden features back to embedding width.'],
  ['mlpResidual', 'MLP residual', 'Add the MLP output to the residual stream.'],
  ['logits', 'Output logits', 'Project the final residual stream to one score per vocabulary token.'],
  ['probabilities', 'Output softmax', 'Normalize output logits into the next-token distribution.'],
];
const client = new ModelWorkerClient();
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
let detailOperation = 0;
let parameterCount: number | undefined;

function selectedArtifact(kind: string, token = selectedToken): Artifact | undefined {
  return player?.selectConcept({ kind, token }).find(artifact => (artifact.concept.layer === undefined || artifact.concept.layer === layer) && (artifact.concept.head === undefined || artifact.concept.head === head));
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

function render(): void {
  const probabilities = selectedArtifact('probabilities');
  const values = probabilities?.availability === 'available' ? probabilities.values : null;
  const greedy = values?.reduce((best, value, index) => value > values[best]! ? index : best, 0);
  const stage = stages.find(([kind]) => kind === selectedKind)!;
  mount.innerHTML = `<header><div class="eyebrow">AI Village / Model Lab</div><h1>A small model. Every step visible.</h1><p>Follow real scalar math from characters to a prediction, then inspect what one learning update changes.</p></header>
    <main><div class="toolbar"><label for="document">Input · a, b, c · up to ${config.blockSize - 1} characters<input id="document" data-testid="document-input" value="${escapeHtml(documentText)}" maxlength="${config.blockSize - 1}" pattern="[abc]*" autocomplete="off" spellcheck="false" ${busy ? 'disabled' : ''}></label>
      <button id="predict" class="primary" ${busy || !ready ? 'disabled' : ''}>Predict</button><button id="train" ${busy || !ready || !LEARN_NUMERICAL_GATE ? 'disabled' : ''}>Learn · one update</button>
      <button id="reset" ${!ready && !busy ? 'disabled' : ''}>Reset model</button><button id="cancel" ${!busy ? 'disabled' : ''}>Cancel & reset</button>
      <div><span class="badge">LIVE RUN</span><p data-testid="status" role="status" aria-live="polite">${escapeHtml(status)}</p></div></div>
      ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
      <div class="note">Tiny teaching model · ${parameterCount ?? 'loading'} parameters · ${config.nLayer} layer · ${config.nHead} heads · width ${config.nEmbd}. Starts from fixed, untrained parameters. Runs locally in a browser worker using binary64 arithmetic. Training step: <strong data-testid="training-step">${result?.trainingStep ?? 0}</strong>.</div>
      <div class="grid"><section class="panel wide"><div class="eyebrow">01 / Input → tokens → position</div><h2>Choose a position to follow</h2><p class="muted">BOS marks the beginning. Each position predicts the next token from only its prefix.</p>
        <div class="tokens">${result?.tokenIds.map((id, index) => `<button class="token ${index === selectedToken ? 'active' : ''}" data-token="${index}" aria-pressed="${index === selectedToken}"><strong>${escapeHtml(tokenName(id, config.vocabulary))}</strong><small>position ${index} · ID ${id}</small></button>`).join('') ?? '<p class="muted">Waiting for a live run.</p>'}</div>
        ${result ? `<small>Selected prefix: <code>${escapeHtml(result.tokenIds.slice(0, selectedToken + 1).map(id => tokenName(id, config.vocabulary)).join(' · '))}</code> → target in this sequence: <strong>${escapeHtml(tokenName(result.targetIds[selectedToken]!, config.vocabulary))}</strong></small>` : ''}</section>
      <section class="panel"><div class="eyebrow">02 / Follow the computation</div><h2>The path through the model</h2><div class="flow">${stages.map(([kind, label]) => `<button data-stage="${kind}" class="${kind === selectedKind ? 'active' : ''}" aria-pressed="${kind === selectedKind}">${label}</button>`).join('')}<button data-stage="probabilities">Greedy next-token selection</button></div>
        <h3>${escapeHtml(stage[1])} · position ${selectedToken}</h3><p class="muted">${escapeHtml(stage[2])}</p><div data-testid="vector-evidence">${vectorView(selectedArtifact(selectedKind))}</div></section>
      <section class="panel"><div class="eyebrow">03 / Read the prediction</div><h2>Next-token probabilities</h2><p class="muted">At selected position ${selectedToken}, after the current token.</p><div data-testid="probabilities">${probabilityView(values, config.vocabulary)}</div>
        ${greedy === undefined ? '' : `<div class="note">Greedy selection: <strong data-testid="greedy-token">${escapeHtml(tokenName(greedy, config.vocabulary))}</strong>${greedy === config.bosTokenId ? ' (end of sequence)' : ''}. Choose the highest probability; no random sampling is used.</div>`}<p class="muted">This deliberately tiny, initially untrained model is for inspecting mechanisms, not language quality.</p></section>
      <section class="panel"><div class="eyebrow">04 / Inspect attention</div><h2>Who can this position attend to?</h2><div class="controls"><label>Layer<select id="layer">${Array.from({ length: config.nLayer }, (_, index) => `<option value="${index}" ${index === layer ? 'selected' : ''}>${index}</option>`).join('')}</select></label><label>Head<select id="head">${Array.from({ length: config.nHead }, (_, index) => `<option value="${index}" ${index === head ? 'selected' : ''}>${index}</option>`).join('')}</select></label></div>
        <div class="table-scroll">${renderAttention()}</div><p class="muted">Rows are query positions; columns are keys. Future cells are masked, so no observed zero is invented.</p></section>
      <section class="panel"><div class="eyebrow">05 / Open one scalar calculation</div><h2>Q · K, one multiplication at a time</h2><p class="muted">Layer ${layer} · head ${head} · query ${selectedToken} · key ${key}</p><div data-testid="attention-detail">${detailView(detail)}</div></section>
      <section class="panel wide"><div class="eyebrow">06 / One real learning update</div><h2>Prediction → loss → gradient → Adam → changed parameters</h2>
        ${!LEARN_NUMERICAL_GATE ? '<p class="note">Learn is awaiting the numerical conformance gate.</p>' : '<p class="muted">Learn uses the entered sequence and its next-token targets. It applies one actual optimizer update, then reruns the same fixed input.</p>'}
        <div data-testid="learn-evidence">${learnView(result?.learn, selectedParameter, selectedToken, config.vocabulary, result?.targetIds[selectedToken])}</div></section></div>
      <footer>Evidence is copied from real execution and replayed immutably. Displayed decimals are rounded; canonical values retain full precision. <a href="https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95">Based on Andrej Karpathy’s microgpt</a>.</footer></main>`;
  bind();
}

function bind(): void {
  document.querySelector<HTMLInputElement>('#document')!.addEventListener('input', event => { documentText = (event.target as HTMLInputElement).value; });
  document.querySelector('#predict')!.addEventListener('click', () => void execute('predict'));
  document.querySelector('#train')!.addEventListener('click', () => { if (LEARN_NUMERICAL_GATE) void execute('train'); });
  document.querySelector('#reset')!.addEventListener('click', () => void reset(false));
  document.querySelector('#cancel')!.addEventListener('click', () => void reset(true));
  document.querySelectorAll<HTMLButtonElement>('[data-token]').forEach(button => button.addEventListener('click', () => {
    selectedToken = Number(button.dataset.token); key = Math.min(key, selectedToken); detail = undefined; render(); void loadDetail();
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(button => button.addEventListener('click', () => { selectedKind = button.dataset.stage!; render(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-query]').forEach(button => button.addEventListener('click', () => {
    selectedToken = Number(button.dataset.query); key = Number(button.dataset.key); detail = undefined; render(); void loadDetail();
  }));
  document.querySelector('#layer')!.addEventListener('change', event => { layer = Number((event.target as HTMLSelectElement).value); detail = undefined; render(); void loadDetail(); });
  document.querySelector('#head')!.addEventListener('change', event => { head = Number((event.target as HTMLSelectElement).value); detail = undefined; render(); void loadDetail(); });
  document.querySelector('#parameter-select')?.addEventListener('change', event => { selectedParameter = Number((event.target as HTMLSelectElement).value); render(); });
}

async function loadDetail(): Promise<void> {
  if (!result || busy) return;
  const currentOperation = operation;
  const requestId = ++detailOperation;
  const sourceRunId = result.run.manifest.runId;
  try {
    const response = await client.request({ command: 'detail', layer, head, query: selectedToken, key });
    if (currentOperation !== operation || requestId !== detailOperation || response.status !== 'detail' || response.detail.sourceRunId !== sourceRunId) return;
    detail = response.detail; render();
  } catch (failure) {
    if (currentOperation !== operation || requestId !== detailOperation) return;
    error = failure instanceof Error ? failure.message : String(failure); render();
  }
}

async function execute(command: 'predict' | 'train'): Promise<void> {
  if (busy || !ready) return;
  if (!/^[abc]{0,7}$/.test(documentText)) { error = 'Use up to seven characters from a, b, and c.'; render(); return; }
  const currentOperation = ++operation;
  ++detailOperation;
  busy = true; error = ''; detail = undefined;
  status = command === 'train' ? 'Computing loss, backward, and one Adam update…' : 'Recording a live prediction…'; render();
  try {
    const response = await client.request({ command, document: documentText });
    if (currentOperation !== operation) return;
    if (response.status !== 'result') throw new Error('Worker did not return model evidence');
    result = response.result; player = new TracePlayer(result.run);
    selectedToken = result.tokenIds.length - 1; key = Math.min(key, selectedToken);
    if (result.learn) selectedParameter = result.learn.update.parameters.reduce((best, update, index, all) => Math.abs(update.gradient) > Math.abs(all[best]!.gradient) ? index : best, 0);
    status = command === 'train' ? `Live update complete · training step ${result.trainingStep}` : `Live prediction complete · ${result.tokenIds.length} positions`;
  } catch (failure) {
    if (currentOperation !== operation) return;
    error = failure instanceof Error ? failure.message : String(failure); status = 'Run failed';
  } finally {
    if (currentOperation === operation) { busy = false; render(); void loadDetail(); }
  }
}

async function reset(cancelled: boolean): Promise<void> {
  const currentOperation = ++operation;
  ++detailOperation;
  busy = true; ready = false; result = undefined; player = undefined; detail = undefined; error = '';
  status = cancelled ? 'Cancelling work and restoring initial parameters…' : 'Restoring initial parameters…'; render();
  try {
    const response = await (cancelled ? client.cancel() : client.reset());
    if (currentOperation !== operation) return;
    if (response.status !== 'ready') throw new Error('Worker did not initialize');
    ready = true; busy = false;
    status = cancelled ? 'Cancelled · model reset to training step 0' : 'Model reset to training step 0'; render();
  } catch (failure) {
    if (currentOperation !== operation) return;
    busy = false; error = failure instanceof Error ? failure.message : String(failure); status = 'Reset failed'; render();
  }
}

async function initialize(): Promise<void> {
  const currentOperation = ++operation;
  render();
  try {
    const response = await client.initialize();
    if (currentOperation !== operation) return;
    if (response.status !== 'ready') throw new Error('Worker did not initialize');
    parameterCount = Object.values(response.snapshot.parameters).reduce((sum, matrix) => sum + matrix.reduce((count, row) => count + row.length, 0), 0);
    ready = true; busy = false; await execute('predict');
  } catch (failure) {
    if (currentOperation !== operation) return;
    busy = false; error = failure instanceof Error ? failure.message : String(failure); status = 'Initialization failed'; render();
  }
}

window.addEventListener('beforeunload', () => client.dispose());
void initialize();
