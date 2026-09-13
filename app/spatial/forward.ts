import { forwardBoundaries } from '../../model/microgpt.js';
import type { ForwardProgress } from '../worker/protocol.js';
import type { RecordedRun, Artifact } from "../../trace/types.js";
import type { ArchivedSnapshot } from "../../archive/session.js";
import { attentionArtifact } from "../presentation/attention-read-model.js";
import { forwardStages } from "../source/stages.js";
import { affineMixture, probabilitySimplex } from "./geometry.js";

export interface Address { kind: string; token: number; head?: number }
export interface Dependency { address: Address; port: string; type: "activation" | "parameter" | "residual" }
export interface Operation { kind: string; title: string; purpose: string; family: string; input?: string; parameter?: string }
const linear: Record<string,[string,string]> = {q:["preAttentionNorm","layer0.attn_wq"],k:["preAttentionNorm","layer0.attn_wk"],v:["preAttentionNorm","layer0.attn_wv"],attentionProjection:["attentionOutput","layer0.attn_wo"],mlpUp:["preMlpNorm","layer0.mlp_fc1"],mlpDown:["mlpRelu","layer0.mlp_fc2"],logits:["mlpResidual","lm_head"]};
const norms: Record<string,string> = {embeddingNorm:"embeddingSum",preAttentionNorm:"embeddingNorm",preMlpNorm:"attentionResidual"};
const additions: Record<string,string[]> = {embeddingSum:["tokenEmbedding","positionEmbedding"],attentionResidual:["attentionProjection","embeddingNorm"],mlpResidual:["mlpDown","attentionResidual"]};
export const operations: Operation[] = forwardStages.filter(([kind])=>kind!=="greedy").map(([kind,title,purpose])=>({kind,title,purpose,
  family:linear[kind]?"linear":norms[kind]?"norm":additions[kind]?"add":kind.endsWith("Embedding")?"lookup":kind==="attentionLogits"?"score":["attentionProbabilities","probabilities"].includes(kind)?"softmax":kind==="headOutput"?"mixture":kind==="attentionOutput"?"concat":"relu",
  input:linear[kind]?.[0]??norms[kind], parameter:linear[kind]?.[1]??(kind==="tokenEmbedding"?"wte":kind==="positionEmbedding"?"wpe":undefined)}));
export const parameterOwners = Object.fromEntries(operations.filter(o=>o.parameter).map(o=>[o.parameter!,o.kind]));
export function addressId(address: Address) { return `${address.kind}:${address.token}:${address.head ?? "-"}`; }
export const headKinds = new Set(["attentionLogits","attentionProbabilities","headOutput"]);
export function dependencies(address: Address, extent: number, heads: number): Dependency[] {
  const {kind,token,head=0}=address;
  const dep=(kind:string,port:string,t=token,h?:number,type:Dependency["type"]="activation"):Dependency=>({address:{kind,token:t,...(h===undefined?{}:{head:h})},port,type});
  if (linear[kind]) return [dep(linear[kind][0],"input vector"),dep(linear[kind][1],"weight matrix",token,undefined,"parameter")];
  if (norms[kind]) return [dep(norms[kind],"all components → mean square")];
  if (additions[kind]) return additions[kind].map((k,i)=>dep(k,i?"saved residual / second operand":"first operand",token,undefined,i&&kind!=="embeddingSum"?"residual":"activation"));
  if (kind==="tokenEmbedding"||kind==="positionEmbedding") return [dep(kind==="tokenEmbedding"?"wte":"wpe","lookup row",token,undefined,"parameter")];
  if (kind==="attentionLogits") return [dep("q",`query head ${head}`),...Array.from({length:Math.min(token+1,extent)},(_,key)=>dep("k",`key ${key} · head ${head}`,key))];
  if (kind==="attentionProbabilities") return [dep("attentionLogits","complete causal score row",token,head)];
  if (kind==="headOutput") return [dep("attentionProbabilities","all weights",token,head),...Array.from({length:Math.min(token+1,extent)},(_,key)=>dep("v",`value at key ${key} · head ${head}`,key))];
  if (kind==="attentionOutput") return Array.from({length:heads},(_,h)=>dep("headOutput",`head ${h} channels`,token,h));
  if (kind==="mlpRelu") return [dep("mlpUp","pre-activation")];
  if (kind==="probabilities") return [dep("logits","all vocabulary logits")];
  return [];
}
export function forwardReadModel(run: RecordedRun, snapshot: ArchivedSnapshot | undefined) {
  const input=run.manifest.input as readonly number[], architecture=run.manifest.model.architecture;
  const heads=Number(architecture.nHead), width=Number(architecture.nEmbd)/heads;
  const compatible = snapshot?.id===run.manifest.startingSnapshotId;
  const matrix=(name:string)=>compatible?snapshot?.state.parameters[name]:undefined;
  const artifact=(address:Address):Artifact|undefined=>address.token<0||address.token>=input.length?undefined:attentionArtifact(run,address.kind,0,address.token,address.head);
  const values=(address:Address)=>{const a=artifact(address);return a?.availability==="available"?a.values??undefined:undefined;};
  const addresses=input.flatMap((_,token)=>operations.flatMap(o=>headKinds.has(o.kind)?Array.from({length:heads},(_,head)=>({kind:o.kind,token,head})): [{kind:o.kind,token}]));
  const upstream=(address:Address)=>dependencies(address,input.length,heads);
  const downstream=(address:Address)=>addresses.flatMap(a=>upstream(a).filter(d=>addressId(d.address)===addressId(address)).map(d=>({address:a,port:d.port,type:d.type})));
  const executionState=(address:Address,execution?:ForwardProgress)=>{
    const a=artifact(address);
    if(a) return a.availability;
    if(!execution) return 'not_captured';
    const plan=forwardBoundaries({config:{nLayer:Number(architecture.nLayer),nHead:heads}},input);
    const index=plan.findIndex(b=>b.kind===address.kind&&b.token===address.token&&(b.head===undefined||b.head===address.head));
    return index>=0&&index<(execution.training ? execution.training.phase.endsWith('forward') ? execution.training.count : plan.length : execution.sequence) ? 'budget_exceeded' : 'pending';
  };
  const explain=(address:Address,element:number)=>{
    const definition=operations.find(o=>o.kind===address.kind), output=values(address), deps=upstream(address);
    const get=(kind:string,t=address.token,h?:number)=>values({kind,token:t,...(h===undefined?{}:{head:h})});
    const indexValid=Number.isInteger(element)&&element>=0&&element<(output?.length??0);
    const inputs=definition?.input?get(definition.input):undefined;
    const parameter=definition?.parameter?matrix(definition.parameter):undefined;
    const terms=output&&definition?.family==="linear"&&inputs&&parameter?.[element]?inputs.map((x,j)=>({index:j,input:x,weight:parameter[element][j],product:x*parameter[element][j]})):undefined;
    const scoreInputs=output&&definition?.family==="softmax"?get(address.kind==="probabilities"?"logits":"attentionLogits",address.token,address.head):undefined;
    const maximum=scoreInputs?Math.max(...scoreInputs):undefined;
    const exponentials=scoreInputs?.map(x=>Math.exp(x-maximum!)), denominator=exponentials?.reduce((s,x)=>s+x,0);
    const meanSquare=output&&definition?.family==="norm"&&inputs?inputs.reduce((s,x)=>s+x*x,0)/inputs.length:undefined;
    const normScale=meanSquare===undefined?undefined:(meanSquare+1e-5)**-.5;
    const pairs=definition?.family==="add"?deps.map(d=>values(d.address)?.[element]):undefined;
    const before=address.kind==="mlpRelu"?get("mlpUp")?.[element]:undefined;
    const probabilities=output&&address.kind==="headOutput"?get("attentionProbabilities",address.token,address.head):undefined;
    const points=probabilities?probabilities.map((_,key)=>get("v",key)?.slice((address.head??0)*width,((address.head??0)+1)*width)):undefined;
    const complete=points?.every(p=>p?.length===width);
    const declaration=run.manifest.intervention as {kind?:string;head?:number;layer?:number}|undefined;
    const zeroed=address.kind==='headOutput'&&declaration?.kind==='head_ablation'&&declaration.layer===0&&declaration.head===address.head;
    const mixture=complete&&probabilities?affineMixture(points as number[][],probabilities):undefined;
    return {address,definition,output,zeroed,headWidth:width,heads,artifact:artifact(address),indexValid,observed:indexValid?output?.[element]:undefined,inputs,parameter,terms,
      maximum,scoreInputs,exponentials,denominator,meanSquare,normScale,pairs,before,derivative:!output||before===undefined?undefined:Number(before>0),
      probabilities,points,mixture,simplex:address.kind==="probabilities"&&output?.length===4?probabilitySimplex(output):undefined,
      lookupRow:address.kind==="tokenEmbedding"?input[address.token]:address.token,
      upstream:deps,downstream:downstream(address)};
  };
  return {input,targets:run.manifest.targets as readonly number[],vocabulary:architecture.vocabulary as readonly string[],heads,width,addresses,executionState,matrix,artifact,values,upstream,downstream,explain,sourceSnapshotId:compatible?snapshot?.id:undefined};
}
export type ForwardModel=ReturnType<typeof forwardReadModel>;
export type Explanation=ReturnType<ForwardModel["explain"]>;
