import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fixture from '../../fixtures/canonical.initial.json';
import { SessionArchive, archiveSnapshot } from '../../archive/session.js';
import { SessionRetention } from '../../archive/retention.js';
import { exportPortableArchive, importPortableArchive } from '../../archive/portable.js';
import { loadModel, createOptimizerState, snapshotTraining } from '../../model/state.js';
import { runHeadAblation, HEAD_ABLATION_RECIPE, isHeadAblationExperiment } from '../../experiments/ablation.js';
import { runActivationPatch, ACTIVATION_PATCH_RECIPE, headOutputOccurrence } from '../../experiments/activation-patch.js';
import { runActivationVariant } from '../../experiments/model-variant.js';
import { runCompositeVariant } from '../../experiments/composite-model-variant.js';
import { isActivationVariantExperiment, isCompositeVariantExperiment } from '../../experiments/model-variant-experiment.js';
import { runPoisoningTrial } from '../../experiments/poisoning.js';
import { compareMatchedInterventionArms } from '../../trace/compare.js';
import { compareMatchedVariantRuns } from '../../experiments/variant-comparison.js';
import { availabilityPresentation } from '../../app/presentation/availability.js';
import { EvidenceStore, validateRun, type EvidencePoint, type EvidenceRun } from '../../trace/evidence.js';
import { integrations } from '../../trace/integrations.js';

async function createBaseSnapshot() {
  const model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
  return archiveSnapshot(snapshotTraining(model, createOptimizerState(model, fixture.optimizer)));
}

async function createDistinctSnapshot(step = 99) {
  const model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
  const state = snapshotTraining(model, createOptimizerState(model, fixture.optimizer));
  state.optimizer.step = step;
  return archiveSnapshot(state);
}

test('Sequence F: archive replacement while transaction is pending invalidates reservation and isolates replacement', async () => {
  const baseSnapshot = await createBaseSnapshot();
  const initialArchive = new SessionArchive();
  await initialArchive.addSnapshot(baseSnapshot);

  const retention = new SessionRetention(initialArchive);
  await retention.synchronize();
  const initialStatus = retention.status();

  // 1. Begin in-flight transaction
  const transaction = await retention.begin('canonical');
  assert.equal(retention.status().reservationCount, 1);
  assert.equal(retention.status().generation, initialStatus.generation);

  // Mutate candidate archive within transaction with distinct snapshot
  const candidateSnapshot = await createDistinctSnapshot(101);
  await transaction.archive.addSnapshot(candidateSnapshot);

  // 2. Concurrently replace session with a different replacement archive
  const replacementArchive = new SessionArchive();
  const replacementSnapshot = await createDistinctSnapshot(202);
  await replacementArchive.addSnapshot(replacementSnapshot);

  const replacementStatus = await retention.replace(replacementArchive);
  assert.equal(retention.status().reservationCount, 0, 'all reservations invalidated on replacement');
  assert.equal(retention.status().generation, initialStatus.generation + 1, 'generation increments');
  assert.equal(retention.archive, replacementArchive);

  // 3. Stale transaction attempts to commit into replaced authority
  await assert.rejects(
    async () => { await transaction.commit(); },
    /Stale retention reservation/,
    'stale transaction must be refused commit'
  );

  // 4. Verify replacement archive is completely untouched
  assert.equal(replacementArchive.snapshots.size, 1);
  assert.ok(replacementArchive.snapshots.has(replacementSnapshot.id));
  assert.equal(replacementArchive.snapshots.has(candidateSnapshot.id), false);
  assert.equal(replacementArchive.runs.size, 0);

  // 5. New transaction on the current generation succeeds cleanly
  const currentTransaction = await retention.begin('canonical');
  assert.equal(retention.status().reservationCount, 1);
  await currentTransaction.commit();
  assert.equal(retention.status().reservationCount, 0);
});

test('Sequence G: portable round-trip of M3 experiment receipts preserves purpose-specific comparison policies and lineage', async () => {
  const snapshot = await createBaseSnapshot();
  const archive = new SessionArchive();
  await archive.addSnapshot(snapshot);

  // 1. Head ablation (matched-intervention policy)
  const ablation = await runHeadAblation(snapshot, fixture.tokenIds, fixture.targetIds, { layer: 0, head: 0 });
  await archive.addRun(ablation.baselineRun);
  await archive.addRun(ablation.interventionRun);
  await archive.addInterventionExperiment(ablation);

  // 2. Activation patch (matched-intervention policy)
  const patchReq = {
    snapshot,
    donorInputIds: fixture.tokenIds,
    donorTargetIds: fixture.targetIds,
    targetInputIds: fixture.tokenIds,
    targetTargetIds: fixture.targetIds,
    donor: headOutputOccurrence(snapshot, 'patch:donor', 0, 0, 0),
    target: headOutputOccurrence(snapshot, 'patch:intervention', 3, 0, 1),
    tag: { sessionId: 'roundtrip-test', generationId: 1, runId: 'patch' },
  };
  const patch = await runActivationPatch(patchReq);
  await archive.addRun(patch.donorRun);
  await archive.addRun(patch.baselineRun);
  await archive.addRun(patch.interventionRun);
  await archive.addInterventionExperiment(patch);

  // 3. Activation variant (matched-variant policy)
  const actVariant = await runActivationVariant({ snapshot, inputIds: fixture.tokenIds, targetIds: fixture.targetIds });
  await archive.addRun(actVariant.baselineRun);
  await archive.addModelVariantExperiment(actVariant);

  // 4. Composite variant (matched-variant policy)
  const compVariant = await runCompositeVariant({ snapshot, inputIds: fixture.tokenIds, targetIds: fixture.targetIds });
  await archive.addRun(compVariant.baselineRun);
  await archive.addModelVariantExperiment(compVariant);

  // 5. Matched data substitution (clean vs substituted vs defended controls)
  const { report, experiment: dataExp, archive: dataArchive } = await runPoisoningTrial(snapshot, {
    id: 'poison-cross',
    schedule: ['abca', 'bcab'],
    substitutions: [{ step: 0, original: 'abca', replacement: 'abcc' }],
    triggeredPrefix: 'abc',
    controlPrefixes: ['bca', 'cab'],
    desiredToken: 'c',
    cleanDocuments: ['abca', 'bcab'],
  });
  for (const s of dataArchive.snapshots.values()) await archive.addSnapshot(s);
  for (const r of dataArchive.runs.values()) await archive.addRun(r);
  for (const l of dataArchive.learningExperiments.values()) await archive.addLearningExperiment(l);
  await archive.addDataExperiment(dataExp);

  // Export to portable bytes and import into fresh isolated archive
  const exported = await exportPortableArchive(archive);
  const { archive: imported } = await importPortableArchive(exported.bytes);

  // Verify head ablation receipt & comparison
  const importedAblation = imported.interventionExperiments.get(ablation.id);
  assert.ok(importedAblation);
  assert.ok(isHeadAblationExperiment(importedAblation));
  assert.equal(importedAblation.recipe.id, HEAD_ABLATION_RECIPE.id);
  assert.equal(importedAblation.recipe.version, 1);
  assert.equal(importedAblation.selection.head, 0);
  const ablationRecompared = compareMatchedInterventionArms(
    imported.runs.get(importedAblation.baselineRun.manifest.runId)!,
    imported.runs.get(importedAblation.interventionRun.manifest.runId)!,
    importedAblation.declaration
  );
  assert.equal(ablationRecompared.compatible, true);
  assert.equal(ablationRecompared.policy.id, 'matched-intervention');

  // Verify activation patch receipt & comparison
  const importedPatch = imported.interventionExperiments.get(patch.id);
  assert.ok(importedPatch);
  assert.equal(importedPatch.recipe.id, ACTIVATION_PATCH_RECIPE.id);
  const patchRecompared = compareMatchedInterventionArms(
    imported.runs.get(importedPatch.baselineRun.manifest.runId)!,
    imported.runs.get(importedPatch.interventionRun.manifest.runId)!,
    importedPatch.declaration
  );
  assert.equal(patchRecompared.compatible, true);
  assert.equal(patchRecompared.policy.id, 'matched-intervention');

  // Verify activation variant receipt & comparison
  const importedActVar = imported.modelVariantExperiments.get(actVariant.id);
  assert.ok(importedActVar);
  assert.ok(isActivationVariantExperiment(importedActVar));
  const actVarRecompared = compareMatchedVariantRuns(
    imported.runs.get(importedActVar.baselineRun.manifest.runId)!,
    imported.runs.get(importedActVar.variantRun.manifest.runId)!
  );
  assert.equal(actVarRecompared.compatible, true);
  assert.equal(actVarRecompared.policy.id, 'matched-variant');

  // Verify composite variant receipt & comparison
  const importedCompVar = imported.modelVariantExperiments.get(compVariant.id);
  assert.ok(importedCompVar);
  assert.ok(isCompositeVariantExperiment(importedCompVar));
  const compVarRecompared = compareMatchedVariantRuns(
    imported.runs.get(importedCompVar.baselineRun.manifest.runId)!,
    imported.runs.get(importedCompVar.trainedRun.manifest.runId)!
  );
  assert.equal(compVarRecompared.compatible, true);
  assert.equal(compVarRecompared.policy.id, 'matched-variant');

  // Verify data experiment receipt & lineage
  const importedData = imported.dataExperiments.get(dataExp.id);
  assert.ok(importedData);
  assert.equal(importedData.receiptId, dataExp.receiptId);
  assert.equal(importedData.design.cleanSchedule.length, 2);
  assert.ok(imported.snapshots.has(report.cleanFinalSnapshotId));
  assert.ok(imported.snapshots.has(report.substitutedFinalSnapshotId));
  assert.ok(imported.snapshots.has(report.defendedFinalSnapshotId));
});

test('Sequence H: availability state integrity across all 10 states preserves non-zeroing and semantic boundaries', () => {
  // 1. AVAILABLE inline
  const pInline = availabilityPresentation({ availability: 'available' });
  assert.equal(pInline.label, 'AVAILABLE');
  assert.equal(pInline.numerical, true);

  // 2. AVAILABLE payload-backed (availability is 'available' with payload descriptor)
  const pPayload = availabilityPresentation({ availability: 'available' });
  assert.equal(pPayload.numerical, true);

  // 3. NOT CAPTURED
  const pNotCaptured = availabilityPresentation({ availability: 'not_captured' });
  assert.equal(pNotCaptured.label, 'NOT CAPTURED');
  assert.equal(pNotCaptured.numerical, false);
  assert.match(pNotCaptured.explanation, /no value is substituted/i);

  // 4. NOT APPLICABLE
  const pNotApplicable = availabilityPresentation({ availability: 'not_applicable' });
  assert.equal(pNotApplicable.label, 'NOT APPLICABLE');
  assert.equal(pNotApplicable.numerical, false);
  assert.match(pNotApplicable.explanation, /does not exist/i);

  // 5. UNSUPPORTED
  const pUnsupported = availabilityPresentation({ availability: 'unsupported' });
  assert.equal(pUnsupported.label, 'UNSUPPORTED');
  assert.equal(pUnsupported.numerical, false);
  assert.match(pUnsupported.explanation, /does not support/i);

  // 6. BUDGET EXCEEDED
  const pBudget = availabilityPresentation({ availability: 'budget_exceeded' });
  assert.equal(pBudget.label, 'BUDGET EXCEEDED');
  assert.equal(pBudget.numerical, false);
  assert.match(pBudget.explanation, /zero is not substituted/i);

  // 7. SHAPE ONLY
  const pShape = availabilityPresentation({ availability: 'shape_only' });
  assert.equal(pShape.label, 'SHAPE ONLY');
  assert.equal(pShape.numerical, false);
  assert.match(pShape.explanation, /structural shape/i);
  assert.match(pShape.explanation, /not numerical execution/i);

  // 8. OPAQUE
  const pOpaque = availabilityPresentation({ availability: 'opaque' });
  assert.equal(pOpaque.label, 'OPAQUE');
  assert.equal(pOpaque.numerical, false);
  assert.match(pOpaque.explanation, /internal numerical semantics are deliberately unavailable/i);

  // 9. PENDING
  const pPending = availabilityPresentation({ availability: 'pending' });
  assert.equal(pPending.label, 'PENDING');
  assert.equal(pPending.numerical, false);

  // 10. VERIFICATION FAILED
  const pVerFailed = availabilityPresentation({ availability: 'verification_failed' });
  assert.equal(pVerFailed.label, 'VERIFICATION FAILED');
  assert.equal(pVerFailed.numerical, false);

  // Verify store enforcement: unavailable points must have values === null and cannot be sliced
  const makePoint = (availability: string, values: number[] | null): EvidencePoint => ({
    id: `pt-${availability}`,
    node: 'test-node',
    port: 'out',
    invocation: 'inv:0',
    phase: 'forward',
    shape: [2],
    axes: [{ role: 'feature', space: 'test:feat', size: 2 }],
    dtype: 'float64',
    encoding: 'json-numbers-row-major',
    values,
    origin: 'observed',
    availability,
    source: { file: 'test.ts', symbol: 'sym', revision: 'r1' },
    owners: [],
    dependencies: [],
    semantics: `${availability} test point`,
    capabilities: ['source'],
  });

  const baseRun = {
    version: 1,
    id: 'point-test-run',
    integration: 'test',
    definition: 'test',
    checkpoint: 'chk',
    inputTransform: 'identity',
    profile: 'test',
    runtime: 'r',
    request: { version: 1, integration: 'test', profile: 'test', requestId: 'rq', sessionId: 's', epoch: 0, action: 'predict', input: 'a' },
    execution: 'native',
    precision: { storage: 'float64', compute: 'float64', policy: 'exact' },
    input: { text: 'a', tokenIds: [0], labels: ['a'], offsets: [[0, 1]] },
    limits: [],
  };

  // Valid: unavailable point with values: null passes validation
  for (const st of ['not_captured', 'not_applicable', 'unsupported', 'budget_exceeded']) {
    const valid = validateRun({ ...baseRun, points: [makePoint(st, null)] });
    assert.equal(valid.points[0]?.availability, st);
    assert.equal(valid.points[0]?.values, null);
  }

  // Invalid: unavailable point with non-null values is rejected
  for (const st of ['not_captured', 'not_applicable', 'unsupported', 'budget_exceeded']) {
    assert.throws(() => {
      validateRun({
        ...baseRun,
        points: [makePoint(st, [1, 2])],
      });
    }, /Unavailable evidence must have no numerical storage/);
  }

  // Version 2 shape_only must have values: null
  const shapeValid = validateRun({
    ...baseRun,
    version: 2,
    execution: 'structural-preview',
    points: [makePoint('shape_only', null)],
  });
  assert.equal(shapeValid.points[0]?.availability, 'shape_only');
  assert.equal(shapeValid.points[0]?.values, null);

  assert.throws(() => {
    validateRun({
      ...baseRun,
      version: 2,
      execution: 'structural-preview',
      points: [makePoint('shape_only', [1, 2])],
    });
  }, /Unavailable evidence must have no numerical storage/);
});
