import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EvidenceStore, EvidencePlayer, IntegrationRegistry, validateRun, serializeEvidence, parseEvidence, type EvidenceRun } from '../../trace/evidence.js';
import { integrations } from '../../trace/integrations.js';
import { ModelSession } from '../../app/worker/controller.js';
import { SessionArchive, snapshotId } from '../../archive/session.js';
import { canonicalIntent } from '../../app/worker/execution-intent.js';
import type { WorkerRequest } from '../../app/worker/protocol.js';

async function canonical(){
  const session=new ModelSession();const tag={sessionId:'shared-test',generationId:0};
  await session.handle({...tag,runId:'init',command:'initialize'});
  const request:WorkerRequest={...tag,runId:'predict',command:'predict',document:'abca'};
  const response=await session.handle({...request,intent:canonicalIntent(request)});
  assert.equal(response.status,'result');if(response.status!=='result')throw Error('missing result');
  return response.result;
}
test('canonical production worker -> strict legacy codec -> same store/player -> executor-free replay preserves identities',async()=>{
  const result=await canonical(),archive=new SessionArchive();
  for(const snapshot of result.snapshots)await archive.addSnapshot(snapshot);
  await archive.addRun(result.run);
  const view=archive.evidence.get(result.run.manifest.runId),player=new EvidencePlayer(archive.evidence,view.id);
  assert.equal(view.checkpoint,result.snapshots[0].id);
  assert.equal(view.precision.compute,'float64');
  const index=view.points.findIndex(p=>p.values&&p.values.length>0);player.seek(index);
  assert.deepEqual(player.slice(),result.run.artifacts[index].values!.slice(0,16));
  const saved=serializeEvidence(archive.evidence.envelope(view.id));const disconnected=new EvidenceStore(integrations());
  await disconnected.admit(parseEvidence(saved));assert.deepEqual(disconnected.get(view.id),view);
  const bad=structuredClone(archive.evidence.envelope(view.id));
  const record=bad.record as {snapshot:{state:{optimizer:{v:number[]}}}};record.snapshot.state.optimizer.v[0]=-1;
  await assert.rejects(disconnected.admit(bad),/Adam moments/);
});

test('typed slices, immutable references, incompatible codecs, malformed evidence and stale admission are refused',async()=>{
  const result=await canonical();const store=new EvidenceStore(integrations());
  const envelope={version:1 as const,codec:'microgpt-legacy-v1',record:{run:result.run,snapshot:result.snapshots[0]}};
  const run=await store.admit(envelope),point=run.points.find(p=>p.values?.length)!;
  assert.deepEqual(store.slice(run.id,point.id,0,1),point.values!.slice(0,1));
  assert.deepEqual(store.slice(run.id,point.id,point.values!.length-1,1),point.values!.slice(-1));
  assert.throws(()=>store.slice(run.id,point.id,-1,1),/integer/);
  assert.throws(()=>store.slice(run.id,point.id,0,-1),/integer/);
  assert.throws(()=>store.slice(run.id,point.id,0,257),/integer/);
  assert.throws(()=>store.slice(run.id,point.id,point.values!.length,1),/bounds/);
  assert.throws(()=>store.slice(run.id,point.id,point.values!.length+1,0),/bounds/);
  assert.throws(()=>store.slice('other-run',point.id,0,1),/Missing run/);
  assert.throws(()=>store.slice(run.id,'missing-point',0,1),/not captured/);
  assert.match(store.capability(run.id,'uncaptured','scalar'),/Not captured.*disconnected/);
  assert.match(store.capability(run.id,point.id,'write',true),/Unsupported write/);
  await assert.rejects(store.admit({...envelope,codec:'arbitrary-imported-code'}),/Unregistered/);
  const fresh=new EvidenceStore(integrations());await assert.rejects(fresh.admit(envelope,undefined,()=>false),/Stale/);assert.equal(fresh.list().length,0);
  const generic=new EvidenceStore(new IntegrationRegistry().register({id:'validation-fixture',async decode(x){return validateRun(x);}}));
  for(const mutate of [(r:EvidenceRun)=>{r.points[0].dtype='float16' as never;},(r:EvidenceRun)=>{r.points[0].shape=[99];},(r:EvidenceRun)=>{r.points[0].dependencies=['missing'];},(r:EvidenceRun)=>{r.points[0].values=[Infinity];},(r:EvidenceRun)=>{r.points[0].axes[0].size=999;}]){
    const bad=structuredClone(run);mutate(bad);await assert.rejects(generic.admit({version:1,codec:'validation-fixture',record:bad}));
  }
});

test('negative zero roundtrips without changing canonical snapshot hashes',async()=>{
  const result=await canonical();const state=structuredClone(result.snapshots[0].state);state.optimizer.m[0]=-0;const snapshot={state,id:await snapshotId(state)};
  const run={...structuredClone(result.run),manifest:{...result.run.manifest,startingSnapshotId:snapshot.id,startingCheckpointId:snapshot.id}};
  const envelope={version:1 as const,codec:'microgpt-legacy-v1',record:{snapshot,run}};
  const store=new EvidenceStore(integrations());await store.admit(parseEvidence(serializeEvidence(envelope)));
  assert.equal(store.get(run.manifest.runId).checkpoint,snapshot.id);
});

test('real optional native capture enters the same store and replays all heads with no executor', {skip:!process.env.NATIVE_RECORDING},async()=>{
  const envelope=JSON.parse(await readFile(process.env.NATIVE_RECORDING!,'utf8'));
  const archive=new SessionArchive();const before=[...archive.snapshots];const run=await archive.evidence.admit(envelope);
  assert.deepEqual([...archive.snapshots],before);assert.equal(run.precision.storage,'F16');
  const p=new EvidencePlayer(archive.evidence,run.id);p.seek(run.points.findIndex(p=>p.id==='attention.weights'));
  assert.equal(p.current.axes[0].size,4);assert.equal(p.current.node,'gpt_neox.layers.1.attention');
  assert('tokenIds' in run.input);const n=run.input.tokenIds.length;assert.equal(archive.evidence.slice(run.id,p.current.id,0,n*n).length,n*n);
  assert.equal(archive.evidence.slice(run.id,p.current.id,n*n,n*n).length,n*n);
  const store=new EvidenceStore(integrations());await store.admit(parseEvidence(serializeEvidence(envelope)));
  assert.deepEqual(store.get(run.id),run);
  const legacy=await canonical();await store.admit({version:1,codec:'microgpt-legacy-v1',record:{run:legacy.run,snapshot:legacy.snapshots[0]}});
  assert.equal(store.compare(run.id,legacy.run.manifest.runId).compatible,false);
  assert.match(store.compare(run.id,legacy.run.manifest.runId).reasons[0],/representation differs/);
  for(const edit of [(x:typeof envelope)=>x.record.runtime='wrong',(x:typeof envelope)=>x.record.points[0].source.revision='wrong',(x:typeof envelope)=>x.record.request.epoch=-1,(x:typeof envelope)=>x.record.points[1].node='gpt_neox.layers.0',(x:typeof envelope)=>x.record.points[1].axes[0].role='key_position']){
    const bad=structuredClone(envelope);edit(bad);await assert.rejects(store.admit(bad));
  }
});
