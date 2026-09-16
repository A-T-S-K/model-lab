import type { ArchivedSnapshot } from '../archive/snapshot.js';
import { canonicalBytes } from '../archive/snapshot.js';
import type { LearningExperiment } from '../archive/experiment.js';
import type { RecordedRun } from '../trace/types.js';

export type DataExperimentArm = 'clean' | 'treatment' | 'defended';
export type DataPolicyDecision = 'accepted' | 'substituted' | 'normalized';
export type DataExperimentStatus = 'succeeded' | 'failed' | 'cancelled';

export interface DataExperimentRecipeIdentity { readonly id: string; readonly version: number }
export interface DataPolicyIdentity { readonly id: string; readonly version: number }

export interface DataExperimentStepIdentity {
  readonly experimentId: string;
  readonly arm: DataExperimentArm;
  readonly step: number;
  readonly proposedDocument: string;
  readonly expectedDocument: string;
  readonly effectiveDocument: string;
  readonly decision: DataPolicyDecision;
  readonly policy: DataPolicyIdentity;
  readonly learningExperimentId: string;
  readonly beforeRunId: string;
  readonly trainingRunId: string;
  readonly afterRunId: string;
  readonly startSnapshotId: string;
  readonly endSnapshotId: string;
}

/** External experiment context. It is correlated to, but never inserted into, model evidence. */
export interface ExternalDataPolicyRecord extends DataExperimentStepIdentity {
  readonly id: string;
}

export interface DataExperimentStep extends DataExperimentStepIdentity {
  readonly policyRecordId: string;
}

export interface DataExperimentArmReceipt {
  readonly id: DataExperimentArm;
  readonly status: DataExperimentStatus;
  readonly steps: readonly DataExperimentStep[];
  readonly finalSnapshotId: string;
}

export interface DataEvaluationArm {
  readonly runId: string;
  readonly probability: number;
  readonly meanLoss: number;
}

export interface DataPrefixEvaluation {
  readonly kind: 'triggered' | 'control';
  readonly input: string;
  readonly arms: Readonly<Record<DataExperimentArm, DataEvaluationArm>>;
  readonly comparisons: {
    readonly treatmentToClean: import('../trace/compare.js').RunComparison;
    readonly defendedToClean: import('../trace/compare.js').RunComparison;
  };
}

export interface DataCleanEvaluation {
  readonly input: string;
  readonly arms: Readonly<Record<DataExperimentArm, DataEvaluationArm>>;
}

export interface MatchedTrainingComparison {
  readonly policy: { readonly id: 'matched-training-arms'; readonly version: 1 };
  readonly compatible: boolean;
  readonly reasons: readonly string[];
  readonly basis: {
    readonly commonStart: 'exact complete snapshot and checkpoint';
    readonly budget: 'equal ordered updates';
    readonly controlledDifferences: 'declared substitutions and defense decisions only';
    readonly continuation: 'exact optimizer configuration and matched cursor progression';
  };
}

export interface MatchedDataExperimentReceipt {
  readonly formatVersion: 1;
  readonly receiptId: string;
  readonly id: string;
  readonly recipe: DataExperimentRecipeIdentity;
  readonly source: {
    readonly modelDefinitionId: string;
    readonly modelDefinitionVersion: string;
    readonly checkpointId: string;
    readonly snapshotId: string;
  };
  readonly design: {
    readonly cleanSchedule: readonly string[];
    readonly substitutions: readonly { readonly id: string; readonly step: number; readonly original: string; readonly replacement: string }[];
    readonly defensePolicy: DataPolicyIdentity;
    readonly matchingPolicy: MatchedTrainingComparison['policy'];
    readonly inputTransform: 'microgpt.character-teacher-forcing@1';
    readonly objective: 'microgpt.next-token-mean-nll@1';
    readonly triggeredPrefix: string;
    readonly controlPrefixes: readonly string[];
    readonly cleanDocuments: readonly string[];
    readonly desiredToken: string;
  };
  readonly arms: Readonly<Record<DataExperimentArm, DataExperimentArmReceipt>>;
  readonly policyRecords: readonly ExternalDataPolicyRecord[];
  readonly evaluations: {
    readonly triggered: DataPrefixEvaluation;
    readonly controls: readonly DataPrefixEvaluation[];
    readonly clean: readonly DataCleanEvaluation[];
  };
  readonly metrics: {
    readonly observed: {
      readonly triggeredProbabilities: Readonly<Record<DataExperimentArm, number>>;
      readonly controlProbabilities: readonly Readonly<Record<DataExperimentArm, number>>[];
      readonly cleanTaskMeanLoss: Readonly<Record<DataExperimentArm, number>>;
    };
    readonly derived: {
      readonly triggeredTreatmentMinusClean: number;
      readonly triggeredDefendedMinusClean: number;
      readonly triggeredDefendedMinusTreatment: number;
      readonly cleanLossTreatmentMinusClean: number;
      readonly cleanLossDefendedMinusClean: number;
      readonly cleanLossDefendedMinusTreatment: number;
    };
  };
  readonly matching: MatchedTrainingComparison;
  readonly lifecycle: {
    readonly status: DataExperimentStatus;
    readonly sessionId: string;
    readonly generationId: number;
  };
}

export interface DataExperimentValidationContext {
  readonly snapshot: ArchivedSnapshot;
  readonly snapshots: ReadonlyMap<string, ArchivedSnapshot>;
  readonly runs: ReadonlyMap<string, RecordedRun>;
  readonly learningExperiments: ReadonlyMap<string, LearningExperiment>;
}

export interface DataExperimentRecipeContribution {
  readonly identity: DataExperimentRecipeIdentity;
  readonly defensePolicy: DataPolicyIdentity;
  readonly matchingPolicy: MatchedTrainingComparison['policy'];
  readonly presentation: { readonly title: string; readonly description: string };
  /** Trusted build-time executor. Imported records can select only a registered identity. */
  readonly execute: (request: unknown) => Promise<unknown>;
  readonly validateDesign: (design: unknown, snapshot: ArchivedSnapshot) => void;
  readonly validateReceipt: (receipt: MatchedDataExperimentReceipt, context: DataExperimentValidationContext) => Promise<void> | void;
}

export class DataExperimentRecipeRegistry {
  readonly #recipes = new Map<string, DataExperimentRecipeContribution>();

  register(recipe: DataExperimentRecipeContribution): this {
    const key = dataRecipeKey(recipe.identity);
    if (this.#recipes.has(key)) throw new Error(`Duplicate data-experiment recipe registration: ${key}`);
    this.#recipes.set(key, recipe);
    return this;
  }

  get(identity: DataExperimentRecipeIdentity): DataExperimentRecipeContribution | undefined {
    return this.#recipes.get(dataRecipeKey(identity));
  }

  require(identity: DataExperimentRecipeIdentity): DataExperimentRecipeContribution {
    const recipe = this.get(identity);
    if (!recipe) throw new Error(`Unknown data-experiment recipe: ${dataRecipeKey(identity)}`);
    return recipe;
  }

  identities(): readonly DataExperimentRecipeIdentity[] {
    return [...this.#recipes.values()].map(recipe => recipe.identity);
  }
}

/** Shared build-time registry. Trusted recipe modules register during application assembly. */
export const dataExperimentRecipes = new DataExperimentRecipeRegistry();

export function dataRecipeKey(identity: DataExperimentRecipeIdentity): string {
  if (!identity || typeof identity.id !== 'string' || !identity.id || !Number.isSafeInteger(identity.version) || identity.version < 1)
    throw new Error('Invalid data-experiment recipe identity');
  return `${identity.id}@${identity.version}`;
}

export async function immutableRecordId(value: unknown): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', canonicalBytes(value));
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function policyRecordPayload(record: ExternalDataPolicyRecord): DataExperimentStepIdentity {
  const { id: _id, ...payload } = record;
  return payload;
}

export async function validatePolicyRecordIdentity(record: ExternalDataPolicyRecord): Promise<void> {
  if (record.id !== await immutableRecordId(policyRecordPayload(record))) throw new Error('External policy record content hash mismatch');
}

/** Exact identity correlation fixture. Array position and timestamps have no role. */
export async function correlateExternalPolicyRecords(
  records: readonly ExternalDataPolicyRecord[],
  steps: readonly DataExperimentStep[],
): Promise<readonly { readonly policyRecordId: string; readonly learningExperimentId: string; readonly trainingRunId: string }[]> {
  const byId = new Map(records.map(record => [record.id, record]));
  if (byId.size !== records.length) throw new Error('Duplicate external policy record identity');
  const correlations = [];
  for (const step of steps) {
    const record = byId.get(step.policyRecordId);
    if (!record) throw new Error('Experiment step references a missing external policy record');
    await validatePolicyRecordIdentity(record);
    const { policyRecordId: _policyRecordId, ...identity } = step;
    if (canonicalBytes(identity).length !== canonicalBytes(policyRecordPayload(record)).length ||
        !canonicalBytes(identity).every((byte, index) => byte === canonicalBytes(policyRecordPayload(record))[index]))
      throw new Error('External policy record does not correlate to the exact model training step identity');
    correlations.push({ policyRecordId: record.id, learningExperimentId: record.learningExperimentId, trainingRunId: record.trainingRunId });
  }
  if (correlations.length !== records.length) throw new Error('Uncorrelated external policy record');
  return Object.freeze(correlations.map(item => Object.freeze(item)));
}

export function receiptPayload(receipt: MatchedDataExperimentReceipt): Omit<MatchedDataExperimentReceipt, 'receiptId'> {
  const { receiptId: _receiptId, ...payload } = receipt;
  return payload;
}
