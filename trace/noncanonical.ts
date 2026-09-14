import { check, fields, validateRun, evidenceHash, type EvidencePoint, type ExecutionRequest, type EvidenceCodec } from './evidence.js';
import { canonicalIdentity } from './compare.js';
import fixture from '../fixtures/noncanonical.initial.json';
import { sourceMapping } from '../app/source/mappings.js';
import { RUNTIME_REVISION } from '../runtime/revision.js';
export const NONCANONICAL='microgpt-multilayer-v1';
export const pointId=(kind:string,token:number,layer?:number,head?:number)=>`position.${token}/${layer===undefined?'model':`layer.${layer}`}/${kind}${head===undefined?'':`/head.${head}`}`;
// Semantic dependencies mirror the existing native forward, including all causal K/V.
export function dependencies(kind:string,t:number,l?:number,h?:number):string[]{
  const id=(k:string,p=t,layer=l,head?:number)=>pointId(k,p,layer,head);
  const prior=l===0?pointId('embeddingNorm',t):id('mlpResidual',t,l!-1);
  switch(kind){
    case 'tokenEmbedding':case 'positionEmbedding':return [];
    case 'embeddingSum':return [id('tokenEmbedding'),id('positionEmbedding')];
    case 'embeddingNorm':return [id('embeddingSum')];
    case 'preAttentionNorm':return [prior];
    case 'q':case 'k':case 'v':return [id('preAttentionNorm')];
    case 'attentionLogits':return [id('q'),...Array.from({length:t+1},(_,p)=>id('k',p))];
    case 'attentionProbabilities':return [id('attentionLogits',t,l,h)];
    case 'headOutput':return [id('attentionProbabilities',t,l,h),...Array.from({length:t+1},(_,p)=>id('v',p))];
    case 'attentionOutput':return Array.from({length:fixture.config.nHead},(_,head)=>id('headOutput',t,l,head));
    case 'attentionProjection':return [id('attentionOutput')];
    case 'attentionResidual':return [id('attentionProjection'),prior];
    case 'preMlpNorm':return [id('attentionResidual')];
    case 'mlpUp':return [id('preMlpNorm')];case 'mlpRelu':return [id('mlpUp')];case 'mlpDown':return [id('mlpRelu')];
    case 'mlpResidual':return [id('mlpDown'),id('attentionResidual')];
    case 'logits':return [id('mlpResidual',t,fixture.config.nLayer-1)];case 'probabilities':return [id('logits')];
    default:throw Error('Unregistered MicroGPT boundary');
  }
}
export function pointMetadata(kind:string,t:number,l?:number,h?:number){
  const mapping=sourceMapping(kind);check(mapping.status==='mapped','Source mapping');
  const role=['logits','probabilities'].includes(kind)?'vocabulary_index':kind.startsWith('attention')&&h!==undefined?'key_position':h!==undefined?'head_feature':'feature';
  const width=role==='key_position'?t+1:role==='vocabulary_index'?fixture.config.vocabulary.length+1:h!==undefined?fixture.config.nEmbd/fixture.config.nHead:['mlpUp','mlpRelu'].includes(kind)?4*fixture.config.nEmbd:fixture.config.nEmbd;
  return {id:pointId(kind,t,l,h),node:`${l===undefined?'model':`layer.${l}`}.${kind}${h===undefined?'':`.head.${h}`}`,port:`position.${t}`,invocation:`prefill:0:position:${t}`,phase:'inference',shape:[width],axes:[{role,space:`${NONCANONICAL}:${role}:${l??'model'}:${h??'all'}`,size:width}],dtype:'float64' as const,encoding:'json-numbers-row-major' as const,origin:'observed' as const,availability:'available',source:{file:mapping.file,symbol:mapping.symbol,revision:RUNTIME_REVISION},owners:[],dependencies:dependencies(kind,t,l,h),semantics:`${mapping.equation}. Position ${t}; layer ${l??'model'}; head ${h??'all'}. Head feature uses the selected head's contiguous width-2 slice.`,capabilities:['slice','source']};
}
export function boundaries(n:number){
  const list:ReturnType<typeof pointMetadata>[]=[];
  for(let t=0;t<n;t++){
    for(const k of ['tokenEmbedding','positionEmbedding','embeddingSum','embeddingNorm'])list.push(pointMetadata(k,t));
    for(let l=0;l<fixture.config.nLayer;l++){
      for(const k of ['preAttentionNorm','q','k','v'])list.push(pointMetadata(k,t,l));
      for(let h=0;h<fixture.config.nHead;h++)for(const k of ['attentionLogits','attentionProbabilities','headOutput'])list.push(pointMetadata(k,t,l,h));
      for(const k of ['attentionOutput','attentionProjection','attentionResidual','preMlpNorm','mlpUp','mlpRelu','mlpDown','mlpResidual'])list.push(pointMetadata(k,t,l));
    }
    for(const k of ['logits','probabilities'])list.push(pointMetadata(k,t));
  }return list;
}
export const noncanonicalCodec:EvidenceCodec={id:NONCANONICAL,async decode(record){
  const e=fields(record,['run','state']);check(canonicalIdentity(e.state)===canonicalIdentity(fixture),'Noncanonical fixture state');
  const run=validateRun(e.run);
  check(run.version===1&&run.integration===NONCANONICAL&&run.runtime===RUNTIME_REVISION&&run.definition===await evidenceHash(fixture.config)&&run.checkpoint===await evidenceHash(fixture)&&run.profile==='microgpt-multilayer-f64-v1'&&run.inputTransform===await evidenceHash(fixture.config.vocabulary),'Noncanonical identity');
  check(run.request.action==='predict'&&typeof run.request.input==='string'&&'tokenIds' in run.input,'Noncanonical request');
  const ids=[fixture.config.bosTokenId,...[...run.request.input].map(c=>fixture.config.vocabulary.indexOf(c))];
  check(ids.length<=fixture.config.blockSize&&ids.every(n=>n>=0),'Noncanonical input bounds');
  check(canonicalIdentity(run.input)===canonicalIdentity({text:run.request.input,tokenIds:ids,labels:ids.map(id=>fixture.config.vocabulary[id]??'BOS'),offsets:[]})&&run.id===`${run.request.sessionId}:${run.request.requestId}`,'Noncanonical input/receipt');
  check(run.precision.compute==='float64'&&run.precision.storage==='float64','Noncanonical precision');
  const metadata=boundaries(ids.length);check(run.points.length===metadata.length,'Noncanonical coverage');
  run.points.forEach((p,i)=>{const {values,...meta}=p;check(canonicalIdentity(meta)===canonicalIdentity(metadata[i]),'Noncanonical layer/head/position binding');});
  return run;
}};
