import type { ArchivedSnapshot } from '../archive/session.js';
import type { RunComparison } from '../trace/compare.js';
import { immutableCopy } from '../trace/types.js';
import { dataExperimentRecipes, type MatchedDataExperimentReceipt } from './data-experiment.js';
import {
  MATCHED_DATA_SUBSTITUTION_RECIPE,
  type MatchedDataSubstitutionDesign,
  type MatchedDataSubstitutionResult,
  type Substitution,
} from './matched-data-substitution.js';

export type { Substitution } from './matched-data-substitution.js';
export interface PoisoningOptions extends MatchedDataSubstitutionDesign {}

export interface PrefixEvaluation {
  readonly prefix: string;
  readonly cleanArmProbability: number;
  readonly substitutedArmProbability: number;
  readonly defendedArmProbability: number;
  readonly delta: number;
  readonly defendedDelta: number;
  readonly cleanRunId: string;
  readonly substitutedRunId: string;
  readonly defendedRunId: string;
  readonly comparison: RunComparison;
  readonly defendedComparison: RunComparison;
}

/** Compatibility projection. The registered receipt is the authoritative experiment record. */
export interface PoisoningReport {
  readonly id: string;
  readonly startingSnapshotId: string;
  readonly cleanFinalSnapshotId: string;
  readonly substitutedFinalSnapshotId: string;
  readonly defendedFinalSnapshotId: string;
  readonly design: PoisoningOptions;
  readonly updatesPerArm: number;
  readonly learningExperimentIds: {
    readonly clean: readonly string[];
    readonly substituted: readonly string[];
    readonly defended: readonly string[];
  };
  readonly triggered: PrefixEvaluation;
  readonly controls: readonly PrefixEvaluation[];
  readonly cleanTask: {
    readonly documents: readonly string[];
    readonly cleanArmMeanLoss: number;
    readonly substitutedArmMeanLoss: number;
    readonly defendedArmMeanLoss: number;
    readonly delta: number;
    readonly defendedDelta: number;
    readonly runIds: readonly string[];
  };
  readonly receiptId: string;
}

function prefix(value: MatchedDataExperimentReceipt['evaluations']['triggered']): PrefixEvaluation {
  return {
    prefix: value.input,
    cleanArmProbability: value.arms.clean.probability,
    substitutedArmProbability: value.arms.treatment.probability,
    defendedArmProbability: value.arms.defended.probability,
    delta: value.arms.treatment.probability - value.arms.clean.probability,
    defendedDelta: value.arms.defended.probability - value.arms.clean.probability,
    cleanRunId: value.arms.clean.runId,
    substitutedRunId: value.arms.treatment.runId,
    defendedRunId: value.arms.defended.runId,
    comparison: value.comparisons.treatmentToClean,
    defendedComparison: value.comparisons.defendedToClean,
  };
}

function compatibilityReport(experiment: MatchedDataExperimentReceipt): PoisoningReport {
  const clean = experiment.metrics.observed.cleanTaskMeanLoss;
  return immutableCopy({
    id: experiment.id,
    startingSnapshotId: experiment.source.snapshotId,
    cleanFinalSnapshotId: experiment.arms.clean.finalSnapshotId,
    substitutedFinalSnapshotId: experiment.arms.treatment.finalSnapshotId,
    defendedFinalSnapshotId: experiment.arms.defended.finalSnapshotId,
    design: {
      id: experiment.id,
      schedule: experiment.design.cleanSchedule,
      substitutions: experiment.design.substitutions.map(({ step, original, replacement }) => ({ step, original, replacement } as Substitution)),
      triggeredPrefix: experiment.design.triggeredPrefix,
      controlPrefixes: experiment.design.controlPrefixes,
      desiredToken: experiment.design.desiredToken,
      cleanDocuments: experiment.design.cleanDocuments,
    },
    updatesPerArm: experiment.design.cleanSchedule.length,
    learningExperimentIds: {
      clean: experiment.arms.clean.steps.map(step => step.learningExperimentId),
      substituted: experiment.arms.treatment.steps.map(step => step.learningExperimentId),
      defended: experiment.arms.defended.steps.map(step => step.learningExperimentId),
    },
    triggered: prefix(experiment.evaluations.triggered),
    controls: experiment.evaluations.controls.map(prefix),
    cleanTask: {
      documents: experiment.design.cleanDocuments,
      cleanArmMeanLoss: clean.clean,
      substitutedArmMeanLoss: clean.treatment,
      defendedArmMeanLoss: clean.defended,
      delta: clean.treatment - clean.clean,
      defendedDelta: clean.defended - clean.clean,
      runIds: experiment.evaluations.clean.flatMap(item => [item.arms.clean.runId, item.arms.treatment.runId, item.arms.defended.runId]),
    },
    receiptId: experiment.receiptId,
  });
}

/** Compatibility wrapper around the single registered authoritative computation. */
export async function runPoisoningTrial(snapshot: ArchivedSnapshot, options: PoisoningOptions): Promise<{
  report: PoisoningReport;
  experiment: MatchedDataExperimentReceipt;
  archive: MatchedDataSubstitutionResult['archive'];
}> {
  const result = await dataExperimentRecipes.require(MATCHED_DATA_SUBSTITUTION_RECIPE).execute({ snapshot, design: options }) as MatchedDataSubstitutionResult;
  return { ...result, report: compatibilityReport(result.experiment) };
}
