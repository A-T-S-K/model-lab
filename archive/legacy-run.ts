import { immutableCopy, type RecordedRun } from '../trace/types.js';
import { snapshotId, canonicalBytes, type ArchivedSnapshot } from './snapshot.js';
import { exactData } from './experiment.js';

/** Unchanged format-1 admission policy, now reused by its registered codec. */
export async function validateLegacyRun(run: RecordedRun, snapshot: ArchivedSnapshot | undefined): Promise<RecordedRun> {
    const copy = immutableCopy(run);
    canonicalBytes(copy); // Reject undefined, nonfinite, or non-data evidence at the boundary.
    const m = copy.manifest;
    if (!snapshot) throw new Error('Run references a missing starting snapshot');
    if (await snapshotId(snapshot.state) !== m.startingSnapshotId) throw new Error('Run snapshot content hash mismatch');
    if (m.startingCheckpointId !== snapshot.id) throw new Error('Run checkpoint reference does not identify archived state');
    if (copy.formatVersion !== 1 || ![m.runId, m.sessionId, m.model.id, m.model.version, m.runtimeVersion, m.runtimeRevision, m.numeric.policy].every(value =>
      typeof value === 'string' && value.length > 0) || !Number.isSafeInteger(m.generationId) || m.generationId < 0 ||
      m.numeric.dtype !== 'float64' || !exactData(m.model.architecture, snapshot.state.config)) throw new Error('Invalid run model/runtime identity');
    if (new Set(copy.artifacts.map(a => a.id)).size !== copy.artifacts.length || copy.artifacts.some(a =>
      !a.id || a.dtype !== 'float64' || a.axes.length !== a.shape.length || a.shape.some(n => !Number.isSafeInteger(n) || n < 0) ||
      (a.availability === 'available' ? !a.values || a.values.length !== a.shape.reduce((n, d) => n * d, 1) : a.values !== null))) {
      throw new Error('Invalid recorded artifact identity, shape, or availability');
    }
    return copy;
}
