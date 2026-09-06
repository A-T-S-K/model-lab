import { RUNTIME_REVISION } from '../runtime/revision.js';
import fixture from '../fixtures/canonical.initial.json';
import type { ArchivedSnapshot } from '../archive/session.js';
import type { JsonValue, RunManifest } from '../trace/types.js';

export interface ExperimentTag { sessionId: string; generationId: number; runId: string }

/** These manifests describe new observed executions, never the historical source run. */
export function experimentManifest(tag: ExperimentTag, snapshot: ArchivedSnapshot, inputIds: number[], targetIds: number[], intervention?: JsonValue): RunManifest {
  return {
    ...tag, model: { id: 'microgpt', version: fixture.reference.revision,
      architecture: snapshot.state.config as unknown as RunManifest['model']['architecture'], capabilities: ['predict', 'learn', 'attentionDetail', 'scalar', 'backward'] },
    startingCheckpointId: snapshot.id, startingSnapshotId: snapshot.id, input: inputIds, targets: targetIds,
    numeric: { dtype: 'float64', policy: 'ECMAScript binary64; ordered scalar reductions' },
    capture: { level: 'semantic', maxArtifacts: 16384, maxValues: 1048576 }, runtimeVersion: 'model-lab-0.2.1',
    runtimeRevision: RUNTIME_REVISION,
    ...(intervention === undefined ? {} : { intervention }),
  };
}
