import { EvidenceStore } from '../trace/evidence.js';
import { integrations } from '../trace/integrations.js';
import { validateLegacyRun } from './legacy-run.js';
import { immutableCopy, type RecordedRun } from '../trace/types.js';
import { archiveSnapshot, snapshotId, canonicalBytes, type ArchivedSnapshot } from './snapshot.js';
import { exactData, validateLearningExperiment, type LearningExperiment } from './experiment.js';
import type { InterventionExperiment } from '../experiments/intervention.js';
import { interventionRecipes } from '../experiments/recipes.js';
import { compareMatchedInterventionArms } from '../trace/compare.js';
import type { ModelVariantExperiment } from '../experiments/model-variant-experiment.js';
import { modelVariantExperiments } from '../experiments/model-variant-recipes.js';
import { dataExperimentRecipes, type MatchedDataExperimentReceipt } from '../experiments/data-experiment.js';
import { modelDefinitionKey, modelDefinitions } from '../model/definitions.js';

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
  readonly #interventionExperiments = new Map<string, InterventionExperiment>();
  readonly #modelVariantExperiments = new Map<string, ModelVariantExperiment>();
  readonly #dataExperiments = new Map<string, MatchedDataExperimentReceipt>();
  readonly snapshots: ReadonlyMap<string, ArchivedSnapshot> = new ArchiveView(this.#snapshots);
  readonly runs: ReadonlyMap<string, RecordedRun> = new ArchiveView(this.#runs);
  readonly learningExperiments: ReadonlyMap<string, LearningExperiment> = new ArchiveView(this.#learningExperiments);
  readonly interventionExperiments: ReadonlyMap<string, InterventionExperiment> = new ArchiveView(this.#interventionExperiments);
  readonly modelVariantExperiments: ReadonlyMap<string, ModelVariantExperiment> = new ArchiveView(this.#modelVariantExperiments);
  readonly dataExperiments: ReadonlyMap<string, MatchedDataExperimentReceipt> = new ArchiveView(this.#dataExperiments);

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

  async addInterventionExperiment(experiment: InterventionExperiment): Promise<void> {
    const copy = immutableCopy(experiment);
    canonicalBytes(copy);
    if (typeof copy.id !== 'string' || !copy.id) throw new Error('Invalid intervention experiment ID');
    const recipe = interventionRecipes.require(copy.recipe);
    const snapshot = this.#snapshots.get(copy.startingSnapshotId);
    const before = this.#runs.get(copy.arms.baseline.runId), after = this.#runs.get(copy.arms.intervention.runId);
    const donor = copy.arms.donor ? this.#runs.get(copy.arms.donor.runId) : undefined;
    if (!snapshot || !before || !after) throw new Error('Intervention experiment references missing snapshot or arm runs');
    if (await snapshotId(snapshot.state) !== snapshot.id || copy.source.snapshotId !== snapshot.id ||
        copy.source.checkpointId !== snapshot.id || copy.startingSnapshotId !== snapshot.id)
      throw new Error('Intervention experiment source snapshot or checkpoint mismatch');
    if (copy.lifecycle.status !== 'succeeded' || copy.arms.baseline.status !== 'succeeded' || copy.arms.intervention.status !== 'succeeded' ||
        (copy.arms.donor && copy.arms.donor.status !== 'succeeded'))
      throw new Error('Failed or cancelled intervention arms cannot be admitted as successful');
    if (!exactData(before, copy.baselineRun) || !exactData(after, copy.interventionRun) ||
        copy.baselineRun.manifest.runId !== copy.arms.baseline.runId || copy.interventionRun.manifest.runId !== copy.arms.intervention.runId)
      throw new Error('Intervention arm identity does not match immutable retained runs');
    if (Boolean(copy.arms.donor) !== Boolean(copy.donorRun) || (copy.arms.donor && (!donor || !copy.donorRun ||
        donor.manifest.runId !== copy.arms.donor.runId || !exactData(donor, copy.donorRun))))
      throw new Error('Intervention donor identity does not match immutable retained evidence');
    for (const run of [before, after, ...(donor ? [donor] : [])]) {
      if (run.manifest.startingSnapshotId !== snapshot.id || run.manifest.startingCheckpointId !== snapshot.id ||
          run.manifest.model.id !== copy.source.modelDefinitionId || run.manifest.model.version !== copy.source.modelDefinitionVersion ||
          run.manifest.sessionId !== copy.lifecycle.sessionId || run.manifest.generationId !== copy.lifecycle.generationId)
        throw new Error('Intervention arm source, model, session, or generation identity mismatch');
    }
    if (!exactData(before.manifest.input, copy.inputs.baseline.input) || !exactData(before.manifest.targets, copy.inputs.baseline.targets) ||
        !exactData(after.manifest.input, copy.inputs.intervention.input) || !exactData(after.manifest.targets, copy.inputs.intervention.targets) ||
        before.manifest.intervention !== undefined || !exactData(after.manifest.intervention, copy.declaration))
      throw new Error('Intervention arm input, target, or declaration mismatch');
    if (donor && copy.inputs.donor && (!exactData(donor.manifest.input, copy.inputs.donor.input) || !exactData(donor.manifest.targets, copy.inputs.donor.targets)))
      throw new Error('Intervention donor input or target identity mismatch');
    if (Boolean(donor) !== Boolean(copy.inputs.donor)) throw new Error('Intervention donor input identity is incomplete');
    const comparison = compareMatchedInterventionArms(before, after, copy.declaration);
    if (!copy.comparison.compatible || !exactData(comparison, copy.comparison))
      throw new Error('Invalid matched-intervention comparison receipt');
    recipe.validateReceipt(copy, { snapshot, runs: this.runs });
    const existing = this.#interventionExperiments.get(copy.id);
    if (existing && !exactData(existing, copy)) throw new Error('Experiment ID already has different immutable evidence');
    this.#interventionExperiments.set(copy.id, copy);
  }

  async addModelVariantExperiment(experiment: ModelVariantExperiment): Promise<void> {
    const copy = immutableCopy(experiment);
    canonicalBytes(copy);
    if (typeof copy.id !== 'string' || !copy.id) throw new Error('Invalid model-variant experiment ID');
    const contribution = modelVariantExperiments.require(copy.identity);
    modelDefinitions.require(copy.targetDefinition);
    if (modelDefinitionKey(contribution.targetDefinition) !== modelDefinitionKey(copy.targetDefinition))
      throw new Error('Model-variant receipt target definition does not match its registered family');
    const snapshot = this.#snapshots.get(copy.source.snapshotId);
    if (!snapshot) throw new Error('Model-variant experiment references a missing source snapshot');
    await contribution.validateReceipt(copy, snapshot);
    const existingBaseline = this.#runs.get(copy.baselineRun.manifest.runId);
    if (!existingBaseline || !exactData(existingBaseline, copy.baselineRun))
      throw new Error('Model-variant baseline must be admitted as canonical evidence first');
    const existing = this.#modelVariantExperiments.get(copy.id);
    if (existing && !exactData(existing, copy)) throw new Error('Model-variant experiment ID already has different immutable evidence');
    const variantRuns = contribution.variantRuns(copy);
    if (new Set(variantRuns.map(run => run.manifest.runId)).size !== variantRuns.length ||
        variantRuns.some(run => run.manifest.runId === copy.baselineRun.manifest.runId))
      throw new Error('Model-variant receipt has duplicate baseline or variant run identities');
    for (const run of variantRuns) {
      if (run.manifest.model.id !== copy.targetDefinition.id || run.manifest.model.version !== copy.targetDefinition.version)
        throw new Error('Model-variant run does not use the registered target definition');
      const existingRun = this.#runs.get(run.manifest.runId);
      if (existingRun && !exactData(existingRun, run)) throw new Error('Variant run ID already has different immutable evidence');
    }
    // Definition-aware variant evidence deliberately does not enter the legacy run
    // codec or claim a canonical training-snapshot continuation.
    for (const run of variantRuns) this.#runs.set(run.manifest.runId, run);
    this.#modelVariantExperiments.set(copy.id, copy);
  }

  async addDataExperiment(experiment: MatchedDataExperimentReceipt): Promise<void> {
    const copy = immutableCopy(experiment); canonicalBytes(copy);
    if (typeof copy.id !== 'string' || !copy.id) throw new Error('Invalid data-experiment ID');
    const existing = this.#dataExperiments.get(copy.id);
    if (existing) {
      if (!exactData(existing, copy)) throw new Error('Data-experiment ID already has different immutable evidence');
      return;
    }
    const recipe = dataExperimentRecipes.require(copy.recipe);
    const snapshot = this.#snapshots.get(copy.source?.snapshotId ?? '');
    if (!snapshot) throw new Error('Data experiment references a missing source snapshot');
    if (await snapshotId(snapshot.state) !== snapshot.id || copy.source.checkpointId !== snapshot.id)
      throw new Error('Data experiment source snapshot or checkpoint mismatch');
    if (copy.lifecycle.status !== 'succeeded' || !['clean', 'treatment', 'defended'].every(arm =>
      copy.arms[arm as keyof typeof copy.arms]?.status === 'succeeded'))
      throw new Error('Failed or cancelled data-experiment arms cannot be admitted as successful');
    for (const arm of ['clean', 'treatment', 'defended'] as const) {
      for (const step of copy.arms[arm].steps) {
        const learning = this.#learningExperiments.get(step.learningExperimentId);
        if (!learning || learning.startingSnapshotId !== step.startSnapshotId || learning.resultingSnapshotId !== step.endSnapshotId ||
            learning.beforeRunId !== step.beforeRunId || learning.trainingRunId !== step.trainingRunId || learning.afterRunId !== step.afterRunId)
          throw new Error('Data experiment references missing or mismatched learning evidence');
        if (!this.#snapshots.has(step.startSnapshotId) || !this.#snapshots.has(step.endSnapshotId) ||
            !this.#runs.has(step.beforeRunId) || !this.#runs.has(step.trainingRunId) || !this.#runs.has(step.afterRunId))
          throw new Error('Data experiment references missing snapshots or runs');
      }
    }
    await recipe.validateReceipt(copy, { snapshot, snapshots: this.snapshots, runs: this.runs, learningExperiments: this.learningExperiments });
    this.#dataExperiments.set(copy.id, copy);
  }
}
