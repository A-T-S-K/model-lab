import assert from "node:assert/strict";
import test from "node:test";
import {
  detailView,
  number,
  probabilityView,
  vectorView,
} from "../../app/views/evidence.js";
import type { Artifact } from "../../trace/types.js";

test("unavailable display values are explicit and observed zero remains numerical", () => {
  assert.equal(number(null), "unavailable");
  assert.equal(number(undefined), "unavailable");
  assert.equal(number(0), "0.000000");
  assert.match(probabilityView(null, ["a"]), /not captured/);
  assert.doesNotMatch(probabilityView(null, ["a"]), /0%/);
  const artifact: Artifact = {
    id: "test",
    concept: { kind: "q" },
    kind: "q",
    shape: [1],
    axes: ["feature"],
    dtype: "float64",
    values: null,
    provenance: "observed",
    availability: "budget_exceeded",
    captureLevel: "semantic",
  };
  assert.match(vectorView(artifact), /BUDGET EXCEEDED/);
  assert.doesNotMatch(vectorView(artifact), /0\.0000/);
});

test("future attention display states the computation does not exist", () => {
  const html = detailView({
    provenance: "derived",
    availability: "not_applicable",
    q: [],
    k: [],
    products: [],
    sum: null,
    scale: null,
    scaled: null,
    observedLogit: null,
    probability: null,
    logits: [],
    sourceRunId: "test",
  });
  assert.match(html, /Future keys are masked/);
  assert.doesNotMatch(html, /0\.000000/);
});

test("derived scalar view displays each captured multiplication and softmax connection", () => {
  const html = detailView({
    provenance: "derived",
    availability: "available",
    q: [2, 3],
    k: [4, 5],
    products: [8, 15],
    sum: 23,
    scale: 1 / Math.sqrt(2),
    scaled: 23 / Math.sqrt(2),
    observedLogit: 23 / Math.sqrt(2),
    probability: 0.75,
    logits: [1, 23 / Math.sqrt(2)],
    sourceRunId: "test",
  });
  assert.match(html, /DERIVED FROM OBSERVED EVIDENCE/);
  assert.match(html, /8\.000000/);
  assert.match(html, /15\.000000/);
  assert.match(html, /sum\(Q × K\) ≈ 23\.000000/);
  assert.match(html, /softmax\(all 2 available key logits\)/);
  assert.match(html, /0\.750000/);
});
