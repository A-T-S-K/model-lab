import assert from 'node:assert/strict';
import fixture from '../fixtures/canonical.initial.json';
import { archiveSnapshot } from '../archive/session.js';
import { createOptimizerState, loadModel, snapshotTraining } from '../model/state.js';
import { runHeadAblation } from '../experiments/ablation.js';
import { runPoisoningTrial, type PoisoningOptions, type PrefixEvaluation } from '../experiments/poisoning.js';

const model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
const initial = await archiveSnapshot(snapshotTraining(model, createOptimizerState(model, fixture.optimizer)));
const ablationStart = performance.now();
const ablation = await runHeadAblation(initial, fixture.tokenIds, fixture.targetIds, { layer: 0, head: 0 });
const ablationMilliseconds = performance.now() - ablationStart;
assert.deepEqual(ablation, await runHeadAblation(initial, fixture.tokenIds, fixture.targetIds, { layer: 0, head: 0 }));
const maximum = (kind: string) => Math.max(...ablation.comparison.artifacts.filter(pair => pair.before?.kind === kind).flatMap(pair => pair.deltas?.map(Math.abs) ?? []));
const schedule = Array.from({ length: 50 }, (_, step) => ['abca', 'bcab', 'cabc', 'abab'][step % 4]);
const design: PoisoningOptions = { id: 'substitution-50', schedule,
  substitutions: schedule.flatMap((document, step) => step % 4 === 0 ? [{ step, original: document, replacement: 'abcc' }] : []),
  triggeredPrefix: 'abc', controlPrefixes: ['bca', 'cab'], desiredToken: 'c', cleanDocuments: ['abca', 'bcab', 'cabc', 'abab'] };
const poisoningStart = performance.now();
const trial = await runPoisoningTrial(initial, design);
const poisoningMilliseconds = performance.now() - poisoningStart;
const repeated = await runPoisoningTrial(initial, design);
assert.deepEqual(trial.report, repeated.report);
const concise = (value: PrefixEvaluation) => ({ prefix: value.prefix, clean: value.cleanArmProbability, substituted: value.substitutedArmProbability, delta: value.delta });
console.log(JSON.stringify({ runtime: process.version, initialSnapshotId: initial.id,
  ablation: { milliseconds: ablationMilliseconds, exactRepeat: true, maxAbsoluteLogitDelta: maximum('logits'),
    maxAbsoluteProbabilityDelta: maximum('probabilities'), maxAbsoluteResidualDelta: maximum('attentionResidual') },
  poisoning: { milliseconds: poisoningMilliseconds, exactRepeat: true, updatesPerArm: schedule.length,
    substitutionCount: design.substitutions.length, cleanFinalSnapshotId: trial.report.cleanFinalSnapshotId,
    substitutedFinalSnapshotId: trial.report.substitutedFinalSnapshotId, triggered: concise(trial.report.triggered),
    controls: trial.report.controls.map(concise), cleanTask: trial.report.cleanTask,
    archivedSnapshots: trial.archive.snapshots.size, archivedRuns: trial.archive.runs.size,
    archivedLearningExperiments: trial.archive.learningExperiments.size } }, null, 2));
