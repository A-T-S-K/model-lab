// Temporary UI/session representation for the current implementation. LS0 instructional
// beats are not 1:1 with these states, and this list length is not a curriculum invariant.
export type PublicTourState =
  | 'cold'
  | 'p1_prediction_preview'
  | 'p1_represent'
  | 'p1_mix_context'
  | 'p1_transform'
  | 'p1_score'
  | 'p1_probabilities'
  | 'p1_complete'
  | 'p2_objective'
  | 'p2_gradient_contribution'
  | 'p2_final_gradient'
  | 'p2_adam_proposal'
  | 'candidate_ready'
  | 'tour_complete';

export const PUBLIC_TOUR_STATES: readonly PublicTourState[] = [
  'cold',
  'p1_prediction_preview',
  'p1_represent',
  'p1_mix_context',
  'p1_transform',
  'p1_score',
  'p1_probabilities',
  'p1_complete',
  'p2_objective',
  'p2_gradient_contribution',
  'p2_final_gradient',
  'p2_adam_proposal',
  'candidate_ready',
  'tour_complete',
] as const;

export type PublicTourOutcome = 'accepted' | 'discarded';

export interface PublicTourSelectionIntent {
  readonly kind: string;
  readonly token: number;
  readonly layer?: number;
  readonly head?: number;
  readonly parameter?: string;
  readonly derivedShortStop?: number;
  readonly derivedReverseStop?: number;
}

export interface PublicTourAction {
  readonly id: string;
  readonly label: string;
  readonly role?: 'primary' | 'secondary' | 'peer-decision';
  readonly disabled?: boolean;
}

export interface PublicTourResultConcept {
  readonly label: string;
  readonly description?: string;
}

export interface PublicTourContent {
  readonly state: PublicTourState;
  readonly part?: 1 | 2;
  readonly progress: string;
  readonly headline: string;
  readonly routePurpose: string;
  readonly plainMeaning: string;
  readonly resultConcept?: PublicTourResultConcept;
  readonly selectionIntent: PublicTourSelectionIntent;
  readonly primaryAction?: PublicTourAction;
  readonly optionalActions: readonly PublicTourAction[];
  readonly decisionActions?: readonly PublicTourAction[];
  readonly truthGuardrail?: string;
}

const REVERSE_TRUTH_GUARDRAIL = 'Backward explanation path over the real computation. Visual movement is not runtime timing.';

export function getPublicTourContent(
  state: PublicTourState,
  outcome?: PublicTourOutcome,
): PublicTourContent {
  switch (state) {
    case 'cold':
      return {
        state,
        progress: '',
        headline: 'RECORDED RUN · REPLAY',
        routePurpose: 'One small transformer · real connected computation',
        plainMeaning: 'Explore real character-by-character predictions and live learning inside one connected computation. Press Start to make a fresh prediction and follow information through the network.',
        selectionIntent: { kind: 'probabilities', token: 3, derivedShortStop: -1 },
        primaryAction: { id: 'exhibit-start', label: 'Start · explore a real prediction', role: 'primary' },
        optionalActions: [],
      };

    case 'p1_prediction_preview':
      return {
        state,
        part: 1,
        progress: 'Part 1 of 2 · 1 of 6 · Prediction',
        headline: 'PREDICTION',
        routePurpose: 'What does the model predict comes next?',
        plainMeaning: 'The model receives input tokens and produces a probability distribution over the vocabulary for what character comes next.',
        resultConcept: { label: 'Highest-probability token' },
        selectionIntent: { kind: 'probabilities', token: 3, derivedShortStop: 0 },
        primaryAction: { id: 'short-continue', label: 'See how it got there', role: 'primary' },
        optionalActions: [],
      };

    case 'p1_represent':
      return {
        state,
        part: 1,
        progress: 'Part 1 of 2 · 2 of 6 · Represent',
        headline: 'REPRESENT',
        routePurpose: "Turn the token and its position into the model's working representation",
        plainMeaning: 'The character token vector and position vector combine into the numerical representation used by the model.',
        resultConcept: { label: 'Working representation' },
        selectionIntent: { kind: 'preAttentionNorm', token: 3, layer: 0, derivedShortStop: 1 },
        primaryAction: { id: 'short-continue', label: 'Continue: MIX CONTEXT', role: 'primary' },
        optionalActions: [],
      };

    case 'p1_mix_context':
      return {
        state,
        part: 1,
        progress: 'Part 1 of 2 · 3 of 6 · Mix Context',
        headline: 'MIX CONTEXT',
        routePurpose: 'Combine allowed earlier positions through normalized attention weights and value mixtures',
        plainMeaning: 'Attention heads compare this position against allowed earlier positions, turning scores into normalized attention weights that mix value vectors together.',
        resultConcept: { label: 'Attended representation' },
        selectionIntent: { kind: 'attentionResidual', token: 3, layer: 0, head: 0, derivedShortStop: 2 },
        primaryAction: { id: 'short-continue', label: 'Continue: TRANSFORM', role: 'primary' },
        optionalActions: [{ id: 'attention-drill-down', label: 'Attention details (optional)', role: 'secondary' }],
      };

    case 'p1_transform':
      return {
        state,
        part: 1,
        progress: 'Part 1 of 2 · 4 of 6 · Transform',
        headline: 'TRANSFORM',
        routePurpose: 'Transform the representation through normalization, up projection, ReLU, down projection, and residual add',
        plainMeaning: 'The feed-forward network normalizes the representation, projects it up, applies a ReLU non-linearity, projects it down, and adds the result back to the residual stream.',
        resultConcept: { label: 'Transformed representation' },
        selectionIntent: { kind: 'mlpResidual', token: 3, layer: 0, derivedShortStop: 3 },
        primaryAction: { id: 'short-continue', label: 'Continue: SCORE', role: 'primary' },
        optionalActions: [],
      };

    case 'p1_score':
      return {
        state,
        part: 1,
        progress: 'Part 1 of 2 · 5 of 6 · Score',
        headline: 'SCORE',
        routePurpose: 'Project processed representations into raw vocabulary scores (logits)',
        plainMeaning: 'The final linear projection maps processed representations into raw unnormalized vocabulary scores (logits) for each character in the vocabulary.',
        resultConcept: { label: 'Vocabulary scores (logits)' },
        selectionIntent: { kind: 'logits', token: 3, derivedShortStop: 4 },
        primaryAction: { id: 'short-continue', label: 'Continue: PROBABILITIES', role: 'primary' },
        optionalActions: [],
      };

    case 'p1_probabilities':
      return {
        state,
        part: 1,
        progress: 'Part 1 of 2 · 6 of 6 · Probabilities',
        headline: 'PROBABILITIES',
        routePurpose: 'Normalize raw scores into a probability distribution across candidates',
        plainMeaning: 'Softmax converts raw logits into a normalized probability distribution summing to 100%. The model’s current prediction can be identified from this resulting distribution.',
        resultConcept: { label: 'Candidate probabilities' },
        selectionIntent: { kind: 'probabilities', token: 3, derivedShortStop: 5 },
        primaryAction: { id: 'short-continue', label: 'Complete Part 1', role: 'primary' },
        optionalActions: [],
      };

    case 'p1_complete':
      return {
        state,
        part: 1,
        progress: 'Part 1 Complete',
        headline: 'PART 1 COMPLETE',
        routePurpose: 'Forward prediction explanation complete. Ready to explore learning.',
        plainMeaning: 'You have walked through how the model predicts next tokens from inputs. In Part 2, see how the model learns by comparing predictions with actual targets and updating parameters.',
        resultConcept: { label: 'Forward walkthrough complete' },
        selectionIntent: { kind: 'probabilities', token: 3, derivedShortStop: 5 },
        primaryAction: { id: 'short-teach', label: 'Start Part 2: See how learning works', role: 'primary' },
        optionalActions: [],
      };

    case 'p2_objective':
      return {
        state,
        part: 2,
        progress: 'Part 2 of 2 · 1 of 5 · Measure error',
        headline: 'MEASURE ERROR',
        routePurpose: 'Predictions are compared with known targets across all positions to calculate error',
        plainMeaning: 'The model compares predictions with known targets across all positions to measure error. The mean loss forms the single training objective that supplies the backward pass.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'Mean training loss' },
        selectionIntent: { kind: 'probabilities', token: 3, derivedReverseStop: 0 },
        primaryAction: { id: 'reverse-continue', label: 'Continue: Trace gradient contribution', role: 'primary' },
        optionalActions: [],
      };

    case 'p2_gradient_contribution':
      return {
        state,
        part: 2,
        progress: 'Part 2 of 2 · 2 of 5 · Trace gradient contribution',
        headline: 'TRACE ONE GRADIENT CONTRIBUTION',
        routePurpose: 'Loss sensitivity propagates backward through dependencies to compute one parameter contribution',
        plainMeaning: 'Sensitivities propagate backward through actual computational dependencies. For the selected parameter, each backward occurrence multiplies the incoming child adjoint by the local derivative to produce one contribution added to the accumulator. The accumulator may still be partial.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'One gradient contribution' },
        selectionIntent: { kind: 'tokenEmbedding', parameter: 'wte', token: 3, derivedReverseStop: 5 },
        primaryAction: { id: 'reverse-continue', label: 'Continue: Finish parameter gradient', role: 'primary' },
        optionalActions: [],
      };

    case 'p2_final_gradient':
      return {
        state,
        part: 2,
        progress: 'Part 2 of 2 · 3 of 5 · Finish gradient',
        headline: 'FINAL PARAMETER GRADIENT',
        routePurpose: 'All backward contributions finish to yield the complete gradient for this parameter',
        plainMeaning: 'All incoming scalar backward contributions for this parameter have finished accumulating into the final gradient. The gradient measures loss sensitivity for this training objective; it is not the optimizer update.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'Final parameter gradient' },
        selectionIntent: { kind: 'tokenEmbedding', parameter: 'wte', token: 3, derivedReverseStop: 5 },
        primaryAction: { id: 'reverse-continue', label: 'Continue: Propose candidate with Adam', role: 'primary' },
        optionalActions: [],
      };

    case 'p2_adam_proposal':
      return {
        state,
        part: 2,
        progress: 'Part 2 of 2 · 4 of 5 · Adam proposal',
        headline: 'ADAM PROPOSES CANDIDATE',
        routePurpose: 'Adam combines the final gradient with persistent optimizer state to compute a provisional update',
        plainMeaning: 'Adam combines the final parameter gradient with persistent moments (m, v) to propose an updated parameter value. The proposal is provisional; the accepted model has not changed.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'Provisional parameter update' },
        selectionIntent: { kind: 'wte', parameter: 'wte', token: 3, derivedReverseStop: 6 },
        primaryAction: { id: 'reverse-continue', label: 'Continue: Compare candidate outcome', role: 'primary' },
        optionalActions: [],
      };

    case 'candidate_ready':
      return {
        state,
        part: 2,
        progress: 'Part 2 of 2 · 5 of 5 · Compare and decide',
        headline: 'CANDIDATE UPDATE READY',
        routePurpose: 'Provisional candidate prepared. Compare results on this training example before deciding.',
        plainMeaning: 'A provisional candidate model update has been prepared. Compare the outcome against the accepted baseline on this training example. A changed result or lower loss on this training example is not proof of general model improvement. Choose to accept the update or discard it.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'Provisional candidate outcome' },
        selectionIntent: { kind: 'probabilities', token: 3, derivedShortStop: 0 },
        decisionActions: [
          { id: 'execution-accept', label: 'Accept update', role: 'peer-decision' },
          { id: 'execution-cancel', label: 'Discard candidate', role: 'peer-decision' },
        ],
        optionalActions: [],
      };

    case 'tour_complete':
      const isAccepted = outcome === 'accepted';
      return {
        state,
        part: 2,
        progress: 'Tour Complete',
        headline: isAccepted ? 'UPDATE ACCEPTED' : 'UPDATE DISCARDED',
        routePurpose: isAccepted
          ? 'The candidate update was committed into the live accepted model.'
          : 'The candidate update was discarded. The live model remains in its prior accepted state.',
        plainMeaning: isAccepted
          ? 'Parameters and optimizer state have moved to the new checkpoint. Subsequent predictions use the updated weights.'
          : 'The provisional candidate was discarded without modifying model parameters.',
        resultConcept: { label: isAccepted ? 'Committed update' : 'Preserved baseline' },
        selectionIntent: { kind: 'probabilities', token: 3, derivedShortStop: 0 },
        primaryAction: { id: 'tour-restart', label: 'Start Over', role: 'primary' },
        optionalActions: [],
      };
  }
}

export function advanceTour(current: PublicTourState): PublicTourState {
  switch (current) {
    case 'cold':
      return 'cold';
    case 'p1_prediction_preview':
      return 'p1_represent';
    case 'p1_represent':
      return 'p1_mix_context';
    case 'p1_mix_context':
      return 'p1_transform';
    case 'p1_transform':
      return 'p1_score';
    case 'p1_score':
      return 'p1_probabilities';
    case 'p1_probabilities':
      return 'p1_complete';
    case 'p1_complete':
      return 'p1_complete';
    case 'p2_objective':
      return 'p2_gradient_contribution';
    case 'p2_gradient_contribution':
      return 'p2_final_gradient';
    case 'p2_final_gradient':
      return 'p2_adam_proposal';
    case 'p2_adam_proposal':
      return 'candidate_ready';
    case 'candidate_ready':
      return 'candidate_ready';
    case 'tour_complete':
      return 'tour_complete';
  }
}

export interface TourEvidence {
  readonly hasObjective: boolean;
  readonly hasMatchingContribution: boolean;
  readonly hasFinalGradient: boolean;
  readonly hasPinnedProposal: boolean;
  readonly hasCandidateComparison: boolean;
}

export function canAdvanceTour(current: PublicTourState, evidence: TourEvidence): boolean {
  switch (current) {
    case 'p2_objective':
      return evidence.hasObjective && evidence.hasMatchingContribution;
    case 'p2_gradient_contribution':
      return evidence.hasFinalGradient;
    case 'p2_final_gradient':
      return evidence.hasPinnedProposal;
    case 'p2_adam_proposal':
      return evidence.hasCandidateComparison;
    case 'cold':
    case 'p1_complete':
    case 'candidate_ready':
    case 'tour_complete':
      return false;
    default:
      return true;
  }
}

export interface LiveTrainingProgressEvidence {
  readonly phase?: string;
  readonly mean?: number;
  readonly pin?: number;
  readonly contributions?: readonly unknown[];
  readonly final?: boolean;
  readonly gradient?: number;
  readonly proposal?: unknown;
  readonly readyOutputs?: unknown;
  readonly candidateId?: string;
}

export function computeLiveTourEvidence(
  trainingProgress?: LiveTrainingProgressEvidence,
  selectedPinIndex?: number,
): TourEvidence {
  const t = trainingProgress;
  const hasObjective = t?.mean !== undefined;
  const hasMatchingContribution = Boolean(
    t &&
    t.contributions &&
    t.contributions.length > 0 &&
    (selectedPinIndex === undefined || t.pin === selectedPinIndex)
  );
  const hasFinalGradient = Boolean(t && t.final === true && t.gradient !== undefined);
  const hasPinnedProposal = Boolean(t && t.proposal !== undefined);
  const hasCandidateComparison = Boolean(t && t.phase === 'ready' && t.readyOutputs);

  return {
    hasObjective,
    hasMatchingContribution,
    hasFinalGradient,
    hasPinnedProposal,
    hasCandidateComparison,
  };
}

export function formatAdamGlanceNote(u: {
  gradient: number;
  mBefore: number;
  mAfter: number;
  vBefore: number;
  vAfter: number;
  fmt?: (n: number | undefined) => string;
}): string {
  const f = u.fmt ?? ((n: number | undefined) => (n !== undefined ? String(n) : ''));
  return `Adam combines final gradient g=${f(u.gradient)} with stored optimizer state (m=${f(u.mBefore)}, v=${f(u.vBefore)}) to propose updated moments (m′=${f(u.mAfter)}, v′=${f(u.vAfter)}) and provisional parameter θ′. The proposal is provisional; the accepted model has not changed.`;
}

export function formatCandidateOutcomeMeanLoss(
  meanBefore: number,
  meanAfter: number,
  fmt?: (n: number | undefined) => string,
): string {
  const f = fmt ?? ((n: number | undefined) => (n !== undefined ? String(n) : ''));
  return `Mean loss on this training example, derived from observed target probabilities: ${f(meanBefore)} → ${f(meanAfter)}`;
}

export function formatCandidateTargetTokenProbability(
  targetTokenLabel: string,
  targetPos: number,
  probBefore: number | undefined,
  probAfter: number | undefined,
  fmt?: (n: number | undefined) => string,
): string {
  const f = fmt ?? ((n: number | undefined) => (n !== undefined ? String(n) : ''));
  return `Target-token probability for '${targetTokenLabel}' at position ${targetPos}: accepted ${f(probBefore)} → provisional candidate ${f(probAfter)}`;
}

export function getPendingTourActionLabel(state: PublicTourState): string {
  switch (state) {
    case 'p2_objective':
      return 'Tracing contribution...';
    case 'p2_gradient_contribution':
      return 'Finishing gradient...';
    case 'p2_final_gradient':
      return 'Computing Adam proposal...';
    case 'p2_adam_proposal':
      return 'Evaluating candidate...';
    case 'p1_complete':
      return 'Starting learning...';
    default:
      return 'Working...';
  }
}

export interface PublicStatusOptions {
  readonly currentState: PublicTourState;
  readonly targetState?: PublicTourState;
  readonly phase?: string;
  readonly driverPhase?: string;
  readonly final?: boolean;
}

export function getPublicExecutionStatus(opts: PublicStatusOptions): string {
  const { currentState, targetState, phase, driverPhase, final } = opts;

  if (driverPhase === 'cancelling') {
    return 'Cancelling execution...';
  }

  if (phase === 'ready' || currentState === 'candidate_ready') {
    return 'Candidate ready — not accepted';
  }

  const isWorking = Boolean(targetState) || driverPhase === 'running';
  if (!isWorking) {
    return '';
  }

  const effectiveTarget = targetState ?? advanceTour(currentState);

  switch (effectiveTarget) {
    case 'p2_gradient_contribution':
      if (phase && phase.endsWith('forward')) {
        return 'Preparing training objective...';
      }
      if (phase === 'loss') {
        return 'Measuring error across target positions...';
      }
      return "Finding the selected parameter's gradient contribution...";

    case 'p2_final_gradient':
      if (final) {
        return "Finding the selected parameter's final gradient...";
      }
      return 'Finishing backward pass...';

    case 'p2_adam_proposal':
      return 'Computing Adam proposal...';

    case 'candidate_ready':
      return 'Evaluating provisional candidate...';

    case 'p2_objective':
      return 'Starting learning pass...';

    default:
      return 'Working...';
  }
}


