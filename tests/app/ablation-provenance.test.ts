import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/canonical.initial.json';
import { loadModel, createOptimizerState, snapshotTraining } from '../../model/state.js';
import { archiveSnapshot } from '../../archive/session.js';
import { runHeadAblation } from '../../experiments/ablation.js';
import { forwardReadModel } from '../../app/spatial/forward.js';
import type { RecordedRun } from '../../trace/types.js';

test('MLR-02 ablation explanation preserves DERIVED provenance for ΣαV and verifies against OBSERVED headOutputBeforeAblation using canonical float64 tolerance', async () => {
  const model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
  const snapshot = await archiveSnapshot(snapshotTraining(model, createOptimizerState(model, fixture.optimizer)));

  const ablation = await runHeadAblation(
    snapshot,
    fixture.tokenIds,
    fixture.targetIds,
    { layer: 0, head: 0 },
    { sessionId: 'ablation-provenance-test', generationId: 1, runId: 'head-0-0' }
  );

  const baselineFwd = forwardReadModel(ablation.baselineRun, snapshot);
  const interventionFwd = forwardReadModel(ablation.interventionRun, snapshot);

  // 1. Baseline (non-ablated) head output: zeroed is false, preAblationArtifact is undefined
  const baselineExplanation = baselineFwd.explain({ kind: 'headOutput', token: 3, layer: 0, head: 0 }, 0);
  assert.equal(baselineExplanation.zeroed, false);
  assert.equal(baselineExplanation.preAblationArtifact, undefined);
  assert.equal(baselineExplanation.reconstructionProvenance, 'DERIVED');
  assert.equal(baselineExplanation.preAblationVerification, undefined);
  assert.notEqual(baselineExplanation.observed, 0);

  // 2. Ablated head output: zeroed is true, observed is 0, artifact values are all 0
  const ablatedExplanation = interventionFwd.explain({ kind: 'headOutput', token: 3, layer: 0, head: 0 }, 0);
  assert.equal(ablatedExplanation.zeroed, true);
  assert.equal(ablatedExplanation.observed, 0);
  assert.ok(ablatedExplanation.artifact?.values?.every(v => v === 0));

  // 3. Pre-ablation artifact is present and observed values match baseline
  assert.ok(ablatedExplanation.preAblationArtifact);
  assert.equal(ablatedExplanation.preAblationArtifact.kind, 'headOutputBeforeAblation');
  assert.equal(ablatedExplanation.preAblationObserved, baselineExplanation.observed);

  // 4. Derived reconstruction has DERIVED provenance
  assert.equal(ablatedExplanation.reconstructionProvenance, 'DERIVED');
  assert.equal(typeof ablatedExplanation.derivedReconstruction, 'number');

  // 5. Verification status is 'verified' using canonical float64 tolerance
  assert.ok(ablatedExplanation.preAblationVerification);
  assert.equal(ablatedExplanation.preAblationVerification.status, 'verified');
  assert.ok(ablatedExplanation.preAblationVerification.diff !== undefined);
  assert.ok(ablatedExplanation.preAblationVerification.tolerance !== undefined);
  assert.ok(ablatedExplanation.preAblationVerification.diff <= ablatedExplanation.preAblationVerification.tolerance);

  // Check all token positions and elements for head 0, layer 0
  for (let t = 0; t < fixture.tokenIds.length; t++) {
    for (let el = 0; el < interventionFwd.width; el++) {
      const exp = interventionFwd.explain({ kind: 'headOutput', token: t, layer: 0, head: 0 }, el);
      assert.equal(exp.zeroed, true);
      assert.equal(exp.reconstructionProvenance, 'DERIVED');
      assert.equal(exp.preAblationVerification?.status, 'verified');
    }
  }

  // Out of bounds element yields unavailable verification
  const outOfBoundsExp = interventionFwd.explain({ kind: 'headOutput', token: 0, layer: 0, head: 0 }, 99);
  assert.equal(outOfBoundsExp.indexValid, false);
  assert.equal(outOfBoundsExp.preAblationVerification?.status, 'unavailable');

  // Non-ablated head in the same intervention run (head 1) is not zeroed
  const head1Explanation = interventionFwd.explain({ kind: 'headOutput', token: 3, layer: 0, head: 1 }, 0);
  assert.equal(head1Explanation.zeroed, false);
  assert.equal(head1Explanation.preAblationArtifact, undefined);

  // 6. Historical run missing headOutputBeforeAblation falls back gracefully with status: 'unavailable'
  const strippedRun: RecordedRun = {
    ...ablation.interventionRun,
    artifacts: ablation.interventionRun.artifacts.filter(a => a.kind !== 'headOutputBeforeAblation'),
  };
  const strippedFwd = forwardReadModel(strippedRun, snapshot);
  const strippedExplanation = strippedFwd.explain({ kind: 'headOutput', token: 3, layer: 0, head: 0 }, 0);
  assert.equal(strippedExplanation.zeroed, true);
  assert.equal(strippedExplanation.observed, 0);
  assert.equal(strippedExplanation.preAblationArtifact, undefined);
  assert.equal(strippedExplanation.preAblationObserved, undefined);
  assert.equal(strippedExplanation.reconstructionProvenance, 'DERIVED');
  assert.ok(strippedExplanation.preAblationVerification);
  assert.equal(strippedExplanation.preAblationVerification.status, 'unavailable');

  // 7. Synthetic corrupted run where preAblationArtifact differs triggers mismatch
  const corruptedRun: RecordedRun = {
    ...ablation.interventionRun,
    artifacts: ablation.interventionRun.artifacts.map(a =>
      a.kind === 'headOutputBeforeAblation' && a.concept.token === 3
        ? { ...a, values: a.values!.map(v => v + 1.0) }
        : a
    ),
  };
  const corruptedFwd = forwardReadModel(corruptedRun, snapshot);
  const corruptedExplanation = corruptedFwd.explain({ kind: 'headOutput', token: 3, layer: 0, head: 0 }, 0);
  assert.equal(corruptedExplanation.zeroed, true);
  assert.equal(corruptedExplanation.reconstructionProvenance, 'DERIVED');
  assert.equal(corruptedExplanation.preAblationVerification?.status, 'mismatch');
});
