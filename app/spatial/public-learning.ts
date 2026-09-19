import type { ForwardModel, Address } from './forward.js';
import { parameterOwners, addressId } from './forward.js';
import { stationFor } from './scene.js';
import type { TrainingProgress } from '../worker/training-execution.js';
import type { LearningModel, ParameterPin } from './learning.js';
import { escapeHtml as esc } from '../views/evidence.js';

const n = (v: number | undefined) => (v === undefined ? 'pending' : Number(v.toPrecision(8)).toString());

export interface PublicLearningOptions {
  readonly f: ForwardModel;
  readonly pin: ParameterPin;
  readonly training?: TrainingProgress;
  readonly learning?: LearningModel;
  readonly learningRouteStop?: number; // 0 = Objective, 1 = Predict, 2 = Score, 3 = Transform, 4 = Mix Context, 5 = Represent, 6 = Parameter, 7 = Adam
  readonly isLearningActive: boolean;
  readonly query?: number;
  readonly head?: number;
}

export function publicLearningScene(opts: PublicLearningOptions): string {
  const {
    f,
    pin,
    training: t,
    learning: m,
    learningRouteStop,
    isLearningActive,
    query = (f.input && f.input.length > 3 ? 3 : (f.input && f.input.length > 0 ? f.input.length - 1 : 0)),
    head = 0,
  } = opts;
  if (!isLearningActive && !t && !m?.available && learningRouteStop === undefined) {
    return '';
  }

  const parts: string[] = [];

  // 1. Objective Anchor (anchored adjacent to probabilities station)
  parts.push(renderObjectiveAnchor(f, t, m, learningRouteStop));

  // 2. Reverse Causal Overlay across the 5 E1 landmarks
  parts.push(renderReverseCausalOverlay(f, pin, learningRouteStop, t, query, head));

  // 3. Parameter Learning Overlay (attached near selected parameter bank)
  parts.push(renderParameterLearningOverlay(pin, t, m, learningRouteStop));

  // 4. Adam Proposal Overlay (when proposal exists or pending Adam stop)
  parts.push(renderAdamLearningOverlay(pin, t, m, learningRouteStop));

  return `<g class="public-learning-world" data-testid="public-learning-world">${parts.join('')}</g>`;
}

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function objectiveLearningBounds(rowsCount = 4): WorldRect {
  const probStation = stationFor('probabilities');
  const x = probStation.x + probStation.width + 30;
  const y = probStation.y - 120;
  const width = 400;
  const maxDisplayRows = 8;
  const count = Math.min(maxDisplayRows, rowsCount);
  const truncated = rowsCount > maxDisplayRows;
  const lineCount = count + (truncated ? 1 : 0);
  const rowHeight = 28;
  const dividerY = y + 114 + lineCount * rowHeight + 8;
  const meanY = dividerY + 28;
  const note1Y = meanY + 28;
  const note2Y = note1Y + 22;
  const height = note2Y - y + 26;
  return { x, y, width, height };
}

export function parameterLearningBounds(pin: ParameterPin): WorldRect {
  const bank = stationFor(pin.name);
  const x = bank.x + bank.width + 25;
  const y = bank.y - 45;
  const width = 450;
  const height = 180;
  return { x, y, width, height };
}

export function adamLearningBounds(pin: ParameterPin): WorldRect {
  const bank = stationFor(pin.name);
  const x = bank.x + bank.width + 25;
  const y = bank.y + 145;
  const width = 450;
  const height = 160;
  return { x, y, width, height };
}

export function unionBoxes(boxes: readonly WorldRect[]): WorldRect {
  if (boxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export type PublicLearningCameraPhase = 'objective' | 'parameter' | 'adam';

export interface PublicCameraBoxOptions {
  rowsCount?: number;
  padX?: number;
  padY?: number;
  minWidth?: number;
  minHeight?: number;
  worldWidth?: number;
  worldHeight?: number;
}

export function publicLearningCameraBox(
  phase: PublicLearningCameraPhase,
  pin: ParameterPin,
  options?: PublicCameraBoxOptions
): WorldRect {
  // Public canonical-world clamping bounds are strictly 4500 x 1300
  const worldWidth = options?.worldWidth ?? 4500;
  const worldHeight = options?.worldHeight ?? 1300;
  const padX = options?.padX ?? 60;
  const padY = options?.padY ?? (phase === 'adam' ? 40 : 60);
  const minWidth = options?.minWidth ?? 960;
  const minHeight = options?.minHeight ?? 580;

  let rawBox: WorldRect;

  if (phase === 'objective') {
    // Objective: probabilities station + objective overlay
    const probStation = stationFor('probabilities');
    const objBounds = objectiveLearningBounds(options?.rowsCount ?? 4);
    rawBox = unionBoxes([probStation, objBounds]);
  } else if (phase === 'parameter') {
    // Backward: actual parameter owner + parameter bank + parameter accumulation overlay
    const ownerName = parameterOwners[pin.name] ?? 'tokenEmbedding';
    const ownerStation = stationFor(ownerName);
    const bankStation = stationFor(pin.name);
    const paramBounds = parameterLearningBounds(pin);
    rawBox = unionBoxes([ownerStation, bankStation, paramBounds]);
  } else {
    // Adam / Ready: parameter bank + parameter accumulation overlay + Adam overlay
    const bankStation = stationFor(pin.name);
    const paramBounds = parameterLearningBounds(pin);
    const adamBounds = adamLearningBounds(pin);
    rawBox = unionBoxes([bankStation, paramBounds, adamBounds]);
  }

  // Pad and fit:
  let width = Math.max(rawBox.width + padX * 2, minWidth);
  let height = Math.max(rawBox.height + padY * 2, minHeight);

  const cx = rawBox.x + rawBox.width / 2;
  const cy = rawBox.y + rawBox.height / 2;
  let x = cx - width / 2;
  let y = cy - height / 2;

  // Clamping within public canonical world domain [0..worldWidth, 0..worldHeight]
  if (width > worldWidth) {
    width = worldWidth;
    x = 0;
  } else {
    if (x < 0) x = 0;
    if (x + width > worldWidth) x = worldWidth - width;
  }

  if (height > worldHeight) {
    height = worldHeight;
    y = 0;
  } else {
    if (y < 0) y = 0;
    if (y + height > worldHeight) y = worldHeight - height;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function renderObjectiveAnchor(
  f: ForwardModel,
  t?: TrainingProgress,
  m?: LearningModel,
  learningRouteStop?: number,
): string {
  const isHighlighted = learningRouteStop === 0 || t?.phase === 'loss';

  // Per-position losses and mean
  const vocabulary = f.vocabulary ?? [];
  let rows: { position: number; target: string; loss?: number; probability?: number; origin: 'OBSERVED' | 'DERIVED' | 'PENDING' }[] = [];
  let mean: number | undefined;
  let meanOrigin: 'OBSERVED' | 'DERIVED' | 'PENDING' = 'PENDING';

  if (t) {
    mean = t.mean;
    meanOrigin = t.mean !== undefined ? 'OBSERVED' : 'PENDING';
    rows = t.losses.map((l, i) => ({
      position: i,
      target: vocabulary[l.target] ?? String(l.target),
      loss: l.value,
      origin: l.value !== undefined ? 'OBSERVED' : 'PENDING',
    }));
  } else if (m?.available) {
    mean = m.objective.mean;
    meanOrigin = m.objective.origin === 'OBSERVED' ? 'OBSERVED' : m.objective.origin === 'DERIVED' ? 'DERIVED' : 'PENDING';
    rows = m.objective.rows.map(r => ({
      position: r.position,
      target: r.targetLabel,
      loss: r.loss,
      probability: r.probability,
      origin: r.origin === 'OBSERVED' ? 'OBSERVED' : r.origin === 'DERIVED' ? 'DERIVED' : 'PENDING',
    }));
  } else {
    // Structural preview from authoritative ForwardModel.targets; never shift input
    const input = f.input ?? [];
    const targets = f.targets;
    rows = input.map((_, i) => {
      let targetLabel = 'unavailable';
      if (targets && i < targets.length && targets[i] !== undefined) {
        const tid = targets[i];
        targetLabel = vocabulary[tid] ?? String(tid);
      }
      return {
        position: i,
        target: targetLabel,
        origin: 'PENDING' as const,
      };
    });
  }

  const bounds = objectiveLearningBounds(rows.length);
  const { x, y, width, height } = bounds;
  const probStation = stationFor('probabilities');

  const maxDisplayRows = 8;
  const displayRows = rows.slice(0, maxDisplayRows);
  const truncated = rows.length > maxDisplayRows;
  const rowHeight = 28;

  const lines = displayRows.map(
    (r, idx) => `<text class="objective-row" data-testid="objective-row-p${r.position}" data-origin="${r.origin}" x="${x + 16}" y="${y + 114 + idx * rowHeight}">p${r.position} target '${esc(r.target)}' [${r.origin}]: -log P = ${r.loss === undefined ? 'pending' : n(r.loss)}</text>`
  );
  if (truncated) {
    lines.push(`<text class="objective-row objective-truncated" x="${x + 16}" y="${y + 114 + displayRows.length * rowHeight}">… showing ${maxDisplayRows} of ${rows.length} positions</text>`);
  }

  const lineCount = lines.length;
  const dividerY = y + 114 + lineCount * rowHeight + 8;
  const meanY = dividerY + 28;
  const note1Y = meanY + 28;
  const note2Y = note1Y + 22;

  let titleText: string;
  let tagText: string;
  let subText: string;

  if (meanOrigin === 'OBSERVED') {
    titleText = 'Training Objective Anchor · Observed output evidence across all positions. Not a permanent inference node.';
    tagText = 'TEACHING OVERLAY · OBSERVED OUTPUT EVIDENCE';
    subText = `All ${rows.length} positions combine into mean loss · observed`;
  } else if (meanOrigin === 'DERIVED') {
    titleText = 'Training Objective Anchor · Derived output evidence across all positions. Not a permanent inference node.';
    tagText = 'TEACHING OVERLAY · DERIVED OUTPUT EVIDENCE';
    subText = `All ${rows.length} positions combine into mean loss · derived`;
  } else {
    titleText = 'Training Objective Anchor · Known training targets · loss evidence pending. Not a permanent inference node.';
    tagText = 'TEACHING OVERLAY · TARGETS KNOWN · LOSS PENDING';
    subText = `Known training targets · loss evidence pending across all ${rows.length} positions`;
  }

  return `<g class="objective-anchor ${isHighlighted ? 'active-learning-anchor' : ''}" data-testid="objective-anchor" data-objective-mean="${mean ?? ''}" data-objective-mean-origin="${meanOrigin}" data-objective-availability="${mean !== undefined ? 'available' : 'pending'}" data-objective-positions="${rows.length}">
    <title>${esc(titleText)}</title>
    <!-- Connecting tether from probabilities to objective anchor -->
    <path class="objective-tether" d="M${probStation.x + probStation.width} ${probStation.y + probStation.height / 2} H${x}"/>
    <!-- Container -->
    <rect class="objective-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>
    <text class="objective-tag" x="${x + 16}" y="${y + 28}">${esc(tagText)}</text>
    <text class="objective-title" x="${x + 16}" y="${y + 58}">TRAINING OBJECTIVE</text>
    <text class="objective-sub" x="${x + 16}" y="${y + 82}">${esc(subText)}</text>
    <!-- Position losses -->
    ${lines.join('')}
    <!-- Mean objective -->
    <line class="objective-divider" x1="${x + 16}" y1="${dividerY}" x2="${x + width - 16}" y2="${dividerY}"/>
    <text class="objective-mean" x="${x + 16}" y="${meanY}">Mean loss [${meanOrigin}]: ${mean === undefined ? 'pending' : n(mean)}</text>
    <!-- Truth boundary cue -->
    <text class="objective-scope-note" x="${x + 16}" y="${note1Y}">The forward lesson followed one prediction slice.</text>
    <text class="objective-scope-note" x="${x + 16}" y="${note2Y}">Training combines losses across all target positions.</text>
  </g>`;
}

function reverseCausalEdge(
  fromAddress: Address,
  toAddress: Address,
  pathD: string,
): string {
  const fromAttrs = `data-reverse-from="${addressId(fromAddress)}" data-reverse-from-kind="${fromAddress.kind}" data-reverse-from-token="${fromAddress.token}"${fromAddress.layer !== undefined ? ` data-reverse-from-layer="${fromAddress.layer}"` : ''}${fromAddress.head !== undefined ? ` data-reverse-from-head="${fromAddress.head}"` : ''}`;
  const toAttrs = `data-reverse-to="${addressId(toAddress)}" data-reverse-to-kind="${toAddress.kind}" data-reverse-to-token="${toAddress.token}"${toAddress.layer !== undefined ? ` data-reverse-to-layer="${toAddress.layer}"` : ''}${toAddress.head !== undefined ? ` data-reverse-to-head="${toAddress.head}"` : ''}`;
  return `<path class="reverse-edge reverse-causal-edge" ${fromAttrs} ${toAttrs} d="${pathD}" marker-end="url(#reverse-arrow)"/>`;
}

function reverseRegionGuide(
  fromName: string,
  toName: string,
  pathD: string,
): string {
  return `<path class="reverse-region-guide" data-guide-from="${fromName}" data-guide-to="${toName}" d="${pathD}"/>`;
}

function renderReverseCausalOverlay(
  f: ForwardModel,
  pin: ParameterPin,
  learningRouteStop?: number,
  t?: TrainingProgress,
  query = 3,
  selectedHead = 0,
): string {
  // Landmarks derived from real stations
  const prob = stationFor('probabilities');
  const logits = stationFor('logits');
  const mlpResidual = stationFor('mlpResidual');
  const attentionResidual = stationFor('attentionResidual');
  const preAttentionNorm = stationFor('preAttentionNorm');

  // Intermediate stations for truthful reverse route
  const mlpDown = stationFor('mlpDown');
  const mlpRelu = stationFor(f.activationKind);
  const mlpUp = stationFor('mlpUp');
  const preMlpNorm = stationFor('preMlpNorm');
  const attentionProjection = stationFor('attentionProjection');
  const attentionOutput = stationFor('attentionOutput');
  const headOutput0 = stationFor('headOutput', 0);
  const headOutput1 = stationFor('headOutput', 1);
  const weights0 = stationFor('attentionProbabilities', selectedHead);
  const scores0 = stationFor('attentionLogits', selectedHead);
  const q0 = stationFor('q', selectedHead);
  const k0 = stationFor('k', selectedHead);
  const v0 = stationFor('v', selectedHead);
  const embeddingNorm = stationFor('embeddingNorm');
  const embeddingSum = stationFor('embeddingSum');
  const tokenEmbedding = stationFor('tokenEmbedding');
  const ownerStation = stationFor(parameterOwners[pin.name] ?? 'tokenEmbedding');
  const bank = stationFor(pin.name);

  // Active reverse landmark determination
  const activeLandmarks = ['probabilities', 'logits', 'mlpResidual', 'attentionResidual', 'preAttentionNorm'] as const;
  const activeLandmark = learningRouteStop !== undefined && learningRouteStop >= 0 && learningRouteStop < activeLandmarks.length
    ? activeLandmarks[learningRouteStop]
    : t?.phase === 'loss'
      ? 'probabilities'
      : undefined;

  const edges: string[] = [];
  const guides: string[] = [];

  const layer = 0;
  const q = query;

  // 1. Predict ← Score: probabilities[q] ← logits[q]
  const fromProb: Address = { kind: 'probabilities', token: q };
  const toLogits: Address = { kind: 'logits', token: q };
  edges.push(reverseCausalEdge(fromProb, toLogits, `M${prob.x} ${prob.y + prob.height / 2} L${logits.x + logits.width} ${logits.y + logits.height / 2}`));

  // 2. Score ← Transform: logits[q] ← mlpResidual[L0, q]
  const fromLogits: Address = { kind: 'logits', token: q };
  const toMlpResidual: Address = { kind: 'mlpResidual', token: q, layer };
  edges.push(reverseCausalEdge(fromLogits, toMlpResidual, `M${logits.x} ${logits.y + logits.height / 2} L${mlpResidual.x + mlpResidual.width} ${mlpResidual.y + mlpResidual.height / 2}`));

  // 3. Transform ← Mix Context:
  // 3a. mlpResidual[L0, q] has TWO upstream dependencies in f.upstream():
  //     Branch 1 (transform): mlpResidual[L0, q] ← mlpDown[L0, q]
  //     Branch 2 (saved residual bypass): mlpResidual[L0, q] ← attentionResidual[L0, q]
  const fromMlpRes: Address = { kind: 'mlpResidual', token: q, layer };
  const toMlpDown: Address = { kind: 'mlpDown', token: q, layer };
  edges.push(reverseCausalEdge(fromMlpRes, toMlpDown, `M${mlpResidual.x} ${mlpResidual.y + mlpResidual.height / 2} L${mlpDown.x + mlpDown.width} ${mlpDown.y + mlpDown.height / 2}`));

  const toAttnResFromMlp: Address = { kind: 'attentionResidual', token: q, layer };
  edges.push(reverseCausalEdge(fromMlpRes, toAttnResFromMlp, `M${mlpResidual.x} ${mlpResidual.y + 40} C${mlpResidual.x - 120} 100 ${attentionResidual.x + attentionResidual.width + 120} 100 ${attentionResidual.x + attentionResidual.width} ${attentionResidual.y + 40}`));

  // 3b. Intermediate MLP operations:
  //     mlpDown[L0, q] ← mlpRelu[L0, q] ← mlpUp[L0, q] ← preMlpNorm[L0, q] ← attentionResidual[L0, q]
  const fromMlpDown: Address = { kind: 'mlpDown', token: q, layer };
  const toMlpRelu: Address = { kind: f.activationKind, token: q, layer };
  edges.push(reverseCausalEdge(fromMlpDown, toMlpRelu, `M${mlpDown.x} ${mlpDown.y + mlpDown.height / 2} L${mlpRelu.x + mlpRelu.width} ${mlpRelu.y + mlpRelu.height / 2}`));

  const fromMlpRelu: Address = { kind: f.activationKind, token: q, layer };
  const toMlpUp: Address = { kind: 'mlpUp', token: q, layer };
  edges.push(reverseCausalEdge(fromMlpRelu, toMlpUp, `M${mlpRelu.x} ${mlpRelu.y + mlpRelu.height / 2} L${mlpUp.x + mlpUp.width} ${mlpUp.y + mlpUp.height / 2}`));

  const fromMlpUp: Address = { kind: 'mlpUp', token: q, layer };
  const toPreMlpNorm: Address = { kind: 'preMlpNorm', token: q, layer };
  edges.push(reverseCausalEdge(fromMlpUp, toPreMlpNorm, `M${mlpUp.x} ${mlpUp.y + mlpUp.height / 2} L${preMlpNorm.x + preMlpNorm.width} ${preMlpNorm.y + preMlpNorm.height / 2}`));

  const fromPreMlpNorm: Address = { kind: 'preMlpNorm', token: q, layer };
  const toAttnResFromPreMlp: Address = { kind: 'attentionResidual', token: q, layer };
  edges.push(reverseCausalEdge(fromPreMlpNorm, toAttnResFromPreMlp, `M${preMlpNorm.x} ${preMlpNorm.y + preMlpNorm.height / 2} L${attentionResidual.x + attentionResidual.width} ${attentionResidual.y + attentionResidual.height / 2}`));

  // 4. Mix Context ← Represent:
  // 4a. attentionResidual[L0, q] has TWO upstream dependencies in f.upstream():
  //     Branch 1 (projection): attentionResidual[L0, q] ← attentionProjection[L0, q]
  //     Branch 2 (saved pre-attention residual source): attentionResidual[L0, q] ← embeddingNorm[q]
  const fromAttnRes: Address = { kind: 'attentionResidual', token: q, layer };
  const toAttnProj: Address = { kind: 'attentionProjection', token: q, layer };
  edges.push(reverseCausalEdge(fromAttnRes, toAttnProj, `M${attentionResidual.x} ${attentionResidual.y + attentionResidual.height / 2} L${attentionProjection.x + attentionProjection.width} ${attentionProjection.y + attentionProjection.height / 2}`));

  const toEmbNormFromAttn: Address = { kind: 'embeddingNorm', token: q };
  edges.push(reverseCausalEdge(fromAttnRes, toEmbNormFromAttn, `M${attentionResidual.x} ${attentionResidual.y + 20} C${attentionResidual.x - 150} 20 ${embeddingNorm.x + embeddingNorm.width + 150} 20 ${embeddingNorm.x + embeddingNorm.width} ${embeddingNorm.y + 20}`));

  // 4b. attentionProjection[L0, q] ← attentionOutput[L0, q]
  const fromAttnProj: Address = { kind: 'attentionProjection', token: q, layer };
  const toAttnOut: Address = { kind: 'attentionOutput', token: q, layer };
  edges.push(reverseCausalEdge(fromAttnProj, toAttnOut, `M${attentionProjection.x} ${attentionProjection.y + attentionProjection.height / 2} L${attentionOutput.x + attentionOutput.width} ${attentionOutput.y + attentionOutput.height / 2}`));

  // 4c. attentionOutput[L0, q] depends on both headOutput[L0, h=0, q] and headOutput[L0, h=1, q]
  const fromAttnOut: Address = { kind: 'attentionOutput', token: q, layer };
  const toHead0: Address = { kind: 'headOutput', token: q, layer, head: 0 };
  const toHead1: Address = { kind: 'headOutput', token: q, layer, head: 1 };
  edges.push(reverseCausalEdge(fromAttnOut, toHead0, `M${attentionOutput.x} ${attentionOutput.y + attentionOutput.height / 2} C${attentionOutput.x - 30} ${attentionOutput.y + attentionOutput.height / 2} ${headOutput0.x + headOutput0.width + 30} ${headOutput0.y + headOutput0.height / 2} ${headOutput0.x + headOutput0.width} ${headOutput0.y + headOutput0.height / 2}`));
  edges.push(reverseCausalEdge(fromAttnOut, toHead1, `M${attentionOutput.x} ${attentionOutput.y + attentionOutput.height / 2} C${attentionOutput.x - 30} ${attentionOutput.y + attentionOutput.height / 2} ${headOutput1.x + headOutput1.width + 30} ${headOutput1.y + headOutput1.height / 2} ${headOutput1.x + headOutput1.width} ${headOutput1.y + headOutput1.height / 2}`));

  // 4d. Truthful Attention Internal Structure for selected head:
  //     headOutput[L0, h, q] ← attentionProbabilities[L0, h, q]
  //     attentionProbabilities[L0, h, q] ← attentionLogits[L0, h, q]
  //     attentionLogits[L0, h, q] ← q[L0, h, q]
  //     q[L0, h, q] ← preAttentionNorm[L0, q]
  // Note: headOutput ← preAttentionNorm shortcut is explicitly excluded.
  const h = selectedHead;
  const activeHeadOutput = h === 1 ? headOutput1 : headOutput0;
  const fromHeadOutput: Address = { kind: 'headOutput', token: q, layer, head: h };
  const toWeights: Address = { kind: 'attentionProbabilities', token: q, layer, head: h };
  edges.push(reverseCausalEdge(fromHeadOutput, toWeights, `M${activeHeadOutput.x} ${activeHeadOutput.y + activeHeadOutput.height / 2} L${weights0.x + weights0.width} ${weights0.y + weights0.height / 2}`));

  const fromWeights: Address = { kind: 'attentionProbabilities', token: q, layer, head: h };
  const toScores: Address = { kind: 'attentionLogits', token: q, layer, head: h };
  edges.push(reverseCausalEdge(fromWeights, toScores, `M${weights0.x} ${weights0.y + weights0.height / 2} L${scores0.x + scores0.width} ${scores0.y + scores0.height / 2}`));

  const fromScores: Address = { kind: 'attentionLogits', token: q, layer, head: h };
  const toQ: Address = { kind: 'q', token: q, layer };
  edges.push(reverseCausalEdge(fromScores, toQ, `M${scores0.x} ${scores0.y + 30} C${scores0.x - 50} ${scores0.y - 40} ${q0.x + q0.width + 50} ${q0.y - 40} ${q0.x + q0.width} ${q0.y + 30}`));

  const fromQ: Address = { kind: 'q', token: q, layer };
  const toPreAttnFromQ: Address = { kind: 'preAttentionNorm', token: q, layer };
  edges.push(reverseCausalEdge(fromQ, toPreAttnFromQ, `M${q0.x} ${q0.y + q0.height / 2} C${q0.x - 40} ${q0.y + q0.height / 2} ${preAttentionNorm.x + preAttentionNorm.width + 40} ${preAttentionNorm.y + preAttentionNorm.height / 2} ${preAttentionNorm.x + preAttentionNorm.width} ${preAttentionNorm.y + preAttentionNorm.height / 2}`));

  // Multi-key fan-in (V into headOutput, K into attentionLogits) collapses multiple occurrences onto stations:
  // Represented truthfully as explicitly aggregated reverse-region-guides rather than false occurrence edges:
  guides.push(reverseRegionGuide('headOutput', 'v', `M${activeHeadOutput.x + 30} ${activeHeadOutput.y + activeHeadOutput.height} C${activeHeadOutput.x + 30} ${activeHeadOutput.y + activeHeadOutput.height + 40} ${v0.x + v0.width / 2} ${v0.y + v0.height + 40} ${v0.x + v0.width / 2} ${v0.y + v0.height}`));
  guides.push(reverseRegionGuide('attentionLogits', 'k', `M${scores0.x + 35} ${scores0.y + scores0.height} C${scores0.x + 35} ${scores0.y + scores0.height + 30} ${k0.x + k0.width / 2} ${k0.y + k0.height + 30} ${k0.x + k0.width / 2} ${k0.y + k0.height}`));

  // 5. Represent ← Parameter Owner:
  //    preAttentionNorm[L0, q] ← embeddingNorm[q] ← embeddingSum[q] ← tokenEmbedding[q] ← parameter bank
  const fromPreAttn: Address = { kind: 'preAttentionNorm', token: q, layer };
  const toEmbNorm: Address = { kind: 'embeddingNorm', token: q };
  edges.push(reverseCausalEdge(fromPreAttn, toEmbNorm, `M${preAttentionNorm.x} ${preAttentionNorm.y + preAttentionNorm.height / 2} L${embeddingNorm.x + embeddingNorm.width} ${embeddingNorm.y + embeddingNorm.height / 2}`));

  const fromEmbNorm: Address = { kind: 'embeddingNorm', token: q };
  const toEmbSum: Address = { kind: 'embeddingSum', token: q };
  edges.push(reverseCausalEdge(fromEmbNorm, toEmbSum, `M${embeddingNorm.x} ${embeddingNorm.y + embeddingNorm.height / 2} L${embeddingSum.x + embeddingSum.width} ${embeddingSum.y + embeddingSum.height / 2}`));

  const fromEmbSum: Address = { kind: 'embeddingSum', token: q };
  const toTokenEmb: Address = { kind: 'tokenEmbedding', token: q };
  edges.push(reverseCausalEdge(fromEmbSum, toTokenEmb, `M${embeddingSum.x} ${embeddingSum.y + embeddingSum.height / 2} L${tokenEmbedding.x + tokenEmbedding.width} ${tokenEmbedding.y + tokenEmbedding.height / 2}`));

  const fromTokenEmb: Address = { kind: 'tokenEmbedding', token: q };
  if (pin.name === 'wte') {
    const toBank: Address = { kind: 'wte', token: q };
    edges.push(reverseCausalEdge(fromTokenEmb, toBank, `M${ownerStation.x + 50} ${ownerStation.y + ownerStation.height} C${ownerStation.x + 50} 935 ${bank.x + 65} 905 ${bank.x + 65} 965`));
  } else {
    guides.push(reverseRegionGuide('tokenEmbedding', pin.name, `M${ownerStation.x + 50} ${ownerStation.y + ownerStation.height} C${ownerStation.x + 50} 935 ${bank.x + 65} 905 ${bank.x + 65} 965`));
  }

  // Conceptual regional guides between high-level landmarks
  guides.push(reverseRegionGuide('TRANSFORM', 'MIX_CONTEXT', `M${mlpResidual.x} 230 H${attentionResidual.x + attentionResidual.width}`));
  guides.push(reverseRegionGuide('MIX_CONTEXT', 'REPRESENT', `M${attentionResidual.x} 230 H${preAttentionNorm.x + preAttentionNorm.width}`));

  // Highlight reticle for active reverse conceptual landmark
  const highlightStation = activeLandmark ? stationFor(activeLandmark) : undefined;
  const activeReticle = highlightStation
    ? `<rect class="reverse-landmark-reticle" x="${highlightStation.x - 6}" y="${highlightStation.y - 6}" width="${highlightStation.width + 12}" height="${highlightStation.height + 12}" rx="6"/>`
    : '';

  return `<g class="reverse-causal-overlay" data-testid="reverse-causal-overlay" data-active-reverse-landmark="${activeLandmark ?? ''}" data-reverse-route-stop="${learningRouteStop ?? ''}">
    <!-- Truth cue: visual path is explanation playback over real computation, not runtime timing -->
    <g class="reverse-truth-banner">
      <rect class="reverse-truth-bg" x="1350" y="115" width="800" height="34" rx="4"/>
      <text class="reverse-truth-cue" data-testid="reverse-truth-cue" x="1750" y="137" text-anchor="middle">Backward explanation path over the real computation. Visual movement is not runtime timing.</text>
    </g>
    <!-- Conceptual / aggregated region guides -->
    ${guides.join('\n    ')}
    <!-- Real reverse operation edges -->
    ${edges.join('\n    ')}
    <!-- Active reverse landmark highlight -->
    ${activeReticle}
  </g>`;
}

function renderParameterLearningOverlay(
  pin: ParameterPin,
  t?: TrainingProgress,
  m?: LearningModel,
  learningRouteStop?: number,
): string {
  const bounds = parameterLearningBounds(pin);
  const { x, y, width, height } = bounds;
  const bank = stationFor(pin.name);

  const isHighlighted = learningRouteStop === 5 || (t && ['backward', 'backward seed', 'optimizer proposal'].includes(t.phase));

  // Determine gradient and contribution evidence
  const gradient = t ? t.gradient : m?.available ? m.backward.gradient : undefined;
  const isFinal = t ? t.final : m?.available ? true : false;
  const event = t?.contributions.at(-1);

  const pinLabel = `${pin.name}[${pin.row},${pin.column}]`;
  let contributionText = 'Contribution pending: awaiting scalar autograd traversal';
  let accumulatorText = 'Gradient accumulator: partial sum across occurrences';
  let ordinalText = `Selected parameter slice: ${pinLabel}`;

  if (event) {
    contributionText = `Occurrence #${event.ordinal}: ${n(event.childAdjoint)} × ${n(event.localDerivative)} = ${n(event.contribution)}`;
    accumulatorText = `Accumulator: ${n(event.before)} + ${n(event.contribution)} → ${n(event.after)}`;
    ordinalText = `Operand ${event.operand} · child adjoint scalar`;
  } else if (m?.available && m.backward.contributions.length > 0) {
    const first = m.backward.contributions[0];
    contributionText = `Occurrence: ${n(first.childAdjoint)} × ${n(first.localDerivative)} = ${n(first.contribution)}`;
    accumulatorText = `Sum across visible occurrences accounts for gradient`;
    ordinalText = `${m.backward.contributions.length} occurrences recorded`;
  } else if (isFinal) {
    contributionText = 'Backward traversal complete. Final gradient computed.';
    accumulatorText = 'All incoming scalar backward contributions accumulated.';
  }

  return `<g class="parameter-learning-overlay ${isHighlighted ? 'active-learning-anchor' : ''}" data-testid="parameter-learning-overlay" data-parameter-name="${esc(pin.name)}" data-gradient-status="${isFinal ? 'final' : 'partial'}">
    <title>Parameter Learning Overlay · Selected parameter accumulation adjacent to its owner.</title>
    <!-- Tether connecting overlay to parameter bank -->
    <path class="parameter-learning-tether" d="M${bank.x + bank.width} ${bank.y + 40} H${x}"/>
    <!-- Container -->
    <rect class="parameter-overlay-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>
    <text class="param-overlay-tag" x="${x + 16}" y="${y + 24}">SELECTED PARAMETER · ACCUMULATION</text>
    <text class="param-overlay-title" x="${x + 16}" y="${y + 50}">${esc(pinLabel)} → ${esc(parameterOwners[pin.name] ?? 'tokenEmbedding')}</text>
    <!-- Contribution and Accumulator evidence -->
    <text class="param-overlay-calc" data-testid="param-overlay-calc" x="${x + 16}" y="${y + 78}">${esc(contributionText)}</text>
    <text class="param-overlay-accum" data-testid="param-overlay-accum" x="${x + 16}" y="${y + 104}">${esc(accumulatorText)}</text>
    <text class="param-overlay-ordinal" x="${x + 16}" y="${y + 128}">${esc(ordinalText)}</text>
    <!-- Status badge: partial vs final -->
    <line class="param-overlay-divider" x1="${x + 16}" y1="${y + 140}" x2="${x + width - 16}" y2="${y + 140}"/>
    <text class="param-overlay-gradient" data-testid="param-overlay-gradient" x="${x + 16}" y="${y + 164}">
      <tspan class="${isFinal ? 'gradient-final' : 'gradient-partial'}">${isFinal ? 'FINAL' : 'PARTIAL'} GRADIENT:</tspan>
      <tspan class="gradient-val"> ${gradient === undefined ? 'pending' : n(gradient)}</tspan>
    </text>
  </g>`;
}

function renderAdamLearningOverlay(
  pin: ParameterPin,
  t?: TrainingProgress,
  m?: LearningModel,
  learningRouteStop?: number,
): string {
  // Take numerical Adam evidence STRICTLY from live TrainingProgress.proposal or validated completed LearningModel.adam.update
  const u = t?.proposal ?? (m?.available ? m.adam.update : undefined);
  const isAdamStop = learningRouteStop === 6;
  const isHighlighted = isAdamStop || (t && ['optimizer proposal', 'candidate application'].includes(t.phase));

  // If neither proposal evidence exists nor Adam stop/highlight is active, do not render overlay
  if (!u && !isHighlighted) return '';

  const bounds = adamLearningBounds(pin);
  const { x, y, width, height } = bounds;
  const bank = stationFor(pin.name);
  const pinLabel = `${pin.name}[${pin.row},${pin.column}]`;

  if (u) {
    // Authentic proposal evidence available
    return `<g class="adam-learning-overlay ${isHighlighted ? 'active-learning-anchor' : ''}" data-testid="adam-learning-overlay" data-provisional="true" data-proposal-status="available" data-status="ready">
    <title>Adam Optimizer Proposal · Persistent moments and provisional candidate update attached to selected parameter.</title>
    <!-- Tether connecting Adam overlay to parameter bank -->
    <path class="adam-learning-tether" d="M${bank.x + bank.width} ${bank.y + 80} H${x}"/>
    <!-- Container -->
    <rect class="adam-overlay-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>
    <text class="adam-overlay-tag" x="${x + 16}" y="${y + 24}">ADAM OPTIMIZER · PROVISIONAL PROPOSAL</text>
    <text class="adam-overlay-title" x="${x + 16}" y="${y + 48}">θ ${n(u.before)} → provisional candidate θ′ ${n(u.after)}</text>
    <!-- Formulas & values -->
    <g data-testid="adam-proposal-table">
      <text class="adam-overlay-row" x="${x + 16}" y="${y + 74}">State: m ${n(u.mBefore)} / v ${n(u.vBefore)} + final g ${n(u.gradient)}</text>
      <text class="adam-overlay-row" x="${x + 16}" y="${y + 98}">Moments: proposed m′ ${n(u.mAfter)} / v′ ${n(u.vAfter)} · m̂ ${n(u.mHat)} / v̂ ${n(u.vHat)}</text>
      <text class="adam-overlay-row" x="${x + 16}" y="${y + 122}">Delta: stored Δ ${n(u.delta)} · candidate parameter created</text>
    </g>
    <!-- Scope and provisional boundary -->
    <text class="adam-overlay-scope" x="${x + 16}" y="${y + 144}">One slice of full candidate update. Accepted model has not changed.</text>
  </g>`;
  }

  // Pending state: No synthetic numbers manufactured
  return `<g class="adam-learning-overlay ${isHighlighted ? 'active-learning-anchor' : ''}" data-testid="adam-learning-overlay" data-provisional="true" data-proposal-status="pending" data-status="pending">
    <title>Adam Optimizer Proposal Pending · No numerical optimizer proposal has been produced yet.</title>
    <!-- Tether connecting Adam overlay to parameter bank -->
    <path class="adam-learning-tether" d="M${bank.x + bank.width} ${bank.y + 80} H${x}"/>
    <!-- Container -->
    <rect class="adam-overlay-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>
    <text class="adam-overlay-tag" x="${x + 16}" y="${y + 24}">ADAM OPTIMIZER · OPTIMIZER PROPOSAL PENDING</text>
    <text class="adam-overlay-title" x="${x + 16}" y="${y + 48}">Adam proposal pending · candidate unavailable</text>
    <!-- Truthful structural/pending description with dynamic pin label -->
    <text class="adam-overlay-row" x="${x + 16}" y="${y + 74}">Adam combines final gradient with persistent optimizer state (m, v).</text>
    <text class="adam-overlay-row" data-testid="adam-proposal-pending" x="${x + 16}" y="${y + 98}">Optimizer proposal pending: No numerical optimizer proposal has been produced yet.</text>
    <text class="adam-overlay-row" x="${x + 16}" y="${y + 122}">Persistent optimizer state belongs to ${esc(pinLabel)}; proposal is pending.</text>
    <!-- Scope and provisional boundary -->
    <text class="adam-overlay-scope" x="${x + 16}" y="${y + 144}">Accepted model has not changed. Proposal awaits backward pass completion.</text>
  </g>`;
}
