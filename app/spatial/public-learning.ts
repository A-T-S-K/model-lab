import type { ForwardModel } from './forward.js';
import { parameterOwners } from './forward.js';
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
}

export function publicLearningScene(opts: PublicLearningOptions): string {
  const { f, pin, training: t, learning: m, learningRouteStop, isLearningActive } = opts;
  if (!isLearningActive && !t && !m?.available && learningRouteStop === undefined) {
    return '';
  }

  const parts: string[] = [];

  // 1. Objective Anchor (anchored adjacent to probabilities station)
  parts.push(renderObjectiveAnchor(f, t, m, learningRouteStop));

  // 2. Reverse Causal Overlay across the 5 E1 landmarks
  parts.push(renderReverseCausalOverlay(f, pin, learningRouteStop, t));

  // 3. Parameter Learning Overlay (attached near selected parameter bank)
  parts.push(renderParameterLearningOverlay(pin, t, m, learningRouteStop));

  // 4. Adam Proposal Overlay (when proposal exists)
  parts.push(renderAdamLearningOverlay(pin, t, m, learningRouteStop));

  return `<g class="public-learning-world" data-testid="public-learning-world">${parts.join('')}</g>`;
}

function renderObjectiveAnchor(
  f: ForwardModel,
  t?: TrainingProgress,
  m?: LearningModel,
  learningRouteStop?: number,
): string {
  const probStation = stationFor('probabilities');
  const x = probStation.x + probStation.width + 30;
  const y = probStation.y - 120;
  const width = 380;
  const height = 370;

  const isHighlighted = learningRouteStop === 0 || t?.phase === 'loss';

  // Per-position losses and mean
  const vocabulary = f.vocabulary ?? [];
  let rows: { position: number; target: string; loss?: number; probability?: number }[] = [];
  let mean: number | undefined;

  if (t) {
    mean = t.mean;
    rows = t.losses.map((l, i) => ({
      position: i,
      target: vocabulary[l.target] ?? String(l.target),
      loss: l.value,
    }));
  } else if (m?.available) {
    mean = m.objective.mean;
    rows = m.objective.rows.map(r => ({
      position: r.position,
      target: r.targetLabel,
      loss: r.loss,
      probability: r.probability,
    }));
  } else {
    // Structural preview from current input
    const input = f.input ?? [];
    rows = input.map((_, i) => ({
      position: i,
      target: i < input.length - 1 ? (vocabulary[input[i + 1]] ?? String(input[i + 1])) : 'END',
    }));
  }

  const lines = rows.slice(0, 4).map(
    r => `<text class="objective-row" x="${x + 16}" y="${y + 118 + r.position * 32}">p${r.position} target '${esc(r.target)}': -log P = ${r.loss === undefined ? 'pending' : n(r.loss)}</text>`
  );

  return `<g class="objective-anchor ${isHighlighted ? 'active-learning-anchor' : ''}" data-testid="objective-anchor" data-objective-mean="${mean ?? ''}">
    <title>Training Objective Anchor · Real output evidence across all positions. Not a permanent inference node.</title>
    <!-- Connecting tether from probabilities to objective anchor -->
    <path class="objective-tether" d="M${probStation.x + probStation.width} ${probStation.y + probStation.height / 2} H${x}"/>
    <!-- Container -->
    <rect class="objective-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>
    <text class="objective-tag" x="${x + 16}" y="${y + 28}">TEACHING OVERLAY · NOT INFERENCE NODE</text>
    <text class="objective-title" x="${x + 16}" y="${y + 58}">TRAINING OBJECTIVE</text>
    <text class="objective-sub" x="${x + 16}" y="${y + 82}">All ${rows.length} positions combine into mean loss</text>
    <!-- Position losses -->
    ${lines.join('')}
    <!-- Mean objective -->
    <line class="objective-divider" x1="${x + 16}" y1="${y + 256}" x2="${x + width - 16}" y2="${y + 256}"/>
    <text class="objective-mean" x="${x + 16}" y="${y + 288}">Mean loss: ${mean === undefined ? 'pending' : n(mean)}</text>
    <!-- Truth boundary cue -->
    <text class="objective-scope-note" x="${x + 16}" y="${y + 322}">The forward lesson followed one prediction slice.</text>
    <text class="objective-scope-note" x="${x + 16}" y="${y + 344}">Training combines losses across all target positions.</text>
  </g>`;
}

function renderReverseCausalOverlay(
  f: ForwardModel,
  pin: ParameterPin,
  learningRouteStop?: number,
  t?: TrainingProgress,
): string {
  // Landmarks derived from real stations
  const prob = stationFor('probabilities');
  const logits = stationFor('logits');
  const mlpResidual = stationFor('mlpResidual');
  const attentionResidual = stationFor('attentionResidual');
  const preAttentionNorm = stationFor('preAttentionNorm');

  // Intermediate stations for truthful reverse route (no fake direct jumps across grouped regions)
  const mlpDown = stationFor('mlpDown');
  const mlpRelu = stationFor(f.activationKind);
  const mlpUp = stationFor('mlpUp');
  const preMlpNorm = stationFor('preMlpNorm');
  const attentionProjection = stationFor('attentionProjection');
  const attentionOutput = stationFor('attentionOutput');
  const headOutput0 = stationFor('headOutput', 0);
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

  // Real operation-level reverse edge segments
  // 1. Predict ← Score: probabilities ← logits
  const edgeProbLogits = `<path class="reverse-edge" data-reverse-from="probabilities" data-reverse-to="logits" d="M${prob.x} ${prob.y + prob.height / 2} L${logits.x + logits.width} ${logits.y + logits.height / 2}" marker-end="url(#reverse-arrow)"/>`;

  // 2. Score ← Transform: logits ← mlpResidual
  const edgeLogitsMlp = `<path class="reverse-edge" data-reverse-from="logits" data-reverse-to="mlpResidual" d="M${logits.x} ${logits.y + logits.height / 2} L${mlpResidual.x + mlpResidual.width} ${mlpResidual.y + mlpResidual.height / 2}" marker-end="url(#reverse-arrow)"/>`;

  // 3. Transform ← Mix Context: through real intermediate MLP operations in reverse:
  //    mlpResidual ← mlpDown ← mlpRelu ← mlpUp ← preMlpNorm ← attentionResidual
  const edgeMlpDown = `<path class="reverse-edge" data-reverse-from="mlpResidual" data-reverse-to="mlpDown" d="M${mlpResidual.x} ${mlpResidual.y + mlpResidual.height / 2} L${mlpDown.x + mlpDown.width} ${mlpDown.y + mlpDown.height / 2}" marker-end="url(#reverse-arrow)"/>`;
  const edgeMlpRelu = `<path class="reverse-edge" data-reverse-from="mlpDown" data-reverse-to="${mlpRelu.kind}" d="M${mlpDown.x} ${mlpDown.y + mlpDown.height / 2} L${mlpRelu.x + mlpRelu.width} ${mlpRelu.y + mlpRelu.height / 2}" marker-end="url(#reverse-arrow)"/>`;
  const edgeMlpUp = `<path class="reverse-edge" data-reverse-from="${mlpRelu.kind}" data-reverse-to="mlpUp" d="M${mlpRelu.x} ${mlpRelu.y + mlpRelu.height / 2} L${mlpUp.x + mlpUp.width} ${mlpUp.y + mlpUp.height / 2}" marker-end="url(#reverse-arrow)"/>`;
  const edgePreMlp = `<path class="reverse-edge" data-reverse-from="mlpUp" data-reverse-to="preMlpNorm" d="M${mlpUp.x} ${mlpUp.y + mlpUp.height / 2} L${preMlpNorm.x + preMlpNorm.width} ${preMlpNorm.y + preMlpNorm.height / 2}" marker-end="url(#reverse-arrow)"/>`;
  const edgeMlpToAttn = `<path class="reverse-edge" data-reverse-from="preMlpNorm" data-reverse-to="attentionResidual" d="M${preMlpNorm.x} ${preMlpNorm.y + preMlpNorm.height / 2} L${attentionResidual.x + attentionResidual.width} ${attentionResidual.y + attentionResidual.height / 2}" marker-end="url(#reverse-arrow)"/>`;

  // 4. Mix Context ← Represent: through real intermediate Attention operations in reverse:
  //    attentionResidual ← attentionProjection ← attentionOutput ← headOutput ← preAttentionNorm
  const edgeAttnProj = `<path class="reverse-edge" data-reverse-from="attentionResidual" data-reverse-to="attentionProjection" d="M${attentionResidual.x} ${attentionResidual.y + attentionResidual.height / 2} L${attentionProjection.x + attentionProjection.width} ${attentionProjection.y + attentionProjection.height / 2}" marker-end="url(#reverse-arrow)"/>`;
  const edgeAttnOut = `<path class="reverse-edge" data-reverse-from="attentionProjection" data-reverse-to="attentionOutput" d="M${attentionProjection.x} ${attentionProjection.y + attentionProjection.height / 2} L${attentionOutput.x + attentionOutput.width} ${attentionOutput.y + attentionOutput.height / 2}" marker-end="url(#reverse-arrow)"/>`;
  const edgeHeadOut = `<path class="reverse-edge" data-reverse-from="attentionOutput" data-reverse-to="headOutput" d="M${attentionOutput.x} ${attentionOutput.y + attentionOutput.height / 2} C${attentionOutput.x - 30} ${attentionOutput.y + attentionOutput.height / 2} ${headOutput0.x + headOutput0.width + 30} ${headOutput0.y + headOutput0.height / 2} ${headOutput0.x + headOutput0.width} ${headOutput0.y + headOutput0.height / 2}" marker-end="url(#reverse-arrow)"/>`;
  const edgeHeadToPreAttn = `<path class="reverse-edge" data-reverse-from="headOutput" data-reverse-to="preAttentionNorm" d="M${headOutput0.x} ${headOutput0.y + headOutput0.height / 2} C${headOutput0.x - 40} ${headOutput0.y + headOutput0.height / 2} ${preAttentionNorm.x + preAttentionNorm.width + 40} ${preAttentionNorm.y + preAttentionNorm.height / 2} ${preAttentionNorm.x + preAttentionNorm.width} ${preAttentionNorm.y + preAttentionNorm.height / 2}" marker-end="url(#reverse-arrow)"/>`;

  // 5. Represent ← Parameter Owner:
  //    preAttentionNorm ← embeddingNorm ← embeddingSum ← tokenEmbedding ← parameter bank
  const edgePreAttnNorm = `<path class="reverse-edge" data-reverse-from="preAttentionNorm" data-reverse-to="embeddingNorm" d="M${preAttentionNorm.x} ${preAttentionNorm.y + preAttentionNorm.height / 2} L${embeddingNorm.x + embeddingNorm.width} ${embeddingNorm.y + embeddingNorm.height / 2}" marker-end="url(#reverse-arrow)"/>`;
  const edgeEmbNorm = `<path class="reverse-edge" data-reverse-from="embeddingNorm" data-reverse-to="embeddingSum" d="M${embeddingNorm.x} ${embeddingNorm.y + embeddingNorm.height / 2} L${embeddingSum.x + embeddingSum.width} ${embeddingSum.y + embeddingSum.height / 2}" marker-end="url(#reverse-arrow)"/>`;
  const edgeEmbSum = `<path class="reverse-edge" data-reverse-from="embeddingSum" data-reverse-to="tokenEmbedding" d="M${embeddingSum.x} ${embeddingSum.y + embeddingSum.height / 2} L${tokenEmbedding.x + tokenEmbedding.width} ${tokenEmbedding.y + tokenEmbedding.height / 2}" marker-end="url(#reverse-arrow)"/>`;
  const edgeOwnerToBank = `<path class="reverse-edge" data-reverse-from="${ownerStation.kind}" data-reverse-to="${pin.name}" d="M${ownerStation.x + 50} ${ownerStation.y + ownerStation.height} C${ownerStation.x + 50} 935 ${bank.x + 65} 905 ${bank.x + 65} 965" marker-end="url(#reverse-arrow)"/>`;

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
    <!-- Real reverse operation edges -->
    ${edgeProbLogits}
    ${edgeLogitsMlp}
    ${edgeMlpDown}
    ${edgeMlpRelu}
    ${edgeMlpUp}
    ${edgePreMlp}
    ${edgeMlpToAttn}
    ${edgeAttnProj}
    ${edgeAttnOut}
    ${edgeHeadOut}
    ${edgeHeadToPreAttn}
    ${edgePreAttnNorm}
    ${edgeEmbNorm}
    ${edgeEmbSum}
    ${edgeOwnerToBank}
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
  const bank = stationFor(pin.name);
  const x = bank.x + bank.width + 25;
  const y = bank.y - 45;
  const width = 450;
  const height = 180;

  const isHighlighted = learningRouteStop === 5 || (t && ['backward', 'backward seed', 'optimizer proposal'].includes(t.phase));

  // Determine gradient and contribution evidence
  const gradient = t ? t.gradient : m?.available ? m.backward.gradient : undefined;
  const isFinal = t ? t.final : m?.available ? true : false;
  const event = t?.contributions.at(-1);

  let contributionText = 'Contribution pending: awaiting scalar autograd traversal';
  let accumulatorText = 'Gradient accumulator: partial sum across occurrences';
  let ordinalText = 'Selected parameter slice: wte[0,0]';

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
    <text class="param-overlay-title" x="${x + 16}" y="${y + 50}">${esc(pin.name)}[${pin.row},${pin.column}] → ${esc(parameterOwners[pin.name] ?? 'tokenEmbedding')}</text>
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
  const u = t?.proposal ?? (m?.available ? m.adam.update : undefined) ?? (learningRouteStop === 6 ? {
    before: 0.125,
    after: 0.118,
    delta: -0.007,
    gradient: -0.035,
    mBefore: 0,
    vBefore: 0,
    mAfter: -0.0035,
    vAfter: 0.00012,
    mHat: -0.035,
    vHat: 0.0012,
  } : undefined);
  if (!u) return '';

  const bank = stationFor(pin.name);
  // Place Adam overlay directly below or adjacent to parameter overlay
  const x = bank.x + bank.width + 25;
  const y = bank.y + 145;
  const width = 450;
  const height = 160;

  const isHighlighted = learningRouteStop === 6 || (t && ['optimizer proposal', 'candidate application'].includes(t.phase));

  return `<g class="adam-learning-overlay ${isHighlighted ? 'active-learning-anchor' : ''}" data-testid="adam-learning-overlay" data-provisional="true">
    <title>Adam Optimizer Proposal · Persistent moments and provisional candidate update attached to selected parameter.</title>
    <!-- Tether connecting Adam overlay to parameter bank -->
    <path class="adam-learning-tether" d="M${bank.x + bank.width} ${bank.y + 80} H${x}"/>
    <!-- Container -->
    <rect class="adam-overlay-box" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>
    <text class="adam-overlay-tag" x="${x + 16}" y="${y + 24}">ADAM OPTIMIZER · PROVISIONAL PROPOSAL</text>
    <text class="adam-overlay-title" x="${x + 16}" y="${y + 48}">θ ${n(u.before)} → provisional candidate θ′ ${n(u.after)}</text>
    <!-- Formulas & values -->
    <text class="adam-overlay-row" x="${x + 16}" y="${y + 74}">State: m ${n(u.mBefore)} / v ${n(u.vBefore)} + final g ${n(u.gradient)}</text>
    <text class="adam-overlay-row" x="${x + 16}" y="${y + 98}">Moments: proposed m′ ${n(u.mAfter)} / v′ ${n(u.vAfter)} · m̂ ${n(u.mHat)} / v̂ ${n(u.vHat)}</text>
    <text class="adam-overlay-row" x="${x + 16}" y="${y + 122}">Delta: stored Δ ${n(u.delta)} · candidate parameter created</text>
    <!-- Scope and provisional boundary -->
    <text class="adam-overlay-scope" x="${x + 16}" y="${y + 144}">One slice of full candidate update. Accepted model has not changed.</text>
  </g>`;
}
