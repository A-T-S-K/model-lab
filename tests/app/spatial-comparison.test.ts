import {test} from 'node:test';import assert from 'node:assert/strict';
import {ModelSession} from '../../app/worker/controller.js';
import {outputMetrics,outputSummary} from '../../app/spatial/comparison.js';
test('U02 read model retains worsening, pending and true-zero candidate losses without a display clamp',async()=>{
 const s=new ModelSession(),tag={sessionId:'metrics',generationId:0};await s.handle({...tag,runId:'init',command:'initialize'});
 const r=await s.handle({...tag,runId:'p',command:'predict',document:'a'});assert(r.status==='result');
 const before=r.result.run,targets=before.manifest.targets as number[];
 const edited=(probability:number)=>({...before,artifacts:before.artifacts.map(a=>a.kind==='probabilities'?{...a,values:a.values!.map((_,i)=>i===targets[a.concept.token!]?probability:(1-probability)/3)}:a)});
 const worse=edited(.0001);assert(outputMetrics(worse).mean!>outputMetrics(before).mean!);
 assert.equal(outputMetrics(edited(0)).mean,Infinity);
 assert.equal(outputMetrics({...before,artifacts:before.artifacts.filter(a=>a.kind!=='probabilities'||a.concept.token!==1)}).mean,undefined);
 const html=outputSummary({before,after:worse},1,['Current','Candidate']);assert.match(html,/target END/);assert.match(html,/Both means DERIVED/);assert.equal((html.match(/data-probability-token=/g)??[]).length,4);
});
