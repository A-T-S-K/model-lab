import { SessionArchive } from './session.js';
import { exactData } from './experiment.js';
import { check, evidenceHash, fields, object, type EvidenceEnvelope, type PortableRetainedEvidenceEntry } from '../trace/evidence.js';
import { InMemoryNumericalPayloadStore, validatePayloadDescriptor, type NumericalPayloadDescriptor } from '../trace/payload.js';
import { modelVariantExperiments } from '../experiments/model-variant-recipes.js';
import type { RecordedRun } from '../trace/types.js';

export const PORTABLE_ARCHIVE_FORMAT = 'model-lab-session-archive-v1' as const;
export const PORTABLE_ARCHIVE_VERSION = 1 as const;
export const PORTABLE_ARCHIVE_EXTENSION = '.mlarchive';
export const PORTABLE_ARCHIVE_LIMITS = Object.freeze({
  archiveBytes: 32 * 1024 * 1024,
  manifestBytes: 24 * 1024 * 1024,
  snapshots: 1024,
  directRuns: 4096,
  learningExperiments: 4096,
  interventionExperiments: 1024,
  modelVariantExperiments: 1024,
  dataExperiments: 256,
  evidenceEntries: 1024,
  payloadEntries: 4096,
  individualPayloadBytes: 2 * 1024 * 1024,
  totalPayloadBytes: 16 * 1024 * 1024,
  nestingDepth: 64,
  stringLength: 16_384,
  dataNodes: 1_000_000,
});

const MAGIC = new Uint8Array([0x4d,0x4c,0x41,0x52,0x43,0x48,0x56,0x31]); // MLARCHV1
const HEADER_BYTES = 18;
const encoder = new TextEncoder();

interface SourceEnvelopeEntry {
  readonly kind: 'source-envelope';
  readonly runId: string;
  readonly originalContentId: string;
  readonly envelope: EvidenceEnvelope;
}
interface RetainedEntry {
  readonly kind: 'retained';
  readonly runId: string;
  readonly entry: PortableRetainedEvidenceEntry;
}
type PortableEvidenceEntry = SourceEnvelopeEntry | RetainedEntry;

interface PortableManifest {
  readonly format: typeof PORTABLE_ARCHIVE_FORMAT;
  readonly version: typeof PORTABLE_ARCHIVE_VERSION;
  readonly records: {
    readonly snapshots: readonly unknown[];
    readonly directRuns: readonly unknown[];
    readonly learningExperiments: readonly unknown[];
    readonly interventionExperiments: readonly unknown[];
    readonly modelVariantExperiments: readonly unknown[];
    readonly dataExperiments: readonly unknown[];
    readonly evidenceEntries: readonly PortableEvidenceEntry[];
  };
  readonly payloads: readonly NumericalPayloadDescriptor[];
}

export interface PortableArchiveExport {
  readonly bytes: Uint8Array;
  readonly archiveId: string;
  readonly manifestBytes: number;
  readonly payloadCount: number;
  readonly uniquePayloadBytes: number;
}

function writeU16(view:DataView,offset:number,value:number):void { view.setUint16(offset,value,false); }
function writeU32(view:DataView,offset:number,value:number):void { view.setUint32(offset,value,false); }
function readU16(view:DataView,offset:number):number { return view.getUint16(offset,false); }
function readU32(view:DataView,offset:number):number { return view.getUint32(offset,false); }

async function sha256(bytes:Uint8Array):Promise<string>{
  const input=new Uint8Array(bytes.length);input.set(bytes);const digest=await globalThis.crypto.subtle.digest('SHA-256',input);
  return `sha256:${Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}`;
}

function canonicalJson(value:unknown):Uint8Array {
  let nodes=0;
  const encode=(item:unknown,depth:number):unknown=>{
    check(depth<=PORTABLE_ARCHIVE_LIMITS.nestingDepth,'Archive manifest nesting budget');
    check(++nodes<=PORTABLE_ARCHIVE_LIMITS.dataNodes,'Archive manifest data-node budget');
    if(item===null||typeof item==='boolean')return item;
    if(typeof item==='string'){check(item.length<=PORTABLE_ARCHIVE_LIMITS.stringLength,'Archive manifest string budget');return item;}
    if(typeof item==='number'){check(Number.isFinite(item),'Archive manifest requires finite numbers');return Object.is(item,-0)?{$modelLabNumber:'-0'}:item;}
    if(Array.isArray(item)){check(Reflect.ownKeys(item).length===item.length+1&&item.every((_value,index)=>Object.hasOwn(item,index)),'Archive manifest arrays must be dense');return item.map(value=>encode(value,depth+1));}
    const record=object(item),keys=Object.keys(record).sort();
    check(Reflect.ownKeys(record).length===keys.length,'Archive manifest requires enumerable string keys');
    check(keys.every(key=>!['__proto__','prototype','constructor'].includes(key)),'Dangerous archive manifest field');
    return Object.fromEntries(keys.map(key=>[key,encode(record[key],depth+1)]));
  };
  const bytes=encoder.encode(JSON.stringify(encode(value,0)));
  check(bytes.length<=PORTABLE_ARCHIVE_LIMITS.manifestBytes,'Archive manifest byte budget');
  return bytes;
}

function parseCanonicalJson(bytes:Uint8Array):unknown {
  let raw:unknown;
  try { raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
  catch { throw new Error('Malformed archive manifest encoding'); }
  let nodes=0;
  const restore=(item:unknown,depth:number):unknown=>{
    check(depth<=PORTABLE_ARCHIVE_LIMITS.nestingDepth,'Archive manifest nesting budget');
    check(++nodes<=PORTABLE_ARCHIVE_LIMITS.dataNodes,'Archive manifest data-node budget');
    if(item===null||typeof item==='boolean')return item;
    if(typeof item==='string'){check(item.length<=PORTABLE_ARCHIVE_LIMITS.stringLength,'Archive manifest string budget');return item;}
    if(typeof item==='number'){check(Number.isFinite(item),'Archive manifest requires finite numbers');return item;}
    if(Array.isArray(item)){check(Reflect.ownKeys(item).length===item.length+1&&item.every((_value,index)=>Object.hasOwn(item,index)),'Archive manifest arrays must be dense');return item.map(value=>restore(value,depth+1));}
    const record=object(item),keys=Object.keys(record);
    check(Reflect.ownKeys(record).length===keys.length,'Archive manifest requires enumerable string keys');
    check(keys.every(key=>!['__proto__','prototype','constructor'].includes(key)),'Dangerous archive manifest field');
    if(keys.length===1&&keys[0]==='$modelLabNumber'){check(record.$modelLabNumber==='-0','Invalid archive number encoding');return -0;}
    return Object.fromEntries(keys.map(key=>[key,restore(record[key],depth+1)]));
  };
  return restore(raw,0);
}

function sortedValues<T>(map:ReadonlyMap<string,T>,id:(value:T)=>string):readonly T[]{
  return [...map.values()].sort((left,right)=>id(left)<id(right)?-1:id(left)>id(right)?1:0);
}

function boundedArray(value:unknown,max:number,label:string):unknown[]{
  check(Array.isArray(value)&&value.length<=max,`${label} count budget`);return value;
}

function uniqueIds(values:readonly unknown[],id:(value:unknown)=>unknown,label:string):void{
  const ids=new Set<string>();for(const value of values){const key=id(value);check(typeof key==='string'&&key.length>0,`Invalid ${label} identity`);check(!ids.has(key),`Duplicate ${label} identity`);ids.add(key);}
}

function pointPayloads(entry:PortableRetainedEvidenceEntry):readonly NumericalPayloadDescriptor[]{
  return entry.run.points.flatMap(point=>point.payload?[point.payload]:[]);
}

export async function exportPortableArchive(archive:SessionArchive):Promise<PortableArchiveExport>{
  const variantRunIds=new Set<string>();
  for(const experiment of archive.modelVariantExperiments.values())for(const run of modelVariantExperiments.require(experiment.identity).variantRuns(experiment))variantRunIds.add(run.manifest.runId);
  const directRuns=sortedValues(archive.runs,(run:RecordedRun)=>run.manifest.runId).filter(run=>!variantRunIds.has(run.manifest.runId));
  const evidenceEntries:PortableEvidenceEntry[]=[];const payloads=new Map<string,NumericalPayloadDescriptor>();
  for(const run of [...archive.evidence.list()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
    check(!variantRunIds.has(run.id),'Standalone evidence collides with a model-variant run');
    if(archive.runs.has(run.id))continue;
    if(archive.evidence.hasEnvelope(run.id)){
      evidenceEntries.push({kind:'source-envelope',runId:run.id,originalContentId:archive.evidence.contentId(run.id),envelope:archive.evidence.envelope(run.id)});
    }else{
      const entry=await archive.evidence.portableEntry(run.id);evidenceEntries.push({kind:'retained',runId:run.id,entry});
      for(const descriptor of pointPayloads(entry)){const old=payloads.get(descriptor.contentId);check(!old||exactData(old,descriptor),'Conflicting payload descriptor identity');payloads.set(descriptor.contentId,descriptor);}
    }
  }
  const descriptors=[...payloads.values()].sort((a,b)=>a.contentId<b.contentId?-1:a.contentId>b.contentId?1:0);
  const manifest:PortableManifest={format:PORTABLE_ARCHIVE_FORMAT,version:PORTABLE_ARCHIVE_VERSION,records:{
    snapshots:sortedValues(archive.snapshots,value=>value.id),directRuns,
    learningExperiments:sortedValues(archive.learningExperiments,value=>value.id),
    interventionExperiments:sortedValues(archive.interventionExperiments,value=>value.id),
    modelVariantExperiments:sortedValues(archive.modelVariantExperiments,value=>value.id),
    dataExperiments:sortedValues(archive.dataExperiments,value=>value.id),evidenceEntries,
  },payloads:descriptors};
  validateManifest(manifest);
  const manifestBytes=canonicalJson(manifest),payloadBytes=descriptors.map(descriptor=>archive.evidence.payloads.exportBytes(descriptor));
  const uniquePayloadBytes=payloadBytes.reduce((sum,bytes)=>sum+bytes.length,0);check(uniquePayloadBytes<=PORTABLE_ARCHIVE_LIMITS.totalPayloadBytes,'Archive payload byte budget');
  payloadBytes.forEach(bytes=>check(bytes.length<=PORTABLE_ARCHIVE_LIMITS.individualPayloadBytes,'Individual archive payload byte budget'));
  const length=HEADER_BYTES+manifestBytes.length+payloadBytes.reduce((sum,bytes)=>sum+4+bytes.length,0);check(length<=PORTABLE_ARCHIVE_LIMITS.archiveBytes,'Archive byte budget');
  const bytes=new Uint8Array(length),view=new DataView(bytes.buffer);bytes.set(MAGIC,0);writeU16(view,8,PORTABLE_ARCHIVE_VERSION);writeU32(view,10,manifestBytes.length);writeU32(view,14,payloadBytes.length);bytes.set(manifestBytes,HEADER_BYTES);
  let offset=HEADER_BYTES+manifestBytes.length;for(const payload of payloadBytes){writeU32(view,offset,payload.length);offset+=4;bytes.set(payload,offset);offset+=payload.length;}
  check(offset===bytes.length,'Archive framing length mismatch');
  return Object.freeze({bytes,archiveId:await sha256(bytes),manifestBytes:manifestBytes.length,payloadCount:payloadBytes.length,uniquePayloadBytes});
}

function validateManifest(value:unknown):PortableManifest{
  const manifest=fields(value,['format','version','records','payloads']);check(manifest.format===PORTABLE_ARCHIVE_FORMAT,'Unsupported archive format');check(manifest.version===PORTABLE_ARCHIVE_VERSION,'Unsupported archive version');
  const records=fields(manifest.records,['snapshots','directRuns','learningExperiments','interventionExperiments','modelVariantExperiments','dataExperiments','evidenceEntries']);
  const snapshots=boundedArray(records.snapshots,PORTABLE_ARCHIVE_LIMITS.snapshots,'Snapshot');
  const directRuns=boundedArray(records.directRuns,PORTABLE_ARCHIVE_LIMITS.directRuns,'Direct run');
  const learning=boundedArray(records.learningExperiments,PORTABLE_ARCHIVE_LIMITS.learningExperiments,'Learning experiment');
  const interventions=boundedArray(records.interventionExperiments,PORTABLE_ARCHIVE_LIMITS.interventionExperiments,'Intervention experiment');
  const variants=boundedArray(records.modelVariantExperiments,PORTABLE_ARCHIVE_LIMITS.modelVariantExperiments,'Model-variant experiment');
  const data=boundedArray(records.dataExperiments,PORTABLE_ARCHIVE_LIMITS.dataExperiments,'Data experiment');
  const evidence=boundedArray(records.evidenceEntries,PORTABLE_ARCHIVE_LIMITS.evidenceEntries,'Evidence entry');
  const payloads=boundedArray(manifest.payloads,PORTABLE_ARCHIVE_LIMITS.payloadEntries,'Payload entry').map(validatePayloadDescriptor);
  uniqueIds(snapshots,value=>object(value).id,'snapshot');uniqueIds(directRuns,value=>object(object(value).manifest).runId,'direct run');uniqueIds(learning,value=>object(value).id,'learning experiment');
  uniqueIds(interventions,value=>object(value).id,'intervention experiment');uniqueIds(variants,value=>object(value).id,'model-variant experiment');uniqueIds(data,value=>object(value).id,'data experiment');
  uniqueIds(evidence,value=>object(value).runId,'evidence entry');uniqueIds(payloads,value=>object(value).contentId,'payload');
  return {format:PORTABLE_ARCHIVE_FORMAT,version:PORTABLE_ARCHIVE_VERSION,records:{snapshots,directRuns,learningExperiments:learning,interventionExperiments:interventions,modelVariantExperiments:variants,dataExperiments:data,evidenceEntries:evidence as unknown as PortableEvidenceEntry[]},payloads};
}

export async function importPortableArchive(source:Uint8Array):Promise<{readonly archive:SessionArchive;readonly archiveId:string}>{
  check(source instanceof Uint8Array,'Archive bytes must be Uint8Array');check(source.length<=PORTABLE_ARCHIVE_LIMITS.archiveBytes,'Archive byte budget');check(source.length>=HEADER_BYTES,'Truncated archive header');
  const bytes=new Uint8Array(source),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);check(MAGIC.every((byte,index)=>bytes[index]===byte),'Wrong archive magic');check(readU16(view,8)===PORTABLE_ARCHIVE_VERSION,'Unsupported archive version');
  const manifestLength=readU32(view,10),payloadCount=readU32(view,14);check(manifestLength<=PORTABLE_ARCHIVE_LIMITS.manifestBytes,'Archive manifest byte budget');check(payloadCount<=PORTABLE_ARCHIVE_LIMITS.payloadEntries,'Payload entry count budget');check(HEADER_BYTES+manifestLength<=bytes.length,'Truncated archive manifest');
  const manifest=validateManifest(parseCanonicalJson(bytes.slice(HEADER_BYTES,HEADER_BYTES+manifestLength)));check(manifest.payloads.length===payloadCount,'Payload count mismatch');
  let offset=HEADER_BYTES+manifestLength,totalPayloadBytes=0;const payloadStore=new InMemoryNumericalPayloadStore();
  for(let index=0;index<payloadCount;index++){
    check(offset+4<=bytes.length,'Truncated payload entry header');const length=readU32(view,offset);offset+=4;check(length<=PORTABLE_ARCHIVE_LIMITS.individualPayloadBytes,'Individual archive payload byte budget');check(offset+length<=bytes.length,'Payload length exceeds remaining archive bytes');
    totalPayloadBytes+=length;check(totalPayloadBytes<=PORTABLE_ARCHIVE_LIMITS.totalPayloadBytes,'Archive payload byte budget');await payloadStore.importPayload(manifest.payloads[index],bytes.slice(offset,offset+length));offset+=length;
  }
  check(offset===bytes.length,'Unexpected trailing archive bytes');
  const referencedPayloads=new Set<string>();for(const raw of manifest.records.evidenceEntries){const entry=object(raw);check(entry.kind==='source-envelope'||entry.kind==='retained','Unsupported archive evidence record kind');
    if(entry.kind==='source-envelope')fields(entry,['kind','runId','originalContentId','envelope']);else {const retained=fields(entry,['kind','runId','entry']);for(const descriptor of pointPayloads(retained.entry as PortableRetainedEvidenceEntry))referencedPayloads.add(descriptor.contentId);}}
  check(referencedPayloads.size===manifest.payloads.length&&manifest.payloads.every(descriptor=>referencedPayloads.has(descriptor.contentId)),'Unreferenced or missing archive payload entry');

  // Staging remains private until every registered validator and reference audit passes.
  const archive=new SessionArchive(payloadStore);
  const directRunIds=new Set(manifest.records.directRuns.map(run=>String(object(object(run).manifest).runId)));
  for(const snapshot of manifest.records.snapshots)await archive.addSnapshot(snapshot as Parameters<SessionArchive['addSnapshot']>[0]);
  for(const run of manifest.records.directRuns)await archive.addRun(run as Parameters<SessionArchive['addRun']>[0]);
  for(const experiment of manifest.records.learningExperiments)await archive.addLearningExperiment(experiment as Parameters<SessionArchive['addLearningExperiment']>[0]);
  for(const experiment of manifest.records.interventionExperiments)await archive.addInterventionExperiment(experiment as Parameters<SessionArchive['addInterventionExperiment']>[0]);
  for(const experiment of manifest.records.modelVariantExperiments)await archive.addModelVariantExperiment(experiment as Parameters<SessionArchive['addModelVariantExperiment']>[0]);
  for(const experiment of manifest.records.dataExperiments)await archive.addDataExperiment(experiment as Parameters<SessionArchive['addDataExperiment']>[0]);
  for(const raw of manifest.records.evidenceEntries){const entry=object(raw);const runId=String(entry.runId);check(!archive.runs.has(runId),'Standalone evidence collides with an archived run');
    if(entry.kind==='source-envelope'){
      const envelope=entry.envelope as EvidenceEnvelope;check(await evidenceHash(envelope)===entry.originalContentId,'Original evidence content ID mismatch');const run=await archive.evidence.admit(envelope);check(run.id===runId&&archive.evidence.hasEnvelope(run.id),'Source-envelope route changed retained representation');
    }else{const run=await archive.evidence.admitPortable(entry.entry);check(run.id===runId,'Portable retained evidence run identity mismatch');}
  }
  const allRunIds=new Set(archive.runs.keys());check(allRunIds.size===archive.runs.size,'Duplicate reconstructed run identity');
  for(const experiment of archive.modelVariantExperiments.values())for(const run of modelVariantExperiments.require(experiment.identity).variantRuns(experiment)){check(!directRunIds.has(run.manifest.runId),'Direct run collides with a model-variant run');check(allRunIds.has(run.manifest.runId),'Missing reconstructed model-variant run');}
  return Object.freeze({archive,archiveId:await sha256(bytes)});
}
