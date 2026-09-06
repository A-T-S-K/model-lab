import { RUNTIME_REVISION } from '../../runtime/revision.js';
import fixture from '../../fixtures/canonical.initial.json';
import type { ArchivedSnapshot } from '../../archive/session.js';
import type { RunManifest } from '../../trace/types.js';
import type { RequestTag } from './protocol.js';

export function runManifest(runId: string, tag: RequestTag, snapshot: ArchivedSnapshot, input: number[], targets: number[]): RunManifest {
  return {
    runId, sessionId: tag.sessionId, generationId: tag.generationId,
    model: { id: 'microgpt', version: fixture.reference.revision,
      architecture: snapshot.state.config as unknown as RunManifest['model']['architecture'],
      capabilities: ['predict', 'learn', 'attentionDetail', 'scalar', 'backward'] },
    startingCheckpointId: snapshot.id, startingSnapshotId: snapshot.id,
    input, targets, numeric: { dtype: 'float64', policy: 'ECMAScript binary64; ordered scalar reductions' },
    // Canonical maximum context fits the existing measured semantic budget; scalar capture is separate.
    capture: { level: 'semantic', maxArtifacts: 1024, maxValues: 16384 }, runtimeVersion: 'model-lab-0.2.1',
    runtimeRevision: RUNTIME_REVISION,
  };
}
