import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelSession } from "../../app/worker/controller.js";
import { sourceBinding } from "../../app/presentation/source-binding.js";
import { microscopeReadModel } from "../../app/presentation/microscope-read-model.js";
import { qProjectionReadModel } from "../../app/presentation/q-projection-read-model.js";
test("A5 derives four products while Follow Q/K use authentic artifacts; Q bridge has eight row contributors", async () => {
  const session = new ModelSession();
  const tag = { sessionId: "lens-read-model", generationId: 0 };
  await session.handle({ ...tag, runId: "init", command: "initialize" });
  const response = await session.handle({
    ...tag,
    runId: "source",
    command: "predict",
    document: "abca",
  });
  assert.equal(response.status, "result");
  if (response.status !== "result") return;
  const r = response.result,
    source = sourceBinding(
      r.run,
      ["a", "b", "c"],
      0,
      "source",
      "abca",
      "ATTENTION",
    );
  const lens = microscopeReadModel(r.run, source, 0, 1, 3, 1, 2);
  assert.equal(lens.availability, "AVAILABLE");
  assert.equal(lens.products!.length, 4);
  assert.equal(lens.scale, 0.5);
  lens.products!.forEach((value, i) =>
    assert.equal(value, lens.q![i]! * lens.k![i]!),
  );
  assert(Math.abs(lens.scaled! - lens.observedLogit!) < 1e-15);
  assert.equal(lens.qTarget!.kind, "artifact");
  if (lens.qTarget!.kind === "artifact") assert.equal(lens.qTarget!.index, 6);
  if (lens.kTarget!.kind === "artifact") assert.equal(lens.kTarget!.index, 6);
  const projection = qProjectionReadModel(r.run, r.snapshots[0], 0, 1, 2, 3);
  assert.equal(projection.row, 6);
  assert.equal(projection.terms.length, 8);
  assert.deepEqual(
    projection.terms.map((t) => t.parameter.column),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(projection.terms[0]!.parameter.index, 176);
  assert.equal(projection.terms[7]!.parameter.index, 183);
  assert(
    Math.abs(
      projection.terms.reduce((sum, term) => sum + term.product, 0) -
        projection.q!,
    ) < 1e-15,
  );
  assert.equal(
    microscopeReadModel(r.run, source, 0, 0, 3, 4, 0).availability,
    "NOT APPLICABLE",
  );
  assert.equal(
    qProjectionReadModel(r.run, undefined, 0, 0, 0, 3).availability,
    "NOT CAPTURED",
  );
});
