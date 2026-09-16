import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceStore, IntegrationRegistry, validateRun } from '../../trace/evidence.js';
import { InMemoryNumericalPayloadStore, MAX_PAYLOAD_SLICE_VALUES, validatePayloadForPoint,
  type NumericalPayloadDescriptor } from '../../trace/payload.js';

function float32Bytes(values: readonly number[]): Uint8Array {
  const buffer=new ArrayBuffer(values.length*4),view=new DataView(buffer);values.forEach((value,index)=>view.setFloat32(index*4,value,true));return new Uint8Array(buffer);
}

test('portable little-endian payloads roundtrip float64, float32, int32 and negative zero exactly',async()=>{
  const store=new InMemoryNumericalPayloadStore();
  const f64=[1.25,-2.5,0,-0],d64=await store.put('float64',f64),r64=store.slice(d64,0,f64.length);
  assert.deepEqual(r64,f64);assert(Object.is(r64[3],-0));assert.equal(d64.elementEncoding,'ieee-754-binary64');assert.equal(d64.byteLength,32);
  const f32=[Math.fround(1.25),Math.fround(-2.75),0,-0],d32=await store.put('float32',f32),r32=store.slice(d32,0,f32.length);
  assert.deepEqual(r32,f32);assert(Object.is(r32[3],-0));assert.equal(d32.elementEncoding,'ieee-754-binary32');assert.equal(d32.byteLength,16);
  const i32=[-(2**31),-17,0,2**31-1],di32=await store.put('int32',i32);
  assert.deepEqual(store.slice(di32,0,i32.length),i32);assert.equal(di32.elementEncoding,'signed-int32');assert.equal(di32.byteLength,16);
  for(const descriptor of [d64,d32,di32]){assert.equal(descriptor.byteOrder,'little-endian');assert.equal(descriptor.layout,'row-major');assert.equal(descriptor.format,'model-lab-numerical-payload-v1');}
});

test('payload identity covers decoding metadata, bytes and deterministic deduplication',async()=>{
  const store=new InMemoryNumericalPayloadStore(),float=await store.put('float32',[1]),integer=await store.put('int32',[1065353216]),again=await store.put('float32',[1]);
  assert.notEqual(float.contentId,integer.contentId,'identical raw bytes under float32 and int32 must have different identities');
  assert.equal(again.contentId,float.contentId);assert.equal(store.metadata(float.contentId),float);
  const imported=new InMemoryNumericalPayloadStore(),copy=await imported.importPayload(float,float32Bytes([1]));assert.deepEqual(copy,float);assert.deepEqual(imported.slice(copy,0,1),[1]);
  const reordered=Object.fromEntries(Object.entries(float).reverse());assert.equal((await imported.importPayload(reordered,float32Bytes([1]))).contentId,float.contentId);
});

test('payload metadata, bytes, shape, finite policy and int32 range tampering refuse',async()=>{
  const store=new InMemoryNumericalPayloadStore(),bytes=float32Bytes([1,-0]),descriptor=await store.put('float32',[1,-0]);
  const rejectDescriptor=(edit:(value:any)=>void,pattern:RegExp)=>{const value=structuredClone(descriptor);edit(value);assert.throws(()=>validatePayloadForPoint(value,'float32',[2]),pattern);};
  rejectDescriptor(value=>value.format='unknown',/format/);
  rejectDescriptor(value=>value.dtype='float16',/dtype/);
  rejectDescriptor(value=>value.byteOrder='native',/byte order/);
  rejectDescriptor(value=>value.layout='column-major',/layout/);
  rejectDescriptor(value=>value.byteLength=7,/byte-length/);
  rejectDescriptor(value=>value.elementCount=3,/byte-length|shape/);
  rejectDescriptor(value=>value.contentId='sha256:nope',/payload ID/);
  assert.throws(()=>validatePayloadForPoint(descriptor,'float32',[3]),/shape/);
  assert.throws(()=>validatePayloadForPoint(descriptor,'int32',[2]),/dtype/);
  const changedBytes=new Uint8Array(bytes);changedBytes[0]^=1;await assert.rejects(new InMemoryNumericalPayloadStore().importPayload(descriptor,changedBytes),/hash/);
  const changedMetadata={...descriptor,layout:'column-major'};await assert.rejects(new InMemoryNumericalPayloadStore().importPayload(changedMetadata,bytes),/layout/);
  const infinity=float32Bytes([Infinity,-0]),infinityDescriptor={...descriptor,contentId:'sha256:'+'0'.repeat(64)};await assert.rejects(new InMemoryNumericalPayloadStore().importPayload(infinityDescriptor,infinity),/finite/);
  await assert.rejects(store.put('int32',[2**31]),/overflow/);await assert.rejects(new InMemoryNumericalPayloadStore().importPayload(descriptor,bytes.slice(0,4)),/byte-length/);
});

test('bounded payload slices enforce every boundary and missing storage fails',async()=>{
  const store=new InMemoryNumericalPayloadStore(),values=Array.from({length:300},(_,index)=>index),descriptor=await store.put('int32',values);
  assert.deepEqual(store.slice(descriptor,0,1),[0]);assert.deepEqual(store.slice(descriptor,149,3),[149,150,151]);
  assert.deepEqual(store.slice(descriptor,299,1),[299]);assert.equal(store.slice(descriptor,0,MAX_PAYLOAD_SLICE_VALUES).length,MAX_PAYLOAD_SLICE_VALUES);
  assert.throws(()=>store.slice(descriptor,0,MAX_PAYLOAD_SLICE_VALUES+1),/count/);assert.throws(()=>store.slice(descriptor,-1,1),/start/);
  assert.throws(()=>store.slice(descriptor,0,-1),/count/);assert.throws(()=>store.slice(descriptor,301,0),/bounds/);
  assert.throws(()=>store.slice(descriptor,299,2),/bounds/);assert.throws(()=>new InMemoryNumericalPayloadStore().slice(descriptor,0,1),/Missing/);
  assert(Object.isFrozen(store.slice(descriptor,0,1)));
});

test('descriptor tampering with otherwise valid metadata still fails its content hash',async()=>{
  const source=new InMemoryNumericalPayloadStore(),descriptor=await source.put('float32',[1,-0]),bytes=float32Bytes([1,-0]);
  for(const edit of [
    (value:any)=>{value.dtype='int32';value.elementEncoding='signed-int32';},
    (value:any)=>{value.elementEncoding='signed-int32';},
    (value:any)=>{value.elementCount=1;value.byteLength=4;},
  ]){
    const value=structuredClone(descriptor) as NumericalPayloadDescriptor;edit(value);
    await assert.rejects(new InMemoryNumericalPayloadStore().importPayload(value,value.elementCount===1?bytes.slice(0,4):bytes),/hash|encoding/);
  }
});

function genericRun(size:number,duplicate=false){
  const point=(id:string,availability='available')=>({id,node:`fixture.${id}`,port:'output',invocation:'fixture:0',phase:'forward',shape:[size],axes:[{role:'feature',space:'fixture:feature',size}],dtype:'float64' as const,encoding:'json-numbers-row-major' as const,values:availability==='available'?Array.from({length:size},(_,index)=>index-0.5):null,origin:'observed' as const,availability,source:{file:'fixture.ts',symbol:'fixture',revision:'sha256:fixture'},owners:[],dependencies:[],semantics:'Generic numerical fixture.',capabilities:['slice','source']});
  return {version:1 as const,id:`fixture:${size}:${duplicate}`,integration:'payload-fixture',definition:'payload-fixture-v1',checkpoint:'fixture-state',inputTransform:'identity',profile:'payload-fixture-v1',runtime:'sha256:fixture',request:{version:1 as const,integration:'payload-fixture',profile:'payload-fixture-v1',requestId:`${size}:${duplicate}`,sessionId:'fixture',epoch:0,action:'predict',input:'fixture'},execution:'native' as const,precision:{storage:'float64',compute:'float64',policy:'exact fixture'},input:{text:'fixture',tokenIds:[1],labels:['fixture'],offsets:[[0,7]]},points:[point('available'),...(duplicate?[point('duplicate')]:[]),point('missing','not_captured')],limits:['fixture']};
}

test('evidence admission validates first, keeps 256 inline, backs 257, deduplicates and drops the giant source envelope',async()=>{
  const registry=new IntegrationRegistry().register({id:'payload-fixture',async decode(record){return validateRun(record);}}),inlineStore=new EvidenceStore(registry),inline=await inlineStore.admit({version:1,codec:'payload-fixture',record:genericRun(256)});
  assert.equal(inline.points[0]!.payload,undefined);assert.equal(inline.points[0]!.values?.length,256);assert.equal(inlineStore.hasEnvelope(inline.id),true);assert.equal(inline.points[1]!.values,null);assert.equal(inline.points[1]!.payload,undefined);
  const store=new EvidenceStore(registry),retained=await store.admit({version:1,codec:'payload-fixture',record:genericRun(257,true)}),[first,second,missing]=retained.points;
  assert.equal(first!.values,null);assert(first!.payload);assert.equal(second!.values,null);assert(second!.payload);assert.equal(first!.payload.contentId,second!.payload.contentId);assert.equal(missing!.payload,undefined);assert.equal(store.hasEnvelope(retained.id),false);assert.deepEqual(store.slice(retained.id,first!.id,256,1),[255.5]);
  const unsafeRegistry=new IntegrationRegistry().register({id:'payload-fixture',async decode(record){return validateRun(record);},retainMetadata(record){return record;}});
  await assert.rejects(new EvidenceStore(unsafeRegistry).admit({version:1,codec:'payload-fixture',record:genericRun(257)}),/cannot duplicate/);
});
