// Temporary UI/session representation for the current implementation. LS0 instructional
// beats are not 1:1 with these states, and this list length is not a curriculum invariant.
export type PublicTourState =
  | 'cold'
  | 'p1_prediction_preview'
  | 'p1_represent'
  | 'p1_qkv'
  | 'p1_attention_compare'
  | 'p1_attention_weights'
  | 'p1_value_mixture'
  | 'p1_attention_integration'
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
  'p1_qkv',
  'p1_attention_compare',
  'p1_attention_weights',
  'p1_value_mixture',
  'p1_attention_integration',
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
  readonly key?: number;
  readonly parameter?: string;
  readonly derivedShortStop?: number;
  readonly derivedReverseStop?: number;
}

export interface PublicLessonFocusNode {
  readonly kind: string;
  readonly layer?: number;
  readonly head?: number;
}

export interface PublicLessonFocusEdge {
  readonly from: string;
  readonly to: string;
  readonly head?: number;
  readonly selected?: 'key' | 'value';
}

export interface PublicLessonFocus {
  readonly nodes: readonly PublicLessonFocusNode[];
  readonly edges: readonly PublicLessonFocusEdge[];
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
  readonly learnerQuestion?: string;
  readonly whyHere?: string;
  readonly plainMeaning: string;
  readonly resultConcept?: PublicTourResultConcept;
  readonly selectionIntent: PublicTourSelectionIntent;
  readonly focus?: PublicLessonFocus;
  readonly primaryAction?: PublicTourAction;
  readonly optionalActions: readonly PublicTourAction[];
  readonly decisionActions?: readonly PublicTourAction[];
  readonly truthGuardrail?: string;
}

const REVERSE_TRUTH_GUARDRAIL = 'Backward explanation path over the real computation. Visual movement is not runtime timing.';
const PART_1_TOKEN = 3;
const PART_1_HEAD = 0;
const PART_1_KEY = 0;

const FORWARD_INTEGRATION_FOCUS: PublicLessonFocus = {
  nodes: [
    { kind: 'tokenEmbedding' },
    { kind: 'positionEmbedding' },
    { kind: 'embeddingSum' },
    { kind: 'embeddingNorm' },
    { kind: 'preAttentionNorm', layer: 0 },
    { kind: 'q', layer: 0 },
    { kind: 'k', layer: 0 },
    { kind: 'v', layer: 0 },
    { kind: 'attentionLogits', layer: 0 },
    { kind: 'attentionProbabilities', layer: 0 },
    { kind: 'headOutput', layer: 0 },
    { kind: 'attentionOutput', layer: 0 },
    { kind: 'attentionProjection', layer: 0 },
    { kind: 'attentionResidual', layer: 0 },
    { kind: 'preMlpNorm', layer: 0 },
    { kind: 'mlpUp', layer: 0 },
    { kind: 'mlpRelu', layer: 0 },
    { kind: 'mlpDown', layer: 0 },
    { kind: 'mlpResidual', layer: 0 },
    { kind: 'logits' },
    { kind: 'probabilities' },
  ],
  edges: [
    { from: 'tokenEmbedding', to: 'embeddingSum' },
    { from: 'positionEmbedding', to: 'embeddingSum' },
    { from: 'embeddingSum', to: 'embeddingNorm' },
    { from: 'embeddingNorm', to: 'preAttentionNorm' },
    { from: 'preAttentionNorm', to: 'q' },
    { from: 'preAttentionNorm', to: 'k' },
    { from: 'preAttentionNorm', to: 'v' },
    { from: 'q', to: 'attentionLogits' },
    { from: 'k', to: 'attentionLogits' },
    { from: 'attentionLogits', to: 'attentionProbabilities' },
    { from: 'attentionProbabilities', to: 'headOutput' },
    { from: 'v', to: 'headOutput' },
    { from: 'headOutput', to: 'attentionOutput' },
    { from: 'attentionOutput', to: 'attentionProjection' },
    { from: 'attentionProjection', to: 'attentionResidual' },
    { from: 'embeddingNorm', to: 'attentionResidual' },
    { from: 'attentionResidual', to: 'preMlpNorm' },
    { from: 'preMlpNorm', to: 'mlpUp' },
    { from: 'mlpUp', to: 'mlpRelu' },
    { from: 'mlpRelu', to: 'mlpDown' },
    { from: 'mlpDown', to: 'mlpResidual' },
    { from: 'attentionResidual', to: 'mlpResidual' },
    { from: 'mlpResidual', to: 'logits' },
    { from: 'logits', to: 'probabilities' },
  ],
};

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
        selectionIntent: { kind: 'probabilities', token: PART_1_TOKEN, key: PART_1_KEY, derivedShortStop: -1 },
        primaryAction: { id: 'exhibit-start', label: 'Start · explore a real prediction', role: 'primary' },
        optionalActions: [],
      };

    case 'p1_prediction_preview':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Make a Prediction · Opening',
        headline: 'PREDICTION',
        routePurpose: 'Start from the authentic output before tracing how it was produced.',
        learnerQuestion: 'What does this model predict comes next?',
        whyHere: 'The completed prediction is the phenomenon the rest of Part 1 explains.',
        plainMeaning: 'This authentic run produced raw vocabulary scores and normalized them into the next-token probability distribution now shown.',
        resultConcept: { label: 'Observed next-token distribution' },
        selectionIntent: { kind: 'probabilities', token: PART_1_TOKEN, key: PART_1_KEY },
        focus: {
          nodes: [{ kind: 'logits' }, { kind: 'probabilities' }],
          edges: [{ from: 'logits', to: 'probabilities' }],
        },
        primaryAction: { id: 'short-continue', label: 'See how it got there', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'This is the authentic prediction we will explain; seeing the output does not mean output softmax has already been taught.',
      };

    case 'p1_represent':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Represent · Representation',
        headline: 'REPRESENT',
        routePurpose: 'Build the numerical representation used by the rest of the model.',
        learnerQuestion: 'How can the model calculate with a character and its position?',
        whyHere: 'Later vector operations need learned numerical features for token identity and position.',
        plainMeaning: 'The token embedding and position embedding are added and rescaled into a normalized representation. Before attention, that representation is rescaled again to become attention-ready, while the normalized representation is also saved on a bypass that will rejoin after attention.',
        resultConcept: { label: 'Attention-ready representation' },
        selectionIntent: { kind: 'preAttentionNorm', token: PART_1_TOKEN, key: PART_1_KEY, layer: 0 },
        focus: {
          nodes: [
            { kind: 'tokenEmbedding' },
            { kind: 'positionEmbedding' },
            { kind: 'embeddingSum' },
            { kind: 'embeddingNorm' },
            { kind: 'preAttentionNorm', layer: 0 },
          ],
          edges: [
            { from: 'tokenEmbedding', to: 'embeddingSum' },
            { from: 'positionEmbedding', to: 'embeddingSum' },
            { from: 'embeddingSum', to: 'embeddingNorm' },
            { from: 'embeddingNorm', to: 'preAttentionNorm' },
            { from: 'embeddingNorm', to: 'attentionResidual' },
          ],
        },
        primaryAction: { id: 'short-continue', label: 'Continue: Q / K / V', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'These are learned numerical features, not human meanings or spatial coordinates.',
      };

    case 'p1_qkv':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Attend · Q / K / V',
        headline: 'Q / K / V',
        routePurpose: 'Prepare separate numerical roles for comparison and information carrying.',
        learnerQuestion: 'Why create three different vectors from the same representation?',
        whyHere: 'Attention needs comparison-side numbers and separate numbers containing information that may be mixed.',
        plainMeaning: 'From the already attention-ready representation, three learned projections create Query, Key, and Value vectors. Query and Key supply the two sides of attention comparisons; Value carries information that a later weighted mixture can combine.',
        resultConcept: { label: 'Query / Key / Value vectors' },
        selectionIntent: { kind: 'q', token: PART_1_TOKEN, key: PART_1_KEY, layer: 0, head: PART_1_HEAD },
        focus: {
          nodes: [
            { kind: 'preAttentionNorm', layer: 0 },
            { kind: 'q', layer: 0, head: PART_1_HEAD },
            { kind: 'k', layer: 0, head: PART_1_HEAD },
            { kind: 'v', layer: 0, head: PART_1_HEAD },
          ],
          edges: [
            { from: 'preAttentionNorm', to: 'q', head: PART_1_HEAD },
            { from: 'preAttentionNorm', to: 'k', head: PART_1_HEAD },
            { from: 'preAttentionNorm', to: 'v', head: PART_1_HEAD },
          ],
        },
        primaryAction: { id: 'short-continue', label: 'Continue: Compare positions', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'Query, Key, and Value are operational numerical roles, not literal human questions, answers, or meanings.',
      };

    case 'p1_attention_compare':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Attend · Compare positions',
        headline: 'COMPARE POSITIONS',
        routePurpose: 'Compare the selected Query with causally available Keys to produce raw attention scores.',
        learnerQuestion: 'Which earlier or current positions can this position compare against, and what does the comparison produce?',
        whyHere: 'The model needs a compatibility score for each causally available Key before it can form mixing coefficients.',
        plainMeaning: 'For this head and query position, the Query is compared with Keys only from causally available positions. The resulting authentic score row is still unnormalized.',
        resultConcept: { label: 'Causal attention score row' },
        selectionIntent: { kind: 'attentionLogits', token: PART_1_TOKEN, key: PART_1_KEY, layer: 0, head: PART_1_HEAD },
        focus: {
          nodes: [
            { kind: 'q', layer: 0, head: PART_1_HEAD },
            { kind: 'k', layer: 0, head: PART_1_HEAD },
            { kind: 'attentionLogits', layer: 0, head: PART_1_HEAD },
          ],
          edges: [
            { from: 'q', to: 'attentionLogits', head: PART_1_HEAD },
            { from: 'k', to: 'attentionLogits', head: PART_1_HEAD, selected: 'key' },
          ],
        },
        primaryAction: { id: 'short-continue', label: 'Continue: Attention weights', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'Future causal positions are unavailable to this comparison; they are not positions the model considered and assigned zero importance. An attention score is not an attention weight.',
      };

    case 'p1_attention_weights':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Attend · Attention weights',
        headline: 'ATTENTION WEIGHTS',
        routePurpose: 'Normalize raw attention scores into mixing coefficients over the allowed positions.',
        learnerQuestion: 'How do raw comparison scores become usable mixing coefficients?',
        whyHere: 'The Value mixture needs normalized coefficients over exactly the causally available contributors.',
        plainMeaning: 'Softmax transforms the causal attention score row into normalized attention weights over the same available positions.',
        resultConcept: { label: 'Normalized attention weights' },
        selectionIntent: { kind: 'attentionProbabilities', token: PART_1_TOKEN, key: PART_1_KEY, layer: 0, head: PART_1_HEAD },
        focus: {
          nodes: [
            { kind: 'attentionLogits', layer: 0, head: PART_1_HEAD },
            { kind: 'attentionProbabilities', layer: 0, head: PART_1_HEAD },
          ],
          edges: [{ from: 'attentionLogits', to: 'attentionProbabilities', head: PART_1_HEAD }],
        },
        primaryAction: { id: 'short-continue', label: 'Continue: Mix Values', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'An attention weight is a normalized mixing coefficient, not automatic importance, relevance, or causal responsibility.',
      };

    case 'p1_value_mixture':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Attend · Value mixture',
        headline: 'VALUE MIXTURE',
        routePurpose: 'Use the attention weights to mix authentic Value vectors into one head output.',
        learnerQuestion: 'What do the attention weights actually multiply?',
        whyHere: 'The normalized coefficients only become a context-carrying result when they weight the corresponding Value vectors.',
        plainMeaning: 'Each available Value vector is multiplied by its attention weight, and those weighted Values are summed to produce this head output.',
        resultConcept: { label: 'Weighted Value mixture' },
        selectionIntent: { kind: 'headOutput', token: PART_1_TOKEN, key: PART_1_KEY, layer: 0, head: PART_1_HEAD },
        focus: {
          nodes: [
            { kind: 'attentionProbabilities', layer: 0, head: PART_1_HEAD },
            { kind: 'v', layer: 0, head: PART_1_HEAD },
            { kind: 'headOutput', layer: 0, head: PART_1_HEAD },
          ],
          edges: [
            { from: 'attentionProbabilities', to: 'headOutput', head: PART_1_HEAD },
            { from: 'v', to: 'headOutput', head: PART_1_HEAD, selected: 'value' },
          ],
        },
        primaryAction: { id: 'short-continue', label: 'Continue: Combine heads', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'Weights mix Value vectors; they do not directly choose a token or prove that a position is important.',
      };

    case 'p1_attention_integration':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Attend · Combine heads + residual',
        headline: 'ATTENTION INTEGRATION',
        routePurpose: 'Join both head results, project them, and add the saved residual stream.',
        learnerQuestion: 'How do separate head results return to one model representation without losing the earlier stream?',
        whyHere: 'The two head slices must be concatenated, projected back through WO, and integrated with the saved representation.',
        plainMeaning: 'Both head outputs are concatenated into one attention output, projected through WO, then added to the saved residual bypass to produce the attention residual.',
        resultConcept: { label: 'Context-enriched residual stream' },
        selectionIntent: { kind: 'attentionResidual', token: PART_1_TOKEN, key: PART_1_KEY, layer: 0 },
        focus: {
          nodes: [
            { kind: 'headOutput', layer: 0, head: 0 },
            { kind: 'headOutput', layer: 0, head: 1 },
            { kind: 'attentionOutput', layer: 0 },
            { kind: 'attentionProjection', layer: 0 },
            { kind: 'embeddingNorm' },
            { kind: 'attentionResidual', layer: 0 },
          ],
          edges: [
            { from: 'headOutput', to: 'attentionOutput', head: 0 },
            { from: 'headOutput', to: 'attentionOutput', head: 1 },
            { from: 'attentionOutput', to: 'attentionProjection' },
            { from: 'attentionProjection', to: 'attentionResidual' },
            { from: 'embeddingNorm', to: 'attentionResidual' },
          ],
        },
        primaryAction: { id: 'short-continue', label: 'Continue: Transform', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'Concatenating head outputs, projecting through WO, and adding the saved residual are distinct operations; none may be collapsed into a generic context step.',
      };

    case 'p1_transform':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Transform · MLP',
        headline: 'TRANSFORM',
        routePurpose: 'Apply the complete per-position MLP and preserve its residual stream.',
        learnerQuestion: 'What happens after attention has mixed context?',
        whyHere: 'The model applies a separate nonlinear per-position transformation before vocabulary scoring.',
        plainMeaning: 'The attention residual is normalized, expanded from 8 to 32 values, passed through ReLU, contracted from 32 back to 8, then added to the saved attention residual.',
        resultConcept: { label: 'Transformed residual stream' },
        selectionIntent: { kind: 'mlpResidual', token: PART_1_TOKEN, key: PART_1_KEY, layer: 0 },
        focus: {
          nodes: [
            { kind: 'attentionResidual', layer: 0 },
            { kind: 'preMlpNorm', layer: 0 },
            { kind: 'mlpUp', layer: 0 },
            { kind: 'mlpRelu', layer: 0 },
            { kind: 'mlpDown', layer: 0 },
            { kind: 'mlpResidual', layer: 0 },
          ],
          edges: [
            { from: 'attentionResidual', to: 'preMlpNorm' },
            { from: 'preMlpNorm', to: 'mlpUp' },
            { from: 'mlpUp', to: 'mlpRelu' },
            { from: 'mlpRelu', to: 'mlpDown' },
            { from: 'mlpDown', to: 'mlpResidual' },
            { from: 'attentionResidual', to: 'mlpResidual' },
          ],
        },
        primaryAction: { id: 'short-continue', label: 'Continue: Logits', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'This canonical organism uses ReLU. The MLP is a per-position transform, not another attention operation, and there is no final normalization after this block.',
      };

    case 'p1_score':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Output · Logits',
        headline: 'LOGITS',
        routePurpose: 'Project the transformed representation into one raw score per vocabulary item.',
        learnerQuestion: 'How does the final representation become scores for possible next tokens?',
        whyHere: 'The model needs one raw vocabulary score for each candidate before it can form an output distribution.',
        plainMeaning: 'The output projection maps the transformed residual into raw signed vocabulary scores called logits. They are not normalized probabilities.',
        resultConcept: { label: 'Raw vocabulary logits' },
        selectionIntent: { kind: 'logits', token: PART_1_TOKEN, key: PART_1_KEY },
        focus: {
          nodes: [{ kind: 'mlpResidual', layer: 0 }, { kind: 'logits' }],
          edges: [{ from: 'mlpResidual', to: 'logits' }],
        },
        primaryAction: { id: 'short-continue', label: 'Continue: Probabilities', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'A logit is a raw vocabulary score, not a probability or likelihood.',
      };

    case 'p1_probabilities':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Output · Probabilities',
        headline: 'PROBABILITIES',
        routePurpose: 'Normalize vocabulary logits into the same output distribution seen at the opening.',
        learnerQuestion: 'How do raw vocabulary scores become the prediction distribution?',
        whyHere: 'The model needs a normalized distribution over candidate next tokens to express its prediction.',
        plainMeaning: 'Output softmax converts the vocabulary logits into probabilities that sum to 100%, reconnecting directly to the authentic prediction shown at the start.',
        resultConcept: { label: 'Output probability distribution' },
        selectionIntent: { kind: 'probabilities', token: PART_1_TOKEN, key: PART_1_KEY },
        focus: {
          nodes: [{ kind: 'logits' }, { kind: 'probabilities' }],
          edges: [{ from: 'logits', to: 'probabilities' }],
        },
        primaryAction: { id: 'short-continue', label: 'Integrate Part 1', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'Attention softmax normalized scores across available positions. Output softmax normalizes vocabulary logits across candidate tokens. They normalize different objects for different purposes.',
      };

    case 'p1_complete':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Forward integration',
        headline: 'PART 1 OF 2 COMPLETE',
        routePurpose: 'Integrate the complete forward path before learning begins.',
        learnerQuestion: 'What complete path produced the prediction, and did predicting change the model?',
        whyHere: 'The learner should leave Part 1 with one connected mental model before introducing error and parameter learning.',
        plainMeaning: 'The same authentic run moved through REPRESENT → ATTEND → TRANSFORM → OUTPUT to produce the prediction. Part 1 explained that computation without running it again.',
        resultConcept: { label: 'Complete forward causal path' },
        selectionIntent: { kind: 'probabilities', token: PART_1_TOKEN, key: PART_1_KEY },
        focus: FORWARD_INTEGRATION_FOCUS,
        primaryAction: { id: 'short-teach', label: 'Next: Learn from error', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'Prediction used the current parameters; it did not update them. Learning still comes in Part 2.',
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
      return 'p1_qkv';
    case 'p1_qkv':
      return 'p1_attention_compare';
    case 'p1_attention_compare':
      return 'p1_attention_weights';
    case 'p1_attention_weights':
      return 'p1_value_mixture';
    case 'p1_value_mixture':
      return 'p1_attention_integration';
    case 'p1_attention_integration':
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


