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
  | 'p2_score_backward'
  | 'p2_transform_backward'
  | 'p2_mix_context_backward'
  | 'p2_represent_backward'
  | 'p2_parameter_gradient'
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
  'p2_score_backward',
  'p2_transform_backward',
  'p2_mix_context_backward',
  'p2_represent_backward',
  'p2_parameter_gradient',
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
        plainMeaning: 'The model maps each character token and position into numerical vectors that represent identity and order in space.',
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
        routePurpose: 'Use causally available earlier information to update this position',
        plainMeaning: 'Attention heads allow each position to compare itself against earlier tokens, gathering and mixing relevant context.',
        resultConcept: { label: 'Attended representation' },
        selectionIntent: { kind: 'attentionResidual', token: 3, layer: 0, head: 0, derivedShortStop: 2 },
        primaryAction: { id: 'short-continue', label: 'Continue: TRANSFORM', role: 'primary' },
        optionalActions: [{ id: 'attention-drill-down', label: 'How does attention work?', role: 'secondary' }],
      };

    case 'p1_transform':
      return {
        state,
        part: 1,
        progress: 'Part 1 of 2 · 4 of 6 · Transform',
        headline: 'TRANSFORM',
        routePurpose: 'Synthesize higher-order features through non-linear feed-forward layers',
        plainMeaning: 'The feed-forward network (MLP) expands, activates, and projects vectors to synthesize new combinations of features.',
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
        plainMeaning: 'The final projection maps representations into vocabulary scores measuring how likely each candidate character is.',
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
        plainMeaning: 'Softmax converts raw scores into non-negative probabilities summing to 100%, determining what comes next.',
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
        primaryAction: { id: 'short-teach', label: 'Begin Part 2: Step through learning', role: 'primary' },
        optionalActions: [{ id: 'start-reverse-learning', label: 'Walk through backward pass', role: 'secondary' }],
      };

    case 'p2_objective':
      return {
        state,
        part: 2,
        progress: 'Part 2 of 2 · 1 of 7 · Training Objective',
        headline: 'TRAINING OBJECTIVE',
        routePurpose: 'Predictions are compared with known targets across all positions to calculate loss',
        plainMeaning: 'The model compares predictions with targets across all positions to measure error. The mean loss forms the single objective that supplies the backward pass.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'Mean training loss' },
        selectionIntent: { kind: 'probabilities', token: 3, derivedReverseStop: 0 },
        primaryAction: { id: 'reverse-continue', label: 'Continue: SCORE BACKWARD', role: 'primary' },
        optionalActions: [{ id: 'reverse-exit', label: 'Return to Part 1', role: 'secondary' }],
      };

    case 'p2_score_backward':
      return {
        state,
        part: 2,
        progress: 'Part 2 of 2 · 2 of 7 · Score Backward',
        headline: 'SCORE BACKWARD',
        routePurpose: 'Propagate output sensitivity backward into vocabulary scoring',
        plainMeaning: 'Sensitivity propagates backward through logits to determine how changes to scoring affect the overall loss.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'Logits adjoint' },
        selectionIntent: { kind: 'logits', token: 3, derivedReverseStop: 1 },
        primaryAction: { id: 'reverse-continue', label: 'Continue: TRANSFORM BACKWARD', role: 'primary' },
        optionalActions: [{ id: 'reverse-previous', label: 'Previous: TRAINING OBJECTIVE', role: 'secondary' }],
      };

    case 'p2_transform_backward':
      return {
        state,
        part: 2,
        progress: 'Part 2 of 2 · 3 of 7 · Transform Backward',
        headline: 'TRANSFORM BACKWARD',
        routePurpose: 'Propagate gradient through MLP feed-forward operations and residual bypass',
        plainMeaning: 'Gradient flows backward through the MLP non-linear activation and splits across both the feed-forward path and residual stream.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'MLP residual adjoint' },
        selectionIntent: { kind: 'mlpResidual', token: 3, layer: 0, derivedReverseStop: 2 },
        primaryAction: { id: 'reverse-continue', label: 'Continue: MIX CONTEXT BACKWARD', role: 'primary' },
        optionalActions: [{ id: 'reverse-previous', label: 'Previous: SCORE BACKWARD', role: 'secondary' }],
      };

    case 'p2_mix_context_backward':
      return {
        state,
        part: 2,
        progress: 'Part 2 of 2 · 4 of 7 · Mix Context Backward',
        headline: 'MIX CONTEXT BACKWARD',
        routePurpose: 'Propagate gradient through attention projection, weights, and query/key/value vectors',
        plainMeaning: 'Sensitivity flows back through attention mixing, assigning responsibility to individual heads and queries that gathered context.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'Attention gradient' },
        selectionIntent: { kind: 'attentionResidual', token: 3, layer: 0, derivedReverseStop: 3 },
        primaryAction: { id: 'reverse-continue', label: 'Continue: REPRESENT BACKWARD', role: 'primary' },
        optionalActions: [{ id: 'reverse-previous', label: 'Previous: TRANSFORM BACKWARD', role: 'secondary' }],
      };

    case 'p2_represent_backward':
      return {
        state,
        part: 2,
        progress: 'Part 2 of 2 · 5 of 7 · Represent Backward',
        headline: 'REPRESENT BACKWARD',
        routePurpose: 'Accumulate final backward gradients into token and position embeddings',
        plainMeaning: 'Gradients reach the initial embedding representations, showing how token inputs contributed to downstream loss sensitivity.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'Embedding gradient' },
        selectionIntent: { kind: 'preAttentionNorm', token: 3, layer: 0, derivedReverseStop: 4 },
        primaryAction: { id: 'reverse-continue', label: 'Continue: PARAMETER GRADIENT', role: 'primary' },
        optionalActions: [{ id: 'reverse-previous', label: 'Previous: MIX CONTEXT BACKWARD', role: 'secondary' }],
      };

    case 'p2_parameter_gradient':
      return {
        state,
        part: 2,
        progress: 'Part 2 of 2 · 6 of 7 · Parameter Gradient',
        headline: 'PARAMETER GRADIENT',
        routePurpose: 'Accumulate scalar autograd contributions into the pinned parameter bank and its forward owner',
        plainMeaning: 'For the inspected parameter, each backward occurrence contributes child adjoint × local derivative into an accumulator to produce the parameter gradient.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'Accumulated parameter gradient' },
        selectionIntent: { kind: 'tokenEmbedding', parameter: 'wte', token: 3, derivedReverseStop: 5 },
        primaryAction: { id: 'reverse-continue', label: 'Continue: ADAM PROPOSAL', role: 'primary' },
        optionalActions: [{ id: 'reverse-previous', label: 'Previous: REPRESENT BACKWARD', role: 'secondary' }],
      };

    case 'p2_adam_proposal':
      return {
        state,
        part: 2,
        progress: 'Part 2 of 2 · 7 of 7 · Adam Proposal',
        headline: 'ADAM PROPOSAL',
        routePurpose: 'Adam computes provisional candidate weights from accumulated gradients and persistent moments',
        plainMeaning: 'Adam combines the final gradient with persistent optimizer moments (m, v) to propose an updated parameter value. The accepted model has not changed.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'Provisional parameter update' },
        selectionIntent: { kind: 'wte', parameter: 'wte', token: 3, derivedReverseStop: 6 },
        primaryAction: { id: 'reverse-continue', label: 'Continue: REVIEW CANDIDATE', role: 'primary' },
        optionalActions: [{ id: 'reverse-previous', label: 'Previous: PARAMETER GRADIENT', role: 'secondary' }],
      };

    case 'candidate_ready':
      return {
        state,
        part: 2,
        progress: 'Candidate Ready',
        headline: 'CANDIDATE UPDATE READY',
        routePurpose: 'Provisional update prepared. Choose to accept into accepted weights or discard.',
        plainMeaning: 'A candidate model update has been computed. It remains completely provisional and isolated until you explicitly accept or discard it.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'Provisional candidate ready' },
        selectionIntent: { kind: 'wte', parameter: 'wte', token: 3, derivedReverseStop: 6 },
        decisionActions: [
          { id: 'execution-accept', label: 'Accept update', role: 'peer-decision' },
          { id: 'execution-cancel', label: 'Discard candidate', role: 'peer-decision' },
        ],
        optionalActions: [{ id: 'candidate-compare', label: 'Compare candidate', role: 'secondary' }],
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
      return 'p2_score_backward';
    case 'p2_score_backward':
      return 'p2_transform_backward';
    case 'p2_transform_backward':
      return 'p2_mix_context_backward';
    case 'p2_mix_context_backward':
      return 'p2_represent_backward';
    case 'p2_represent_backward':
      return 'p2_parameter_gradient';
    case 'p2_parameter_gradient':
      return 'p2_adam_proposal';
    case 'p2_adam_proposal':
      return 'candidate_ready';
    case 'candidate_ready':
      return 'candidate_ready';
    case 'tour_complete':
      return 'tour_complete';
  }
}

export function previousTourState(current: PublicTourState): PublicTourState {
  switch (current) {
    case 'p2_score_backward':
      return 'p2_objective';
    case 'p2_transform_backward':
      return 'p2_score_backward';
    case 'p2_mix_context_backward':
      return 'p2_transform_backward';
    case 'p2_represent_backward':
      return 'p2_mix_context_backward';
    case 'p2_parameter_gradient':
      return 'p2_represent_backward';
    case 'p2_adam_proposal':
      return 'p2_parameter_gradient';
    case 'candidate_ready':
      return 'p2_adam_proposal';
    default:
      return current;
  }
}

export function startPart2(): PublicTourState {
  return 'p2_objective';
}

export function facilitatorTourStateForLandmark(landmarkIndex: number, reverse?: boolean): PublicTourState {
  if (reverse) {
    const stops: PublicTourState[] = [
      'p2_objective',
      'p2_score_backward',
      'p2_transform_backward',
      'p2_mix_context_backward',
      'p2_represent_backward',
      'p2_parameter_gradient',
      'p2_adam_proposal',
    ];
    return stops[landmarkIndex] ?? 'p2_objective';
  }
  const stops: PublicTourState[] = [
    'p1_prediction_preview',
    'p1_represent',
    'p1_mix_context',
    'p1_transform',
    'p1_score',
    'p1_probabilities',
  ];
  return stops[landmarkIndex] ?? 'p1_prediction_preview';
}
