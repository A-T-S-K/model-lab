import type { SpatialReadModel } from './bindings.js';
import type { Address, Explanation } from './forward.js';
import { operations, parameterOwners } from './forward.js';
import type { ForwardProgress, RunResult } from '../worker/protocol.js';
import type { ArchivedSnapshot } from '../../archive/session.js';
import type { InspectionResult } from '../../inspect/types.js';
import type { TrainingProgress } from '../worker/training-execution.js';
import type { LearningModel, LearningStage, ParameterPin } from './learning.js';
import { publicSupportActions, type PublicTourContent, type PublicSupportAction } from './public-tour.js';
import {
  resolvePublicDepthContext,
  type PublicDepthSelection,
  type ResolvedPublicDepthContext,
  type ResolvedPublicDepthMember,
} from './public-depth.js';
import {
  resolvePublicTrainingDepthContext,
  type PublicArtifactInspectionTarget,
  type PublicGradientInspectionTarget,
  type PublicTrainingDepthSelection,
  type ResolvedPublicTrainingDepthContext,
} from './public-training-depth.js';
import { formatCandidateOutcomeMeanLoss, formatCandidateTargetTokenProbability } from './public-tour.js';
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
  readonly supportAction?: string;
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

function renderPublicSupport(opts: ContextualDockOptions, action: PublicSupportAction): string {
  const context = resolvedPart1Depth(opts);
  const training = resolvedPart2Depth(opts);
  const member = (id: string) => context?.members.find(candidate => candidate.memberId === id);
  const vector = (id: string) => {
    const selected = member(id);
    const raw = selected && selected.availability === 'available' ? opts.model?.forward.values(selected.address) : undefined;
    return raw && selected?.slice ? raw.slice(selected.slice.start, selected.slice.end) : raw;
  };
  const firstComponent = (id: string, label: string) => `<div class="support-observation support-short-row" title="${esc(member(id)?.role ?? label)}"><strong>${esc(label)}</strong><span>[0] ${vector(id)?.[0] === undefined ? 'unavailable' : `${fmt(vector(id)![0])} observed`}</span></div>`;
  let calculation = '';
  if (action.id === 'components') {
    if (context) calculation = `<div data-testid="support-calculation">${firstComponent('tokenEmbedding', 'Token')}${firstComponent('positionEmbedding', 'Position')}${firstComponent('embeddingSum', 'Sum')}</div>`;
  } else if (action.id === 'projection') {
    const q = member('q');
    const witness = q && opts.model?.forward.explain(q.address, q.slice?.start ?? 0);
    if (witness?.terms && witness.observed !== undefined) calculation = `<p data-testid="support-calculation">Q[0]: derived Σ(${witness.terms.length} input × weight terms) = ${fmt(witness.terms.reduce((sum, term) => sum + term.product, 0))}; observed ${fmt(witness.observed)}.</p>`;
  } else if (action.id === 'score') {
    const q = vector('query');
    const key = context?.selectedKey ?? 0;
    const kMember = context?.members.find(candidate => candidate.memberId === 'keys' && candidate.key === key);
    const raw = kMember && kMember.availability === 'available' ? opts.model?.forward.values(kMember.address) : undefined;
    const k = raw && kMember?.slice ? raw.slice(kMember.slice.start, kMember.slice.end) : raw;
    const score = vector('scores')?.[key];
    if (q && k && q.length === k.length && score !== undefined) calculation = `<p data-testid="support-calculation">p${context?.canonical.position} Q · p${key} K / √${q.length}: derived ${fmt(q.reduce((sum, value, index) => sum + value * k[index]!, 0) / Math.sqrt(q.length))}; observed score ${fmt(score)}.</p>`;
  } else if (action.id === 'softmax') {
    const weights = member('weights');
    const key = context?.selectedKey ?? 0;
    const witness = weights && opts.model?.forward.explain(weights.address, key);
    if (witness?.exponentials?.[key] !== undefined && witness.denominator !== undefined && witness.observed !== undefined) calculation = `<p data-testid="support-calculation">p${key}: derived exp(score − max) / shared sum = ${fmt(witness.exponentials[key]!)} / ${fmt(witness.denominator)} ≈ ${fmt(witness.exponentials[key]! / witness.denominator)}; observed weight ${fmt(witness.observed)}.</p>`;
  } else if (action.id === 'terms') {
    const output = member('headOutput');
    const witness = output && opts.model?.forward.explain(output.address, 0);
    if (context?.completeSupport && witness?.probabilities && witness.points && witness.observed !== undefined) calculation = `<p data-testid="support-calculation">Head output[0]: derived Σ(${witness.points.length} eligible weight × Value[0] terms) = ${fmt(witness.points.reduce((sum, point, index) => sum + witness.probabilities![index]! * point![0]!, 0))}; observed ${fmt(witness.observed)}.</p>`;
  } else if (action.id === 'loss') {
    const row = training?.objective?.rows.find(candidate => candidate.position === training.objective?.selectedPosition) ?? training?.objective?.rows[0];
    if (row?.derivedLoss !== undefined && row.recordedLoss !== undefined) calculation = `<p data-testid="support-calculation">p${row.position}: derived −log(${fmt(row.probability)}) = ${fmt(row.derivedLoss)}; observed loss ${fmt(row.recordedLoss)}.</p>`;
  } else if (action.id === 'positions') {
    if (training?.objective?.rows.length && training.objective.observedMean !== undefined) calculation = `<div data-testid="support-calculation">${training.objective.rows.map(row => `<div class="support-observation support-short-row"><strong>p${row.position} · ${esc(row.targetLabel)}</strong><span>${row.recordedLoss === undefined ? 'unavailable' : `${fmt(row.recordedLoss)} observed`}</span></div>`).join('')}<div class="support-observation support-short-row"><strong>Mean</strong><span>${fmt(training.objective.observedMean)} observed</span></div></div>`;
  } else if (action.id === 'candidate') {
    const candidate = training?.candidate;
    if (candidate) calculation = `<div data-testid="support-calculation" data-baseline-run-id="${esc(candidate.baselineRunId)}" data-candidate-run-id="${esc(candidate.candidateRunId)}">${candidate.outputLabels.map((label, index) => {
      const row = candidate.rows.find(item => item.position === candidate.selectedPosition) ?? candidate.rows[0];
      return `<div class="support-observation support-short-row"><strong>${esc(label)}</strong><span>${fmt(row?.baselineDistribution[index])} → ${fmt(row?.candidateDistribution[index])}</span></div>`;
    }).join('')}<small>Selected p${candidate.selectedPosition}; accepted → provisional candidate, same example.</small></div>`;
  } else if (action.id === 'stages') {
    const stages = ['preMlpNorm', 'mlpUp', 'mlpRelu', 'mlpDown'];
    if (context?.completeSupport) calculation = `<div data-testid="support-calculation">${stages.map((id, index) => firstComponent(id, ['Normalize · 8', 'Expand · 32', 'ReLU · 32', 'Contract · 8'][index]!)).join('')}</div>`;
  } else if (action.id === 'accumulation') {
    if (training?.backwardComplete && training.finalGradient !== undefined) calculation = `<p data-testid="support-calculation">${training.retainedContributions.length} matching contribution rows are retained as a subset. Completed observed gradient: ${fmt(training.finalGradient)}. The retained subset is not claimed as the full sum.</p>`;
  } else if (action.id === 'adam') {
    const proposal = training?.proposal;
    if (proposal) calculation = `<div data-testid="support-calculation"><div class="support-observation">Observed g ${fmt(proposal.gradient)} · m ${fmt(proposal.mBefore)} → ${fmt(proposal.mAfter)}</div><div class="support-observation">Observed v ${fmt(proposal.vBefore)} → ${fmt(proposal.vAfter)} · corrected m̂/v̂ ${fmt(proposal.mHat)} / ${fmt(proposal.vHat)}</div><div class="support-observation">Stored Δ ${fmt(proposal.delta)} · θ ${fmt(proposal.before)} → ${fmt(proposal.after)} provisional</div></div>`;
  } else if (action.id === 'combined') {
    const stages = ['attentionOutput', 'attentionProjection', 'savedResidual', 'attentionResidual'];
    if (context?.completeSupport) calculation = `<div data-testid="support-calculation">${stages.map((id, index) => firstComponent(id, ['Concat', 'WO', 'Saved residual', 'Result'][index]!)).join('')}</div>`;
  } else if (action.id === 'scores' || action.id === 'weights') {
    const values = vector(action.id);
    if (context?.completeSupport && values) calculation = `<div data-testid="support-calculation">${context.eligibleKeys.map(key => `<div class="support-observation">p${key}: ${values[key] === undefined ? 'unavailable' : `${fmt(values[key])} observed`}</div>`).join('')}</div>`;
  } else if (action.id === 'distribution') {
    const values = vector('probabilities');
    if (context?.completeSupport && values) calculation = `<div data-testid="support-calculation">${values.map((value, index) => `<div class="support-observation">${esc(outputTokenName(index, opts.model?.forward.vocabulary ?? []))}: ${fmt(value)} observed</div>`).join('')}</div>`;
  }
  const memberIds = action.id === 'qkv' ? ['q', 'k', 'v'] : action.id === 'components' ? ['tokenEmbedding', 'positionEmbedding', 'embeddingSum'] : action.member ? [action.member] : [];
  const observed = memberIds.flatMap(id => context?.members.filter(member => member.memberId === id).slice(0, 1) ?? []).map(member => {
    const raw = opts.model?.forward.values(member.address);
    const values = raw && member.availability === 'available' ? (member.slice ? raw.slice(member.slice.start, member.slice.end) : raw) : undefined;
    return `<div class="support-observation" data-member="${esc(member.memberId)}" data-artifact-id="${esc(member.artifactId ?? '')}"><strong>${esc(member.role)} · ${values ? 'observed' : esc(member.availability)}</strong><span>${values ? values.slice(0, 2).map(fmt).join(' · ') : 'Numerical values unavailable'}${values && values.length > 2 ? ` · … (${values.length} total)` : ''}</span></div>`;
  }).join('');
  return `<aside id="dock-context-support" class="dock-context-support" data-testid="dock-context-support" data-support-action="${esc(action.id)}" data-run-id="${esc(opts.model?.source.sourceRunId ?? '')}" data-source-run-id="${esc(training?.sourceRunId ?? context?.canonical.run ?? '')}" aria-label="${esc(action.label)}">
    <strong>${esc(action.label)}</strong>
    ${calculation || observed || `<p>${esc(action.explanation ?? opts.tourContent?.whyHere ?? '')}</p>`}
  </aside>`;
}

const defaultSupport: Partial<Record<PublicTourContent['state'], string>> = {
  p1_prediction_preview: 'The visible distribution is this run’s prediction at the selected position. The lesson follows the computation that produced it.',
  p1_represent: 'The combined embedding passes through two distinct normalizations before attention projections. The earlier normalized stream remains available for residual addition.',
  p1_qkv: 'Q and K meet in the score calculation. V takes a different path: its components enter the mixture only after scores become weights.',
  p1_attention_compare: 'Current Q × each eligible K → raw scores. Future positions are unavailable to this causal comparison.',
  p1_attention_weights: 'Raw attention scores → softmax over eligible positions → normalized mixing weights.',
  p1_value_mixture: 'Each eligible position supplies one weight for its whole Value vector. The head output adds those weighted vectors component by component.',
  p1_attention_integration: 'Head outputs → concatenate → WO projection → add the saved residual. Concatenation joins channels; addition combines values.',
  p1_transform: 'The 8 → 32 expansion creates feature channels. ReLU gates them before the 32 → 8 contraction; the saved residual joins after that contraction.',
  p1_score: 'The vocabulary projection produces raw signed scores. Output softmax converts those scores to probabilities in the next step.',
  p1_probabilities: 'Raw signed scores → output softmax → probabilities over possible next tokens.',
  p2_objective: 'Each target position contributes a loss. Their mean is the training objective used for this example.',
  p2_backward_trace: 'The highlighted path shows which earlier computation can influence the loss. Backward explanation follows dependency and sensitivity; it is not reverse runtime execution.',
  p2_gradient_contribution: 'Incoming sensitivity × local derivative = this contribution. It joins the running partial gradient for the selected parameter.',
  p2_final_gradient: 'Partial contributions accumulate into the final gradient. A gradient is not yet a parameter update.',
  p2_adam_proposal: 'Final gradient + saved optimizer state → proposed parameter value. The accepted value remains in force until acceptance.',
  candidate_ready: 'Mean loss summarizes this training example; target probability tracks one selected position. One-example improvement does not establish general model improvement.',
};

function renderDefaultSupport(opts: ContextualDockOptions): string {
  const content = defaultSupport[opts.tourContent!.state];
  const context = resolvedPart1Depth(opts);
  const model = opts.model;
  const state = opts.tourContent!.state;
  const find = (id: string) => context?.members.find(item => item.memberId === id);
  const values = (id: string) => {
    const item = find(id);
    const raw = item?.availability === 'available' ? model?.forward.values(item.address) : undefined;
    return raw && item?.slice ? raw.slice(item.slice.start, item.slice.end) : raw;
  };
  const number = (id: string, index = 0) => values(id)?.[index];
  const cell = (label: string, value: number | undefined, origin = 'observed', member = '') => `<span class="support-observation" data-member="${esc(member)}" data-evidence-origin="${origin}" data-value="${value ?? ''}">${esc(label)} ${fmt(value)} · ${origin.toUpperCase()}</span>`;
  const row = (label: string, cells: string, note = '') => `<div class="support-short-row"><strong>${esc(label)}</strong><span>${cells}</span>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
  const p = context?.canonical.position ?? 0;
  const k = context?.selectedKey ?? 0;
  const h = context?.selectedHead ?? 0;
  const feature = context?.outputFeature ?? 0;
  const keyMember = context?.members.find(item => item.memberId === 'keys' && item.key === k);
  const keyRaw = keyMember?.availability === 'available' ? model?.forward.values(keyMember.address) : undefined;
  const keyValues = keyRaw && keyMember?.slice ? keyRaw.slice(keyMember.slice.start, keyMember.slice.end) : keyRaw;
  let witness = '';
  if (context && model) {
    if (state === 'p1_prediction_preview') {
      const distribution = values('probabilities');
      const top = distribution?.length ? distribution.indexOf(Math.max(...distribution)) : -1;
      witness = row('Next token', cell(`P(${top < 0 ? '?' : outputTokenName(top, model.forward.vocabulary)})`, top < 0 ? undefined : distribution![top], 'observed', 'probabilities'), `Observed distribution across ${distribution?.length ?? 0} choices.`);
    }
    if (state === 'p1_represent') witness = row('Feature 0', `${cell('token +', number('tokenEmbedding'), 'observed', 'tokenEmbedding')} ${cell('position =', number('positionEmbedding'), 'observed', 'positionEmbedding')} ${cell('sum check', number('tokenEmbedding') !== undefined && number('positionEmbedding') !== undefined ? number('tokenEmbedding')! + number('positionEmbedding')! : undefined, 'derived', 'embeddingSum')} ${cell('sum', number('embeddingSum'), 'observed', 'embeddingSum')}`) + row('Normalize', `${cell('saved residual', number('embeddingNorm'), 'observed', 'embeddingNorm')} ${cell('attention input', number('preAttentionNorm'), 'observed', 'preAttentionNorm')}`, 'Normalization uses the full vector.');
    if (state === 'p1_qkv') {
      const q = find('q'); const e = q && model.forward.explain(q.address, q.slice?.start ?? 0);
      const sum = e?.terms?.reduce((total, term) => total + term.product, 0);
      witness = row('Shared input → Q', `${cell('input[0]', number('input'), 'observed', 'input')} ${cell('Σ input × weight', sum, 'derived', 'q')} ${cell('Q[0]', number('q'), 'observed', 'q')}`) + row(`Head ${h}`, `${cell('K[0]', number('k'), 'observed', 'k')} ${cell('V[0]', number('v'), 'observed', 'v')}`, 'Q, K and V use separate projections.');
    }
    if (state === 'p1_attention_compare') {
      const q = values('query'); const score = q && keyValues && q.length === keyValues.length ? q.reduce((total, v, i) => total + v * keyValues[i]!, 0) / Math.sqrt(q.length) : undefined;
      witness = row(`p${p} Q · p${k} K / √${q?.length ?? '?'}`, `${cell('score', score, 'derived', 'scores')} ${cell('captured score', number('scores', k), 'observed', 'scores')}`, `${context.futureKeys.length} future keys: NOT APPLICABLE.`);
    }
    if (state === 'p1_attention_weights') {
      const w = find('weights'); const e = w && model.forward.explain(w.address, k);
      const derived = e?.exponentials?.[k] !== undefined && e.denominator ? e.exponentials[k]! / e.denominator : undefined;
      witness = row(`Softmax over ${context.eligibleKeys.length} scores`, `${cell(`score[k${k}]`, number('scores', k), 'observed', 'scores')} ${cell('exp / row sum', derived, 'derived', 'weights')} ${cell('weight', number('weights', k), 'observed', 'weights')}`, 'The denominator uses the whole eligible row.');
    }
    if (state === 'p1_value_mixture') {
      const out = find('headOutput'); const e = out && model.forward.explain(out.address, feature);
      const sum = e?.probabilities && e.points ? e.points.reduce((total, point, i) => total + e.probabilities![i]! * point![feature]!, 0) : undefined;
      witness = row(`Head ${h} component ${feature}`, `${cell(`Σ ${context.eligibleKeys.length} weights × Values`, sum, 'derived', 'headOutput')} ${cell('head result', number('headOutput', feature), 'observed', 'headOutput')}`, 'Every eligible Value contributes.');
    }
    if (state === 'p1_attention_integration') {
      const heads = context.members.filter(item => item.memberId === 'headOutputs').map(item => {
        const headValue = item.availability === 'available' ? model.forward.values(item.address)?.[0] : undefined;
        return cell(`h${item.head ?? 0}[0]`, headValue, 'observed', 'headOutputs');
      }).join(' ');
      witness = row('Join heads → WO', `${heads} ${cell('concat[0]', number('attentionOutput'), 'observed', 'attentionOutput')} ${cell(`WO[${feature}]`, number('attentionProjection', feature), 'observed', 'attentionProjection')}`, 'Concatenation joins channels; WO aggregates them.') + row('Residual add', `${cell('saved', number('savedResidual', feature), 'observed', 'savedResidual')} ${cell('WO + saved', number('attentionProjection', feature) !== undefined && number('savedResidual', feature) !== undefined ? number('attentionProjection', feature)! + number('savedResidual', feature)! : undefined, 'derived', 'attentionResidual')} ${cell('result', number('attentionResidual', feature), 'observed', 'attentionResidual')}`);
    }
    if (state === 'p1_transform') witness = row('8 → 32 → 8', `${cell('norm[0]', number('preMlpNorm'), 'observed', 'preMlpNorm')} ${cell('expand[0]', number('mlpUp'), 'observed', 'mlpUp')} ${cell('ReLU[0]', number('mlpRelu'), 'observed', 'mlpRelu')} ${cell(`contract[${feature}]`, number('mlpDown', feature), 'observed', 'mlpDown')}`, 'Contraction aggregates all 32 hidden features.') + row('Residual add', `${cell('saved', number('attentionResidual', feature), 'observed', 'attentionResidual')} ${cell('contract + saved', number('mlpDown', feature) !== undefined && number('attentionResidual', feature) !== undefined ? number('mlpDown', feature)! + number('attentionResidual', feature)! : undefined, 'derived', 'mlpResidual')} ${cell('result', number('mlpResidual', feature), 'observed', 'mlpResidual')}`);
    if (state === 'p1_score') witness = row('Vocabulary score', cell('logit[0]', number('logits'), 'observed', 'logits'), 'A raw signed score, before output softmax.');
    if (state === 'p1_probabilities' || state === 'p1_complete') {
      const distribution = values('probabilities');
      const top = distribution?.map((probability, index) => ({ probability, index })).sort((a, b) => b.probability - a.probability).slice(0, 3) ?? [];
      witness = row('Output softmax', `${cell('logit[0]', number('logits'), 'observed', 'logits')} ${cell(`P(${outputTokenName(0, model.forward.vocabulary)})`, number('probabilities'), 'observed', 'probabilities')}`, `Observed distribution · ${top.map(item => `${outputTokenName(item.index, model.forward.vocabulary)} ${fmt(item.probability)}`).join(' · ')}`);
    }
    if (state === 'p1_complete') {
      const at = (kind: string, head?: number) => model.forward.values({ kind, token: p, layer: 0, ...(head === undefined ? {} : { head }) })?.[0];
      witness = `<div class="support-short-row"><strong>Forward recap · OBSERVED</strong><div class="nl1-recap" data-evidence-origin="observed" data-value="${number('probabilities') ?? ''}">Representation ${fmt(at('preAttentionNorm'))} → Q/K/V ${fmt(at('q', h))}/${fmt(at('k', h))}/${fmt(at('v', h))}<br>Score ${fmt(at('attentionLogits', h))} → weight ${fmt(at('attentionProbabilities', h))} → head ${fmt(at('headOutput', h))}<br>Attention ${fmt(at('attentionResidual'))} → MLP ${fmt(at('mlpResidual'))}<br>Logit ${fmt(number('logits'))} → probability ${fmt(number('probabilities'))}</div><small>Representative results from distinct vector operations.</small></div>`;
    }
  }
  return `<aside id="dock-context-support" class="dock-context-support" data-testid="dock-context-support" data-support-action="default" data-run-id="${esc(model?.source.sourceRunId ?? '')}" data-source-run-id="${esc(context?.canonical.run ?? '')}" data-position="${context?.canonical.position ?? ''}" data-head="${context?.selectedHead ?? ''}" data-key="${context?.selectedKey ?? ''}" aria-label="Step overview"><strong>${context ? `p${p} · ${state === 'p1_complete' ? 'Forward recap' : 'Numerical witness'}` : 'Step overview'}</strong>${witness || `<p>${esc(content ?? 'Numerical evidence unavailable for this occurrence.')}</p>`}</aside>`;
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
      if (c.plainResult && ['p1_prediction_preview', 'p1_score', 'p1_probabilities'].includes(tc.state)) {
        stageResult = `<div class="dock-stage-result"><div class="teaching-step"><small class="stage-result-label">OBSERVED RESULT</small><p>${c.plainResult}</p></div></div>`;
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
            <small class="stage-result-label">MEASURED CONTRIBUTION · RUNNING TOTAL</small>
            <div class="dock-pin-info"><span data-testid="pin-owner">${esc(pinLabel)} → ${esc(pinOwnerTitle)}</span></div>
            <p class="contribution-math">Incoming sensitivity <strong>${fmt(event.childAdjoint)}</strong> × local derivative <strong>${fmt(event.localDerivative)}</strong> = contribution <span data-testid="live-contribution" data-value="${event.contribution}">${fmt(event.contribution)}</span></p>
            ${beforeVal !== undefined && afterVal !== undefined ? `<p class="accumulator-math">Previous running total <strong>${fmt(beforeVal)}</strong> + this contribution <strong>${fmt(event.contribution)}</strong> = new partial gradient <span data-testid="live-accumulator" data-value="${afterVal}">${fmt(afterVal)}</span></p>` : ''}
          </div>
        </div>`;
      }
    } else if (tc.state === 'p2_final_gradient') {
      const gradient = (trainingProgress && trainingProgress.final) ? trainingProgress.gradient : undefined;
      const isFinal = Boolean(trainingProgress?.final);
      if (gradient !== undefined && isFinal) {
        stageResult = `<div class="dock-stage-result">
          <div class="teaching-step">
            <small class="stage-result-label">MEASURED GRADIENT</small>
            <div class="dock-pin-info"><span data-testid="pin-owner">${esc(pinLabel)} → ${esc(pinOwnerTitle)}</span></div>
            <p class="learning-gradient-summary">All contributions finished. Final gradient: <span data-testid="live-gradient" data-value="${gradient}">${fmt(gradient)}</span></p>
          </div>
        </div>`;
      }
    } else if (tc.state === 'p2_adam_proposal') {
      const u = trainingProgress?.proposal;
      if (u) {
        stageResult = `<div class="dock-stage-result">
          <div class="teaching-step">
            <small class="stage-result-label">CURRENT VALUE → PROPOSED VALUE</small>
            <div class="dock-pin-info"><span data-testid="pin-owner">${esc(pinLabel)}</span></div>
            <p class="learning-provisional">Current ${fmt(u.before)} → proposed <span data-testid="live-proposal" data-value="${u.after}">${fmt(u.after)}</span></p>
            <p class="learning-adam-note">Adam uses the final gradient ${fmt(u.gradient)} and saved optimizer state to calculate this proposal. Accepted model unchanged.</p>
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
            <p class="candidate-outcome-summary">Mean loss on this example (derived from observed target probabilities): <span data-testid="before-mean" data-value="${ma.mean}">${fmt(ma.mean)}</span> → <span data-testid="after-mean" data-value="${mb.mean}">${fmt(mb.mean)}</span></p>
            <p class="candidate-prediction-change">Target '${esc(targetTokenLabel)}' at p${targetPos}: accepted ${fmt(probBefore)} → provisional candidate ${fmt(probAfter)}</p>
          </div>
        </div>`;
      }
    }

    return `<div class="dock-explain-content" data-testid="dock-explain">
      <div class="dock-overview" data-testid="scene-construction" data-run="${esc(m.source.sourceRunId)}">
        <div class="dock-stage-meaning">
          ${tc.state === 'tour_complete' ? `<p class="dock-completion-headline" data-testid="tour-completion-headline">${esc(tc.headline)}</p>` : ''}
          ${tc.learnerQuestion
            ? `<p class="dock-route-purpose" data-testid="route-purpose">${esc(tc.learnerQuestion)}</p>`
            : tc.routePurpose
              ? `<p class="dock-route-purpose" data-testid="route-purpose">${esc(tc.routePurpose)}</p>`
              : ''}
          <p class="dock-meaning-text">${esc(tc.plainMeaning)}</p>
          ${tc.state === 'p1_represent' || tc.state === 'p1_qkv' || tc.state === 'p1_transform' ? '<p class="construction-purpose">Bars show signed, authentic vector components; each panel may use a different scale.</p>' : ''}
          ${tc.state === 'p1_prediction_preview' || tc.state === 'p1_probabilities' ? '<p class="construction-purpose">These are real normalized output probabilities from this run.</p>' : ''}
          ${tc.state === 'p1_attention_weights' ? '<p class="construction-purpose">These are real normalized mixing weights across allowed positions, not output probabilities.</p>' : ''}
          ${tc.state === 'p2_gradient_contribution' || tc.state === 'p2_final_gradient' || tc.state === 'p2_adam_proposal' ? '<p class="construction-purpose">This grid contains model parameters: stored numbers used in the calculation. They change only when an update is accepted.</p>' : ''}
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

function publicTrainingArtifactInspection(label: string, target: PublicArtifactInspectionTarget | undefined): string {
  if (!target) return '';
  return `<button data-source-run="${esc(target.sourceRunId)}" data-artifact="${esc(target.artifactId)}" data-element="${target.element}">${esc(label)}</button>`;
}

function publicTrainingGradientInspection(label: string, target: PublicGradientInspectionTarget | undefined): string {
  if (!target) return '';
  return `<button data-source-run="${esc(target.sourceRunId)}" data-gradient-parameter="${target.parameterIndex}">${esc(label)}</button>`;
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
      ${publicTrainingArtifactInspection('Inspect target probability in Microscope', objective.probabilityInspection)}
      ${publicTrainingArtifactInspection('Inspect recorded position loss in Microscope', objective.lossInspection)}
      ${objective.derivedMean === undefined ? '<p>DERIVED mean unavailable until every authentic recorded per-position loss operand is available.</p>' : `<p>DERIVED: sum(${objective.rows.length} observed per-position losses) / ${objective.rows.length} = ${fmt(objective.derivedMean)}</p>`}
      <p>Observed runtime mean: ${objective.observedMean === undefined ? 'unavailable' : fmt(objective.observedMean)} ${objective.observedMean === undefined ? '[UNAVAILABLE]' : '[OBSERVED]'}</p>
      ${publicTrainingArtifactInspection('Inspect recorded mean objective in Microscope', objective.meanInspection)}
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
      ${publicTrainingGradientInspection('Inspect final gradient ancestry', ctx.gradientInspection)}
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
      ${publicTrainingGradientInspection('Inspect final gradient feeding this proposal', ctx.gradientInspection)}
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
    ${publicTrainingArtifactInspection('Inspect candidate target probability in Microscope', candidate.candidateProbabilityInspection)}
    <p data-testid="baseline-scalar-inspection-unavailable">Baseline distribution values are authentic recorded evidence; live baseline scalar ancestry is unavailable in this transaction context.</p>
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

function publicDepthScalar(
  model: SpatialReadModel,
  ctx: ResolvedPublicDepthContext,
  member: ResolvedPublicDepthMember,
  localElement: number,
): string {
  const element = publicDepthArtifactElement(member, localElement);
  const explanation = model.forward.explain(member.address, element);
  if (!explanation.indexValid || !explanation.artifact) return '<p>Selected scalar unavailable for this captured member.</p>';
  return '<button data-source-run="' + esc(ctx.canonical.run) + '" data-artifact="' +
    esc(explanation.artifact.id) + '" data-element="' + element +
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
      publicDepthScalar(model, ctx, scalarMember, scalarElement) + '</section>';
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
  const supportActions = opts.tourContent && !isExpanded ? publicSupportActions(opts.tourContent) : [];
  const activeSupport = supportActions.find(action => action.id === opts.supportAction);
  const hasCoreResult = supportActions.length > 0 && bodyContent.includes('class="dock-stage-result"');
  if (supportActions.length || (!isExpanded && opts.tourContent?.state === 'p1_complete')) bodyContent = `<div class="dock-guided-core">${bodyContent}</div><div class="dock-support-column"><span class="dock-support-heading">EXPLORE THIS STEP</span>${activeSupport ? renderPublicSupport(opts, activeSupport) : renderDefaultSupport(opts)}<nav class="dock-support-actions" aria-label="Contextual support">${activeSupport ? '<button type="button" data-support-action="default" aria-pressed="false" aria-controls="dock-context-support">Overview</button>' : ''}${supportActions.map(action => `<button type="button" data-support-action="${esc(action.id)}" aria-pressed="${activeSupport?.id === action.id}" aria-controls="dock-context-support">${esc(action.label)}</button>`).join('')}</nav></div>`;

  if (opts.attract) {
    return `<section class="contextual-dock short-guide" data-testid="contextual-dock" data-active-depth="explain" aria-label="Contextual explanation dock">
    <div class="dock-header" data-testid="dock-header">
      <div class="dock-route-info dock-slot-context">
        <strong class="dock-brand">MODEL LAB</strong>
        <span class="dock-status-message">${esc(opts.tourContent?.headline ?? 'See a tiny language model predict and learn')}</span>
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
    ? `<button id="dock-inspect" class="secondary-action dock-tab dock-tab-close" data-dock-depth="explain">← Return to Guided</button>`
    : `<button id="dock-inspect" class="secondary-action dock-tab" data-dock-depth="values">${isPublic ? 'Deep inspection' : 'Inspect evidence ▾'}</button>`;

  return `<section class="contextual-dock short-guide ${isExpanded ? 'is-expanded' : ''} ${supportActions.length || (!isExpanded && opts.tourContent?.state === 'p1_complete') ? 'has-support-actions' : ''} ${hasCoreResult ? 'has-core-result' : ''}" data-testid="contextual-dock" data-tour-state="${esc(opts.tourContent?.state ?? '')}" data-active-depth="${effectiveDepth}" data-active-support="${supportActions.length ? esc(activeSupport?.id ?? 'default') : ''}" aria-label="Contextual explanation dock">
    <div class="dock-header" data-testid="dock-header">
      <div class="dock-route-info dock-slot-context">
        ${opts.tourContent ? `<span class="lesson-progress lesson-macro-progress" data-testid="lesson-progress" aria-label="${esc(opts.tourContent.part === 1 ? 'Part 1 active; Part 2 upcoming' : opts.tourContent.state === 'tour_complete' ? 'Part 1 and Part 2 complete' : 'Part 1 complete; Part 2 active')}"><span class="${opts.tourContent.part === 1 ? 'active' : 'complete'}">1 · MAKE A PREDICTION</span><span aria-hidden="true">→</span><span class="${opts.tourContent.part === 1 ? 'upcoming' : opts.tourContent.state === 'tour_complete' ? 'complete' : 'active'}">2 · LEARN FROM ERROR</span><small>${esc(lessonProgress)}</small></span>` : lessonProgress ? `<span class="lesson-progress" data-testid="lesson-progress">${esc(lessonProgress)}</span>` : ''}
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
              ` : ''
            ) : opts.tourContent.state === 'tour_complete' ? `
              ${!isFacilitator && !opts.attract ? `<button id="visitor-explore-toggle" class="secondary-action">${freeExplore ? 'Close exploration' : 'Explore the Model'}</button>` : ''}
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
    <div class="dock-body" id="dock-body" data-testid="dock-body">
      ${bodyContent}
    </div>
  </section>`;
}
