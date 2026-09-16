import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/canonical.initial.json';
import { SessionArchive, archiveSnapshot, snapshotId, type ArchivedSnapshot } from '../../archive/session.js';
import { runHeadAblation, HEAD_ABLATION_RECIPE } from '../../experiments/ablation.js';
import {
  ACTIVATION_PATCH_RECIPE,
  headOutputOccurrence,
  runActivationPatch,
  type ActivationPatchExecutionRequest,
  type ActivationPatchExperiment,
  type HeadOutputOccurrence,
} from '../../experiments/activation-patch.js';
import { interventionRecipes } from '../../experiments/recipes.js';
import { loadModel, createOptimizerState, snapshotTraining, restoreTraining } from '../../model/state.js';
import { predict } from '../../model/microgpt.js';
import { canonicalIdentity, compareMatchedInterventionArms, compareRuns } from '../../trace/compare.js';
import type { RecordedRun } from '../../trace/types.js';

async function initial(): Promise<ArchivedSnapshot> {
  const model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
  return archiveSnapshot(snapshotTraining(model, createOptimizerState(model, fixture.optimizer)));
}

function patchRequest(snapshot: ArchivedSnapshot, runId = 'patch', donor = { token: 0, layer: 0, head: 0 }, target = { token: 3, layer: 0, head: 1 }): ActivationPatchExecutionRequest {
  return {
    snapshot, donorInputIds: fixture.tokenIds, donorTargetIds: fixture.targetIds,
    targetInputIds: fixture.tokenIds, targetTargetIds: fixture.targetIds,
    donor: headOutputOccurrence(snapshot, `${runId}:donor`, donor.token, donor.layer, donor.head),
    target: headOutputOccurrence(snapshot, `${runId}:intervention`, target.token, target.layer, target.head),
    tag: { sessionId: 'intervention-test', generationId: 7, runId },
  };
}

async function admit(archive: SessionArchive, snapshot: ArchivedSnapshot, experiment: ActivationPatchExperiment): Promise<void> {
  await archive.addSnapshot(snapshot);
  for (const run of [experiment.donorRun, experiment.baselineRun, experiment.interventionRun]) await archive.addRun(run);
  await archive.addInterventionExperiment(experiment);
}

function artifact(run: RecordedRun, kind: string, token: number, head?: number): readonly number[] {
  const found = run.artifacts.find(item => item.kind === kind && item.concept.token === token &&
    (head === undefined || item.concept.head === head));
  assert.ok(found?.values, `missing ${kind} token ${token} head ${head}`);
  return found.values;
}

test('registered recipes are build-time contributions and unknown recipes are refused', async () => {
  assert.deepEqual(interventionRecipes.identities(), [HEAD_ABLATION_RECIPE, ACTIVATION_PATCH_RECIPE]);
  assert.equal(interventionRecipes.require(HEAD_ABLATION_RECIPE).comparisonPolicy, 'matched-intervention');
  assert.equal(interventionRecipes.require(ACTIVATION_PATCH_RECIPE).writablePoints.length, 1);
  assert.throws(() => interventionRecipes.require({ id: 'imported.untrusted', version: 1 }), /Unknown intervention recipe/);
  const snapshot = await initial(), experiment = await runActivationPatch(patchRequest(snapshot));
  const archive = new SessionArchive(); await archive.addSnapshot(snapshot);
  for (const run of [experiment.donorRun, experiment.baselineRun, experiment.interventionRun]) await archive.addRun(run);
  await assert.rejects(archive.addInterventionExperiment({ ...experiment, recipe: { id: 'unknown', version: 1 } }), /Unknown intervention recipe/);
});

test('archive admits head ablation and donor patch through one generic registered boundary', async () => {
  const snapshot = await initial(), archive = new SessionArchive(); await archive.addSnapshot(snapshot);
  const ablation = await runHeadAblation(snapshot, fixture.tokenIds, fixture.targetIds, { layer: 0, head: 0 },
    { sessionId: 'intervention-test', generationId: 7, runId: 'head' });
  for (const run of [ablation.baselineRun, ablation.interventionRun]) await archive.addRun(run);
  await archive.addInterventionExperiment(ablation);
  const patch = await runActivationPatch(patchRequest(snapshot, 'patch'));
  for (const run of [patch.donorRun, patch.baselineRun, patch.interventionRun]) await archive.addRun(run);
  await archive.addInterventionExperiment(patch);
  assert.equal(archive.interventionExperiments.size, 2);
  assert.equal(archive.interventionExperiments.get('head')?.recipe.id, HEAD_ABLATION_RECIPE.id);
  assert.equal(archive.interventionExperiments.get('patch')?.recipe.id, ACTIVATION_PATCH_RECIPE.id);
  assert.equal(ablation.comparison.policy.id, 'matched-intervention');
  assert.throws(() => { (patch.source as { checkpointId: string }).checkpointId = 'changed'; }, TypeError);

  const second = await runActivationPatch(patchRequest(snapshot, 'second', { token: 1, layer: 0, head: 1 }, { token: 4, layer: 0, head: 0 }));
  for (const run of [second.donorRun, second.baselineRun, second.interventionRun]) await archive.addRun(run);
  await assert.rejects(archive.addInterventionExperiment({ ...second, id: patch.id }), /Experiment ID already has different immutable evidence/);
});

test('real donor evidence replaces the exact target and propagates through concat, projection, residual, logits, and probabilities', async () => {
  const snapshot = await initial(), saved = JSON.stringify(snapshot), experiment = await runActivationPatch(patchRequest(snapshot));
  const donor = experiment.receipt.donorVector, original = experiment.receipt.originalTargetVector;
  assert.notDeepEqual(donor, original);
  assert.deepEqual(experiment.receipt.effectiveReplacement, donor);
  assert.deepEqual(artifact(experiment.donorRun, 'headOutput', 0, 0), donor);
  assert.deepEqual(artifact(experiment.baselineRun, 'headOutput', 3, 1), original);
  assert.deepEqual(artifact(experiment.interventionRun, 'headOutputBeforePatch', 3, 1), original);
  assert.deepEqual(artifact(experiment.interventionRun, 'headOutput', 3, 1), donor);
  for (const kind of ['q', 'k', 'v', 'attentionLogits', 'attentionProbabilities']) {
    assert.deepEqual(experiment.baselineRun.artifacts.filter(a => a.kind === kind).map(a => a.values),
      experiment.interventionRun.artifacts.filter(a => a.kind === kind).map(a => a.values));
  }
  const concat = [...artifact(experiment.interventionRun, 'headOutput', 3, 0), ...donor];
  assert.deepEqual(artifact(experiment.interventionRun, 'attentionOutput', 3), concat);
  const projection = snapshot.state.parameters['layer0.attn_wo'].map(row => row.reduce((sum, weight, index) => sum + weight * concat[index]!, 0));
  assert.deepEqual(artifact(experiment.interventionRun, 'attentionProjection', 3), projection);
  for (const kind of ['attentionResidual', 'logits', 'probabilities'])
    assert.notDeepEqual(artifact(experiment.interventionRun, kind, 3), artifact(experiment.baselineRun, kind, 3));
  assert.equal(experiment.comparison.compatible, true);
  assert.equal(experiment.comparison.policy.id, 'matched-intervention');
  assert.equal(JSON.stringify(snapshot), saved);
  assert.equal(await snapshotId(snapshot.state), snapshot.id);
});

test('same semantic donor and target is a truthful no-op patch', async () => {
  const snapshot = await initial();
  const experiment = await runActivationPatch(patchRequest(snapshot, 'noop', { token: 2, layer: 0, head: 1 }, { token: 2, layer: 0, head: 1 }));
  assert.equal(experiment.receipt.noOp, true);
  assert.deepEqual(experiment.receipt.donorVector, experiment.receipt.originalTargetVector);
  for (const kind of ['headOutput', 'attentionOutput', 'attentionProjection', 'attentionResidual', 'logits', 'probabilities'])
    assert.deepEqual(experiment.baselineRun.artifacts.filter(a => a.kind === kind).map(a => a.values),
      experiment.interventionRun.artifacts.filter(a => a.kind === kind).map(a => a.values));
});

test('patch preflight rejects stale runs/invocations, invalid scope, shape-only matches, and observable read-only points', async () => {
  const snapshot = await initial(), base = patchRequest(snapshot, 'invalid');
  const reject = async (edit: (copy: ActivationPatchExecutionRequest) => void, pattern: RegExp) => {
    const copy = structuredClone(base); edit(copy); await assert.rejects(runActivationPatch(copy), pattern);
  };
  await reject(copy => { (copy.donor as { runId: string }).runId = 'stale'; }, /run identity/);
  await reject(copy => { (copy.donor as { invocation: number }).invocation = 1; }, /invocation/);
  await reject(copy => { (copy.donor.coordinateSpace as { id: string }).id = 'other-basis-with-same-shape'; }, /shape equality alone/);
  await reject(copy => { (copy.target as { boundary: string }).boundary = 'attention projection'; }, /not a registered writable point/);
  await reject(copy => { (copy.target as { layer: number }).layer = 9; }, /invalid token, layer, or head/);
  await reject(copy => { (copy.target as { head: number }).head = 9; }, /invalid token, layer, or head/);
  await reject(copy => { (copy.target as { token: number }).token = 99; }, /invalid token, layer, or head/);
  await reject(copy => { (copy.donor as { checkpointId: string }).checkpointId = 'other-checkpoint'; }, /model or checkpoint identity/);
});

test('failed or stale arm records cannot be admitted and source references cannot be rebound', async () => {
  const snapshot = await initial(), experiment = await runActivationPatch(patchRequest(snapshot, 'admission'));
  const archive = new SessionArchive(); await archive.addSnapshot(snapshot);
  for (const run of [experiment.donorRun, experiment.baselineRun, experiment.interventionRun]) await archive.addRun(run);
  await assert.rejects(archive.addInterventionExperiment({ ...experiment,
    lifecycle: { ...experiment.lifecycle, status: 'failed' }, arms: { ...experiment.arms,
      intervention: { ...experiment.arms.intervention, status: 'failed' } } }), /Failed or cancelled/);
  await assert.rejects(archive.addInterventionExperiment({ ...experiment,
    source: { ...experiment.source, checkpointId: 'rebound' } }), /snapshot or checkpoint mismatch/);
  assert.equal(archive.interventionExperiments.size, 0);
});

test('matched-intervention policy is explicit and stronger while strict comparison behavior is unchanged', async () => {
  const snapshot = await initial(), experiment = await runActivationPatch(patchRequest(snapshot, 'comparison'));
  const strict = compareRuns(experiment.baselineRun, experiment.interventionRun);
  assert.equal(strict.compatible, true);
  assert.equal('policy' in strict, false);
  const changedCheckpoint = { ...experiment.interventionRun, manifest: { ...experiment.interventionRun.manifest, startingCheckpointId: 'different' } };
  assert.equal(compareRuns(experiment.baselineRun, changedCheckpoint).compatible, true);
  const matched = compareMatchedInterventionArms(experiment.baselineRun, changedCheckpoint, experiment.declaration);
  assert.equal(matched.compatible, false); assert.match(matched.reasons.join(' '), /checkpoint/);
  assert.equal(compareRuns(experiment.baselineRun, { ...experiment.interventionRun,
    manifest: { ...experiment.interventionRun.manifest, input: [99] } }).compatible, false);
  assert.equal(canonicalIdentity(experiment.comparison.basis.controlledDifference), canonicalIdentity('declared intervention only'));
});

test('accepted canonical state remains the source after disposable intervention work', async () => {
  const snapshot = await initial(), before = JSON.stringify(snapshot);
  await runActivationPatch(patchRequest(snapshot, 'isolation'));
  const restored = restoreTraining(snapshot.state);
  const prediction = predict(restored.model, fixture.tokenIds);
  const fresh = restoreTraining(snapshot.state);
  assert.deepEqual(prediction, predict(fresh.model, fixture.tokenIds));
  assert.equal(JSON.stringify(snapshot), before);
  assert.equal(await snapshotId(snapshot.state), snapshot.id);
});
