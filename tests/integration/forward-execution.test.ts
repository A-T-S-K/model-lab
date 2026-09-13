import type { Artifact } from '../../trace/types.js';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/canonical.initial.json';
import { Value } from '../../model/value.js';
import { forwardSequence, forwardBoundaries, tokenize } from '../../model/microgpt.js';
import { loadModel, createOptimizerState, snapshotTraining } from '../../model/state.js';
import { ModelSession } from '../../app/worker/controller.js';
import type { WorkerRequest, WorkerResponse } from '../../app/worker/protocol.js';
const model = () => loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
const tag = { sessionId: 'wave2', generationId: 0 };
function progress(r: WorkerResponse) { assert.equal(r.status, 'forward'); if(r.status!=='forward')throw Error();return r.progress; }
function result(r: WorkerResponse) { assert.equal(r.status, 'result'); if(r.status!=='result')throw Error();return r.result; }
async function session() { const s = new ModelSession(); await s.handle({...tag,runId:'init',command:'initialize'});return s; }

test('E01 independent primitive spies prove start has no numerical work and Q pause precedes K, V, softmax and ReLU', () => {
  const m=model(), before=snapshotTraining(m,createOptimizerState(m,fixture.optimizer));
  const seen:string[]=[]; const multiply=mock.method(Value.prototype,'mul'); const exponential=mock.method(Value.prototype,'exp'); const relu=mock.method(Value.prototype,'relu');
  try {
    const qWeight=m.parameters['layer0.attn_wq'][0][0],kWeight=m.parameters['layer0.attn_wk'][0][0],vWeight=m.parameters['layer0.attn_wv'][0][0];
    const cursor=forwardSequence(m,fixture.tokenIds,{observe:e=>seen.push(e.kind)});
    assert.equal(multiply.mock.callCount(),0);assert.deepEqual(seen,[]);
    const first=cursor.next(); assert(!first.done);assert.equal(first.value.kind,'tokenEmbedding');assert.deepEqual(seen,['tokenEmbedding']);assert.equal(multiply.mock.callCount(),0);
    for(let i=1;i<6;i++)cursor.next();
    assert.equal(seen.at(-1),'q');
    assert(multiply.mock.calls.some(c=>c.this===qWeight));
    assert(!multiply.mock.calls.some(c=>c.this===kWeight||c.this===vWeight));
    assert.equal(exponential.mock.callCount(),0);assert.equal(relu.mock.callCount(),0);
    assert.deepEqual(snapshotTraining(m,createOptimizerState(m,fixture.optimizer)),before);
    cursor.return({logits:[],probabilities:[]});
  } finally { mock.restoreAll(); }
});

test('E01–E05 worker permits, read-only inspection, exact all-vector equivalence and declared sequential traversal', async () => {
  for(const document of ['', 'abca','abcb','abcabca']) {
    const s=await session(); const fast=result(await s.handle({...tag,runId:'fast',command:'predict',document}));
    let p=progress(await s.handle({...tag,runId:'stepped',command:'startForward',document}));
    assert.equal(p.sequence,0);assert.deepEqual(p.artifacts,[]);assert.deepEqual(p.start!.snapshot.state,fast.snapshots[0].state);
    const known=await s.handle({...tag,runId:'known',command:'inspect',sourceRunId:'stepped',target:{kind:'node',nodeId:0}});
    assert.equal(known.status,'inspection'); if(known.status==='inspection')assert(known.inspection.graph?.nodes[0].parameter);
    const pending=await s.handle({...tag,runId:'future',command:'inspect',sourceRunId:'stepped',target:{kind:'artifact',artifactId:'stepped:6',index:0}});
    if(pending.status==='inspection'){assert.equal(pending.inspection.graph,null);assert.equal(pending.inspection.sourceRunId,'stepped');}
    assert.equal((await s.handle({...tag,runId:'bad-train',command:'train',document})).status,'error');
    const boundaries=forwardBoundaries(model(),tokenize(model(),document).tokenIds),all:Artifact[]=Array.from(p.artifacts);
    for(let permit=1;permit<=p.total;permit++) {
      const request: WorkerRequest={...tag,runId:`permit-${permit}`,command:'advanceForward',executionId:'stepped',permit};
      const reply=await s.handle(request);
      if(reply.status==='result') {
        const slow=reply.result;
        assert.equal(slow.run.manifest.runId,'stepped');assert.deepEqual(slow.probabilities,fast.probabilities);assert.deepEqual(slow.logits,fast.logits);
        assert.deepEqual(slow.run.artifacts.map(({id,...a})=>a),fast.run.artifacts.map(({id,...a})=>a));
        assert.deepEqual(slow.snapshots,fast.snapshots);
        assert.equal((await s.handle(request)).status,'error');break;
      }
      p=progress(reply); assert.deepEqual(p.last,boundaries[permit-1]);assert.deepEqual(p.next,boundaries[permit]);
      all.push(...p.artifacts);
      assert.equal((await s.handle(request)).status,'error');
      assert.equal((await s.handle({...request,permit:permit+2})).status,'error');
      assert.equal((await s.handle({...request,executionId:'stale',permit:permit+1})).status,'error');
      assert.equal((await s.handle({...request,generationId:-1,permit:permit+1})).status,'error');
      assert.equal((await s.handle({...request,sessionId:'other',permit:permit+1})).status,'error');
      if(p.last?.kind==='q') {
        assert(!all.some(a=>a.kind==='k'&&a.concept.token===p.last!.token));
        const art=all.at(-1)!;
        const read=await s.handle({...tag,runId:'read',command:'inspect',sourceRunId:'stepped',target:{kind:'artifact',artifactId:art.id,index:0}});
        if(read.status==='inspection'){assert.equal(read.inspection.graph?.nodes.find(n=>n.id===read.inspection.graph!.roots[0])?.value,art.values![0]);assert.equal(read.inspection.provenance,'observed');}
      }
    }
  }
});

test('E06–E07 cancel/reset/stale generations preserve training state and ordinary two-update continuation', async () => {
  const a=await session(),b=await session();
  for(let i=0;i<4;i++) {
    progress(await a.handle({...tag,runId:`partial${i}`,command:'startForward',document:'abca'}));
    for(let permit=1;permit<20;permit++)await a.handle({...tag,runId:`p${permit}`,command:'advanceForward',executionId:`partial${i}`,permit});
    await a.handle({...tag,runId:'cancel',command:'cancelForward',executionId:`partial${i}`});
    assert.equal((await a.handle({...tag,runId:'late',command:'advanceForward',executionId:`partial${i}`,permit:20})).status,'error');
  }
  for(let i=0;i<2;i++) {
    const ar=result(await a.handle({...tag,runId:`a${i}`,command:'train',document:'abca'}));
    const br=result(await b.handle({...tag,runId:`b${i}`,command:'train',document:'abca'}));
    assert.deepEqual(ar.learn,br.learn);assert.deepEqual(ar.snapshots,br.snapshots);
  }
  await a.handle({...tag,runId:'unfinished',command:'startForward',document:'a'});
  await a.handle({...tag,generationId:1,runId:'reset',command:'reset'});
  assert.equal((await a.handle({...tag,runId:'stale',command:'advanceForward',executionId:'unfinished',permit:1})).status,'error');
  const after=result(await a.handle({...tag,generationId:1,runId:'fresh',command:'predict',document:'abca'}));
  assert.deepEqual(after.snapshots[0].state,snapshotTraining(model(),createOptimizerState(model(),fixture.optimizer)));
});

test('E07 bounded repeated worker start/advance/cancel/finish releases cursors and retains at most one prediction context',async()=>{
 const s=await session();const internals=s as unknown as {active?:{context:unknown};contexts:Map<string,unknown>};
 for(let cycle=0;cycle<30;cycle++) {
  const id=`cycle${cycle}`;progress(await s.handle({...tag,runId:id,command:'startForward',document:''}));assert(internals.active);
  for(let permit=1;permit<=(cycle%3===0?24:6);permit++)await s.handle({...tag,runId:`${id}-${permit}`,command:'advanceForward',executionId:id,permit});
  if(cycle%3!==0)await s.handle({...tag,runId:`cancel${cycle}`,command:'cancelForward',executionId:id});
  assert.equal(internals.active,undefined);assert(internals.contexts.size<=1);
 }
});
