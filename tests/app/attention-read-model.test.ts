import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelSession } from "../../app/worker/controller.js";
import { attentionReadModel } from "../../app/presentation/attention-read-model.js";
import { sourceBinding } from "../../app/presentation/source-binding.js";
test("Attention extent, mask, observed rows and parameter snapshots follow the immutable selected source", async () => {
  const session = new ModelSession();
  const tag = { sessionId: "attention-read-model", generationId: 0 };
  await session.handle({ ...tag, runId: "init", command: "initialize" });
  const first = await session.handle({
    ...tag,
    runId: "before",
    command: "predict",
    document: "abca",
  });
  assert.equal(first.status, "result");
  if (first.status !== "result") return;
  const trained = await session.handle({
    ...tag,
    runId: "after",
    command: "train",
    document: "abca",
  });
  assert.equal(trained.status, "result");
  if (trained.status !== "result") return;
  const source = sourceBinding(
    first.result.run,
    ["a", "b", "c"],
    0,
    "after",
    "abca",
    "ATTENTION EXPLORE",
  );
  const prefix = attentionReadModel(
    first.result.run,
    first.result.snapshots[0],
    source,
    0,
    "SELECTED_PREFIX",
    3,
    { query: 3, key: 0, head: 0 },
  );
  assert.equal(prefix.extent, 4);
  assert.equal(prefix.fullRunExtent, 5);
  assert.equal(prefix.source.relationship, "HISTORICAL");
  assert.equal(prefix.heads.length, 2);
  assert.equal(prefix.matrixOrigin, "DERIVED");
  for (const head of prefix.heads) {
    assert.equal(head.cells.length, 4);
    assert.equal(
      head.cells.flat().filter((cell) => cell.availability === "NOT APPLICABLE")
        .length,
      6,
    );
    for (const cell of head.cells.flat())
      if (cell.key > cell.query) assert.equal(cell.value, undefined);
    assert.equal(head.cells[0]![0]!.value, 1);
  }
  const full = attentionReadModel(
    first.result.run,
    first.result.snapshots[0],
    source,
    0,
    "FULL_RUN",
    3,
    { query: 3, key: 0, head: 0 },
  );
  assert.equal(full.extent, 5);
  assert.equal(full.publicPosition, 3);
  assert.equal(full.labels[4], "4 · a");
  assert.deepEqual(
    prefix.parameters[0]!.values,
    first.result.snapshots[0]!.state.parameters["layer0.attn_wq"],
  );
  const wrong = attentionReadModel(
    first.result.run,
    trained.result.snapshots[1],
    source,
    0,
    "SELECTED_PREFIX",
    3,
    { query: 3, key: 0, head: 0 },
  );
  assert.equal(wrong.parameters[0]!.values, undefined);
  const observed = first.result.run.artifacts.find(
    (a) =>
      a.kind === "attentionProbabilities" &&
      a.concept.token === 3 &&
      a.concept.head === 0,
  )!;
  assert.equal(prefix.heads[0]!.cells[3]![0]!.value, observed.values![0]);
});
