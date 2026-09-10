import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelSession } from "../../app/worker/controller.js";
import {
  bindAttractReplay,
  compatibleReplay,
} from "../../app/presentation/attract-replay.js";
import {
  guidedReadModel,
  startGuidedBatch,
} from "../../app/presentation/guided-read-model.js";
test("real replay binding is immutable, identity-compatible, separate from visitor LIVE, and batch is count-only", async () => {
  const session = new ModelSession();
  const tag = { sessionId: "read-model-test", generationId: 0 };
  await session.handle({ ...tag, runId: "init", command: "initialize" });
  const response = await session.handle({
    ...tag,
    runId: "replay",
    command: "predict",
    document: "abca",
  });
  assert.equal(response.status, "result");
  if (response.status !== "result") return;
  const replay = bindAttractReplay(response.result);
  assert(Object.isFrozen(replay.result.run));
  assert(
    compatibleReplay(
      replay,
      replay.canonicalSnapshotId,
      replay.runtimeRevision,
    ),
  );
  assert(!compatibleReplay(replay, "other", replay.runtimeRevision));
  const model = guidedReadModel(
    replay.result,
    undefined,
    ["a", "b", "c"],
    "abca",
    "",
    false,
    true,
    true,
  );
  assert.equal(model.source?.relationship, "REPLAY");
  assert.equal(model.canTeach, false);
  assert.equal(model.probability, 0.3591443770854818);
  const batch = startGuidedBatch(response.result, ["a", "b", "c"]);
  assert.equal(batch.completedCount, 0);
  assert.equal(batch.publicPosition, 3);
  assert.equal(batch.baselineRunId, "replay");
  const training = guidedReadModel(
    response.result,
    undefined,
    ["a", "b", "c"],
    "abca",
    "replay",
    true,
    true,
    false,
    batch,
  );
  assert.equal(training.frame, "TEACH");
  assert.equal(training.comparison, undefined);
});

test("missing probability evidence stays unavailable and cannot seed a teaching comparison", async () => {
  const session = new ModelSession();
  const tag = { sessionId: "missing-guided-evidence", generationId: 0 };
  await session.handle({ ...tag, runId: "init", command: "initialize" });
  const response = await session.handle({
    ...tag,
    runId: "source",
    command: "predict",
    document: "abca",
  });
  assert.equal(response.status, "result");
  if (response.status !== "result") return;
  const missing = {
    ...response.result,
    run: {
      ...response.result.run,
      artifacts: response.result.run.artifacts.filter(
        (artifact) => artifact.kind !== "probabilities",
      ),
    },
  };
  const model = guidedReadModel(
    missing,
    undefined,
    ["a", "b", "c"],
    "abca",
    "source",
    false,
    true,
    false,
  );
  assert.equal(model.probability, undefined);
  assert.equal(model.source?.availability, "NOT CAPTURED");
  assert.equal(model.canTeach, false);
});
