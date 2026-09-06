import { snapshotId } from '../../archive/session.js';
import { restoreTraining, parameterValues } from '../../model/state.js';
import { backward, zeroGrad } from '../../model/autograd.js';
import { predict, loss, type HeadAblation } from '../../model/microgpt.js';
import { TraceRecorder } from '../../trace/recorder.js';
import { canonicalIdentity } from '../../trace/compare.js';
import { immutableCopy } from '../../trace/types.js';
import { CaptureContext } from '../../inspect/capture.js';
import type { InspectionResult, InspectionVerification } from '../../inspect/types.js';
import type { HistoricalRequest } from './protocol.js';
import { runManifest } from './manifest.js';

/** A disposable model belongs exclusively to the inspector worker. Never mutates live state. */
export async function inspectHistorical(request: HistoricalRequest): Promise<InspectionResult> {
  const { snapshot, run, target } = request;
  const unavailable = (reason: string): InspectionResult => ({ sourceRunId: run.manifest.runId,
    provenance: 'recomputed', availability: 'unsupported', graph: null, reason });
  if (await snapshotId(snapshot.state) !== snapshot.id || run.manifest.startingSnapshotId !== snapshot.id ||
      run.manifest.startingCheckpointId !== snapshot.id) return unavailable('Snapshot identity mismatch');
  if (!Array.isArray(run.manifest.input) || !Array.isArray(run.manifest.targets)) {
    return unavailable('Unsupported execution semantics');
  }
  let ablation: HeadAblation | undefined;
  if (run.manifest.intervention !== undefined) {
    const declaration = run.manifest.intervention;
    if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration) || request.backward) return unavailable('Unsupported intervention');
    const d = declaration as Record<string, unknown>;
    if (canonicalIdentity(Object.keys(d).sort()) !== canonicalIdentity(['boundary', 'head', 'kind', 'layer', 'replacement']) ||
        d.kind !== 'head_ablation' || d.boundary !== 'head output immediately before concatenation' || d.replacement !== 0 ||
        !Number.isInteger(d.layer) || !Number.isInteger(d.head)) return unavailable('Unsupported intervention');
    ablation = { layer: d.layer as number, head: d.head as number };
  }
  const input = run.manifest.input as number[], targets = run.manifest.targets as number[];
  const expected = runManifest(run.manifest.runId, request, snapshot, input, targets);
  for (const key of ['model', 'numeric', 'runtimeVersion', 'runtimeRevision'] as const) {
    if (canonicalIdentity(expected[key]) !== canonicalIdentity(run.manifest[key])) return unavailable(`${key} differs from this runtime`);
  }
  const { model } = restoreTraining(snapshot.state);
  const recorder = new TraceRecorder({ ...expected, ...(run.manifest.intervention === undefined ? {} : { intervention: run.manifest.intervention }),
    capture: { level: 'semantic', maxArtifacts: 1024, maxValues: 16384 } });
  const context = new CaptureContext(model, recorder);
  if (request.backward) {
    zeroGrad(parameterValues(model));
    const execution = loss(model, input, targets, context);
    backward(execution.mean); context.captureBackward(execution.mean);
  } else predict(model, input, context, ablation);
  const recomputed = recorder.finish();
  const observedValues: number[] = [], recomputedValues: number[] = [];
  const verifiedArtifactIds = new Map<string, string>();
  const pending = new Map<string, typeof recomputed.artifacts[number][]>();
  for (const artifact of recomputed.artifacts) {
    const key = canonicalIdentity(artifact.concept);
    const queue = pending.get(key) ?? []; queue.push(artifact); pending.set(key, queue);
  }
  let verified = true;
  if (new Set(run.artifacts.map(a => a.id)).size !== run.artifacts.length) verified = false;
  for (const artifact of run.artifacts) {
    const match = pending.get(canonicalIdentity(artifact.concept))?.shift();
    if (match) verifiedArtifactIds.set(artifact.id, match.id);
    if (artifact.availability !== 'available' || !artifact.values) continue;
    if (!match?.values || artifact.values.length !== match.values.length || !artifact.values.every(Number.isFinite) ||
      canonicalIdentity([match.kind, match.shape, match.axes, match.dtype]) !== canonicalIdentity([artifact.kind, artifact.shape, artifact.axes, artifact.dtype])) { verified = false; continue; }
    observedValues.push(...artifact.values); recomputedValues.push(...match.values);
  }
  let maxAbsoluteError = 0, maxRelativeError = 0;
  for (let i = 0; i < observedValues.length; i++) {
    const a = observedValues[i], b = recomputedValues[i];
    const error = Math.abs(a - b), scale = Math.max(Math.abs(a), Math.abs(b));
    maxAbsoluteError = Math.max(maxAbsoluteError, error);
    maxRelativeError = Math.max(maxRelativeError, scale === 0 ? 0 : error / scale);
    if (!Number.isFinite(a) || !Number.isFinite(b) || error > 1e-10 + 1e-9 * scale) verified = false;
  }
  verified &&= observedValues.length > 0;
  // Backward explanations require the actual observed gradient anchor, not only matching logits.
  if (request.backward && !run.artifacts.some(a => a.kind === 'gradient' && a.availability === 'available')) verified = false;
  const verification: InspectionVerification = { sourceArtifactId: target.kind === 'artifact' ? target.artifactId :
    run.artifacts.find(a => a.kind === (request.backward ? 'gradient' : 'probabilities'))?.id ?? run.manifest.runId,
    observedValues, recomputedValues, maxAbsoluteError, maxRelativeError,
    tolerancePolicy: 'abs 1e-10 + rel 1e-9; all available semantic anchors', verified };
  if (!verified) return immutableCopy({ ...unavailable('RECOMPUTATION MISMATCH: this execution does not explain the recorded run'), verification });
  // Source IDs are opaque archive identities, not reconstructed graph addresses.
  const resolvedTarget = target.kind === 'artifact' ? { ...target, artifactId: verifiedArtifactIds.get(target.artifactId) ?? '' } : target;
  return immutableCopy({ ...context.inspect(resolvedTarget), provenance: 'recomputed', verification });
}
