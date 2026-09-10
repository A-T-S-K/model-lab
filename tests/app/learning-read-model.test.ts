import { test } from "node:test";
import assert from "node:assert/strict";
import { ModelSession } from "../../app/worker/controller.js";
import { backwardReadModel } from "../../app/presentation/backward-read-model.js";
import { adamReadModel } from "../../app/presentation/adam-read-model.js";
test("completed five-position backward fan-in and Adam use one transition and preserve direct delta", async () => {
  const session = new ModelSession();
  const tag = { sessionId: "learning-read-model", generationId: 0 };
  await session.handle({ ...tag, runId: "init", command: "initialize" });
  const response = await session.handle({
    ...tag,
    runId: "update",
    command: "train",
    document: "abca",
  });
  assert.equal(response.status, "result");
  if (response.status !== "result") return;
  const result = response.result,
    experiment = result.experiment!,
    parameter = { index: 128, name: "layer0.attn_wq", row: 0, column: 0 };
  const inspected = await session.handle({
    ...tag,
    runId: "inspect",
    command: "inspect",
    sourceRunId: experiment.trainingRunId,
    target: { kind: "gradient", parameterIndex: 128 },
  });
  assert.equal(inspected.status, "inspection");
  if (inspected.status !== "inspection") return;
  const training = result.runs.find(
    (run) => run.manifest.runId === experiment.trainingRunId,
  )!;
  const backward = backwardReadModel(
    experiment,
    training,
    parameter,
    inspected.inspection,
    3,
  );
  assert.equal(backward.positions.length, 5);
  assert.equal(backward.positions[3]!.prefix, "abc");
  assert.equal(backward.positions[3]!.target, "a");
  assert(backward.positions[3]!.public);
  assert.equal(backward.meanLoss, experiment.objective.meanLoss);
  assert.equal(backward.gradient, experiment.update.parameters[128]!.gradient);
  assert.equal(backward.contributions.length, 5);
  assert.equal(backward.visible.length, 3);
  assert.equal(backward.hiddenCount, 2);
  assert.equal(
    backward.hiddenSubtotal,
    backward.contributions
      .slice(3)
      .reduce((sum, edge) => sum + edge.contribution!, 0),
  );
  backward.contributions.forEach((edge) =>
    assert.equal(edge.contribution, edge.childAdjoint! * edge.localDerivative),
  );
  assert(Math.abs(backward.sum! - backward.gradient!) < 1e-16);
  const adam = adamReadModel(
    experiment,
    result.snapshots[0],
    result.snapshots[1],
    result.runs[0],
    result.run,
    parameter,
  );
  assert.equal(adam.availability, "AVAILABLE");
  assert.equal(
    adam.q,
    (adam.effectiveLearningRate * adam.update!.mHat) /
      (Math.sqrt(adam.update!.vHat) +
        result.snapshots[0]!.state.optimizer.epsilon),
  );
  assert.equal(adam.update!.delta, experiment.update.parameters[128]!.delta);
  assert.notEqual(adam.q, adam.update!.delta);
  assert.equal(adam.beforeProbability, 0.3591443770854818);
  assert.equal(adam.afterProbability, 0.4070454916035887);
  const later = await session.handle({
    ...tag,
    runId: "later",
    command: "train",
    document: "abca",
  });
  assert.equal(later.status, "result");
  if (later.status !== "result") return;
  assert.equal(
    adamReadModel(
      experiment,
      later.result.snapshots[1],
      result.snapshots[1],
      result.runs[0],
      result.run,
      parameter,
    ).availability,
    "NOT CAPTURED",
  );
  const missing = backwardReadModel(experiment, training, parameter, undefined);
  assert.equal(missing.sum, undefined);
  assert.equal(missing.hiddenSubtotal, undefined);
  assert.equal(missing.fanInAvailable, false);
  assert.equal(missing.gradient, backward.gradient);
});
