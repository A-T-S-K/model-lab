import type {EvidenceEnvelope,EvidencePoint,EvidenceRun,EvidenceStore} from '../../trace/evidence.js';
import {NONCANONICAL,pointId} from '../../trace/noncanonical.js';
import {composeForward,type ForwardModel} from './forward.js';
import {composeMlpWorld} from './mlp-world.js';
import {composeEvidenceFallback,groupedFallbackConfig,opaqueFallbackConfig,shapeFallbackConfig} from './evidence-fallback.js';
import {composePythiaWorld} from './pythia-world.js';
import type {RegisteredWorldModel,WorldSelection} from './topology.js';

export type WorldComposition={kind:'microgpt';forward:ForwardModel}|{kind:'registered';model:RegisteredWorldModel};
export interface EvidenceWorldIntegration {
  compose(run:EvidenceRun,envelope:EvidenceEnvelope,selection:WorldSelection,replay:boolean,store?:EvidenceStore):WorldComposition;
}
const noncanonicalMicrogpt:EvidenceWorldIntegration={compose(run,envelope){
  const record=envelope.record as {state:{config:{nLayer:number;nHead:number;nEmbd:number;vocabulary:string[]};parameters:Record<string,number[][]>}};
  const c=record.state.config,input='tokenIds' in run.input?run.input.tokenIds:[];
  return {kind:'microgpt',forward:composeForward({topology:{integration:run.integration,modelDefinition:run.definition,label:'MicroGPT · 2 layers / 3 heads',nLayer:c.nLayer,nHead:c.nHead,nEmbd:c.nEmbd,vocabulary:c.vocabulary},
    input,targets:[],runId:run.id,invocation:'prefill:0',phase:'inference',runtime:run.runtime,
    artifact:address=>run.points.find(p=>p.id===pointId(address.kind,address.token,address.layer,address.head)) as EvidencePoint|undefined,
    matrix:name=>record.state.parameters[name],sourceStateId:run.checkpoint,parameterProvenance:'pinned-source-derived'})};
}};
const mlp:EvidenceWorldIntegration={compose:(run,envelope,selection,replay)=>({kind:'registered',model:composeMlpWorld(run,envelope,selection,replay)})};
const fallback=(config:Parameters<typeof composeEvidenceFallback>[4]):EvidenceWorldIntegration=>({compose:(run,envelope,selection,replay,store)=>({kind:'registered',model:composeEvidenceFallback(run,envelope,selection,replay,config,store)})});
const registry=new Map<string,EvidenceWorldIntegration>([[NONCANONICAL,noncanonicalMicrogpt],['mlp-native-v1',mlp],
  ['pythia-native-v1',{compose:(run,envelope,selection,replay,store)=>({kind:'registered',model:composePythiaWorld(run,envelope,selection,replay,store)})}],
  ['fixture-grouped-v1',fallback(groupedFallbackConfig)],['fixture-shape-v1',fallback(shapeFallbackConfig)],['fixture-opaque-v1',fallback(opaqueFallbackConfig)]]);
export function evidenceWorldIntegration(id:string):EvidenceWorldIntegration|undefined{return registry.get(id);}
