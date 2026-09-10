import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelSession } from "../../app/worker/controller.js";
import { historyComparisonReadModel } from "../../app/presentation/history-read-model.js";
test("comparison carries two source identities, explicit direction, shared domains and unavailable refusal", async () => {
  const session = new ModelSession();
  const tag = { sessionId: "history-read-model", generationId: 0 };
  await session.handle({ ...tag, runId: "init", command: "initialize" });
  const response = await session.handle({
    ...tag,
    runId: "update",
    command: "train",
    document: "abca",
  });
  assert.equal(response.status, "result");
  if (response.status !== "result") return;
  const before = response.result.runs[0]!,
    after = response.result.run;
  const probability = after.artifacts.find(
    (a) => a.kind === "probabilities" && a.concept.token === 3,
  )!;
  const comparison = historyComparisonReadModel(after, before, probability.id);
  assert.equal(comparison.selectedRunId, after.manifest.runId);
  assert.equal(comparison.comparisonRunId, before.manifest.runId);
  assert.equal(comparison.direction, "selected − comparison");
  assert.deepEqual(comparison.domain, [0, 1]);
  assert.equal(
    comparison.deltas![0],
    comparison.selected![0]! - comparison.comparison![0]!,
  );
  const q = after.artifacts.find(
    (a) => a.kind === "q" && a.concept.token === 3,
  )!;
  const signed = historyComparisonReadModel(after, before, q.id);
  assert.equal(signed.domain![0], -signed.domain![1]);
  assert(signed.selected!.every((v) => Math.abs(v) <= signed.domain![1]));
  assert(signed.comparison!.every((v) => Math.abs(v) <= signed.domain![1]));
  const incompatible = historyComparisonReadModel(
    { ...after, manifest: { ...after.manifest, runtimeRevision: "other" } },
    before,
    probability.id,
  );
  assert.equal(incompatible.compatible, false);
  assert.equal(incompatible.deltas, undefined);
  const missing = historyComparisonReadModel(
    {
      ...after,
      artifacts: after.artifacts.map((a) =>
        a.id === probability.id
          ? { ...a, values: null, availability: "not_captured" as const }
          : a,
      ),
    },
    before,
    probability.id,
  );
  assert.equal(missing.domain, undefined);
  assert.equal(missing.selected, undefined);
});
