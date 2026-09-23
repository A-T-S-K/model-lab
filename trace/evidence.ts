import { canonicalBytes } from '../archive/snapshot.js';
import { immutableCopy } from './types.js';
import { sha256Id } from './sha256.js';
import { INLINE_VALUE_LIMIT, InMemoryNumericalPayloadStore, MAX_PAYLOAD_SLICE_VALUES, validatePayloadForPoint,
  type NumericalDType, type NumericalPayloadDescriptor, type NumericalPayloadStorage } from './payload.js';

export const MAX_RECORD_BYTES = 4_000_000;
export const MAX_VALUES = 200_000;
export const MAX_RETAINED_CODEC_METADATA_BYTES = 256_000;
export interface NumericInput { kind: 'numeric'; values: number[][]; targets: number[][] }
export function validateNumericInput(x: unknown): NumericInput {
  const r=fields(x,['kind','values','targets']);check(r.kind==='numeric','Numeric input kind');
  for(const key of ['values','targets']) {
    const matrix=r[key];check(Array.isArray(matrix)&&matrix.length>0&&matrix.length<=16,'Numeric batch budget');
    check(matrix.every(row=>Array.isArray(row)&&row.length>0&&row.length<=16&&row.every(n=>typeof n==='number'&&Number.isFinite(n)&&Object.is(Math.fround(n),n))),'Numeric input float32 matrix');
    check(matrix.every(row=>row.length===matrix[0].length),'Ragged numeric input');
  }
  check((r.values as unknown[]).length===(r.targets as unknown[]).length,'Target batch mismatch');
  return r as unknown as NumericInput;
}
export interface ExecutionRequest {
  version: 1 | 2 | 3; integration: string; profile: string; requestId: string; sessionId: string;
  epoch: number; action: string; input: string | NumericInput; state?: unknown; generation?: unknown;
}
export function check(ok: unknown, reason: string): asserts ok { if (!ok) throw new Error(reason); }
export function object(x: unknown): Record<string, unknown> {
  check(x !== null && typeof x === 'object' && !Array.isArray(x) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(x)), 'Expected plain record');
  return x as Record<string, unknown>;
}
export function fields(x: unknown, keys: string[]): Record<string, unknown> {
  const r = object(x); check(Object.keys(r).length === keys.length && keys.every(k => Object.hasOwn(r,k)), 'Unexpected record fields'); return r;
}
export function text(x: unknown, max = 1024): asserts x is string { check(typeof x === 'string' && x.length > 0 && x.length <= max, 'Invalid text'); }
export function integer(x: unknown, max = Number.MAX_SAFE_INTEGER): asserts x is number { check(Number.isSafeInteger(x) && Number(x) >= 0 && Number(x) <= max, 'Invalid integer'); }
export function validateRequest(x: unknown): ExecutionRequest {
  const version=object(x).version;
  const r = fields(x,['version','integration','profile','requestId','sessionId','epoch','action','input',...(version===2?['state']:version===3?['generation']:[])]);
  check(r.version === 1 || r.version === 2 || r.version === 3,'Unsupported execution request version');
  for (const k of ['integration','profile','requestId','sessionId','action']) text(r[k],256);
  integer(r.epoch); if(r.version===3)check(typeof r.input==='string','Generation input must be text');
  else if(r.version===2 && typeof r.input!=='string')validateNumericInput(r.input);
  else check(typeof r.input === 'string' && r.input.length <= 512, 'Input exceeds request budget');
  return immutableCopy(r) as unknown as ExecutionRequest;
}
export interface Axis { role: string; space: string; size: number }
export interface EvidencePoint {
  id: string; node: string; port: string; invocation: string; phase: string;
  shape: number[]; axes: Axis[]; dtype: 'float64' | 'float32' | 'int32'; encoding: 'json-numbers-row-major';
  values: number[] | null; origin: 'observed' | 'derived' | 'recomputed'; availability: string;
  /** Present only after admission when large inline producer values have become retained bytes. */
  payload?: NumericalPayloadDescriptor;
  source: { file: string; symbol: string; revision: string }; owners: string[]; dependencies: string[];
  semantics: string; capabilities: string[];
}
export interface EvidenceRun {
  version: 1 | 2; id: string; integration: string; definition: string; checkpoint: string; inputTransform: string;
  profile: string; runtime: string; request: ExecutionRequest; execution: 'native' | 'structural-preview';
  precision: { storage: string; compute: string; policy: string };
  input: { text: string; tokenIds: number[]; labels: string[]; offsets: number[][] } | NumericInput;
  points: EvidencePoint[]; limits: string[];
}
export interface EvidenceEnvelope { version: 1; codec: string; record: unknown }
export interface EvidenceCodec {
  id: string;
  decode(record: unknown): Promise<EvidenceRun>;
  /** Bounded, non-executable metadata retained when the original envelope contains payload-backed arrays. */
  retainMetadata?(record: unknown): unknown;
  /** Validate inert retained evidence using only bounded numerical reads. */
  validateRetained?(run: EvidenceRun, codecMetadata: unknown, access: RetainedEvidenceAccess): Promise<void> | void;
  compare?(before:unknown,after:unknown):{compatible:boolean;reasons:readonly string[]};
}
export interface RetainedEvidenceAccess {
  slice(pointId: string, start: number, count: number): readonly number[];
}
export class IntegrationRegistry {
  #codecs = new Map<string, EvidenceCodec>();
  register(codec: EvidenceCodec): this { check(!this.#codecs.has(codec.id),'Duplicate codec'); this.#codecs.set(codec.id,codec); return this; }
  codec(id: string): EvidenceCodec { const codec=this.#codecs.get(id); check(codec,'Unregistered evidence codec'); return codec; }
}
function validateRunStorage(x: unknown, retained: boolean, payloads?: NumericalPayloadStorage): EvidenceRun {
  const r=fields(x,['version','id','integration','definition','checkpoint','inputTransform','profile','runtime','request','execution','precision','input','points','limits']);
  check((r.version===1 && r.execution==='native') || (r.version===2 && ['native','structural-preview'].includes(String(r.execution))),'Unsupported evidence version or execution');
  for (const k of ['id','integration','definition','checkpoint','inputTransform','profile','runtime']) text(r[k],512);
  const request=validateRequest(r.request); check(request.integration===r.integration && request.profile===r.profile,'Receipt/request profile mismatch');
  const precision=fields(r.precision,['storage','compute','policy']);Object.values(precision).forEach(v=>text(v,2048));
  if(r.version===2 && object(r.input).kind==='numeric')validateNumericInput(r.input);
  else {
  const input=fields(r.input,['text','tokenIds','labels','offsets']); check(typeof input.text==='string' && input.text.length<=512,'Input text budget');
  check(Array.isArray(input.tokenIds)&&input.tokenIds.length<=64,'Token budget'); input.tokenIds.forEach(n=>integer(n,2**31-1));
  check(Array.isArray(input.labels)&&input.labels.length===input.tokenIds.length&&input.labels.every(s=>typeof s==='string'&&s.length<=256),'Token labels');
  check(Array.isArray(input.offsets) && (input.offsets.length===0 || input.offsets.length===input.tokenIds.length),'Input offsets');
  for(const v of input.offsets){check(Array.isArray(v)&&v.length===2,'Offset pair');v.forEach(n=>integer(n,(input.text as string).length));check(v[0]<=v[1],'Offset order');}
  }
  check(Array.isArray(r.limits)&&r.limits.length<=32&&r.limits.every(s=>typeof s==='string'&&s.length<=2048),'Capability limits');
  check(Array.isArray(r.points)&&r.points.length<=2048,'Point budget'); let total=0;const ids=new Set<string>();
  for(const value of r.points){
    const raw=object(value),hasPayload=Object.hasOwn(raw,'payload');
    const p=fields(value,['id','node','port','invocation','phase','shape','axes','dtype','encoding','values','origin','availability',...(hasPayload?['payload']:[]),'source','owners','dependencies','semantics','capabilities']);
    for(const k of ['id','node','port','invocation','phase','availability','semantics'])text(p[k],2048);
    check(!ids.has(p.id as string),'Duplicate point reference');ids.add(p.id as string);
    check(['float64','float32','int32'].includes(String(p.dtype)) && p.encoding==='json-numbers-row-major','Unsupported dtype or decoding metadata');
    check(['observed','derived','recomputed'].includes(String(p.origin)),'Invalid evidence origin');
    check(['available','not_captured','not_applicable','unsupported','budget_exceeded',...(r.version===2?['shape_only','opaque']:[])].includes(String(p.availability)),'Invalid availability');
    check(Array.isArray(p.shape)&&p.shape.length<=6&&Array.isArray(p.axes)&&p.axes.length===p.shape.length,'Shape/axes mismatch');
    p.shape.forEach(n=>integer(n,MAX_VALUES));const size=p.shape.reduce((a:number,b:number)=>a*b,1);check(size<=MAX_VALUES,'Tensor budget');
    for(let i=0;i<p.axes.length;i++){const a=fields(p.axes[i],['role','space','size']);text(a.role);text(a.space);check(a.size===p.shape[i],'Axis extent mismatch');}
    if(p.availability==='available'){
      const inline=Array.isArray(p.values);
      check(retained ? inline!==hasPayload : inline&&!hasPayload, 'Available evidence must have exactly one qualified numerical storage path');
      if(inline) { const values=p.values as unknown[];check(values.length===size&&values.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&(p.dtype!=='int32'||Number.isInteger(n)&&n>=-(2**31)&&n<2**31)&&(p.dtype!=='float32'||Object.is(Math.fround(n),n))),'Payload dtype/value mismatch'); }
      else { check(p.values===null&&payloads,'Retained payload storage missing'); const descriptor=validatePayloadForPoint(p.payload,p.dtype as NumericalDType,p.shape as number[]); check(payloads.has(descriptor.contentId),'Missing numerical payload'); payloads.slice(descriptor,0,0); }
      total+=size;check(total<=MAX_VALUES,'Run value budget');
    }else check(p.values===null&&!hasPayload,'Unavailable evidence must have no numerical storage');
    if(r.execution==='structural-preview')check(p.availability==='shape_only'&&p.values===null,'Preview cannot contain numerical execution');
    const source=fields(p.source,['file','symbol','revision']);Object.values(source).forEach(v=>text(v,2048));
    for(const k of ['owners','dependencies','capabilities']){check(Array.isArray(p[k])&&(p[k] as unknown[]).length<=64,'Reference/capability budget');(p[k] as unknown[]).forEach(v=>text(v,1024));}
    check((p.capabilities as string[]).every(c=>c==='slice'||c==='source'),'Unsupported point action');
  }
  for(const p of r.points)for(const d of p.dependencies)check(ids.has(d),'Missing dependency reference');
  return immutableCopy(r) as unknown as EvidenceRun;
}
export function validateRun(x: unknown): EvidenceRun { return validateRunStorage(x,false); }
export function validateRetainedRun(x: unknown, payloads: NumericalPayloadStorage): EvidenceRun { return validateRunStorage(x,true,payloads); }
function retainBoundedCodecMetadata(value:unknown):unknown{
  const copy=immutableCopy(value),json=JSON.stringify(copy);check(new TextEncoder().encode(json).length<=MAX_RETAINED_CODEC_METADATA_BYTES,'Retained codec metadata byte budget');
  const visit=(item:unknown,depth=0):void=>{check(depth<=32,'Retained codec metadata nesting budget');if(Array.isArray(item)){check(!(item.length>INLINE_VALUE_LIMIT&&item.every(value=>typeof value==='number')),'Retained codec metadata cannot duplicate a large numerical payload');item.forEach(value=>visit(value,depth+1));}else if(item&&typeof item==='object')Object.values(item).forEach(value=>visit(value,depth+1));};visit(copy);return copy;
}
/** Admission owns immutable evidence. Registered codecs, never imported code, interpret records. */
export class EvidenceStore {
  #runs=new Map<string,{run:EvidenceRun;envelope?:EvidenceEnvelope;metadata:EvidenceEnvelope;contentId:string}>();
  constructor(readonly registry:IntegrationRegistry,readonly payloads:NumericalPayloadStorage=new InMemoryNumericalPayloadStore()){}
  async admit(value:unknown, expected?:ExecutionRequest, current:()=>boolean=()=>true):Promise<EvidenceRun>{
    const envelope=fields(value,['version','codec','record']);check(envelope.version===1,'Unknown envelope version');text(envelope.codec);
    const json=JSON.stringify(value);check(new TextEncoder().encode(json).length<=MAX_RECORD_BYTES,'Recording byte budget');
    const copy=immutableCopy(value) as EvidenceEnvelope;
    const codec=this.registry.codec(copy.codec),run=validateRun(await codec.decode(copy.record));
    if(expected)check(JSON.stringify(run.request)===JSON.stringify(validateRequest(expected)),'Stale or cross-request receipt');
    const contentId=await evidenceHash(copy);
    const old=this.#runs.get(run.id);check(!old||old.contentId===contentId,'Conflicting immutable run identity');
    check(current(),"Stale evidence admission");
    let payloadBacked=false;const points:EvidencePoint[]=[];
    for(const point of run.points){
      if(point.availability==='available'&&point.values&&point.values.length>INLINE_VALUE_LIMIT){
        const payload=await this.payloads.put(point.dtype,point.values);validatePayloadForPoint(payload,point.dtype,point.shape);payloadBacked=true;
        points.push({...point,values:null,payload});
      }else points.push(point);
    }
    const retained=immutableCopy({...run,points}) as EvidenceRun;
    const metadata=payloadBacked?immutableCopy({version:1,codec:copy.codec,record:retainBoundedCodecMetadata(codec.retainMetadata?.(copy.record)??{
      kind:'payload-backed-evidence-metadata',runId:run.id,originalEnvelopeRetained:false,
    })}) as EvidenceEnvelope:copy;
    check(current(),"Stale evidence admission");
    this.#runs.set(run.id,{run:retained,...(payloadBacked?{}:{envelope:copy}),metadata,contentId});return retained;
  }
  async portableEntry(id:string):Promise<PortableRetainedEvidenceEntry>{
    const entry=this.#runs.get(id);check(entry,'Missing run reference');check(!entry.envelope,'Inline evidence retains its original envelope');
    const payload={version:1 as const,codec:entry.metadata.codec,run:entry.run,codecMetadata:entry.metadata.record,originalContentId:entry.contentId};
    return immutableCopy({...payload,portableEntryId:await evidenceHash(payload)}) as PortableRetainedEvidenceEntry;
  }
  async admitPortable(value:unknown):Promise<EvidenceRun>{
    const record=fields(value,['version','codec','run','codecMetadata','originalContentId','portableEntryId']);
    check(record.version===1,'Unsupported portable evidence entry version');text(record.codec,256);
    check(typeof record.originalContentId==='string'&&/^sha256:[0-9a-f]{64}$/.test(record.originalContentId),'Malformed original evidence content ID');
    check(typeof record.portableEntryId==='string'&&/^sha256:[0-9a-f]{64}$/.test(record.portableEntryId),'Malformed portable evidence entry ID');
    const payload={version:1 as const,codec:record.codec,run:record.run,codecMetadata:record.codecMetadata,originalContentId:record.originalContentId};
    check(await evidenceHash(payload)===record.portableEntryId,'Portable evidence entry hash mismatch');
    const run=validateRetainedRun(record.run,this.payloads),codec=this.registry.codec(String(record.codec));
    check(codec.validateRetained,'Registered codec does not support portable retained evidence');
    await codec.validateRetained(run,record.codecMetadata,{slice:(pointId,start,count)=>{
      const point=run.points.find(candidate=>candidate.id===pointId);check(point,'Point not captured in retained run');
      integer(start);integer(count,MAX_PAYLOAD_SLICE_VALUES);const length=pointElementCount(point);check(start+count<=length,'Slice out of bounds');
      if(point.payload)return this.payloads.slice(point.payload,start,count);
      check(point.values,'Point numerical storage missing');return Object.freeze(point.values.slice(start,start+count));
    }});
    const old=this.#runs.get(run.id);check(!old||old.contentId===record.originalContentId,'Conflicting immutable run identity');
    const metadata=immutableCopy({version:1,codec:record.codec,record:record.codecMetadata}) as EvidenceEnvelope;
    this.#runs.set(run.id,{run,metadata,contentId:String(record.originalContentId)});return run;
  }
  get(id:string):EvidenceRun{const entry=this.#runs.get(id);check(entry,'Missing run reference');return entry.run;}
  contentId(id:string):string{this.get(id);return this.#runs.get(id)!.contentId;}
  compare(before:string,after:string):{compatible:boolean;reasons:readonly string[]}{
    const a=this.get(before),b=this.get(after);
    if(a.integration!==b.integration||a.definition!==b.definition)return {compatible:false,reasons:['Model definition or representation differs; no coordinate mapping qualified']};
    const codec=this.registry.codec(this.metadataEnvelope(before).codec);
    if(!codec.compare)return {compatible:false,reasons:['No comparison policy qualified for this representation']};
    if(!this.hasEnvelope(before)||!this.hasEnvelope(after))return {compatible:false,reasons:['Comparison requires original evidence unavailable from payload-backed retained storage; no global tensor materialization performed']};
    return codec.compare(this.envelope(before).record,this.envelope(after).record);
  }
  list():readonly EvidenceRun[]{return [...this.#runs.values()].map(e=>e.run);}
  hasEnvelope(id:string):boolean{this.get(id);return this.#runs.get(id)!.envelope!==undefined;}
  envelope(id:string):EvidenceEnvelope{this.get(id);const envelope=this.#runs.get(id)!.envelope;check(envelope,'Original envelope is not retained for payload-backed evidence; portable export is an M4-B2 concern');return envelope;}
  metadataEnvelope(id:string):EvidenceEnvelope{this.get(id);return this.#runs.get(id)!.metadata;}
  slice(runId:string,pointId:string,start:number,count:number):readonly number[]{
    const p=this.point(runId,pointId);integer(start);integer(count,MAX_PAYLOAD_SLICE_VALUES);check(p.availability==='available','Point not captured');
    const length=pointElementCount(p);check(start+count<=length,'Slice out of bounds');
    if(p.payload){validatePayloadForPoint(p.payload,p.dtype,p.shape);return this.payloads.slice(p.payload,start,count);}
    check(p.values,'Point numerical storage missing');return Object.freeze(p.values.slice(start,start+count));
  }
  point(runId:string,pointId:string):EvidencePoint{const p=this.get(runId).points.find(p=>p.id===pointId);check(p,'Point not captured in this run');return p;}
  capability(runId:string,pointId:string,action:string,connected=false):string{
    const p=this.get(runId).points.find(p=>p.id===pointId);
    if(!p)return `Not captured in this run. Executor ${connected?'connected':'disconnected'}; no automatic execution.`;
    return action==='slice'&&p.availability!=='available'?`Numerical slice unavailable: ${p.availability}; no values substituted.`:p.capabilities.includes(action)?'available':`Unsupported ${action} at ${p.node}/${p.port}; executor ${connected?'connected':'disconnected'}.`;
  }
}
export interface PortableRetainedEvidenceEntry {
  readonly version: 1;
  readonly codec: string;
  readonly run: EvidenceRun;
  readonly codecMetadata: unknown;
  readonly originalContentId: string;
  readonly portableEntryId: string;
}
/** Explanation order over retained evidence; advancing never executes a model. */
export class EvidencePlayer {
  index=0;
  constructor(readonly store:EvidenceStore,readonly runId:string){store.get(runId);}
  get run(){return this.store.get(this.runId);}
  get current(){return this.run.points[this.index]!;}
  seek(index:number){integer(index,this.run.points.length-1);this.index=index;return this.current;}
  step(){return this.seek((this.index+1)%this.run.points.length);}
  slice(start=0,count=16){return this.store.slice(this.runId,this.current.id,start,Math.min(count,this.current.availability==='available'?pointElementCount(this.current):0));}
}

export function pointElementCount(point:EvidencePoint):number{return point.shape.reduce((product,size)=>product*size,1);}

/** Versioned JSON transport preserves IEEE negative zero, including snapshot hashes. */
export function serializeEvidence(value:EvidenceEnvelope):string {
  return JSON.stringify({serialization:'model-lab-json-v1',envelope:value},(_key,v)=>
    typeof v==='number'&&Object.is(v,-0)?{$modelLabNumber:'-0'}:v);
}
export function parseEvidence(json:string):unknown {
  check(new TextEncoder().encode(json).length<=MAX_RECORD_BYTES,'Recording byte budget');
  const raw:unknown=JSON.parse(json);
  if(object(raw).serialization!=='model-lab-json-v1')return raw;
  const wrapper=fields(raw,['serialization','envelope']);
  const restore=(value:unknown,depth=0):unknown=>{
    check(depth<=32,'Recording nesting budget');
    if(value===null||typeof value!=='object')return value;
    if(Array.isArray(value))return value.map(v=>restore(v,depth+1));
    const r=object(value);
    if(Object.hasOwn(r,'$modelLabNumber')){check(Object.keys(r).length===1&&r.$modelLabNumber==='-0','Invalid numeric encoding');return -0;}
    return Object.fromEntries(Object.entries(r).map(([k,v])=>[k,restore(v,depth+1)]));
  };
  return restore(wrapper.envelope);
}

export async function evidenceHash(value:unknown):Promise<string>{
  return sha256Id(canonicalBytes(value));
}
