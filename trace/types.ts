/** Provisional evidence contracts. None of these objects executes a model. */
export type CaptureLevel = 'summary' | 'semantic' | 'scalar';
export type Availability = 'available' | 'not_captured' | 'not_applicable' | 'unsupported' | 'budget_exceeded';
export type Provenance = 'observed' | 'derived' | 'recomputed';
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface ModelDefinition {
  readonly id: string;
  readonly version: string;
  readonly architecture: { readonly [key: string]: JsonValue };
  readonly capabilities: readonly string[];
}

export interface NumericTensor {
  readonly shape: readonly number[];
  readonly values: readonly number[];
}

export interface ModelCheckpoint {
  readonly id: string;
  readonly modelDefinitionId: string;
  readonly modelDefinitionVersion: string;
  readonly parameters: Readonly<Record<string, NumericTensor>>;
}

/** Current RNG state is required where used; a seed alone cannot resume training. */
export interface TrainingSnapshot {
  readonly id: string;
  readonly checkpoint: ModelCheckpoint;
  readonly optimizer: {
    readonly kind: 'adam';
    readonly firstMoments: Readonly<Record<string, NumericTensor>>;
    readonly secondMoments: Readonly<Record<string, NumericTensor>>;
    readonly beta1: number;
    readonly beta2: number;
    readonly epsilon: number;
  };
  readonly trainingStep: number;
  readonly schedule: { readonly [key: string]: JsonValue };
  readonly datasetCursor: JsonValue;
  readonly rngState: JsonValue;
}

export interface CaptureRequest {
  readonly level: CaptureLevel;
  readonly maxArtifacts: number;
  readonly maxValues: number;
}

export interface RunManifest {
  readonly runId: string;
  readonly sessionId: string;
  readonly generationId: number;
  readonly model: ModelDefinition;
  readonly startingCheckpointId: string;
  readonly startingSnapshotId?: string;
  readonly input: JsonValue;
  readonly targets: JsonValue;
  readonly numeric: { readonly dtype: 'float64'; readonly policy: string };
  readonly capture: CaptureRequest;
  readonly runtimeVersion: string;
  readonly intervention?: JsonValue;
}

export interface ConceptRef {
  readonly kind: string;
  readonly layer?: number;
  readonly head?: number;
  readonly token?: number;
  readonly feature?: number;
  readonly binding?: { readonly system: string; readonly address: string };
}

export interface Artifact {
  readonly id: string;
  readonly concept: ConceptRef;
  readonly kind: string;
  readonly shape: readonly number[];
  readonly axes: readonly string[];
  readonly dtype: 'float64';
  /** Unavailable evidence has null values, never manufactured numerical zeros. */
  readonly values: readonly number[] | null;
  readonly provenance: Provenance;
  readonly availability: Availability;
  readonly captureLevel: CaptureLevel;
}

/** Structural observer contract: producers need not import any trace implementation. */
export interface Observation {
  readonly kind: string;
  readonly values: readonly number[];
  readonly shape: readonly number[];
  readonly axes?: readonly string[];
  readonly layer?: number;
  readonly head?: number;
  readonly token?: number;
  readonly feature?: number;
  readonly captureLevel?: CaptureLevel;
  readonly provenance?: Provenance;
  readonly availability?: Availability;
}

export interface RecordedRun {
  readonly formatVersion: 1;
  readonly manifest: RunManifest;
  readonly artifacts: readonly Artifact[];
  readonly capture: {
    readonly storedValues: number;
    readonly droppedArtifacts: number;
    readonly budgetExceeded: boolean;
  };
}

/** Copy plain evidence and freeze every level; runtime graphs are never accepted here. */
export function immutableCopy<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(item => immutableCopy(item))) as T;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Evidence must contain only plain objects, arrays, and primitives');
  }
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, immutableCopy(item)]))) as T;
}

export function createCheckpoint(checkpoint: ModelCheckpoint): ModelCheckpoint {
  return immutableCopy(checkpoint);
}

export function createTrainingSnapshot(snapshot: TrainingSnapshot): TrainingSnapshot {
  return immutableCopy(snapshot);
}
