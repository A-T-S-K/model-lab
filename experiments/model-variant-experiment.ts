import type { ArchivedSnapshot } from '../archive/snapshot.js';
import type { ModelDefinitionIdentity } from '../model/definitions.js';
import type { RecordedRun } from '../trace/types.js';
import type { CompositeVariantExperiment } from './composite-model-variant.js';
import type { ActivationVariantExperiment } from './model-variant.js';

export interface ModelVariantExperimentIdentity {
  readonly id: string;
  readonly version: number;
}

/** Common immutable archive envelope. Variant-specific receipts extend this
 * structurally and remain owned by their registered validators. */
export interface ModelVariantExperiment {
  readonly id: string;
  readonly identity: ModelVariantExperimentIdentity;
  readonly source: {
    readonly modelDefinition: ModelDefinitionIdentity;
    readonly checkpointId: string;
    readonly snapshotId: string;
  };
  readonly targetDefinition: ModelDefinitionIdentity;
  readonly baselineRun: RecordedRun;
}

export interface ModelVariantExperimentContribution {
  readonly identity: ModelVariantExperimentIdentity;
  readonly targetDefinition: ModelDefinitionIdentity;
  /** Build-time trusted validation. Imported records cannot contribute executable code. */
  readonly validateReceipt: (experiment: ModelVariantExperiment, source: ArchivedSnapshot) => Promise<void> | void;
  /** Variant-owned retained runs; the canonical baseline is common archive state. */
  readonly variantRuns: (experiment: ModelVariantExperiment) => readonly RecordedRun[];
}

export function modelVariantExperimentKey(identity: ModelVariantExperimentIdentity): string {
  if (!identity || typeof identity.id !== 'string' || !identity.id ||
      !Number.isSafeInteger(identity.version) || identity.version < 1)
    throw new Error('Invalid model-variant experiment identity');
  return `${identity.id}@${identity.version}`;
}

export class ModelVariantExperimentRegistry {
  readonly #contributions = new Map<string, ModelVariantExperimentContribution>();

  register(contribution: ModelVariantExperimentContribution): this {
    const key = modelVariantExperimentKey(contribution.identity);
    if (this.#contributions.has(key)) throw new Error(`Duplicate model-variant experiment registration: ${key}`);
    this.#contributions.set(key, contribution);
    return this;
  }

  require(identity: ModelVariantExperimentIdentity): ModelVariantExperimentContribution {
    const contribution = this.#contributions.get(modelVariantExperimentKey(identity));
    if (!contribution) throw new Error(`Unknown model-variant experiment: ${modelVariantExperimentKey(identity)}`);
    return contribution;
  }

  identities(): readonly ModelVariantExperimentIdentity[] {
    return [...this.#contributions.values()].map(contribution => contribution.identity);
  }
}

export function isActivationVariantExperiment(experiment: ModelVariantExperiment): experiment is ActivationVariantExperiment {
  return experiment.identity.id === 'microgpt.activation-variant' && experiment.identity.version === 1;
}

export function isCompositeVariantExperiment(experiment: ModelVariantExperiment): experiment is CompositeVariantExperiment {
  return experiment.identity.id === 'microgpt.composite-parameterized-variant' && experiment.identity.version === 1;
}
