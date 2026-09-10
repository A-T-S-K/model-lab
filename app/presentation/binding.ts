import type { InspectionTarget } from "../../inspect/types.js";

export interface InspectionSelection {
  runId: string;
  experimentId?: string;
  stage: string;
  token: number;
  layer: number;
  head: number;
  key: number;
  parameter: number;
}
export type EvidenceRelationship = "LIVE" | "STALE" | "HISTORICAL" | "REPLAY";
export interface InspectionBinding {
  sourceRunId: string;
  originalSemanticTarget: InspectionTarget;
  selectionDependencyProjection: string;
  publicationEpoch: number;
  graphPath: readonly number[];
  origin: "OBSERVED" | "DERIVED" | "RECOMPUTED";
  verification: "NONE" | "VERIFYING" | "VERIFIED" | "FAILED";
  availability:
    | "PENDING"
    | "AVAILABLE"
    | "NOT CAPTURED"
    | "UNSUPPORTED"
    | "BUDGET EXCEEDED"
    | "VERIFICATION FAILED";
}

/** A whole-objective parameter gradient does not depend on a query/head viewer. */
export function inspectionDependencies(
  target: InspectionTarget,
  selection: InspectionSelection,
): string {
  const source = [selection.runId, selection.experimentId ?? ""];
  if (target.kind === "gradient")
    return JSON.stringify([...source, selection.parameter]);
  if (target.kind === "whole") return JSON.stringify(source);
  return JSON.stringify([
    ...source,
    selection.stage,
    selection.token,
    selection.layer,
    selection.head,
    selection.key,
  ]);
}
export function bindInspection(
  sourceRunId: string,
  target: InspectionTarget,
  selection: InspectionSelection,
  epoch: number,
): InspectionBinding {
  return {
    sourceRunId,
    originalSemanticTarget: { ...target },
    selectionDependencyProjection: inspectionDependencies(target, selection),
    publicationEpoch: epoch,
    graphPath: [],
    origin: "OBSERVED",
    verification: "NONE",
    availability: "PENDING",
  };
}
export function inspectionIsCurrent(
  binding: InspectionBinding,
  selection: InspectionSelection,
  epoch: number,
): boolean {
  return (
    binding.publicationEpoch === epoch &&
    binding.selectionDependencyProjection ===
      inspectionDependencies(binding.originalSemanticTarget, selection)
  );
}
export function evidenceRelationship(
  sourceRunId: string,
  liveRunId: string,
  capturedDocument: string,
  editorDocument: string,
): EvidenceRelationship {
  if (capturedDocument !== editorDocument) return "STALE";
  return sourceRunId === liveRunId ? "LIVE" : "HISTORICAL";
}
