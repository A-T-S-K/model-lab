import type { ArchivedSnapshot } from '../archive/snapshot.js';
import type { MatchedInterventionComparison } from '../trace/compare.js';
import type { JsonValue, RecordedRun } from '../trace/types.js';

export interface InterventionRecipeIdentity {
  readonly id: string;
  readonly version: number;
}

export interface InterventionArm {
  readonly runId: string;
  readonly status: 'succeeded' | 'failed' | 'cancelled';
}

export interface InterventionReceipt {
  readonly status: 'applied';
  readonly recipe: InterventionRecipeIdentity;
  readonly sourceCheckpointId: string;
  readonly baselineRunId: string;
  readonly interventionRunId: string;
  readonly donorRunId?: string;
}

export interface InterventionExperiment {
  readonly id: string;
  readonly recipe: InterventionRecipeIdentity;
  readonly startingSnapshotId: string;
  readonly source: {
    readonly modelDefinitionId: string;
    readonly modelDefinitionVersion: string;
    readonly checkpointId: string;
    readonly snapshotId: string;
  };
  readonly inputs: {
    readonly baseline: { readonly input: JsonValue; readonly targets: JsonValue };
    readonly intervention: { readonly input: JsonValue; readonly targets: JsonValue };
    readonly donor?: { readonly input: JsonValue; readonly targets: JsonValue };
  };
  readonly arms: {
    readonly baseline: InterventionArm;
    readonly intervention: InterventionArm;
    readonly donor?: InterventionArm;
  };
  readonly declaration: unknown;
  readonly receipt: InterventionReceipt;
  readonly comparison: MatchedInterventionComparison;
  readonly lifecycle: {
    readonly status: 'succeeded' | 'failed' | 'cancelled';
    readonly sessionId: string;
    readonly generationId: number;
  };
  /** Embedded immutable runs preserve the existing worker response contract. */
  readonly baselineRun: RecordedRun;
  readonly interventionRun: RecordedRun;
  readonly donorRun?: RecordedRun;
}

export interface InterventionValidationContext {
  readonly snapshot: ArchivedSnapshot;
  readonly runs: ReadonlyMap<string, RecordedRun>;
}

export interface InterventionRecipeContribution {
  readonly identity: InterventionRecipeIdentity;
  readonly comparisonPolicy: 'matched-intervention';
  readonly writablePoints: readonly string[];
  readonly presentation: { readonly title: string; readonly sourceLabel: string };
  /** Build-time trusted binding. Imported records never supply executable code. */
  readonly execute: (request: unknown) => Promise<InterventionExperiment>;
  readonly validateReceipt: (experiment: InterventionExperiment, context: InterventionValidationContext) => void;
}

export class InterventionRecipeRegistry {
  readonly #recipes = new Map<string, InterventionRecipeContribution>();

  register(recipe: InterventionRecipeContribution): this {
    const key = recipeKey(recipe.identity);
    if (this.#recipes.has(key)) throw new Error(`Duplicate intervention recipe registration: ${key}`);
    this.#recipes.set(key, recipe);
    return this;
  }

  get(identity: InterventionRecipeIdentity): InterventionRecipeContribution | undefined {
    return this.#recipes.get(recipeKey(identity));
  }

  require(identity: InterventionRecipeIdentity): InterventionRecipeContribution {
    const recipe = this.get(identity);
    if (!recipe) throw new Error(`Unknown intervention recipe: ${recipeKey(identity)}`);
    return recipe;
  }

  identities(): readonly InterventionRecipeIdentity[] {
    return [...this.#recipes.values()].map(recipe => recipe.identity);
  }
}

export function recipeKey(identity: InterventionRecipeIdentity): string {
  if (!identity || typeof identity.id !== 'string' || !identity.id || !Number.isSafeInteger(identity.version) || identity.version < 1)
    throw new Error('Invalid intervention recipe identity');
  return `${identity.id}@${identity.version}`;
}
