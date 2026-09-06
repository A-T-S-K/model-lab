import { test } from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/canonical.initial.json';
import { archiveSnapshot, snapshotId } from '../../archive/session.js';
import { createOptimizerState, loadModel, snapshotTraining } from '../../model/state.js';
import { runHeadAblation } from '../../experiments/ablation.js';
import { runPoisoningTrial, type PoisoningOptions } from '../../experiments/poisoning.js';

async function initial() {
  const model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
  return archiveSnapshot(snapshotTraining(model, createOptimizerState(model, fixture.optimizer)));
}

test('head ablation is an observed matched experiment with only the declared head changed at its boundary', async () => {
  const snapshot = await initial();
  const result = await runHeadAblation(snapshot, fixture.tokenIds, fixture.targetIds, { layer: 0, head: 0 });
  const repeated = await runHeadAblation(snapshot, fixture.tokenIds, fixture.targetIds, { layer: 0, head: 0 });
  assert.deepEqual(result, repeated);
  assert.equal(result.startingSnapshotId, await snapshotId(snapshot.state));
  assert.equal(result.provenance, 'observed'); assert.equal(result.comparison.compatible, true);
  assert.equal(result.baselineRun.manifest.intervention, undefined);
  assert.equal(result.interventionRun.manifest.intervention !== undefined, true);
  assert.equal(result.baselineRun.manifest.startingSnapshotId, result.interventionRun.manifest.startingSnapshotId);
  assert.ok(result.baselineRun.artifacts.every(artifact => artifact.provenance === 'observed'));
  assert.ok(result.interventionRun.artifacts.every(artifact => artifact.provenance === 'observed'));
  for (const kind of ['q', 'k', 'v', 'attentionLogits', 'attentionProbabilities']) {
    assert.deepEqual(result.baselineRun.artifacts.filter(a => a.kind === kind).map(a => a.values),
      result.interventionRun.artifacts.filter(a => a.kind === kind).map(a => a.values));
  }
  assert.ok(result.interventionRun.artifacts.filter(a => a.kind === 'headOutput' && a.concept.head === 0).every(a => a.values!.every(value => value === 0)));
  assert.ok(result.comparison.artifacts.some(pair => pair.before?.kind === 'logits' && pair.deltas?.some(delta => delta !== 0)));
  assert.ok(result.comparison.artifacts.some(pair => pair.before?.kind === 'attentionResidual' && pair.deltas?.some(delta => delta !== 0)));
  assert.throws(() => { (result.selection as { head: number }).head = 1; }, TypeError);
  await assert.rejects(runHeadAblation({ ...snapshot, id: 'invalid' }, fixture.tokenIds, fixture.targetIds, { layer: 0, head: 0 }), /hash/);
  await assert.rejects(runHeadAblation(snapshot, fixture.tokenIds, fixture.targetIds, { layer: 0, head: 8 }), /ablation/i);
});

test('data substitution retains matched continuation and authentic triggered/control/clean evidence', async () => {
  const snapshot = await initial();
  const options: PoisoningOptions = { id: 'small-research', schedule: ['abca', 'bcab', 'cabc', 'abab'],
    substitutions: [{ step: 0, original: 'abca', replacement: 'abcc' }], triggeredPrefix: 'abc', controlPrefixes: ['bca', 'cab'],
    desiredToken: 'c', cleanDocuments: ['abca', 'bcab', 'cabc', 'abab'] };
  const { report, archive } = await runPoisoningTrial(snapshot, options);
  const repeat = await runPoisoningTrial(snapshot, options);
  assert.deepEqual(report, repeat.report);
  assert.equal(report.updatesPerArm, 4); assert.equal(archive.learningExperiments.size, 8);
  assert.equal(report.startingSnapshotId, snapshot.id);
  const clean = archive.snapshots.get(report.cleanFinalSnapshotId)!.state;
  const substituted = archive.snapshots.get(report.substitutedFinalSnapshotId)!.state;
  for (const key of ['step', 'learningRate', 'beta1', 'beta2', 'epsilon', 'numSteps', 'datasetCursor', 'rngState'] as const) assert.equal(clean.optimizer[key], substituted.optimizer[key]);
  assert.equal(clean.optimizer.step, snapshot.state.optimizer.step + 4);
  assert.deepEqual(clean.parameterOrder, substituted.parameterOrder);
  assert.notEqual(report.cleanFinalSnapshotId, report.substitutedFinalSnapshotId);
  for (const evaluation of [report.triggered, ...report.controls]) {
    assert.equal(evaluation.comparison.compatible, true);
    assert.equal(evaluation.delta, evaluation.substitutedArmProbability - evaluation.cleanArmProbability);
    const run = archive.runs.get(evaluation.substitutedRunId)!;
    const last = run.artifacts.filter(artifact => artifact.kind === 'probabilities').at(-1)!;
    assert.equal(evaluation.substitutedArmProbability, last.values![fixture.config.vocabulary.indexOf(options.desiredToken)]);
  }
  const means = report.cleanTask.runIds.filter(id => id.endsWith(':clean')).map(id => archive.runs.get(id)!.artifacts.find(a => a.kind === 'meanLoss')!.values![0]);
  assert.equal(report.cleanTask.cleanArmMeanLoss, means.reduce((a, b) => a + b, 0) / means.length);
  await assert.rejects(runPoisoningTrial(snapshot, { ...options, substitutions: [{ step: 0, original: 'wrong', replacement: 'abcc' }] }), /substitution/);
});
