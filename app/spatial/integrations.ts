import type {EvidenceEnvelope,EvidencePoint,EvidenceRun} from '../../trace/evidence.js';
import {NONCANONICAL,pointId} from '../../trace/noncanonical.js';
import {composeForward,type ForwardModel} from './forward.js';

export interface EvidenceWorldIntegration {
  compose(run:EvidenceRun,envelope:EvidenceEnvelope):ForwardModel;
}
const noncanonicalMicrogpt:EvidenceWorldIntegration={compose(run,envelope){
  const record=envelope.record as {state:{config:{nLayer:number;nHead:number;nEmbd:number;vocabulary:string[]};parameters:Record<string,number[][]>}};
  const c=record.state.config,input='tokenIds' in run.input?run.input.tokenIds:[];
  return composeForward({topology:{integration:run.integration,modelDefinition:run.definition,label:'MicroGPT · 2 layers / 3 heads',nLayer:c.nLayer,nHead:c.nHead,nEmbd:c.nEmbd,vocabulary:c.vocabulary},
    input,targets:[],runId:run.id,invocation:'prefill:0',phase:'inference',runtime:run.runtime,
    artifact:address=>run.points.find(p=>p.id===pointId(address.kind,address.token,address.layer,address.head)) as EvidencePoint|undefined,
    matrix:name=>record.state.parameters[name],sourceStateId:run.checkpoint,parameterProvenance:'pinned-source-derived'});
}};
const registry=new Map<string,EvidenceWorldIntegration>([[NONCANONICAL,noncanonicalMicrogpt]]);
export function evidenceWorldIntegration(id:string):EvidenceWorldIntegration|undefined{return registry.get(id);}
