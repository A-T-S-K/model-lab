import type { RecordedRun } from "../../trace/types.js";
import { evidenceRelationship, type EvidenceRelationship } from "./binding.js";
export interface SourceBinding {
  sourceRunId: string;
  sourceSnapshotId?: string;
  sourceStep?: number;
  capturedDocument: string;
  origin: "OBSERVED" | "DERIVED" | "RECOMPUTED";
  verification: "NONE" | "VERIFYING" | "VERIFIED" | "FAILED";
  relationship: EvidenceRelationship;
  phase: string;
  availability: string;
}
export function sourceBinding(
  run: RecordedRun,
  vocabulary: readonly string[],
  sourceStep: number | undefined,
  liveRunId: string,
  editor: string,
  phase: string,
  replay = false,
): SourceBinding {
  const capturedDocument = (run.manifest.input as readonly number[])
    .slice(1)
    .map((id) => vocabulary[id] ?? "")
    .join("");
  return {
    sourceRunId: run.manifest.runId,
    sourceSnapshotId: run.manifest.startingSnapshotId,
    sourceStep,
    capturedDocument,
    origin: "OBSERVED",
    verification: "NONE",
    relationship: replay
      ? "REPLAY"
      : evidenceRelationship(
          run.manifest.runId,
          liveRunId,
          capturedDocument,
          editor,
        ),
    phase,
    availability: "AVAILABLE",
  };
}
