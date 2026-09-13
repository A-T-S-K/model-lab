import {test} from 'node:test';import assert from 'node:assert/strict';
import {ModelSession} from '../../app/worker/controller.js';import {learningReadModel,resolveParameter,targetLosses} from '../../app/spatial/learning.js';
const close=(a:number,b:number)=>assert(Math.abs(a-b)<=1e-30+1e-12*Math.abs(b));
test('C01–C07 exact source bundles, two optimizer steps, contribution accounting and derived after loss',async()=>{
 const s=new ModelSession(),tag={sessionId:'learning-C',generationId:0};await s.handle({...tag,runId:'init',command:'initialize'});
 let prior:any;
 for(let i=0;i<2;i++){
  const response=await s.handle({...tag,runId:`step${i}`,command:'train',document:'abca'});assert.equal(response.status,'result');if(response.status!=='result')return;
  const r=response.result,e=r.experiment!;
  for(const pin of [{name:'wte',row:0,column:0},{name:'layer0.attn_wq',row:0,column:0}]){
   const p=resolveParameter(r.snapshots[0],pin)!;assert(p);
   const inspected=await s.handle({...tag,runId:`inspect${i}${pin.name}`,command:'inspect',sourceRunId:e.trainingRunId,target:{kind:'gradient',parameterIndex:p.index}});assert.equal(inspected.status,'inspection');if(inspected.status!=='inspection')return;
   const m=learningReadModel(e,r.snapshots[0],r.snapshots[1],r.runs[0],r.runs[1],r.run,pin,inspected.inspection,1);assert(m.available);if(!m.available)return;
   assert.equal(m.end.state.optimizer.step,i+1);assert.equal(m.objective.rows.length,5);assert.equal(m.objective.origin,'OBSERVED');assert.equal(m.afterObjective.origin,'DERIVED');
   m.afterObjective.rows.forEach(row=>close(row.loss!,-Math.log(row.probability!)));close(m.backward.sum!,m.backward.gradient!);
   assert.equal(m.backward.visible.length,1);assert.equal(m.backward.hiddenCount,m.backward.contributions.length-1);assert.equal(m.backward.hiddenSubtotal,m.backward.contributions.slice(1).reduce((s,e)=>s+e.contribution!,0));
   assert.equal(m.adam.update!.after,m.end.state.parameters[pin.name][pin.row][pin.column]);
   if(prior){assert.equal(m.adam.update!.mBefore,prior.experiment.update.parameters[p.index].mAfter);assert.equal(m.adam.update!.vBefore,prior.experiment.update.parameters[p.index].vAfter);}
   assert.equal(learningReadModel(e,r.snapshots[1],r.snapshots[0],r.runs[0],r.runs[1],r.run,pin).available,false);
   assert.equal(targetLosses({...r.run,manifest:{...r.run.manifest,targets:[0]}},e),undefined);
  }
  prior=r;
 }
 assert.equal(resolveParameter(prior.snapshots[0],{name:'wte',row:99,column:0}),undefined);
});
