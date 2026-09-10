import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bindInspection,
  inspectionIsCurrent,
  evidenceRelationship,
  type InspectionSelection,
} from "../../app/presentation/binding.js";
const selection: InspectionSelection = {
  runId: "after-1",
  experimentId: "transition-1",
  stage: "q",
  token: 3,
  layer: 0,
  head: 0,
  key: 0,
  parameter: 128,
};
test("STATE-SELECT-001: semantic scalar selectors and source changes invalidate the bound target", () => {
  const binding = bindInspection(
    "before-1",
    { kind: "artifact", artifactId: "q3", index: 0 },
    selection,
    7,
  );
  for (const change of [
    { stage: "k" },
    { token: 2 },
    { layer: 1 },
    { head: 1 },
    { key: 2 },
    { runId: "after-2" },
    { experimentId: "transition-2" },
  ])
    assert.equal(
      inspectionIsCurrent(binding, { ...selection, ...change }, 7),
      false,
    );
  assert.equal(
    inspectionIsCurrent(binding, { ...selection, parameter: 129 }, 7),
    true,
  );
});
test("STATE-INSPECT-001: whole-objective gradients ignore irrelevant token/head/key but follow parameter identity", () => {
  const binding = bindInspection(
    "training-1",
    { kind: "gradient", parameterIndex: 128 },
    selection,
    7,
  );
  assert(
    inspectionIsCurrent(
      binding,
      { ...selection, head: 1, key: 1, token: 1 },
      7,
    ),
  );
  assert(!inspectionIsCurrent(binding, { ...selection, parameter: 129 }, 7));
  assert(!inspectionIsCurrent(binding, selection, 8));
});
test("STATE-PROVENANCE-001: observed does not imply live; stale and history are separate relationships", () => {
  assert.equal(
    evidenceRelationship("training-1", "after-1", "abca", "abca"),
    "HISTORICAL",
  );
  assert.equal(
    evidenceRelationship("after-1", "after-1", "abca", "abca"),
    "LIVE",
  );
  assert.equal(
    evidenceRelationship("after-1", "after-1", "abca", "abc"),
    "STALE",
  );
});
