import type { RecordedRun } from "../../trace/types.js";
import type { ArchivedSnapshot } from "../../archive/session.js";
import type { ParameterRef } from "../../inspect/types.js";
import { attentionArtifact } from "./attention-read-model.js";
export interface QProjectionReadModel {
  sourceRunId: string;
  sourceSnapshotId?: string;
  layer: number;
  head: number;
  feature: number;
  row: number;
  query: number;
  availability: "AVAILABLE" | "NOT CAPTURED";
  q?: number;
  terms: {
    parameter: ParameterRef;
    weight: number;
    input: number;
    product: number;
  }[];
}
export function qProjectionReadModel(
  run: RecordedRun,
  snapshot: ArchivedSnapshot | undefined,
  layer: number,
  head: number,
  feature: number,
  query: number,
): QProjectionReadModel {
  const width =
      Number(run.manifest.model.architecture.nEmbd) /
      Number(run.manifest.model.architecture.nHead),
    row = head * width + feature;
  const model: QProjectionReadModel = {
    sourceRunId: run.manifest.runId,
    sourceSnapshotId: run.manifest.startingSnapshotId,
    layer,
    head,
    feature,
    row,
    query,
    availability: "NOT CAPTURED",
    terms: [],
  };
  if (!snapshot || snapshot.id !== run.manifest.startingSnapshotId)
    return model;
  const name = `layer${layer}.attn_wq`,
    matrix = snapshot.state.parameters[name];
  const input = attentionArtifact(run, "preAttentionNorm", layer, query),
    q = attentionArtifact(run, "q", layer, query);
  if (
    !matrix?.[row] ||
    input?.availability !== "available" ||
    !input.values ||
    input.values.length !== matrix[row]!.length ||
    q?.availability !== "available" ||
    q.values?.[row] === undefined
  )
    return model;
  let offset = 0;
  for (const key of snapshot.state.parameterOrder) {
    if (key === name) break;
    offset += snapshot.state.parameters[key]!.reduce(
      (count, values) => count + values.length,
      0,
    );
  }
  return {
    ...model,
    availability: "AVAILABLE",
    q: q.values[row],
    terms: matrix[row]!.map((weight, column) => ({
      parameter: {
        index: offset + row * matrix[row]!.length + column,
        name,
        row,
        column,
      },
      weight,
      input: input.values![column]!,
      product: weight * input.values![column]!,
    })),
  };
}
