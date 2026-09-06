import { performance } from 'node:perf_hooks';
import { ModelSession } from '../app/worker/controller.js';
import { SessionArchive } from '../archive/session.js';

const session = new ModelSession();
const tag = { sessionId: 'benchmark', generationId: 0, runId: 'init' };
await session.handle({ ...tag, command: 'initialize' });
const archive = new SessionArchive();
const marks = [1, 10, 50, 100, 500];
let slowestStepMs = 0;
const started = performance.now();
for (let step = 1; step <= 500; step++) {
  const start = performance.now();
  const response = await session.handle({ ...tag, runId: `step:${step}`, command: 'train', document: 'abca' });
  if (response.status !== 'result') throw new Error(JSON.stringify(response));
  const r = response.result;
  for (const snapshot of r.snapshots) await archive.addSnapshot(snapshot);
  for (const run of r.runs) await archive.addRun(run);
  await archive.addLearningExperiment(r.experiment!);
  slowestStepMs = Math.max(slowestStepMs, performance.now() - start);
  if (marks.includes(step)) {
    globalThis.gc?.();
    console.log(JSON.stringify({ step, elapsedMs: performance.now() - started, slowestStepMs,
      heapBytes: process.memoryUsage().heapUsed,
      snapshotBytes: new TextEncoder().encode(JSON.stringify(r.snapshots[1])).length,
      archiveBytes: new TextEncoder().encode(JSON.stringify({ snapshots: [...archive.snapshots.values()],
        runs: [...archive.runs.values()], experiments: [...archive.learningExperiments.values()] })).length,
      loss: r.learn!.meanLoss, finalProbability: r.probabilities.at(-1), snapshotId: r.snapshots[1].id }));
  }
}
