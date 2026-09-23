import type { ForwardModel, Address } from './forward.js';
import { parameterOwners, addressId } from './forward.js';
import { stationFor } from './scene.js';
import type { TrainingProgress } from '../worker/training-execution.js';
import type { LearningModel, ParameterPin } from './learning.js';
import type { PublicTourState } from './public-tour.js';
import { escapeHtml as esc } from '../views/evidence.js';

const n = (v: number | undefined) => (v === undefined ? 'pending' : Number(v.toPrecision(8)).toString());

export interface PublicLearningOptions {
  readonly f: ForwardModel;
  readonly pin: ParameterPin;
  readonly training?: TrainingProgress;
  readonly learning?: LearningModel;
  readonly learningRouteStop?: number; // 0 = Objective, 1 = Predict, 2 = Score, 3 = Transform, 4 = Mix Context, 5 = Represent, 6 = Parameter, 7 = Adam
  readonly tourState?: PublicTourState;
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
    tourState,
    isLearningActive,
    query = (f.input && f.input.length > 3 ? 3 : (f.input && f.input.length > 0 ? f.input.length - 1 : 0)),
    head = 0,
  } = opts;

  if (!isLearningActive && learningRouteStop === undefined && tourState === undefined) {
    return '';
  }

  const objectiveVisible = tourState
    ? tourState === 'p2_objective'
    : learningRouteStop === 0;
  const parameterVisible = tourState
    ? tourState === 'p2_gradient_contribution' || tourState === 'p2_final_gradient'
    : learningRouteStop === 5;
  const adamVisible = tourState
    ? tourState === 'p2_adam_proposal'
    : learningRouteStop === 6;
  const reverseVisible = tourState
    ? tourState === 'p2_backward_trace' || tourState === 'p2_gradient_contribution' || tourState === 'p2_final_gradient'
    : learningRouteStop !== undefined && learningRouteStop >= 0 && learningRouteStop <= 5;

  if (!objectiveVisible && !parameterVisible && !adamVisible && !reverseVisible) {
    return '';
  }

  const parts: string[] = [];
  if (objectiveVisible) parts.push(renderObjectiveAnchor(f, t, m));
  if (reverseVisible) parts.push(renderReverseCausalOverlay(f, pin, learningRouteStop, t, query, head));
  if (parameterVisible) parts.push(renderParameterLearningOverlay(pin, t, m, tourState));
  if (adamVisible) parts.push(renderAdamLearningOverlay(pin, t, m));

  return `<g class="public-learning-world" data-testid="public-learning-world">${parts.join('')}</g>`;
}

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_OBJECTIVE_ROWS = 6;

export function objectiveLearningBounds(rowsCount = 4): WorldRect {
  const probStation = stationFor('probabilities');
  const visibleRows = Math.min(Math.max(rowsCount, 1), MAX_OBJECTIVE_ROWS);
  const hiddenRows = Math.max(0, rowsCount - visibleRows);
  return {
    x: probStation.x + probStation.width + 30,
    y: probStation.y - 110,
    width: 420,
    height: 162 + visibleRows * 28 + (hiddenRows > 0 ? 20 : 0),
  };
}

export function parameterLearningBounds(pin: ParameterPin): WorldRect {
  const bank = stationFor(pin.name);
  const x = bank.x + bank.width + 25;
  const y = bank.y - 45;
  const width = 540;
  const height = 190;
  return { x, y, width, height };
}

export function adamLearningBounds(pin: ParameterPin): WorldRect {
  const bank = stationFor(pin.name);
  const x = bank.x + bank.width + 25;
  const y = bank.y + 145;
  const width = 560;
  const height = 232;
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
): string {
  type ObjectiveStripRow = {
    position: number;
    target: number;
    targetLabel: string;
    loss?: number;
    origin: 'OBSERVED' | 'DERIVED' | 'PENDING';
  };

  const targetLabel = (target: number) => f.vocabulary?.[target] ?? String(target);
  let rows: ObjectiveStripRow[];

  if (t) {
    rows = t.losses.map((row, position) => ({
      position,
      target: row.target,
      targetLabel: targetLabel(row.target),
      loss: row.value,
      origin: row.value !== undefined ? 'OBSERVED' : 'PENDING',
    }));
  } else if (m?.available) {
    rows = m.objective.rows.map(row => ({
      position: row.position,
      target: row.target,
      targetLabel: row.targetLabel ?? targetLabel(row.target),
      loss: row.loss,
      origin: row.loss === undefined
        ? 'PENDING'
        : row.origin === 'OBSERVED'
          ? 'OBSERVED'
          : row.origin === 'DERIVED'
            ? 'DERIVED'
            : 'PENDING',
    }));
  } else {
    rows = (f.targets ?? []).map((target, position) => ({
      position,
      target,
      targetLabel: targetLabel(target),
      loss: undefined,
      origin: 'PENDING',
    }));
  }

  let mean: number | undefined;
  let meanOrigin: 'OBSERVED' | 'DERIVED' | 'PENDING' = 'PENDING';

  if (t) {
    mean = t.mean;
    meanOrigin = t.mean !== undefined ? 'OBSERVED' : 'PENDING';
  } else if (m?.available) {
    mean = m.objective.mean;
    meanOrigin = mean === undefined
      ? 'PENDING'
      : m.objective.origin === 'OBSERVED'
        ? 'OBSERVED'
        : m.objective.origin === 'DERIVED'
          ? 'DERIVED'
          : 'PENDING';
  }

  const visibleRows = rows.slice(0, MAX_OBJECTIVE_ROWS);
  const hiddenCount = Math.max(0, rows.length - visibleRows.length);
  const { x, y, width, height } = objectiveLearningBounds(rows.length);
  const probStation = stationFor('probabilities');
  const rowsTop = y + 82;
  const rowHeight = 28;
  const meanY = y + height - 42;
  const originY = y + height - 18;

  const rowMarkup = visibleRows.map((row, index) => {
    const rowY = rowsTop + index * rowHeight;
    return `<g class="objective-row" data-testid="objective-row" data-objective-position="${row.position}" data-objective-target="${row.target}" data-objective-loss="${row.loss ?? ''}" data-objective-origin="${row.origin}">
      <text class="objective-row-main" x="${x + 18}" y="${rowY}">position ${row.position} → target '${esc(row.targetLabel)}' → loss ${row.loss === undefined ? 'pending' : n(row.loss)}</text>
      <text class="objective-row-origin" x="${x + width - 18}" y="${rowY}" text-anchor="end">${row.origin}</text>
    </g>`;
  }).join('');

  const hiddenMarkup = hiddenCount > 0
    ? `<text class="objective-more" x="${x + 18}" y="${rowsTop + visibleRows.length * rowHeight}">+${hiddenCount} more target positions · see Details</text>`
    : '';

  return `<g class="objective-anchor active-learning-anchor" data-testid="objective-anchor" data-objective-mean="${mean ?? ''}" data-objective-mean-origin="${meanOrigin}" data-objective-availability="${mean !== undefined ? 'available' : 'pending'}" data-objective-positions="${rows.length}">
    <title>Training objective across the authentic teacher-forced target positions.</title>
    <path class="objective-tether" d="M${probStation.x + probStation.width} ${probStation.y + probStation.height / 2} H${x}"/>
    <rect class="objective-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>
    <text class="objective-title" x="${x + 18}" y="${y + 30}">TRAINING OBJECTIVE</text>
    <text class="objective-scope" x="${x + 18}" y="${y + 56}">POSITION → KNOWN TARGET → LOSS</text>
    ${rowMarkup}
    ${hiddenMarkup}
    <text class="objective-mean" x="${x + 18}" y="${meanY}">Mean loss: ${mean === undefined ? 'pending' : n(mean)}</text>
    <text class="objective-origin" x="${x + 18}" y="${originY}">${meanOrigin}</text>
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
  tourState?: PublicTourState,
): string {
  const { x, y, width, height } = parameterLearningBounds(pin);
  const bank = stationFor(pin.name);
  const pinLabel = `${pin.name}[${pin.row},${pin.column}]`;
  const event = t?.contributions.at(-1);
  const showFinal = tourState === 'p2_final_gradient'
    || (tourState === undefined && (t?.final === true || m?.available === true));

  if (showFinal) {
    const gradient = t?.final === true
      ? t.gradient
      : m?.available
        ? m.backward.gradient
        : undefined;

    return `<g class="parameter-learning-overlay active-learning-anchor" data-testid="parameter-learning-overlay" data-parameter-name="${esc(pin.name)}" data-gradient-status="final">
      <title>Selected parameter final-gradient marker.</title>
      <path class="parameter-learning-tether" d="M${bank.x + bank.width} ${bank.y + 40} H${x}"/>
      <rect class="parameter-overlay-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>
      <text class="param-overlay-tag" x="${x + 18}" y="${y + 32}">SELECTED PARAMETER</text>
      <text class="param-overlay-title" x="${x + 18}" y="${y + 68}">${esc(pinLabel)}</text>
      <text class="param-overlay-gradient" data-testid="param-overlay-gradient" x="${x + 18}" y="${y + 126}">
        <tspan class="gradient-final">FINAL GRADIENT</tspan>
        <tspan class="gradient-val"> ${gradient === undefined ? 'pending' : n(gradient)}</tspan>
      </text>
    </g>`;
  }

  const contribution = event?.contribution;
  const partialGradient = event?.after;

  return `<g class="parameter-learning-overlay active-learning-anchor" data-testid="parameter-learning-overlay" data-parameter-name="${esc(pin.name)}" data-gradient-status="partial" data-contribution-status="${event ? 'available' : 'pending'}">
    <title>Selected parameter gradient-contribution marker.</title>
    <path class="parameter-learning-tether" d="M${bank.x + bank.width} ${bank.y + 40} H${x}"/>
    <rect class="parameter-overlay-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>
    <text class="param-overlay-tag" x="${x + 18}" y="${y + 30}">SELECTED PARAMETER</text>
    <text class="param-overlay-title" x="${x + 18}" y="${y + 64}">${esc(pinLabel)}</text>
    <text class="param-overlay-calc" data-testid="param-overlay-calc" x="${x + 18}" y="${y + 102}">CONTRIBUTION ${contribution === undefined ? 'pending' : n(contribution)}</text>
    <text class="param-overlay-accum" data-testid="param-overlay-accum" x="${x + 18}" y="${y + 136}">${event ? `${n(event.before)} + ${n(event.contribution)} → ${n(event.after)}` : 'Accumulation pending'}</text>
    <text class="param-overlay-gradient" data-testid="param-overlay-gradient" x="${x + 18}" y="${y + 170}">
      <tspan class="gradient-partial">PARTIAL GRADIENT</tspan>
      <tspan class="gradient-val"> ${partialGradient === undefined ? 'pending' : n(partialGradient)}</tspan>
    </text>
  </g>`;
}

function renderAdamLearningOverlay(
  pin: ParameterPin,
  t?: TrainingProgress,
  m?: LearningModel,
): string {
  const u = t?.proposal ?? (m?.available ? m.adam.update : undefined);
  const { x, y, width, height } = adamLearningBounds(pin);
  const bank = stationFor(pin.name);
  const pinLabel = `${pin.name}[${pin.row},${pin.column}]`;

  if (u) {
    return `<g class="adam-learning-overlay active-learning-anchor" data-testid="adam-learning-overlay" data-provisional="true" data-proposal-status="available" data-status="ready">
      <title>Adam provisional proposal for ${esc(pinLabel)} from the completed gradient and stored optimizer state.</title>
      <path class="adam-learning-tether" d="M${bank.x + bank.width} ${bank.y + 80} H${x}"/>
      <rect class="adam-overlay-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>
      <text class="adam-overlay-tag" x="${x + 18}" y="${y + 30}">OPTIMIZER PROPOSAL · ADAM</text>
      <text class="adam-overlay-title" x="${x + 18}" y="${y + 64}">SELECTED PARAMETER · PROVISIONAL</text>
      <text class="adam-overlay-inputs" data-testid="adam-guided-inputs" x="${x + 18}" y="${y + 96}">FINAL GRADIENT ${n(u.gradient)}</text>
      <text class="adam-overlay-inputs" x="${x + 18}" y="${y + 120}">SAVED OPTIMIZER STATE ${n(u.mBefore)} / ${n(u.vBefore)}</text>
      <text class="adam-overlay-value" data-testid="adam-proposal-value" x="${x + 18}" y="${y + 142}">CURRENT ${n(u.before)} → PROPOSED ${n(u.after)}</text>
      <text class="adam-overlay-status" x="${x + 18}" y="${y + 188}">ACCEPTED MODEL UNCHANGED</text>
    </g>`;
  }

  return `<g class="adam-learning-overlay active-learning-anchor" data-testid="adam-learning-overlay" data-provisional="true" data-proposal-status="pending" data-status="pending">
    <title>Adam proposal pending for ${esc(pinLabel)}.</title>
    <path class="adam-learning-tether" d="M${bank.x + bank.width} ${bank.y + 80} H${x}"/>
    <rect class="adam-overlay-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>
    <text class="adam-overlay-tag" x="${x + 18}" y="${y + 30}">OPTIMIZER PROPOSAL · ADAM</text>
    <text class="adam-overlay-title" x="${x + 18}" y="${y + 64}">SELECTED PARAMETER</text>
    <text class="adam-overlay-inputs" data-testid="adam-guided-inputs" x="${x + 18}" y="${y + 102}">FINAL GRADIENT + SAVED OPTIMIZER STATE</text>
    <text class="adam-overlay-value" data-testid="adam-proposal-pending" x="${x + 18}" y="${y + 142}">PENDING</text>
    <text class="adam-overlay-status" x="${x + 18}" y="${y + 188}">ACCEPTED MODEL UNCHANGED</text>
  </g>`;
}
