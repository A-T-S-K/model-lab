import type { RunResult } from "../worker/protocol.js";
import type { GuidedLearning } from "../views/guided.js";
import { sourceBinding, type SourceBinding } from "./source-binding.js";
export interface GuidedBatch {
  baselineRunId: string;
  publicPosition: number;
  target: number;
  capturedDocument: string;
  startingStep: number;
  requestedCount: number;
  completedCount: number;
  baselineDistribution: readonly number[];
  latestAfterRunId?: string;
  status: "RUNNING" | "COMPLETE" | "CANCELLED" | "STOPPED";
}
export interface GuidedReadModel {
  source?: SourceBinding;
  prefix: string;
  target: string;
  targetIndex: number;
  position: number;
  values?: readonly number[];
  probability?: number;
  canTeach: boolean;
  frame: "A1" | "A2" | "TEACH" | "A3";
  batch?: GuidedBatch;
  comparison?: GuidedLearning;
  earlierComparison: boolean;
}
export function startGuidedBatch(
  result: RunResult,
  vocabulary: readonly string[],
): GuidedBatch {
  const position = Math.max(0, result.tokenIds.length - 2);
  return {
    baselineRunId: result.run.manifest.runId,
    publicPosition: position,
    target: result.targetIds[position]!,
    capturedDocument: result.tokenIds
      .slice(1)
      .map((id) => vocabulary[id])
      .join(""),
    startingStep: result.trainingStep,
    requestedCount: 10,
    completedCount: 0,
    baselineDistribution: [...result.probabilities[position]!],
    status: "RUNNING",
  };
}
export function guidedReadModel(
  result: RunResult | undefined,
  learning: GuidedLearning | undefined,
  vocabulary: readonly string[],
  editor: string,
  liveRunId: string,
  busy: boolean,
  ready: boolean,
  replay: boolean,
  batch?: GuidedBatch,
  pendingCommand?: "predict" | "train",
): GuidedReadModel {
  const position = result ? Math.max(0, result.tokenIds.length - 2) : 0;
  const targetIndex = result?.targetIds[position] ?? 0;
  const source =
    result &&
    sourceBinding(
      result.run,
      vocabulary,
      result.trainingStep,
      liveRunId,
      editor,
      batch?.status === "RUNNING"
        ? "TEACHING"
        : pendingCommand
          ? pendingCommand === "predict"
            ? "PREDICTING"
            : "LEARNING"
          : batch?.status === "CANCELLED" || batch?.status === "STOPPED"
            ? batch.status
            : learning
              ? "TEACH COMPLETE"
              : "RESULT AVAILABLE",
      replay,
    );
  const teaching = batch?.status === "RUNNING";
  const values = teaching
    ? batch.baselineDistribution
    : (result?.run.artifacts.find(
        (a) =>
          a.kind === "probabilities" &&
          a.concept.token === position &&
          a.availability === "available",
      )?.values ?? undefined);
  if (source && !values)
    source.availability = pendingCommand ? "PENDING" : "NOT CAPTURED";
  const earlierComparison =
    !!learning &&
    (learning.afterRunId !== result?.run.manifest.runId ||
      learning.document !== editor ||
      learning.afterRunId !== liveRunId);
  return {
    source,
    prefix: source?.capturedDocument.slice(0, position) || "∅",
    target: vocabulary[targetIndex] ?? "START / END",
    targetIndex,
    position,
    values,
    probability: values?.[targetIndex],
    canTeach:
      !!source &&
      !!values &&
      source.relationship === "LIVE" &&
      /^[abc]{2,7}$/.test(editor) &&
      !busy &&
      ready,
    frame: replay ? "A1" : teaching ? "TEACH" : learning ? "A3" : "A2",
    batch,
    comparison: teaching ? undefined : learning,
    earlierComparison,
  };
}
