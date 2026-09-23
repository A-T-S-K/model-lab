import { canonicalBytes, snapshotId, validateTrainingSnapshot, type ArchivedSnapshot } from '../archive/snapshot.js';
import {
  CANONICAL_MICROGPT_DEFINITION,
  CANONICAL_TO_COMPOSITE_INITIALIZATION,
  COMPOSITE_MLP_MICROGPT_DEFINITION,
  modelDefinitionKey,
  modelDefinitions,
  type CompositeMlpDownReplacement,
  type ModelDefinitionContribution,
  type ModelDefinitionIdentity,
  type VariantParameterSchema,
} from '../model/definitions.js';
import { restoreTraining, type CompositeVariantModel, type ParameterData } from '../model/state.js';
import { Value } from '../model/value.js';
import { sha256Id } from '../trace/sha256.js';
import { immutableCopy } from '../trace/types.js';

export const VARIANT_NUMERIC_POLICY = 'ECMAScript binary64; ordered scalar reductions' as const;
export const COMPOSITE_VARIANT_STATE_FORMAT = { id: 'microgpt.composite-variant-state', version: 1 } as const;

export interface CompositeVariantInitializationRecord {
  readonly formatVersion: 1;
  readonly id: string;
  readonly targetDefinition: ModelDefinitionIdentity;
  readonly sourceDefinition: ModelDefinitionIdentity;
  readonly sourceCheckpointId: string;
  readonly sourceSnapshotId: string;
  readonly mapping: typeof CANONICAL_TO_COMPOSITE_INITIALIZATION;
  readonly numericPolicy: typeof VARIANT_NUMERIC_POLICY;
  readonly checkpointUse: 'parameter-initialization-only';
  readonly exactTrainingResume: false;
  readonly bottleneckWidth: number;
  readonly scale: number;
  readonly parameterSchema: readonly VariantParameterSchema[];
  readonly trainability: {
    readonly inheritedParameters: 'frozen';
    readonly trainableParameterOrder: readonly string[];
    readonly scale: 'fixed-definition-constant';
  };
  readonly initializationDeclaration: readonly { readonly name: string; readonly algorithm: string; readonly declaration: string }[];
  readonly optimizerHyperparameterProvenance: {
    readonly source: 'copied-configuration-only-from-canonical-snapshot';
    readonly fields: readonly ['learningRate', 'beta1', 'beta2', 'epsilon', 'numSteps'];
    readonly dynamicState: 'new-zero-moments';
  };
  readonly continuationProvenance: {
    readonly datasetCursor: 'new-zero-for-fixed-variant-sequence';
    readonly rngState: 'unused-null';
  };
}

export interface CompositeVariantOptimizerState {
  readonly identity: { readonly family: 'adam'; readonly version: 1 };
  readonly config: { learningRate: number; beta1: number; beta2: number; epsilon: number; numSteps: number };
  readonly parameterOrder: string[];
  step: number;
  m: number[];
  v: number[];
}

export interface CompositeVariantState {
  readonly format: typeof COMPOSITE_VARIANT_STATE_FORMAT;
  readonly definition: ModelDefinitionIdentity;
  readonly baseDefinition: ModelDefinitionIdentity;
  readonly baseCheckpointId: string;
  readonly baseSnapshotId: string;
  readonly initialization: CompositeVariantInitializationRecord;
  readonly parameterSchema: readonly VariantParameterSchema[];
  readonly parameters: ParameterData;
  readonly trainingPolicy: {
    readonly inheritedParameterOrder: readonly string[];
    readonly inheritedParameters: 'frozen';
    readonly trainableParameterOrder: readonly string[];
    readonly scale: 'fixed-definition-constant';
  };
  readonly optimizer: CompositeVariantOptimizerState;
  readonly numericPolicy: typeof VARIANT_NUMERIC_POLICY;
  readonly continuation: { datasetCursor: number; rngState: number | null };
}

export interface ArchivedCompositeVariantState { readonly id: string; readonly state: CompositeVariantState }

export interface CompositeVariantInitializationRequest {
  readonly source: ArchivedSnapshot;
  readonly targetDefinition?: ModelDefinitionIdentity;
  readonly sourceDefinition?: ModelDefinitionIdentity;
  readonly sourceCheckpointId?: string;
  readonly numericPolicy?: string;
  /** Test/preflight surface: supplied declarations must exactly equal the registered schema. */
  readonly parameterSchema?: readonly VariantParameterSchema[];
}

const bytesEqual = (a: unknown, b: unknown): boolean => {
  const aa = canonicalBytes(a), bb = canonicalBytes(b);
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
};
async function digest(value: unknown): Promise<string> {
  return sha256Id(canonicalBytes(value));
}
const matrixData = (rows: number, columns: number, algorithm: VariantParameterSchema['initialization']['algorithm']): number[][] =>
  Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) =>
    algorithm === 'zeros' ? 0 : ((((row + 1) * (column + 1)) % 7) - 3) / 64));

function requireCompositeDefinition(identity: ModelDefinitionIdentity): ModelDefinitionContribution & {
  readonly base: ModelDefinitionIdentity;
  readonly replacement: CompositeMlpDownReplacement;
  readonly initialization: NonNullable<ModelDefinitionContribution['initialization']>;
} {
  const definition = modelDefinitions.require(identity);
  if (definition.replacement?.kind !== 'composite-mlp-down' || !definition.base || !definition.initialization)
    throw new Error('Target definition is not the registered composite MLP variant');
  return definition as ModelDefinitionContribution & { readonly base: ModelDefinitionIdentity;
    readonly replacement: CompositeMlpDownReplacement;
    readonly initialization: NonNullable<ModelDefinitionContribution['initialization']> };
}

export async function initializeCompositeVariant(request: CompositeVariantInitializationRequest): Promise<{
  readonly model: CompositeVariantModel;
  readonly initialization: CompositeVariantInitializationRecord;
  readonly state: ArchivedCompositeVariantState;
}> {
  const target = request.targetDefinition ?? COMPOSITE_MLP_MICROGPT_DEFINITION;
  const sourceDefinition = request.sourceDefinition ?? CANONICAL_MICROGPT_DEFINITION;
  const definition = requireCompositeDefinition(target), replacement = definition.replacement;
  if (modelDefinitionKey(sourceDefinition) !== modelDefinitionKey(definition.base!)) throw new Error('Wrong base model definition');
  if ((request.numericPolicy ?? VARIANT_NUMERIC_POLICY) !== VARIANT_NUMERIC_POLICY) throw new Error('Incompatible numeric policy');
  validateTrainingSnapshot(request.source.state);
  if ((request.sourceCheckpointId ?? request.source.id) !== request.source.id || await snapshotId(request.source.state) !== request.source.id)
    throw new Error('Wrong canonical base checkpoint');
  const schema = request.parameterSchema ?? replacement.parameterSchema;
  if (!bytesEqual(schema, replacement.parameterSchema)) throw new Error('Parameter schema, axes, names, shapes, or initialization differ from the registered definition');
  const restored = restoreTraining(request.source.state);
  const parameters: ParameterData = {};
  for (const declaration of schema) {
    const values = matrixData(declaration.shape[0], declaration.shape[1], declaration.initialization.algorithm);
    if (values.some(row => row.some(value => !Number.isFinite(value)))) throw new Error('Nonfinite composite parameter initialization');
    parameters[declaration.name] = values;
    restored.model.parameters[declaration.name] = values.map(row => row.map(value => new Value(value)));
  }
  const trainableParameterOrder = schema.map(parameter => parameter.name);
  const body = {
    formatVersion: 1 as const, targetDefinition: definition.identity, sourceDefinition: definition.base!,
    sourceCheckpointId: request.source.id, sourceSnapshotId: request.source.id,
    mapping: CANONICAL_TO_COMPOSITE_INITIALIZATION, numericPolicy: VARIANT_NUMERIC_POLICY,
    checkpointUse: 'parameter-initialization-only' as const, exactTrainingResume: false as const,
    bottleneckWidth: replacement.bottleneckWidth, scale: replacement.scale, parameterSchema: schema,
    trainability: { inheritedParameters: 'frozen' as const, trainableParameterOrder, scale: 'fixed-definition-constant' as const },
    initializationDeclaration: schema.map(parameter => ({ name: parameter.name, algorithm: parameter.initialization.algorithm,
      declaration: parameter.initialization.declaration })),
    optimizerHyperparameterProvenance: { source: 'copied-configuration-only-from-canonical-snapshot' as const,
      fields: ['learningRate', 'beta1', 'beta2', 'epsilon', 'numSteps'] as const, dynamicState: 'new-zero-moments' as const },
    continuationProvenance: { datasetCursor: 'new-zero-for-fixed-variant-sequence' as const, rngState: 'unused-null' as const },
  };
  const initialization = immutableCopy({ ...body, id: await digest(body) });
  const count = schema.reduce((total, parameter) => total + parameter.shape[0] * parameter.shape[1], 0);
  const sourceOptimizer = request.source.state.optimizer;
  const state: CompositeVariantState = {
    format: COMPOSITE_VARIANT_STATE_FORMAT, definition: definition.identity, baseDefinition: definition.base!,
    baseCheckpointId: request.source.id, baseSnapshotId: request.source.id, initialization, parameterSchema: schema,
    parameters, trainingPolicy: { inheritedParameterOrder: [...request.source.state.parameterOrder], inheritedParameters: 'frozen',
      trainableParameterOrder, scale: 'fixed-definition-constant' },
    optimizer: { identity: { family: 'adam', version: 1 }, config: { learningRate: sourceOptimizer.learningRate,
      beta1: sourceOptimizer.beta1, beta2: sourceOptimizer.beta2, epsilon: sourceOptimizer.epsilon, numSteps: sourceOptimizer.numSteps },
      parameterOrder: [...trainableParameterOrder], step: 0, m: Array(count).fill(0), v: Array(count).fill(0) },
    numericPolicy: VARIANT_NUMERIC_POLICY, continuation: { datasetCursor: 0, rngState: null },
  };
  const model = restored.model as CompositeVariantModel;
  Object.defineProperty(model, 'variant', { enumerable: true, value: Object.freeze({ definition: definition.identity,
    baseDefinition: definition.base!, baseCheckpointId: request.source.id, trainableParameterOrder: [...trainableParameterOrder],
    inheritedParameterPolicy: 'frozen', scalePolicy: 'fixed-definition-constant' }) });
  model.parameterInspectionOrder = [...model.parameterOrder, ...trainableParameterOrder];
  return { model, initialization, state: await archiveCompositeVariantState(state) };
}

function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function exactFields(value: unknown, fields: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!plain(value) || Reflect.ownKeys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field)))
    throw new Error(`Invalid composite variant state: ${label} fields`);
}
function dense(value: unknown): value is unknown[] {
  return Array.isArray(value) && Reflect.ownKeys(value).length === value.length + 1 && value.every((_, index) => Object.hasOwn(value, index));
}

export async function validateCompositeVariantState(state: CompositeVariantState): Promise<void> {
  exactFields(state, ['format','definition','baseDefinition','baseCheckpointId','baseSnapshotId','initialization','parameterSchema','parameters','trainingPolicy','optimizer','numericPolicy','continuation'], 'root');
  if (!bytesEqual(state.format, COMPOSITE_VARIANT_STATE_FORMAT)) throw new Error('Invalid composite variant state: format');
  const definition = requireCompositeDefinition(state.definition), replacement = definition.replacement;
  if (modelDefinitionKey(state.baseDefinition) !== modelDefinitionKey(definition.base!) ||
      state.baseCheckpointId !== state.baseSnapshotId || !state.baseCheckpointId.startsWith('sha256:'))
    throw new Error('Invalid composite variant state: base definition or checkpoint');
  if (state.numericPolicy !== VARIANT_NUMERIC_POLICY || !bytesEqual(state.parameterSchema, replacement.parameterSchema))
    throw new Error('Invalid composite variant state: numeric policy or parameter schema');
  const init = state.initialization;
  exactFields(init, ['formatVersion','id','targetDefinition','sourceDefinition','sourceCheckpointId','sourceSnapshotId','mapping','numericPolicy','checkpointUse','exactTrainingResume','bottleneckWidth','scale','parameterSchema','trainability','initializationDeclaration','optimizerHyperparameterProvenance','continuationProvenance'], 'initialization');
  const { id: initializationId, ...initializationBody } = init;
  if (initializationId !== await digest(initializationBody) || modelDefinitionKey(init.targetDefinition) !== modelDefinitionKey(state.definition) ||
      modelDefinitionKey(init.sourceDefinition) !== modelDefinitionKey(state.baseDefinition) || init.sourceCheckpointId !== state.baseCheckpointId ||
      init.sourceSnapshotId !== state.baseSnapshotId || !bytesEqual(init.parameterSchema, replacement.parameterSchema) ||
      init.bottleneckWidth !== replacement.bottleneckWidth || init.scale !== replacement.scale || init.checkpointUse !== 'parameter-initialization-only' ||
      init.exactTrainingResume !== false || init.numericPolicy !== VARIANT_NUMERIC_POLICY ||
      !bytesEqual(init.mapping, CANONICAL_TO_COMPOSITE_INITIALIZATION)) throw new Error('Invalid composite variant state: initialization receipt');
  const order = replacement.parameterSchema.map(parameter => parameter.name);
  const expectedInitializationDeclarations = replacement.parameterSchema.map(parameter => ({ name: parameter.name,
    algorithm: parameter.initialization.algorithm, declaration: parameter.initialization.declaration }));
  if (!bytesEqual(init.trainability, { inheritedParameters: 'frozen', trainableParameterOrder: order,
      scale: 'fixed-definition-constant' }) || !bytesEqual(init.initializationDeclaration, expectedInitializationDeclarations) ||
      !bytesEqual(init.optimizerHyperparameterProvenance, { source: 'copied-configuration-only-from-canonical-snapshot',
        fields: ['learningRate','beta1','beta2','epsilon','numSteps'], dynamicState: 'new-zero-moments' }) ||
      !bytesEqual(init.continuationProvenance, { datasetCursor: 'new-zero-for-fixed-variant-sequence', rngState: 'unused-null' }))
    throw new Error('Invalid composite variant state: initialization policy or algorithm declaration');
  if (!bytesEqual(state.trainingPolicy, { inheritedParameterOrder: state.trainingPolicy.inheritedParameterOrder,
    inheritedParameters: 'frozen', trainableParameterOrder: order, scale: 'fixed-definition-constant' }) ||
      !dense(state.trainingPolicy.inheritedParameterOrder) || new Set(state.trainingPolicy.inheritedParameterOrder).size !== state.trainingPolicy.inheritedParameterOrder.length ||
      state.trainingPolicy.inheritedParameterOrder.some(name => typeof name !== 'string' || order.includes(name)))
    throw new Error('Invalid composite variant state: frozen/trainable policy or parameter order');
  exactFields(state.parameters, order, 'parameters');
  let count = 0;
  for (const schema of replacement.parameterSchema) {
    const matrix = state.parameters[schema.name];
    if (!dense(matrix) || matrix.length !== schema.shape[0] || matrix.some(row => !dense(row) || row.length !== schema.shape[1] ||
        row.some(value => typeof value !== 'number' || !Number.isFinite(value)))) throw new Error(`Invalid composite variant state: parameter ${schema.name}`);
    count += schema.shape[0] * schema.shape[1];
  }
  const optimizer = state.optimizer;
  exactFields(optimizer, ['identity','config','parameterOrder','step','m','v'], 'optimizer');
  if (!bytesEqual(optimizer.identity, { family: 'adam', version: 1 }) || !bytesEqual(optimizer.parameterOrder, order) ||
      !Number.isSafeInteger(optimizer.step) || optimizer.step < 0 || optimizer.step > optimizer.config.numSteps)
    throw new Error('Invalid composite variant state: optimizer identity, order, or step');
  exactFields(optimizer.config, ['learningRate','beta1','beta2','epsilon','numSteps'], 'optimizer config');
  if (![optimizer.config.learningRate, optimizer.config.epsilon].every(value => Number.isFinite(value) && value > 0) ||
      ![optimizer.config.beta1, optimizer.config.beta2].every(value => Number.isFinite(value) && value >= 0 && value < 1) ||
      !Number.isSafeInteger(optimizer.config.numSteps) || optimizer.config.numSteps < 1 || !dense(optimizer.m) || !dense(optimizer.v) ||
      optimizer.m.length !== count || optimizer.v.length !== count || optimizer.m.some(value => typeof value !== 'number' || !Number.isFinite(value)) ||
      optimizer.v.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0))
    throw new Error('Invalid composite variant state: optimizer config or moments');
  exactFields(state.continuation, ['datasetCursor','rngState'], 'continuation');
  if (!Number.isSafeInteger(state.continuation.datasetCursor) || state.continuation.datasetCursor < 0 ||
      !(state.continuation.rngState === null || (Number.isSafeInteger(state.continuation.rngState) && state.continuation.rngState >= 0 && state.continuation.rngState <= 0xffffffff)))
    throw new Error('Invalid composite variant state: continuation cursor');
}

export async function compositeVariantStateId(state: CompositeVariantState): Promise<string> {
  await validateCompositeVariantState(state); return digest(state);
}
export async function archiveCompositeVariantState(state: CompositeVariantState): Promise<ArchivedCompositeVariantState> {
  await validateCompositeVariantState(state); const copy = immutableCopy(state);
  return Object.freeze({ id: await digest(copy), state: copy });
}

export async function restoreCompositeVariantState(archived: ArchivedCompositeVariantState, base: ArchivedSnapshot): Promise<{
  readonly model: CompositeVariantModel; readonly optimizer: CompositeVariantOptimizerState;
  readonly continuation: { datasetCursor: number; rngState: number | null };
}> {
  await validateCompositeVariantState(archived.state);
  if (await compositeVariantStateId(archived.state) !== archived.id) throw new Error('Composite variant state hash mismatch');
  if (await snapshotId(base.state) !== base.id || base.id !== archived.state.baseCheckpointId || base.id !== archived.state.baseSnapshotId)
    throw new Error('Composite variant state is bound to another base checkpoint');
  validateTrainingSnapshot(base.state);
  const sourceOptimizer = base.state.optimizer, expectedOptimizerConfig = { learningRate: sourceOptimizer.learningRate,
    beta1: sourceOptimizer.beta1, beta2: sourceOptimizer.beta2, epsilon: sourceOptimizer.epsilon, numSteps: sourceOptimizer.numSteps };
  if (!bytesEqual(archived.state.trainingPolicy.inheritedParameterOrder, base.state.parameterOrder) ||
      !bytesEqual(archived.state.optimizer.config, expectedOptimizerConfig))
    throw new Error('Composite variant state does not match base parameter order or inherited optimizer configuration');
  const model = restoreTraining(base.state).model as CompositeVariantModel;
  for (const schema of archived.state.parameterSchema) model.parameters[schema.name] = archived.state.parameters[schema.name]!.map(row => row.map(value => new Value(value)));
  const order = [...archived.state.trainingPolicy.trainableParameterOrder];
  Object.defineProperty(model, 'variant', { enumerable: true, value: Object.freeze({ definition: archived.state.definition,
    baseDefinition: archived.state.baseDefinition, baseCheckpointId: archived.state.baseCheckpointId, trainableParameterOrder: order,
    inheritedParameterPolicy: 'frozen', scalePolicy: 'fixed-definition-constant' }) });
  model.parameterInspectionOrder = [...model.parameterOrder, ...order];
  return { model, optimizer: structuredClone(archived.state.optimizer), continuation: structuredClone(archived.state.continuation) };
}

export function variantParameterData(model: CompositeVariantModel): ParameterData {
  return Object.fromEntries(model.variant.trainableParameterOrder.map(name => [name,
    model.parameters[name]!.map(row => row.map(value => value.data))]));
}

export function snapshotCompositeVariantState(model: CompositeVariantModel, optimizer: CompositeVariantOptimizerState,
  continuation: { datasetCursor: number; rngState: number | null }, prior: CompositeVariantState): CompositeVariantState {
  return structuredClone({ ...prior, parameters: variantParameterData(model), optimizer,
    continuation });
}
