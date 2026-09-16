import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SessionArchive } from '../../archive/session.js';
import { exportPortableArchive, importPortableArchive } from '../../archive/portable.js';
import { EvidenceStore, evidenceHash } from '../../trace/evidence.js';
import { integrations } from '../../trace/integrations.js';
import { InMemoryNumericalPayloadStore } from '../../trace/payload.js';
import { ModelSession } from '../../app/worker/controller.js';
import { canonicalIntent } from '../../app/worker/execution-intent.js';
import type { WorkerRequest } from '../../app/worker/protocol.js';

async function canonicalArchive():Promise<{archive:SessionArchive;runId:string}>{
  const session=new ModelSession(),tag={sessionId:'portable-test',generationId:0};
  await session.handle({...tag,runId:'init',command:'initialize'});
  const request:WorkerRequest={...tag,runId:'predict',command:'predict',document:'abca'};
  const response=await session.handle({...request,intent:canonicalIntent(request)});assert.equal(response.status,'result');if(response.status!=='result')throw new Error('Missing canonical result');
  const archive=new SessionArchive();for(const snapshot of response.result.snapshots)await archive.addSnapshot(snapshot);await archive.addRun(response.result.run);
  return {archive,runId:response.result.run.manifest.runId};
}

test('portable archive v1 is deterministic, content-addressed and reconstructs isolated canonical history',async()=>{
  const {archive,runId}=await canonicalArchive(),first=await exportPortableArchive(archive),second=await exportPortableArchive(archive);
  assert.deepEqual(first.bytes,second.bytes);assert.equal(first.archiveId,second.archiveId);assert.match(first.archiveId,/^sha256:[0-9a-f]{64}$/);
  const imported=await importPortableArchive(first.bytes);assert.equal(imported.archiveId,first.archiveId);assert.deepEqual([...imported.archive.snapshots.keys()],[...archive.snapshots.keys()]);assert.deepEqual(imported.archive.runs.get(runId),archive.runs.get(runId));
  assert.equal(imported.archive.evidence.contentId(runId),archive.evidence.contentId(runId));assert.equal(imported.archive.learningExperiments.size,0);
});

test('portable ordering ignores map insertion order while preserving learning lineage and comparison',async()=>{
  const session=new ModelSession(),tag={sessionId:'portable-learning',generationId:0};await session.handle({...tag,runId:'init',command:'initialize'});
  const request:WorkerRequest={...tag,runId:'train',command:'train',document:'abca'},response=await session.handle({...request,intent:canonicalIntent(request)});assert.equal(response.status,'result');if(response.status!=='result'||!response.result.experiment)throw new Error('Missing learning result');
  const first=new SessionArchive(),second=new SessionArchive();for(const snapshot of response.result.snapshots)await first.addSnapshot(snapshot);for(const run of response.result.runs)await first.addRun(run);await first.addLearningExperiment(response.result.experiment);
  for(const snapshot of [...response.result.snapshots].reverse())await second.addSnapshot(snapshot);for(const run of [...response.result.runs].reverse())await second.addRun(run);await second.addLearningExperiment(response.result.experiment);
  const a=await exportPortableArchive(first),b=await exportPortableArchive(second);assert.deepEqual(a.bytes,b.bytes);
  const imported=(await importPortableArchive(a.bytes)).archive,experiment=imported.learningExperiments.get(response.result.experiment.id)!;assert.deepEqual(experiment,response.result.experiment);
  assert.equal(imported.evidence.compare(experiment.beforeRunId,experiment.afterRunId).compatible,true);assert.equal(imported.snapshots.has(experiment.startingSnapshotId),true);assert.equal(imported.snapshots.has(experiment.resultingSnapshotId),true);
});

test('portable archive refuses malformed framing atomically without changing current history',async()=>{
  const {archive}=await canonicalArchive(),valid=await exportPortableArchive(archive),beforeRuns=[...archive.runs.keys()],beforeSnapshots=[...archive.snapshots.keys()];
  const variants:Uint8Array[]=[];
  const wrongMagic=new Uint8Array(valid.bytes);wrongMagic[0]^=0xff;variants.push(wrongMagic,valid.bytes.slice(0,10),valid.bytes.slice(0,-1));
  const unsupportedVersion=new Uint8Array(valid.bytes);new DataView(unsupportedVersion.buffer).setUint16(8,2,false);variants.push(unsupportedVersion);
  const malformedManifest=new Uint8Array(valid.bytes);malformedManifest[18]=0xff;variants.push(malformedManifest);
  const trailing=new Uint8Array(valid.bytes.length+1);trailing.set(valid.bytes);variants.push(trailing);
  const oversizedManifest=new Uint8Array(valid.bytes);new DataView(oversizedManifest.buffer).setUint32(10,0xffffffff,false);variants.push(oversizedManifest);
  for(const bytes of variants)await assert.rejects(importPortableArchive(bytes));
  assert.deepEqual([...archive.runs.keys()],beforeRuns);assert.deepEqual([...archive.snapshots.keys()],beforeSnapshots);
});

const generationPath=process.env.NATIVE_GENERATION_RECORDING;
test('payload-backed M4-A generation round-trips through registered retained validation with no executor',{skip:!generationPath},async()=>{
  const envelope=JSON.parse(await readFile(generationPath!,'utf8')),source=new SessionArchive(),run=await source.evidence.admit(envelope),originalId=source.evidence.contentId(run.id);
  const exported=await exportPortableArchive(source);assert(exported.payloadCount>0);assert(exported.uniquePayloadBytes>0);
  const {archive}=await importPortableArchive(exported.bytes);assert.equal(archive.evidence.contentId(run.id),originalId);assert.equal(archive.evidence.hasEnvelope(run.id),false);
  assert.deepEqual(archive.evidence.slice(run.id,'generation:2/logits',50303,1),[-3.8919265270233154]);
  assert.deepEqual(archive.evidence.slice(run.id,'generation:2/attention.qkv',511,8),[-0.14655473828315735,2.905082941055298,3.862351417541504,-7.279216766357422,-12.423630714416504,1.786351203918457,-6.3037872314453125,-0.3044796884059906]);
  const importedRun=archive.evidence.get(run.id),metadata=archive.evidence.metadataEnvelope(run.id).record as any;
  assert.deepEqual(metadata.generation.generated.tokenIds,[327,253]);assert.deepEqual(metadata.generation.invocations[2].effectivePrefixIds,[510,5798,2206,327]);assert.equal(metadata.generation.cache.capability,'unsupported');
  const payloadIds=importedRun.points.flatMap(point=>point.payload?[point.payload.contentId]:[]);assert(payloadIds.length>new Set(payloadIds).size);assert.equal(new Set(payloadIds).size,exported.payloadCount);
  const entry=await source.evidence.portableEntry(run.id),payloadStore=new InMemoryNumericalPayloadStore();
  for(const descriptor of new Map(run.points.flatMap(point=>point.payload?[[point.payload.contentId,point.payload] as const]:[])).values())await payloadStore.importPayload(descriptor,source.evidence.payloads.exportBytes(descriptor));
  const unknown=structuredClone(entry) as any;unknown.codec='unknown-native-v1';unknown.portableEntryId=await evidenceHash({version:unknown.version,codec:unknown.codec,run:unknown.run,codecMetadata:unknown.codecMetadata,originalContentId:unknown.originalContentId});
  await assert.rejects(new EvidenceStore(integrations(),payloadStore).admitPortable(unknown),/Unregistered evidence codec/);
  const falseChoice=structuredClone(entry) as any;falseChoice.codecMetadata.generation.invocations[1].choice.chosenOutputIndex=1;falseChoice.portableEntryId=await evidenceHash({version:falseChoice.version,codec:falseChoice.codec,run:falseChoice.run,codecMetadata:falseChoice.codecMetadata,originalContentId:falseChoice.originalContentId});
  await assert.rejects(new EvidenceStore(integrations(),payloadStore).admitPortable(falseChoice),/full-support argmax/);
  const badLength=new Uint8Array(exported.bytes),view=new DataView(badLength.buffer),manifestLength=view.getUint32(10,false);view.setUint32(18+manifestLength,1_000_000,false);await assert.rejects(importPortableArchive(badLength),/remaining archive bytes/);
  const duplicatePayload=new Uint8Array(exported.bytes),duplicateView=new DataView(duplicatePayload.buffer),length=duplicateView.getUint32(10,false),manifest=JSON.parse(new TextDecoder().decode(duplicatePayload.slice(18,18+length)));manifest.payloads[1].contentId=manifest.payloads[0].contentId;const duplicateManifest=new TextEncoder().encode(JSON.stringify(manifest));assert.equal(duplicateManifest.length,length);duplicatePayload.set(duplicateManifest,18);await assert.rejects(importPortableArchive(duplicatePayload),/Duplicate payload identity/);
  for(const index of [Math.floor(exported.bytes.length/2),exported.bytes.length-1]){const tampered=new Uint8Array(exported.bytes);tampered[index]^=1;await assert.rejects(importPortableArchive(tampered));}
});
