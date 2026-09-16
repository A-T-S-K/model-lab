import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from '../../fixtures/canonical.initial.json';
import { SessionArchive, archiveSnapshot, snapshotId, validateTrainingSnapshot } from '../../archive/session.js';
import { runHeadAblation } from '../../experiments/ablation.js';
import { headOutputOccurrence, runActivationPatch } from '../../experiments/activation-patch.js';
import { runActivationVariant } from '../../experiments/model-variant.js';
import { runCompositeVariant } from '../../experiments/composite-model-variant.js';
import {
  isActivationVariantExperiment,
  isCompositeVariantExperiment,
} from '../../experiments/model-variant-experiment.js';
import { modelVariantExperiments } from '../../experiments/model-variant-recipes.js';
import { runPoisoningTrial } from '../../experiments/poisoning.js';
import { compareMatchedVariantRuns } from '../../experiments/variant-comparison.js';
import { predict } from '../../model/microgpt.js';
import { createOptimizerState, loadModel, restoreTraining, snapshotTraining } from '../../model/state.js';

async function initial() {
  const model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
  return archiveSnapshot(snapshotTraining(model, createOptimizerState(model, fixture.optimizer)));
}

function canonicalPrediction(snapshot: Awaited<ReturnType<typeof initial>>) {
  return predict(restoreTraining(snapshot.state).model, fixture.tokenIds);
}

test('all M3 families retain independent evidence in one archive without changing the accepted canonical state', async () => {
  const source = await initial();
  const acceptedBytes = JSON.stringify(source);
  const acceptedPrediction = canonicalPrediction(source);
  const archive = new SessionArchive();
  await archive.addSnapshot(source);
  const unchanged = async () => {
    assert.equal(JSON.stringify(source), acceptedBytes);
    assert.equal(await snapshotId(source.state), source.id);
    assert.deepEqual(canonicalPrediction(source), acceptedPrediction);
  };

  const head = await runHeadAblation(source, fixture.tokenIds, fixture.targetIds, { layer: 0, head: 0 },
    { sessionId: 'm3-d', generationId: 1, runId: 'm3-d:head' });
  for (const run of [head.baselineRun, head.interventionRun]) await archive.addRun(run);
  await archive.addInterventionExperiment(head); await unchanged();

  const donorPatch = await runActivationPatch({
    snapshot: source, donorInputIds: fixture.tokenIds, donorTargetIds: fixture.targetIds,
    targetInputIds: fixture.tokenIds, targetTargetIds: fixture.targetIds,
    donor: headOutputOccurrence(source, 'm3-d:patch:donor', 0, 0, 0),
    target: headOutputOccurrence(source, 'm3-d:patch:intervention', 3, 0, 1),
    tag: { sessionId: 'm3-d', generationId: 2, runId: 'm3-d:patch' },
  });
  for (const run of [donorPatch.donorRun, donorPatch.baselineRun, donorPatch.interventionRun]) await archive.addRun(run);
  await archive.addInterventionExperiment(donorPatch); await unchanged();

  const activation = await runActivationVariant({ snapshot: source, inputIds: fixture.tokenIds, targetIds: fixture.targetIds,
    tag: { sessionId: 'm3-d', generationId: 3, runId: 'm3-d:activation' } });
  await archive.addRun(activation.baselineRun); await archive.addModelVariantExperiment(activation); await unchanged();

  const composite = await runCompositeVariant({ snapshot: source, inputIds: fixture.tokenIds, targetIds: fixture.targetIds,
    tag: { sessionId: 'm3-d', generationId: 4, runId: 'm3-d:composite' } });
  await archive.addRun(composite.baselineRun);
  const colliding = structuredClone(composite); (colliding as { id: string }).id = activation.id;
  await assert.rejects(archive.addModelVariantExperiment(colliding), /experiment ID already has different immutable evidence/);
  assert.equal(archive.runs.has(composite.initializedRun.manifest.runId), false, 'a rejected family collision publishes no variant run');
  await archive.addModelVariantExperiment(composite); await unchanged();

  const data = await runPoisoningTrial(source, { id: 'm3-d-data', schedule: ['abca', 'bcab', 'cabc', 'abab'],
    substitutions: [{ step: 0, original: 'abca', replacement: 'abcc' }], triggeredPrefix: 'abc',
    controlPrefixes: ['bca', 'cab'], desiredToken: 'c', cleanDocuments: ['abca', 'bcab', 'cabc', 'abab'] });
  for (const snapshot of data.archive.snapshots.values()) await archive.addSnapshot(snapshot);
  for (const run of data.archive.runs.values()) if (!archive.runs.has(run.manifest.runId)) await archive.addRun(run);
  for (const learning of data.archive.learningExperiments.values()) await archive.addLearningExperiment(learning);
  await archive.addDataExperiment(data.experiment); await unchanged();

  assert.equal(archive.interventionExperiments.size, 2);
  assert.equal(archive.modelVariantExperiments.size, 2);
  assert.equal(archive.dataExperiments.size, 1);
  assert.ok(isActivationVariantExperiment(archive.modelVariantExperiments.get(activation.id)!));
  assert.ok(isCompositeVariantExperiment(archive.modelVariantExperiments.get(composite.id)!));
  assert.notEqual(data.experiment.arms.treatment.finalSnapshotId, source.id);
  assert.notEqual(composite.trainedState.id, source.id);

  const wrongPolicy = compareMatchedVariantRuns(
    data.archive.runs.get(data.experiment.evaluations.triggered.arms.clean.runId)!,
    data.archive.runs.get(data.experiment.evaluations.triggered.arms.treatment.runId)!,
  );
  assert.equal(wrongPolicy.compatible, false);
  assert.match(wrongPolicy.reasons.join(' '), /not a registered model variant/);
  assert.throws(() => validateTrainingSnapshot(composite.trainedState.state as never), /Invalid snapshot/);
});

test('registered model-variant admission owns both real definitions and failures preserve other families', async () => {
  assert.deepEqual(modelVariantExperiments.identities(), [
    { id: 'microgpt.activation-variant', version: 1 },
    { id: 'microgpt.composite-parameterized-variant', version: 1 },
  ]);
  assert.throws(() => modelVariantExperiments.require({ id: 'imported.third-variant', version: 1 }), /Unknown model-variant experiment/);

  const source = await initial();
  const activation = await runActivationVariant({ snapshot: source, inputIds: fixture.tokenIds, targetIds: fixture.targetIds });
  const archive = new SessionArchive(); await archive.addSnapshot(source); await archive.addRun(activation.baselineRun);
  await archive.addModelVariantExperiment(activation);
  const failed = structuredClone(activation);
  (failed as { identity: { id: string; version: number } }).identity = { id: 'imported.third-variant', version: 1 };
  await assert.rejects(archive.addModelVariantExperiment(failed), /Unknown model-variant experiment/);
  assert.equal(archive.modelVariantExperiments.size, 1);
  assert.ok(archive.modelVariantExperiments.has(activation.id));
});
