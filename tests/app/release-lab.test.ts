import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ModelSession} from '../../app/worker/controller.js';
import {compareInputConditionedOutputs} from '../../app/presentation/input-output-comparison.js';
import {compareRuns} from '../../trace/compare.js';
import {labBaselineRefusal,labDraftRefusal} from '../../app/presentation/release-lab.js';
import {runHeadAblation} from '../../experiments/ablation.js';
import type {RecordedRun} from '../../trace/types.js';

async function witness() {
 const session=new ModelSession(),tag={sessionId:'lab-controls',generationId:2};
 const ready=await session.handle({...tag,runId:'initialize',command:'initialize'});assert.equal(ready.status,'ready');
 const predict=async(document:string,id:string)=>{const r=await session.handle({...tag,runId:id,command:'predict',document});assert.equal(r.status,'result');if(r.status!=='result')throw Error();return r.result;};
 return {session,tag,ready,predict};
}
test('input comparison binds two authentic full-support predictions and preserves strict input/target refusal',async()=>{
 const w=await witness(),a=await w.predict('abca','baseline'),b=await w.predict('aaca','changed');
 const comparison=compareInputConditionedOutputs(a.run,b.run,3,3);
 assert(comparison.compatible);assert.equal(comparison.provenance,'derived');assert.equal(comparison.rows.length,4);
 assert.deepEqual(comparison.rows.map(r=>r.before),a.probabilities[3]);assert.deepEqual(comparison.rows.map(r=>r.after),b.probabilities[3]);
 assert.equal(a.snapshots[0]!.id,b.snapshots[0]!.id);assert.equal(a.trainingStep,b.trainingStep);
 assert(!compareRuns(a.run,b.run).compatible);assert.deepEqual(compareRuns(a.run,b.run).reasons,['input differs','targets differs']);
 assert.deepEqual(comparison.inputs,[a.tokenIds,b.tokenIds]);assert.deepEqual(comparison.targets,[a.targetIds,b.targetIds]);
});
test('input comparison refuses model/state/runtime/epoch/axes, duplicate, unavailable and partial support',async()=>{
 const w=await witness(),a=await w.predict('abca','baseline'),b=await w.predict('aaca','changed');
 for(const key of ['model','numeric','runtimeRevision','runtimeVersion','startingSnapshotId','startingCheckpointId','sessionId','generationId'] as const) {
  const manifest={...b.run.manifest,[key]:key==='generationId'?77:key==='model'?{...b.run.manifest.model,version:'foreign'}:key==='numeric'?{dtype:'float64',policy:'foreign'}:'foreign'};
  assert(!compareInputConditionedOutputs(a.run,{...b.run,manifest} as RecordedRun,3,3).compatible,key);
 }
 for(const patch of [{axes:['feature']},{shape:[3]},{availability:'not_captured',values:null},{provenance:'derived'},{values:[0,0,0]}]) {
  const changed={...b.run,artifacts:b.run.artifacts.map(x=>x.kind==='probabilities'&&x.concept.token===3?{...x,...patch}:x)} as RecordedRun;
  assert(!compareInputConditionedOutputs(a.run,changed,3,3).compatible);
 }
 assert(!compareInputConditionedOutputs(a.run,b.run,20,3).compatible);
 const row=b.run.artifacts.find(x=>x.kind==='probabilities'&&x.concept.token===3)!;
 assert(!compareInputConditionedOutputs(a.run,{...b.run,artifacts:[...b.run.artifacts,row]},3,3).compatible);
});
test('null output differences are valid on an unaffected causal occurrence',async()=>{
 const w=await witness(),a=await w.predict('abca','baseline'),b=await w.predict('aaca','changed');
 const comparison=compareInputConditionedOutputs(a.run,b.run,0,0);assert(comparison.compatible);assert(comparison.rows.every(r=>r.delta===0));
});
test('accepted lineage advances on native update; old prepared baseline refuses while discard leaves baseline',async()=>{
 const w=await witness(),a=await w.predict('abca','baseline');
 const snapshot=a.snapshots[0]!,baseline={runId:a.run.manifest.runId,snapshotId:snapshot.id,sessionId:w.tag.sessionId,generationId:2,document:'abca',position:3};
 assert.equal(labBaselineRefusal(baseline,a.run,snapshot,snapshot,a.run.manifest.runtimeRevision),undefined);
 const train=await w.session.handle({...w.tag,runId:'train',command:'train',document:'abca'});assert.equal(train.status,'result');if(train.status!=='result')return;
 const current=train.result.snapshots.at(-1)!;assert.notEqual(snapshot.id,current.id);
 assert.match(labBaselineRefusal(baseline,a.run,snapshot,current,a.run.manifest.runtimeRevision)!,/stale/);
 // A disposable proposal is cancelled without changing accepted continuation.
 const start=await w.session.handle({...w.tag,runId:'proposal',command:'startTraining',document:'abca'});assert.equal(start.status,'forward');if(start.status!=='forward')return;
 await w.session.handle({...w.tag,runId:'discard',command:'cancelForward',executionId:start.progress.executionId});
 const after=await w.predict('abca','after-discard');assert.equal(after.snapshots[0]!.id,current.id);
});
test('registered head ablation retains actual all-position zeros and accepted continuation unchanged',async()=>{
 const w=await witness(),a=await w.predict('abca','baseline');
 const experiment=await runHeadAblation(a.snapshots[0]!,a.tokenIds,a.targetIds,{layer:0,head:1});
 assert(experiment.comparison.compatible);assert.equal((experiment.receipt as unknown as {target:{scope:string}}).target.scope,'all positions');
 const zero=experiment.interventionRun.artifacts.filter(x=>x.kind==='headOutput'&&x.concept.head===1);
 assert.equal(zero.length,a.tokenIds.length);assert(zero.every(x=>x.availability==='available'&&x.values?.every(v=>v===0)));
 const after=await w.predict('abca','unchanged');assert.equal(after.snapshots[0]!.id,a.snapshots[0]!.id);assert.deepEqual(after.probabilities,a.probabilities);
});
test('draft edits refuse invalid input, multiple changes and unavailable prefix without execution',()=>{
 assert.equal(labDraftRefusal('input','abca','aaca',3),undefined);
 for(const changed of ['abca','aaaa','aa','aaXa','aaaaaaa'])assert(labDraftRefusal('input','abca',changed,3));
 assert(labDraftRefusal('input','abca','abcb',3));assert(labDraftRefusal('update','a','a',3));assert(labDraftRefusal('head','abca','aaca',8));
});
test('Lab baseline read model refuses unavailable, foreign definition, altered transform and cross-session references',async()=>{
 const w=await witness(),a=await w.predict('abca','baseline');const snapshot=a.snapshots[0]!,m=a.run.manifest;
 const baseline={runId:m.runId,snapshotId:snapshot.id,sessionId:m.sessionId,generationId:m.generationId,document:'abca',position:3};
 const check=(b:typeof baseline|undefined,r:RecordedRun|undefined=a.run)=>labBaselineRefusal(b,r,snapshot,snapshot,m.runtimeRevision);
 assert(check(undefined));assert(check({...baseline,sessionId:'other'}));assert(check({...baseline,generationId:99}));assert(check({...baseline,document:'aaca'}));assert(check({...baseline,position:70}));
 assert(check(baseline,{...a.run,manifest:{...m,model:{...m.model,version:'unqualified'}}}));
 assert(check(baseline,{...a.run,manifest:{...m,model:{...m.model,architecture:{...m.model.architecture,nHead:99}}}}));
 assert(check(baseline,{...a.run,artifacts:a.run.artifacts.map(x=>x.concept.token===3&&x.kind==='probabilities'?{...x,availability:'not_captured',values:null}:x)}));
});
