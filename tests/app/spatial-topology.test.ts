import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EvidenceStore,parseEvidence,serializeEvidence} from '../../trace/evidence.js';
import {integrations,readLegacyEvidence} from '../../trace/integrations.js';
import {executeNoncanonical} from '../../app/worker/noncanonical-producer.js';
import {NONCANONICAL,pointId} from '../../trace/noncanonical.js';
import {evidenceWorldIntegration} from '../../app/spatial/integrations.js';
import {spatialEvidenceReadModel} from '../../app/spatial/bindings.js';
import {ModelSession} from '../../app/worker/controller.js';

const request={version:1 as const,integration:NONCANONICAL,profile:'microgpt-multilayer-f64-v1',sessionId:'m2-a',requestId:'topology',epoch:0,action:'predict',input:'wxyz!'};

test('M2-A full semantic identity is unique across model, run, layer, node, port and typed coordinates',async()=>{
  const envelope=await executeNoncanonical(request),store=new EvidenceStore(integrations()),run=await store.admit(envelope,request),f=evidenceWorldIntegration(run.integration)!.compose(run,envelope);
  const a={kind:'headOutput',token:5,layer:0,head:2},b={...a,layer:1};
  assert.notEqual(f.semanticId(a),f.semanticId(b));
  assert.deepEqual(f.semanticAddress(b),{modelDefinition:run.definition,node:'layer.1.headOutput.head.2',port:'output',run:run.id,invocation:'prefill:0',phase:'inference',coordinates:{position:5,layer:1,head:2}});
  assert(f.semanticNodes.some(n=>n.node==='layer.1.headOutput.head.2'));
});

test('M2-A layer 1/head 2/position 5 binds real values, causal K/V, prior residual and layer-specific owner',async()=>{
  const envelope=await executeNoncanonical(request),store=new EvidenceStore(integrations()),run=await store.admit(envelope,request),f=evidenceWorldIntegration(run.integration)!.compose(run,envelope);
  const selected={kind:'headOutput',token:5,layer:1,head:2},point=store.point(run.id,pointId('headOutput',5,1,2));
  assert.deepEqual(f.values(selected),point.values);
  assert.deepEqual(f.explain(selected,0).artifact?.id,point.id);
  const headDeps=f.upstream(selected);assert(headDeps.some(d=>d.address.kind==='attentionProbabilities'&&d.address.layer===1&&d.address.head===2));
  assert.deepEqual(headDeps.filter(d=>d.address.kind==='v').map(d=>d.address.token),[0,1,2,3,4,5]);
  const scoreDeps=f.upstream({kind:'attentionLogits',token:5,layer:1,head:2});
  assert.deepEqual(scoreDeps.filter(d=>d.address.kind==='k').map(d=>d.address.token),[0,1,2,3,4,5]);
  const prior=f.upstream({kind:'preAttentionNorm',token:5,layer:1});
  assert.deepEqual(prior,[{address:{kind:'mlpResidual',token:5,layer:0},port:'all components → mean square',type:'saved_residual'}]);
  const qDeps=f.upstream({kind:'q',token:5,layer:1});
  assert(qDeps.some(d=>d.type==='parameter'&&d.address.kind==='layer1.attn_wq'));
  assert.deepEqual(f.parameterOwners['layer1.attn_wq'],{kind:'q',layer:1});
  assert.equal(f.parameterProvenance,'pinned-source-derived');
});

test('M2-A rejects invalid coordinates instead of rebinding and disconnected replay composes identically',async()=>{
  const envelope=await executeNoncanonical(request),store=new EvidenceStore(integrations()),run=await store.admit(envelope,request);
  const source={layer:1,query:5,key:0,head:2,feature:1};
  assert.equal(spatialEvidenceReadModel(run,envelope,source).valid,true);
  for(const selection of [{...source,layer:2},{...source,head:3},{...source,query:6},{...source,key:6},{...source,feature:2}])assert.equal(spatialEvidenceReadModel(run,envelope,selection).valid,false);
  const replayStore=new EvidenceStore(integrations()),replayed=await replayStore.admit(parseEvidence(serializeEvidence(envelope))),replayEnvelope=replayStore.envelope(replayed.id);
  const live=spatialEvidenceReadModel(run,envelope,source),replay=spatialEvidenceReadModel(replayed,replayEnvelope,source,true);
  assert.deepEqual(replay.forward.values({kind:'headOutput',token:5,layer:1,head:2}),live.forward.values({kind:'headOutput',token:5,layer:1,head:2}));
  assert.equal(replay.source.relationship,'REPLAY');
});

test('M2-A legacy compatibility view retains unknown owners/dependencies and original provenance',async()=>{
  const session=new ModelSession(),tag={sessionId:'legacy-m2',generationId:0};await session.handle({...tag,runId:'init',command:'initialize'});
  const response=await session.handle({...tag,runId:'legacy',command:'predict',document:'abca'});assert.equal(response.status,'result');if(response.status!=='result')return;
  const run=await readLegacyEvidence({run:response.result.run,snapshot:response.result.snapshots[0]});
  assert(run.points.every(p=>p.owners.length===0&&p.dependencies.length===0));
  assert(run.points.every(p=>p.semantics.includes('Original recording has no explicit invocation, parameter-owner or dependency metadata')));
  assert(run.points.some(p=>p.origin==='observed'));
});
