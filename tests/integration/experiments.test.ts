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

test('U04/U05 both heads and short/maximum contexts preserve upstream and copy actual zeroed channels into downstream computation',async()=>{
 for(const head of [0,1])for(const input of [[3],[3,0,1,2,0,1,2,0]]){
  const snapshot=await initial(),saved=JSON.stringify(snapshot);
  const e=await runHeadAblation(snapshot,input,input.map((_,i)=>input[i+1]??3),{layer:0,head});
  assert.equal(JSON.stringify(snapshot),saved);
  for(const key of ['startingSnapshotId','input','targets','model','numeric','runtimeRevision'] as const)assert.deepEqual(e.baselineRun.manifest[key],e.interventionRun.manifest[key]);
  const read=(run:typeof e.baselineRun,kind:string,token:number,h?:number)=>run.artifacts.find(a=>a.kind===kind&&a.concept.token===token&&(h===undefined||a.concept.head===h))!.values!;
  for(let token=0;token<input.length;token++){
   for(const kind of ['q','k','v','attentionLogits','attentionProbabilities'])assert.deepEqual(e.baselineRun.artifacts.filter(a=>a.kind===kind&&a.concept.token===token).map(a=>a.values),e.interventionRun.artifacts.filter(a=>a.kind===kind&&a.concept.token===token).map(a=>a.values));
   assert.deepEqual(read(e.interventionRun,'headOutput',token,head),[0,0,0,0]);
   assert.deepEqual(read(e.interventionRun,'headOutput',token,1-head),read(e.baselineRun,'headOutput',token,1-head));
   const concat=[...read(e.interventionRun,'headOutput',token,0),...read(e.interventionRun,'headOutput',token,1)];
   assert.deepEqual(read(e.interventionRun,'attentionOutput',token),concat);
   const projected=snapshot.state.parameters['layer0.attn_wo'].map(row=>row.reduce((s,w,i)=>s+w*concat[i],0));
   assert.deepEqual(read(e.interventionRun,'attentionProjection',token),projected);
  }
 }
});

test('U05 a head already zero is a valid no-change experiment; U06 historical scalar remains intervention-bound',async()=>{
 const {inspectHistorical}=await import('../../app/worker/inspector.js');
 const initialSnapshot=await initial();const state=structuredClone(initialSnapshot.state);
 state.parameters['layer0.attn_wv']=state.parameters['layer0.attn_wv'].map(row=>row.map(()=>0));
 const snapshot=await archiveSnapshot(state),saved=JSON.stringify(snapshot);
 const e=await runHeadAblation(snapshot,[3,0],[0,3],{layer:0,head:1});
 for(const a of e.baselineRun.artifacts){const b=e.interventionRun.artifacts.find(b=>JSON.stringify(b.concept)===JSON.stringify(a.concept));assert.deepEqual(b?.values,a.values);}
 const artifact=e.interventionRun.artifacts.find(a=>a.kind==='headOutput'&&a.concept.head===1)!;
 const evidence=await inspectHistorical({command:'inspect',sessionId:'inspect-arm',generationId:0,runId:'inspect',snapshot,run:e.interventionRun,target:{kind:'artifact',artifactId:artifact.id,index:0},backward:false});
 assert.equal(evidence.availability,'available');assert.equal(evidence.sourceRunId,e.interventionRun.manifest.runId);assert.equal(evidence.verification?.verified,true);
 assert.equal(JSON.stringify(snapshot),saved);
});
