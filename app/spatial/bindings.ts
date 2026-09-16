import { forwardReadModel, type ForwardModel } from "./forward.js";
import { evidenceWorldIntegration } from './integrations.js';
import type { RecordedRun } from "../../trace/types.js";
import type { ArchivedSnapshot } from "../../archive/session.js";
import type { ArchivedCompositeVariantState } from "../../experiments/composite-variant-state.js";
import type { EvidenceEnvelope, EvidenceRun } from "../../trace/evidence.js";
import type { SourceBinding } from "../presentation/source-binding.js";
import { qkGeometry } from "./geometry.js";
import type {RegisteredWorldModel,WorldSelection} from './topology.js';

/** Typed integration coordinates; execution epochs and scalar handles never enter this selection. */
export interface MicrogptSelection { layer:number; query:number; key:number; head:number; feature:number }
function readModel(forward:ForwardModel,source:SourceBinding,selection:MicrogptSelection){
  const input=forward.input,vocabulary=forward.vocabulary,width=forward.width;
  const valid=[selection.query,selection.key].every(i=>Number.isInteger(i)&&i>=0&&i<input.length)&&
    Number.isInteger(selection.layer)&&selection.layer>=0&&selection.layer<forward.layers&&Number.isInteger(selection.head)&&selection.head>=0&&selection.head<forward.heads&&
    Number.isInteger(selection.feature)&&selection.feature>=0&&selection.feature<width;
  const get=(kind:string,token=selection.query,head?:number)=>forward.artifact({kind,token,...(["tokenEmbedding","positionEmbedding","embeddingSum","embeddingNorm","logits","probabilities"].includes(kind)?{}:{layer:selection.layer}),...(head===undefined?{}:{head})});
  const q=valid?get("q"):undefined,k=valid?get("k",selection.key):undefined,logits=valid?get("attentionLogits",selection.query,selection.head):undefined,probabilities=valid?get("attentionProbabilities",selection.query,selection.head):undefined;
  const qh=q?.availability==="available"?q.values?.slice(selection.head*width,(selection.head+1)*width):undefined,kh=k?.availability==="available"?k.values?.slice(selection.head*width,(selection.head+1)*width):undefined;
  const causal=selection.key<=selection.query,products=causal&&qh&&kh?qh.map((value,i)=>value*kh[i]!):undefined,sum=products?.reduce((a,b)=>a+b,0),scaled=sum===undefined?undefined:sum/Math.sqrt(width);
  const lens=valid?{source,layer:selection.layer,head:selection.head,query:selection.query,key:selection.key,feature:selection.feature,
    rootIdentity:forward.semanticId({kind:"attentionLogits",token:selection.query,layer:selection.layer,head:selection.head}),availability:causal&&qh&&kh&&logits?.values&&probabilities?.values?"AVAILABLE" as const:causal?"NOT CAPTURED" as const:"NOT APPLICABLE" as const,
    q:qh,k:kh,products,sum,scale:1/Math.sqrt(width),scaled,observedLogit:causal?logits?.values?.[selection.key]:undefined,observedProbability:causal?probabilities?.values?.[selection.key]:undefined,
    logits:logits?.values??undefined,probabilities:probabilities?.values??undefined,exactLogitMatch:scaled!==undefined&&Object.is(scaled,logits?.values?.[selection.key])}:undefined;
  const row=selection.head*width+selection.feature,matrix=forward.matrix(`layer${selection.layer}.attn_wq`),pre=get("preAttentionNorm"),qValues=q?.values;
  const projection=valid&&matrix?.[row]&&pre?.values&&qValues?.[row]!==undefined?{sourceRunId:source.sourceRunId,sourceSnapshotId:source.sourceSnapshotId,layer:selection.layer,head:selection.head,feature:selection.feature,row,query:selection.query,availability:"AVAILABLE" as const,q:qValues[row],
    terms:matrix[row].map((weight,column)=>({parameter:{index:-1,name:`layer${selection.layer}.attn_wq`,row,column},weight,input:pre.values![column]!,product:weight*pre.values![column]!}))}:{sourceRunId:source.sourceRunId,sourceSnapshotId:source.sourceSnapshotId,layer:selection.layer,head:selection.head,feature:selection.feature,row,query:selection.query,availability:"NOT CAPTURED" as const,terms:[]};
  return {forward,source,runtime:forward.runtime,selection,valid,width,labels:input.map((id,i)=>`${i} · ${vocabulary[id]??"START"}`),preAttention:valid?pre:undefined,q,k,
    heads:Array.from({length:forward.heads},(_,head)=>({head,q:valid&&q?.availability==="available"?q.values?.slice(head*width,(head+1)*width):undefined,k:valid&&k?.availability==="available"?k.values?.slice(head*width,(head+1)*width):undefined,
      scores:valid?get("attentionLogits",selection.query,head):undefined,weights:valid?get("attentionProbabilities",selection.query,head):undefined})),lens,
    geometry:lens?.availability==="AVAILABLE"&&lens.q&&lens.k?qkGeometry(lens.q,lens.k):undefined,projection};
}
export function spatialReadModel(run:RecordedRun,snapshot:ArchivedSnapshot|undefined,source:SourceBinding,selection:MicrogptSelection,variantState?:ArchivedCompositeVariantState){return readModel(forwardReadModel(run,snapshot,variantState),source,selection);}
export function spatialEvidenceReadModel(run:EvidenceRun,envelope:EvidenceEnvelope,selection:WorldSelection,microgptSelection:MicrogptSelection,replay=false):AnySpatialReadModel{
  const integration=evidenceWorldIntegration(run.integration);if(!integration)throw Error('No continuous-world integration registered for this evidence');
  const composition=integration.compose(run,envelope,selection,replay);if(composition.kind==='registered')return composition.model;
  const forward=composition.forward,input='text' in run.input?run.input.text:JSON.stringify(run.input.values);
  const source:SourceBinding={sourceRunId:run.id,sourceSnapshotId:run.checkpoint,capturedDocument:input,origin:"OBSERVED",verification:"NONE",relationship:replay?"REPLAY":"HISTORICAL",phase:"SPATIAL EVIDENCE",availability:"AVAILABLE"};
  return readModel(forward,source,microgptSelection);
}
export function spatialEvidenceUnavailable(run:EvidenceRun):string|undefined{return evidenceWorldIntegration(run.integration)?undefined:'This integration has no qualified continuous-world composition.';}
export type SpatialReadModel=ReturnType<typeof readModel>;
export type AnySpatialReadModel=SpatialReadModel|RegisteredWorldModel;
export function isRegisteredWorld(model:AnySpatialReadModel):model is RegisteredWorldModel{return 'presentation' in model;}
