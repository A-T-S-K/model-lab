import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EvidenceStore,evidenceHash,parseEvidence,serializeEvidence} from '../../trace/evidence.js';
import {integrations} from '../../trace/integrations.js';

const path=process.env.NATIVE_GENERATION_RECORDING;
async function recording(){return JSON.parse(await readFile(path!,'utf8'));}
function hasLargeNumberArray(value:unknown):boolean{return Array.isArray(value)?(value.length>256&&value.every(item=>typeof item==='number'))||value.some(hasLargeNumberArray):Boolean(value&&typeof value==='object'&&Object.values(value).some(hasLargeNumberArray));}

test('native bounded generation admits, replays and keeps invocation/step/epoch/selection identities separate',{skip:!path},async()=>{
  const envelope=await recording(),store=new EvidenceStore(integrations()),run=await store.admit(envelope),record=envelope.record,generation=record.generation;
  assert.equal(run.request.action,'generate');assert.equal(run.request.epoch,generation.cancellationEpoch);assert.equal(generation.cancellationEpoch,37);
  assert.deepEqual(generation.invocations.map((value:any)=>value.identity),['prefill:0','generation:1','generation:2']);
  assert.deepEqual(generation.invocations.map((value:any)=>value.generatedStep),[0,1,2]);
  assert.notEqual(generation.invocations[1].generatedStep,generation.cancellationEpoch);
  assert.deepEqual(generation.generated.tokenIds,[327,253]);
  assert.deepEqual(generation.invocations[0].effectivePrefixIds,[510,5798,2206]);
  assert.deepEqual(generation.invocations[1].effectivePrefixIds,[510,5798,2206]);
  assert.deepEqual(generation.invocations[2].effectivePrefixIds,[510,5798,2206,327]);
  const originalLogits=record.run.points.filter((point:any)=>point.id.endsWith('/logits'));
  for(const point of originalLogits){const retained=store.point(run.id,point.id);assert.equal(retained.shape[0],50304);assert.equal(retained.origin,'observed');assert.equal(retained.values,null);assert(retained.payload);assert.equal(retained.payload.byteLength,50304*4);assert.equal(retained.payload.dtype,'float32');assert(store.payloads.has(retained.payload.contentId));assert.deepEqual(store.slice(run.id,point.id,50303,1),[point.values[50303]]);}
  for(const step of [1,2]){const invocation=generation.invocations[step],logits=store.point(run.id,invocation.choice.sourceLogitsOccurrence),choice=store.point(run.id,`generation:${step}/choice`);assert.equal(choice.origin,'derived');assert.deepEqual(choice.dependencies,[logits.id]);assert.equal(choice.values![0],invocation.choice.chosenOutputIndex);assert.equal(invocation.choice.distribution.support,50304);assert(invocation.choice.distribution.omittedMass>0);}
  assert.deepEqual(generation.cache,{capability:'unsupported',qualified:false,strategy:'full-prefix-reexecution',useCache:false,retainedState:false});
  assert.equal(store.contentId(run.id),await evidenceHash(envelope));assert.equal(store.hasEnvelope(run.id),false);assert.throws(()=>store.envelope(run.id),/not retained/);
  assert.equal(hasLargeNumberArray({run,metadata:store.metadataEnvelope(run.id)}),false);assert(!run.points.some(point=>Array.isArray(point.values)&&point.values.length>256));
  const qkvOriginal=record.run.points.find((point:any)=>point.id==='generation:2/attention.qkv'),qkv=store.point(run.id,qkvOriginal.id);assert(qkv.payload);assert.equal(qkv.values,null);assert.deepEqual(store.slice(run.id,qkv.id,511,8),qkvOriginal.values.slice(511,519));
  const replay=new EvidenceStore(integrations()),replayed=await replay.admit(parseEvidence(serializeEvidence(envelope)));assert.deepEqual(replayed,run);assert.deepEqual(replay.slice(run.id,'generation:2/logits',50303,1),store.slice(run.id,'generation:2/logits',50303,1));assert.equal(replayed.id,record.run.id);assert.equal(replayed.request.requestId,record.run.request.requestId);
});

test('same deterministic generation in another request remains a distinct execution occurrence',{skip:!path},async()=>{
  const first=await recording(),second=structuredClone(first);second.record.run.request.requestId='qualification-generate-repeat';second.record.run.id='qualification:qualification-generate-repeat';
  const store=new EvidenceStore(integrations()),a=await store.admit(first),b=await store.admit(second);
  assert.notEqual(a.id,b.id);assert.notEqual(a.request.requestId,b.request.requestId);assert.deepEqual(first.record.generation.generated.tokenIds,second.record.generation.generated.tokenIds);
  assert.equal(a.points.find(point=>point.id==='generation:1/logits')!.invocation,b.points.find(point=>point.id==='generation:1/logits')!.invocation);
});

test('generation codec refuses malformed identities, lineage, policy, choices, labels and bindings without repair',{skip:!path},async()=>{
  const original=await recording();
  const mutations:[string,(value:any)=>void][]=[
    ['profile',(value)=>{value.record.run.profile='unsupported';value.record.run.request.profile='unsupported';}],
    ['action',(value)=>{value.record.run.request.action='train';}],
    ['zero requested tokens',(value)=>{value.record.run.request.generation.maxNewTokens=0;}],
    ['excess requested tokens',(value)=>{value.record.run.request.generation.maxNewTokens=3;}],
    ['malformed configuration',(value)=>{value.record.run.request.generation.temperature=1;}],
    ['selection policy',(value)=>{value.record.generation.selectionPolicy.identity='top-p-v1';}],
    ['effective prefix',(value)=>{value.record.generation.invocations[2].effectivePrefixIds[3]=999;}],
    ['non-argmax choice',(value)=>{value.record.generation.invocations[1].choice.chosenOutputIndex=1;}],
    ['out-of-range choice',(value)=>{value.record.generation.invocations[1].choice.chosenOutputIndex=50304;}],
    ['repeated invocation',(value)=>{value.record.generation.invocations[2].identity='generation:1';}],
    ['invocation step mismatch',(value)=>{value.record.generation.invocations[2].generatedStep=1;}],
    ['epoch as generated step',(value)=>{value.record.generation.invocations[1].generatedStep=value.record.generation.cancellationEpoch;}],
    ['missing previous choice',(value)=>{value.record.generation.invocations[2].dependsOnChoice=null;}],
    ['checkpoint',(value)=>{value.record.run.checkpoint='sha256:wrong';}],
    ['runtime',(value)=>{value.record.run.runtime='sha256:wrong';}],
    ['malformed logits',(value)=>{value.record.run.points.find((point:any)=>point.id==='generation:1/logits').values.pop();}],
    ['duplicate point',(value)=>{value.record.run.points[1].id=value.record.run.points[0].id;}],
  ];
  for(const [name,mutate] of mutations){const value=structuredClone(original);mutate(value);await assert.rejects(new EvidenceStore(integrations()).admit(value),/./,name);}
  const unmapped=structuredClone(original),invocation=unmapped.record.generation.invocations[1],logits=unmapped.record.run.points.find((point:any)=>point.id==='generation:1/logits');logits.values[50303]=Math.fround(Math.max(...logits.values)+1);invocation.choice.chosenOutputIndex=50303;invocation.choice.tokenizerLabel='fabricated';invocation.choice.tokenizerLabelAvailable=true;unmapped.record.generation.generated.tokenIds[0]=50303;unmapped.record.generation.generated.tokenizerLabels[0]='fabricated';unmapped.record.run.points.find((point:any)=>point.id==='generation:1/choice').values[0]=50303;await assert.rejects(new EvidenceStore(integrations()).admit(unmapped),/Fabricated tokenizer label/);
  await assert.rejects(new EvidenceStore(integrations()).admit(original,undefined,()=>false),/Stale evidence admission/);
});
