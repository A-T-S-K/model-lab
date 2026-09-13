import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ModelSession} from '../../app/worker/controller.js';
import {startGuidedBatch,guidedReadModel} from '../../app/presentation/guided-read-model.js';
import {TraceRecorder} from '../../trace/recorder.js';
for(const boundary of [1,2,3])test('C10 trace finalization failure '+boundary+' preserves accepted checkpoint',async()=>{
 const s=new ModelSession(),tag={sessionId:'finish-'+boundary,generationId:0};const init=await s.handle({...tag,runId:'init',command:'initialize'});assert.equal(init.status,'ready');if(init.status!=='ready')return;
 const finish=TraceRecorder.prototype.finish;let count=0;TraceRecorder.prototype.finish=function(){if(++count===boundary)throw new Error('injected trace assembly failure');return finish.call(this);};
 try{const failed=await s.handle({...tag,runId:'failed',command:'train',document:'abca'});assert.equal(failed.status,'error');}finally{TraceRecorder.prototype.finish=finish;}
 const check=await s.handle({...tag,runId:'check',command:'predict',document:'abca'});assert.equal(check.status,'result');if(check.status==='result')assert.equal(check.result.snapshots[0].id,init.archivedSnapshot.id);
});
test('C08 Teach baseline values retain the baseline source after an accepted intermediate update',async()=>{
 const s=new ModelSession(),tag={sessionId:'teach-source',generationId:0};await s.handle({...tag,runId:'init',command:'initialize'});
 const before=await s.handle({...tag,runId:'baseline',command:'predict',document:'abca'});assert.equal(before.status,'result');if(before.status!=='result')return;
 const batch=startGuidedBatch(before.result,['a','b','c']);const after=await s.handle({...tag,runId:'update',command:'train',document:'abca'});assert.equal(after.status,'result');if(after.status!=='result')return;
 batch.completedCount=1;
 const view=guidedReadModel(after.result,undefined,['a','b','c'],'abca',after.result.run.manifest.runId,true,true,false,batch,'train');
 assert.deepEqual(view.values,batch.baselineDistribution);assert.equal(view.source?.sourceRunId,batch.baselineRunId);assert.equal(view.source?.sourceSnapshotId,before.result.run.manifest.startingSnapshotId);assert.equal(view.source?.sourceStep,batch.startingStep);
});
test('C10 failed post-mutation snapshot assembly leaves no unacknowledged optimizer update',async()=>{
 const s=new ModelSession(),tag={sessionId:'rollback',generationId:0};const init=await s.handle({...tag,runId:'init',command:'initialize'});assert.equal(init.status,'ready');if(init.status!=='ready')return;
 const digest=crypto.subtle.digest.bind(crypto.subtle);let calls=0;
 crypto.subtle.digest=(...args:Parameters<SubtleCrypto['digest']>)=>{if(++calls===2)return Promise.reject(new Error('injected resulting snapshot failure'));return digest(...args);};
 try{const failed=await s.handle({...tag,runId:'fail',command:'train',document:'abca'});assert.equal(failed.status,'error');}finally{crypto.subtle.digest=digest;}
 const next=await s.handle({...tag,runId:'next',command:'predict',document:'abca'});assert.equal(next.status,'result');if(next.status!=='result')return;
 assert.equal(next.result.trainingStep,0);assert.equal(next.result.snapshots[0].id,init.archivedSnapshot.id);
});
test('C10 failed worker result publication rolls back, successful publication accepts exactly once',async()=>{
 const s=new ModelSession(),tag={sessionId:'publication',generationId:0};const init=await s.handle({...tag,runId:'init',command:'initialize'});assert.equal(init.status,'ready');if(init.status!=='ready')return;
 const failed=await s.handle({...tag,runId:'fail',command:'train',document:'abca'},()=>{throw new Error('injected structured-clone publication failure');});assert.equal(failed.status,'error');
 const next=await s.handle({...tag,runId:'check',command:'predict',document:'abca'});assert.equal(next.status,'result');if(next.status!=='result')return;assert.equal(next.result.snapshots[0].id,init.archivedSnapshot.id);
 let published=0;const success=await s.handle({...tag,runId:'accepted',command:'train',document:'abca'},()=>{published++;});assert.equal(success.status,'result');assert.equal(published,1);
});
