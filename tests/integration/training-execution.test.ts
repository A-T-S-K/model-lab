import { test, mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import { withTestOutput } from '../support/test-output.js';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/canonical.initial.json';
import { Value } from '../../model/value.js';
import { backwardSequence } from '../../model/autograd.js';
import { adamProposals, applyAdam } from '../../model/training.js';
import { loadModel, createOptimizerState, snapshotTraining } from '../../model/state.js';
import { ModelSession } from '../../app/worker/controller.js';
import { TraceRecorder } from '../../trace/recorder.js';
import type { WorkerRequest, WorkerResponse, ForwardProgress } from '../../app/worker/protocol.js';
const tag={sessionId:'training',generationId:0};
const p=(r:WorkerResponse)=>{assert.equal(r.status,'forward');if(r.status!=='forward')throw Error();return r.progress;};
const result=(r:WorkerResponse)=>{assert.equal(r.status,'result');if(r.status!=='result')throw Error();return r.result;};
async function setup(){const s=new ModelSession();await s.handle({...tag,runId:'init',command:'initialize'});return s;}
async function advance(s:ModelSession,progress:ForwardProgress, budget=128,stop=false,pin=0){return p(await s.handle({...tag,runId:`permit${progress.sequence}`,command:'advanceTraining',executionId:progress.executionId,permit:progress.sequence+1,budget,stop,pin}));}
async function until(s:ModelSession,progress:ForwardProgress,phase:string){for(let i=0;i<3000&&progress.training!.phase!==phase;i++)progress=await advance(s,progress);assert.equal(progress.training!.phase,phase);return progress;}
const accept=(s:ModelSession,progress:ForwardProgress,publish?:(r:WorkerResponse)=>void)=>s.handle({...tag,runId:'accept'+progress.executionId,command:'acceptTraining',executionId:progress.executionId,candidateId:progress.training!.candidateId!},publish);

test('T01 exact shared all-field mathematics and two consecutive accepted updates',async()=>{
 const fast=await setup(),slow=await setup();
 for(let i=0;i<2;i++) {
  const a=result(await fast.handle({...tag,runId:'fast'+i,command:'train',document:'abca'}));
  let progress=p(await slow.handle({...tag,runId:'slow'+i,command:'startTraining',document:'abca'}));
  const starting=progress.start!.snapshot;
  progress=await until(slow,progress,'ready');
  assert.equal(progress.training!.acceptedStep,i);
  const internal=slow as any;assert.deepEqual(snapshotTraining(internal.model,internal.optimizer),starting.state);
  const b=result(await accept(slow,progress));
  assert.deepEqual(a.learn,b.learn);assert.deepEqual(a.snapshots,b.snapshots);assert.deepEqual(a.probabilities,b.probabilities);
  for(let run=0;run<3;run++)assert.deepEqual(a.runs[run].artifacts.map(({id,...v})=>v),b.runs[run].artifacts.map(({id,...v})=>v));
  assert.equal((await accept(slow,progress)).status,'error');
  await slow.handle({...tag,runId:'latecancel',command:'cancelForward',executionId:progress.executionId});
  assert.equal(result(await slow.handle({...tag,runId:'check',command:'predict',document:'abca'})).trainingStep,i+1);
 }
});
test('T02 independent grad setters prove real ordered repeated operand writes and suspension',()=>{
 const a=new Value(3), shared=a.mul(a), out=shared.add(shared);const writes:number[]=[];let gradient=0;
 Object.defineProperty(a,'grad',{get:()=>gradient,set:v=>{writes.push(v);gradient=v;}});
 const events:any[]=[];const cursor=backwardSequence(out,e=>events.push({...e}));
 assert.deepEqual(writes,[]);cursor.next();assert.deepEqual(writes,[]);
 cursor.next();assert.equal(shared.grad,2);assert.deepEqual(writes,[]);assert.equal(events.length,2);
 cursor.next();assert.deepEqual(writes,[6,12]);assert.deepEqual(events.slice(-2).map(e=>e.operand),[0,1]);
 const frozen=structuredClone(events.map(({child,parent,...e})=>e));cursor.next();assert.deepEqual(frozen,events.map(({child,parent,...e})=>e));
});
test('T02 pinned stop happens inside chunk; inspection and old envelopes cannot advance or mutate',async()=>{
 const s=await setup();let progress=await until(s,p(await s.handle({...tag,runId:'pin',command:'startTraining',document:'abca'})),'backward');
 while(!progress.training!.contributions.length)progress=await advance(s,progress,128,true);
 assert(progress.training!.stopped);assert(progress.training!.processed<=128);assert(!progress.training!.final);
 const frozen=JSON.stringify(progress),seq=progress.sequence;
 for(let i=0;i<3;i++)await s.handle({...tag,runId:'inspect'+i,command:'inspect',sourceRunId:'pin:training',target:{kind:'node',nodeId:progress.training!.contributions.at(-1)!.child!}});
 assert.equal((s as any).training.sequence,seq);
 const next=await advance(s,progress,1);assert.equal(JSON.stringify(progress),frozen);assert.equal(next.sequence,seq+1);
});
test('T03 actual proposal read suspension, prior momentum with zero gradient, validate before writes',()=>{
 const model=loadModel(fixture.config,fixture.parameters,fixture.parameterOrder),state=createOptimizerState(model,fixture.optimizer);
 state.step=1;state.m.fill(.2);state.v.fill(.3);const before=snapshotTraining(model,state);
 const first=model.parameters[model.parameterOrder[0]][0][0],later=model.parameters[model.parameterOrder[0]][0][1];
 let reads=0;Object.defineProperty(later,'grad',{get:()=>{reads++;return 0;},set:()=>{}});
 const cursor=adamProposals(model,state);assert.equal(reads,0);
 const a=cursor.next();assert(!a.done);assert.equal(a.value.mBefore,.2);assert.equal(a.value.gradient,0);assert.notEqual(a.value.delta,0);
 // Initial finite validation visits gradients once, arithmetic for later proposals has not run.
 const validationReads=reads;cursor.next();assert.equal(reads,validationReads+1);assert.equal(first.data,before.parameters[model.parameterOrder[0]][0][0]);assert.deepEqual(snapshotTraining(model,state),before);
 let done=cursor.next();while(!done.done)done=cursor.next();
 done.value.parameters.at(-1)!.after=NaN;
 assert.throws(()=>applyAdam(model,state,done.value as any));assert.deepEqual(snapshotTraining(model,state),before);
});
for(const phase of ['baseline forward','training forward','loss','backward','optimizer proposal','candidate application','candidate forward','ready'])test('T04 cancel at '+phase+' preserves full accepted state and releases transaction',async()=>{
 const s=await setup();let progress=p(await s.handle({...tag,runId:'cancel',command:'startTraining',document:'abca'}));const before=progress.start!.snapshot;
 progress=await until(s,progress,phase);if(['backward','optimizer proposal','candidate forward'].includes(phase))progress=await advance(s,progress,1);
 await s.handle({...tag,runId:'cancel-now',command:'cancelForward',executionId:'cancel'});assert.equal((s as any).training,undefined);
 assert.deepEqual(result(await s.handle({...tag,runId:'check',command:'predict',document:'abca'})).snapshots[0],before);
});
test('T05/T06 Ready blocks permits and commands; identity checks, publication failure, cancel ordering',async()=>{
 const s=await setup();let progress=p(await s.handle({...tag,runId:'race',command:'startTraining',document:''}));const before=progress.start!.snapshot;
 for(const override of [{sessionId:'wrong'},{generationId:1},{executionId:'wrong'},{permit:2}]) {
  const r=await s.handle({...tag,runId:'bad',command:'advanceTraining',executionId:'race',permit:1,budget:128,pin:0,stop:false,...override} as WorkerRequest);assert.equal(r.status,'error');assert.equal((s as any).training.sequence,0);
 }
 progress=await until(s,progress,'ready');
 assert.equal((await s.handle({...tag,runId:'extra',command:'advanceTraining',executionId:'race',permit:progress.sequence+1,budget:128,pin:0,stop:false})).status,'error');
 assert.equal((await s.handle({...tag,runId:'train',command:'train',document:''})).status,'error');
 assert.equal((await accept(s,progress,()=>{throw Error('publication failure');})).status,'error');
 assert.deepEqual(result(await s.handle({...tag,runId:'check',command:'predict',document:''})).snapshots[0],before);
 progress=await until(s,p(await s.handle({...tag,runId:'race2',command:'startTraining',document:''})),'ready');
 const [accepted,cancelled]=await Promise.all([accept(s,progress),s.handle({...tag,runId:'cancel',command:'cancelForward',executionId:'race2'})]);
 assert.equal(accepted.status,'result');assert.equal(cancelled.status,'cancelled');assert.equal((s as any).optimizer.step,1);
});
for(const failure of ['hash','assembly','candidate-forward','application'])test('T06 injected '+failure+' failure releases candidate and retains authority',async()=>{
 const s=await setup();let progress=p(await s.handle({...tag,runId:'fault',command:'startTraining',document:''}));const before=progress.start!.snapshot;
 progress=await until(s,progress,failure==='assembly'?'candidate forward':'candidate application');
 const restores:(()=>void)[]=[];
 if(failure==='hash'){const original=crypto.subtle.digest;crypto.subtle.digest=()=>Promise.reject(Error('hash'));restores.push(()=>{crypto.subtle.digest=original;});}
 if(failure==='assembly'){const original=TraceRecorder.prototype.finish;TraceRecorder.prototype.finish=()=>{throw Error('assembly');};restores.push(()=>{TraceRecorder.prototype.finish=original;});}
 if(failure==='application')(s as any).training.update.parameters.at(-1).after=NaN;
 if(failure==='candidate-forward'){progress=await advance(s,progress);const original=Value.prototype.mul;Value.prototype.mul=()=>{throw Error('candidate-forward');};restores.push(()=>{Value.prototype.mul=original;});}
 try{let response:WorkerResponse;do{response=await s.handle({...tag,runId:'fault-permit',command:'advanceTraining',executionId:'fault',permit:progress.sequence+1,budget:128,pin:0,stop:false});if(response.status==='forward')progress=response.progress;}while(response.status==='forward');assert.equal(response.status,'error');}finally{restores.forEach(f=>f());}
 assert.equal((s as any).training,undefined);assert.deepEqual(result(await s.handle({...tag,runId:'check',command:'predict',document:''})).snapshots[0],before);
});
for(const document of ['', 'abcb','abcabca'])test('T07 input coverage '+JSON.stringify(document),async()=>{
 const fast=await setup(),slow=await setup();const a=result(await fast.handle({...tag,runId:'fast',command:'train',document}));
 const progress=await until(slow,p(await slow.handle({...tag,runId:'slow',command:'startTraining',document})),'ready');const b=result(await accept(slow,progress));assert.deepEqual(a.learn,b.learn);assert.deepEqual(a.snapshots,b.snapshots);
});

test('T07 pin can change read-only to non-embedding and proposals stop in parameter order',async()=>{
 const s=await setup();let progress=await until(s,p(await s.handle({...tag,runId:'nonembedding',command:'startTraining',document:'abca'})),'optimizer proposal');
 const index=(s as any).training.working.model.parameterOrder.slice(0,(s as any).training.working.model.parameterOrder.indexOf('layer0.attn_wq')).reduce((n:number,name:string)=>n+(s as any).training.working.model.parameters[name].flat().length,0);
 const seq=progress.sequence;
 progress=p(await s.handle({...tag,runId:'focus',command:'inspectTraining',executionId:progress.executionId,pin:index}));
 assert.equal(progress.sequence,seq);assert.equal(progress.training!.proposal,undefined);
 do { progress=await advance(s,progress,128,true,index); } while (!progress.training!.stopped);assert(progress.training!.stopped);assert.equal(progress.training!.proposal!.name,'layer0.attn_wq');
 assert.equal(progress.training!.proposal!.index,index);assert.equal((s as any).training.proposalValues.length,index+1);
});
test('T10 repeated bounded accept/cancel cycles and measured worker permits',async()=>{
 await withTestOutput(fileURLToPath(new URL('../../', import.meta.url)), process.env.TRAINING_EVIDENCE_DIR, async output=>{
 const s=await setup();const durations:number[]=[],accepts:number[]=[],fast:number[]=[];
 for(let cycle=0;cycle<12;cycle++) {
  let progress=p(await s.handle({...tag,runId:'resource'+cycle,command:'startTraining',document:''}));
  while(progress.training!.phase!==(cycle%2?'ready':'optimizer proposal')) {const start=performance.now();progress=await advance(s,progress);durations.push(performance.now()-start);assert(progress.training!.processed<=128);assert(progress.training!.contributions.length<=8);}
  if(cycle%2){const start=performance.now();await accept(s,progress);accepts.push(performance.now()-start);}else await s.handle({...tag,runId:'cancel',command:'cancelForward',executionId:progress.executionId});
  assert.equal((s as any).training,undefined);assert((s as any).contexts.size<=2);
 }
 for(let i=0;i<12;i++){const start=performance.now();await s.handle({...tag,runId:'fast'+i,command:'train',document:'abca'});if(i>1)fast.push(performance.now()-start);}
 await output.write('worker-performance.json',JSON.stringify({method:'12 one-position cycles alternating proposal cancel / acceptance; per-permit wall time includes progress copying, excludes transport/UI. Then 2 warmups and 10 ordinary abca Learn requests on same session.',permits:durations.length,maxPermitMs:Math.max(...durations),meanPermitMs:durations.reduce((a,b)=>a+b,0)/durations.length,maxAcceptMs:Math.max(...accepts),fastLearnMs:fast},null,2));
 });
});
test('T06 cancelled Ready rejects late acceptance and reset invalidates the generation',async()=>{
 const s=await setup();let progress=await until(s,p(await s.handle({...tag,runId:'cancel-first',command:'startTraining',document:''})),'ready');
 await s.handle({...tag,runId:'cancel',command:'cancelForward',executionId:progress.executionId});assert.equal((await accept(s,progress)).status,'error');assert.equal((s as any).optimizer.step,0);
 progress=p(await s.handle({...tag,runId:'reset-active',command:'startTraining',document:''}));await s.handle({...tag,generationId:1,runId:'reset',command:'reset'});
 assert.equal((await s.handle({...tag,runId:'old',command:'advanceTraining',executionId:progress.executionId,permit:1,budget:1,pin:0,stop:false})).status,'error');assert.equal((s as any).training,undefined);
});

test('U01 Ready endpoints are the prepared immutable runs, never admitted before explicit acceptance',async()=>{
 const s=await setup();let progress=p(await s.handle({...tag,runId:'ready-outputs',command:'startTraining',document:'abca'}));
 const start=progress.start!.snapshot;assert.equal(progress.training!.readyOutputs,undefined);
 progress=await until(s,progress,'ready');const pair=progress.training!.readyOutputs!;
 assert(pair);assert.equal(pair.starting.id,start.id);assert.equal(pair.before.manifest.startingSnapshotId,start.id);
 assert.equal(pair.after.manifest.startingSnapshotId,progress.training!.candidateId);
 assert.throws(()=>{(pair.before.artifacts as any[]).pop();});
 assert.deepEqual(snapshotTraining((s as any).model,(s as any).optimizer),start.state);
 const accepted=result(await accept(s,progress));assert.deepEqual(pair.before,accepted.runs[0]);assert.deepEqual(pair.after,accepted.run);
});

for(const repeated of [true,false])test('S03 synthetic worker stop retains '+(repeated?'both repeated operands':'genuine zero occurrence'),async()=>{
 const s=await setup();let progress=await until(s,p(await s.handle({...tag,runId:'synthetic',command:'startTraining',document:'a'})),'backward seed');
 // Only this fixture replaces the objective, before the existing worker callback is installed.
 const transaction=(s as any).training,parameter=transaction.working.model.parameters.wte[0][0];
 transaction.objectiveResult.mean=repeated?parameter.mul(parameter):parameter.mul(0);
 progress=await advance(s,progress,1);assert.equal(progress.training!.phase,'backward');
 progress=await advance(s,progress,128,true);const t=progress.training!;
 assert(t.stopped&&!t.final);assert.equal(t.processed,1);assert.equal(t.contributions.length,repeated?2:1);
 assert.deepEqual(t.contributions.map(c=>c.operand),repeated?[0,1]:[0]);
 assert.equal(t.gradient,t.contributions.at(-1)!.after);
 if(repeated)assert.equal(t.contributions[1].before,t.contributions[0].after);else assert.equal(t.contributions[0].contribution,0);
 await s.handle({...tag,runId:'cancel-synthetic',command:'cancelForward',executionId:progress.executionId});
});
