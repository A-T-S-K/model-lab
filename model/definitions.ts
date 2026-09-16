import fixture from '../fixtures/canonical.initial.json';
import type { Value } from './value.js';

export interface ModelDefinitionIdentity {
  readonly id: string;
  readonly version: string;
}

export interface ActivationDefinition {
  readonly operation: 'relu' | 'leaky_relu';
  readonly semanticKind: 'mlpRelu' | 'mlpLeakyRelu';
  readonly label: string;
  readonly equation: string;
  readonly negativeSlope?: number;
  readonly derivativeAtZero: number;
  apply(value: Value): Value;
}

export interface VariantPointMapping {
  readonly sourceKind: string;
  readonly targetKind: string;
  readonly relationship: 'unchanged' | 'replaced' | 'downstream';
}

export interface ModelDefinitionContribution {
  readonly identity: ModelDefinitionIdentity;
  readonly base?: ModelDefinitionIdentity;
  readonly replacement?: {
    readonly sourceSemanticKind: string;
    readonly targetSemanticKind: string;
    readonly declaration: string;
  };
  readonly activation: ActivationDefinition;
  readonly capabilities: readonly string[];
  readonly initialization?: {
    readonly id: string;
    readonly version: 1;
    readonly sourceDefinition: ModelDefinitionIdentity;
    readonly checkpointUse: 'parameter-initialization-only';
    readonly exactTrainingResume: false;
  };
  readonly comparison?: {
    readonly policy: { readonly id: 'matched-variant'; readonly version: 1 };
    readonly pointMappings: readonly VariantPointMapping[];
  };
}

function identityKey(identity: ModelDefinitionIdentity): string {
  return `${identity.id}@${identity.version}`;
}

function validateContribution(definition: ModelDefinitionContribution): void {
  if (!definition.identity.id || !definition.identity.version) throw new Error('Invalid model definition identity');
  const activation = definition.activation;
  if (activation.operation === 'leaky_relu') {
    if (!Number.isFinite(activation.negativeSlope) || activation.negativeSlope! <= 0 || activation.negativeSlope! >= 1)
      throw new Error('Invalid Leaky ReLU activation configuration');
    if (activation.derivativeAtZero !== activation.negativeSlope)
      throw new Error('Leaky ReLU zero derivative must match its declared otherwise branch');
  } else if (activation.negativeSlope !== undefined || activation.derivativeAtZero !== 0) {
    throw new Error('Invalid canonical ReLU activation configuration');
  }
  if (definition.base) {
    if (!definition.replacement || !definition.initialization || !definition.comparison)
      throw new Error('Variant definition requires replacement, initialization, and comparison declarations');
    if (definition.replacement.targetSemanticKind !== activation.semanticKind)
      throw new Error('Variant replacement and activation semantic identities differ');
    if (identityKey(definition.initialization.sourceDefinition) !== identityKey(definition.base))
      throw new Error('Variant base and initialization source definitions differ');
    const replacement = definition.comparison.pointMappings.filter(point => point.relationship === 'replaced');
    if (replacement.length !== 1 || replacement[0]!.sourceKind !== definition.replacement.sourceSemanticKind ||
        replacement[0]!.targetKind !== definition.replacement.targetSemanticKind)
      throw new Error('Variant comparison mapping does not name the declared replacement');
  }
}

export class ModelDefinitionRegistry {
  readonly #definitions = new Map<string, ModelDefinitionContribution>();
  register(definition: ModelDefinitionContribution): this {
    validateContribution(definition);
    const key = identityKey(definition.identity);
    if (this.#definitions.has(key)) throw new Error(`Duplicate model definition registration: ${key}`);
    this.#definitions.set(key, Object.freeze(definition));
    return this;
  }
  require(identity: ModelDefinitionIdentity): ModelDefinitionContribution {
    const definition = this.#definitions.get(identityKey(identity));
    if (!definition) throw new Error(`Unknown model definition: ${identityKey(identity)}`);
    return definition;
  }
  list(): readonly ModelDefinitionContribution[] { return Object.freeze([...this.#definitions.values()]); }
}

export const CANONICAL_MICROGPT_DEFINITION = {
  id: 'microgpt', version: fixture.reference.revision,
} as const;
export const LEAKY_RELU_MICROGPT_DEFINITION = {
  id: 'microgpt.leaky-relu', version: '1',
} as const;
export const LEAKY_RELU_NEGATIVE_SLOPE = 0.01 as const;
export const CANONICAL_TO_LEAKY_INITIALIZATION = {
  id: 'microgpt.canonical-parameters-to-leaky-relu', version: 1,
} as const;

const stageKinds = ['tokenEmbedding', 'positionEmbedding', 'embeddingSum', 'embeddingNorm', 'preAttentionNorm',
  'q', 'k', 'v', 'attentionLogits', 'attentionProbabilities', 'headOutput', 'attentionOutput',
  'attentionProjection', 'attentionResidual', 'preMlpNorm', 'mlpUp', 'mlpDown', 'mlpResidual',
  'logits', 'probabilities'] as const;
const pointMappings: readonly VariantPointMapping[] = [
  ...stageKinds.slice(0, 16).map(kind => ({ sourceKind: kind, targetKind: kind, relationship: 'unchanged' as const })),
  { sourceKind: 'mlpRelu', targetKind: 'mlpLeakyRelu', relationship: 'replaced' },
  ...stageKinds.slice(16).map(kind => ({ sourceKind: kind, targetKind: kind, relationship: 'downstream' as const })),
];

export const canonicalMicrogptDefinition: ModelDefinitionContribution = {
  identity: CANONICAL_MICROGPT_DEFINITION,
  activation: { operation: 'relu', semanticKind: 'mlpRelu', label: 'ReLU', equation: 'max(0, x)',
    derivativeAtZero: 0, apply: value => value.relu() },
  capabilities: ['predict', 'learn', 'attentionDetail', 'scalar', 'backward'],
};

export const leakyReluMicrogptDefinition: ModelDefinitionContribution = {
  identity: LEAKY_RELU_MICROGPT_DEFINITION,
  base: CANONICAL_MICROGPT_DEFINITION,
  replacement: { sourceSemanticKind: 'mlpRelu', targetSemanticKind: 'mlpLeakyRelu',
    declaration: 'Replace canonical MLP ReLU with Leaky ReLU' },
  activation: { operation: 'leaky_relu', semanticKind: 'mlpLeakyRelu', label: 'Leaky ReLU',
    equation: 'x when x > 0; 0.01 × x otherwise', negativeSlope: LEAKY_RELU_NEGATIVE_SLOPE,
    derivativeAtZero: LEAKY_RELU_NEGATIVE_SLOPE, apply: value => value.leakyRelu(LEAKY_RELU_NEGATIVE_SLOPE) },
  capabilities: ['predict', 'scalar', 'backward', 'initialization-only'],
  initialization: { ...CANONICAL_TO_LEAKY_INITIALIZATION, sourceDefinition: CANONICAL_MICROGPT_DEFINITION,
    checkpointUse: 'parameter-initialization-only', exactTrainingResume: false },
  comparison: { policy: { id: 'matched-variant', version: 1 }, pointMappings },
};

/** Reviewed build-time registrations. Imported records never add executable bindings. */
export const modelDefinitions = new ModelDefinitionRegistry()
  .register(canonicalMicrogptDefinition)
  .register(leakyReluMicrogptDefinition);
