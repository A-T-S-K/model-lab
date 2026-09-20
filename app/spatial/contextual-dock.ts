import type { SpatialReadModel } from './bindings.js';
import type { Address, Explanation } from './forward.js';
import { operations, parameterOwners } from './forward.js';
import type { ForwardProgress } from '../worker/protocol.js';
import type { TrainingProgress } from '../worker/training-execution.js';
import type { LearningModel, LearningStage, ParameterPin } from './learning.js';
import { outputTokenName, outputSummary, componentComparison, type OutputPair } from './comparison.js';
import { geometry, projection } from './view.js';
import { probabilityColor } from './geometry.js';
import { simplexGlyph } from './scene.js';
import { escapeHtml as esc } from '../views/evidence.js';
import { sourceView } from '../source/catalog.js';
import { fmt, addressLabel, valuesTable, arithmetic, mixture } from './inspector.js';
import { operationConstruction } from './construction.js';
import { parameterLabel, learningStations } from './learning-view.js';
import type { ExperienceProfile } from '../presentation/experience-profile.js';

export type DockDepth = 'explain' | 'values' | 'math' | 'source' | 'compare';

const val = (v: number | undefined, id = '') => `<span ${id ? `data-testid="${id}"` : ''} data-value="${v ?? ''}" title="${v ?? 'unavailable'}">${fmt(v)}</span>`;

export interface PublicTrainingActionState {
  readonly executionId: string;
  readonly sequence: number;
  readonly phase: string;
  readonly ready: boolean;
  readonly disabled: boolean;
  readonly cancelling: boolean;
  readonly canPin: boolean;
  readonly pinLabel: string;
  readonly frontierText: string;
  readonly acceptedStep: number;
  readonly pinnedParameter: string;
}

export interface ContextualDockOptions {
  readonly model?: SpatialReadModel;
  readonly address: Address;
  readonly element: number;
  readonly parameter?: string;
  readonly row: number;
  readonly column: number;
  readonly pin: ParameterPin;
  readonly scalar: string;
  readonly depth: DockDepth;
  readonly profile: ExperienceProfile;
  readonly freeExplore: boolean;
  readonly attract?: boolean;
  readonly trainingState?: PublicTrainingActionState;
  readonly lessonProgress: string;
  readonly routePurpose: string;
  readonly primaryAction: string;
  readonly attentionAction: string;
  readonly shortDetour: boolean;
  readonly shortMessage: string;
  readonly operatorControls: boolean;
  readonly executionProgress?: ForwardProgress;
  readonly trainingProgress?: TrainingProgress;
  readonly learningStage?: LearningStage;
  readonly learningModel?: LearningModel;
  readonly comparison?: { before: any; after: any };
  readonly outputPair?: OutputPair;
  readonly comparisonLabels?: [string, string];
  readonly hasComparison: boolean;
  readonly learningRouteStop?: number;
}

function renderExplain(opts: ContextualDockOptions): string {
  const { model: m, address: a, element, parameter, pin, executionProgress, trainingProgress, learningStage, learningModel, learningRouteStop, attract, trainingState } = opts;
  if (!m) return '<p>No model loaded.</p>';

  if (attract) {
    return `<div class="dock-explain-content" data-testid="dock-explain">
      <div class="idle-explanation">
        <strong>RECORDED RUN · REPLAY</strong>
        <p>Recorded real run. Not live. Start to make a fresh prediction, then follow the numbers through attention.</p>
      </div>
    </div>`;
  }

  if (trainingProgress) {
    const t = trainingProgress;
    const isBackward = t.phase === 'backward' || t.phase === 'backward seed';
    const truthCue = isBackward
      ? `<p class="reverse-truth-cue" data-testid="reverse-truth-cue">Backward explanation path over the real computation. Visual movement is not runtime timing.</p>`
      : '';
    const bridge = `<div class="learning-bridge" data-testid="learning-bridge" aria-label="Prediction to learning causal bridge"><div class="bridge-chain"><span class="bridge-step">1 · Predictions for known targets</span><span class="bridge-arrow" aria-hidden="true">→</span><span class="bridge-step">2 · Per-position losses combine into training objective</span><span class="bridge-arrow" aria-hidden="true">→</span><span class="bridge-step">3 · Backpropagation carries backward signal</span><span class="bridge-arrow" aria-hidden="true">→</span><span class="bridge-step">4 · Parameter uses produce gradient contributions</span><span class="bridge-arrow" aria-hidden="true">→</span><span class="bridge-step">5 · Contributions accumulate into final gradient</span><span class="bridge-arrow" aria-hidden="true">→</span><span class="bridge-step">6 · Adam uses final gradient for parameter proposal</span><span class="bridge-arrow" aria-hidden="true">→</span><span class="bridge-step">7 · Provisional candidate: Accept or Discard</span></div><p class="bridge-scope">We follow one selected parameter (${esc(parameterLabel(pin))}) to observe one real contribution arrive and accumulate into its partial gradient. The combined training objective uses losses across all target positions, and candidate proposals remain provisional until accepted.</p></div>`;
    const guidance = trainingState && !trainingState.ready
      ? `<p class="learning-guidance" data-testid="learning-guidance">Run to next gradient contribution runs the required phases, then pauses after the next matching backward node for the pinned parameter. Repeated operands in one node finish together. Continue runs to Candidate ready; Accept / Discard remains your decision.</p>`
      : '';
    return `<div class="dock-explain-content" data-testid="dock-explain">
      ${bridge}
      <p class="learning-scope">Live training · ${esc(t.phase)} · accepted step ${t.acceptedStep} → proposed step ${t.acceptedStep + 1} provisional</p>
      <div class="dock-pin-info"><span data-testid="pin-owner">${esc(pin.name)} → ${esc(operations.find(o=>o.kind===parameterOwners[pin.name])?.title??pin.name)} · same global owner · accepted ${esc(t.startingSnapshotId.slice(0,12))}</span></div>
      <p class="learning-gradient-summary">${t.final ? 'Final' : 'Partial'} gradient: <span data-testid="live-gradient" data-value="${t.gradient}">${t.gradient === undefined ? 'pending' : fmt(t.gradient)}</span></p>
      <p class="learning-mechanism">Parameter uses contribute and accumulate: each backward occurrence calculates a child adjoint × local derivative contribution and adds it to the parameter gradient accumulator.</p>
      ${truthCue}
      ${t.proposal ? `<p class="learning-provisional">Candidate proposal: θ ${fmt(t.proposal.before)} → ${fmt(t.proposal.after)} · provisional until explicitly accepted.</p>` : ''}
      ${guidance}
      <p>Pinned ${esc(parameterLabel(pin))}. Losses across all positions enter the objective; candidate proposals remain provisional until accepted.</p>
    </div>`;
  }

  if (learningRouteStop !== undefined && learningRouteStop >= 0) {
    let narrative = '';
    if (learningRouteStop === 0) {
      narrative = `<p>Training Objective: Predictions are compared with known targets across all positions to calculate loss. The average of all target losses forms the single training objective. The forward lesson followed one selected prediction occurrence (p3). Training combines losses across all target positions.</p><p class="reverse-truth-cue" data-testid="reverse-truth-cue">Backward explanation path over the real computation. Visual movement is not runtime timing.</p>`;
    } else if (learningRouteStop >= 1 && learningRouteStop <= 4) {
      narrative = `<p>Backward Explanation: Sensitivity propagates backward through the exact computation that produced predictions. We are following one selected prediction slice backward through the model to understand the computation. The selected parameter's actual gradient can receive contributions from many scalar paths and positions.</p><p class="reverse-truth-cue" data-testid="reverse-truth-cue">Backward explanation path over the real computation. Visual movement is not runtime timing.</p>`;
    } else if (learningRouteStop === 5) {
      narrative = `<p>Parameter Accumulation: We are inspecting one parameter (${esc(parameterLabel(pin))}). Parameter uses contribute and accumulate: each backward occurrence calculates a child adjoint × local derivative contribution and adds it to the parameter gradient accumulator. Partial gradient updates until all occurrences finish.</p><p class="reverse-truth-cue" data-testid="reverse-truth-cue">Backward explanation path over the real computation. Visual movement is not runtime timing.</p>`;
    } else if (learningRouteStop === 6) {
      narrative = `<p>Adam Proposal: Adam will combine the final gradient with persistent optimizer state to propose a new parameter value. Provisional proposal; accepted model has not changed.</p><p class="reverse-truth-cue" data-testid="reverse-truth-cue">Backward explanation path over the real computation. Visual movement is not runtime timing.</p>`;
    }
    return `<div class="dock-explain-content" data-testid="dock-explain"><section class="teaching-step" data-testid="learning-teaching-step">${narrative}</section></div>`;
  }

  if (learningStage && learningModel && learningModel.available) {
    const narrative: Record<LearningStage, string> = {
      objective: `All ${learningModel.objective.rows.length} target probabilities enter −log P; the mean of those losses is ${fmt(learningModel.objective.mean)}. This objective supplies the backward pass.`,
      gradient: `For ${parameterLabel(pin)}, each available child adjoint × local derivative contributes to the final gradient ${fmt(learningModel.backward.gradient)}. Visible and hidden occurrences below account for the sum.`,
      adam: `The final gradient and prior moments enter Adam. Recorded moment updates and bias corrections produce the stored parameter.`,
      checkpoint: `The complete updated parameter and optimizer state becomes the next checkpoint.`,
      compare: `The same input enters the resulting checkpoint. Fresh outputs are compared on shared original-component scales.`
    };
    return `<div class="dock-explain-content" data-testid="dock-explain"><section class="teaching-step" data-testid="learning-teaching-step"><p>${esc(narrative[learningStage])}</p></section></div>`;
  }

  const c = operationConstruction(m, a, element, executionProgress);

  return `<div class="dock-explain-content" data-testid="dock-explain">
    <div class="dock-essential-result" data-testid="scene-construction" data-run="${esc(m.source.sourceRunId)}">
      <header class="construction-header"><strong>${esc(addressLabel(a))}</strong><span>${executionProgress ? 'ACTIVE EXECUTION' : esc(m.source.relationship)} · input ${esc(m.source.capturedDocument)}</span></header>
      ${c.purpose ? `<p class="construction-purpose">${esc(c.purpose)}</p>` : ''}
      ${c.essentialSummary}
      ${c.notes ? `<p class="construction-notes">${esc(c.notes)}</p>` : ''}
    </div>
  </div>`;
}

function stepTeachingSection(m: SpatialReadModel, a: Address, element: number): string {
  const f = m.forward;
  const e = f.explain(a, element);
  const inputs = e.upstream.map((d: { address: Address }) => addressLabel(d.address)).join(', ');
  const next = e.downstream.map((d: { address: Address }) => addressLabel(d.address)).slice(0, 4).join(', ') || 'prediction readout';

  const calculation = e.zeroed ? 'Declared intervention: aggregated head output replaced with constant zero before concatenation' :
    e.definition?.family === 'linear' ? `Σ input[j] × W[${element},j] = ${fmt(e.terms?.reduce((sum: number, t: { product: number }) => sum + t.product, 0))}` :
    e.definition?.family === 'norm' ? `${fmt(e.inputs?.[element])} × (mean square ${fmt(e.meanSquare)} + 0.00001)⁻½` :
    e.definition?.family === 'add' ? `${e.pairs?.map(fmt).join(' + ')}` :
    e.definition?.family === 'scale' ? `${fmt(e.inputs?.[element])} × fixed s ${fmt(e.fixedScale)}` :
    e.definition?.family === 'constant' ? `fixed definition constant s = ${fmt(e.fixedScale)}` :
    e.definition?.family === 'lookup' ? `${e.definition.parameter}[${e.lookupRow},${element}] = ${fmt(e.parameter?.[e.lookupRow]?.[element])}` :
    e.definition?.family === 'relu' ? (a.kind === 'mlpLeakyRelu' ? `${fmt(e.before)} > 0 ? x : 0.01 × x` : `max(0, ${fmt(e.before)})`) :
    e.definition?.family === 'softmax' ? `exp(${fmt(e.scoreInputs?.[element])} − ${fmt(e.maximum)}) / ${fmt(e.denominator)}` :
    e.definition?.family === 'score' ? `Σ Q[j] × K[j] = ${fmt(m.geometry?.dot)}; divide by √${m.width}` :
    e.definition?.family === 'mixture' ? (e.zeroed ? `Derived reconstruction: Σ α[key] × V[key,${element}] = ${fmt(e.derivedReconstruction)} → declared constant output = 0` : `Σ α[key] × V[key,${element}] = ${fmt(e.mixture?.mixture[element])}`) :
    `Copy head ${Math.floor(element / e.headWidth)}, channel ${element % e.headWidth} into concatenated channel ${element}`;

  return `<section class="teaching-step" data-testid="teaching-step">
    <p><b>Inputs</b> ${esc(inputs || 'captured token / position ID')}</p>
    <p><b>Calculation</b> ${esc(calculation)}. ${esc(e.definition?.purpose ?? '')}</p>
    <p><b>Result</b> Component [${element}] = ${val(e.observed)}. Next consumer: ${esc(next)}.</p>
  </section>`;
}

function renderValues(opts: ContextualDockOptions): string {
  const { model: m, address: a, element, parameter, row, column, pin, trainingProgress, learningStage, learningModel, learningRouteStop } = opts;
  if (!m) return '<p>No model loaded.</p>';

  if (learningRouteStop === 6) {
    const u = trainingProgress?.proposal ?? (learningModel?.available ? learningModel.adam.update : undefined);
    const pinLabel = `${pin.name}[${pin.row},${pin.column}]`;
    if (u) {
      return `<div class="dock-values-content" data-testid="dock-values">
        <h3>Adam Optimizer Proposal · ${esc(pinLabel)}</h3>
        <p data-testid="adam-proposal-available">Candidate parameter update proposed for ${esc(pinLabel)}</p>
        <table data-testid="adam-proposal-table">
          <thead><tr><th>Field</th><th>Value</th></tr></thead>
          <tbody>
            <tr><th>θ before</th><td>${val(u.before)}</td></tr>
            <tr><th>Gradient g</th><td>${val(u.gradient)}</td></tr>
            <tr><th>Moment m (before → after)</th><td>${val(u.mBefore)} → ${val(u.mAfter)}</td></tr>
            <tr><th>Moment v (before → after)</th><td>${val(u.vBefore)} → ${val(u.vAfter)}</td></tr>
            <tr><th>Bias-corrected m̂ / v̂</th><td>${val(u.mHat)} / ${val(u.vHat)}</td></tr>
            <tr><th>Update Δ</th><td>${val(u.delta)}</td></tr>
            <tr><th>Proposed candidate θ′</th><td>${val(u.after)}</td></tr>
          </tbody>
        </table>
        <p class="learning-provisional">Provisional proposal; accepted model has not changed.</p>
      </div>`;
    }
    return `<div class="dock-values-content" data-testid="dock-values">
      <h3>Adam Optimizer Proposal · ${esc(pinLabel)}</h3>
      <p data-testid="adam-proposal-pending">Adam proposal pending. No numerical optimizer proposal has been produced yet.</p>
      <p>Persistent optimizer state (first moment m and second moment v) belongs to ${esc(pinLabel)}. Numerical proposal will be calculated once the backward pass produces a final gradient.</p>
      <p class="learning-provisional">Provisional proposal; accepted model has not changed.</p>
    </div>`;
  }

  if (trainingProgress) {
    const t = trainingProgress;
    return `<div class="dock-values-content" data-testid="dock-values">
      <h3>All-position target losses (${t.losses.length} positions)</h3>
      <table data-testid="training-objective"><thead><tr><th>Position</th><th>Target ID</th><th>Loss (-log P) [origin]</th></tr></thead><tbody>${t.losses.map((l, i) => `<tr><th>p${i}</th><td>target ${l.target}</td><td>${val(l.value)} [${l.value !== undefined ? 'OBSERVED' : 'PENDING'}]</td></tr>`).join('')}</tbody></table>
      ${t.losses.map((l, i) => `<p>p${i} target ${l.target}: ${l.value === undefined ? 'pending' : fmt(l.value)} [${l.value !== undefined ? 'OBSERVED' : 'PENDING'}]</p>`).join('')}
      <p>Ordered mean: ${t.mean === undefined ? 'pending' : fmt(t.mean)} [${t.mean !== undefined ? 'OBSERVED' : 'PENDING'}]</p>
    </div>`;
  }

  if (learningRouteStop === 0) {
    if (learningModel && learningModel.available) {
      return `<div class="dock-values-content" data-testid="dock-values">
        <h3>All-position training objective (${learningModel.objective.rows.length} positions)</h3>
        <table data-testid="training-objective"><thead><tr><th>Position</th><th>Target token</th><th>P(target) [origin]</th><th>−log P [origin]</th></tr></thead><tbody>${learningModel.objective.rows.map(r => `<tr><th>p${r.position} / ${esc(r.inputLabel)} (${r.input})</th><td>${esc(r.targetLabel)} (${r.target})</td><td>${val(r.probability)} [${r.origin}]</td><td>${val(r.loss)} [${r.origin}]</td></tr>`).join('')}</tbody></table>
        <p>Ordered mean loss: ${val(learningModel.objective.mean, 'training-mean')} [${learningModel.objective.origin}]</p>
      </div>`;
    }
    const f = m.forward;
    const vocab = f.vocabulary ?? [];
    const input = f.input ?? [];
    const targets = f.targets;
    const rows = input.map((inp, i) => {
      let targetLabel = 'unavailable';
      let targetVal: number | string = 'unavailable';
      if (targets && i < targets.length && targets[i] !== undefined) {
        targetVal = targets[i];
        targetLabel = vocab[targets[i]] ?? String(targets[i]);
      }
      return { position: i, input: inp, inputLabel: vocab[inp] ?? String(inp), target: targetVal, targetLabel };
    });
    return `<div class="dock-values-content" data-testid="dock-values">
      <h3>All-position training objective (${rows.length} positions)</h3>
      <table data-testid="training-objective"><thead><tr><th>Position / input</th><th>Target token</th><th>Loss (-log P) [origin]</th></tr></thead><tbody>${rows.map(r => `<tr><th>p${r.position} (${esc(r.inputLabel)})</th><td>${esc(r.targetLabel)} (${r.target})</td><td>pending [PENDING]</td></tr>`).join('')}</tbody></table>
      <p>The forward route followed one prediction slice; learning combines losses across all ${rows.length} positions into the mean training objective.</p>
    </div>`;
  }

  if (learningStage && learningModel && learningModel.available) {
    if (learningStage === 'objective') {
      return `<div class="dock-values-content" data-testid="dock-values">
        <h3>All ${learningModel.objective.rows.length} positions → mean objective</h3>
        <table data-testid="training-objective"><thead><tr><th>Position / input ID</th><th>Target ID</th><th>P(target) [origin]</th><th>−log P [origin]</th></tr></thead><tbody>${learningModel.objective.rows.map(r => `<tr><th>${r.position} / ${esc(r.inputLabel)} (${r.input})</th><td>${esc(r.targetLabel)} (${r.target})</td><td>${val(r.probability)} [${r.origin}]</td><td>${val(r.loss)} [${r.origin}]</td></tr>`).join('')}</tbody></table>
        <p>Σ position losses / ${learningModel.objective.rows.length} ≈ ${val(learningModel.objective.mean, 'training-mean')} [${learningModel.objective.origin}]</p>
      </div>`;
    }
  }

  const f = m.forward;
  if (parameter) {
    const matrix = f.matrix(parameter), rows = matrix?.length ?? 0, cols = matrix?.[0]?.length ?? 0;
    const option = (n: number, selected: number) => `${selected >= n ? `<option selected value="${selected}">${selected} unavailable</option>` : ''}${Array.from({ length: n }, (_, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${i}</option>`).join('')}`;
    return `<div class="dock-values-content" data-testid="dock-values">
      <h3>Persistent checkpoint matrix · ${rows} × ${cols}</h3>
      <div class="controls"><label>Output / lookup row<select id="parameter-row">${option(rows, row)}</select></label><label>Input column<select id="parameter-column">${option(cols, column)}</select></label></div>
      <p>${esc(parameter)}[${row},${column}] = ${val(matrix?.[row]?.[column])}</p>
      <div class="table-scroll"><table data-testid="parameter-matrix"><tbody>${matrix?.map((r, i) => `<tr><th>${i}</th>${r.map((v, j) => `<td><button data-parameter-cell="${i},${j}" data-value="${v}" title="${v}">${fmt(v)}</button></td>`).join('')}</tr>`).join('') ?? 'unavailable'}</tbody></table></div>
      <button id="parameter-output">Follow this row to its output / scalar operands</button>
    </div>`;
  }

  const e = f.explain(a, element);
  const outputView = ['logits', 'probabilities'].includes(a.kind);
  return `<div class="dock-values-content" data-testid="dock-values">
    <h3>All ${e.output?.length ?? 0} components · selected [${element}]</h3>
    ${valuesTable(e, outputView ? f.vocabulary : undefined)}
    <p>Observed selected output: ${val(e.observed)}</p>
    ${a.kind === 'attentionLogits' || a.kind === 'attentionProbabilities' ? `<h3>Causal scope · query ${a.token}, all ${f.input.length} positions</h3><div class="causal-row">${f.input.map((_, i) => `<button data-spatial-key="${i}" ${i === m.selection.key ? 'aria-pressed="true"' : ''} style="--probability:${probabilityColor(f.values({ kind: 'attentionProbabilities', token: a.token, head: a.head })?.[i])}">${i}<br>${i > a.token ? 'future · NA' : fmt(f.values({ kind: 'attentionProbabilities', token: a.token, head: a.head })?.[i])}</button>`).join('')}</div>` : ''}
  </div>`;
}

function renderMath(opts: ContextualDockOptions): string {
  const { model: m, address: a, element, scalar, executionProgress, trainingProgress, learningStage, learningModel, pin, learningRouteStop } = opts;
  if (!m) return '<p>No model loaded.</p>';

  if (learningRouteStop === 6) {
    const u = trainingProgress?.proposal ?? (learningModel?.available ? learningModel.adam.update : undefined);
    return `<div class="dock-math-content" data-testid="dock-math">
      <h3>Adam Optimizer Equations</h3>
      <p>First moment: m′ = β₁ · m + (1 − β₁) · g</p>
      <p>Second moment: v′ = β₂ · v + (1 − β₂) · g²</p>
      <p>Bias-corrected: m̂ = m′ / (1 − β₁ᵗ), v̂ = v′ / (1 − β₂ᵗ)</p>
      <p>Parameter update: θ′ = θ − α · m̂ / (√v̂ + ε)</p>
      ${u ? `<div class="adam-chain" data-testid="live-proposal"><section>Old θ ${fmt(u.before)} · m ${fmt(u.mBefore)} · v ${fmt(u.vBefore)}<br>Final g ${fmt(u.gradient)}</section><span>↓</span><section>m′ = β₁m + (1−β₁)g · Proposed m′ ${fmt(u.mAfter)} / v′ ${fmt(u.vAfter)}<br>m̂ ${fmt(u.mHat)} · v̂ ${fmt(u.vHat)}</section><span>↓</span><section>Stored Δ ${fmt(u.delta)} → candidate θ′ ${fmt(u.after)}</section></div>` : `<p class="proposal-pending" data-testid="proposal-pending">Numerical proposal pending: No optimizer proposal has been produced yet.</p>`}
      <p class="learning-provisional">Adam update formula proposes candidate parameter. Remains provisional until accepted.</p>
    </div>`;
  }

  if (trainingProgress) {
    const t = trainingProgress, e = t.contributions.at(-1), u = t.proposal;
    const n = (v: number | undefined) => v === undefined ? 'pending' : Number(v.toPrecision(8)).toString();
    const mark = (v: number) => `<span class="live-signed-track"><i style="left:${v < 0 ? 50 - 50 * Math.min(1, Math.abs(v)) : 50}%;width:${50 * Math.min(1, Math.abs(v))}%;background:${v < 0 ? '#DC7C7C' : '#58B98C'}"></i></span>`;
    return `<div class="dock-math-content" data-testid="dock-math">
      <section class="live-learning" data-testid="live-learning-arithmetic">
        <div class="dock-pin-info"><span data-testid="pin-owner">${esc(pin.name)} → ${esc(operations.find(o=>o.kind===parameterOwners[pin.name])?.title??pin.name)} · same global owner · accepted ${esc(t.startingSnapshotId.slice(0,12))}</span></div>
        <h3>${t.final ? 'Final' : 'Partial'} gradient <span data-testid="live-gradient" data-value="${t.gradient}">${n(t.gradient)}</span></h3>
        ${e ? `<p>Occurrence ${e.ordinal} · operand ${e.operand} · child <button data-live-child="${e.child}" data-live-source="${esc(t.gradientSourceRunId)}">scalar ${e.child}</button></p>
        <p data-testid="live-contribution">${n(e.childAdjoint)} × ${n(e.localDerivative)} = ${n(e.contribution)}</p>
        <div class="live-arithmetic-row">Contribution ${mark(e.contribution)} ${n(e.contribution)}</div>
        <div class="live-arithmetic-row">Accumulator ${mark(e.before)} ${n(e.before)}</div>
        <div class="live-arithmetic-row">After addition ${mark(e.after)} ${n(e.after)}</div>
        <p class="live-scale">Signed marks: fixed −1…+1, clipped at endpoints; exact numbers shown. Count is separate from magnitude.</p>` : (t.final ? '<p>Traversal complete. The final gradient is known, including zero. No live occurrences are retained for this pin; earlier history is not reconstructed.</p>' : '<p>Contribution pending. Inspection grants no work.</p>')}
      </section>
      ${u ? `<div class="adam-chain" data-testid="live-proposal"><section>Old θ ${fmt(u.before)} · m ${fmt(u.mBefore)} · v ${fmt(u.vBefore)}<br>Final g ${fmt(u.gradient)}</section><span>↓</span><section>m′ = β₁m + (1−β₁)g · Proposed m′ ${fmt(u.mAfter)} / v′ ${fmt(u.vAfter)}<br>m̂ ${fmt(u.mHat)} · v̂ ${fmt(u.vHat)}</section><span>↓</span><section>Stored Δ ${fmt(u.delta)} → candidate θ′ ${fmt(u.after)}</section></div>` : ''}
      <section class="spatial-scalar" id="microscope"><h3>Scalar / source inspection</h3>${scalar}</section>
    </div>`;
  }

  if (learningStage && learningModel && learningModel.available) {
    const u = learningModel.adam.update!, back = learningModel.backward;
    if (learningStage === 'adam') {
      return `<div class="dock-math-content" data-testid="dock-math">
        <div class="adam-chain"><section><b>Gradient</b><p>g ${val(u.gradient, 'adam-gradient')}</p><b>State</b><p>θ before ${val(u.before)}<br>m before ${val(u.mBefore, 'adam-m-before')}<br>v before ${val(u.vBefore, 'adam-v-before')}</p></section><span>↓</span><section><b>Moments</b><p>m′ ≈ ${val(u.mAfter, 'adam-m-after')}<br>v′ ≈ ${val(u.vAfter, 'adam-v-after')}</p></section><span>↓</span><section><b>Update</b><p>θ′ = θ − q<br>${val(u.before, 'adam-before')} → ${val(u.after, 'adam-after')}<br>Δ ${val(u.delta, 'adam-delta')}</p></section></div>
        <section class="spatial-scalar" id="microscope"><h3>Scalar inspection</h3>${scalar}</section>
      </div>`;
    }
    if (learningStage === 'gradient') {
      return `<div class="dock-math-content" data-testid="dock-math">
        <p>Recorded gradient ${val(back.gradient, 'learning-gradient')}</p>
        ${back.fanInAvailable ? `<table data-testid="learning-contributions"><thead><tr><th>Occurrence</th><th>Child adjoint</th><th>Local derivative</th><th>Contribution</th></tr></thead><tbody>${back.visible.map(edge => `<tr><td>edge ${edge.id}</td><td>${val(edge.childAdjoint)}</td><td>${val(edge.localDerivative)}</td><td>${val(edge.contribution)}</td></tr>`).join('')}</tbody></table>` : ''}
        <section class="spatial-scalar" id="microscope"><h3>Scalar inspection</h3>${scalar}</section>
      </div>`;
    }
  }

  if (learningRouteStop !== undefined) {
    if (learningRouteStop === 5) {
      return `<div class="dock-math-content" data-testid="dock-math">
        <h3>Parameter Contribution Math · ${esc(pin.name)}</h3>
        <p>Each use of the parameter in the computational graph receives a backward signal:</p>
        <p class="math-eq">contribution = child adjoint × local derivative</p>
        <p>Accumulator: sum of all incoming contributions produces the parameter gradient.</p>
        ${scalar ? `<section class="spatial-scalar" id="microscope"><h3>Scalar inspection</h3>${scalar}</section>` : ''}
      </div>`;
    }
  }

  const f = m.forward;
  const e = f.explain(a, element);
  const c = operationConstruction(m, a, element, executionProgress);

  return `<div class="dock-math-content" data-testid="dock-math">
    ${stepTeachingSection(m, a, element)}
    ${c.detailMath}
    ${arithmetic(e, element)}
    ${a.kind === 'attentionLogits' ? `
      <table data-testid="qk-products"><thead><tr><th>j</th><th>Q</th><th>K</th><th>Q × K</th></tr></thead><tbody>${m.lens?.q?.map((q, j) => `<tr><th>${j}</th><td>${val(q)}</td><td>${val(m.lens?.k?.[j])}</td><td>${val(m.lens?.k?.[j] === undefined ? undefined : q * m.lens.k[j])}</td></tr>`).join('') ?? ''}</tbody></table>
      <p>Σ component products = ${val(m.geometry?.dot)}; divide by √${m.width} = ${val(m.lens?.scaled)} → observed selected score ${val(e.observed)} in the complete causal row.</p>
      <details><summary>Complete vector values and artifact sources</summary><p>Q [${m.lens?.q?.map(fmt).join(', ') ?? 'unavailable'}]</p><p>K [${m.lens?.k?.map(fmt).join(', ') ?? 'unavailable'}]</p><p>Q <code data-testid="spatial-q-artifact">${esc(m.q?.id ?? 'unavailable')}</code><br>Score <code data-testid="spatial-score-artifact">${esc(m.heads[m.selection.head]?.scores?.id ?? 'unavailable')}</code></p></details>
      <h3>Q projection · source row</h3>${projection(m)}` : ''}
    ${a.kind === 'headOutput' && !e.zeroed ? mixture(e, element) : ''}
    ${e.simplex ? `<svg class="output-simplex" viewBox="0 0 360 290" aria-label="Probability tetrahedron with calculated barycenter">${simplexGlyph(e.simplex.vertices, e.simplex.point, 180, 145, 76, Array.from({ length: e.output?.length ?? 0 }, (_, i) => outputTokenName(i, f.vocabulary)))}</svg>` : ''}
    <section class="spatial-scalar" id="microscope">
      <h3>Scalar / source inspection</h3>
      ${e.indexValid && e.artifact ? `<button data-artifact="${esc(e.artifact.id)}" data-element="${element}">Inspect selected scalar in Microscope</button>` : ''}
      ${scalar}
    </section>
  </div>`;
}

function renderSource(opts: ContextualDockOptions): string {
  const { model: m, address: a, element, parameter, pin, learningModel } = opts;
  if (!m) return '<p>No model loaded.</p>';

  const f = m.forward;
  const e = f.explain(a, element);
  const owner = parameter ? f.parameterOwners[parameter] : undefined;
  const links = (direction: 'upstream' | 'downstream') => (parameter ? direction === 'upstream' ? [] : [{ address: { kind: owner?.kind ?? parameterOwners[parameter], token: a.token, ...(owner?.layer === undefined ? {} : { layer: owner.layer }) }, port: 'parameter owner', type: 'parameter' }] : e[direction]).map(d => `<button data-dependency="${esc(JSON.stringify(d.address))}">${esc(addressLabel(d.address))}<small>${esc(d.port)} · ${esc(d.type)}</small></button>`).join('') || '<p>No captured dependency in this direction.</p>';

  return `<div class="dock-source-content" data-testid="dock-source">
    <div class="dock-provenance-grid">
      <p>Run: <code data-testid="spatial-run">${esc(m.source.sourceRunId)}</code></p>
      <p>Artifact: <code data-testid="forward-artifact">${esc(e.artifact?.id ?? 'NOT CAPTURED')}</code></p>
      <p>Snapshot: <code data-testid="spatial-snapshot">${esc(m.source.sourceSnapshotId ?? 'unavailable')}</code></p>
      <p>Runtime: <code data-testid="spatial-runtime">${esc(m.runtime)}</code></p>
      <p data-testid="semantic-address">Semantic ID: <code>${esc(e.semanticId)}</code></p>
    </div>
    ${parameter ? (() => {
      const detail = f.parameterDetails[parameter];
      return `<p data-testid="parameter-ownership">Definition <code>${esc(detail?.definition ?? f.descriptor.modelDefinition)}</code> · owner <code>${esc(detail?.owner?.kind ?? 'unresolved')}</code> · <strong>${esc(detail?.trainability ?? 'unknown')}</strong> · optimizer ${detail?.optimizerMembership === true ? 'member' : 'not a member'}<br>Shape [${detail?.axes?.join(' × ') ?? 'unavailable'}] · ${esc(detail?.dtype ?? 'unknown')}</p>`;
    })() : ''}
    <section class="dependency-choices">
      <h3>Upstream · choose an operand</h3>
      <div data-testid="upstream-choices">${links('upstream')}</div>
      <h3>Downstream · choose a consumer</h3>
      <div data-testid="downstream-choices">${links('downstream')}</div>
    </section>
    <details><summary>Read operation source</summary>${sourceView(a.kind)}</details>
  </div>`;
}

function renderCompare(opts: ContextualDockOptions): string {
  const { address: a, comparison, comparisonLabels, outputPair } = opts;
  const labels = comparisonLabels ?? ['Before', 'After'];
  let outputContent = '';
  if (outputPair && outputPair.before?.manifest?.input && outputPair.after?.manifest?.input) {
    const inputLen = (outputPair.before.manifest.targets as readonly number[] | undefined)?.length ?? (outputPair.before.manifest.input as readonly number[] | undefined)?.length ?? 0;
    const position = typeof a.token === 'number' && a.token >= 0 && a.token < inputLen
      ? a.token
      : Math.min(Math.max(0, a.token ?? 0), Math.max(0, inputLen - 1));
    outputContent = outputSummary(outputPair, position, labels);
  }
  const componentContent = comparison ? componentComparison(comparison, a, labels) : '';

  if (!outputContent && !componentContent) {
    return `<div class="dock-compare-content" data-testid="dock-compare"><p>No active comparison available.</p></div>`;
  }

  return `<div class="dock-compare-content" data-testid="dock-compare">
    ${outputContent}
    ${componentContent}
  </div>`;
}

export function renderContextualDock(opts: ContextualDockOptions): string {
  const { depth, lessonProgress, routePurpose, primaryAction, attentionAction, shortDetour, freeExplore, operatorControls, profile } = opts;

  const canRenderOutput = Boolean(opts.outputPair && opts.outputPair.before?.manifest?.input && opts.outputPair.after?.manifest?.input);
  const canRenderComponent = Boolean(opts.comparison?.before && opts.comparison?.after);
  const hasComparison = Boolean(opts.hasComparison && (canRenderOutput || canRenderComponent));
  const effectiveDepth: DockDepth = (depth === 'compare' && !hasComparison) ? 'explain' : depth;

  let bodyContent = '';
  switch (effectiveDepth) {
    case 'explain':
      bodyContent = renderExplain(opts);
      break;
    case 'values':
      bodyContent = renderValues(opts);
      break;
    case 'math':
      bodyContent = renderMath(opts);
      break;
    case 'source':
      bodyContent = renderSource(opts);
      break;
    case 'compare':
      bodyContent = renderCompare(opts);
      break;
  }

  const isExpanded = effectiveDepth !== 'explain';
  const isFacilitator = profile === 'facilitator';

  return `<section class="contextual-dock short-guide ${isExpanded ? 'is-expanded' : ''}" data-testid="contextual-dock" data-active-depth="${effectiveDepth}" aria-label="Contextual explanation dock">
    <div class="dock-header" data-testid="dock-header">
      <div class="dock-route-info">
        ${lessonProgress ? `<span class="lesson-progress" data-testid="lesson-progress">${esc(lessonProgress)}</span>` : ''}
        ${routePurpose ? `<span class="route-purpose" data-testid="route-purpose">${esc(routePurpose)}</span>` : ''}
        <p role="status" class="dock-status-message">${esc(opts.shortMessage)} ${opts.shortDetour ? 'Exploring a detour. Resume explicitly to return. ' : ''}</p>
      </div>
      <div class="dock-route-actions"${opts.trainingState ? ` id="execution-controls" data-execution-id="${esc(opts.trainingState.executionId)}" data-sequence="${opts.trainingState.sequence}" data-training-phase="${esc(opts.trainingState.phase)}"` : ''}>
        ${opts.trainingState ? (
          opts.trainingState.ready ? `
            <button id="execution-accept" class="primary-action" ${opts.trainingState.disabled ? 'disabled' : ''}>Accept update</button>
            <button id="execution-cancel" class="secondary-action" ${opts.trainingState.cancelling ? 'disabled' : ''}>Discard candidate</button>
            <span data-testid="execution-frontier">${esc(opts.trainingState.frontierText)}</span>
          ` : `
            <button id="execution-continue" class="primary-action" ${opts.trainingState.disabled ? 'disabled' : ''}>Continue</button>
            ${opts.trainingState.canPin ? `<button id="execution-pin" class="secondary-action" ${opts.trainingState.disabled ? 'disabled' : ''}>${esc(opts.trainingState.pinLabel)}</button>` : ''}
            <button id="execution-cancel" class="secondary-action" ${opts.trainingState.cancelling ? 'disabled' : ''}>Cancel training</button>
            <span data-testid="execution-frontier">${esc(opts.trainingState.frontierText)}</span>
          `
        ) : `
          ${primaryAction}
          ${attentionAction}
          ${!isFacilitator && !opts.attract ? `<button id="visitor-explore-toggle">${freeExplore ? 'Close free exploration' : 'Explore freely'}</button>` : ''}
          ${shortDetour ? `<button id="short-resume">Resume short route</button>` : ''}
          ${isFacilitator ? `<button id="operator-controls">${operatorControls ? 'Hide operator controls' : 'Show operator controls'}</button>` : ''}
        `}
      </div>
    </div>
    <nav class="dock-tabs" aria-label="Explanation depth">
      <button class="dock-tab ${effectiveDepth === 'explain' ? 'active' : ''}" data-dock-depth="explain" ${effectiveDepth === 'explain' ? 'aria-pressed="true"' : ''}>Explain</button>
      <button class="dock-tab ${effectiveDepth === 'values' ? 'active' : ''}" data-dock-depth="values" ${effectiveDepth === 'values' ? 'aria-pressed="true"' : ''}>Values</button>
      <button class="dock-tab ${effectiveDepth === 'math' ? 'active' : ''}" data-dock-depth="math" ${effectiveDepth === 'math' ? 'aria-pressed="true"' : ''}>Math</button>
      <button class="dock-tab ${effectiveDepth === 'source' ? 'active' : ''}" data-dock-depth="source" ${effectiveDepth === 'source' ? 'aria-pressed="true"' : ''}>Source</button>
      ${hasComparison ? `<button class="dock-tab ${effectiveDepth === 'compare' ? 'active' : ''}" data-dock-depth="compare" ${effectiveDepth === 'compare' ? 'aria-pressed="true"' : ''}>Compare</button>` : ''}
      ${isExpanded ? `<button class="dock-tab-close" data-dock-depth="explain" title="Close detail" aria-label="Close detail">✕ Close</button>` : ''}
    </nav>
    <div class="dock-body" data-testid="dock-body">
      ${bodyContent}
    </div>
  </section>`;
}
