import { immutableCopy } from "../../trace/types.js";
import type { RunResult } from "../worker/protocol.js";
export interface AttractReplayBinding {
  readonly result: RunResult;
  readonly sourceRunId: string;
  readonly canonicalSnapshotId: string;
  readonly runtimeRevision: string;
}
/** A retained real execution, separate from visitor result/history authority. */
export function bindAttractReplay(result: RunResult): AttractReplayBinding {
  if (
    result.trainingStep !== 0 ||
    result.learn ||
    !result.run.manifest.startingSnapshotId
  )
    throw new Error("Attract requires a canonical initial Predict");
  return immutableCopy({
    result,
    sourceRunId: result.run.manifest.runId,
    canonicalSnapshotId: result.run.manifest.startingSnapshotId,
    runtimeRevision: result.run.manifest.runtimeRevision,
  });
}
export function compatibleReplay(
  binding: AttractReplayBinding | undefined,
  snapshotId: string,
  runtimeRevision: string,
): boolean {
  return (
    !!binding &&
    binding.canonicalSnapshotId === snapshotId &&
    binding.runtimeRevision === runtimeRevision
  );
}
