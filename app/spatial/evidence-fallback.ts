import type {Axis,EvidenceEnvelope,EvidencePoint,EvidenceRun,EvidenceStore} from '../../trace/evidence.js';
import {escapeHtml as esc} from '../views/evidence.js';
import {composeWorld,semanticAddressId,type RegisteredWorldPresentation,type RelationshipKind,type SemanticAddress,type SemanticRelationship,type SemanticWorld,type WorldDescriptor,type WorldSelection} from './topology.js';
import {availabilityPresentation} from '../presentation/availability.js';
import {PRESENTATION_WORK,nextWindowOffset,presentationWindow,previousWindowOffset,rangeWindow,windowSummary} from '../presentation/work-contract.js';

export const EVIDENCE_FALLBACK_PRESENTATION='bounded-evidence-fallback-v1';
export const FALLBACK_POINT_LIMIT=PRESENTATION_WORK.fallbackPoints;

export interface CoordinateMapping {
  sourcePoint:string;sourceAxis:string;sourceSpace:string;sourceCoordinate:number;
  targetAxis:string;targetSpace:string;targetCoordinate:number;origin:'derived';statement:string;
}
export interface EvidenceFallbackConfig {
  label:string;
  mapping?:(run:EvidenceRun,coordinates:ReadonlyMap<string,number>)=>CoordinateMapping|undefined;
  mappingRelationship?:{sourcePoint:string;targetAxis:string;targetSpace:string};
}
export interface CoordinateMemory { identity:string; values:Map<string,number>;pointOffset:number;upstreamOffset:number;downstreamOffset:number;valueOffset:number }
export interface EvidenceFallbackModel {
  presentation:RegisteredWorldPresentation;world:SemanticWorld;source:{sourceRunId:string;relationship:string};valid:boolean;
  run:EvidenceRun;envelope:EvidenceEnvelope;selection:WorldSelection;selected:EvidencePoint;displayed:readonly EvidencePoint[];hiddenCount:number;
  mapping?:CoordinateMapping;config:EvidenceFallbackConfig;memory:CoordinateMemory;store?:EvidenceStore;
  pointWindow:ReturnType<typeof presentationWindow<EvidencePoint>>;
  offWindowRelationshipCount:number;
}

export const groupedFallbackConfig:EvidenceFallbackConfig={label:'Grouped query/KV attention · 4 query / 2 KV heads',mapping:groupedCoordinateMapping,
  mappingRelationship:{sourcePoint:'mapping',targetAxis:'kv_head',targetSpace:'grouped-v1:kv_head'}};
export const shapeFallbackConfig:EvidenceFallbackConfig={label:'Shape-only unknown operation · structural preview'};
export const opaqueFallbackConfig:EvidenceFallbackConfig={label:'Opaque operation boundary · known input/output'};

const memories=new WeakMap<WorldSelection,CoordinateMemory>();
const axisKey=(axis:Pick<Axis,'role'|'space'>)=>`${axis.role}\u0000${axis.space}`;
function selectedPoint(run:EvidenceRun,selection:WorldSelection){return run.points.find(p=>p.node===selection.node&&p.port===selection.port&&p.phase===selection.phase);}
function remember(point:EvidencePoint,selection:WorldSelection,memory:CoordinateMemory){
  for(const axis of point.axes){const value=selection.coordinates[axis.role];if(typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<axis.size)memory.values.set(axisKey(axis),value);}
}
function sameAxisValue(axis:Axis,prior:EvidencePoint|undefined,selection:WorldSelection,memory:CoordinateMemory){
  const priorAxis=prior?.axes.find(candidate=>candidate.role===axis.role&&candidate.space===axis.space),direct=priorAxis?selection.coordinates[axis.role]:undefined;
  if(typeof direct==='number'&&Number.isInteger(direct)&&direct>=0&&direct<axis.size)return direct;
  const retained=memory.values.get(axisKey(axis));return retained!==undefined&&retained>=0&&retained<axis.size?retained:0;
}
export function selectionForEvidencePoint(point:EvidencePoint,prior:EvidencePoint|undefined,selection:WorldSelection,memory:CoordinateMemory,mapping?:CoordinateMapping):WorldSelection{
  const coordinates:Record<string,number>={};
  for(const axis of point.axes){
    const mapped=mapping?.targetAxis===axis.role&&mapping.targetSpace===axis.space?mapping.targetCoordinate:undefined;
    coordinates[axis.role]=mapped!==undefined&&mapped>=0&&mapped<axis.size?mapped:sameAxisValue(axis,prior,selection,memory);
  }
  return {node:point.node,port:point.port,phase:point.phase,coordinates};
}
export function resolveEvidenceSelection(run:EvidenceRun,selection:WorldSelection){
  const point=selectedPoint(run,selection);if(!point)return {valid:false as const};
  const keys=Object.keys(selection.coordinates).sort(),expected=point.axes.map(a=>a.role).sort();
  if(new Set(expected).size!==expected.length||JSON.stringify(keys)!==JSON.stringify(expected))return {point,valid:false as const};
  let index=0;for(const axis of point.axes){const value=selection.coordinates[axis.role];if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>=axis.size)return {point,valid:false as const};index=index*axis.size+value;}
  return {point,valid:true as const,index};
}
export function groupedMappingValue(run:EvidenceRun,queryHead:number):number|undefined{
  const point=run.points.find(p=>p.id==='mapping'),axis=point?.axes[0];
  if(!point||point.origin!=='observed'||point.availability!=='available'||point.dtype!=='int32'||point.axes.length!==1||axis?.role!=='query_head'||axis.space!=='grouped-v1:query_head'||!Number.isInteger(queryHead)||queryHead<0||queryHead>=axis.size)return undefined;
  const value=point.values?.[queryHead];return typeof value==='number'&&Number.isInteger(value)?value:undefined;
}
export function groupedCoordinateMapping(run:EvidenceRun,coordinates:ReadonlyMap<string,number>):CoordinateMapping|undefined{
  const sourceSpace='grouped-v1:query_head',targetSpace='grouped-v1:kv_head',queryHead=coordinates.get(`query_head\u0000${sourceSpace}`);
  if(queryHead===undefined)return undefined;const kvHead=groupedMappingValue(run,queryHead);if(kvHead===undefined)return undefined;
  return {sourcePoint:'mapping',sourceAxis:'query_head',sourceSpace,sourceCoordinate:queryHead,targetAxis:'kv_head',targetSpace,targetCoordinate:kvHead,origin:'derived',statement:`Selected query head ${queryHead} maps to KV head ${kvHead}`};
}
export function selectEvidencePoint(run:EvidenceRun,selection:WorldSelection,pointId:string,memory:CoordinateMemory,config:EvidenceFallbackConfig){
  const target=run.points.find(p=>p.id===pointId);if(!target)return false;const prior=selectedPoint(run,selection);if(prior)remember(prior,selection,memory);
  const mapping=config.mapping?.(run,memory.values),next=selectionForEvidencePoint(target,prior,selection,memory,mapping);
  Object.assign(selection,next);remember(target,selection,memory);memory.pointOffset=Math.floor(run.points.indexOf(target)/FALLBACK_POINT_LIMIT)*FALLBACK_POINT_LIMIT;memory.upstreamOffset=0;memory.downstreamOffset=0;memory.valueOffset=0;return true;
}
function address(run:EvidenceRun,point:EvidencePoint,coordinates:Readonly<Record<string,string|number>>={}):SemanticAddress{
  return {modelDefinition:run.definition,node:point.node,port:point.port,run:run.id,invocation:point.invocation,phase:point.phase,coordinates};
}
function relationshipKind(run:EvidenceRun,point:EvidencePoint,dependency:EvidencePoint):RelationshipKind{
  if(run.execution==='structural-preview')return 'structural';
  if(point.availability==='opaque'||dependency.availability==='opaque'||point.availability==='unsupported')return 'evidence_boundary';
  return 'activation';
}
function relationships(run:EvidenceRun,displayed:readonly EvidencePoint[],config:EvidenceFallbackConfig):SemanticRelationship[]{
  const byId=new Map(run.points.map(p=>[p.id,p]));
  const shown=new Set(displayed.map(p=>p.id));
  const result:SemanticRelationship[]=displayed.flatMap(point=>point.dependencies.flatMap(id=>{const dependency=byId.get(id);return dependency&&shown.has(id)?[{from:address(run,dependency),to:address(run,point),port:dependency.port,kind:relationshipKind(run,point,dependency),origin:'observed' as const}]:[];}));
  const mapping=config.mappingRelationship,source=byId.get(mapping?.sourcePoint??'');
  if(mapping&&source&&shown.has(source.id))for(const target of displayed.filter(p=>p.axes.some(a=>a.role===mapping.targetAxis&&a.space===mapping.targetSpace)))result.push({from:address(run,source),to:address(run,target),port:'coordinate-map',kind:'coordinate_mapping',origin:'derived'});
  return result;
}
function descriptor(run:EvidenceRun,displayed:readonly EvidencePoint[],config:EvidenceFallbackConfig):WorldDescriptor{return {integration:run.integration,modelDefinition:run.definition,label:config.label,presentation:EVIDENCE_FALLBACK_PRESENTATION,nodes:displayed.map(p=>({id:p.node,operation:p.id,port:p.port,coordinates:{},invocation:p.invocation,phase:p.phase}))};}
function initialize(run:EvidenceRun,selection:WorldSelection,config:EvidenceFallbackConfig){
  const identity=`${run.definition}/${run.id}`;let memory=memories.get(selection),point=selectedPoint(run,selection);
  if(!memory||memory.identity!==identity||!point){memory={identity,values:new Map(),pointOffset:0,upstreamOffset:0,downstreamOffset:0,valueOffset:0};memories.set(selection,memory);point=run.points[0]!;Object.assign(selection,{node:'',port:'',phase:'',coordinates:{}});selectEvidencePoint(run,selection,point.id,memory,config);}
  else remember(point,selection,memory);
  return memory;
}
export function composeEvidenceFallback(run:EvidenceRun,envelope:EvidenceEnvelope,selection:WorldSelection,replay:boolean,config:EvidenceFallbackConfig,store?:EvidenceStore):EvidenceFallbackModel{
  const memory=initialize(run,selection,config),resolved=resolveEvidenceSelection(run,selection),selected=resolved.point??run.points[0]!,pointWindow=presentationWindow(run.points,memory.pointOffset,FALLBACK_POINT_LIMIT),displayed=pointWindow.items.includes(selected)?pointWindow.items:[selected,...pointWindow.items.slice(0,FALLBACK_POINT_LIMIT-1)],d=descriptor(run,displayed,config);
  memory.pointOffset=pointWindow.offset;
  const shown=new Set(displayed.map(point=>point.id)),offWindowRelationshipCount=displayed.reduce((total,point)=>total+point.dependencies.filter(id=>!shown.has(id)).length,0);
  const model={} as EvidenceFallbackModel;Object.assign(model,{world:{descriptor:d,run:run.id,nodes:composeWorld(d,run.id,'fixture:0',run.execution==='structural-preview'?'preview':'forward'),relationships:relationships(run,displayed,config),capabilities:['bounded-inspection','source','saved-replay']},source:{sourceRunId:run.id,relationship:replay?'REPLAY':'HISTORICAL'},valid:resolved.valid,run,envelope,selection,selected,displayed,hiddenCount:run.points.length-displayed.length,mapping:config.mapping?.(run,memory.values),config,memory,store,pointWindow,offWindowRelationshipCount});
  model.presentation={id:EVIDENCE_FALLBACK_PRESENTATION,viewport:{x:0,y:0,width:1800,height:1000},render:state=>renderEvidenceFallback(model,state.status,state.error,state.replay),bind:(changed,render)=>bindEvidenceFallback(model,changed,render)};return model;
}

function layout(points:readonly EvidencePoint[]){
  const shown=new Set(points.map(p=>p.id)),level=new Map<string,number>();for(const p of points){const deps=p.dependencies.filter(d=>shown.has(d));level.set(p.id,deps.length?1+Math.max(...deps.map(d=>level.get(d)??0)):0);}
  const rows=new Map<number,number>();return new Map(points.map(p=>{const column=level.get(p.id)??0,row=rows.get(column)??0;rows.set(column,row+1);return [p.id,{x:90+column*390,y:130+row*190}] as const;}));
}
function pointValues(model:EvidenceFallbackModel,point:EvidencePoint,start:number,count:number){
  if(point.availability!=='available')return [];
  return model.store?model.store.slice(model.run.id,point.id,start,count):point.values?.slice(start,start+count)??[];
}
function pointPreview(model:EvidenceFallbackModel,point:EvidencePoint){return pointValues(model,point,0,Math.min(4,point.shape.reduce((a,b)=>a*b,1))).map(v=>Number.isInteger(v)?String(v):Number(v.toPrecision(6))).join(', ');}
function sceneLabel(id:string){return id.length>21?`${id.slice(0,20)}…`:id;}
export function renderEvidenceFallbackScene(model:EvidenceFallbackModel){
  const positions=layout(model.displayed);
  const edges=model.world.relationships.flatMap(rel=>{const from=model.displayed.find(p=>p.node===rel.from.node&&p.port===rel.from.port),to=model.displayed.find(p=>p.node===rel.to.node&&p.port===rel.to.port),a=from&&positions.get(from.id),b=to&&positions.get(to.id);return a&&b?[`<path class="fallback-edge ${rel.kind}" data-relationship="${rel.kind}" d="M${a.x+260} ${a.y+60} C${a.x+315} ${a.y+60} ${b.x-55} ${b.y+60} ${b.x} ${b.y+60}"><title>${rel.kind}${rel.origin?` · ${rel.origin}`:''}</title></path>`]:[];}).join('');
  const boxes=model.displayed.map(p=>{const pos=positions.get(p.id)!,selected=p===model.selected,numeric=p.availability==='available',availability=availabilityPresentation(p),size=p.shape.reduce((a,b)=>a*b,1);return `<g role="button" tabindex="0" data-fallback-point="${esc(p.id)}" aria-label="${esc(p.id)}" aria-pressed="${selected}" class="world-object fallback-node ${selected?'selected':''} ${p.availability.replaceAll('_','-')}"><title>${esc(p.id)}</title><rect class="field" x="${pos.x}" y="${pos.y}" width="260" height="120" rx="4"/><text class="station-title" x="${pos.x+14}" y="${pos.y+30}">${esc(sceneLabel(p.id))}</text><text class="station-meta" x="${pos.x+14}" y="${pos.y+58}">${esc(p.phase)} · ${esc(p.availability)}</text><text class="station-meta" x="${pos.x+14}" y="${pos.y+84}">[${p.shape.join(', ')}] · ${esc(p.axes.map(a=>a.role).join(' × ')||'scalar')}</text>${numeric?`<text class="fallback-value" data-numerical-glyph="exact-text" x="${pos.x+14}" y="${pos.y+108}">${esc(pointPreview(model,p))}${size>4?' …':''}</text>`:`<text class="fallback-unavailable" x="${pos.x+14}" y="${pos.y+108}">${esc(availability.label)}</text>`}</g>`;}).join('');
  const width=Math.max(1200,...[...positions.values()].map(p=>p.x+340)),height=Math.max(700,...[...positions.values()].map(p=>p.y+220));
  return `<svg id="spatial-world" class="spatial-world evidence-fallback-world" data-world-width="${width}" data-world-height="${height}" viewBox="0 0 ${width} ${height}" tabindex="0" role="group" aria-label="Bounded evidence topology for ${esc(model.config.label)}"><defs><marker id="forward-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="#62C7E8"/></marker><marker id="mapping-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="#FFD166"/></marker></defs><text class="region-title" x="80" y="72">BOUNDED EVIDENCE WORLD · ${model.displayed.length}/${model.run.points.length} POINTS</text><text class="station-meta" x="80" y="98">${model.offWindowRelationshipCount} displayed dependencies continue to retained off-window points</text>${edges}${boxes}</svg>`;
}
function coordinates(model:EvidenceFallbackModel,point:EvidencePoint){return point.axes.map(axis=>{const value=model.selection.coordinates[axis.role];return axis.size>PRESENTATION_WORK.coordinateOptions?`<label>${esc(axis.role.replaceAll('_',' '))}<input type="number" min="0" max="${axis.size-1}" value="${value}" data-fallback-coordinate="${esc(axis.role)}" data-axis-space="${esc(axis.space)}"><small>${esc(axis.space)} · exact coordinate</small></label>`:`<label>${esc(axis.role.replaceAll('_',' '))}<select data-fallback-coordinate="${esc(axis.role)}" data-axis-space="${esc(axis.space)}">${Array.from({length:axis.size},(_,i)=>`<option value="${i}" ${value===i?'selected':''}>${i}</option>`).join('')}</select><small>${esc(axis.space)}</small></label>`;}).join('');}
function navigation(points:readonly EvidencePoint[],offset:number,testid:string,direction:'upstream'|'downstream'){
  const window=presentationWindow(points,offset,PRESENTATION_WORK.relationships);
  return `<div class="fallback-navigation" data-testid="${testid}"><p>${windowSummary(window)}</p><button data-relationship-page="${direction}:previous" ${window.hasPrevious?'':'disabled'}>Previous ${direction} relationships</button><button data-relationship-page="${direction}:next" ${window.hasNext?'':'disabled'}>Next ${direction} relationships</button>${window.items.map(p=>`<button data-fallback-point="${esc(p.id)}">${esc(p.id)} · ${esc(p.availability)}</button>`).join('')||'<span>None recorded</span>'}</div>`;
}
function refusal(point:EvidencePoint,upstream:EvidencePoint[],downstream:EvidencePoint[]){
  const known=`Known: ${point.node}/${point.port}, shape [${point.shape.join(', ')}], axes ${point.axes.map(a=>`${a.role} [${a.space}]`).join(' × ')||'scalar'}, source ${point.source.file}#${point.source.symbol}.`;
  const reason=availabilityPresentation(point).explanation;
  return `Requested detail for ${point.id}. ${known} ${reason} Reachable evidence: ${[...upstream,...downstream].map(p=>p.id).join(', ')||'no adjacent captured point'}.`;
}
function valueTable(model:EvidenceFallbackModel,point:EvidencePoint,selectedIndex:number|undefined){if(point.availability!=='available')return '';const total=point.shape.reduce((a,b)=>a*b,1),include=selectedIndex??0,window=rangeWindow(total,model.memory.valueOffset,PRESENTATION_WORK.valuePreview,include),values=pointValues(model,point,window.offset,window.end-window.offset);model.memory.valueOffset=window.offset;return `<div class="table-scroll"><table data-testid="fallback-values"><thead><tr><th>Flat coordinate</th><th>Exact ${esc(point.dtype)} value</th></tr></thead><tbody>${values.map((value,i)=>`<tr><td>${window.offset+i}</td><td data-value="${value}">${value}</td></tr>`).join('')}</tbody></table></div><p data-testid="fallback-value-window">${windowSummary(window)} elements. This window is not the complete tensor.</p>`;}
export function renderEvidenceFallback(model:EvidenceFallbackModel,status:string,error:string,replay:boolean){
  const p=model.selected,resolved=resolveEvidenceSelection(model.run,model.selection),value=resolved.valid&&resolved.index!==undefined?pointValues(model,p,resolved.index,1)[0]:undefined,addressValue=address(model.run,p,model.selection.coordinates),upstream=p.dependencies.map(id=>model.run.points.find(q=>q.id===id)!).filter(Boolean),downstream=model.run.points.filter(q=>q.dependencies.includes(p.id)),unavailable=p.availability!=='available',availability=availabilityPresentation(p);
  const mapping=model.mapping?`<section class="fallback-mapping" data-testid="grouped-mapping-proof" data-query-head="${model.mapping.sourceCoordinate}" data-kv-head="${model.mapping.targetCoordinate}"><strong>${esc(model.mapping.statement)}</strong><span>Derived from observed <code>${esc(model.mapping.sourcePoint)}[${model.mapping.sourceAxis}=${model.mapping.sourceCoordinate}] = ${model.mapping.targetCoordinate}</code>.</span><span>Coordinate spaces remain distinct: <code>${esc(model.mapping.sourceSpace)}</code> → <code>${esc(model.mapping.targetSpace)}</code>. The original observed mapping [0, 0, 1, 1] is unchanged.</span></section>`:'';
  return `<div class="spatial-shell fallback-shell" data-integration="${esc(model.run.integration)}"><header class="spatial-header"><div class="world-brand"><strong>MODEL LAB</strong><small>${esc(model.config.label)} · reusable evidence fallback</small></div><strong>${esc(model.run.integration)}</strong><button id="return-canonical-world">Return to MicroGPT</button><button id="spatial-home">⌂ Home</button><span class="spatial-badge">${replay?'SAVED REPLAY · NO EXECUTION':model.run.execution==='structural-preview'?'STRUCTURAL PREVIEW · NO EXECUTION':'RETAINED EVIDENCE · READ ONLY'}</span></header><div class="spatial-status"><span role="status" data-testid="status">${esc(status)}</span><span data-testid="spatial-relationship">${esc(model.source.relationship)} · ${esc(model.run.execution)} · ${esc(model.run.precision.compute)}</span></div>${error?`<p role="alert">${esc(error)}</p>`:''}<p class="fallback-coverage" role="status" data-testid="fallback-point-window">${windowSummary(model.pointWindow)} points. ${model.hiddenCount} retained point${model.hiddenCount===1?' is':'s are'} outside this rendered window; they remain accessible.</p>${mapping}<nav class="spatial-selection" aria-label="Semantic selection"><button id="fallback-point-prev" ${model.pointWindow.hasPrevious?'':'disabled'}>Previous point page</button><button id="fallback-point-next" ${model.pointWindow.hasNext?'':'disabled'}>Next point page</button><label>Evidence<select id="fallback-operation">${model.displayed.map(q=>`<option value="${esc(q.id)}" ${q===p?'selected':''}>${esc(q.id)} · ${esc(q.phase)} / ${esc(q.availability)}</option>`).join('')}</select></label>${coordinates(model,p)}<span class="scope-note">run / node / port / phase / role + coordinate space</span></nav><div class="world-workspace has-lens"><div class="world-pane">${renderEvidenceFallbackScene(model)}<div class="selection-card"><small>SELECTED WORLD OBJECT</small><strong data-testid="selected-world-object">${esc(p.id)}</strong><span>${esc(p.node)} / ${esc(p.port)} / ${esc(p.phase)} · ${esc(JSON.stringify(model.selection.coordinates))}</span><span>${value===undefined?`No numerical value · ${esc(p.availability)}`:`Observed ${esc(p.dtype)} value ${value}`}</span></div></div><aside class="context-lens" data-selection="${esc(JSON.stringify([p.id,model.selection.coordinates,model.run.id]))}" aria-label="Bounded evidence lens"><div class="lens-heading"><div><small>BOUND EVIDENCE</small><h2>${esc(p.id)}</h2></div><strong class="availability ${esc(p.availability)}" data-testid="fallback-availability">${esc(availability.label)}</strong></div><div class="lens-scroll fallback-lens"><p data-testid="semantic-address">${esc(semanticAddressId(addressValue))}</p><p data-testid="fallback-shape">Shape [${p.shape.join(', ')}] · axes ${p.axes.map(a=>`${a.role} [${a.space}]`).join(' × ')||'scalar'} · ${p.dtype}</p><p>${esc(p.semantics)}</p><p>Origin/provenance: <strong>${esc(p.origin)}</strong> · availability: <strong>${esc(p.availability)}</strong></p><p data-testid="fallback-availability-explanation">${esc(availability.explanation)}</p><p data-testid="fallback-selected-value">${value===undefined?'Numerical values unavailable; no zero or placeholder substituted.':`Selected exact value ${value}`}</p>${valueTable(model,p,resolved.valid?resolved.index:undefined)}<h3>Known upstream relationships</h3>${navigation(upstream,model.memory.upstreamOffset,'upstream-choices','upstream')}<h3>Known downstream relationships</h3>${navigation(downstream,model.memory.downstreamOffset,'downstream-choices','downstream')}<button id="fallback-detail">Request numerical / scalar detail</button><p data-testid="fallback-refusal" class="fallback-refusal" ${unavailable?'':'hidden'}>${unavailable?esc(refusal(p,upstream,downstream)):''}</p><details data-testid="fallback-source"><summary>Read bound source identity</summary><p>${esc(p.source.file)} · ${esc(p.source.symbol)} · ${esc(p.source.revision)}</p><p>The immutable file, symbol and revision binding is retained. The shared inspector provides the bundled source body when that exact revision is available; no different source is substituted here.</p></details><p>Opening, selecting, navigating and replaying this retained evidence never invokes an executor.</p></div></aside></div></div>`;
}
export function bindEvidenceFallback(model:EvidenceFallbackModel,changed:()=>void,render:()=>void){
  const root=document.querySelector<HTMLElement>('.fallback-shell');if(!root)return;
  const choose=(id:string,focus:string)=>{if(!selectEvidencePoint(model.run,model.selection,id,model.memory,model.config))return;changed();render();document.querySelector<HTMLElement>(focus)?.focus({preventScroll:true});};
  root.querySelector<HTMLSelectElement>('#fallback-operation')?.addEventListener('change',event=>choose((event.target as HTMLSelectElement).value,'#fallback-operation'));
  root.querySelector('#fallback-point-prev')?.addEventListener('click',()=>{model.memory.pointOffset=previousWindowOffset(model.memory.pointOffset,FALLBACK_POINT_LIMIT);changed();render();queueMicrotask(()=>document.querySelector<HTMLElement>('#fallback-point-prev')?.focus({preventScroll:true}));});
  root.querySelector('#fallback-point-next')?.addEventListener('click',()=>{model.memory.pointOffset=nextWindowOffset(model.memory.pointOffset,FALLBACK_POINT_LIMIT,model.run.points.length);changed();render();queueMicrotask(()=>document.querySelector<HTMLElement>('#fallback-point-next')?.focus({preventScroll:true}));});
  root.querySelectorAll<HTMLElement>('[data-fallback-point]').forEach(el=>{const action=()=>choose(el.dataset.fallbackPoint!,`[data-fallback-point="${CSS.escape(el.dataset.fallbackPoint!)}"]`);el.addEventListener('click',action);el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();action();}});});
  root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-fallback-coordinate]').forEach(el=>el.addEventListener('change',()=>{const role=el.dataset.fallbackCoordinate!,axis=model.selected.axes.find(a=>a.role===role),value=Number(el.value);if(!axis||!Number.isSafeInteger(value)||value<0||value>=axis.size){if(el instanceof HTMLInputElement){el.setCustomValidity(`Enter an integer from 0 through ${Math.max(0,(axis?.size??1)-1)}.`);el.reportValidity();}return;}if(el instanceof HTMLInputElement)el.setCustomValidity('');model.selection.coordinates[role]=value;model.memory.values.set(axisKey(axis),value);model.memory.valueOffset=Math.floor(resolveEvidenceSelection(model.run,model.selection).index!/PRESENTATION_WORK.valuePreview)*PRESENTATION_WORK.valuePreview;changed();render();document.querySelector<HTMLElement>(`[data-fallback-coordinate="${CSS.escape(role)}"]`)?.focus({preventScroll:true});}));
  root.querySelectorAll<HTMLElement>('[data-relationship-page]').forEach(el=>el.addEventListener('click',()=>{const [direction,step]=el.dataset.relationshipPage!.split(':') as ['upstream'|'downstream','previous'|'next'];const points=direction==='upstream'?model.selected.dependencies:model.run.points.filter(p=>p.dependencies.includes(model.selected.id));const key=direction==='upstream'?'upstreamOffset':'downstreamOffset';model.memory[key]=step==='previous'?previousWindowOffset(model.memory[key],PRESENTATION_WORK.relationships):nextWindowOffset(model.memory[key],PRESENTATION_WORK.relationships,points.length);changed();render();queueMicrotask(()=>document.querySelector<HTMLElement>(`[data-relationship-page="${direction}:${step}"]`)?.focus({preventScroll:true}));}));
  root.querySelector('#spatial-home')?.addEventListener('click',()=>{model.memory.values.clear();model.memory.pointOffset=0;model.memory.upstreamOffset=0;model.memory.downstreamOffset=0;model.memory.valueOffset=0;Object.assign(model.selection,{node:'',port:'',phase:'',coordinates:{}});selectEvidencePoint(model.run,model.selection,model.run.points[0]!.id,model.memory,model.config);changed();render();document.querySelector<HTMLElement>('#spatial-home')?.focus({preventScroll:true});});
  root.querySelector('#fallback-detail')?.addEventListener('click',()=>{const upstream=model.selected.dependencies.map(id=>model.run.points.find(p=>p.id===id)!).filter(Boolean),downstream=model.run.points.filter(p=>p.dependencies.includes(model.selected.id)),message=root.querySelector<HTMLElement>('[data-testid="fallback-refusal"]');if(message){message.hidden=false;message.textContent=refusal(model.selected,upstream,downstream);message.focus({preventScroll:true});}});
}
