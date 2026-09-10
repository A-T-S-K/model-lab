import type { LearningExperiment } from "../../archive/experiment.js";
import type { RecordedRun } from "../../trace/types.js";
import type {
  InspectionResult,
  ParameterRef,
  ScalarEdge,
} from "../../inspect/types.js";
export interface BackwardReadModel {
  experimentId: string;
  trainingRunId: string;
  startingSnapshotId: string;
  step: number;
  parameter: ParameterRef;
  parameterBefore?: number;
  gradient?: number;
  meanLoss?: number;
  positions: {
    position: number;
    prefix: string;
    target: string;
    loss?: number;
    public: boolean;
  }[];
  graphOrigin: "OBSERVED" | "RECOMPUTED";
  graphVerification: "NONE" | "VERIFIED" | "VERIFYING" | "FAILED";
  fanInAvailable: boolean;
  contributions: readonly ScalarEdge[];
  visible: readonly ScalarEdge[];
  hiddenCount: number;
  hiddenSubtotal?: number;
  sum?: number;
  graphGradient?: number;
}
export function backwardReadModel(
  experiment: LearningExperiment,
  training: RecordedRun,
  parameter: ParameterRef,
  inspection: InspectionResult | undefined,
  limit = 8,
  pending = false,
): BackwardReadModel {
  const vocabulary = training.manifest.model.architecture
    .vocabulary as readonly string[];
  const observed = (kind: string, token?: number) =>
    training.artifacts.find(
      (a) =>
        a.kind === kind &&
        (token === undefined || a.concept.token === token) &&
        a.availability === "available",
    )?.values;
  const update = experiment.update.parameters[parameter.index];
  const matching =
    training.manifest.runId === experiment.trainingRunId &&
    update?.name === parameter.name &&
    update.row === parameter.row &&
    update.column === parameter.column;
  const accepted =
    inspection?.sourceRunId === experiment.trainingRunId &&
    inspection.availability === "available" &&
    (inspection.provenance !== "recomputed" ||
      inspection.verification?.verified);
  const graph = accepted ? inspection.graph : undefined;
  const node = graph?.nodes.find(
    (n) => n.parameter?.index === parameter.index && graph.roots.includes(n.id),
  );
  const contributions = node
    ? graph!.edges.filter((edge) => edge.parent === node.id)
    : [];
  const fanInAvailable =
    !!node &&
    node.gradient !== undefined &&
    contributions.every(
      (edge) =>
        edge.childAdjoint !== undefined && edge.contribution !== undefined,
    );
  const visible = contributions.slice(0, Math.max(0, limit)),
    hidden = contributions.slice(visible.length);
  return {
    experimentId: experiment.id,
    trainingRunId: experiment.trainingRunId,
    startingSnapshotId: experiment.startingSnapshotId,
    step: experiment.update.step,
    parameter,
    parameterBefore: matching ? update.before : undefined,
    gradient: matching ? observed("gradient")?.[parameter.index] : undefined,
    meanLoss: matching ? observed("meanLoss")?.[0] : undefined,
    positions: experiment.objective.inputIds.map((_, position) => ({
      position,
      prefix:
        position === 0
          ? "START"
          : experiment.objective.inputIds
              .slice(1, position + 1)
              .map((id) => vocabulary[id] ?? "START")
              .join(""),
      target: vocabulary[experiment.objective.targetIds[position]!] ?? "END",
      loss: matching ? observed("loss", position)?.[0] : undefined,
      public:
        position === Math.max(0, experiment.objective.inputIds.length - 2),
    })),
    graphOrigin:
      pending || inspection?.provenance === "recomputed"
        ? "RECOMPUTED"
        : "OBSERVED",
    graphVerification: pending
      ? "VERIFYING"
      : inspection?.verification?.verified
        ? "VERIFIED"
        : inspection?.verification
          ? "FAILED"
          : "NONE",
    fanInAvailable,
    contributions,
    visible,
    hiddenCount: hidden.length,
    hiddenSubtotal:
      fanInAvailable && hidden.length
        ? hidden.reduce((sum, edge) => sum + edge.contribution!, 0)
        : undefined,
    sum: fanInAvailable
      ? contributions.reduce((sum, edge) => sum + edge.contribution!, 0)
      : undefined,
    graphGradient: node?.gradient,
  };
}
