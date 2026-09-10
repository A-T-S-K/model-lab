import type { RecordedRun, Artifact } from "../../trace/types.js";
import type { ArchivedSnapshot } from "../../archive/session.js";
import type { SourceBinding } from "./source-binding.js";
export type AttentionScope = "SELECTED_PREFIX" | "FULL_RUN";
export interface AttentionCell {
  query: number;
  key: number;
  head: number;
  sourceRunId: string;
  artifactId?: string;
  value?: number;
  availability: "AVAILABLE" | "NOT CAPTURED" | "NOT APPLICABLE";
  origin: "OBSERVED";
}
export interface AttentionReadModel {
  source: SourceBinding;
  layer: number;
  scope: AttentionScope;
  selectedQuery: number;
  extent: number;
  headWidth: number;
  fullRunExtent: number;
  publicPosition: number;
  labels: string[];
  heads: {
    head: number;
    cells: AttentionCell[][];
    scores?: Artifact;
    probabilities?: Artifact;
    output?: Artifact;
    weightedValues?: number[][];
  }[];
  vectors: { label: string; artifact?: Artifact }[];
  parameters: {
    name: string;
    values?: readonly (readonly number[])[];
    sourceSnapshotId?: string;
  }[];
  selected: { query: number; key: number; head: number };
  matrixOrigin: "DERIVED";
}
export function attentionArtifact(
  run: RecordedRun,
  kind: string,
  layer: number,
  token: number,
  head?: number,
): Artifact | undefined {
  return run.artifacts.find(
    (a) =>
      a.kind === kind &&
      a.concept.token === token &&
      (a.concept.layer === undefined || a.concept.layer === layer) &&
      (head === undefined || a.concept.head === head),
  );
}
export function attentionReadModel(
  run: RecordedRun,
  snapshot: ArchivedSnapshot | undefined,
  source: SourceBinding,
  layer: number,
  scope: AttentionScope,
  scopeQuery: number,
  selected: AttentionReadModel["selected"],
): AttentionReadModel {
  const input = run.manifest.input as readonly number[];
  const architecture = run.manifest.model.architecture;
  const vocabulary = architecture.vocabulary as readonly string[];
  const fullRunExtent = input.length;
  const selectedQuery = Math.max(0, Math.min(scopeQuery, fullRunExtent - 1));
  const extent = scope === "FULL_RUN" ? fullRunExtent : selectedQuery + 1;
  const nHead = Number(architecture.nHead),
    width = Number(architecture.nEmbd) / nHead;
  const get = (kind: string, token = selected.query, head?: number) =>
    attentionArtifact(run, kind, layer, token, head);
  const heads = Array.from({ length: nHead }, (_, head) => {
    const probabilities = get("attentionProbabilities", selected.query, head),
      scores = get("attentionLogits", selected.query, head);
    const rows = Array.from({ length: extent }, (_, query) => {
      const artifact = get("attentionProbabilities", query, head);
      return Array.from(
        { length: extent },
        (_, key): AttentionCell => ({
          query,
          key,
          head,
          sourceRunId: source.sourceRunId,
          ...(key <= query ? { artifactId: artifact?.id } : {}),
          origin: "OBSERVED",
          availability:
            key > query
              ? "NOT APPLICABLE"
              : artifact?.availability === "available" &&
                  artifact.values?.[key] !== undefined
                ? "AVAILABLE"
                : "NOT CAPTURED",
          ...(key <= query &&
          artifact?.availability === "available" &&
          artifact.values?.[key] !== undefined
            ? { value: artifact.values[key] }
            : {}),
        }),
      );
    });
    const values = Array.from({ length: selected.query + 1 }, (_, key) =>
      get("v", key),
    );
    const weightedValues =
      probabilities?.availability === "available" &&
      values.every(
        (v) =>
          v?.availability === "available" &&
          v.values?.length === Number(architecture.nEmbd),
      )
        ? values.map((v, key) =>
            v!
              .values!.slice(head * width, (head + 1) * width)
              .map((value) => value * probabilities.values![key]!),
          )
        : undefined;
    return {
      head,
      cells: rows,
      scores,
      probabilities,
      output: get("headOutput", selected.query, head),
      weightedValues,
    };
  });
  const compatible =
    !!snapshot && snapshot.id === run.manifest.startingSnapshotId;
  return {
    source,
    layer,
    scope,
    selectedQuery,
    extent,
    headWidth: width,
    fullRunExtent,
    publicPosition: Math.max(0, input.length - 2),
    labels: input.map((id, index) => `${index} · ${vocabulary[id] ?? "START"}`),
    heads,
    selected,
    matrixOrigin: "DERIVED",
    vectors: [
      ["Block input / saved residual", "embeddingNorm"],
      ["Pre-attention norm", "preAttentionNorm"],
      ["Q[8]", "q"],
      [`K at key ${selected.key}[8]`, "k"],
      [`V at key ${selected.key}[8]`, "v"],
      ["Concatenated heads[8]", "attentionOutput"],
      ["WO projection[8]", "attentionProjection"],
      ["Residual output[8]", "attentionResidual"],
    ].map(([label, kind]) => ({
      label: label!,
      artifact: get(
        kind!,
        kind === "k" || kind === "v" ? selected.key : selected.query,
      ),
    })),
    parameters: ["attn_wq", "attn_wk", "attn_wv", "attn_wo"].map((name) => ({
      name: `layer${layer}.${name}`,
      sourceSnapshotId: snapshot?.id,
      values:
        compatible && snapshot
          ? snapshot.state.parameters[`layer${layer}.${name}`]
          : undefined,
    })),
  };
}
