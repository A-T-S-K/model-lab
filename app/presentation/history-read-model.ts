import type { RecordedRun } from "../../trace/types.js";
import { compareRuns } from "../../trace/compare.js";
export interface HistoryComparisonReadModel {
  selectedRunId: string;
  comparisonRunId: string;
  direction: "selected − comparison";
  compatible: boolean;
  reason?: string;
  selected?: readonly number[];
  comparison?: readonly number[];
  deltas?: readonly number[];
  domain?: readonly [number, number];
  origin: "DERIVED";
}
export function historyComparisonReadModel(
  selected: RecordedRun,
  comparison: RecordedRun,
  artifactId: string | undefined,
): HistoryComparisonReadModel {
  const result = compareRuns(comparison, selected),
    pair = result.artifacts.find((pair) => pair.after?.id === artifactId);
  const base: HistoryComparisonReadModel = {
    selectedRunId: selected.manifest.runId,
    comparisonRunId: comparison.manifest.runId,
    direction: "selected − comparison",
    compatible: result.compatible,
    origin: "DERIVED",
  };
  if (!result.compatible) return { ...base, reason: result.reasons.join(", ") };
  if (!pair?.deltas || !pair.before?.values || !pair.after?.values)
    return {
      ...base,
      reason:
        pair?.reason ?? "Selected evidence is unavailable in this comparison.",
    };
  const magnitude = Math.max(
    ...pair.before.values.map(Math.abs),
    ...pair.after.values.map(Math.abs),
  );
  return {
    ...base,
    selected: pair.after.values,
    comparison: pair.before.values,
    deltas: pair.deltas,
    domain:
      pair.after.kind === "probabilities" ||
      pair.after.kind === "attentionProbabilities"
        ? [0, 1]
        : [-(magnitude || 1), magnitude || 1],
  };
}
