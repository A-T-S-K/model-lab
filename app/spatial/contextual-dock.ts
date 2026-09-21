import type { SpatialReadModel } from './bindings.js';
import type { Address, Explanation } from './forward.js';
import { operations, parameterOwners } from './forward.js';
import type { ForwardProgress, RunResult } from '../worker/protocol.js';
import type { ArchivedSnapshot } from '../../archive/session.js';
import type { InspectionResult } from '../../inspect/types.js';
import type { TrainingProgress } from '../worker/training-execution.js';
import type { LearningModel, LearningStage, ParameterPin } from './learning.js';
import type { PublicTourContent } from './public-tour.js';
import {
  resolvePublicDepthContext,
  type PublicDepthSelection,
  type ResolvedPublicDepthContext,
  type ResolvedPublicDepthMember,
} from './public-depth.js';
import {
  resolvePublicTrainingDepthContext,
  type PublicTrainingDepthSelection,
  type ResolvedPublicTrainingDepthContext,
} from './public-training-depth.js';
import { formatAdamGlanceNote, formatCandidateOutcomeMeanLoss, formatCandidateTargetTokenProbability } from './public-tour.js';
import { outputTokenName, outputSummary, outputMetrics, componentComparison, type OutputPair } from './comparison.js';
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
  readonly selectedLabel?: string;
  readonly tourContent?: PublicTourContent;
  readonly publicDepthSelection?: PublicDepthSelection;
  readonly publicTrainingDepthSelection?: PublicTrainingDepthSelection;
  readonly trainingStartingSnapshot?: ArchivedSnapshot;
  readonly trainingPreview?: RunResult;
  readonly trainingInspection?: InspectionResult;
}

function renderExplain(opts: ContextualDockOptions): string {
  const { model: m, address: a, element, pin, executionProgress, trainingProgress, learningStage, learningModel, learningRouteStop, attract, trainingState, profile, routePurpose, tourContent, outputPair } = opts;
  if (!m) return '<p>No model loaded.</p>';
  const isPublic = profile !== 'workbench';
  const effectiveTourContent = tourContent;

  if (effectiveTourContent) {
    const tc = effectiveTourContent;
    const truthCue = tc.truthGuardrail
      ? `<p class="reverse-truth-cue" data-testid="reverse-truth-cue">${esc(tc.truthGuardrail)}</p>`
      : '';

    let stageResult = '';
    const pinLabel = `${pin.name}[${pin.row},${pin.column}]`;
    const pinOwnerTitle = operations.find(o => o.kind === parameterOwners[pin.name])?.title ?? pin.name;

    if (tc.state === 'cold') {
      // Cold represents unstarted tour
    } else if (tc.part === 1) {
      const c = operationConstruction(m, a, element, executionProgress);
      if (c.plainResult) {
        stageResult = `<div class="dock-stage-result"><div class="teaching-step"><small class="stage-result-label">${esc(tc.resultConcept?.label?.toUpperCase() ?? 'OBSERVED RESULT')}</small><p>${c.plainResult}</p></div></div>`;
      }
    } else if (tc.state === 'p2_objective') {
      const meanVal = trainingProgress?.mean;
      if (meanVal !== undefined) {
        stageResult = `<div class="dock-stage-result">
          <div class="teaching-step">
            <small class="stage-result-label">MEAN TRAINING LOSS</small>
            <p class="learning-objective-summary">Mean training loss: <span data-testid="live-loss" data-value="${meanVal}">${fmt(meanVal)}</span> across all target positions.</p>
          </div>
        </div>`;
      }
    } else if (tc.state === 'p2_gradient_contribution') {
      const event = trainingProgress?.contributions.at(-1);
      if (event) {
        const beforeVal = 'before' in event ? (event as any).before as number : undefined;
        const afterVal = 'after' in event ? (event as any).after as number : undefined;
        stageResult = `<div class="dock-stage-result">
          <div class="teaching-step">
            <small class="stage-result-label">ONE GRADIENT CONTRIBUTION · PARTIAL ACCUMULATOR</small>
            <div class="dock-pin-info"><span data-testid="pin-owner">${esc(pinLabel)} → ${esc(pinOwnerTitle)}</span></div>
            <p class="contribution-math">Child adjoint <strong>${fmt(event.childAdjoint)}</strong> × local derivative <strong>${fmt(event.localDerivative)}</strong> = contribution <span data-testid="live-contribution" data-value="${event.contribution}">${fmt(event.contribution)}</span></p>
            ${beforeVal !== undefined && afterVal !== undefined ? `<p class="accumulator-math">Previous accumulator <strong>${fmt(beforeVal)}</strong> + this contribution <strong>${fmt(event.contribution)}</strong> = new partial gradient <span data-testid="live-accumulator" data-value="${afterVal}">${fmt(afterVal)}</span></p>` : ''}
            <p class="learning-partial-note">This is ONE contribution to ${esc(pinLabel)}. The accumulator is still partial; backward pass is not finished.</p>
          </div>
        </div>`;
      }
    } else if (tc.state === 'p2_final_gradient') {
      const gradient = (trainingProgress && trainingProgress.final) ? trainingProgress.gradient : undefined;
      const isFinal = Boolean(trainingProgress?.final);
      if (gradient !== undefined && isFinal) {
        stageResult = `<div class="dock-stage-result">
          <div class="teaching-step">
            <small class="stage-result-label">FINAL PARAMETER GRADIENT</small>
            <div class="dock-pin-info"><span data-testid="pin-owner">${esc(pinLabel)} → ${esc(pinOwnerTitle)}</span></div>
            <p class="learning-gradient-summary">All contributions finished. Final gradient: <span data-testid="live-gradient" data-value="${gradient}">${fmt(gradient)}</span></p>
            <p class="learning-gradient-note">The gradient measures loss sensitivity for this training objective. The gradient is NOT the optimizer update.</p>
          </div>
        </div>`;
      }
    } else if (tc.state === 'p2_adam_proposal') {
      const u = trainingProgress?.proposal;
      if (u) {
        stageResult = `<div class="dock-stage-result">
          <div class="teaching-step">
            <small class="stage-result-label">PROVISIONAL ADAM PROPOSAL</small>
            <div class="dock-pin-info"><span data-testid="pin-owner">${esc(pinLabel)}</span></div>
            <p class="learning-provisional">Candidate proposal: θ ${fmt(u.before)} → provisional θ′ <span data-testid="live-proposal" data-value="${u.after}">${fmt(u.after)}</span></p>
            <p class="learning-adam-note">${esc(formatAdamGlanceNote({ ...u, fmt }))}</p>
          </div>
        </div>`;
      }
    } else if (tc.state === 'candidate_ready') {
      const pair = trainingProgress?.readyOutputs ? { before: trainingProgress.readyOutputs.before, after: trainingProgress.readyOutputs.after } : undefined;
      if (pair && pair.before?.manifest?.input && pair.after?.manifest?.input) {
        const ma = outputMetrics(pair.before);
        const mb = outputMetrics(pair.after);
        const vocab = (pair.before.manifest.model.architecture.vocabulary ?? []) as readonly string[];
        const targetPos = typeof a.token === 'number' && a.token >= 0 && a.token < ma.targets.length ? a.token : 3;
        const targetTokenId = ma.targets[targetPos];
        const targetTokenLabel = outputTokenName(targetTokenId, vocab);
        const probBefore = ma.rows[targetPos]?.[targetTokenId];
        const probAfter = mb.rows[targetPos]?.[targetTokenId];

        stageResult = `<div class="dock-stage-result">
          <div class="teaching-step">
            <small class="stage-result-label">PROVISIONAL CANDIDATE OUTCOME</small>
            <p class="candidate-outcome-summary">Mean loss on this training example, derived from observed target probabilities: <span data-testid="before-mean" data-value="${ma.mean}">${fmt(ma.mean)}</span> → <span data-testid="after-mean" data-value="${mb.mean}">${fmt(mb.mean)}</span></p>
            <p class="candidate-prediction-change">Target-token probability for '${esc(targetTokenLabel)}' at position ${targetPos}: accepted ${fmt(probBefore)} → provisional candidate ${fmt(probAfter)}</p>
            <p class="candidate-generalization-note">A changed result or lower loss on this training example is not proof of general model improvement.</p>
          </div>
        </div>`;
      }
    }

    return `<div class="dock-explain-content" data-testid="dock-explain">
      <div class="dock-overview" data-testid="scene-construction" data-run="${esc(m.source.sourceRunId)}">
        <div class="dock-stage-meaning">
          ${tc.headline ? `<header class="construction-header"><strong>${esc(tc.headline)}</strong></header>` : ''}
          ${tc.learnerQuestion
            ? `<p class="dock-route-purpose" data-testid="route-purpose">${esc(tc.learnerQuestion)}</p>`
            : tc.routePurpose
              ? `<p class="dock-route-purpose" data-testid="route-purpose">${esc(tc.routePurpose)}</p>`
              : ''}
          <p class="dock-meaning-text">${esc(tc.plainMeaning)}</p>
          ${tc.whyHere ? `<p class="construction-purpose">${esc(tc.whyHere)}</p>` : ''}
          ${truthCue}
        </div>
        ${stageResult}
      </div>
    </div>`;
  }

  if (attract) {
    return `<div class="dock-explain-content" data-testid="dock-explain">
      <div class="idle-explanation teaching-step">
        <strong>RECORDED RUN · REPLAY</strong>
        <p>Explore real character-by-character predictions and live learning inside one connected computation. Press <b>Start</b> to make a fresh prediction and follow information through the network.</p>
      </div>
    </div>`;
  }

  if (trainingProgress) {
    const t = trainingProgress;
    const isBackward = t.phase === 'backward' || t.phase === 'backward seed';
    const truthCue = isBackward
      ? `<p class="reverse-truth-cue" data-testid="reverse-truth-cue">Backward explanation path over the real computation. Visual movement is not runtime timing.</p>`
      : '';
    const guidance = trainingState && !trainingState.ready
      ? `<p class="learning-guidance" data-testid="learning-guidance">Run to next gradient contribution pauses after the next matching backward node for ${esc(parameterLabel(pin))}. Continue runs to Candidate ready.</p>`
      : '';

    return `<div class="dock-explain-content" data-testid="dock-explain">
      <div class="dock-overview" data-testid="scene-construction" data-run="${esc(m.source.sourceRunId)}">
        <div class="dock-stage-meaning">
          ${!isPublic ? `<header class="construction-header"><strong>Live training · ${esc(t.phase)}</strong><span>step ${t.acceptedStep} → proposed ${t.acceptedStep + 1}</span></header>` : ''}
          ${routePurpose ? `<p class="dock-route-purpose" data-testid="route-purpose">${esc(routePurpose)}</p>` : ''}
          <p class="learning-mechanism">The model compares predictions against known targets to measure error. Sensitivity propagates backward through the network, calculating how much each parameter should adjust. Parameter uses contribute and accumulate into a gradient.</p>
          ${truthCue}
          ${guidance}
        </div>
        <div class="dock-stage-result">
          <div class="teaching-step">
            <small class="stage-result-label">OBSERVED ACCUMULATION</small>
            <div class="dock-pin-info"><span data-testid="pin-owner">${esc(pin.name)} → ${esc(operations.find(o=>o.kind===parameterOwners[pin.name])?.title??pin.name)} · same global owner · accepted ${esc(t.startingSnapshotId.slice(0,12))}</span></div>
            <p class="learning-gradient-summary">${t.final ? 'Final' : 'Partial'} gradient: <span data-testid="live-gradient" data-value="${t.gradient}">${t.gradient === undefined ? 'pending' : fmt(t.gradient)}</span></p>
            ${t.proposal ? `<p class="learning-provisional">Candidate proposal: θ ${fmt(t.proposal.before)} → ${fmt(t.proposal.after)} · provisional until accepted.</p>` : ''}
          </div>
        </div>
      </div>
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
    <div class="dock-overview" data-testid="scene-construction" data-run="${esc(m.source.sourceRunId)}">
      <div class="dock-stage-meaning">
        ${!isPublic ? `<header class="construction-header"><strong>${esc(opts.selectedLabel ?? addressLabel(a))}</strong><span>${executionProgress ? 'ACTIVE EXECUTION' : esc(m.source.relationship)} · input ${esc(m.source.capturedDocument)}</span></header>` : ''}
        ${routePurpose ? `<p class="dock-route-purpose" data-testid="route-purpose">${esc(routePurpose)}</p>` : ''}
        ${c.purpose && c.purpose !== routePurpose ? `<p class="construction-purpose">${esc(c.purpose)}</p>` : ''}
        <p class="dock-meaning-text">${esc(c.plainMeaning ?? c.purpose)}</p>
      </div>
      ${c.plainResult ? `<div class="dock-stage-result"><div class="teaching-step"><small class="stage-result-label">OBSERVED RESULT</small><p>${c.plainResult}</p></div></div>` : ''}
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

function resolvedPart1Depth(opts: ContextualDockOptions): ResolvedPublicDepthContext | undefined {
  if (!opts.model || opts.tourContent?.part !== 1 || !opts.tourContent.depthSpec) return undefined;
  return resolvePublicDepthContext(opts.tourContent, opts.model, opts.publicDepthSelection);
}

function resolvedPart2Depth(opts: ContextualDockOptions): ResolvedPublicTrainingDepthContext | undefined {
  if (opts.tourContent?.part !== 2 || !opts.tourContent.depthSpec) return undefined;
  return resolvePublicTrainingDepthContext(
    opts.tourContent,
    opts.executionProgress,
    opts.trainingStartingSnapshot,
    opts.trainingPreview,
    opts.publicTrainingDepthSelection,
    opts.trainingInspection,
  );
}

function publicTrainingUnavailable(ctx: ResolvedPublicTrainingDepthContext, depth: 'values' | 'math' | 'source'): string {
  return `<div class="dock-${depth}-content" data-testid="dock-${depth}" data-public-training-depth-kind="${esc(ctx.kind)}">
    <p data-testid="public-training-depth-unavailable"><strong>UNAVAILABLE</strong> · ${esc(ctx.reason ?? 'Compatible live training evidence is unavailable.')}</p>
  </div>`;
}

function publicTrainingParameter(ctx: ResolvedPublicTrainingDepthContext): string {
  const p = ctx.parameter;
  return p ? `${esc(p.name)}[${p.row},${p.column}] · flat index ${p.index}` : 'unavailable';
}

function publicTrainingDistribution(values: readonly number[], labels: readonly string[]): string {
  return values.map((value, index) => `${esc(labels[index] ?? String(index))} ${fmt(value)}`).join(' · ');
}

function renderPublicPart2Values(opts: ContextualDockOptions, ctx: ResolvedPublicTrainingDepthContext): string {
  if (!ctx.available) return publicTrainingUnavailable(ctx, 'values');
  if (ctx.kind === 'objective') {
    const objective = ctx.objective!;
    return `<div class="dock-values-content" data-testid="dock-values" data-public-training-depth-kind="objective">
      <h3>All teacher-forced training positions</h3>
      <table data-testid="public-training-objective"><thead><tr><th>Position / input</th><th>Known target</th><th>P(target) [origin]</th><th>Recorded loss [origin]</th></tr></thead><tbody>
        ${objective.rows.map(row => `<tr><th><button data-training-objective-position="${row.position}" ${row.position === objective.selectedPosition ? 'aria-pressed="true"' : ''}>p${row.position}</button> · ${esc(row.inputLabel)}${row.input === undefined ? '' : ` (${row.input})`}</th><td>${esc(row.targetLabel)} (${row.target})</td><td>${row.probability === undefined ? 'unavailable [UNAVAILABLE]' : `${fmt(row.probability)} [OBSERVED]`}</td><td>${row.recordedLoss === undefined ? 'pending [PENDING]' : `${fmt(row.recordedLoss)} [OBSERVED]`}</td></tr>`).join('')}
      </tbody></table>
      <p>Observed mean objective: ${objective.observedMean === undefined ? 'pending' : fmt(objective.observedMean)} ${objective.observedMean === undefined ? '[PENDING]' : '[OBSERVED]'}</p>
    </div>`;
  }
  if (ctx.kind === 'backward-trace') {
    return `<div class="dock-values-content" data-testid="dock-values" data-public-training-depth-kind="backward-trace">
      <h3>Backward witness</h3>
      <p>Objective source: <code>${esc(ctx.gradientSourceRunId ?? 'unavailable')}</code></p>
      <p>Runtime parameter witness: <strong>${publicTrainingParameter(ctx)}</strong></p>
      <p>Dependency topology: STRUCTURAL · numeric sensitivity: ${ctx.numericAdjointsAvailable ? 'AVAILABLE from already-verified inspection evidence' : 'UNAVAILABLE in the retained detail context'}</p>
    </div>`;
  }
  if (ctx.kind === 'gradient-contribution') {
    return `<div class="dock-values-content" data-testid="dock-values" data-public-training-depth-kind="gradient-contribution">
      <h3>Retained matching live contributions · ${publicTrainingParameter(ctx)}</h3>
      <p data-testid="retained-contribution-truth">This list is a retained matching subset, capped by the live transaction. It is not claimed to be complete fan-in.</p>
      <table data-testid="public-training-contributions"><thead><tr><th>Occurrence ordinal</th><th>Child</th><th>Operand</th><th>Child adjoint</th><th>Local derivative</th><th>Contribution</th><th>Before</th><th>After</th></tr></thead><tbody>
        ${ctx.retainedContributions.map(event => `<tr><td><button data-training-contribution-ordinal="${event.ordinal}" ${event.ordinal === ctx.selectedContribution?.ordinal ? 'aria-pressed="true"' : ''}>${event.ordinal}</button></td><td>${event.child ?? 'unavailable'}</td><td>${event.operand}</td><td>${fmt(event.childAdjoint)}</td><td>${fmt(event.localDerivative)}</td><td>${fmt(event.contribution)}</td><td>${fmt(event.before)}</td><td>${fmt(event.after)}</td></tr>`).join('')}
      </tbody></table>
    </div>`;
  }
  if (ctx.kind === 'final-gradient') {
    return `<div class="dock-values-content" data-testid="dock-values" data-public-training-depth-kind="final-gradient">
      <h3>Completed parameter gradient · ${publicTrainingParameter(ctx)}</h3>
      <p>Backward complete: <strong>${ctx.backwardComplete ? 'YES' : 'NO'}</strong></p>
      <p>Authentic final gradient: <span data-testid="public-final-gradient">${ctx.finalGradient === undefined ? 'unavailable' : fmt(ctx.finalGradient)}</span></p>
      <p data-testid="retained-fanin-status">Retained contribution rows: ${ctx.retainedContributions.length} · completeness: RETAINED SUBSET, not complete fan-in.</p>
    </div>`;
  }
  if (ctx.kind === 'adam') {
    const u = ctx.proposal!;
    const o = ctx.optimizer!;
    return `<div class="dock-values-content" data-testid="dock-values" data-public-training-depth-kind="adam">
      <h3>Adam proposal · ${publicTrainingParameter(ctx)}</h3>
      <table data-testid="public-adam-values"><tbody>
        <tr><th>Starting accepted optimizer step</th><td>${ctx.acceptedStep}</td></tr>
        <tr><th>Bias-correction exponent step</th><td>${(ctx.acceptedStep ?? 0) + 1}</td></tr>
        <tr><th>θ before</th><td>${val(u.before)}</td></tr><tr><th>g</th><td>${val(u.gradient)}</td></tr>
        <tr><th>m before → after</th><td>${val(u.mBefore)} → ${val(u.mAfter)}</td></tr>
        <tr><th>v before → after</th><td>${val(u.vBefore)} → ${val(u.vAfter)}</td></tr>
        <tr><th>β1 / β2</th><td>${val(o.beta1)} / ${val(o.beta2)}</td></tr>
        <tr><th>ε</th><td>${val(o.epsilon)}</td></tr><tr><th>effective learning rate</th><td>${val(o.effectiveLearningRate)}</td></tr>
        <tr><th>bias correction 1 / 2</th><td>${val(u.biasCorrection1)} / ${val(u.biasCorrection2)}</td></tr>
        <tr><th>mHat / vHat</th><td>${val(u.mHat)} / ${val(u.vHat)}</td></tr>
        <tr><th>stored delta</th><td>${val(u.delta)}</td></tr><tr><th>provisional θ after</th><td>${val(u.after)}</td></tr>
      </tbody></table>
      <p><strong>PROVISIONAL</strong> · ACCEPTED MODEL UNCHANGED</p>
    </div>`;
  }
  const candidate = ctx.candidate!;
  return `<div class="dock-values-content" data-testid="dock-values" data-public-training-depth-kind="candidate">
    <h3>Baseline vs provisional candidate · same training example</h3>
    <table data-testid="public-candidate-values"><thead><tr><th>Position</th><th>Input → target</th><th>Baseline full distribution</th><th>Candidate full distribution</th><th>P(target)</th></tr></thead><tbody>
      ${candidate.rows.map(row => `<tr><th><button data-training-candidate-position="${row.position}" ${row.position === candidate.selectedPosition ? 'aria-pressed="true"' : ''}>p${row.position}</button></th><td>${esc(row.inputLabel)} → ${esc(row.targetLabel)}</td><td>${publicTrainingDistribution(row.baselineDistribution, candidate.outputLabels)}</td><td>${publicTrainingDistribution(row.candidateDistribution, candidate.outputLabels)}</td><td>${fmt(row.baselineTargetProbability)} → ${fmt(row.candidateTargetProbability)}</td></tr>`).join('')}
    </tbody></table>
    <p>Complete output domain: ${candidate.outputLabels.map(esc).join(', ')}.</p>
    <p>candidate evaluated · candidate provisional · candidate not accepted · candidate not live</p>
  </div>`;
}

function renderPublicPart2Math(opts: ContextualDockOptions, ctx: ResolvedPublicTrainingDepthContext): string {
  if (!ctx.available) return publicTrainingUnavailable(ctx, 'math');
  if (ctx.kind === 'objective') {
    const objective = ctx.objective!;
    const row = objective.rows.find(candidate => candidate.position === objective.selectedPosition) ?? objective.rows[0];
    return `<div class="dock-math-content" data-testid="dock-math" data-public-training-depth-kind="objective">
      <h3>Cross-entropy witness · p${row?.position ?? 0}</h3>
      ${row?.derivedLoss === undefined ? '<p>DERIVED −log(Ptarget): unavailable because authentic target probability is unavailable.</p>' : `<p>DERIVED: −log(${fmt(row.probability)}) = ${fmt(row.derivedLoss)}</p>`}
      <p>Recorded loss: ${row?.recordedLoss === undefined ? 'unavailable' : fmt(row.recordedLoss)} ${row?.recordedLoss === undefined ? '[UNAVAILABLE]' : '[OBSERVED]'}</p>
      ${objective.derivedMean === undefined ? '<p>DERIVED mean unavailable until every authentic recorded per-position loss operand is available.</p>' : `<p>DERIVED: sum(${objective.rows.length} observed per-position losses) / ${objective.rows.length} = ${fmt(objective.derivedMean)}</p>`}
      <p>Observed runtime mean: ${objective.observedMean === undefined ? 'unavailable' : fmt(objective.observedMean)} ${objective.observedMean === undefined ? '[UNAVAILABLE]' : '[OBSERVED]'}</p>
    </div>`;
  }
  if (ctx.kind === 'backward-trace') {
    return `<div class="dock-math-content" data-testid="dock-math" data-public-training-depth-kind="backward-trace">
      <h3>Chain-rule structure</h3><p>incoming sensitivity × local derivative → contribution to an upstream value or parameter use</p>
      <p>No numerical adjoint is substituted here. Numeric adjoints are ${ctx.numericAdjointsAvailable ? 'available only from already-verified bound inspection evidence.' : 'unavailable in this retained context.'}</p>
    </div>`;
  }
  if (ctx.kind === 'gradient-contribution') {
    const event = ctx.selectedContribution;
    return `<div class="dock-math-content" data-testid="dock-math" data-public-training-depth-kind="gradient-contribution">
      <h3>One retained matching contribution · ${publicTrainingParameter(ctx)}</h3>
      ${event ? `<p>Occurrence ordinal ${event.ordinal} · operand ${event.operand} · child ${event.child ?? 'unavailable'}</p>
        <p data-testid="public-contribution-math">${fmt(event.childAdjoint)} × ${fmt(event.localDerivative)} = ${fmt(event.contribution)}</p>
        <p data-testid="public-accumulator-math">${fmt(event.before)} + ${fmt(event.contribution)} = ${fmt(event.after)}</p>
        ${event.child === undefined ? '' : `<button data-live-child="${event.child}" data-live-source="${esc(ctx.gradientSourceRunId ?? '')}">Inspect this retained child scalar in Microscope</button>`}` : '<p>No matching retained contribution is available.</p>'}
      <p>This occurrence ordinal identifies the retained event. It is not wall-clock arrival timing or teaching chronology.</p>
      <section class="spatial-scalar" id="microscope"><h3>Scalar / source inspection</h3>${opts.scalar}</section>
    </div>`;
  }
  if (ctx.kind === 'final-gradient') {
    const event = ctx.selectedContribution;
    return `<div class="dock-math-content" data-testid="dock-math" data-public-training-depth-kind="final-gradient">
      <h3>Completed backward result</h3>
      <p>Final gradient = ${ctx.finalGradient === undefined ? 'unavailable' : fmt(ctx.finalGradient)} [OBSERVED COMPLETED BACKWARD RESULT]</p>
      <p data-testid="no-retained-sum">The retained matching contribution subset is not summed or presented as complete fan-in.</p>
      ${event?.child === undefined ? '' : `<button data-live-child="${event.child}" data-live-source="${esc(ctx.gradientSourceRunId ?? '')}">Inspect a retained contributing child scalar in Microscope</button>`}
      <section class="spatial-scalar" id="microscope"><h3>Scalar / source inspection</h3>${opts.scalar}</section>
    </div>`;
  }
  if (ctx.kind === 'adam') {
    const u = ctx.proposal!, o = ctx.optimizer!;
    const symbolic = o.effectiveLearningRate * u.mHat / (Math.sqrt(u.vHat) + o.epsilon);
    const symbolicAfter = u.before - symbolic;
    return `<div class="dock-math-content" data-testid="dock-math" data-public-training-depth-kind="adam">
      <h3>Native Adam equations · ${publicTrainingParameter(ctx)}</h3>
      <p>m′ = β1·m + (1−β1)·g = ${fmt(u.mAfter)}</p>
      <p>v′ = β2·v + (1−β2)·g² = ${fmt(u.vAfter)}</p>
      <p>mHat = m′ / biasCorrection1 = ${fmt(u.mHat)}</p>
      <p>vHat = v′ / biasCorrection2 = ${fmt(u.vHat)}</p>
      <p>DERIVED symbolic step quantity = effectiveLearningRate × mHat / (sqrt(vHat) + epsilon) = ${fmt(symbolic)}</p>
      <p>DERIVED θ′ = θ − symbolic step quantity = ${fmt(symbolicAfter)}</p>
      <p>OBSERVED stored delta = actual representable θ′ − θ = ${fmt(u.delta)}; proposed θ′ = ${fmt(u.after)}.</p>
      <p>Starting accepted optimizer step = ${ctx.acceptedStep}; bias-correction exponent uses acceptedStep + 1 = ${(ctx.acceptedStep ?? 0) + 1}.</p>
      <p><strong>PROVISIONAL</strong> · ACCEPTED MODEL UNCHANGED</p>
    </div>`;
  }
  const candidate = ctx.candidate!;
  const row = candidate.rows.find(item => item.position === candidate.selectedPosition) ?? candidate.rows[0];
  return `<div class="dock-math-content" data-testid="dock-math" data-public-training-depth-kind="candidate">
    <h3>Derived candidate comparison · p${row?.position ?? 0}</h3>
    ${row?.baselineDerivedLoss === undefined || row?.candidateDerivedLoss === undefined ? '<p>DERIVED per-position loss unavailable because complete authentic target probability support is unavailable.</p>' : `<p>DERIVED baseline loss = −log(${fmt(row.baselineTargetProbability)}) = ${fmt(row.baselineDerivedLoss)}</p><p>DERIVED candidate loss = −log(${fmt(row.candidateTargetProbability)}) = ${fmt(row.candidateDerivedLoss)}</p>`}
    <p>DERIVED baseline mean: ${candidate.baselineDerivedMean === undefined ? 'unavailable' : fmt(candidate.baselineDerivedMean)}</p>
    <p>DERIVED candidate mean: ${candidate.candidateDerivedMean === undefined ? 'unavailable' : fmt(candidate.candidateDerivedMean)}</p>
    <p>These derived values describe this one fixed training example only; they do not establish general model quality.</p>
  </div>`;
}

function renderPublicPart2Source(ctx: ResolvedPublicTrainingDepthContext): string {
  if (!ctx.available) return publicTrainingUnavailable(ctx, 'source');
  const common = `<div class="dock-provenance-grid">
    <p><strong>LIVE TRAINING TRANSACTION</strong></p>
    <p>Execution: <code>${esc(ctx.executionId ?? 'unavailable')}</code></p>
    <p>Phase: ${esc(ctx.phase ?? 'unavailable')}</p>
    <p>Starting snapshot: <code>${esc(ctx.startingSnapshotId ?? 'unavailable')}</code></p>
    <p>Training source: <code>${esc(ctx.gradientSourceRunId ?? 'unavailable')}</code></p>
    <p>Current source: <code>${esc(ctx.sourceRunId ?? 'unavailable')}</code></p>
    <p>Parameter witness: ${publicTrainingParameter(ctx)}</p>
    <p>Runtime: <code>${esc(ctx.runtimeVersion ?? 'unavailable')}</code> · revision <code>${esc(ctx.runtimeRevision ?? 'unavailable')}</code></p>
  </div>`;
  let detail = '';
  if (ctx.kind === 'objective') {
    const manifest = ctx.trainingRun?.manifest;
    detail = `<p>Input IDs: <code>${esc(JSON.stringify(manifest?.input ?? 'unavailable'))}</code></p><p>Target IDs: <code>${esc(JSON.stringify(manifest?.targets ?? 'unavailable'))}</code></p>`;
  } else if (ctx.kind === 'backward-trace') {
    detail = `<p>Dependency topology: STRUCTURAL.</p><p>Numeric adjoints: ${ctx.numericAdjointsAvailable ? 'available from already-verified evidence bound to this training source' : 'unavailable; opening Details did not recompute them'}.</p>`;
  } else if (ctx.kind === 'gradient-contribution') {
    const event = ctx.selectedContribution;
    detail = event ? `<p>Selected retained event: child ${event.child ?? 'unavailable'} · operand ${event.operand} · occurrence ordinal ${event.ordinal}.</p>` : '<p>No retained matching event is available.</p>';
  } else if (ctx.kind === 'final-gradient') {
    detail = `<p>Backward complete: ${ctx.backwardComplete ? 'YES' : 'NO'}.</p><p>Fan-in completeness: retained matching subset only; complete fan-in is unavailable in this context.</p>`;
  } else if (ctx.kind === 'adam') {
    detail = `<p>Proposal identity matches the exact runtime parameter index/name/row/column.</p><p>Status: PROVISIONAL · ACCEPTED MODEL UNCHANGED.</p>`;
  } else if (ctx.candidate) {
    const c = ctx.candidate;
    detail = `<p>Candidate snapshot: <code>${esc(c.candidateSnapshotId)}</code></p>
      <p>Baseline run: <code>${esc(c.baselineRunId)}</code></p><p>Training run: <code>${esc(c.trainingRunId)}</code></p><p>Candidate run: <code>${esc(c.candidateRunId)}</code></p>
      <p>Baseline runtime: <code>${esc(c.baselineRuntimeVersion)}</code> · revision <code>${esc(c.baselineRuntimeRevision)}</code></p>
      <p>Candidate runtime: <code>${esc(c.candidateRuntimeVersion)}</code> · revision <code>${esc(c.candidateRuntimeRevision)}</code></p>
      <p>Comparison compatibility: COMPATIBLE · candidate evaluated · candidate provisional · candidate not accepted · candidate not live.</p>`;
  }
  return `<div class="dock-source-content" data-testid="dock-source" data-public-training-depth-kind="${esc(ctx.kind)}">${common}${detail}</div>`;
}

function publicDepthValues(model: SpatialReadModel, member: ResolvedPublicDepthMember): readonly number[] | undefined {
  const values = model.forward.values(member.address);
  if (!values) return undefined;
  return member.slice ? values.slice(member.slice.start, member.slice.end) : values;
}

function publicDepthElement(model: SpatialReadModel, ctx: ResolvedPublicDepthContext, member: ResolvedPublicDepthMember): number {
  const values = publicDepthValues(model, member);
  if (!values?.length) return 0;
  const desired = ctx.kind === 'mlp'
    ? (member.kind === 'mlpUp' || member.kind === 'mlpRelu' ? ctx.hiddenFeature : ctx.outputFeature)
    : ctx.element;
  return Math.min(values.length - 1, Math.max(0, desired));
}

function publicDepthArtifactElement(member: ResolvedPublicDepthMember, localElement: number): number {
  return (member.slice?.start ?? 0) + localElement;
}

function publicDepthMemberLabel(member: ResolvedPublicDepthMember): string {
  if (member.key !== undefined) return member.role + ' / key ' + member.key;
  if (member.head !== undefined && member.occurrenceId.includes(':h')) return member.role + ' / head ' + member.head;
  return member.role;
}

function publicDepthMemberNav(ctx: ResolvedPublicDepthContext, only?: readonly string[]): string {
  const seen = new Set<string>();
  const members = ctx.members.filter(member => {
    if (only && !only.includes(member.memberId)) return false;
    if (seen.has(member.memberId)) return false;
    seen.add(member.memberId);
    return true;
  });
  if (members.length < 2) return '';
  return '<nav class="controls" aria-label="Mechanism member">' + members.map(member =>
    '<button data-depth-member="' + esc(member.memberId) + '" ' +
    (ctx.selectedMember === member.memberId ? 'aria-pressed="true"' : '') + '>' +
    esc(member.role) + '</button>'
  ).join('') + '</nav>';
}

function publicDepthVector(model: SpatialReadModel, ctx: ResolvedPublicDepthContext, member: ResolvedPublicDepthMember): string {
  const values = publicDepthValues(model, member);
  const selected = publicDepthElement(model, ctx, member);
  const shape = member.shape?.join(' x ') ?? 'unavailable';
  const featureAttribute = ctx.kind === 'mlp'
    ? (member.kind === 'mlpUp' || member.kind === 'mlpRelu' ? 'data-depth-hidden-feature' : 'data-depth-output-feature')
    : 'data-depth-element';
  const cells = values?.map((value, index) => {
    const token = (member.kind === 'logits' || member.kind === 'probabilities')
      ? outputTokenName(index, model.forward.vocabulary)
      : undefined;
    const rowKey = ['attention-comparison', 'attention-weights', 'value-mixture'].includes(ctx.kind)
      && (member.kind === 'attentionLogits' || member.kind === 'attentionProbabilities')
      ? index
      : member.key;
    const keyAttribute = rowKey === undefined ? '' : ' data-depth-key="' + rowKey + '"';
    const headAttribute = member.occurrenceId.includes(':h') && member.head !== undefined
      ? ' data-depth-head="' + member.head + '"'
      : '';
    return '<button data-depth-member="' + esc(member.memberId) + '"' + keyAttribute + headAttribute + ' ' + featureAttribute + '="' + index +
      '" data-value="' + value + '" title="' + value + '" ' + (index === selected ? 'aria-pressed="true"' : '') + '><small>' +
      esc((token === undefined ? '' : token + ' / ') + '[' + index + ']') + '</small>' + fmt(value) + '</button>';
  }).join('') ?? '<p>UNAVAILABLE - no substituted values.</p>';
  return '<section class="depth-member" data-depth-member-section="' + esc(member.occurrenceId) + '"><h3>' +
    esc(publicDepthMemberLabel(member)) + '</h3><p><code>' + esc(member.kind) + '</code> - shape [' + esc(shape) + '] - ' +
    esc(member.availability) + (member.parameter ? ' - parameter <code>' + esc(member.parameter) + '</code>' : '') +
    (member.residualSource ? ' - saved residual source' : '') + '</p><div class="element-grid">' + cells + '</div></section>';
}

function publicDepthFuture(ctx: ResolvedPublicDepthContext): string {
  if (!ctx.futureKeys.length) return '';
  return '<p data-testid="causal-future-unavailable">Future positions ' +
    ctx.futureKeys.map(key => 'p' + key).join(', ') +
    ' are NOT APPLICABLE to this causal row. They are unavailable, not numeric zero.</p>';
}

function publicDepthSelected(ctx: ResolvedPublicDepthContext, memberId = ctx.selectedMember): ResolvedPublicDepthMember | undefined {
  return ctx.members.find(member =>
    member.memberId === memberId
    && (member.key === undefined || member.key === ctx.selectedKey)
    && (member.head === undefined || ctx.selectedHead === undefined || member.head === ctx.selectedHead)
  ) ?? ctx.members.find(member => member.memberId === memberId);
}

function publicDepthScalar(model: SpatialReadModel, member: ResolvedPublicDepthMember, localElement: number): string {
  const element = publicDepthArtifactElement(member, localElement);
  const explanation = model.forward.explain(member.address, element);
  if (!explanation.indexValid || !explanation.artifact) return '<p>Selected scalar unavailable for this captured member.</p>';
  return '<button data-artifact="' + esc(explanation.artifact.id) + '" data-element="' + element +
    '">Inspect selected scalar in Microscope</button>';
}

function publicDepthArithmetic(
  model: SpatialReadModel,
  ctx: ResolvedPublicDepthContext,
  member: ResolvedPublicDepthMember,
  localElement: number,
): string {
  const element = publicDepthArtifactElement(member, localElement);
  const explanation = model.forward.explain(member.address, element);
  return '<section class="depth-math-witness" data-depth-math-member="' + esc(member.occurrenceId) + '"><h3>' +
    esc(publicDepthMemberLabel(member)) + '</h3>' + arithmetic(explanation, element) + '</section>';
}

function publicDepthScalarElement(ctx: ResolvedPublicDepthContext, member: ResolvedPublicDepthMember): number {
  if (ctx.kind === 'mlp') {
    return member.kind === 'mlpUp' || member.kind === 'mlpRelu' ? ctx.hiddenFeature : ctx.outputFeature;
  }
  if ((member.kind === 'attentionLogits' || member.kind === 'attentionProbabilities') && ctx.selectedKey !== undefined) {
    return ctx.selectedKey;
  }
  return ctx.element;
}

function renderPublicPart1Values(opts: ContextualDockOptions, ctx: ResolvedPublicDepthContext): string {
  const model = opts.model!;
  const group = (...ids: string[]) => ctx.members.filter(member => ids.includes(member.memberId));
  let visible: readonly ResolvedPublicDepthMember[] = ctx.members;
  let note = '';
  if (ctx.kind === 'prediction') {
    visible = group('probabilities');
    note = '<p>The complete authentic output probability distribution is shown. Softmax arithmetic remains optional Math depth.</p>';
  } else if (ctx.kind === 'attention-comparison') {
    visible = group('query', 'keys', 'scores');
    note = publicDepthFuture(ctx);
  } else if (ctx.kind === 'attention-weights') {
    visible = group('scores', 'weights');
    note = publicDepthFuture(ctx);
  } else if (ctx.kind === 'value-mixture') {
    visible = group('weights', 'values', 'headOutput');
    note = ctx.completeSupport
      ? '<p data-testid="value-mixture-support">Complete support: ' + ctx.eligibleKeys.length + ' eligible weights and ' +
        ctx.eligibleKeys.length + ' corresponding Value contributors feed this head output.</p>'
      : '<p data-testid="value-mixture-incomplete">INCOMPLETE / UNAVAILABLE - complete authentic weight and Value support is required before this can be presented as the complete mixture.</p>';
  } else if (ctx.kind === 'attention-integration') {
    visible = group('headOutputs', 'attentionOutput', 'attentionProjection', 'savedResidual', 'attentionResidual');
    note = '<p>Both head outputs are concatenated before WO projection; the saved embeddingNorm residual is then added. Concatenation is not addition.</p>';
  } else if (ctx.kind === 'mlp') {
    visible = group('attentionResidual', 'preMlpNorm', 'mlpUp', 'mlpRelu', 'mlpDown', 'mlpResidual');
    const stageShape = (id: string) => visible.find(member => member.memberId === id)?.shape?.[0];
    const pipeline = ['preMlpNorm', 'mlpUp', 'mlpRelu', 'mlpDown'].map(stageShape);
    note = pipeline.every(size => size !== undefined)
      ? '<p data-testid="mlp-depth-shapes">Complete authentic stage shapes: ' + pipeline.join(' -> ') + ' before the residual result.</p>'
      : '<p data-testid="mlp-depth-shapes">One or more MLP stage shapes are unavailable in this evidence.</p>';
  } else if (ctx.kind === 'logits') {
    visible = group('input', 'logits');
    note = '<p>Vocabulary logits are raw signed scores, not probabilities.</p>';
  } else if (ctx.kind === 'probabilities') {
    visible = group('logits', 'probabilities');
    note = '<p>Logits and the final distribution stay together so output softmax is not confused with attention softmax.</p>';
  }
  return '<div class="dock-values-content" data-testid="dock-values" data-public-depth-kind="' + esc(ctx.kind) + '"><p><strong>' +
    esc(opts.tourContent?.headline ?? ctx.kind) + '</strong> - canonical run <code>' + esc(ctx.canonical.run) + '</code> - p' +
    ctx.canonical.position + (ctx.canonical.head === undefined ? '' : ' / h' + ctx.canonical.head) + '</p>' +
    (ctx.kind === 'prediction' ? '' : publicDepthMemberNav(ctx)) + note + '<div class="construction-handoff">' +
    visible.map(member => publicDepthVector(model, ctx, member)).join('') + '</div></div>';
}

function renderPublicPart1Math(opts: ContextualDockOptions, ctx: ResolvedPublicDepthContext): string {
  const model = opts.model!;
  const f = model.forward;
  const chosen = publicDepthSelected(ctx);
  const key = ctx.selectedKey ?? 0;
  const byId = (id: string) => ctx.members.find(member => member.memberId === id);
  let body = ctx.kind === 'prediction'
    ? ''
    : ctx.kind === 'qkv'
      ? publicDepthMemberNav(ctx, ['q', 'k', 'v'])
      : publicDepthMemberNav(ctx);

  if (ctx.kind === 'prediction' || ctx.kind === 'probabilities') {
    const member = ctx.members.find(candidate => candidate.kind === 'probabilities');
    if (member) body += publicDepthArithmetic(model, ctx, member, publicDepthElement(model, ctx, member));
  } else if (ctx.kind === 'representation') {
    body += ctx.members.map(member => publicDepthArithmetic(model, ctx, member, publicDepthElement(model, ctx, member))).join('');
  } else if (ctx.kind === 'qkv') {
    const member = chosen && ['q', 'k', 'v'].includes(chosen.kind) ? chosen : byId('q');
    if (member) {
      body += '<p>Choose Q, K, or V for one authentic projection witness. The canonical beat remains the grouped Q / K / V mechanism.</p>';
      body += publicDepthArithmetic(model, ctx, member, publicDepthElement(model, ctx, member));
    }
  } else if (ctx.kind === 'attention-comparison') {
    const score = ctx.members.find(member => member.kind === 'attentionLogits');
    if (score) {
      const construction = operationConstruction(model, score.address, key, opts.executionProgress);
      body += '<p>Selected key ' + key + '; canonical query and head stay fixed.</p>' + construction.detailMath;
    }
  } else if (ctx.kind === 'attention-weights') {
    const member = ctx.members.find(candidate => candidate.kind === 'attentionProbabilities');
    if (member) body += publicDepthFuture(ctx) + publicDepthArithmetic(model, ctx, member, key);
  } else if (ctx.kind === 'value-mixture') {
    const member = ctx.members.find(candidate => candidate.kind === 'headOutput');
    if (member) {
      const local = publicDepthElement(model, ctx, member);
      const explanation = f.explain(member.address, publicDepthArtifactElement(member, local));
      body += ctx.completeSupport
        ? '<p>Every eligible weight and Value vector participates in this selected output component.</p>' +
          mixture(explanation, local)
        : '<p>Mixture arithmetic unavailable - complete authentic contributor support is required. No subset is displayed as the complete mixture.</p>';
    }
  } else if (ctx.kind === 'attention-integration') {
    const residual = byId('attentionResidual');
    if (residual) {
      const selectedIntegrationMember = publicDepthSelected(ctx);
      const integrationElement = selectedIntegrationMember?.memberId === 'headOutputs' && selectedIntegrationMember.head !== undefined
        ? selectedIntegrationMember.head * model.width + ctx.element
        : ctx.element;
      const construction = operationConstruction(model, residual.address, integrationElement, opts.executionProgress);
      body += construction.detailMath;
    }
    body += '<p>The concatenated input contains every head slice before WO; only the residual stage performs addition.</p>';
  } else if (ctx.kind === 'mlp') {
    const pre = byId('preMlpNorm'), up = byId('mlpUp'), relu = byId('mlpRelu'), down = byId('mlpDown'), residual = byId('mlpResidual');
    body += '<div class="controls"><span>Output feature ' + ctx.outputFeature + '</span><span>Hidden feature ' + ctx.hiddenFeature + '</span></div>';
    if (pre) body += publicDepthArithmetic(model, ctx, pre, ctx.outputFeature);
    if (up) body += publicDepthArithmetic(model, ctx, up, ctx.hiddenFeature);
    if (relu) body += publicDepthArithmetic(model, ctx, relu, ctx.hiddenFeature);
    if (down) {
      const explanation = f.explain(down.address, ctx.outputFeature);
      body += explanation.terms
        ? '<p data-testid="mlp-contraction-support">Contraction output feature ' + ctx.outputFeature + ' depends on all ' +
          explanation.terms.length + ' hidden activations; it is not paired one-to-one with hidden feature ' + ctx.hiddenFeature + '.</p>'
        : '<p data-testid="mlp-contraction-support">Contraction support is unavailable in this evidence; no contributor count is substituted.</p>';
      body += publicDepthArithmetic(model, ctx, down, ctx.outputFeature);
    }
    if (residual) body += publicDepthArithmetic(model, ctx, residual, ctx.outputFeature);
  } else if (ctx.kind === 'logits') {
    const member = ctx.members.find(candidate => candidate.kind === 'logits');
    if (member) body += publicDepthArithmetic(model, ctx, member, publicDepthElement(model, ctx, member));
  }
  const scalarMember = publicDepthSelected(ctx);
  if (scalarMember) {
    const scalarElement = publicDepthScalarElement(ctx, scalarMember);
    body += '<section class="spatial-scalar" id="microscope"><h3>Selected scalar / Microscope</h3><p>' +
      esc(publicDepthMemberLabel(scalarMember)) + ' component [' + scalarElement + ']</p>' +
      publicDepthScalar(model, scalarMember, scalarElement) + '</section>';
  }
  return '<div class="dock-math-content" data-testid="dock-math" data-public-depth-kind="' + esc(ctx.kind) + '"><p><strong>' +
    esc(opts.tourContent?.headline ?? ctx.kind) + '</strong> - authentic arithmetic remains bound to run <code>' +
    esc(ctx.canonical.run) + '</code>.</p>' + body + '</div>';
}

function renderPublicPart1Source(opts: ContextualDockOptions, ctx: ResolvedPublicDepthContext): string {
  const model = opts.model!;
  const selectedMember = publicDepthSelected(ctx);
  const selectedElement = selectedMember ? publicDepthScalarElement(ctx, selectedMember) : ctx.element;
  const kinds = [...new Set(ctx.members.map(member => member.kind))];
  const rows = ctx.members.map(member => {
    const detail = member.parameter ? model.forward.parameterDetails[member.parameter] : undefined;
    const matrix = member.parameter ? model.forward.matrix(member.parameter) : undefined;
    const matrixShape = matrix ? matrix.length + ' x ' + (matrix[0]?.length ?? 0) : undefined;
    return '<tr><th>' + esc(publicDepthMemberLabel(member)) + '</th><td><code>' + esc(member.semanticId) +
      '</code></td><td><code>' + esc(member.artifactId ?? 'NOT CAPTURED') + '</code><br>' + esc(member.availability) +
      (member.provenance ? '<br>' + esc(member.provenance) : '') + '</td><td>' +
      (member.parameter ? '<code>' + esc(member.parameter) + '</code>' + (matrixShape ? ' [' + esc(matrixShape) + ']' : '') +
        '<br>' + esc(detail?.dtype ?? 'unknown') + ' - ' + esc(detail?.axes?.join(' x ') ?? 'axes unavailable') : 'not applicable') +
      '</td></tr>';
  }).join('');
  return '<div class="dock-source-content" data-testid="dock-source" data-public-depth-kind="' + esc(ctx.kind) + '">' +
    '<div class="dock-provenance-grid"><p>Canonical lesson: <strong>' + esc(opts.tourContent?.headline ?? ctx.kind) + '</strong></p>' +
    '<p>Run: <code data-testid="spatial-run">' + esc(ctx.canonical.run) + '</code></p>' +
    '<p>Snapshot: <code data-testid="spatial-snapshot">' + esc(ctx.canonical.snapshot ?? 'unavailable') + '</code></p>' +
    '<p>Runtime: <code data-testid="spatial-runtime">' + esc(model.runtime) + '</code></p>' +
    '<p>Position: p' + ctx.canonical.position + (ctx.canonical.layer === undefined ? '' : ' / layer ' + ctx.canonical.layer) +
    (ctx.canonical.head === undefined ? '' : ' / head ' + ctx.canonical.head) +
    (ctx.selectedHead === undefined || ctx.selectedHead === ctx.canonical.head ? '' : ' / inspected head ' + ctx.selectedHead) +
    (ctx.selectedKey === undefined ? '' : ' / inspected key ' + ctx.selectedKey) + '</p>' +
    (selectedMember ? '<p>Detail selection: ' + esc(publicDepthMemberLabel(selectedMember)) + ' component [' + selectedElement + ']</p>' : '') +
    '<p>Source relationship: ' + esc(model.source.relationship) + ' - ' + esc(model.source.origin) + ' - ' + esc(model.source.availability) + '</p></div>' +
    '<div class="table-scroll"><table data-testid="public-depth-source-members"><thead><tr><th>Mechanism member</th>' +
    '<th>Semantic operation identity</th><th>Artifact / availability</th><th>Parameter identity</th></tr></thead><tbody>' +
    rows + '</tbody></table></div><details><summary>Read grouped operation sources</summary>' +
    kinds.map(kind => '<section><h3>' + esc(kind) + '</h3>' + sourceView(kind) + '</section>').join('') + '</details></div>';
}

function renderValues(opts: ContextualDockOptions): string {
  const { model: m, address: a, element, parameter, row, column, pin, trainingProgress, learningStage, learningModel, learningRouteStop } = opts;
  if (!m) return '<p>No model loaded.</p>';
  const publicDepth = resolvedPart1Depth(opts);
  if (publicDepth) return renderPublicPart1Values(opts, publicDepth);
  const publicTrainingDepth = resolvedPart2Depth(opts);
  if (publicTrainingDepth) return renderPublicPart2Values(opts, publicTrainingDepth);

  if (learningRouteStop === 6 || opts.tourContent?.state === 'p2_adam_proposal' || opts.tourContent?.state === 'candidate_ready') {
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
  const publicDepth = resolvedPart1Depth(opts);
  if (publicDepth) return renderPublicPart1Math(opts, publicDepth);
  const publicTrainingDepth = resolvedPart2Depth(opts);
  if (publicTrainingDepth) return renderPublicPart2Math(opts, publicTrainingDepth);

  if (learningRouteStop === 6 || opts.tourContent?.state === 'p2_adam_proposal' || opts.tourContent?.state === 'candidate_ready') {
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
  const publicDepth = resolvedPart1Depth(opts);
  if (publicDepth) return renderPublicPart1Source(opts, publicDepth);
  const publicTrainingDepth = resolvedPart2Depth(opts);
  if (publicTrainingDepth) return renderPublicPart2Source(publicTrainingDepth);

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
  const isPublic = profile === 'visitor' || Boolean(opts.tourContent);
  const publicDepthContext = resolvedPart1Depth(opts);
  const publicTrainingDepthContext = resolvedPart2Depth(opts);
  const dockAddress = publicDepthContext?.canonical.anchor ?? opts.address;
  const dockLabel = publicDepthContext || publicTrainingDepthContext ? (opts.tourContent?.headline ?? addressLabel(dockAddress)) : (opts.selectedLabel ?? addressLabel(opts.address));

  if (opts.attract) {
    return `<section class="contextual-dock short-guide" data-testid="contextual-dock" data-active-depth="explain" aria-label="Contextual explanation dock">
    <div class="dock-header" data-testid="dock-header">
      <div class="dock-route-info dock-slot-context">
        <strong class="dock-brand">MODEL LAB</strong>
        <span class="dock-status-message">Explore how a tiny language model predicts what comes next</span>
      </div>
      <div class="dock-route-actions dock-slot-actions">
        <div class="dock-slot-secondary"></div>
        <div class="dock-slot-primary">
          ${primaryAction}
        </div>
      </div>
    </div>
    <div class="dock-body" data-testid="dock-body">
      ${bodyContent}
    </div>
  </section>`;
  }

  const candidateDecisionDisabled = !opts.trainingState?.ready || Boolean(opts.trainingState.disabled);
  const inspectAction = isExpanded
    ? `<button id="dock-inspect" class="secondary-action dock-tab dock-tab-close" data-dock-depth="explain">← Return to overview</button>`
    : `<button id="dock-inspect" class="secondary-action dock-tab" data-dock-depth="values">${isPublic ? 'Details (optional)' : 'Inspect evidence ▾'}</button>`;

  return `<section class="contextual-dock short-guide ${isExpanded ? 'is-expanded' : ''}" data-testid="contextual-dock" data-active-depth="${effectiveDepth}" aria-label="Contextual explanation dock">
    <div class="dock-header" data-testid="dock-header">
      <div class="dock-route-info dock-slot-context">
        ${lessonProgress ? `<span class="lesson-progress" data-testid="lesson-progress">${esc(lessonProgress)}</span>` : ''}
        <span class="dock-selected-object" data-testid="selected-world-object" data-semantic-anchor="${dockAddress.kind}" data-position="${dockAddress.token}" data-layer="${dockAddress.layer ?? ''}" data-run-id="${esc(opts.model?.source.sourceRunId ?? '')}">${esc(dockLabel)}</span>
        ${opts.trainingState && opts.trainingState.frontierText ? `<span data-testid="execution-frontier" class="execution-frontier-tag">${esc(opts.trainingState.frontierText)}</span>` : ''}
        ${shortDetour ? `<span class="dock-detour-badge">Detour</span>` : ''}
      </div>
      <div class="dock-route-actions dock-slot-actions"${opts.trainingState ? ` id="execution-controls" data-execution-id="${esc(opts.trainingState.executionId)}" data-sequence="${opts.trainingState.sequence}" data-training-phase="${esc(opts.trainingState.phase)}"` : ''}>
        <div class="dock-slot-secondary">
          ${inspectAction}
          ${opts.tourContent ? (
            opts.tourContent.state === 'candidate_ready' ? (
              shortDetour ? `
                <button id="short-resume" class="secondary-action">Resume route</button>
              ` : `
                ${hasComparison ? `<button class="secondary-action dock-tab" data-dock-depth="compare">Compare candidate</button>` : ''}
              `
            ) : opts.tourContent.state === 'tour_complete' ? `
              ${!isFacilitator && !opts.attract ? `<button id="visitor-explore-toggle" class="secondary-action">${freeExplore ? 'Close free exploration' : 'Explore freely'}</button>` : ''}
              ${isFacilitator ? `<button id="operator-controls" class="secondary-action">${operatorControls ? 'Hide operator controls' : 'Show operator controls'}</button>` : ''}
            ` : `
              ${attentionAction}
              ${shortDetour ? `<button id="short-resume" class="secondary-action">Resume route</button>` : ''}
              ${isFacilitator ? `<button id="operator-controls" class="secondary-action">${operatorControls ? 'Hide operator controls' : 'Show operator controls'}</button>` : ''}
            `
          ) : opts.trainingState ? (
            opts.trainingState.ready ? `
              ${hasComparison ? `<button class="secondary-action dock-tab" data-dock-depth="compare">Compare candidate</button>` : ''}
              <button id="execution-cancel" class="secondary-action" ${opts.trainingState.cancelling ? 'disabled' : ''}>Discard candidate</button>
            ` : `
              ${opts.trainingState.canPin ? `<button id="execution-pin" class="secondary-action" ${opts.trainingState.disabled ? 'disabled' : ''}>${esc(opts.trainingState.pinLabel)}</button>` : ''}
              <button id="execution-cancel" class="secondary-action" ${opts.trainingState.cancelling ? 'disabled' : ''}>Cancel training</button>
            `
          ) : `
            ${attentionAction}
            ${!isFacilitator && !opts.attract ? `<button id="visitor-explore-toggle" class="secondary-action">${freeExplore ? 'Close free exploration' : 'Explore freely'}</button>` : ''}
            ${shortDetour ? `<button id="short-resume" class="secondary-action">Resume route</button>` : ''}
            ${isFacilitator ? `<button id="operator-controls" class="secondary-action">${operatorControls ? 'Hide operator controls' : 'Show operator controls'}</button>` : ''}
          `}
        </div>
        <div class="dock-slot-primary">
          ${opts.tourContent ? (
            opts.tourContent.state === 'candidate_ready' && !shortDetour ? `
              <div class="candidate-decision-pair" role="group" aria-label="Candidate decision">
                <button id="execution-cancel" class="decision-action discard-action" ${candidateDecisionDisabled || opts.trainingState?.cancelling ? 'disabled' : ''}>Discard candidate</button>
                <button id="execution-accept" class="decision-action accept-action" ${candidateDecisionDisabled ? 'disabled' : ''}>Accept update</button>
              </div>
            ` : `
              ${primaryAction}
            `
          ) : opts.trainingState ? (
            opts.trainingState.ready ? `
              <button id="execution-accept" class="primary-action" ${opts.trainingState.disabled ? 'disabled' : ''}>Accept update</button>
            ` : `
              <button id="execution-continue" class="primary-action" ${opts.trainingState.disabled ? 'disabled' : ''}>Continue</button>
            `
          ) : `
            ${primaryAction}
          `}
        </div>
      </div>
    </div>
    ${isExpanded ? `
    <nav class="dock-depth-nav" aria-label="Evidence depth">
      <span class="depth-nav-label">DEEPER INSPECTION</span>
      <button class="dock-tab ${effectiveDepth === 'values' ? 'active' : ''}" data-dock-depth="values" ${effectiveDepth === 'values' ? 'aria-pressed="true"' : ''}>Values</button>
      <button class="dock-tab ${effectiveDepth === 'math' ? 'active' : ''}" data-dock-depth="math" ${effectiveDepth === 'math' ? 'aria-pressed="true"' : ''}>Exact Math</button>
      <button class="dock-tab ${effectiveDepth === 'source' ? 'active' : ''}" data-dock-depth="source" ${effectiveDepth === 'source' ? 'aria-pressed="true"' : ''}>Source</button>
      ${hasComparison ? `<button class="dock-tab ${effectiveDepth === 'compare' ? 'active' : ''}" data-dock-depth="compare" ${effectiveDepth === 'compare' ? 'aria-pressed="true"' : ''}>Compare</button>` : ''}
    </nav>
    ` : ''}
    <div class="dock-body" data-testid="dock-body">
      ${bodyContent}
    </div>
  </section>`;
}
