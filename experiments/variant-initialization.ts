import type { ArchivedSnapshot } from '../archive/snapshot.js';
import { canonicalBytes, snapshotId, validateTrainingSnapshot } from '../archive/snapshot.js';
import {
  CANONICAL_TO_LEAKY_INITIALIZATION,
  modelDefinitions,
  type ModelDefinitionIdentity,
} from '../model/definitions.js';
import { restoreTraining, type Model } from '../model/state.js';
import { sha256Id } from '../trace/sha256.js';
import { immutableCopy, type JsonValue } from '../trace/types.js';

export interface VariantInitializationRecord {
  readonly formatVersion: 1;
  readonly id: string;
  readonly targetDefinition: ModelDefinitionIdentity;
  readonly sourceDefinition: ModelDefinitionIdentity;
  readonly sourceCheckpointId: string;
  readonly sourceSnapshotId: string;
  readonly mapping: typeof CANONICAL_TO_LEAKY_INITIALIZATION;
  readonly parameterMapping: readonly { readonly source: string; readonly target: string }[];
  readonly numericPolicy: 'ECMAScript binary64; ordered scalar reductions';
  readonly checkpointUse: 'parameter-initialization-only';
  readonly exactTrainingResume: false;
}

export interface VariantInitializationRequest {
  readonly targetDefinition: ModelDefinitionIdentity;
  readonly sourceDefinition: ModelDefinitionIdentity;
  readonly sourceCheckpointId: string;
  readonly source: ArchivedSnapshot;
  readonly mapping: { readonly id: string; readonly version: number };
  readonly numericPolicy: string;
  readonly parameterMapping?: readonly { readonly source: string; readonly target: string }[];
}

const identityKey = (identity: ModelDefinitionIdentity) => `${identity.id}@${identity.version}`;

export async function initializeModelVariant(request: VariantInitializationRequest): Promise<{ readonly model: Model; readonly record: VariantInitializationRecord }> {
  const definition = modelDefinitions.require(request.targetDefinition);
  if (!definition.base || !definition.initialization) throw new Error('Target model definition is not an initializable variant');
  if (identityKey(request.sourceDefinition) !== identityKey(definition.base)) throw new Error('Wrong base model definition');
  if (request.sourceCheckpointId !== request.source.id || await snapshotId(request.source.state) !== request.source.id)
    throw new Error('Wrong source checkpoint');
  if (request.mapping.id !== definition.initialization.id || request.mapping.version !== definition.initialization.version)
    throw new Error('Unregistered variant initialization mapping');
  if (request.numericPolicy !== 'ECMAScript binary64; ordered scalar reductions') throw new Error('Incompatible numeric policy');
  validateTrainingSnapshot(request.source.state);
  const expectedMapping = request.source.state.parameterOrder.map(name => ({ source: name, target: name }));
  const parameterMapping = request.parameterMapping ?? expectedMapping;
  if (JSON.stringify(parameterMapping) !== JSON.stringify(expectedMapping))
    throw new Error('Parameter mapping must preserve exact declared names and order; shape equality alone is insufficient');
  const body = {
    formatVersion: 1 as const, targetDefinition: definition.identity, sourceDefinition: definition.base,
    sourceCheckpointId: request.source.id, sourceSnapshotId: request.source.id,
    mapping: CANONICAL_TO_LEAKY_INITIALIZATION, parameterMapping,
    numericPolicy: request.numericPolicy as VariantInitializationRecord['numericPolicy'],
    checkpointUse: 'parameter-initialization-only' as const, exactTrainingResume: false as const,
  };
  const id = await sha256Id(canonicalBytes(body));
  return { model: restoreTraining(request.source.state).model, record: immutableCopy({ ...body, id }) };
}

export function requireExactVariantResume(_record: VariantInitializationRecord): never {
  throw new Error('Canonical training continuation state is initialization-only and is not an exact cross-definition resume point');
}

export function initializationAsJson(record: VariantInitializationRecord): JsonValue {
  return record as unknown as JsonValue;
}
