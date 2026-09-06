/** Run with: node --expose-gc --import tsx scripts/benchmark-capture.ts */
import { readFileSync } from 'node:fs';
import { platform, arch, cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { CaptureContext } from '../inspect/capture.js';
import { backward } from '../model/autograd.js';
import { loss, type Observer } from '../model/microgpt.js';
import { restoreTraining, type TrainingSnapshot } from '../model/state.js';
import { TraceRecorder } from '../trace/recorder.js';

const initial = JSON.parse(readFileSync(new URL('../fixtures/canonical.initial.json', import.meta.url), 'utf8')) as TrainingSnapshot;
const milliseconds = (start: number) => Number((performance.now() - start).toFixed(3));
function measure(length: number, training: boolean) {
  global.gc?.();
  const heapBefore = process.memoryUsage().heapUsed;
  const { model } = restoreTraining(initial);
  const input = Array.from({ length }, (_, i) => i === 0 ? model.config.bosTokenId : (i - 1) % model.config.vocabulary.length);
  const targets = input.map((_, i) => i % model.config.vocabulary.length);
  const recorder = new TraceRecorder({ runId: 'benchmark', sessionId: 'benchmark', generationId: 0,
    model: { id: 'microgpt', version: '1', architecture: {}, capabilities: ['predict', 'learn'] },
    startingCheckpointId: 'initial', input, targets, numeric: { dtype: 'float64', policy: 'ECMAScript binary64' },
    capture: { level: 'scalar', maxArtifacts: Number.MAX_SAFE_INTEGER, maxValues: Number.MAX_SAFE_INTEGER }, runtimeVersion: '1' });
  const start = performance.now();
  const capture = new CaptureContext(model, recorder);
  let forwardCaptureMs = performance.now() - start;
  const timed = (action: () => void) => { const began = performance.now(); action(); forwardCaptureMs += performance.now() - began; };
  const observer: Observer = {
    observe: event => timed(() => capture.observe(event)),
    roots: (event, roots) => timed(() => capture.roots(event, roots)),
    structural: (event, roots) => timed(() => capture.structural(event, roots)),
  };
  const result = loss(model, input, targets, observer);
  const forwardWithCaptureMs = milliseconds(start);
  let backwardMs: number | null = null; let backwardCaptureMs: number | null = null;
  if (training) {
    const backwardStart = performance.now(); backward(result.mean); backwardMs = milliseconds(backwardStart);
    const captureStart = performance.now(); capture.captureBackward(result.mean); backwardCaptureMs = milliseconds(captureStart);
  }
  const heapBeforeGc = process.memoryUsage().heapUsed;
  global.gc?.();
  const retainedHeapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;
  const graphStart = performance.now(); const whole = capture.inspect({ kind: 'whole' }).graph!; const wholePlainCopyMs = milliseconds(graphStart);
  const serializationStart = performance.now(); const serialized = JSON.stringify(whole); const serializationMs = milliseconds(serializationStart);
  const run = recorder.finish(); const artifact = [...run.artifacts].reverse().find(artifact => artifact.kind === 'probabilities')!;
  const sliceStart = performance.now();
  const slice = capture.inspect({ kind: 'artifact', artifactId: artifact.id, index: 0 });
  const sliceSerialized = JSON.stringify(slice); const selectedSliceMs = milliseconds(sliceStart);
  return { length, mode: training ? 'forward+backward' : 'forward', nodes: whole.nodes.length, edges: whole.edges.length,
    derivativeEdges: whole.edges.filter(edge => edge.contribution !== undefined).length, structuralEvents: whole.structural.length,
    jsonBytes: Buffer.byteLength(serialized), selectedSliceBytes: Buffer.byteLength(sliceSerialized),
    heapPeakObservedDeltaBytes: heapBeforeGc - heapBefore, retainedHeapDeltaBytes,
    forwardWithCaptureMs, forwardCaptureMs: Number(forwardCaptureMs.toFixed(3)), backwardMs, backwardCaptureMs, wholePlainCopyMs, serializationMs, selectedSliceMs };
}
// Warm up all paths; retain no warmup graphs.
measure(1, false); measure(1, true);
console.log(JSON.stringify({ environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, gcExposed: Boolean(global.gc) },
  note: 'Node worker-equivalent execution, not browser heap/rendering; forward includes loss objective, graph capture, and semantic recording. Retained heap includes live forward DAG and numeric evidence, measured after GC. Timing samples are descriptive, not limits.',
  measurements: [1, 4, 8].flatMap(length => [measure(length, false), measure(length, true)]) }, null, 2));
