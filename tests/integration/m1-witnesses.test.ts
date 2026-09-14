import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EvidenceStore, EvidencePlayer, serializeEvidence, parseEvidence, validateRequest, validateRun, type EvidenceEnvelope } from '../../trace/evidence.js';
import { integrations } from '../../trace/integrations.js';
import { executeNoncanonical } from '../../app/worker/noncanonical-producer.js';
import { NONCANONICAL, pointId } from '../../trace/noncanonical.js';
import { forward } from '../../model/microgpt.js';
import { loadModel } from '../../model/state.js';
import fixture from '../../fixtures/noncanonical.initial.json';
const request={version:1 as const,integration:NONCANONICAL,profile:'microgpt-multilayer-f64-v1',sessionId:'m1-test',requestId:'noncanonical',epoch:0,action:'predict',input:'wxyz!'};
const close=(a:number,b:number)=>assert(Math.abs(a-b)<=1e-10+1e-9*Math.abs(b),`${a} != ${b}`);
test('live native noncanonical forward preserves both layers, every head and causal position through shared replay',async()=>{
  const envelope=await executeNoncanonical(request),store=new EvidenceStore(integrations());const run=await store.admit(envelope,request);
  const direct=forward(loadModel(fixture.config,fixture.parameters,fixture.parameterOrder),[5,0,1,2,3,4]);
  for(let t=0;t<6;t++){
    assert.deepEqual(store.point(run.id,pointId('logits',t)).values,direct.logits[t].map(v=>v.data));
    for(let layer=0;layer<2;layer++)for(let head=0;head<3;head++){
      const q=store.point(run.id,pointId('q',t,layer)).values!;
      const score=store.point(run.id,pointId('attentionLogits',t,layer,head));
      assert.equal(score.values!.length,t+1);assert.equal(score.dependencies.length,t+2);
      for(let key=0;key<=t;key++){
        const k=store.point(run.id,pointId('k',key,layer)).values!;
        close(score.values![key],(q[head*2]*k[head*2]+q[head*2+1]*k[head*2+1])/Math.sqrt(2));
        assert(score.dependencies.includes(pointId('k',key,layer)));
      }
    }
  }
  const disconnected=new EvidenceStore(integrations());await disconnected.admit(parseEvidence(serializeEvidence(envelope)));
  assert.deepEqual(disconnected.get(run.id),run);
  assert.match(disconnected.capability(run.id,run.points[0].id,'train'),/Unsupported train/);
  const player=new EvidencePlayer(disconnected,run.id);player.seek(run.points.findIndex(p=>p.id===pointId('headOutput',5,1,2)));assert.equal(player.slice().length,2);
  for(const mutate of [(e:any)=>e.record.run.points[8].node='layer.0.fake',(e:any)=>e.record.state.config.nHead=2,(e:any)=>e.record.run.input.tokenIds[1]=99,(e:any)=>e.record.run.points[20].axes[0].space='wrong',(e:any)=>e.record.run.request.action='train']){
    const bad=structuredClone(envelope);mutate(bad);await assert.rejects(new EvidenceStore(integrations()).admit(bad));
  }
  await assert.rejects(executeNoncanonical({...request,input:'abcdef'}));
});
const directory=process.env.WITNESS_RECORDING_DIR;
async function witness(name:string){return JSON.parse(await readFile(`${directory}/${name}.json`,'utf8'));}
test('actual float32 MLP predict/train/resume recordings roundtrip supported state and reject malformed records',{skip:!directory},async()=>{
  const store=new EvidenceStore(integrations());
  for(const name of ['predict','train','resume']){
    const envelope=await witness(name),run=await store.admit(envelope,envelope.record.run.request);
    assert('kind' in run.input);assert.equal(run.input.kind,'numeric');assert.equal(run.precision.compute,'float32');
    assert(run.checkpoint.startsWith('sha256:'));assert.equal(envelope.record.resulting.optimizer.family,'SGD');
    const replay=new EvidenceStore(integrations());await replay.admit(parseEvidence(serializeEvidence(envelope)));assert.deepEqual(replay.get(run.id),run);
    assert.match(replay.capability(run.id,'loss','write'),/Unsupported/);
    if(name!=='predict')assert(run.points.some(p=>p.phase==='backward')&&run.points.some(p=>p.phase==='update'));
  }
  const envelope=await witness('train');
  for(const mutate of [(e:any)=>e.record.starting.optimizer.family='Adam',(e:any)=>e.record.resulting.optimizer.step=9,(e:any)=>e.record.run.input.values[0].push(0),(e:any)=>e.record.run.points[0].axes[0].role='token',(e:any)=>e.record.run.points.find((p:any)=>p.id==='w1.gradient').values[0]+=1,(e:any)=>e.record.run.points[0].values[0]=0,(e:any)=>e.record.resulting.parameters.w1[0][0]+=.5,(e:any)=>e.record.run.points[0].dtype='float64',(e:any)=>e.record.run.points.pop(),(e:any)=>e.record.run.request.state={weights:[]},(e:any)=>e.record.run.runtime='unqualified']){
    const bad=structuredClone(envelope);mutate(bad);await assert.rejects(new EvidenceStore(integrations()).admit(bad));
  }
});
test('actual grouped, shape-only, opaque and unsupported fixtures use bounded queries without fabricated numbers',{skip:!directory},async()=>{
  for(const name of ['grouped','shape','opaque']){
    const envelope=await witness(name),store=new EvidenceStore(integrations());const run=await store.admit(envelope);
    const replay=new EvidenceStore(integrations());await replay.admit(parseEvidence(serializeEvidence(envelope)));assert.deepEqual(replay.get(run.id),run);
    for(const p of run.points)if(p.availability!=='available'){
      assert.equal(p.values,null);assert.throws(()=>store.slice(run.id,p.id,0,1),/not captured/);assert.match(store.capability(run.id,p.id,'slice'),/unavailable/);
    }
    if(name==='grouped'){
      assert.equal(store.point(run.id,'query').axes[0].role,'query_head');assert.equal(store.point(run.id,'key').axes[0].role,'kv_head');
      assert.deepEqual(store.slice(run.id,'mapping',0,4),[0,0,1,1]);
      for(const mutate of [(e:any)=>e.record.points[3].values[3]=2,(e:any)=>e.record.points[1].axes[0].role='query_head',(e:any)=>e.record.points[1].axes[0].space='grouped-v1:query_head']){
        const bad=structuredClone(envelope);mutate(bad);await assert.rejects(new EvidenceStore(integrations()).admit(bad));
      }
    }else{
      const bad=structuredClone(envelope);bad.record.points[1].values=[0];await assert.rejects(new EvidenceStore(integrations()).admit(bad));
    }
  }
});
test('version one remains text-only; numeric version two rejects ragged and non-f32 inputs',()=>{
  const input={kind:'numeric',values:[[1,2]],targets:[[1]]};
  assert.throws(()=>validateRequest({...request,input}));
  assert.throws(()=>validateRequest({...request,version:2,input})); // required explicit state
  assert.throws(()=>validateRequest({...request,version:2,state:null,input:{...input,values:[[.1,2]]}}));
  assert.throws(()=>validateRequest({...request,version:2,state:null,input:{...input,values:[[1,2],[1]],targets:[[1],[2]]}}));
  assert.equal(validateRequest({...request,version:2,state:null,input}).version,2);
});
