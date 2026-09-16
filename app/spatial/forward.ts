import { forwardBoundaries, HEAD_OUTPUT_BOUNDARY } from '../../model/microgpt.js';
import type { ForwardProgress } from '../worker/protocol.js';
import type { RecordedRun } from "../../trace/types.js";
import type { ArchivedSnapshot } from "../../archive/session.js";
import { attentionArtifact } from "../presentation/attention-read-model.js";
import { forwardStages } from "../source/stages.js";
import { canonicalMicrogptDefinition, modelDefinitions } from "../../model/definitions.js";
import type { VariantInitializationRecord } from "../../experiments/variant-initialization.js";
import type { ArchivedCompositeVariantState } from "../../experiments/composite-variant-state.js";
import { affineMixture, probabilitySimplex } from "./geometry.js";
import { composeWorld, semanticAddressId, type RelationshipKind, type SemanticAddress } from "./topology.js";
import { globalKinds, headKinds, layerKinds, microgptWorldDescriptor, parameterFor, parameterOwner, type MicrogptTopologyConfig } from "./microgpt-topology.js";

export interface Address { kind:string; token:number; layer?:number; head?:number }
export interface Dependency { address:Address; port:string; type:RelationshipKind }
export interface Operation { kind:string; title:string; purpose:string; family:string; input?:string; parameter?:string }
export interface SpatialArtifact { id:string; availability:string; values:readonly number[]|null; provenance?:string }
const linear:Record<string,string>={q:"preAttentionNorm",k:"preAttentionNorm",v:"preAttentionNorm",attentionProjection:"attentionOutput",mlpUp:"preMlpNorm",mlpDown:"mlpRelu",logits:"mlpResidual"};
const norms:Record<string,string>={embeddingNorm:"embeddingSum",preAttentionNorm:"__prior",preMlpNorm:"attentionResidual"};
export const operations:Operation[]=forwardStages.filter(([kind])=>kind!=="greedy").map(([kind,title,purpose])=>({kind,title,purpose,
  family:linear[kind]?"linear":norms[kind]?"norm":["embeddingSum","attentionResidual","mlpResidual"].includes(kind)?"add":kind.endsWith("Embedding")?"lookup":kind==="attentionLogits"?"score":["attentionProbabilities","probabilities"].includes(kind)?"softmax":kind==="headOutput"?"mixture":kind==="attentionOutput"?"concat":"relu",
  input:linear[kind]??norms[kind],parameter:parameterFor(kind,0)}));
function operationsFor(topology:MicrogptTopologyConfig):Operation[]{
  const activation=topology.activation;
  const activated=!activation||activation.kind==='mlpRelu'?operations:operations.map(operation=>operation.kind==='mlpRelu'
    ?{...operation,kind:activation.kind,title:activation.label,purpose:activation.purpose}
    :operation.kind==='mlpDown'?{...operation,input:activation.kind}:operation);
  if(!topology.compositeMlpDown)return activated;
  const activationKind=activation?.kind??'mlpRelu';
  return activated.flatMap(operation=>operation.kind!=='mlpDown'?[operation]:[
    {kind:'mlpBaseDown',title:'Base W x',purpose:'Frozen inherited MLP down projection',family:'linear',input:activationKind,parameter:'layer0.mlp_fc2'},
    {kind:'mlpAdapterA',title:`Adapter A · ${topology.compositeMlpDown!.bottleneckWidth}`,purpose:'Trainable projection into the declared bottleneck basis',family:'linear',input:activationKind,parameter:'layer0.mlp_adapter_a'},
    {kind:'mlpAdapterB',title:'Adapter B',purpose:'Trainable projection from bottleneck to embedding basis',family:'linear',input:'mlpAdapterA',parameter:'layer0.mlp_adapter_b'},
    {kind:'fixedAdapterScale',title:`Fixed s = ${topology.compositeMlpDown!.scale}`,purpose:'Immutable model-definition constant; not an optimizer parameter',family:'constant'},
    {kind:'mlpAdapterScaled',title:`Scale × ${topology.compositeMlpDown!.scale}`,purpose:'Fixed definition-owned adapter scale',family:'scale',input:'mlpAdapterB'},
    {kind:'mlpCompositeDown',title:'Composite add',purpose:'Base W x + scaled adapter branch',family:'add'},
  ]);
}
export {headKinds};
/** Canonical compatibility view; composed worlds use ForwardModel.parameterOwners. */
export const parameterOwners=Object.fromEntries(operations.filter(o=>o.parameter).map(o=>[o.parameter!,o.kind]));
export function addressId(address:Address){return `${address.layer??"model"}:${address.kind}:${address.token}:${address.head??"-"}`;}
const withLayer=(kind:string,layer:number|undefined)=>layerKinds.has(kind)?layer:undefined;
const prior=(token:number,layer:number|undefined):Address=>layer===undefined||layer===0?{kind:"embeddingNorm",token}:{kind:"mlpResidual",token,layer:layer-1};
export function dependencies(address:Address,extent:number,heads:number,layers=1,activationKind='mlpRelu',composite=false):Dependency[]{
  const {kind,token,head=0,layer}=address;
  const dep=(kind:string,port:string,t=token,h?:number,type:RelationshipKind="activation",l=withLayer(kind,layer)):Dependency=>({address:{kind,token:t,...(l===undefined?{}:{layer:l}),...(h===undefined?{}:{head:h})},port,type});
  if(linear[kind])return [kind==="logits"?dep("mlpResidual","input vector",token,undefined,"activation",layers-1):dep(kind==='mlpDown'?activationKind:linear[kind],"input vector"),dep(parameterFor(kind,layer)!,"weight matrix",token,undefined,"parameter",layer)];
  if(kind==='mlpBaseDown'||kind==='mlpAdapterA'||kind==='mlpAdapterB')return [dep(kind==='mlpAdapterB'?'mlpAdapterA':activationKind,"input vector"),dep(parameterFor(kind,layer)!,"weight matrix",token,undefined,"parameter",layer)];
  if(kind==='mlpAdapterScaled')return [dep('mlpAdapterB','input vector'),dep('fixedAdapterScale','definition constant',token,undefined,'control_state',layer)];
  if(kind==='mlpCompositeDown')return [dep('mlpBaseDown','base W x'),dep('mlpAdapterScaled','scaled adapter / second operand')];
  if(norms[kind])return [kind==="preAttentionNorm"?{address:prior(token,layer),port:"all components → mean square",type:layer&&layer>0?"saved_residual":"activation"}:dep(norms[kind],"all components → mean square")];
  if(kind==="embeddingSum")return [dep("tokenEmbedding","first operand"),dep("positionEmbedding","second operand")];
  if(kind==="attentionResidual")return [dep("attentionProjection","first operand"),{address:prior(token,layer),port:"saved residual / second operand",type:"saved_residual"}];
  if(kind==="mlpResidual")return [dep(composite?'mlpCompositeDown':"mlpDown","first operand"),dep("attentionResidual","saved residual / second operand",token,undefined,"saved_residual")];
  if(kind==="tokenEmbedding"||kind==="positionEmbedding")return [dep(parameterFor(kind)!,"lookup row",token,undefined,"parameter",undefined)];
  if(kind==="attentionLogits")return [dep("q",`query head ${head}`),...Array.from({length:Math.min(token+1,extent)},(_,key)=>dep("k",`key ${key} · head ${head}`,key))];
  if(kind==="attentionProbabilities")return [dep("attentionLogits","complete causal score row",token,head)];
  if(kind==="headOutput")return [dep("attentionProbabilities","all weights",token,head),...Array.from({length:Math.min(token+1,extent)},(_,key)=>dep("v",`value at key ${key} · head ${head}`,key))];
  if(kind==="attentionOutput")return Array.from({length:heads},(_,h)=>dep("headOutput",`head ${h} channels`,token,h));
  if(kind===activationKind)return [dep("mlpUp","pre-activation")];
  if(kind==="probabilities")return [dep("logits","all vocabulary logits",token,undefined,"activation",undefined)];
  return [];
}

export interface ForwardSource {
  topology:MicrogptTopologyConfig;input:readonly number[];targets:readonly number[];runId:string;invocation:string;phase:string;runtime:string;
  artifact(address:Address):SpatialArtifact|undefined;matrix(name:string):readonly (readonly number[])[]|undefined;sourceStateId?:string;
  parameterProvenance:"observed-checkpoint"|"pinned-source-derived";
  headAblation?:{layer:number;head:number};
}
export function composeForward(source:ForwardSource){
  const {topology,input}=source,heads=topology.nHead,width=topology.nEmbd/heads,layers=topology.nLayer;
  const modelOperations=operationsFor(topology),activationKind=topology.activation?.kind??'mlpRelu',composite=!!topology.compositeMlpDown;
  const descriptor=microgptWorldDescriptor(topology),semanticNodes=composeWorld(descriptor,source.runId,source.invocation,source.phase);
  const artifact=(address:Address)=>address.token<0||address.token>=input.length||address.layer!==undefined&&(address.layer<0||address.layer>=layers)||address.head!==undefined&&(address.head<0||address.head>=heads)?undefined:source.artifact(address);
  const values=(address:Address)=>{const a=artifact(address);return a?.availability==="available"?a.values??undefined:undefined;};
  const addresses=input.flatMap((_,token)=>modelOperations.flatMap(o=>globalKinds.has(o.kind)?[{kind:o.kind,token}]:Array.from({length:layers},(_,layer)=>headKinds.has(o.kind)?Array.from({length:heads},(_,head)=>({kind:o.kind,token,layer,head})): [{kind:o.kind,token,layer}]).flat()));
  const upstream=(address:Address)=>dependencies(address,input.length,heads,layers,activationKind,composite);
  const downstream=(address:Address)=>addresses.flatMap(a=>upstream(a).filter(d=>addressId(d.address)===addressId(address)).map(d=>({address:a,port:d.port,type:d.type})));
  const semanticAddress=(address:Address):SemanticAddress=>{const coordinates:Record<string,number>={position:address.token};if(address.layer!==undefined)coordinates.layer=address.layer;if(address.head!==undefined)coordinates.head=address.head;
    return {modelDefinition:topology.modelDefinition,node:`${address.layer===undefined?'model':`layer.${address.layer}`}.${address.kind}${address.head===undefined?'':`.head.${address.head}`}`,port:"output",run:source.runId,invocation:source.invocation,phase:source.phase,coordinates};};
  const semanticId=(address:Address)=>semanticAddressId(semanticAddress(address));
  const parameterNames=["wte","wpe",...Array.from({length:layers},(_,l)=>["attn_wq","attn_wk","attn_wv","attn_wo","mlp_fc1","mlp_fc2",
    ...(composite?["mlp_adapter_a","mlp_adapter_b"]:[])].map(role=>`layer${l}.${role}`)).flat(),"lm_head"];
  const parameterOwners=Object.fromEntries(parameterNames.map(name=>[name,composite&&name.endsWith('.mlp_fc2')?{kind:'mlpBaseDown',layer:Number(/^layer(\d+)/.exec(name)?.[1])}:
    composite&&name.endsWith('.mlp_adapter_a')?{kind:'mlpAdapterA',layer:Number(/^layer(\d+)/.exec(name)?.[1])}:
    composite&&name.endsWith('.mlp_adapter_b')?{kind:'mlpAdapterB',layer:Number(/^layer(\d+)/.exec(name)?.[1])}:parameterOwner(name)!]));
  const parameterDetails=Object.fromEntries(parameterNames.map(name=>[name,{
    definition:topology.modelDefinition,owner:parameterOwners[name],
    trainability:composite?(name.endsWith('.mlp_adapter_a')||name.endsWith('.mlp_adapter_b')?'trainable':'frozen'):'definition-default',
    optimizerMembership:composite?(name.endsWith('.mlp_adapter_a')||name.endsWith('.mlp_adapter_b')):'definition-default',
    inputBasis:name.endsWith('.mlp_adapter_a')?'microgpt.mlp-activation.feature.v1':name.endsWith('.mlp_adapter_b')?'microgpt.adapter-bottleneck.feature.v1':name.endsWith('.mlp_fc2')?'microgpt.mlp-activation.feature.v1':'integration-declared',
    outputBasis:name.endsWith('.mlp_adapter_a')?'microgpt.adapter-bottleneck.feature.v1':name.endsWith('.mlp_adapter_b')||name.endsWith('.mlp_fc2')?'microgpt.embedding.feature.v1':'integration-declared',
    dtype:'float64',axes:['outputFeature','inputFeature'],
  }]));
  const executionState=(address:Address,execution?:ForwardProgress)=>{const a=artifact(address);if(a)return a.availability;if(!execution)return 'not_captured';
    const plan=forwardBoundaries({config:{nLayer:layers,nHead:heads}},input),index=plan.findIndex(b=>b.kind===address.kind&&b.token===address.token&&(b.layer===undefined||b.layer===address.layer)&&(b.head===undefined||b.head===address.head));
    return index>=0&&index<(execution.training?execution.training.phase.endsWith('forward')?execution.training.count:plan.length:execution.sequence)?'budget_exceeded':'pending';};
  const explain=(address:Address,element:number)=>{
    const operationDefinition=modelOperations.find(o=>o.kind===address.kind),output=values(address),deps=upstream(address);
    const get=(kind:string,t=address.token,h?:number,l=withLayer(kind,address.layer))=>values({kind,token:t,...(l===undefined?{}:{layer:l}),...(h===undefined?{}:{head:h})});
    const indexValid=Number.isInteger(element)&&element>=0&&element<(output?.length??0),inputs=operationDefinition?.input?(operationDefinition.input==="__prior"?values(prior(address.token,address.layer)):get(operationDefinition.input)):undefined;
    const parameterName=parameterFor(address.kind,address.layer),parameter=parameterName?source.matrix(parameterName):undefined;
    const terms=output&&operationDefinition?.family==="linear"&&inputs&&parameter?.[element]?inputs.map((x,j)=>({index:j,input:x,weight:parameter[element]![j]!,product:x*parameter[element]![j]!})):undefined;
    const scoreInputs=output&&operationDefinition?.family==="softmax"?get(address.kind==="probabilities"?"logits":"attentionLogits",address.token,address.head,address.kind==="probabilities"?undefined:address.layer):undefined;
    const maximum=scoreInputs?Math.max(...scoreInputs):undefined,exponentials=scoreInputs?.map(x=>Math.exp(x-maximum!)),denominator=exponentials?.reduce((s,x)=>s+x,0);
    const meanSquare=output&&operationDefinition?.family==="norm"&&inputs?inputs.reduce((s,x)=>s+x*x,0)/inputs.length:undefined,normScale=meanSquare===undefined?undefined:(meanSquare+1e-5)**-.5;
    const pairs=operationDefinition?.family==="add"?deps.map(d=>values(d.address)?.[element]):undefined,before=address.kind===activationKind?get("mlpUp")?.[element]:undefined;
    const fixedScale=address.kind==='mlpAdapterScaled'?topology.compositeMlpDown?.scale:undefined;
    const probabilities=output&&address.kind==="headOutput"?get("attentionProbabilities",address.token,address.head):undefined;
    const points=probabilities?probabilities.map((_,key)=>get("v",key)?.slice((address.head??0)*width,((address.head??0)+1)*width)):undefined,complete=points?.every(p=>p?.length===width),mixture=complete&&probabilities?affineMixture(points as number[][],probabilities):undefined;
    const selectedAblation=source.headAblation;
    const zeroed=address.kind==='headOutput'&&selectedAblation?.layer===address.layer&&selectedAblation?.head===address.head;
    return {address,semanticAddress:semanticAddress(address),semanticId:semanticId(address),definition:operationDefinition,output,zeroed,headWidth:width,heads,artifact:artifact(address),indexValid,observed:indexValid?output?.[element]:undefined,inputs,parameter,parameterName,terms,
      maximum,scoreInputs,exponentials,denominator,meanSquare,normScale,pairs,fixedScale,before,derivative:!output||before===undefined?undefined:(before>0?1:activationKind==='mlpLeakyRelu'?0.01:0),probabilities,points,mixture,
      simplex:address.kind==="probabilities"&&output?.length===4?probabilitySimplex(output):undefined,lookupRow:address.kind==="tokenEmbedding"?input[address.token]:address.token,upstream:deps,downstream:downstream(address)};
  };
  return {descriptor,semanticNodes,input,targets:source.targets,vocabulary:topology.vocabulary,heads,width,layers,addresses,operations:modelOperations,activationKind,executionState,matrix:source.matrix,artifact,values,upstream,downstream,explain,semanticAddress,semanticId,
    sourceSnapshotId:source.sourceStateId,parameterProvenance:source.parameterProvenance,parameterNames,parameterOwners,parameterDetails,runId:source.runId,runtime:source.runtime};
}
export function forwardReadModel(run:RecordedRun,snapshot:ArchivedSnapshot|undefined,variantState?:ArchivedCompositeVariantState){
  const a=run.manifest.model.architecture,input=run.manifest.input as readonly number[];
  let definition=canonicalMicrogptDefinition;try{definition=modelDefinitions.require(run.manifest.model);}catch{}
  const initialization=run.manifest.modelInitialization as unknown as VariantInitializationRecord|undefined,snapshotIdentity=snapshot?.id;
  const compatible=snapshotIdentity!==undefined&&snapshotIdentity===run.manifest.startingSnapshotId&&(!initialization||initialization.sourceCheckpointId===snapshotIdentity);
  const composite=definition.replacement?.kind==='composite-mlp-down'?definition.replacement:undefined;
  const compatibleVariant=!!composite&&!!variantState&&compatible&&variantState.state.baseCheckpointId===snapshotIdentity&&
    variantState.state.definition.id===definition.identity.id&&variantState.state.definition.version===definition.identity.version;
  const declaration=run.manifest.intervention;
  const record=declaration&&typeof declaration==='object'&&!Array.isArray(declaration)?declaration as Record<string,unknown>:undefined;
  const headAblation=record?.kind==='head_ablation'&&record.boundary===HEAD_OUTPUT_BOUNDARY&&record.replacement===0&&
    Number.isInteger(record.layer)&&Number.isInteger(record.head)
    ?{layer:record.layer as number,head:record.head as number}:undefined;
  return composeForward({topology:{integration:"microgpt-legacy-v1",modelDefinition:`${run.manifest.model.id}:${run.manifest.model.version}`,
    label:composite?'MicroGPT · Composite MLP variant':definition.base?'MicroGPT · Leaky ReLU variant':'Canonical MicroGPT',
    nLayer:Number(a.nLayer),nHead:Number(a.nHead),nEmbd:Number(a.nEmbd),vocabulary:a.vocabulary as readonly string[],
    activation:{kind:definition.activation.semanticKind,label:definition.activation.label,purpose:definition.activation.equation},
    ...(composite?{compositeMlpDown:{bottleneckWidth:composite.bottleneckWidth,scale:composite.scale}}:{})},
    input,targets:run.manifest.targets as readonly number[],runId:run.manifest.runId,invocation:`legacy-run:${run.manifest.runId}`,phase:"legacy-recorded",runtime:run.manifest.runtimeRevision,
    artifact:address=>attentionArtifact(run,address.kind,address.layer??0,address.token,address.head),
    matrix:name=>compatibleVariant?(variantState!.state.parameters[name]??snapshot?.state.parameters[name]):compatible?snapshot?.state.parameters[name]:undefined,
    sourceStateId:compatibleVariant?variantState!.id:compatible?snapshot?.id:undefined,parameterProvenance:"observed-checkpoint",headAblation});
}
export type ForwardModel=ReturnType<typeof composeForward>;
export type Explanation=ReturnType<ForwardModel["explain"]>;
