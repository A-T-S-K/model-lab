import type { WorldDescriptor, WorldNode } from "./topology.js";

export interface MicrogptTopologyConfig {
  integration: string; modelDefinition: string; label: string;
  nLayer: number; nHead: number; nEmbd: number; vocabulary: readonly string[];
}
export const globalKinds = new Set(["tokenEmbedding", "positionEmbedding", "embeddingSum", "embeddingNorm", "logits", "probabilities"]);
export const headKinds = new Set(["attentionLogits", "attentionProbabilities", "headOutput"]);
export const layerKinds = new Set(["preAttentionNorm", "q", "k", "v", ...headKinds,
  "attentionOutput", "attentionProjection", "attentionResidual", "preMlpNorm", "mlpUp", "mlpRelu", "mlpDown", "mlpResidual"]);
const layerParameterRole: Record<string, string> = {q:"attn_wq",k:"attn_wk",v:"attn_wv",attentionProjection:"attn_wo",mlpUp:"mlp_fc1",mlpDown:"mlp_fc2"};
export function parameterFor(kind: string, layer?: number): string | undefined {
  if(kind==="tokenEmbedding")return "wte";if(kind==="positionEmbedding")return "wpe";if(kind==="logits")return "lm_head";
  const role=layerParameterRole[kind];return role===undefined||layer===undefined?undefined:`layer${layer}.${role}`;
}
export function parameterOwner(parameter: string): {kind:string;layer?:number}|undefined {
  if(parameter==="wte")return {kind:"tokenEmbedding"};if(parameter==="wpe")return {kind:"positionEmbedding"};if(parameter==="lm_head")return {kind:"logits"};
  const match=/^layer(\d+)\.(.+)$/.exec(parameter);if(!match)return undefined;
  const kind=Object.entries(layerParameterRole).find(([,role])=>role===match[2])?.[0];return kind?{kind,layer:Number(match[1])}:undefined;
}
export function microgptWorldDescriptor(config:MicrogptTopologyConfig):WorldDescriptor {
  const nodes:WorldNode[]=[];
  for(const kind of ["tokenEmbedding","positionEmbedding","embeddingSum","embeddingNorm"])
    nodes.push({id:`model.${kind}`,operation:kind,port:"output",coordinates:{scope:"model"},parameter:parameterFor(kind)});
  for(let layer=0;layer<config.nLayer;layer++){
    for(const kind of ["preAttentionNorm","q","k","v"])
      nodes.push({id:`layer.${layer}.${kind}`,operation:kind,port:"output",coordinates:{layer},parameter:parameterFor(kind,layer)});
    for(let head=0;head<config.nHead;head++)for(const kind of headKinds)
      nodes.push({id:`layer.${layer}.${kind}.head.${head}`,operation:kind,port:"output",coordinates:{layer,head}});
    for(const kind of ["attentionOutput","attentionProjection","attentionResidual","preMlpNorm","mlpUp","mlpRelu","mlpDown","mlpResidual"])
      nodes.push({id:`layer.${layer}.${kind}`,operation:kind,port:"output",coordinates:{layer},parameter:parameterFor(kind,layer)});
  }
  for(const kind of ["logits","probabilities"])
    nodes.push({id:`model.${kind}`,operation:kind,port:"output",coordinates:{scope:"model"},parameter:parameterFor(kind)});
  return {integration:config.integration,modelDefinition:config.modelDefinition,label:config.label,nodes,
    presentation:config.nLayer===1&&config.nHead===2&&config.nEmbd===8?"microgpt-canonical-curated":"microgpt-repeated-blocks"};
}
