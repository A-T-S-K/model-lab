import type { LearningExperiment } from "../../archive/experiment.js";
import type { ArchivedSnapshot } from "../../archive/session.js";
import type { RecordedRun } from "../../trace/types.js";
import type { ParameterRef } from "../../inspect/types.js";
import type { ParameterUpdate } from "../../model/training.js";
export interface AdamReadModel {
  experimentId: string;
  startingSnapshotId: string;
  resultingSnapshotId: string;
  beforeRunId: string;
  afterRunId: string;
  step: number;
  parameter: ParameterRef;
  availability: "AVAILABLE" | "NOT CAPTURED";
  update?: ParameterUpdate;
  beta1?: number;
  beta2?: number;
  epsilon?: number;
  baseLearningRate?: number;
  numSteps?: number;
  effectiveLearningRate: number;
  q?: number;
  beforeProbability?: number;
  afterProbability?: number;
  publicPosition: number;
}
export function adamReadModel(
  experiment: LearningExperiment,
  start: ArchivedSnapshot | undefined,
  end: ArchivedSnapshot | undefined,
  before: RecordedRun | undefined,
  after: RecordedRun | undefined,
  parameter: ParameterRef,
): AdamReadModel {
  const position = Math.max(0, experiment.objective.inputIds.length - 2),
    target = experiment.objective.targetIds[position]!;
  const update = experiment.update.parameters[parameter.index];
  const bound =
    start?.id === experiment.startingSnapshotId &&
    end?.id === experiment.resultingSnapshotId &&
    update?.name === parameter.name &&
    update.row === parameter.row &&
    update.column === parameter.column;
  const probability = (run: RecordedRun | undefined, id: string) =>
    run?.manifest.runId === id &&
    JSON.stringify(run.manifest.input) ===
      JSON.stringify(experiment.objective.inputIds) &&
    JSON.stringify(run.manifest.targets) ===
      JSON.stringify(experiment.objective.targetIds)
      ? run.artifacts.find(
          (a) =>
            a.kind === "probabilities" &&
            a.concept.token === position &&
            a.availability === "available",
        )?.values?.[target]
      : undefined;
  const model: AdamReadModel = {
    experimentId: experiment.id,
    startingSnapshotId: experiment.startingSnapshotId,
    resultingSnapshotId: experiment.resultingSnapshotId,
    beforeRunId: experiment.beforeRunId,
    afterRunId: experiment.afterRunId,
    step: experiment.update.step,
    parameter,
    availability: "NOT CAPTURED",
    effectiveLearningRate: experiment.update.effectiveLearningRate,
    publicPosition: position,
    beforeProbability: probability(before, experiment.beforeRunId),
    afterProbability: probability(after, experiment.afterRunId),
  };
  if (!bound || !start || !end) return model;
  const optimizer = start.state.optimizer;
  return {
    ...model,
    availability: "AVAILABLE",
    update,
    beta1: optimizer.beta1,
    beta2: optimizer.beta2,
    epsilon: optimizer.epsilon,
    baseLearningRate: optimizer.learningRate,
    numSteps: optimizer.numSteps,
    q:
      (experiment.update.effectiveLearningRate * update.mHat) /
      (Math.sqrt(update.vHat) + optimizer.epsilon),
  };
}
