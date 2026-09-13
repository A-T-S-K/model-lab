import { test } from "node:test";
import assert from "node:assert/strict";
import { qkGeometry } from "../../app/spatial/geometry.js";
import { spatialReadModel } from "../../app/spatial/bindings.js";
import { ModelSession } from "../../app/worker/controller.js";
import { sourceBinding } from "../../app/presentation/source-binding.js";

test("A04 exact full-vector span preserves norms and dot under one screen scale, including zero and collinear", () => {
  for (const [q, k] of [
    [[1, 2, -3, 4], [-2, 3, 5, 1]], [[0, 0], [2, -3]], [[0, 0], [0, 0]],
    [[1, 2], [0, 0]], [[1, 2], [2, 4]], [[1, 2], [-2, -4]], [[1e-9, 2e-9], [2e-9, 4e-9]],
  ]) {
    const g = qkGeometry(q, k);
    const close = (a: number, b: number) => assert(Math.abs(a - b) <= 1e-14 * Math.max(Math.abs(a), Math.abs(b), 1e-30), `${a} != ${b}`);
    close(Math.hypot(...g.q), Math.hypot(...q));
    close(Math.hypot(...g.k), Math.hypot(...k));
    close(g.q[0] * g.k[0] + g.q[1] * g.k[1], q.reduce((sum, x, i) => sum + x * k[i], 0));
    close(Math.hypot(g.q[0] * g.scale, g.q[1] * g.scale) / g.scale, Math.hypot(...q));
    if (!g.qNorm || !g.kNorm) assert.equal(g.angle, undefined);
  }
  assert.throws(() => qkGeometry([1], [1, 2]));
  assert.throws(() => qkGeometry([NaN], [1]));
});

test("A01–A05 spatial evidence follows actual runs, complete head slices, causal absence and checkpoint rows", async () => {
  const session = new ModelSession();
  const tag = {sessionId: "spatial", generationId: 0};
  await session.handle({...tag, runId: "init", command: "initialize"});
  const outputs: number[] = [];
  for (const document of ["abca", "abcb"]) {
    const response = await session.handle({...tag, runId: document, command: "predict", document});
    assert.equal(response.status, "result");
    if (response.status !== "result") return;
    const r = response.result;
    const source = sourceBinding(r.run, ["a", "b", "c"], 0, document, document, "SPATIAL");
    for (const head of [0, 1]) for (const query of [2, 4]) for (const key of [0, 2, 4]) {
      const m = spatialReadModel(r.run, r.snapshots[0], source, {query, key, head, feature: 2});
      assert.equal(m.source.sourceRunId, document);
      assert.equal(m.heads.length, 2);
      assert.equal(m.projection?.terms.length, 8);
      const p = m.projection!;
      assert.equal(p.row, head * 4 + 2);
      assert(Math.abs(p.q! - p.terms.reduce((s, t) => s + t.product, 0)) < 1e-15);
      assert.deepEqual(m.heads[head].q, m.q?.values?.slice(head * 4, head * 4 + 4));
      if (key > query) { assert.equal(m.lens?.availability, "NOT APPLICABLE"); assert.equal(m.geometry, undefined); }
      else { assert(Math.abs(m.lens!.scaled! - m.lens!.observedLogit!) < 1e-15); assert.equal(m.geometry!.dot, m.lens!.sum); }
    }
    outputs.push(spatialReadModel(r.run, r.snapshots[0], source, {query: 4, key: 0, head: 0, feature: 0}).projection!.q!);
    assert.equal(spatialReadModel(r.run, undefined, source, {query: 4, key: 0, head: 0, feature: 0}).projection?.availability, "NOT CAPTURED");
    assert.equal(spatialReadModel(r.run, r.snapshots[0], source, {query: 7, key: 0, head: 0, feature: 0}).valid, false);
  }
  assert.notEqual(outputs[0], outputs[1]);
});
