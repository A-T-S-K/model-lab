import { outputTokenName } from './comparison.js';
import type { ForwardProgress } from '../worker/protocol.js';
import type { ForwardModel, Address } from "./forward.js";
import { operations, parameterOwners, headKinds } from "./forward.js";
import { layerKinds, parameterOwner } from "./microgpt-topology.js";
import { probabilityColor, probabilitySimplex, project3 } from "./geometry.js";
import { escapeHtml as esc } from "../views/evidence.js";
export interface Station { kind:string; x:number;y:number;width:number;height:number;layer?:number;head?:number;label?:string }
export const stations:Station[]=[
 {kind:"tokenEmbedding",x:190,y:365,width:110,height:170},{kind:"positionEmbedding",x:190,y:650,width:110,height:170},
 {kind:"embeddingSum",x:360,y:480,width:105,height:170},{kind:"embeddingNorm",x:515,y:480,width:110,height:170},
 {kind:"preAttentionNorm",x:675,y:480,width:110,height:170},
 ...[0,1].flatMap(head=>["q","k","v","attentionLogits","attentionProbabilities","headOutput"].map((kind,i)=>({kind,head,x:870+i*155,y:head?690:300,width:115,height:170}))),
 ...["attentionOutput","attentionProjection","attentionResidual","preMlpNorm","mlpUp","mlpRelu","mlpDown","mlpResidual","logits","probabilities"].map((kind,i)=>({kind,x:1870+i*225,y:["mlpUp","mlpRelu"].includes(kind)?380:480,width:["mlpUp","mlpRelu"].includes(kind)?185:145,height:["mlpUp","mlpRelu"].includes(kind)?370:170})),
 {kind:"mlpLeakyRelu",x:2995,y:380,width:185,height:370},
];
const bankX:Record<string,number>={wte:150,wpe:315,"layer0.attn_wq":850,"layer0.attn_wk":1040,"layer0.attn_wv":1230,"layer0.attn_wo":2070,"layer0.mlp_fc1":2740,"layer0.mlp_fc2":3210,lm_head:3860};
export function stationFor(kind:string,head=0):Station {return stations.find(s=>s.kind===kind&&(s.head===undefined||s.head===head))??{kind,x:bankX[kind]??0,y:965,width:150,height:120};}
export function stationForWorld(f:ForwardModel,kind:string,head=0,layer=0):Station {
  if(f.descriptor.presentation==="microgpt-canonical-curated")return stationFor(kind,head);
  const base=850+layer*2500,row=220+head*270;
  const headX:Record<string,number>={q:280,k:410,v:540,attentionLogits:700,attentionProbabilities:850,headOutput:1000};
  if(headX[kind]!==undefined)return {kind,layer,head,x:base+headX[kind],y:row,width:95,height:145};
  const layerX:Record<string,number>={preAttentionNorm:70,attentionOutput:1160,attentionProjection:1300,attentionResidual:1440,preMlpNorm:1580,mlpUp:1720,mlpRelu:1860,mlpLeakyRelu:1860,mlpDown:2000,mlpResidual:2140};
  if(layerX[kind]!==undefined)return {kind,layer,x:base+layerX[kind],y:540,width:105,height:165};
  const globalX:Record<string,number>={tokenEmbedding:180,positionEmbedding:180,embeddingSum:360,embeddingNorm:540,logits:850+f.layers*2500,probabilities:1030+f.layers*2500};
  return {kind,x:globalX[kind]??0,y:kind==="positionEmbedding"?690:kind==="tokenEmbedding"?370:540,width:110,height:165};
}
export function reticle(x:number,y:number,w:number,h:number) {return `<path class="external-reticle" d="M${x-10} ${y+20} v-30 h30 M${x+w-20} ${y-10} h30 v30 M${x-10} ${y+h-20} v30 h30 M${x+w-20} ${y+h+10} h30 v-30"/>`;}
const compact:Record<string,string>={tokenEmbedding:"TE",positionEmbedding:"PE",embeddingSum:"+",embeddingNorm:"RN",preAttentionNorm:"RN",q:"Q",k:"K",v:"V",attentionLogits:"s",attentionProbabilities:"α",headOutput:"Σ",attentionOutput:"∥",attentionProjection:"WO",attentionResidual:"+",preMlpNorm:"RN",mlpUp:"32",mlpRelu:"ReLU",mlpLeakyRelu:"LReLU",mlpDown:"8",mlpResidual:"+",logits:"z",probabilities:"Tokens"};
const title:Record<string,string>={tokenEmbedding:"Token",positionEmbedding:"Position",embeddingSum:"Add",embeddingNorm:"RMSNorm",preAttentionNorm:"Pre-attn",q:"Q",k:"K",v:"V",attentionLogits:"Scores",attentionProbabilities:"Softmax",headOutput:"Σ αV",attentionOutput:"Concat",attentionProjection:"WO",attentionResidual:"Residual",preMlpNorm:"Pre-MLP",mlpUp:"Expand · 32",mlpRelu:"ReLU · 32",mlpLeakyRelu:"Leaky ReLU · 32",mlpDown:"Contract · 8",mlpResidual:"Residual",logits:"Logits",probabilities:"Probability"};
export function sceneSvg(f:ForwardModel,selected:Address,key:number,parameter:string|undefined,labels:string[],query=selected.token,comparison?:{before:ForwardModel;after:ForwardModel},learningMarkup?:string,execution?:ForwardProgress,element=0) {
  if(f.descriptor.presentation==="microgpt-repeated-blocks")return repeatedSceneSvg(f,selected,key,parameter,labels,query);
  const head=selected.head??(["q","k","v"].includes(selected.kind)?Math.floor(element/f.width):0);
  const valuesFor=(s:Station,source=f)=>{
    const kind=s.kind===f.activationKind?source.activationKind:s.kind;
    const values=source.values({kind,token:s.kind==="k"||s.kind==="v"?key:query,...(headKinds.has(s.kind)?{head:s.head}: {})});
    return ["q","k","v"].includes(s.kind)?values?.slice((s.head??0)*f.width,((s.head??0)+1)*f.width):values;
  };
  const line=(a:Station,b:Station,cls="activation")=>`<path data-edge-from="${a.kind}" data-edge-to="${b.kind}" class="${cls}" d="M${a.x+a.width} ${a.y+a.height/2} C${a.x+a.width+45} ${a.y+a.height/2} ${b.x-45} ${b.y+b.height/2} ${b.x} ${b.y+b.height/2}"/>`;
  const field=(s:Station)=>{
    const values=valuesFor(s,comparison?.before??f),afterValues=comparison?valuesFor(s,comparison.after):undefined,prob=s.kind.includes("Probabilities")||s.kind==="probabilities";
    const availability=f.executionState({kind:s.kind,token:['k','v'].includes(s.kind)?key:query,...(headKinds.has(s.kind)?{head:s.head}:{})},execution);
    const domain=prob?1:Math.max(0,...[...(values??[]),...(afterValues??[])].map(Math.abs));
    const baseline=s.y+(prob?s.height-15:s.height/2), height=prob?s.height-32:s.height/2-18;
    const selectedHere=!parameter&&s.kind===selected.kind&&(s.head===undefined||s.head===head);
    const simplex=!comparison&&s.kind==="probabilities"&&values?.length===4?probabilitySimplex(values):undefined;
    const frontier=execution?.last;
    const atFrontier=frontier?.kind===s.kind&&frontier.token===(['k','v'].includes(s.kind)?key:query)&&(frontier.head===undefined||frontier.head===s.head);
    return `<g class="world-object ${atFrontier?'execution-frontier':''}" role="button" tabindex="0" data-computation="${values?'computed':availability}" data-world-kind="${s.kind}" ${s.head===undefined?"":`data-world-head="${s.head}"`} aria-label="${esc(title[s.kind])}${s.head===undefined?"":` head ${s.head}`}" aria-pressed="${selectedHere}"><title>${esc(f.operations.find(o=>o.kind===s.kind)?.purpose??s.kind)} ${!values?"Output not available; no numerical domain yet.":prob?"Probability domain 0…1.":`Signed domain −${domain}…${domain}; independent per vector. Zero is the baseline.`}</title><text class="station-title" x="${s.x}" y="${s.y-22}">${esc(title[s.kind])}</text><text class="overview-label" x="${s.x}" y="${s.y-22}">${compact[s.kind]}</text>
    <path class="depth" d="M${s.x} ${s.y} l10 -10 h${s.width} l-10 10 M${s.x+s.width} ${s.y} l10 -10 v${s.height} l-10 10"/>
    <rect class="field" x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="3"/>
    ${simplex?simplexGlyph(simplex.vertices,simplex.point,s.x+s.width/2,s.y+75,39,Array.from({length:values?.length??0},(_,i)=>outputTokenName(i,f.vocabulary))):`<path class="zero-axis" d="M${s.x+8} ${baseline} h${s.width-16}"/>`}
    ${!values?`<text class="unavailable" x="${s.x+5}" y="${s.y+65}">${availability==='pending'?`<tspan x="${s.x+5}">Not yet</tspan><tspan x="${s.x+5}" dy="20">computed</tspan>`:availability.replaceAll('_',' ')}</text>`:[values,...(afterValues?[afterValues]:[])].flatMap((endpoint,side)=>endpoint.map((v,i)=>{
      if(prob&&(v<0||v>1||!Number.isFinite(v))) return `<text class="unavailable" x="${s.x}" y="${s.y+80}">P outside [0,1]</text>`;
      const magnitude=domain===0?0:Math.abs(v)/domain*height;
      return `<rect data-component="${i}" data-world-value="${v}" data-endpoint="${comparison?(side?"after":"before"):"selected"}" data-domain="${domain}" x="${s.x+10+(i+(comparison?side*.42:0))*(s.width-20)/values.length}" y="${simplex?s.y+s.height-10-v*35:baseline-(v>=0?magnitude:0)}" width="${Math.max(1,(s.width-20)/values.length*(comparison ? 0.45 : 0.62))}" height="${simplex?v*35:magnitude}" fill="${comparison?side?"#62C7E8":"#A7B2BC":prob?probabilityColor(v):v<0?"#DC7C7C":"#58B98C"}"><title>[${i}] ${v}</title></rect>`;
    })).join("")}
    <text class="station-meta" style="${!values&&availability==='pending'?'font-size:9px':''}" x="${s.x}" y="${s.y+s.height+28}">${prob?`h${s.head??"—"} · 0…1`:`p${s.kind==="k"||s.kind==="v"?key:query} · ${values?.length??(availability==='pending'?`${['q','k','v','headOutput'].includes(s.kind)?f.width:['mlpUp','mlpRelu','mlpLeakyRelu'].includes(s.kind)?f.matrix('layer0.mlp_fc1')?.length??32:s.kind==='logits'?f.matrix('lm_head')?.length??4:s.kind==='attentionLogits'?query+1:f.width*f.heads} components`:'NA')}${s.head===undefined?"":` / h${s.head}`}`}${!values&&availability==='pending'?`<tspan x="${s.x}" dy="16">pending</tspan>`:''}</text>${["k","v"].includes(s.kind)&&key>query?`<text class="station-meta" x="${s.x}" y="${s.y+s.height+55}">future · no edge</text>`:""}${selectedHere?reticle(s.x,s.y,s.width,s.height):""}</g>`;
  };
  return `<svg id="spatial-world" class="spatial-world" viewBox="0 0 4500 1300" tabindex="0" role="group" aria-label="Complete connected forward computation; drag to pan, wheel to zoom"><defs><marker id="forward-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="#62C7E8"/></marker></defs>
    <rect class="region" x="830" y="205" width="985" height="710" rx="8"/><text class="region-title" x="840" y="170"><tspan class="region-full">ATTENTION · TWO HEADS</tspan><tspan class="region-short">ATTENTION</tspan></text>
    <text class="region-title" x="20" y="260"><tspan class="region-full">INPUT · ${f.input.length} POSITIONS</tspan><tspan class="region-short">INPUT</tspan></text><text class="region-title" x="1865" y="260"><tspan class="region-full">HEADS → WO → RESIDUAL</tspan><tspan class="region-short">MERGE</tspan></text><text class="region-title" x="2710" y="260"><tspan class="region-full">MLP · 8 → 32 → 8</tspan><tspan class="region-short">MLP</tspan></text><text class="region-title" x="3870" y="260">OUTPUT</text>
    <g class="tokens">${labels.map((label,i)=>`<g role="button" tabindex="0" data-world-token="${i}" aria-label="Position ${esc(label)}"><rect x="20" y="${345+i*56}" width="120" height="44"/><text class="token-label" x="28" y="${376+i*56}">${esc(label)}</text><text class="overview-token-label" x="28" y="${376+i*56}">${esc(label.replace(" · START","·S").replace(" · ","·"))}</text>${query===i?reticle(20,345+i*56,120,44):""}</g>`).join("")}</g>
    <path class="activation" d="M140 405 H188 M140 705 H188"/>
    ${line(stations[0],stations[2])}${line(stations[1],stations[2])}${line(stations[2],stations[3])}${line(stations[3],stations[4])}
    ${[0,1].map(h=>{
      const get=(kind:string)=>stationFor(kind,h),q=get("q"),k=get("k"),v=get("v"),scores=get("attentionLogits"),weights=get("attentionProbabilities"),mix=get("headOutput");
      return line(stations[4],q)+`<path data-edge-from="q" data-edge-to="attentionLogits" class="activation" d="M${q.x+q.width} ${q.y+85} C${q.x+q.width+25} ${q.y+85} ${q.x+q.width+10} ${q.y-65} ${q.x+q.width+40} ${q.y-65} H${scores.x+55} V${scores.y}"/>`+(key<=query?`<path data-edge-from="k" data-edge-to="attentionLogits" data-selected-key-edge="${key}" class="activation" d="M${k.x+k.width} ${k.y+85} H${k.x+k.width+15} V${k.y+k.height+35} H${scores.x+35} V${scores.y+scores.height}"/>`:"")+line(scores,weights)+line(weights,mix)+(key<=query?`<path data-edge-from="v" data-edge-to="headOutput" data-selected-value-edge="${key}" class="activation" d="M${v.x+v.width/2} ${v.y+v.height} V${v.y+v.height+70} H${mix.x+55} V${mix.y+mix.height}"/>`:"")+line(mix,stationFor("attentionOutput"));
    }).join("")}
    ${['attentionOutput','attentionProjection','attentionResidual','preMlpNorm','mlpUp',f.activationKind,'mlpDown','mlpResidual','logits','probabilities'].map(kind=>stationFor(kind)).slice(0,-1).map((station,index)=>line(station,['attentionOutput','attentionProjection','attentionResidual','preMlpNorm','mlpUp',f.activationKind,'mlpDown','mlpResidual','logits','probabilities'].map(kind=>stationFor(kind))[index+1]!)).join("")}
    <path class="residual-edge" d="M570 480 C570 15 2390 15 2390 480 M2370 480 C2370 105 3520 105 3520 480"/>
    ${stations.filter(station=>f.descriptor.nodes.some(node=>node.operation===station.kind)).map(field).join("")}
    ${Object.entries(parameterOwners).map(([name,kind])=>{
      const x=bankX[name],matrix=(comparison?.before??f).matrix(name),afterMatrix=comparison?.after.matrix(name),s=stationFor(kind),rows=matrix?.length??0,cols=matrix?.[0]?.length??0,max=Math.max(0,...[...(matrix?.flat()??[]),...(afterMatrix?.flat()??[])].map(Math.abs));
      return `<path class="parameter-edge" d="M${x+65} 965 C${x+65} 905 ${s.x+50} 935 ${s.x+50} ${s.y+s.height}"/>${["q","k","v"].includes(kind)?`<path class="parameter-edge" d="M${x+65} 965 C${x+65} 905 ${stationFor(kind,1).x+50} 935 ${stationFor(kind,1).x+50} ${stationFor(kind,1).y+170}"/>`:""}<g role="button" tabindex="0" data-world-parameter="${name}" aria-label="Parameter ${name}" class="parameter-bank"><text x="${x}" y="942">${({wte:"wte",wpe:"wpe","layer0.attn_wq":"Wq","layer0.attn_wk":"Wk","layer0.attn_wv":"Wv","layer0.attn_wo":"WO","layer0.mlp_fc1":"W1","layer0.mlp_fc2":"W2",lm_head:"Wout"} as Record<string,string>)[name]}</text><rect x="${x}" y="965" width="140" height="105"/>${matrix?[matrix,...(afterMatrix?[afterMatrix]:[])].flatMap((endpoint,side)=>endpoint.flatMap((row,r)=>row.map((v,c)=>`<rect x="${x+(c+(comparison?side*.5:0))*140/cols}" y="${965+r*105/rows}" width="${140/cols/(comparison?2:1)}" height="${105/rows}" data-parameter-value="${v}" data-endpoint="${comparison?(side?"after":"before"):"selected"}" data-domain="${max}" fill="${comparison?(side?"#62C7E8":"#A7B2BC"):v<0?"#7A8791":"#A7B2BC"}" fill-opacity="${max===0?0:Math.abs(v)/max}" stroke="#3B454D" stroke-width=".6"><title>[${r},${c}] ${v}</title></rect>`))).join(""):""}<text class="station-meta" x="${x}" y="1100">${rows} × ${cols} · checkpoint</text>${parameter===name?reticle(x,965,140,105):""}</g>`;
    }).join("")}
    ${!parameter&&['q','mlpRelu','mlpLeakyRelu'].includes(selected.kind)&&f.values(selected)?(()=>{
      const e=f.explain(selected,element),s=stationFor(selected.kind,head);
      const text=selected.kind==='mlpRelu'||selected.kind==='mlpLeakyRelu'?`[${element}] ${e.before?.toPrecision(5)} → ${selected.kind==='mlpLeakyRelu'?'Leaky ReLU (α=0.01)':'ReLU'} → ${e.observed?.toPrecision(5)}`:`[${element}] Σ input × Wq → ${e.observed?.toPrecision(5)}`;
      if(selected.kind==='q') return `<g class="component-guide" data-testid="component-guide" data-component="${element}" data-head="${head}"><path d="M${s.x+s.width/2} ${s.y+s.height} v55"/><text x="${s.x-70}" y="${s.y+s.height+85}">${esc(text)}</text></g>`;
      const from=stationFor('mlpUp');
      const count=selected.kind==='mlpRelu'||selected.kind==='mlpLeakyRelu'?32:8;
      const ax=from.x+10+(element+.3)*(from.width-20)/count,bx=s.x+10+(element+.3)*(s.width-20)/count;
      return `<g class="component-guide" data-testid="component-guide" data-component="${element}"><path d="M${ax} ${from.y+from.height} V${from.y+from.height+55} H${bx} V${s.y+s.height}"/><text x="${from.x}" y="${s.y+s.height+85}">${esc(text)}</text></g>`;
    })():''}
    ${learningMarkup??`<path class="training-placeholder" d="M4260 650 C4480 1280 100 1280 170 1080"/><text class="training-label" x="1220" y="1230">TRAINING / BACKWARD / ADAM RETURN · UNIMPLEMENTED IN B</text>`}
  </svg>`;
}

function repeatedSceneSvg(f:ForwardModel,selected:Address,key:number,parameter:string|undefined,labels:string[],query:number){
  const canvasWidth=1250+f.layers*2500,canvasHeight=Math.max(1500,420+f.heads*270),selectedLayer=selected.layer??0;
  const addressFor=(s:Station):Address=>({kind:s.kind,token:["k","v"].includes(s.kind)?key:query,...(layerKinds.has(s.kind)?{layer:s.layer??selectedLayer}:{}),...(s.head===undefined||!headKinds.has(s.kind)?{}:{head:s.head})});
  const stationsForLayer=(layer:number):Station[]=>[
    stationForWorld(f,"preAttentionNorm",0,layer),
    ...Array.from({length:f.heads},(_,head)=>["q","k","v","attentionLogits","attentionProbabilities","headOutput"].map(kind=>stationForWorld(f,kind,head,layer))).flat(),
    ...["attentionOutput","attentionProjection","attentionResidual","preMlpNorm","mlpUp",f.activationKind,"mlpDown","mlpResidual"].map(kind=>stationForWorld(f,kind,0,layer)),
  ];
  const all=[...['tokenEmbedding','positionEmbedding','embeddingSum','embeddingNorm'].map(kind=>stationForWorld(f,kind)),...Array.from({length:f.layers},(_,layer)=>stationsForLayer(layer)).flat(),stationForWorld(f,'logits'),stationForWorld(f,'probabilities')];
  const field=(s:Station)=>{const address=addressFor(s),raw=f.values(address),values=["q","k","v"].includes(s.kind)?raw?.slice((s.head??0)*f.width,((s.head??0)+1)*f.width):raw;
    const probability=s.kind.includes('Probabilities')||s.kind==='probabilities',domain=probability?1:Math.max(0,...(values??[]).map(Math.abs)),baseline=s.y+(probability?s.height-13:s.height/2),height=probability?s.height-28:s.height/2-12;
    const isSelected=!parameter&&s.kind===selected.kind&&(s.layer===undefined||s.layer===selectedLayer)&&(s.head===undefined||s.head===(selected.head??0));
    return `<g class="world-object" role="button" tabindex="0" data-world-kind="${s.kind}" ${s.layer===undefined?'':`data-world-layer="${s.layer}"`} ${s.head===undefined?'':`data-world-head="${s.head}"`} aria-label="${esc(title[s.kind])}${s.layer===undefined?'':` layer ${s.layer}`}${s.head===undefined?'':` head ${s.head}`}" aria-pressed="${isSelected}"><title>${esc(f.semanticId(address))}</title><text class="station-title" x="${s.x}" y="${s.y-15}">${esc(title[s.kind])}${s.head===undefined?'':` · h${s.head}`}</text><text class="overview-label" x="${s.x}" y="${s.y-15}">${compact[s.kind]}${s.head===undefined?'':`·${s.head}`}</text><rect class="field" x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="3"/><path class="zero-axis" d="M${s.x+7} ${baseline} h${s.width-14}"/>
      ${values?values.map((v,i)=>{const magnitude=domain===0?0:Math.abs(v)/domain*height;return `<rect data-component="${i}" data-world-value="${v}" data-domain="${domain}" x="${s.x+7+i*(s.width-14)/values.length}" y="${baseline-(v>=0?magnitude:0)}" width="${Math.max(1,(s.width-14)/values.length*.62)}" height="${magnitude}" fill="${probability?probabilityColor(v):v<0?'#DC7C7C':'#58B98C'}"><title>[${i}] ${v}</title></rect>`;}).join(''):`<text class="unavailable" x="${s.x+5}" y="${s.y+62}">not captured</text>`}
      <text class="station-meta" x="${s.x}" y="${s.y+s.height+24}">${s.layer===undefined?'model':`L${s.layer}`} · p${address.token}${s.head===undefined?'':` · h${s.head}`}</text>${isSelected?reticle(s.x,s.y,s.width,s.height):''}</g>`;};
  const line=(a:Station,b:Station,kind='activation')=>`<path data-edge-from="${a.kind}" data-edge-to="${b.kind}" data-edge-type="${kind}" class="${kind==='saved_residual'?'residual-edge':kind==='parameter'?'parameter-edge':'activation'}" d="M${a.x+a.width} ${a.y+a.height/2} C${a.x+a.width+28} ${a.y+a.height/2} ${b.x-28} ${b.y+b.height/2} ${b.x} ${b.y+b.height/2}"/>`;
  const edges:string[]=[];edges.push(line(stationForWorld(f,'tokenEmbedding'),stationForWorld(f,'embeddingSum')),line(stationForWorld(f,'positionEmbedding'),stationForWorld(f,'embeddingSum')),line(stationForWorld(f,'embeddingSum'),stationForWorld(f,'embeddingNorm')));
  for(let layer=0;layer<f.layers;layer++){
    const pre=stationForWorld(f,'preAttentionNorm',0,layer),prior=layer===0?stationForWorld(f,'embeddingNorm'):stationForWorld(f,'mlpResidual',0,layer-1);edges.push(line(prior,pre,layer===0?'activation':'saved_residual'));
    for(let head=0;head<f.heads;head++){const q=stationForWorld(f,'q',head,layer),k=stationForWorld(f,'k',head,layer),v=stationForWorld(f,'v',head,layer),score=stationForWorld(f,'attentionLogits',head,layer),prob=stationForWorld(f,'attentionProbabilities',head,layer),out=stationForWorld(f,'headOutput',head,layer);edges.push(line(pre,q),line(pre,k),line(pre,v),line(q,score),line(k,score),line(score,prob),line(prob,out),line(v,out),line(out,stationForWorld(f,'attentionOutput',0,layer)));}
    const sequence=['attentionOutput','attentionProjection','attentionResidual','preMlpNorm','mlpUp',f.activationKind,'mlpDown','mlpResidual'];for(let i=0;i<sequence.length-1;i++)edges.push(line(stationForWorld(f,sequence[i],0,layer),stationForWorld(f,sequence[i+1],0,layer),sequence[i]==='attentionProjection'||sequence[i]==='mlpDown'?'saved_residual':'activation'));
    edges.push(line(prior,stationForWorld(f,'attentionResidual',0,layer),'saved_residual'));
  }
  edges.push(line(stationForWorld(f,'mlpResidual',0,f.layers-1),stationForWorld(f,'logits')),line(stationForWorld(f,'logits'),stationForWorld(f,'probabilities')));
  const banks=f.parameterNames.map((name,index)=>{const owner=parameterOwner(name),layer=owner?.layer,x=owner?.layer===undefined?(name==='lm_head'?canvasWidth-420:150+index*150):850+owner.layer*2500+250+(index%6)*310,y=canvasHeight-185,m=f.matrix(name),rows=m?.length??0,cols=m?.[0]?.length??0,isSelected=parameter===name,max=Math.max(0,...(m?.flat()??[]).map(Math.abs));
    return `<g role="button" tabindex="0" data-world-parameter="${name}" ${layer===undefined?'':`data-world-layer="${layer}"`} class="parameter-bank"><text x="${x}" y="${y-12}">${esc(name)}</text><rect x="${x}" y="${y}" width="140" height="90"/>${m?.flatMap((row,r)=>row.map((v,c)=>`<rect x="${x+c*140/cols}" y="${y+r*90/rows}" width="${140/cols}" height="${90/rows}" data-parameter-value="${v}" data-domain="${max}" fill="${v<0?'#7A8791':'#A7B2BC'}" fill-opacity="${max===0?0:Math.abs(v)/max}" stroke="#3B454D" stroke-width=".4"><title>[${r},${c}] ${v}</title></rect>`)).join('')??''}<text class="station-meta" x="${x}" y="${y+115}">${rows} × ${cols} · ${f.parameterProvenance}</text>${isSelected?reticle(x,y,140,90):''}</g>`;}).join('');
  return `<svg id="spatial-world" class="spatial-world" viewBox="0 0 ${canvasWidth} ${canvasHeight}" data-world-width="${canvasWidth}" data-world-height="${canvasHeight}" tabindex="0" role="group" aria-label="Topology-composed ${esc(f.descriptor.label)} computation"><defs><marker id="forward-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="#62C7E8"/></marker></defs>
    <text class="region-title" x="20" y="270">INPUT · ${f.input.length} POSITIONS</text>${Array.from({length:f.layers},(_,layer)=>{const x=850+layer*2500;return `<rect class="region" x="${x}" y="130" width="2320" height="${Math.max(940,f.heads*270+180)}" rx="8"/><text class="region-title" x="${x+15}" y="100">LAYER ${layer} · ${f.heads} HEADS · WIDTH ${f.width*f.heads}</text>`;}).join('')}<text class="region-title" x="${850+f.layers*2500}" y="270">OUTPUT</text>
    <g class="tokens">${labels.map((label,i)=>`<g role="button" tabindex="0" data-world-token="${i}" aria-label="Position ${esc(label)}"><rect x="20" y="${345+i*56}" width="120" height="44"/><text class="token-label" x="28" y="${376+i*56}">${esc(label)}</text>${query===i?reticle(20,345+i*56,120,44):''}</g>`).join('')}</g>${edges.join('')}${all.map(field).join('')}${banks}
    <text class="training-label" x="850" y="${canvasHeight-25}">READ-ONLY QUALIFIED INFERENCE · unsupported training and optimizer actions are not routed</text></svg>`;
}
export function simplexGlyph(vertices:readonly (readonly number[])[],point:readonly number[],ox:number,oy:number,scale:number,labels?:readonly string[]) {
  const ps=vertices.map(project3),p=project3(point),xy=(v:readonly number[])=>`${ox+v[0]*scale},${oy+v[1]*scale}`;
  return `<g class="simplex">${ps.flatMap((a,i)=>ps.slice(i+1).map(b=>`<path d="M${xy(a)} L${xy(b)}"/>`)).join("")}${ps.map((v,i)=>`<circle cx="${ox+v[0]*scale}" cy="${oy+v[1]*scale}" r="3"/><text x="${ox+v[0]*scale+5}" y="${oy+v[1]*scale-4}">${esc(labels?.[i]??String(i))}</text>`).join("")}<circle data-testid="simplex-point" data-coordinates="${point.join(",")}" cx="${ox+p[0]*scale}" cy="${oy+p[1]*scale}" r="5" class="barycenter"/></g>`;
}
