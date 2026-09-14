import { registerWitnessCodecs } from './witness-codecs.js';
import { noncanonicalCodec } from './noncanonical.js';
import { canonicalIdentity, compareRuns } from './compare.js';
import { IntegrationRegistry, check, fields, validateRun, evidenceHash, type EvidenceRun, type EvidencePoint } from './evidence.js';
import { validateLegacyRun } from '../archive/legacy-run.js';
import type { ArchivedSnapshot } from '../archive/snapshot.js';
import type { RecordedRun } from './types.js';
import { sourceMapping } from '../app/source/mappings.js';
import currentProfile from '../research/pythia/profile.json';
import legacyProfile from '../research/pythia/profile-legacy.json';

/** Compatibility metadata is derived; original run, snapshot and their IDs are retained. */
export async function readLegacyEvidence(record: unknown): Promise<EvidenceRun> {
  const data=fields(record,['run','snapshot']);
  const run=await validateLegacyRun(data.run as RecordedRun,data.snapshot as ArchivedSnapshot);
  const m=run.manifest; const ids=m.input as number[];
  check(Array.isArray(ids)&&ids.every(Number.isSafeInteger),'Legacy input IDs');
  const vocabulary=(data.snapshot as ArchivedSnapshot).state.config.vocabulary;
  const points:EvidencePoint[]=run.artifacts.map(a=>{
    const c=a.concept; const mapping=sourceMapping(c.kind);
    return {id:a.id,node:`${c.layer===undefined?'model':`layer.${c.layer}`}.${c.kind}${c.head===undefined?'':`.head.${c.head}`}`,
      port:'output',invocation:`legacy-occurrence:${a.id}`,phase:'legacy-recorded',shape:[...a.shape],
      axes:a.axes.map((role,i)=>({role,space:`${m.model.id}:${m.model.version}:${c.kind}:${role}`,size:a.shape[i]})),
      dtype:a.dtype,encoding:'json-numbers-row-major',values:a.values?[...a.values]:null,origin:a.provenance,availability:a.availability,
      source:{file:mapping.status==='mapped'?mapping.file:'unknown',symbol:mapping.status==='mapped'?mapping.symbol:'unknown',revision:m.runtimeRevision},
      owners:[],dependencies:[],semantics:`${mapping.status==='mapped'?mapping.equation:'Unsupported source mapping'}. Legacy concept ${JSON.stringify(c)}. Original recording has no explicit invocation, parameter-owner or dependency metadata; occurrence ID is an adapter address.`,capabilities:['slice','source']};
  });
  return validateRun({version:1,id:m.runId,integration:'microgpt-legacy-v1',definition:`${m.model.id}:${await evidenceHash(m.model)}`,checkpoint:m.startingCheckpointId,
    inputTransform:`legacy-character-vocabulary:${await evidenceHash({vocabulary,bosTokenId:(data.snapshot as ArchivedSnapshot).state.config.bosTokenId})}`,profile:m.numeric.policy,runtime:m.runtimeRevision,
    request:{version:1,integration:'microgpt-legacy-v1',profile:m.numeric.policy,requestId:m.runId,sessionId:m.sessionId,epoch:m.generationId,action:'legacy-recorded',input:ids.slice(1).map(id=>vocabulary[id]??'').join('')},
    execution:'native',precision:{storage:'float64',compute:'float64',policy:m.numeric.policy},
    input:{text:ids.slice(1).map(id=>vocabulary[id]??'').join(''),tokenIds:ids,labels:ids.map(id=>vocabulary[id]??'BOS'),offsets:[]},points,
    limits:['Format-1 bytes and identities preserved in the envelope. Request text and semantic metadata are a compatibility view; unknown legacy metadata stays unknown.','Scalar/backward/learning actions use the existing canonical worker and candidate lifecycle. Saved evidence never invokes them.']});
}
export function integrations():IntegrationRegistry {
  return registerWitnessCodecs(new IntegrationRegistry().register(noncanonicalCodec)).register({id:'microgpt-legacy-v1',decode:readLegacyEvidence,compare(before,after){return compareRuns((before as {run:RecordedRun}).run,(after as {run:RecordedRun}).run);}}).register({id:'pythia-native-v1',async decode(record){
    const run=validateRun(record);
    const profile=[currentProfile,legacyProfile].find(p=>p.runtime===run.runtime);check(profile,'Unqualified native runtime');
    check(run.version===1&&run.request.version===1,'Native version');
    check(run.integration==='pythia-native-v1'&&run.profile===profile.profile&&run.runtime===profile.runtime,'Unqualified native binding/profile');
    check(run.definition===profile.definition&&run.checkpoint===profile.checkpoint&&run.inputTransform===profile.inputTransform,'Native identity mismatch');
    check(run.request.action==='predict' && run.precision.storage==='F16' && run.precision.compute==='float32','Unsupported native mode/precision');
    check(run.id===`${run.request.sessionId}:${run.request.requestId}`,'Native receipt ID mismatch');
    check('tokenIds' in run.input,'Native token input required');
    check(run.input.tokenIds.length>=1&&run.input.tokenIds.length<=16&&run.input.tokenIds.every(n=>n<profile.tokenizerSize)&&run.input.text===run.request.input&&/^[\x00-\x7f]{1,128}$/.test(run.input.text),'Native input mismatch');
    const expected=['tokens','embedding','residual.input','norm.attention','norm.mlp','attention.output','mlp.output','residual.output','attention.qkv','attention.weights','logits'];
    check(run.points.length===expected.length&&expected.every(id=>run.points.some(p=>p.id===id)),'Native capture coverage');
    for(const p of run.points){
      check(p.origin==='observed'&&p.availability==='available'&&p.invocation==='prefill:0'&&p.phase==='inference','Native observation declaration');
      const expectedMetadata=profile.captureSchema.find(schema=>schema.id===p.id);
      const actualMetadata={id:p.id,node:p.node,port:p.port,invocation:p.invocation,phase:p.phase,source:p.source,owners:p.owners,dependencies:p.dependencies,capabilities:p.capabilities,axes:p.axes.map(a=>({role:a.role,space:a.space}))};
      check(canonicalIdentity(expectedMetadata)===canonicalIdentity(actualMetadata),'Native semantic/source/axis mapping mismatch');
      if(p.id==='tokens')check(canonicalIdentity(p.values)===canonicalIdentity(run.input.tokenIds),'Native token evidence mismatch');
      const n=run.input.tokenIds.length;
      const shape=p.id==='tokens'?[n]:p.id==='logits'?[50304]:p.id==='attention.weights'?[4,n,n]:p.id==='attention.qkv'?[n,4,3,32]:[n,128];
      check(JSON.stringify(p.shape)===JSON.stringify(shape)&&p.dtype===(p.id==='tokens'?'int32':'float32'),'Native capture shape/dtype');
      check(p.source.revision===(p.id==='tokens'?profile.tokenizerSourceRevision:profile.sourceRevision),'Native source identity');
    }
    return run;
  }});
}
