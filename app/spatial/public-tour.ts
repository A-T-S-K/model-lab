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
  | 'p2_backward_trace'
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
  'p2_backward_trace',
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

export type PublicDepthKind =
  | 'prediction'
  | 'representation'
  | 'qkv'
  | 'attention-comparison'
  | 'attention-weights'
  | 'value-mixture'
  | 'attention-integration'
  | 'mlp'
  | 'logits'
  | 'probabilities'
  | 'objective'
  | 'backward-trace'
  | 'gradient-contribution'
  | 'final-gradient'
  | 'adam'
  | 'candidate';

export type PublicDepthOccurrence =
  | { readonly kind: 'canonical' }
  | { readonly kind: 'causal-keys' }
  | { readonly kind: 'all-heads' }
  | { readonly kind: 'final-layer' };

export interface PublicDepthMember {
  readonly id: string;
  readonly role: string;
  readonly kind: string;
  readonly layer?: number;
  readonly occurrence?: PublicDepthOccurrence;
  readonly slice?: 'canonical-head';
  readonly parameter?: 'owner';
  readonly residual?: 'saved-source';
}

export interface PublicDepthSpec {
  readonly kind: PublicDepthKind;
  readonly members: readonly PublicDepthMember[];
  readonly defaultMember: string;
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
  readonly depthSpec?: PublicDepthSpec;
  readonly primaryAction?: PublicTourAction;
  readonly optionalActions: readonly PublicTourAction[];
  readonly decisionActions?: readonly PublicTourAction[];
  readonly truthGuardrail?: string;
}

const REVERSE_TRUTH_GUARDRAIL = 'The purple backward path explains dependency and sensitivity through the same computation. It is not measured runtime timing, text flowing backward, or execution being undone.';
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
        headline: 'SEE A TINY LANGUAGE MODEL PREDICT AND LEARN',
        routePurpose: 'First, follow one real next-character prediction. Then see how one training example proposes a change to the model.',
        plainMeaning: 'Every bar and number comes from this model’s actual computation. The opening view is a recorded run; Start begins a fresh prediction.',
        selectionIntent: { kind: 'probabilities', token: PART_1_TOKEN, key: PART_1_KEY, derivedShortStop: -1 },
        primaryAction: { id: 'exhibit-start', label: 'Start · make a prediction', role: 'primary' },
        optionalActions: [],
      };

    case 'p1_prediction_preview':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Make a Prediction · Opening',
        headline: 'A REAL NEXT-CHARACTER PREDICTION',
        routePurpose: 'Start from the authentic output before tracing how it was produced.',
        learnerQuestion: 'What does this model predict comes next?',
        whyHere: 'The completed prediction is the phenomenon the rest of Part 1 explains.',
        plainMeaning: 'This run produced actual probabilities for the next character. These are authentic model results, not decorative bars.',
        resultConcept: { label: 'Observed next-token distribution' },
        selectionIntent: { kind: 'probabilities', token: PART_1_TOKEN, key: PART_1_KEY },
        depthSpec: {
          kind: 'prediction',
          defaultMember: 'probabilities',
          members: [
            { id: 'logits', role: 'Vocabulary logits', kind: 'logits', parameter: 'owner' },
            { id: 'probabilities', role: 'Output probabilities', kind: 'probabilities' },
          ],
        },
        focus: {
          nodes: [{ kind: 'logits' }, { kind: 'probabilities' }],
          edges: [{ from: 'logits', to: 'probabilities' }],
        },
        primaryAction: { id: 'short-continue', label: 'See how it made the prediction', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'This is the authentic prediction we will explain; seeing the output does not mean output softmax has already been taught.',
      };

    case 'p1_represent':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Represent · Representation',
        headline: 'TURN CHARACTERS INTO NUMBERS',
        routePurpose: 'Build the numerical representation used by the rest of the model.',
        learnerQuestion: 'How can the model calculate with a character and its position?',
        whyHere: 'Later vector operations need learned numerical features for token identity and position.',
        plainMeaning: 'The character and its position become a list of numbers called a vector. These bars show real components of that representation from this run; the model prepares it for attention while saving an earlier version for later.',
        resultConcept: { label: 'Attention-ready representation' },
        selectionIntent: { kind: 'preAttentionNorm', token: PART_1_TOKEN, key: PART_1_KEY, layer: 0 },
        depthSpec: {
          kind: 'representation',
          defaultMember: 'preAttentionNorm',
          members: [
            { id: 'tokenEmbedding', role: 'Token embedding', kind: 'tokenEmbedding', parameter: 'owner' },
            { id: 'positionEmbedding', role: 'Position embedding', kind: 'positionEmbedding', parameter: 'owner' },
            { id: 'embeddingSum', role: 'Embedding sum', kind: 'embeddingSum' },
            { id: 'embeddingNorm', role: 'Normalized representation / saved attention residual source', kind: 'embeddingNorm', residual: 'saved-source' },
            { id: 'preAttentionNorm', role: 'Attention-ready normalized representation', kind: 'preAttentionNorm' },
          ],
        },
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
        primaryAction: { id: 'short-continue', label: 'Continue: Prepare attention', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'These are learned numerical features, not human meanings or spatial coordinates.',
      };

    case 'p1_qkv':
      return {
        state,
        part: 1,
        progress: 'Part 1 · Attend · Q / K / V',
        headline: 'THREE ROLES FOR ATTENTION',
        routePurpose: 'Prepare separate numerical roles for comparison and information carrying.',
        learnerQuestion: 'Why create three different vectors from the same representation?',
        whyHere: 'Attention needs comparison-side numbers and separate numbers containing information that may be mixed.',
        plainMeaning: 'The same representation is projected three ways. Query (Q) and Key (K) are compared to make attention scores. Value (V) carries the information those weights will mix.',
        resultConcept: { label: 'Query / Key / Value vectors' },
        selectionIntent: { kind: 'q', token: PART_1_TOKEN, key: PART_1_KEY, layer: 0, head: PART_1_HEAD },
        depthSpec: {
          kind: 'qkv',
          defaultMember: 'q',
          members: [
            { id: 'input', role: 'Shared normalized input', kind: 'preAttentionNorm' },
            { id: 'q', role: 'Query', kind: 'q', slice: 'canonical-head', parameter: 'owner' },
            { id: 'k', role: 'Key', kind: 'k', slice: 'canonical-head', parameter: 'owner' },
            { id: 'v', role: 'Value', kind: 'v', slice: 'canonical-head', parameter: 'owner' },
          ],
        },
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
        headline: 'COMPARE THE CURRENT POSITION WITH EARLIER ONES',
        routePurpose: 'Compare the selected Query with causally available Keys to produce raw attention scores.',
        learnerQuestion: 'Which earlier or current positions can this position compare against, and what does the comparison produce?',
        whyHere: 'The model needs a compatibility score for each causally available Key before it can form mixing coefficients.',
        plainMeaning: 'This position’s Query is compared with Keys from allowed earlier and current positions. Each comparison produces a real raw attention score. A score is not yet a weight or probability.',
        resultConcept: { label: 'Causal attention score row' },
        selectionIntent: { kind: 'attentionLogits', token: PART_1_TOKEN, key: PART_1_KEY, layer: 0, head: PART_1_HEAD },
        depthSpec: {
          kind: 'attention-comparison',
          defaultMember: 'scores',
          members: [
            { id: 'query', role: 'Selected Query', kind: 'q', slice: 'canonical-head' },
            { id: 'keys', role: 'Causally available Key', kind: 'k', occurrence: { kind: 'causal-keys' }, slice: 'canonical-head' },
            { id: 'scores', role: 'Causal attention score row', kind: 'attentionLogits' },
          ],
        },
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
        headline: 'TURN SCORES INTO MIXING WEIGHTS',
        routePurpose: 'Normalize raw attention scores into mixing coefficients over the allowed positions.',
        learnerQuestion: 'How do raw comparison scores become usable mixing coefficients?',
        whyHere: 'The Value mixture needs normalized coefficients over exactly the causally available contributors.',
        plainMeaning: 'Softmax normalizes the score row across allowed positions. The resulting attention weights are coefficients for mixing Value vectors, not automatic measures of importance or relevance.',
        resultConcept: { label: 'Normalized attention weights' },
        selectionIntent: { kind: 'attentionProbabilities', token: PART_1_TOKEN, key: PART_1_KEY, layer: 0, head: PART_1_HEAD },
        depthSpec: {
          kind: 'attention-weights',
          defaultMember: 'weights',
          members: [
            { id: 'scores', role: 'Causal attention score row', kind: 'attentionLogits' },
            { id: 'weights', role: 'Normalized attention weight row', kind: 'attentionProbabilities' },
          ],
        },
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
        depthSpec: {
          kind: 'value-mixture',
          defaultMember: 'headOutput',
          members: [
            { id: 'weights', role: 'Eligible attention weights', kind: 'attentionProbabilities' },
            { id: 'values', role: 'Eligible Value contributor', kind: 'v', occurrence: { kind: 'causal-keys' }, slice: 'canonical-head' },
            { id: 'headOutput', role: 'Head output', kind: 'headOutput' },
          ],
        },
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
        depthSpec: {
          kind: 'attention-integration',
          defaultMember: 'attentionResidual',
          members: [
            { id: 'headOutputs', role: 'Head output', kind: 'headOutput', occurrence: { kind: 'all-heads' } },
            { id: 'attentionOutput', role: 'Concatenated head output', kind: 'attentionOutput' },
            { id: 'attentionProjection', role: 'WO projection', kind: 'attentionProjection', parameter: 'owner' },
            { id: 'savedResidual', role: 'Saved embeddingNorm residual source', kind: 'embeddingNorm', residual: 'saved-source' },
            { id: 'attentionResidual', role: 'Attention residual result', kind: 'attentionResidual' },
          ],
        },
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
        headline: 'TRANSFORM THE REPRESENTATION',
        routePurpose: 'Apply the complete per-position MLP and preserve its residual stream.',
        learnerQuestion: 'What happens after attention has mixed context?',
        whyHere: 'The model applies a separate nonlinear per-position transformation before vocabulary scoring.',
        plainMeaning: 'A separate per-position network transforms the representation after attention, then adds the saved input back. This network is called an MLP; its exact 8 → 32 → 8 steps and ReLU are in Details.',
        resultConcept: { label: 'Transformed residual stream' },
        selectionIntent: { kind: 'mlpResidual', token: PART_1_TOKEN, key: PART_1_KEY, layer: 0 },
        depthSpec: {
          kind: 'mlp',
          defaultMember: 'mlpResidual',
          members: [
            { id: 'attentionResidual', role: 'MLP input / saved residual source', kind: 'attentionResidual', residual: 'saved-source' },
            { id: 'preMlpNorm', role: 'Pre-MLP normalized input', kind: 'preMlpNorm' },
            { id: 'mlpUp', role: 'Expansion projection', kind: 'mlpUp', parameter: 'owner' },
            { id: 'mlpRelu', role: 'ReLU hidden activation', kind: 'mlpRelu' },
            { id: 'mlpDown', role: 'Contraction projection', kind: 'mlpDown', parameter: 'owner' },
            { id: 'mlpResidual', role: 'MLP residual result', kind: 'mlpResidual' },
          ],
        },
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
        headline: 'SCORE THE POSSIBLE NEXT CHARACTERS',
        routePurpose: 'Project the transformed representation into one raw score per vocabulary item.',
        learnerQuestion: 'How does the final representation become scores for possible next tokens?',
        whyHere: 'The model needs one raw vocabulary score for each candidate before it can form an output distribution.',
        plainMeaning: 'The output projection maps the transformed residual into raw signed vocabulary scores called logits. They are not normalized probabilities.',
        resultConcept: { label: 'Raw vocabulary logits' },
        selectionIntent: { kind: 'logits', token: PART_1_TOKEN, key: PART_1_KEY },
        depthSpec: {
          kind: 'logits',
          defaultMember: 'logits',
          members: [
            { id: 'input', role: 'Transformed residual', kind: 'mlpResidual', occurrence: { kind: 'final-layer' } },
            { id: 'logits', role: 'Vocabulary logits', kind: 'logits', parameter: 'owner' },
          ],
        },
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
        headline: 'TURN OUTPUT SCORES INTO PROBABILITIES',
        routePurpose: 'Normalize vocabulary logits into the same output distribution seen at the opening.',
        learnerQuestion: 'How do raw vocabulary scores become the prediction distribution?',
        whyHere: 'The model needs a normalized distribution over candidate next tokens to express its prediction.',
        plainMeaning: 'Output softmax converts raw scores into real probabilities across possible next characters. Attention softmax instead normalized across allowed positions; these are different sets of choices.',
        resultConcept: { label: 'Output probability distribution' },
        selectionIntent: { kind: 'probabilities', token: PART_1_TOKEN, key: PART_1_KEY },
        depthSpec: {
          kind: 'probabilities',
          defaultMember: 'probabilities',
          members: [
            { id: 'logits', role: 'Vocabulary logits', kind: 'logits', parameter: 'owner' },
            { id: 'probabilities', role: 'Output probability distribution', kind: 'probabilities' },
          ],
        },
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
        headline: 'PART 1 COMPLETE · NOW SEE HOW IT LEARNS',
        routePurpose: 'Integrate the complete forward path before learning begins.',
        learnerQuestion: 'What complete path produced the prediction, and did predicting change the model?',
        whyHere: 'The learner should leave Part 1 with one connected mental model before introducing error and parameter learning.',
        plainMeaning: 'You followed one prediction through REPRESENT → ATTEND → TRANSFORM → OUTPUT. Predicting used the model’s parameters but did not change them. Learning begins next.',
        resultConcept: { label: 'Complete forward causal path' },
        selectionIntent: { kind: 'probabilities', token: PART_1_TOKEN, key: PART_1_KEY },
        depthSpec: {
          kind: 'probabilities',
          defaultMember: 'probabilities',
          members: [
            { id: 'logits', role: 'Vocabulary logits', kind: 'logits', parameter: 'owner' },
            { id: 'probabilities', role: 'Output probability distribution', kind: 'probabilities' },
          ],
        },
        focus: FORWARD_INTEGRATION_FOCUS,
        primaryAction: { id: 'short-teach', label: 'Part 2 · learn from an example', role: 'primary' },
        optionalActions: [],
        truthGuardrail: 'Prediction used the current parameters; it did not update them. Learning still comes in Part 2.',
      };

    case 'p2_objective':
      return {
        state,
        part: 2,
        progress: 'Part 2 · Measure · Training objective',
        headline: 'MEASURE THE ERROR',
        routePurpose: 'Measure one authentic training objective across all teacher-forced target positions.',
        learnerQuestion: 'What counts as error for this training example?',
        whyHere: 'Backward needs one scalar objective tied to known targets before sensitivity can be traced.',
        plainMeaning: 'The correct next character is known at each training position. Each prediction contributes an error measure called loss; these losses combine into the training objective.',
        truthGuardrail: 'The objective uses multiple target positions, not only the single prediction followed in Part 1.',
        resultConcept: { label: 'Mean training objective' },
        selectionIntent: { kind: 'probabilities', token: 3 },
        depthSpec: { kind: 'objective', defaultMember: 'objective', members: [{ id: 'objective', role: 'Teacher-forced training objective', kind: 'objective' }] },
        primaryAction: { id: 'reverse-continue', label: 'Continue: Trace backward sensitivity', role: 'primary' },
        optionalActions: [],
      };

    case 'p2_backward_trace':
      return {
        state,
        part: 2,
        progress: 'Part 2 · Trace · Backward sensitivity',
        headline: 'WORK BACKWARD FROM THE ERROR',
        routePurpose: 'Follow how the loss depends on earlier values and parameter uses through the same computation world.',
        learnerQuestion: 'How can earlier computations affect this loss?',
        whyHere: 'The dependency idea comes before inspecting one scalar gradient contribution.',
        plainMeaning: 'Backpropagation follows calculation dependencies backward and measures sensitivity: how a change in an earlier value would affect the error. This is an explanation of dependencies, not runtime going backward in time.',
        truthGuardrail: REVERSE_TRUTH_GUARDRAIL,
        resultConcept: { label: 'Backward dependency and sensitivity' },
        selectionIntent: { kind: 'probabilities', token: 3, derivedReverseStop: 0 },
        depthSpec: { kind: 'backward-trace', defaultMember: 'dependency', members: [{ id: 'dependency', role: 'Backward dependency structure', kind: 'backward-trace' }] },
        primaryAction: { id: 'reverse-continue', label: 'Continue: Inspect one contribution', role: 'primary' },
        optionalActions: [],
      };

    case 'p2_gradient_contribution':
      return {
        state,
        part: 2,
        progress: 'Part 2 · Trace · One contribution',
        headline: 'ONE PIECE OF A PARAMETER’S GRADIENT',
        routePurpose: 'Inspect one authentic contribution to the selected parameter’s gradient accumulator.',
        learnerQuestion: 'What does one backward occurrence contribute to this parameter’s gradient?',
        whyHere: 'One concrete contribution makes accumulation visible before the completed gradient is shown.',
        plainMeaning: 'For one use of this parameter, incoming sensitivity times the local derivative gives a real contribution. It joins a running total, still a partial gradient.',
        truthGuardrail: 'One contribution is not the final parameter gradient. The dependency overlay does not claim an observed serial arrival chronology.',
        resultConcept: { label: 'One gradient contribution' },
        selectionIntent: { kind: 'tokenEmbedding', parameter: 'wte', token: 3, derivedReverseStop: 5 },
        depthSpec: { kind: 'gradient-contribution', defaultMember: 'contribution', members: [{ id: 'contribution', role: 'Retained matching contribution', kind: 'gradient-contribution' }] },
        primaryAction: { id: 'reverse-continue', label: 'Continue: Finish parameter gradient', role: 'primary' },
        optionalActions: [],
      };

    case 'p2_final_gradient':
      return {
        state,
        part: 2,
        progress: 'Part 2 · Accumulate · Final gradient',
        headline: 'THE PARAMETER’S FINAL GRADIENT',
        routePurpose: 'Complete accumulation for the same selected parameter.',
        learnerQuestion: 'What is this parameter’s total sensitivity to this training objective?',
        whyHere: 'Adam requires the completed parameter gradient, not one illustrative contribution.',
        plainMeaning: 'All real contributions have joined the final gradient: this parameter’s completed sensitivity to the training error. It is not an update; the parameter has not changed.',
        truthGuardrail: 'The final gradient measures sensitivity. It is not the parameter update and not the new parameter value.',
        resultConcept: { label: 'Final parameter gradient' },
        selectionIntent: { kind: 'tokenEmbedding', parameter: 'wte', token: 3, derivedReverseStop: 5 },
        depthSpec: { kind: 'final-gradient', defaultMember: 'gradient', members: [{ id: 'gradient', role: 'Completed parameter gradient', kind: 'final-gradient' }] },
        primaryAction: { id: 'reverse-continue', label: 'Continue: Propose a change', role: 'primary' },
        optionalActions: [],
      };

    case 'p2_adam_proposal':
      return {
        state,
        part: 2,
        progress: 'Part 2 · Propose · Adam',
        headline: 'THE OPTIMIZER PROPOSES A CHANGE',
        routePurpose: 'Combine the final gradient with stored optimizer state to create a provisional parameter proposal.',
        learnerQuestion: 'How can the gradient become a proposed parameter change?',
        whyHere: 'Optimization is separate from backpropagation and uses persistent state in addition to the gradient.',
        plainMeaning: 'An optimizer turns gradients into proposed parameter changes. This model uses an optimizer called Adam, which also keeps state from earlier updates. This proposal is provisional; the accepted model has not changed.',
        truthGuardrail: 'Adam is not backward; gradient is not update; proposal is not acceptance.',
        resultConcept: { label: 'Provisional parameter proposal' },
        selectionIntent: { kind: 'wte', parameter: 'wte', token: 3, derivedReverseStop: 6 },
        depthSpec: { kind: 'adam', defaultMember: 'proposal', members: [{ id: 'proposal', role: 'Provisional Adam proposal', kind: 'adam' }] },
        primaryAction: { id: 'reverse-continue', label: 'Continue: Evaluate candidate', role: 'primary' },
        optionalActions: [],
      };

    case 'candidate_ready':
      return {
        state,
        part: 2,
        progress: 'Part 2 · Decide · Candidate',
        headline: 'DECIDE WHETHER TO APPLY THE PROPOSED UPDATE',
        routePurpose: 'Compare the evaluated provisional candidate with the accepted baseline on this training example.',
        learnerQuestion: 'What changed on this training example, and should this candidate become the accepted model?',
        whyHere: 'A proposal must remain separate from accepted state until an explicit decision succeeds.',
        plainMeaning: 'The candidate was evaluated on this training example but remains separate from the accepted model. Accept applies the update; Discard leaves the accepted model unchanged.',
        truthGuardrail: 'A changed result or lower loss on this one training example is not proof of general model improvement.',
        resultConcept: { label: 'Provisional candidate outcome' },
        selectionIntent: { kind: 'probabilities', token: 3, derivedShortStop: 0 },
        depthSpec: { kind: 'candidate', defaultMember: 'comparison', members: [{ id: 'comparison', role: 'Baseline and provisional candidate comparison', kind: 'candidate' }] },
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
        headline: isAccepted ? 'MODEL LAB COMPLETE · UPDATE ACCEPTED' : 'MODEL LAB COMPLETE · UPDATE DISCARDED',
        routePurpose: isAccepted
          ? 'The candidate update was committed into the live accepted model.'
          : 'The candidate update was discarded. The live model remains in its prior accepted state.',
        plainMeaning: isAccepted
          ? 'The proposed update was applied. New parameters and optimizer state are accepted; subsequent predictions use them.'
          : 'The Guided learning cycle is complete. The proposal was not applied; the accepted model remains unchanged.',
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
      return 'p2_backward_trace';
    case 'p2_backward_trace':
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
      return evidence.hasObjective;
    case 'p2_backward_trace':
      return evidence.hasMatchingContribution;
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
      return 'Measuring training objective...';
    case 'p2_backward_trace':
      return 'Finding gradient contribution...';
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
    case 'p2_backward_trace':
      if (phase && phase.endsWith('forward')) {
        return 'Preparing training objective...';
      }
      if (phase === 'loss') {
        return 'Measuring error across target positions...';
      }
      return 'Completing training objective...';

    case 'p2_gradient_contribution':
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

