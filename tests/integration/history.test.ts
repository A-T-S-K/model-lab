import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelSession } from '../../app/worker/controller.js';
import { inspectHistorical } from '../../app/worker/inspector.js';
import { SessionArchive } from '../../archive/session.js';
import { compareRuns } from '../../trace/compare.js';
import type { RunResult, WorkerResponse } from '../../app/worker/protocol.js';

const tag = { sessionId: 'history', generationId: 0, runId: 'initialize' };
function result(response: WorkerResponse): RunResult {
  assert.equal(response.status, 'result'); if (response.status !== 'result') throw new Error('No result'); return response.result;
}
async function start() { const session = new ModelSession(); await session.handle({ ...tag, command: 'initialize' }); return session; }

test('live learning archives a verified transition; old backward falls back without changing current model', async () => {
  const session = await start();
  const learned = result(await session.handle({ ...tag, runId: 'learn', command: 'train', document: 'abca' }));
  const archive = new SessionArchive();
  for (const snapshot of learned.snapshots) await archive.addSnapshot(snapshot);
  for (const run of learned.runs) await archive.addRun(run);
  await archive.addLearningExperiment(learned.experiment!);
  const sourceRunId = learned.experiment!.trainingRunId;
  const target = { kind: 'gradient' as const, parameterIndex: 0 };
  const live = await session.handle({ ...tag, command: 'inspect', sourceRunId, target });
  assert.equal(live.status, 'inspection'); if (live.status !== 'inspection') return;
  assert.equal(live.inspection.provenance, 'observed');
  const root = live.inspection.graph!.nodes.find(n => n.id === live.inspection.graph!.roots[0])!;
  assert.equal(root.gradient, learned.learn!.update.parameters[0].gradient);
  assert.equal(root.value, learned.learn!.update.parameters[0].before);
  const current = result(await session.handle({ ...tag, runId: 'new', command: 'predict', document: 'abca' }));
  const released = await session.handle({ ...tag, command: 'inspect', sourceRunId, target });
  assert.equal(released.status, 'inspection');
  if (released.status === 'inspection') assert.equal(released.inspection.availability, 'not_captured');
  const historical = await inspectHistorical({ ...tag, command: 'inspect', snapshot: learned.snapshots[0],
    run: learned.runs[1], target, backward: true });
  assert.equal(historical.provenance, 'recomputed'); assert.equal(historical.verification?.verified, true);
  assert.deepEqual(historical.graph, live.inspection.graph);
  const unchanged = result(await session.handle({ ...tag, runId: 'unchanged', command: 'predict', document: 'abca' }));
  assert.deepEqual(unchanged.probabilities, current.probabilities);
  assert.equal(compareRuns(learned.runs[0], learned.runs[2]).compatible, true);
});

test('historical inspector fails closed on mismatched evidence, snapshot identity, and unsupported runtime', async () => {
  const session = await start();
  const prediction = result(await session.handle({ ...tag, runId: 'predict', command: 'predict', document: 'abc' }));
  const run = structuredClone(prediction.run);
  const artifact = run.artifacts.find(a => a.kind === 'probabilities')!;
  const target = { kind: 'artifact' as const, artifactId: artifact.id, index: 0 };
  const request = { ...tag, command: 'inspect' as const, snapshot: prediction.snapshots[0], run, target, backward: false };
  assert.equal((await inspectHistorical(request)).verification?.verified, true);
  (artifact.values as number[])[0] += 0.1;
  const mismatch = await inspectHistorical(request);
  assert.equal(mismatch.verification?.verified, false); assert.equal(mismatch.graph, null);
  assert.match(mismatch.reason!, /MISMATCH/);
  assert.equal((await inspectHistorical({ ...request, snapshot: { ...request.snapshot, id: 'wrong' } })).graph, null);
  const wrongRuntime = { ...run, manifest: { ...run.manifest, runtimeVersion: 'other' } };
  assert.match((await inspectHistorical({ ...request, run: wrongRuntime })).reason!, /runtimeVersion/);
});

test('restoring exact checkpoint reproduces deterministic continuation and retains comparable history', async () => {
  const session = await start();
  const first = result(await session.handle({ ...tag, runId: 'step1', command: 'train', document: 'abc' }));
  const second = result(await session.handle({ ...tag, runId: 'step2', command: 'train', document: 'abc' }));
  await session.handle({ ...tag, command: 'restore', snapshot: first.snapshots[1] });
  const replay = result(await session.handle({ ...tag, runId: 'replay2', command: 'train', document: 'abc' }));
  assert.equal(replay.snapshots[1].id, second.snapshots[1].id);
  assert.deepEqual(replay.learn, second.learn);
  const different = result(await session.handle({ ...tag, runId: 'different', command: 'predict', document: 'c' }));
  assert.equal(compareRuns(first.run, different.run).compatible, false);
});

test('historical artifact IDs resolve by verified concept, and nonfinite source anchors fail closed', async () => {
  const session = await start();
  const prediction = result(await session.handle({ ...tag, runId: 'ids', command: 'predict', document: 'abc' }));
  const run = structuredClone(prediction.run);
  const probability = run.artifacts.find(a => a.kind === 'probabilities')!;
  const embedding = run.artifacts.find(a => a.kind === 'tokenEmbedding')!;
  const artifacts = run.artifacts.map(a => ({ ...a, id: a === probability ? embedding.id : a === embedding ? probability.id : a.id }));
  const request = { ...tag, command: 'inspect' as const, snapshot: prediction.snapshots[0], run: { ...run, artifacts },
    target: { kind: 'artifact' as const, artifactId: embedding.id, index: 0 }, backward: false };
  const inspection = await inspectHistorical(request);
  assert.equal(inspection.verification?.verified, true);
  assert.equal(inspection.graph!.nodes.find(n => n.id === inspection.graph!.roots[0])!.value, probability.values![0]);
  for (const invalid of [NaN, Infinity, -Infinity]) {
    (probability.values as number[])[0] = invalid;
    const failure = await inspectHistorical(request);
    assert.equal(failure.verification?.verified, false); assert.equal(failure.graph, null);
  }
});

test('archived runs retain exact runtime identity and reject unknown or missing revision', async () => {
  const session = await start();
  const prediction = result(await session.handle({ ...tag, runId: 'revision', command: 'predict', document: 'abca' }));
  const archive = new SessionArchive();
  await archive.addSnapshot(prediction.snapshots[0]);
  await archive.addRun(prediction.run);
  const run = archive.runs.get('revision')!;
  assert.match(run.manifest.runtimeRevision, /^sha256:[a-f0-9]{64}$/);
  assert.equal(run.manifest.runtimeRevision, prediction.run.manifest.runtimeRevision);
  const target = { kind: 'artifact' as const, artifactId: run.artifacts.find(a => a.kind === 'probabilities')!.id, index: 0 };
  const request = { ...tag, command: 'inspect' as const, snapshot: prediction.snapshots[0], run, target, backward: false };
  assert.equal((await inspectHistorical(request)).verification?.verified, true);
  for (const revision of ['sha256:' + '0'.repeat(64), undefined]) {
    const changed = { ...run, manifest: { ...run.manifest, runtimeRevision: revision } } as typeof run;
    const inspection = await inspectHistorical({ ...request, run: changed });
    assert.equal(inspection.graph, null);
    assert.match(inspection.reason!, /runtimeRevision differs/);
    assert.equal(compareRuns(run, changed).compatible, false);
  }
});

test('verified historical probability supports recursive operand navigation without changing live state', async () => {
  const session = await start();
  const old = result(await session.handle({ ...tag, runId: 'recursive-old', command: 'predict', document: 'abca' }));
  const artifact = old.run.artifacts.find(a => a.kind === 'probabilities' && a.concept.token === 3)!;
  const artifactTarget = { kind: 'artifact' as const, artifactId: artifact.id, index: 0 };
  const whole = await session.handle({ ...tag, command: 'inspect', sourceRunId: old.run.manifest.runId, target: { kind: 'whole' } });
  assert.equal(whole.status, 'inspection'); if (whole.status !== 'inspection') return;
  const liveGraph = whole.inspection.graph!;
  // Release the old graph and change live parameters before rebuilding its operands.
  const current = result(await session.handle({ ...tag, runId: 'recursive-train', command: 'train', document: 'abca' }));
  const request = { ...tag, command: 'inspect' as const, snapshot: old.snapshots[0], run: old.run, backward: false };
  let inspection = await inspectHistorical({ ...request, target: artifactTarget });
  for (let depth = 0; depth < 3; depth++) {
    assert.equal(inspection.provenance, 'recomputed');
    assert.equal(inspection.verification?.verified, true);
    const graph = inspection.graph!;
    const root = graph.roots[0];
    const operand = graph.edges.find(edge => edge.child === root)!;
    assert.ok(operand, `depth ${depth} has an actual operand`);
    const expectedNode = liveGraph.nodes.find(node => node.id === operand.parent)!;
    inspection = await inspectHistorical({ ...request, target: { kind: 'node', nodeId: operand.parent } });
    assert.equal(inspection.verification?.verified, true);
    assert.deepEqual(inspection.graph!.nodes.find(node => node.id === inspection.graph!.roots[0]), expectedNode);
    assert.deepEqual(inspection.graph!.edges.filter(edge => edge.child === operand.parent),
      liveGraph.edges.filter(edge => edge.child === operand.parent));
  }
  const unchanged = result(await session.handle({ ...tag, runId: 'recursive-unchanged', command: 'predict', document: 'abca' }));
  assert.equal(unchanged.snapshots[0].id, current.snapshots[1].id);
  assert.deepEqual(unchanged.probabilities, current.probabilities);
});
