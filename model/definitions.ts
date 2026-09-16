import fixture from '../fixtures/canonical.initial.json';
import type { Value } from './value.js';

export interface ModelDefinitionIdentity { readonly id: string; readonly version: string }
export interface ActivationDefinition {
  readonly operation: 'relu' | 'leaky_relu'; readonly semanticKind: 'mlpRelu' | 'mlpLeakyRelu';
  readonly label: string; readonly equation: string; readonly negativeSlope?: number; readonly derivativeAtZero: number;
  apply(value: Value): Value;
}
export interface ParameterCoordinateBasis { readonly id: string; readonly axes: readonly string[] }
export interface VariantParameterSchema {
  readonly name: string; readonly ownerSemanticKind: 'mlpAdapterA' | 'mlpAdapterB'; readonly dtype: 'float64';
  readonly numericPolicy: 'ECMAScript binary64; ordered scalar reductions'; readonly shape: readonly [number, number];
  readonly inputBasis: ParameterCoordinateBasis; readonly outputBasis: ParameterCoordinateBasis;
  readonly trainability: 'trainable'; readonly initialization: {
    readonly algorithm: 'deterministic-index-formula' | 'zeros'; readonly declaration: string;
  };
}
export interface ActivationReplacement {
  readonly kind: 'activation'; readonly sourceSemanticKind: 'mlpRelu'; readonly targetSemanticKind: 'mlpLeakyRelu';
  readonly declaration: string;
}
export interface CompositeMlpDownReplacement {
  readonly kind: 'composite-mlp-down'; readonly sourceSemanticKind: 'mlpDown'; readonly targetSemanticKind: 'mlpCompositeDown';
  readonly declaration: string; readonly baseSemanticKind: 'mlpBaseDown'; readonly adapterASemanticKind: 'mlpAdapterA';
  readonly adapterBSemanticKind: 'mlpAdapterB'; readonly scaledAdapterSemanticKind: 'mlpAdapterScaled';
  readonly scale: number; readonly bottleneckWidth: number; readonly parameterSchema: readonly VariantParameterSchema[];
  readonly policy: { readonly inheritedParameters: 'frozen'; readonly newParameters: 'trainable'; readonly scale: 'fixed-definition-constant' };
}
export type ModelDefinitionReplacement = ActivationReplacement | CompositeMlpDownReplacement;
export interface VariantPointMapping {
  readonly sourceKind: string | null; readonly targetKind: string;
  readonly relationship: 'unchanged' | 'replaced' | 'downstream' | 'variant-only';
}
export interface ModelDefinitionContribution {
  readonly identity: ModelDefinitionIdentity; readonly base?: ModelDefinitionIdentity; readonly replacement?: ModelDefinitionReplacement;
  readonly activation: ActivationDefinition; readonly capabilities: readonly string[];
  readonly initialization?: { readonly id: string; readonly version: 1; readonly sourceDefinition: ModelDefinitionIdentity;
    readonly checkpointUse: 'parameter-initialization-only'; readonly exactTrainingResume: false; readonly declaration?: string };
  readonly comparison?: { readonly policy: { readonly id: 'matched-variant'; readonly version: 1 };
    readonly pointMappings: readonly VariantPointMapping[] };
}

export function modelDefinitionKey(identity: ModelDefinitionIdentity): string { return `${identity.id}@${identity.version}`; }
function validateActivation(activation: ActivationDefinition): void {
  if (activation.operation === 'leaky_relu') {
    if (!Number.isFinite(activation.negativeSlope) || activation.negativeSlope! <= 0 || activation.negativeSlope! >= 1)
      throw new Error('Invalid Leaky ReLU activation configuration');
    if (activation.derivativeAtZero !== activation.negativeSlope)
      throw new Error('Leaky ReLU zero derivative must match its declared otherwise branch');
  } else if (activation.negativeSlope !== undefined || activation.derivativeAtZero !== 0) {
    throw new Error('Invalid canonical ReLU activation configuration');
  }
}
function validateComposite(replacement: CompositeMlpDownReplacement): void {
  if (!Number.isInteger(replacement.bottleneckWidth) || replacement.bottleneckWidth < 1) throw new Error('Invalid composite bottleneck width');
  if (!Number.isFinite(replacement.scale) || replacement.scale === 0) throw new Error('Invalid composite scale');
  if (replacement.parameterSchema.length !== fixture.config.nLayer * 2) throw new Error('Invalid composite parameter schema count');
  const names = new Set<string>();
  for (let layer = 0; layer < fixture.config.nLayer; layer++) {
    const expected = [
      { name: `layer${layer}.mlp_adapter_a`, owner: 'mlpAdapterA', shape: [replacement.bottleneckWidth, 4 * fixture.config.nEmbd], input: 'microgpt.mlp-activation.feature.v1', output: 'microgpt.adapter-bottleneck.feature.v1', algorithm: 'deterministic-index-formula' },
      { name: `layer${layer}.mlp_adapter_b`, owner: 'mlpAdapterB', shape: [fixture.config.nEmbd, replacement.bottleneckWidth], input: 'microgpt.adapter-bottleneck.feature.v1', output: 'microgpt.embedding.feature.v1', algorithm: 'zeros' },
    ] as const;
    for (const item of expected) {
      const schema = replacement.parameterSchema.find(candidate => candidate.name === item.name);
      if (!schema || names.has(schema.name) || schema.ownerSemanticKind !== item.owner || schema.dtype !== 'float64' ||
          schema.numericPolicy !== 'ECMAScript binary64; ordered scalar reductions' || schema.shape[0] !== item.shape[0] ||
          schema.shape[1] !== item.shape[1] || schema.inputBasis.id !== item.input || schema.outputBasis.id !== item.output ||
          schema.inputBasis.axes.length !== 1 || schema.outputBasis.axes.length !== 1 || schema.inputBasis.axes[0] !== 'feature' ||
          schema.outputBasis.axes[0] !== 'feature' || schema.trainability !== 'trainable' || schema.initialization.algorithm !== item.algorithm)
        throw new Error(`Invalid composite parameter schema: ${item.name}`);
      names.add(schema.name);
    }
  }
}
function validateContribution(definition: ModelDefinitionContribution): void {
  if (!definition.identity.id || !definition.identity.version) throw new Error('Invalid model definition identity');
  validateActivation(definition.activation);
  if (!definition.base) {
    if (definition.replacement || definition.initialization || definition.comparison) throw new Error('Canonical definition cannot declare a variant replacement');
    return;
  }
  if (!definition.replacement || !definition.initialization || !definition.comparison)
    throw new Error('Variant definition requires replacement, initialization, and comparison declarations');
  if (modelDefinitionKey(definition.initialization.sourceDefinition) !== modelDefinitionKey(definition.base))
    throw new Error('Variant base and initialization source definitions differ');
  if (definition.replacement.kind === 'activation') {
    if (definition.replacement.targetSemanticKind !== definition.activation.semanticKind)
      throw new Error('Variant replacement and activation semantic identities differ');
  } else {
    if (definition.activation.operation !== 'relu' || definition.activation.semanticKind !== 'mlpRelu')
      throw new Error('Composite MLP replacement must retain canonical ReLU');
    validateComposite(definition.replacement);
  }
  const replacement = definition.comparison.pointMappings.filter(point => point.relationship === 'replaced');
  if (replacement.length !== 1 || replacement[0]!.sourceKind !== definition.replacement.sourceSemanticKind ||
      replacement[0]!.targetKind !== definition.replacement.targetSemanticKind)
    throw new Error('Variant comparison mapping does not name the declared replacement');
  for (const mapping of definition.comparison.pointMappings) if ((mapping.relationship === 'variant-only') !== (mapping.sourceKind === null))
    throw new Error('Variant-only comparison points must have no canonical source');
}
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
export class ModelDefinitionRegistry {
  readonly #definitions = new Map<string, ModelDefinitionContribution>();
  register(definition: ModelDefinitionContribution): this {
    validateContribution(definition); const key = modelDefinitionKey(definition.identity);
    if (this.#definitions.has(key)) throw new Error(`Duplicate model definition registration: ${key}`);
    this.#definitions.set(key, deepFreeze(definition)); return this;
  }
  require(identity: ModelDefinitionIdentity): ModelDefinitionContribution {
    const definition = this.#definitions.get(modelDefinitionKey(identity));
    if (!definition) throw new Error(`Unknown model definition: ${modelDefinitionKey(identity)}`); return definition;
  }
  list(): readonly ModelDefinitionContribution[] { return Object.freeze([...this.#definitions.values()]); }
}

export const CANONICAL_MICROGPT_DEFINITION = { id: 'microgpt', version: fixture.reference.revision } as const;
export const LEAKY_RELU_MICROGPT_DEFINITION = { id: 'microgpt.leaky-relu', version: '1' } as const;
export const COMPOSITE_MLP_MICROGPT_DEFINITION = { id: 'microgpt.composite-mlp', version: '1' } as const;
export const LEAKY_RELU_NEGATIVE_SLOPE = 0.01 as const;
export const COMPOSITE_MLP_BOTTLENECK_WIDTH = 2 as const;
export const COMPOSITE_MLP_SCALE = 0.5 as const;
export const CANONICAL_TO_LEAKY_INITIALIZATION = { id: 'microgpt.canonical-parameters-to-leaky-relu', version: 1 } as const;
export const CANONICAL_TO_COMPOSITE_INITIALIZATION = { id: 'microgpt.canonical-plus-deterministic-composite-branch', version: 1 } as const;
const canonicalActivation: ActivationDefinition = { operation: 'relu', semanticKind: 'mlpRelu', label: 'ReLU', equation: 'max(0, x)',
  derivativeAtZero: 0, apply: value => value.relu() };
const stageKinds = ['tokenEmbedding', 'positionEmbedding', 'embeddingSum', 'embeddingNorm', 'preAttentionNorm', 'q', 'k', 'v',
  'attentionLogits', 'attentionProbabilities', 'headOutput', 'attentionOutput', 'attentionProjection', 'attentionResidual', 'preMlpNorm', 'mlpUp'] as const;
const downstreamKinds = ['mlpResidual', 'logits', 'probabilities'] as const;
const activationPointMappings: readonly VariantPointMapping[] = [
  ...stageKinds.map(kind => ({ sourceKind: kind, targetKind: kind, relationship: 'unchanged' as const })),
  { sourceKind: 'mlpRelu', targetKind: 'mlpLeakyRelu', relationship: 'replaced' },
  { sourceKind: 'mlpDown', targetKind: 'mlpDown', relationship: 'downstream' },
  ...downstreamKinds.map(kind => ({ sourceKind: kind, targetKind: kind, relationship: 'downstream' as const })),
];
export const compositeParameterSchema: readonly VariantParameterSchema[] = Array.from({ length: fixture.config.nLayer }, (_, layer) => [
  { name: `layer${layer}.mlp_adapter_a`, ownerSemanticKind: 'mlpAdapterA' as const, dtype: 'float64' as const,
    numericPolicy: 'ECMAScript binary64; ordered scalar reductions' as const,
    shape: [COMPOSITE_MLP_BOTTLENECK_WIDTH, 4 * fixture.config.nEmbd] as const,
    inputBasis: { id: 'microgpt.mlp-activation.feature.v1', axes: ['feature'] as const },
    outputBasis: { id: 'microgpt.adapter-bottleneck.feature.v1', axes: ['feature'] as const }, trainability: 'trainable' as const,
    initialization: { algorithm: 'deterministic-index-formula' as const, declaration: 'A[row,column] = ((((row + 1) * (column + 1)) mod 7) - 3) / 64' } },
  { name: `layer${layer}.mlp_adapter_b`, ownerSemanticKind: 'mlpAdapterB' as const, dtype: 'float64' as const,
    numericPolicy: 'ECMAScript binary64; ordered scalar reductions' as const,
    shape: [fixture.config.nEmbd, COMPOSITE_MLP_BOTTLENECK_WIDTH] as const,
    inputBasis: { id: 'microgpt.adapter-bottleneck.feature.v1', axes: ['feature'] as const },
    outputBasis: { id: 'microgpt.embedding.feature.v1', axes: ['feature'] as const }, trainability: 'trainable' as const,
    initialization: { algorithm: 'zeros' as const, declaration: 'B[row,column] = 0' } },
]).flat();
const compositePointMappings: readonly VariantPointMapping[] = [
  ...stageKinds.map(kind => ({ sourceKind: kind, targetKind: kind, relationship: 'unchanged' as const })),
  { sourceKind: 'mlpRelu', targetKind: 'mlpRelu', relationship: 'unchanged' },
  { sourceKind: null, targetKind: 'mlpBaseDown', relationship: 'variant-only' },
  { sourceKind: null, targetKind: 'mlpAdapterA', relationship: 'variant-only' },
  { sourceKind: null, targetKind: 'mlpAdapterB', relationship: 'variant-only' },
  { sourceKind: null, targetKind: 'mlpAdapterScaled', relationship: 'variant-only' },
  { sourceKind: 'mlpDown', targetKind: 'mlpCompositeDown', relationship: 'replaced' },
  ...downstreamKinds.map(kind => ({ sourceKind: kind, targetKind: kind, relationship: 'downstream' as const })),
];
export const canonicalMicrogptDefinition: ModelDefinitionContribution = { identity: CANONICAL_MICROGPT_DEFINITION,
  activation: canonicalActivation, capabilities: ['predict', 'learn', 'attentionDetail', 'scalar', 'backward'] };
export const leakyReluMicrogptDefinition: ModelDefinitionContribution = {
  identity: LEAKY_RELU_MICROGPT_DEFINITION, base: CANONICAL_MICROGPT_DEFINITION,
  replacement: { kind: 'activation', sourceSemanticKind: 'mlpRelu', targetSemanticKind: 'mlpLeakyRelu', declaration: 'Replace canonical MLP ReLU with Leaky ReLU' },
  activation: { operation: 'leaky_relu', semanticKind: 'mlpLeakyRelu', label: 'Leaky ReLU', equation: 'x when x > 0; 0.01 × x otherwise',
    negativeSlope: LEAKY_RELU_NEGATIVE_SLOPE, derivativeAtZero: LEAKY_RELU_NEGATIVE_SLOPE,
    apply: value => value.leakyRelu(LEAKY_RELU_NEGATIVE_SLOPE) }, capabilities: ['predict', 'scalar', 'backward', 'initialization-only'],
  initialization: { ...CANONICAL_TO_LEAKY_INITIALIZATION, sourceDefinition: CANONICAL_MICROGPT_DEFINITION,
    checkpointUse: 'parameter-initialization-only', exactTrainingResume: false },
  comparison: { policy: { id: 'matched-variant', version: 1 }, pointMappings: activationPointMappings },
};
export const compositeMlpMicrogptDefinition: ModelDefinitionContribution = {
  identity: COMPOSITE_MLP_MICROGPT_DEFINITION, base: CANONICAL_MICROGPT_DEFINITION,
  replacement: { kind: 'composite-mlp-down', sourceSemanticKind: 'mlpDown', targetSemanticKind: 'mlpCompositeDown',
    declaration: 'Replace canonical MLP down projection W x with W x + s B(Ax)', baseSemanticKind: 'mlpBaseDown',
    adapterASemanticKind: 'mlpAdapterA', adapterBSemanticKind: 'mlpAdapterB', scaledAdapterSemanticKind: 'mlpAdapterScaled',
    scale: COMPOSITE_MLP_SCALE, bottleneckWidth: COMPOSITE_MLP_BOTTLENECK_WIDTH, parameterSchema: compositeParameterSchema,
    policy: { inheritedParameters: 'frozen', newParameters: 'trainable', scale: 'fixed-definition-constant' } },
  activation: canonicalActivation, capabilities: ['predict', 'scalar', 'backward', 'variant-training', 'exact-same-variant-resume'],
  initialization: { ...CANONICAL_TO_COMPOSITE_INITIALIZATION, sourceDefinition: CANONICAL_MICROGPT_DEFINITION,
    checkpointUse: 'parameter-initialization-only', exactTrainingResume: false,
    declaration: 'Copy immutable canonical parameters; initialize A by the declared index formula and B to exact zero' },
  comparison: { policy: { id: 'matched-variant', version: 1 }, pointMappings: compositePointMappings },
};
/** Reviewed build-time registrations. Imported records never add executable bindings. */
export const modelDefinitions = new ModelDefinitionRegistry().register(canonicalMicrogptDefinition)
  .register(leakyReluMicrogptDefinition).register(compositeMlpMicrogptDefinition);
