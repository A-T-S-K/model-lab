import { SessionArchive, snapshotId, type ArchivedSnapshot } from '../archive/session.js';
import { restoreTraining } from '../model/state.js';
import { predict, type HeadAblation } from '../model/microgpt.js';
import { TraceRecorder } from '../trace/recorder.js';
import { compareRuns, type RunComparison } from '../trace/compare.js';
import { immutableCopy, type RecordedRun } from '../trace/types.js';
import { experimentManifest, type ExperimentTag } from './common.js';

export interface HeadAblationExperiment {
  readonly id: string;
  readonly startingSnapshotId: string;
  readonly selection: HeadAblation;
  readonly boundary: 'head output immediately before concatenation';
  readonly provenance: 'observed';
  readonly baselineRun: RecordedRun;
  readonly interventionRun: RecordedRun;
  readonly comparison: RunComparison;
}

/** Disposable matched arms: same exact state and input, one declared head zeroed. */
export async function runHeadAblation(snapshot: ArchivedSnapshot, inputIds: number[], targetIds: number[], selection: HeadAblation,
  tag: ExperimentTag = { sessionId: 'ablation', generationId: 0, runId: 'ablation' }): Promise<HeadAblationExperiment> {
  const source = immutableCopy(snapshot); const input = [...inputIds]; const targets = [...targetIds]; const head = immutableCopy(selection);
  if (await snapshotId(source.state) !== source.id) throw new Error('Ablation source snapshot hash mismatch');
  if (input.length !== targets.length || targets.some(id => !Number.isInteger(id) || id < 0 || id > source.state.config.bosTokenId)) throw new Error('Invalid ablation targets');
  const baseline = restoreTraining(source.state); const intervention = restoreTraining(source.state);
  const before = new TraceRecorder(experimentManifest({ ...tag, runId: `${tag.runId}:baseline` }, source, input, targets));
  const after = new TraceRecorder(experimentManifest({ ...tag, runId: `${tag.runId}:intervention` }, source, input, targets,
    { kind: 'head_ablation', layer: head.layer, head: head.head, boundary: 'head output immediately before concatenation', replacement: 0 }));
  predict(baseline.model, input, before);
  predict(intervention.model, input, after, head);
  const baselineRun = before.finish(); const interventionRun = after.finish();
  const archive = new SessionArchive(); await archive.addSnapshot(source);
  await archive.addRun(baselineRun); await archive.addRun(interventionRun);
  return immutableCopy({ id: tag.runId, startingSnapshotId: source.id, selection: head,
    boundary: 'head output immediately before concatenation', provenance: 'observed', baselineRun, interventionRun,
    comparison: compareRuns(baselineRun, interventionRun) });
}
