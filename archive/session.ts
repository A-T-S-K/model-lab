import { EvidenceStore } from '../trace/evidence.js';
import { integrations } from '../trace/integrations.js';
import { validateLegacyRun } from './legacy-run.js';
import { immutableCopy, type RecordedRun } from '../trace/types.js';
import { archiveSnapshot, snapshotId, canonicalBytes, type ArchivedSnapshot } from './snapshot.js';
import { exactData, validateLearningExperiment, type LearningExperiment } from './experiment.js';
import type { HeadAblationExperiment } from '../experiments/ablation.js';
import { compareRuns } from '../trace/compare.js';

export { archiveSnapshot, snapshotId, validateTrainingSnapshot, canonicalBytes } from './snapshot.js';
export type { ArchivedSnapshot } from './snapshot.js';
export type { LearningExperiment } from './experiment.js';

/** A read-only live view, with no mutable Map exposed even through a type cast. */
class ArchiveView<K, V> implements ReadonlyMap<K, V> {
  readonly #map: Map<K, V>;
  constructor(map: Map<K, V>) { this.#map = map; Object.freeze(this); }
  get size(): number { return this.#map.size; }
  get(key: K): V | undefined { return this.#map.get(key); }
  has(key: K): boolean { return this.#map.has(key); }
  entries(): MapIterator<[K, V]> { return this.#map.entries(); }
  keys(): MapIterator<K> { return this.#map.keys(); }
  values(): MapIterator<V> { return this.#map.values(); }
  [Symbol.iterator](): MapIterator<[K, V]> { return this.entries(); }
  forEach(callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown): void {
    this.#map.forEach((value, key) => callback.call(thisArg, value, key, this));
  }
}

/** Immutable browser-session history. Validate complete records before insertion. */
export class SessionArchive {
  readonly evidence = new EvidenceStore(integrations());
  readonly #snapshots = new Map<string, ArchivedSnapshot>();
  readonly #runs = new Map<string, RecordedRun>();
  readonly #learningExperiments = new Map<string, LearningExperiment>();
  readonly #interventionExperiments = new Map<string, HeadAblationExperiment>();
  readonly snapshots: ReadonlyMap<string, ArchivedSnapshot> = new ArchiveView(this.#snapshots);
  readonly runs: ReadonlyMap<string, RecordedRun> = new ArchiveView(this.#runs);
  readonly learningExperiments: ReadonlyMap<string, LearningExperiment> = new ArchiveView(this.#learningExperiments);
  readonly interventionExperiments: ReadonlyMap<string, HeadAblationExperiment> = new ArchiveView(this.#interventionExperiments);

  async addSnapshot(record: ArchivedSnapshot): Promise<void> {
    const copy = await archiveSnapshot(record.state);
    if (copy.id !== record.id) throw new Error('Snapshot content hash does not match ID');
    this.#snapshots.set(copy.id, copy);
  }

  async addRun(run: RecordedRun): Promise<void> {
    const copy = await validateLegacyRun(run, this.#snapshots.get(run.manifest.startingSnapshotId ?? ''));
    const m = copy.manifest;
    const existing = this.#runs.get(m.runId);
    if (existing && !exactData(existing, copy)) throw new Error('Run ID already has different immutable evidence');
    await this.evidence.admit({ version: 1, codec: 'microgpt-legacy-v1', record: { run: copy, snapshot: this.#snapshots.get(m.startingSnapshotId!) } });
    this.#runs.set(m.runId, copy);
  }

  async addLearningExperiment(experiment: LearningExperiment): Promise<void> {
    const copy = immutableCopy(experiment);
    canonicalBytes(copy);
    const start = this.#snapshots.get(copy.startingSnapshotId); const end = this.#snapshots.get(copy.resultingSnapshotId);
    const before = this.#runs.get(copy.beforeRunId); const training = this.#runs.get(copy.trainingRunId);
    const backward = this.#runs.get(copy.backwardRunId); const after = this.#runs.get(copy.afterRunId);
    if (!start || !end || !before || !training || !backward || !after) throw new Error('Learning experiment references missing snapshots or runs');
    if (await snapshotId(start.state) !== start.id || await snapshotId(end.state) !== end.id) throw new Error('Learning experiment snapshot hash mismatch');
    validateLearningExperiment(copy, start.state, end.state, before, training, backward, after);
    const existing = this.#learningExperiments.get(copy.id);
    if (existing && !exactData(existing, copy)) throw new Error('Learning experiment ID already has different immutable evidence');
    this.#learningExperiments.set(copy.id, copy);
  }

  async addInterventionExperiment(experiment: HeadAblationExperiment): Promise<void> {
    const copy = immutableCopy(experiment);
    const snapshot = this.#snapshots.get(copy.startingSnapshotId);
    const before = this.#runs.get(copy.baselineRun.manifest.runId), after = this.#runs.get(copy.interventionRun.manifest.runId);
    const { layer, head } = copy.selection;
    if (!snapshot || !before || !after || !Number.isInteger(layer) || !Number.isInteger(head) || layer < 0 || head < 0 ||
      layer >= snapshot.state.config.nLayer || head >= snapshot.state.config.nHead ||
      before.manifest.startingSnapshotId !== snapshot.id || after.manifest.startingSnapshotId !== snapshot.id ||
      before.manifest.intervention !== undefined || copy.boundary !== 'head output immediately before concatenation' || copy.provenance !== 'observed' ||
      !exactData(after.manifest.intervention, { kind: 'head_ablation', layer, head, boundary: copy.boundary, replacement: 0 }) ||
      !exactData(before, copy.baselineRun) || !exactData(after, copy.interventionRun) ||
      !copy.comparison.compatible || !exactData(compareRuns(before, after), copy.comparison)) throw new Error('Invalid ablation experiment references or declaration');
    const existing = this.#interventionExperiments.get(copy.id);
    if (existing && !exactData(existing, copy)) throw new Error('Experiment ID already has different immutable evidence');
    this.#interventionExperiments.set(copy.id, copy);
  }
}
