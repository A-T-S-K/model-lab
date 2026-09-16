import type { EvidenceEnvelope, EvidencePoint, EvidenceRun } from '../../trace/evidence.js';
import type { SourceBinding } from '../presentation/source-binding.js';
import { escapeHtml as esc } from '../views/evidence.js';
import { composeWorld, semanticAddressId, type RegisteredWorldPresentation, type RelationshipKind, type SemanticAddress, type SemanticRelationship, type SemanticWorld, type WorldDescriptor, type WorldSelection } from './topology.js';

export const MLP_PRESENTATION = 'numeric-mlp-compact-v1';
const FORWARD = ['inputs','hidden.pre','hidden','prediction','squared.error','loss'] as const;
const PARAMETERS = ['w1','b1','w2','b2'] as const;
const titles:Record<string,string>={inputs:'Numeric input',targets:'Targets','hidden.pre':'First affine','hidden':'ReLU hidden',prediction:'Prediction','squared.error':'Squared error',loss:'MSE loss','input.gradient':'Input gradient',w1:'w1',b1:'b1',w2:'w2',b2:'b2','prediction.after':'Post-update prediction'};

interface MlpRecord { starting:{parameters:Record<string,number[][]|number[]>;optimizer:{family:string;learningRate:number;momentum:number;step:number;schedule:string}}; resulting:{parameters:Record<string,number[][]|number[]>;optimizer:{family:string;learningRate:number;momentum:number;step:number;schedule:string}} }
export interface MlpWorldModel {
  presentation: RegisteredWorldPresentation;
  world: SemanticWorld;
  run: EvidenceRun;
  envelope: EvidenceEnvelope;
  source: SourceBinding;
  selection: WorldSelection;
  selected?: EvidencePoint;
  valid: boolean;
  record: MlpRecord;
}

function pointAddress(run:EvidenceRun,p:EvidencePoint,coordinates:Readonly<Record<string,string|number>>={}):SemanticAddress{
  return {modelDefinition:run.definition,node:p.node,port:p.port,run:run.id,invocation:p.invocation,phase:p.phase,coordinates};
}
function relationshipKind(point:EvidencePoint,dependency:EvidencePoint):RelationshipKind{
  if(point.id==='squared.error'&&dependency.id==='targets')return 'target';
  if(point.id==='loss'||point.phase==='backward')return point.phase==='backward'?'gradient':'objective';
  if(point.phase==='update')return point.port==='after'?'optimizer_update':'parameter_state';
  if(dependency.owners.length||dependency.port==='before')return 'parameter';
  return 'activation';
}
function descriptor(run:EvidenceRun):WorldDescriptor{
  return {integration:run.integration,modelDefinition:run.definition,label:'Numeric MLP · float32 / MSE / SGD',presentation:MLP_PRESENTATION,
    nodes:run.points.map(p=>({id:p.node,operation:p.id,port:p.port,coordinates:{},invocation:p.invocation,phase:p.phase,parameter:p.owners[0]}))};
}
function relationships(run:EvidenceRun):SemanticRelationship[]{
  const byId=new Map(run.points.map(p=>[p.id,p]));
  return run.points.flatMap(point=>point.dependencies.map(id=>{const dependency=byId.get(id)!;return {from:pointAddress(run,dependency),to:pointAddress(run,point),port:dependency.port,kind:relationshipKind(point,dependency)};}));
}
function selectedPoint(run:EvidenceRun,selection:WorldSelection):EvidencePoint|undefined{
  return run.points.find(p=>p.node===selection.node&&p.port===selection.port&&p.phase===selection.phase);
}
export function mlpDefaultSelection(run:EvidenceRun):WorldSelection{
  const p=run.points.find(p=>p.id==='inputs')!;return selectionForPoint(p);
}
export function selectionForPoint(point:EvidencePoint,prior?:WorldSelection):WorldSelection{
  const coordinates:Record<string,number>={};
  for(const axis of point.axes){const old=prior?.coordinates[axis.role];coordinates[axis.role]=typeof old==='number'&&Number.isInteger(old)&&old>=0&&old<axis.size?old:0;}
  return {node:point.node,port:point.port,phase:point.phase,coordinates};
}
export function resolveMlpSelection(run:EvidenceRun,selection:WorldSelection):{point?:EvidencePoint;valid:boolean;index?:number}{
  const point=selectedPoint(run,selection);if(!point)return {valid:false};
  const keys=Object.keys(selection.coordinates).sort(),expected=point.axes.map(a=>a.role).sort();
  if(JSON.stringify(keys)!==JSON.stringify(expected))return {point,valid:false};
  let index=0;for(const axis of point.axes){const value=selection.coordinates[axis.role];if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>=axis.size)return {point,valid:false};index=index*axis.size+value;}
  return {point,valid:true,index};
}
export function composeMlpWorld(run:EvidenceRun,envelope:EvidenceEnvelope,selection:WorldSelection,replay=false):MlpWorldModel{
  const record=envelope.record as MlpRecord&{run:EvidenceRun};const d=descriptor(run),nodes=composeWorld(d,run.id,'batch:0','forward');
  let resolved=resolveMlpSelection(run,selection);if(!resolved.point){Object.assign(selection,mlpDefaultSelection(run));resolved=resolveMlpSelection(run,selection);}
  const input=JSON.stringify(run.input);
  const source:SourceBinding={sourceRunId:run.id,sourceSnapshotId:run.checkpoint,capturedDocument:input,origin:'OBSERVED',verification:'NONE',relationship:replay?'REPLAY':'HISTORICAL',phase:'SPATIAL EVIDENCE',availability:'AVAILABLE'};
  const model={} as MlpWorldModel;Object.assign(model,{world:{descriptor:d,run:run.id,nodes,relationships:relationships(run),capabilities:['predict','train','source','saved-replay']},run,envelope,source,selection,selected:resolved.point,valid:resolved.valid,record});
  model.presentation={id:MLP_PRESENTATION,viewport:{x:0,y:0,width:2200,height:1350},render:state=>renderMlpWorld(model,state.status,state.error,state.replay),bind:(changed,render)=>bindMlpWorld(model,changed,render)};return model;
}
export function mlpSemanticAddress(model:MlpWorldModel):SemanticAddress|undefined{
  return model.selected?pointAddress(model.run,model.selected,model.selection.coordinates):undefined;
}
export function mlpSemanticId(model:MlpWorldModel):string|undefined{const a=mlpSemanticAddress(model);return a?semanticAddressId(a):undefined;}

const station:Record<string,{x:number;y:number}>={inputs:{x:80,y:240},targets:{x:950,y:500},'hidden.pre':{x:430,y:240},hidden:{x:780,y:240},prediction:{x:1130,y:240},'squared.error':{x:1480,y:240},loss:{x:1830,y:240},w1:{x:80,y:610},b1:{x:590,y:610},w2:{x:1100,y:610},b2:{x:1610,y:610},'input.gradient':{x:80,y:1080},'prediction.after':{x:1830,y:1080}};
function pointKey(p:EvidencePoint){return p.node==='prediction.after'?'prediction.after':p.node;}
function scalar(model:MlpWorldModel,p:EvidencePoint):number|undefined{const s=selectionForPoint(p,model.selection),r=resolveMlpSelection(model.run,s);return r.valid&&r.index!==undefined?p.values?.[r.index]??undefined:undefined;}
function box(model:MlpWorldModel,p:EvidencePoint,x:number,y:number){const selected=p===model.selected,value=scalar(model,p);return `<g role="button" tabindex="0" data-mlp-point="${esc(p.id)}" aria-pressed="${selected}" class="world-object mlp-node ${selected?'selected':''}"><rect x="${x}" y="${y}" width="220" height="130" rx="4"/><text class="station-title" x="${x+14}" y="${y+30}">${esc(titles[pointKey(p)]??p.id)}</text><text class="station-meta" x="${x+14}" y="${y+62}">${esc(p.phase)} · ${esc(p.port)}</text><text class="mlp-value" x="${x+14}" y="${y+98}">${value===undefined?'unavailable':value.toPrecision(8)}</text></g>`;}
export function renderMlpScene(model:MlpWorldModel):string{
  const byId=new Map(model.run.points.map(p=>[p.id,p])),shown:EvidencePoint[]=[];
  for(const id of [...FORWARD,'targets']){const p=byId.get(id);if(p)shown.push(p);}
  for(const name of PARAMETERS){for(const suffix of model.run.request.action==='train'?['before','gradient','delta','after']:['before']){const p=byId.get(`${name}.${suffix}`);if(p)shown.push(p);}}
  const positions=new Map<string,{x:number;y:number}>();
  for(const p of shown){const key=pointKey(p);let base=station[key]??{x:80,y:610};if(PARAMETERS.includes(p.node as typeof PARAMETERS[number])){const order=['before','gradient','delta','after'].indexOf(p.port);base={x:base.x,y:base.y+order*145};}positions.set(p.id,base);}
  const edges=model.world.relationships.flatMap(rel=>{const from=model.run.points.find(p=>p.node===rel.from.node&&p.port===rel.from.port&&p.phase===rel.from.phase),to=model.run.points.find(p=>p.node===rel.to.node&&p.port===rel.to.port&&p.phase===rel.to.phase);if(!from||!to)return [];const a=positions.get(from.id),b=positions.get(to.id);if(!a||!b)return [];return [`<path data-relationship="${rel.kind}" class="${rel.kind}" d="M${a.x+220} ${a.y+65} C${a.x+270} ${a.y+65} ${b.x-50} ${b.y+65} ${b.x} ${b.y+65}"/>`];}).join('');
  const height=model.run.request.action==='train'?1350:850;return `<svg id="spatial-world" class="spatial-world mlp-world" data-world-width="2200" data-world-height="${height}" viewBox="0 0 2200 ${height}" tabindex="0" role="group" aria-label="Numeric MLP forward, backward and SGD evidence"><defs><marker id="forward-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="#62C7E8"/></marker></defs><text class="region-title" x="70" y="175">NUMERIC BATCH → AFFINE → RELU → AFFINE → SQUARED ERROR → MSE</text>${edges}${shown.map(p=>{const pos=positions.get(p.id)!;return box(model,p,pos.x,pos.y);}).join('')}</svg>`;
}
function coordinates(model:MlpWorldModel,p:EvidencePoint){return p.axes.map(axis=>`<label>${esc(axis.role.replaceAll('_',' '))}<select data-mlp-coordinate="${esc(axis.role)}">${Array.from({length:axis.size},(_,i)=>`<option value="${i}" ${model.selection.coordinates[axis.role]===i?'selected':''}>${i}</option>`).join('')}</select></label>`).join('');}
function proof(model:MlpWorldModel,p:EvidencePoint):string{
  if(!PARAMETERS.includes(p.node as typeof PARAMETERS[number]))return '';
  const name=p.node,points=Object.fromEntries(['before','gradient','delta','after'].map(port=>[port,model.run.points.find(q=>q.node===name&&q.port===port)])),coordinates=selectionForPoint(points.before??p,model.selection),index=resolveMlpSelection(model.run,coordinates).index??0;
  const before=points.before?.values?.[index],gradient=points.gradient?.values?.[index],delta=points.delta?.values?.[index],after=points.after?.values?.[index];
  if(gradient===undefined)return `<p>Prediction retained ${esc(name)} before/after state without a backward pass.</p>`;
  const expected=Math.fround(before!-0.0625*gradient),match=Object.is(expected,after);
  return `<section class="mlp-sgd" data-testid="mlp-sgd-proof"><h3>Recorded SGD parameter transition</h3><p>Optimizer <strong>SGD</strong> · learning rate 0.0625 · momentum 0 · constant schedule · disposable result</p><div><span>before <b data-testid="mlp-before" data-value="${before}">${before}</b></span><span>gradient <b data-testid="mlp-gradient" data-value="${gradient}">${gradient}</b></span><span>applied delta <b data-testid="mlp-delta" data-value="${delta}">${delta}</b></span><span>after <b data-testid="mlp-after" data-value="${after}">${after}</b></span></div><p><code>float32(${before} − 0.0625 × ${gradient}) = ${expected}</code> · ${match?'matches recorded after':'MISMATCH'}</p></section>`;
}
const sourceExcerpt=`hidden_pre = x @ parameters['w1'].T + parameters['b1']\nhidden = torch.relu(hidden_pre)\nprediction = hidden @ parameters['w2'].T + parameters['b2']\nsquared_error = (prediction - y).square()\nloss = squared_error.mean()\nloss.backward()\nparameter.add_(parameter.grad, alpha=-state['optimizer']['learningRate'])`;
export function renderMlpWorld(model:MlpWorldModel,status:string,error:string,replay:boolean):string{
  const p=model.selected??model.run.points[0]!,r=resolveMlpSelection(model.run,model.selection),value=r.valid&&r.index!==undefined?p.values?.[r.index]:undefined,address=mlpSemanticAddress(model);
  const upstream=p.dependencies.map(id=>model.run.points.find(q=>q.id===id)!).filter(Boolean),downstream=model.run.points.filter(q=>q.dependencies.includes(p.id));
  const nav=(points:EvidencePoint[],testid:string)=>`<div data-testid="${testid}">${points.map(q=>`<button data-mlp-point="${esc(q.id)}">${esc(titles[pointKey(q)]??q.id)} · ${esc(q.phase)} / ${esc(q.port)}</button>`).join('')||'<span>None recorded</span>'}</div>`;
  return `<div class="spatial-shell mlp-shell"><header class="spatial-header"><div class="world-brand"><strong>MODEL LAB</strong><small>${esc(model.world.descriptor.label)} · one connected computation</small></div><strong>mlp-native-v1</strong><button id="return-canonical-world">Return to MicroGPT</button><button id="spatial-home">⌂ Home</button><span class="spatial-badge">${replay?'SAVED REPLAY · NO EXECUTION':'RETAINED NATIVE EVIDENCE · READ ONLY'}</span></header><div class="spatial-status"><span role="status" data-testid="status">${esc(status)}</span><span data-testid="spatial-relationship">${model.source.relationship} · ${model.run.request.action.toUpperCase()} · float32</span></div>${error?`<p role="alert">${esc(error)}</p>`:''}<section class="mlp-capabilities"><strong>AVAILABLE</strong><span>Predict</span><span>Train</span><span>Source</span><span>Saved replay</span><strong>OBJECTIVE</strong><span>MSE</span><strong>OPTIMIZER</strong><span>SGD</span><span>Disposable state · no candidate acceptance</span></section><nav class="spatial-selection" aria-label="Semantic selection"><label>Evidence<select id="mlp-operation">${model.run.points.map(q=>`<option value="${esc(q.id)}" ${q===p?'selected':''}>${esc(titles[pointKey(q)]??q.id)} · ${esc(q.phase)} / ${esc(q.port)}</option>`).join('')}</select></label>${coordinates(model,p)}<span class="scope-note">Full semantic identity · run / node / port / phase / typed coordinates</span></nav><div class="world-workspace has-lens"><div class="world-pane">${renderMlpScene(model)}<div class="selection-card"><small>SELECTED WORLD OBJECT</small><strong data-testid="selected-world-object">${esc(titles[pointKey(p)]??p.id)}</strong><span>${esc(p.node)} / ${esc(p.port)} / ${esc(p.phase)} · ${esc(JSON.stringify(model.selection.coordinates))}</span><span>${value===undefined?'Numerical value unavailable':`Observed float32 value ${value}`}</span></div></div><aside class="context-lens" data-selection="${esc(JSON.stringify([p.id,model.selection.coordinates,model.run.id]))}" aria-label="MLP evidence lens"><div class="lens-heading"><small>BOUND EVIDENCE</small><h2>${esc(titles[pointKey(p)]??p.id)}</h2><p data-testid="forward-artifact">${esc(p.id)}</p></div><div class="lens-scroll mlp-lens"><p data-testid="semantic-address">${esc(address?semanticAddressId(address):'invalid selection')}</p><p>Shape [${p.shape.join(', ')}] · axes ${p.axes.map(a=>a.role).join(' × ')||'scalar'} · ${p.dtype} · ${p.origin}</p><p data-testid="mlp-selected-value">${value===undefined?'Numerical values unavailable':value}</p><h3>Actual upstream dependencies</h3>${nav(upstream,'upstream-choices')}<h3>Recorded consumers</h3>${nav(downstream,'downstream-choices')}${proof(model,p)}<details data-testid="mlp-source"><summary>Read bound source</summary><p>${esc(p.source.file)} · ${esc(p.source.symbol)} · ${esc(p.source.revision)}</p><pre>${esc(sourceExcerpt)}</pre></details><p>Opening and navigating retained evidence never executes the native bridge.</p></div></aside></div></div>`;
}
export function bindMlpWorld(model:MlpWorldModel,changed:()=>void,render:()=>void){
  const root=document.querySelector<HTMLElement>('.mlp-shell');if(!root)return;
  const choose=(id:string)=>{const p=model.run.points.find(q=>q.id===id);if(!p)return;Object.assign(model.selection,selectionForPoint(p,model.selection));changed();render();};
  root.querySelector('#mlp-operation')?.addEventListener('change',event=>choose((event.target as HTMLSelectElement).value));
  root.querySelectorAll<HTMLElement>('[data-mlp-point]').forEach(el=>{const action=()=>choose(el.dataset.mlpPoint!);el.addEventListener('click',action);el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();action();}});});
  root.querySelectorAll<HTMLSelectElement>('[data-mlp-coordinate]').forEach(el=>el.addEventListener('change',()=>{model.selection.coordinates[el.dataset.mlpCoordinate!]=Number(el.value);changed();render();}));
}
