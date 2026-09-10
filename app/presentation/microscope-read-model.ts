import type { RecordedRun } from "../../trace/types.js";
import type { InspectionTarget } from "../../inspect/types.js";
import type { SourceBinding } from "./source-binding.js";
import { attentionArtifact } from "./attention-read-model.js";
export interface AttentionMicroscopeReadModel {
  source: SourceBinding;
  layer: number;
  head: number;
  query: number;
  key: number;
  feature: number;
  rootIdentity: string;
  availability: "AVAILABLE" | "NOT CAPTURED" | "NOT APPLICABLE";
  q?: readonly number[];
  k?: readonly number[];
  products?: readonly number[];
  sum?: number;
  scale?: number;
  scaled?: number;
  observedLogit?: number;
  observedProbability?: number;
  logits?: readonly number[];
  probabilities?: readonly number[];
  qTarget?: InspectionTarget;
  kTarget?: InspectionTarget;
  exactLogitMatch: boolean;
}
export function microscopeReadModel(
  run: RecordedRun,
  source: SourceBinding,
  layer: number,
  head: number,
  query: number,
  key: number,
  feature: number,
): AttentionMicroscopeReadModel {
  const width =
    Number(run.manifest.model.architecture.nEmbd) /
    Number(run.manifest.model.architecture.nHead);
  const model: AttentionMicroscopeReadModel = {
    source,
    layer,
    head,
    query,
    key,
    feature,
    rootIdentity: `${source.sourceRunId}/L${layer}/H${head}/q${query}/k${key}`,
    availability: "NOT CAPTURED",
    exactLogitMatch: false,
  };
  if (key > query) {
    model.availability = "NOT APPLICABLE";
    return model;
  }
  const q = attentionArtifact(run, "q", layer, query),
    k = attentionArtifact(run, "k", layer, key);
  const logits = attentionArtifact(run, "attentionLogits", layer, query, head),
    probabilities = attentionArtifact(
      run,
      "attentionProbabilities",
      layer,
      query,
      head,
    );
  if (
    ![q, k, logits, probabilities].every(
      (a) => a?.availability === "available" && a.values,
    ) ||
    !Number.isInteger(feature) ||
    feature < 0 ||
    feature >= width
  )
    return model;
  const qHead = q!.values!.slice(head * width, (head + 1) * width),
    kHead = k!.values!.slice(head * width, (head + 1) * width);
  if (
    qHead.length !== width ||
    kHead.length !== width ||
    logits!.values![key] === undefined ||
    probabilities!.values![key] === undefined
  )
    return model;
  const products = qHead.map((value, i) => value * kHead[i]!);
  const sum = products.reduce((a, b) => a + b, 0),
    scale = 1 / Math.sqrt(width),
    scaled = sum * scale;
  return {
    ...model,
    availability: "AVAILABLE",
    q: qHead,
    k: kHead,
    products,
    sum,
    scale,
    scaled,
    logits: logits!.values!,
    probabilities: probabilities!.values!,
    observedLogit: logits!.values![key],
    observedProbability: probabilities!.values![key],
    qTarget: {
      kind: "artifact",
      artifactId: q!.id,
      index: head * width + feature,
    },
    kTarget: {
      kind: "artifact",
      artifactId: k!.id,
      index: head * width + feature,
    },
    exactLogitMatch: Object.is(scaled, logits!.values![key]),
  };
}
