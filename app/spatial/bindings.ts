import { forwardReadModel } from "./forward.js";
import type { RecordedRun } from "../../trace/types.js";
import type { ArchivedSnapshot } from "../../archive/session.js";
import { attentionArtifact } from "../presentation/attention-read-model.js";
import { microscopeReadModel } from "../presentation/microscope-read-model.js";
import { qProjectionReadModel } from "../presentation/q-projection-read-model.js";
import type { SourceBinding } from "../presentation/source-binding.js";
import { qkGeometry } from "./geometry.js";

/** Semantic selection deliberately contains no execution or scalar IDs. */
export interface SpatialSelection { query: number; key: number; head: number; feature: number }
export function spatialReadModel(run: RecordedRun, snapshot: ArchivedSnapshot | undefined, source: SourceBinding, selection: SpatialSelection) {
  const architecture = run.manifest.model.architecture;
  const width = Number(architecture.nEmbd) / Number(architecture.nHead);
  const input = run.manifest.input as readonly number[];
  const vocabulary = architecture.vocabulary as readonly string[];
  const valid = [selection.query, selection.key].every(i => Number.isInteger(i) && i >= 0 && i < input.length) &&
    Number.isInteger(selection.head) && selection.head >= 0 && selection.head < Number(architecture.nHead) &&
    Number.isInteger(selection.feature) && selection.feature >= 0 && selection.feature < width;
  const get = (kind: string, token = selection.query, head?: number) => attentionArtifact(run, kind, 0, token, head);
  const lens = valid ? microscopeReadModel(run, source, 0, selection.head, selection.query, selection.key, selection.feature) : undefined;
  return {
    forward: forwardReadModel(run, snapshot),
    source, runtime: run.manifest.runtimeRevision, selection, valid, width,
    labels: input.map((id, i) => `${i} · ${vocabulary[id] ?? "START"}`),
    preAttention: valid ? get("preAttentionNorm") : undefined,
    q: valid ? get("q") : undefined, k: valid ? get("k", selection.key) : undefined,
    heads: Array.from({length: Number(architecture.nHead)}, (_, head) => ({head,
      q: valid && get("q")?.availability === "available" ? get("q")?.values?.slice(head * width, (head + 1) * width) : undefined,
      k: valid && get("k", selection.key)?.availability === "available" ? get("k", selection.key)?.values?.slice(head * width, (head + 1) * width) : undefined,
      scores: valid ? get("attentionLogits", selection.query, head) : undefined,
      weights: valid ? get("attentionProbabilities", selection.query, head) : undefined,
    })),
    lens,
    geometry: lens?.q && lens.k ? qkGeometry(lens.q, lens.k) : undefined,
    projection: valid ? qProjectionReadModel(run, snapshot, 0, selection.head, selection.feature, selection.query) : undefined,
  };
}
export type SpatialReadModel = ReturnType<typeof spatialReadModel>;
