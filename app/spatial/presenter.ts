import { outputSummary, componentComparison, type OutputPair } from './comparison.js';
import type { ForwardModel } from './forward.js';
import { liveLearningScene, liveLearningInspector } from './live-learning.js';
import type { ForwardDriver } from '../worker/forward-driver.js';
import type { ForwardBoundary } from '../../model/microgpt.js';
import { ExplanationPlayback } from "./playback.js";
import { learningScene, learningInspector, parameterLabel, learningStations } from "./learning-view.js";
import type { LearningModel, LearningStage, ParameterPin } from "./learning.js";
import type { SpatialReadModel, SpatialSelection } from "./bindings.js";
import { SpatialCamera, HOME, type CameraBox } from "./camera.js";
import { headKinds, operations, parameterOwners, type Address } from "./forward.js";
import { sceneSvg, stationFor } from "./scene.js";
import { forwardInspector, addressLabel } from "./inspector.js";
import { escapeHtml as esc } from "../views/evidence.js";
export const waypoints=["tokenEmbedding","positionEmbedding","embeddingSum","embeddingNorm","preAttentionNorm","q","k","v","attentionLogits","attentionProbabilities","headOutput","attentionOutput","attentionProjection","attentionResidual","preMlpNorm","mlpUp","mlpRelu","mlpDown","mlpResidual","logits","probabilities"];
interface Location {selection:SpatialSelection;kind:string;element:number;parameter?:string;row:number;column:number;lens:boolean;learningStage?:LearningStage;box:CameraBox}
export interface PresentationState {ablationPending?:boolean;inspectedArm?:string;intervention?:{head:number;snapshot:string;arm:string};comparison?:{before:ForwardModel;after:ForwardModel}; outputPair?:OutputPair; comparisonLabels?:[string,string]; execution?:ForwardDriver;document:string;busy:boolean;ready:boolean;status:string;error:string;scalar:string; learning?:LearningModel; experiments?:{id:string;step:number}[]; experimentId?:string; liveStep?:number; canLearn?:boolean}
export class SpatialPresenter {
  private redraw=()=>{};
  private guideApply=()=>{};
  readonly playback=new ExplanationPlayback(()=>this.redraw(),()=>this.guideApply(),2200,()=>this.emphasize());
  private emphasize(){const root=document.querySelector<HTMLElement>(".spatial-shell");if(root)root.dataset.explanationPhase=String(this.playback.phase);}
  private boundSelection?:SpatialSelection;
  private boundPin?:ParameterPin;
  private state?:PresentationState;
  private phase?:(phase:string)=>void;
  private model?:SpatialReadModel;
  private routeChoice:'forward'|'learning'='forward';
  interrupt(preserveFrame=false){this.playback.pause(true);this.camera.stop();if(!preserveFrame)this.pendingBox=undefined;this.detour=this.guided;
    const root=document.querySelector('.spatial-shell'),button=root?.querySelector('#explanation-play');if(button)button.textContent='Play';
    root?.querySelectorAll('.explanation-active,.explanation-input,.explanation-link').forEach(el=>el.classList.remove('explanation-active','explanation-input','explanation-link'));
  }
  invalidate(){this.playback.invalidate();this.guided=false;this.detour=false;this.step=0;this.camera.stop();this.pendingBox=undefined;}
  private guide(){
    if(!this.boundSelection)return;
    Object.assign(this.selection,this.boundSelection);
    if(this.boundPin)this.pin={...this.boundPin};
    this.guided=true;this.detour=false;
    if(this.playback.route==='forward'){
      this.step=this.playback.cursor;const kind=waypoints[this.step];
      this.go({kind,token:['k','v'].includes(kind)?this.selection.key:this.selection.query,...(headKinds.has(kind)?{head:this.selection.head}:{})},true);
    }else{
      const stages:LearningStage[]=['objective','gradient','adam','checkpoint','compare'];
      this.openLearning(stages[this.playback.cursor]);this.parameter=undefined;
      if(this.learningStage==='compare')this.kind='probabilities';
      const node=learningStations.find(s=>s.stage===this.learningStage)??learningStations[3];
      this.pendingBox={x:node.x-50,y:1160,width:820,height:460};
      if(!this.playback.follow)this.pendingBox=undefined;
      this.phase?.(this.playback.cursor>=3?'after':'training');
    }
    if(!this.playback.follow)this.pendingBox=undefined;
  }
  private start(){
    const source=this.routeChoice==='forward'?this.model?.source.sourceRunId:this.state?.learning?.available?this.state.learning.experiment.id:undefined;
    if(!source)return;
    this.boundSelection={...this.selection};this.boundPin={...this.pin};
    this.playback.bind(source,this.routeChoice,this.routeChoice==='forward'?waypoints.length:5);
  }
  followBoundary(boundary: ForwardBoundary) {
    if(this.kind === boundary.kind && this.address().token === boundary.token && (boundary.head===undefined || this.selection.head === boundary.head)) return;
    this.go(boundary, true);
  }
  private controls(){
    const e=this.state?.execution;
    if(e?.progress?.training) {
      const t=e.progress.training,ready=t.phase==='ready',disabled=e.phase!=='paused'||e.pending;
      return `<section class="explanation execution" id="execution-controls" data-execution-id="${esc(e.progress.executionId)}" data-sequence="${e.progress.sequence}" data-training-phase="${t.phase}"><nav aria-label="Live training execution">${ready?`<button id="execution-accept" ${disabled?'disabled':''}>Accept update</button>`:`<button id="execution-next" ${disabled?'disabled':''}>${t.phase==='backward'?'Next backward node':t.phase==='optimizer proposal'?'Next parameter proposal':'Next step'}</button><button id="execution-continue" ${disabled?'disabled':''}>Continue</button><button id="execution-pause" ${e.phase!=='running'?'disabled':''}>Pause</button>${!t.final || t.phase==='optimizer proposal'?`<button id="execution-pin" ${disabled?'disabled':''}>${t.phase==='optimizer proposal'?'Continue to next proposal to pinned parameter':'Run to next gradient contribution'}</button>`:''}`}<button id="execution-cancel" ${e.phase==='cancelling'?'disabled':''}>${ready?'Discard candidate':'Cancel training'}</button><label><input id="execution-follow" type="checkbox" ${e.follow?'checked':''}>Follow execution</label><span data-testid="execution-frontier">${ready?'Candidate ready — not accepted':`${esc(t.phase)} · ${e.phase}${e.runningToGradient?' · seeking pinned contribution':''}${t.stopped?(t.final?(t.phase==='optimizer proposal'&&t.count===0?' · backward complete — no remaining contributions for this parameter in this pass':' · stopped at pinned proposal boundary'):' · stopped after matching backward node'):''}`}</span></nav>${!ready?'<p class="learning-guidance" data-testid="learning-guidance">Run to next gradient contribution runs the required phases, then pauses after the next matching backward node for the pinned parameter. Repeated operands in one node finish together. Continue runs to Candidate ready; Accept / Discard remains your decision. Manual Next step remains available.</p>':""}${t.final&&!ready?'<p data-testid="gradient-stop-unavailable">No future backward contributions in this transaction. Continue toward Ready or inspect the completed gradient; new learning is a separate action.</p>':''}<p>Accepted step ${t.acceptedStep} · pinned ${esc(parameterLabel(this.pin))} → proposed step ${t.acceptedStep+1} · candidate remains provisional${t.proposal?` · θ ${t.proposal.before} → ${t.proposal.after} (one part of the full update)`:""}</p><details><summary>Execution diagnostics</summary><p>${t.count} units · last permit ${t.processed} · one explicit baseline pass · Continue ≤128 backward nodes/proposals per permit</p></details></section>`;
    }
    if(e){const label=(b?:ForwardBoundary)=>b?`${b.kind} · p${b.token}${b.layer===undefined?'':` / layer ${b.layer}`}${b.head===undefined?'':` / head ${b.head}`}`:'none';
      return `<section class="explanation execution" id="execution-controls" data-execution-id="${esc(e.progress?.executionId??'')}" data-sequence="${e.progress?.sequence??0}"><nav aria-label="Live prediction execution"><button id="execution-next" ${e.phase!=='paused'||e.pending?'disabled':''}>Next operator</button><button id="execution-continue" ${e.phase!=='paused'||e.pending?'disabled':''}>Continue</button><button id="execution-pause" ${e.phase!=='running'?'disabled':''}>Pause</button><button id="execution-cancel" ${e.phase==='cancelling'?'disabled':''}>Cancel execution</button><label><input id="execution-follow" type="checkbox" ${e.follow?'checked':''}>Follow execution</label><span data-testid="execution-frontier">${e.pending&&e.phase==='paused'?'stepping':esc(e.phase)} · ${e.progress?.sequence??0}/${e.progress?.total??'—'} · Last: ${label(e.progress?.last)} → Next: ${label(e.progress?.next)}</span></nav><p>Real operator permits · partial evidence is not history · paced control, not processor timing</p></section>`;
    }
const p=this.playback,available=this.routeChoice==='forward'?this.model?.valid:this.state?.learning?.available;
    return `<section class="explanation"><nav aria-label="Explanation playback"><label>Explain<select id="explanation-route"><option value="forward" ${this.routeChoice==='forward'?'selected':''}>Forward</option><option value="learning" ${this.routeChoice==='learning'?'selected':''}>Learning</option></select></label><button id="explanation-play" ${available?'':'disabled'}>${p.playing?'Pause':'Play'}</button><button id="waypoint-previous" ${p.source?'':'disabled'}>Previous</button><button id="waypoint-next" ${p.source?'':'disabled'}>Next</button><button id="explanation-restart" ${available?'':'disabled'}>Restart explanation</button><button id="waypoint-resume" ${available?'':'disabled'}>Resume explanation</button><label><input id="explanation-follow" type="checkbox" ${p.follow?'checked':''}>Camera follow</label><span class="explanation-phase" aria-hidden="true"><span>Inputs</span> → <span>Calculation</span> → <span>Result / consumer</span></span><span id="waypoint-status" data-testid="explanation-status">${p.source?`${p.exploring?'Explore detour':p.playing?'Playing':'Paused'} · ${p.cursor+1}/${p.length}`:available?'Ready':'Unavailable: select a complete retained transition'}</span></nav><p>Completed evidence · explanation controls never execute or pause Predict / Learn.</p></section>`;
  }
  readonly camera=new SpatialCamera();
  learningStage?:LearningStage;
  pin:ParameterPin={name:"wte",row:0,column:0};
  expanded=false;
  openLearning(stage:LearningStage){this.learningStage=stage;this.lens=true;}
  focusLearning(stage:LearningStage){this.interrupt();this.remember();this.openLearning(stage);const node=learningStations.find(s=>s.stage===stage)??learningStations[2];this.pendingBox={x:node.x-50,y:1160,width:820,height:460};}
  followLearning(stage: LearningStage) {
    if (this.learningStage === stage && this.lens) return;
    this.openLearning(stage); const node = learningStations.find(s => s.stage === stage) ?? learningStations[2];
    this.pendingBox = { x: node.x-50, y:1160, width:820, height:460 };
  }
  captureLocation(): Location { return { selection:{...this.selection},kind:this.kind,element:this.element,parameter:this.parameter,row:this.row,column:this.column,lens:this.lens,learningStage:this.learningStage,box:{...this.camera.box} }; }
  restoreLocation(location: Location) {
    Object.assign(this.selection,location.selection);this.kind=location.kind;this.element=location.element;this.parameter=location.parameter;
    this.row=location.row;this.column=location.column;this.lens=location.lens;this.learningStage=location.learningStage;this.pendingBox=location.box;
  }
  showOwner(){this.go({kind:this.pin.name,token:this.selection.query});}

  kind="attentionLogits";
  element=0;
  parameter?:string;
  private headWidth=4;
  row=0;column=0;lens=false;step=0;guided=false;detour=false;
  private history:Location[]=[];
  private pendingBox?:CameraBox;
  constructor(readonly selection:SpatialSelection){
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.interrupt();this.redraw();}});
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{this.camera.stop();});
  }
  address():Address{return {kind:this.kind,token:["k","v"].includes(this.kind)?this.selection.key:this.selection.query,...(headKinds.has(this.kind)?{head:this.selection.head}:{})};}
  private remember(){this.history.push({selection:{...this.selection},kind:this.kind,element:this.element,parameter:this.parameter,row:this.row,column:this.column,lens:this.lens,learningStage:this.learningStage,box:{...this.camera.box}});if(this.history.length>40)this.history.shift();}
  focusSelection(){this.frame();if(this.pendingBox){this.camera.move(this.pendingBox,false);this.pendingBox=undefined;}}
  private frame(){if(this.learningStage){const node=learningStations.find(s=>s.stage===this.learningStage)??learningStations[2];this.pendingBox={x:node.x-50,y:1160,width:820,height:460};return;}const s=stationFor(this.parameter??this.kind,this.selection.head);this.pendingBox={x:s.x-440,y:s.y-260,width:1040,height:740};}
  private go(address:Address, guided=false){
    if(!guided){this.interrupt();this.remember();}
    this.learningStage=undefined;
    this.parameter=parameterOwners[address.kind]?address.kind:undefined;
    if(!this.parameter)this.kind=address.kind;else this.pin={name:this.parameter,row:this.row,column:this.column};
    if(["k","v"].includes(address.kind))this.selection.key=address.token;else this.selection.query=address.token;
    if(address.head!==undefined)this.selection.head=address.head;
    this.element=address.kind==="attentionLogits"?this.selection.key:["q","k","v"].includes(address.kind)?this.selection.head*this.headWidth+this.selection.feature:0;this.lens=true;this.detour=this.guided&&!guided;this.frame();
  }
  render(m:SpatialReadModel|undefined,state:PresentationState) {
    this.model=m;this.state=state;
    const p=this.playback;
    if(p.source && (state.busy||!m||!m.valid|| (p.route==='forward'?m.source.sourceRunId!==p.source:!state.learning?.available||state.learning.experiment.id!==p.source)))this.invalidate();
    const s=this.selection,a=this.address();
    const prepared=state.execution?.progress?.training?.readyOutputs;
    const pair=prepared??state.outputPair;
    const labels:[string,string]=prepared?['Current','Candidate']:state.comparisonLabels??['Before','After'];
    const options=(labels:string[],selected:number)=>`${selected>=labels.length?`<option value="${selected}" selected>${selected} · unavailable</option>`:""}${labels.map((label,i)=>`<option value="${i}" ${selected===i?"selected":""}>${esc(label)}</option>`).join("")}`;
    const label=this.learningStage?`${this.learningStage} · ${parameterLabel(this.pin)}`:this.parameter??addressLabel(a);
    return `<div class="spatial-shell"><header class="spatial-header"><div class="world-brand"><strong>MODEL LAB</strong><small>one tiny transformer · one connected computation</small></div><label>Input<input id="document" type="text" maxlength="7" value="${esc(state.document)}" ${state.busy?"disabled":""}></label><button id="predict" ${state.busy||state.execution||!state.ready?"disabled":""}>Predict</button>${state.execution?"":`<button id="step-prediction" ${state.busy||!state.ready?"disabled":""}>Step through prediction</button><button id="step-learning" ${state.busy||!state.ready?"disabled":""}>Step through learning</button>`}<button id="spatial-learn" ${state.canLearn?"":"disabled"}>Learn · one update</button><button id="spatial-home">⌂ Home</button><button id="spatial-back" ${!this.history.length?"disabled":""}>← Back</button><button id="spatial-focus">◎ Focus</button><button id="spatial-lens">Q/K lens</button><button id="presentation-toggle">Classic presentation</button><button id="clear-session">Clear session</button><span class="spatial-badge">${state.execution?(state.execution.progress?.training?"LIVE TRAINING · WAVE 2B":"LIVE FORWARD · WAVE 2A"):"COMPLETED EVIDENCE · WAVE 1D"}</span></header>
      <div class="spatial-status"><span role="status" data-testid="status">${esc(state.status.replace(/ · [a-f0-9-]{36}:.*$/, ""))}</span>${state.ablationPending?'<button id="cancel-ablation">Cancel head comparison</button>':""}<span data-testid="spatial-relationship">${m?`${state.execution?'ACTIVE EXECUTION':m.source.relationship} · captured input ${esc(m.source.capturedDocument)}`:"NO SELECTED RUN"}</span></div>${state.error?`<p role="alert">${esc(state.error)}</p>`:""}${!m&&state.execution?this.controls():""}
      ${m?`<nav class="spatial-selection" aria-label="Semantic selection"><label>Position<select id="spatial-query">${options(m.labels,s.query)}</select></label><label>Head<select id="spatial-head">${options(m.heads.map(h=>`Head ${h.head}`),s.head)}</select></label><label>Key<select id="spatial-key">${options(m.labels,s.key)}</select></label><label>Q feature<select id="spatial-feature">${options(Array.from({length:m.width},(_,i)=>String(i)),s.feature)}</select></label><label>${state.execution?.progress?.training?"Forward selection":"Operation"}<select id="spatial-operation">${operations.map(o=>`<option value="${o.kind}" ${o.kind===this.kind?"selected":""}>${esc(o.title)}</option>`).join("")}</select></label><span class="scope-note">One selected position · all run positions remain addressable</span></nav>
      <nav ${state.execution||state.intervention?'hidden':''} class="learning-toolbar" aria-label="Learning transition"><strong>Live model step <span data-testid="spatial-live-step">${state.liveStep??0}</span></strong><span>Pinned ${esc(parameterLabel(this.pin))}</span><button id="learning-owner">Owner</button><label>Transition<select id="spatial-experiment"><option value="">Choose completed transition</option>${state.experiments?.map(e=>`<option value="${esc(e.id)}" ${e.id===state.experimentId?"selected":""}>Update ${e.step}</option>`).join("")??""}</select></label><button data-learning-phase="before">Before</button><button data-learning-phase="training">Training</button><button data-learning-phase="after">After</button><button ${state.intervention?'':'id="spatial-current"'}>Return to current model</button><button data-learning-stage="gradient">Contributions</button><button data-learning-stage="adam">Adam</button><button data-learning-stage="compare">Compare</button></nav>
      ${state.intervention?`<details class="comparison-playback"><summary>Explanation playback · completed evidence</summary>${this.controls()}</details>`:this.controls()}${state.intervention?`<div class="intervention-banner" data-testid="spatial-intervention">READ-ONLY · ${esc(state.intervention.arm)} · layer 0 / head ${state.intervention.head} · all positions, aggregated output → zero → concat. Same checkpoint <code title="${esc(state.intervention.snapshot)}">${esc(state.intervention.snapshot.slice(0,19))}…</code>. Q/K/V, scores, weights and the other head are preserved. The intervention site need not be the first numerical difference.</div>`:""}${pair?`<div class="decision-summary">${state.inspectedArm?`<small data-testid="inspected-arm">Inspecting ${esc(state.inspectedArm)}${state.comparison?" · paired map enabled":""}</small>`:""}${outputSummary(pair,s.query,labels)}<nav>${state.intervention?`<span>Accepted model step ${state.liveStep??0}</span><button id="spatial-current">Return to current model</button>`:""}<button data-compare-arm="before">Inspect ${labels[0].toLowerCase()}</button><button data-compare-arm="after">Inspect ${labels[1].toLowerCase()}</button><button data-compare-arm="pair">Shared-scale comparison</button></nav></div>`:""}<div class="world-workspace ${this.lens?"has-lens":""}"><div class="world-pane">${sceneSvg(m.forward,a,s.key,this.learningStage?this.pin.name:this.parameter,m.labels,s.query,state.comparison??(this.learningStage==="compare"&&state.learning?.available?state.learning.comparison:undefined),state.execution?.progress?.training ? liveLearningScene(state.execution.progress.training,this.pin) : learningScene(state.learning,this.learningStage,this.pin),state.execution?.progress,this.element)}<div class="camera-controls"><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button><button data-pan="-1,0" aria-label="Pan left">←</button><button data-pan="1,0" aria-label="Pan right">→</button><button data-pan="0,-1" aria-label="Pan up">↑</button><button data-pan="0,1" aria-label="Pan down">↓</button></div>
      <div class="selection-card"><small>SELECTED WORLD OBJECT</small><strong data-testid="selected-world-object">${esc(label)}</strong><span>position ${a.token} · query ${s.query} / key ${s.key} · head ${s.head}</span><span>${state.comparison?`${labels[0]}: neutral. ${labels[1]}: cyan. Shared scale per pair.`:this.learningStage==="compare"?"Before: neutral. After: cyan. Shared scale per pair.":"Signed strips: independent scales. Q/K lens: shared scale."}</span><button id="open-spatial-detail">Values / arithmetic / source</button>${this.kind==="headOutput"?`<button id="spatial-ablate" ${state.execution||state.busy?"disabled":""}>Test without this head</button><small class="head-action-scope">${state.execution?"Finish/cancel execution or accept/discard candidate first.":`Selected checkpoint ${esc((m.source.sourceSnapshotId??"unavailable").slice(0,19))}… · all positions, after aggregation / before concat.`}</small>`:""}${!m.valid?'<p role="alert">Selection unavailable in this run. Choose valid indices; prior evidence is not rebound.</p>':""}</div>
      <svg class="world-minimap" viewBox="0 0 4500 1700" aria-label="Same world camera footprint"><path d="M100 600 H4300"/>${operations.map((o)=>{const t=stationFor(o.kind,s.head);return `<rect x="${t.x}" y="${t.y}" width="100" height="160" class="${o.kind===this.kind?"selected":""}"/>`;}).join("")}<rect id="camera-footprint"/></svg></div>
      <svg class="context-tether" aria-hidden="true"><path id="context-tether-path"/></svg><aside class="context-lens" ${this.lens?"":"hidden"} data-selection="${esc(JSON.stringify([this.kind,a.token,a.head,this.parameter,this.learningStage,state.experimentId,m.source.sourceRunId]))}" aria-label="Contextual arithmetic lens">${this.learningStage&&state.execution?.progress?.training?liveLearningInspector(state.execution.progress.training,this.pin,state.scalar):this.learningStage?learningInspector(state.learning,this.learningStage,this.pin,a,state.scalar,this.expanded):forwardInspector(m,a,this.element,this.parameter,this.row,this.column,state.scalar,state.execution?.progress).replace('<details open><summary>Calculation and complete values</summary>',`${state.comparison?componentComparison(state.comparison,a,labels):""}<details open><summary>Calculation and complete values</summary>`)}</aside></div>
`:`<section class="spatial-empty"><h1>One model, a complete forward computation</h1><p>Enter a, b or c, then Predict. Explore its actual operations and their sources.</p></section>`}</div>`;
  }
  bind(m:SpatialReadModel|undefined,changed:()=>void,render:()=>void,phase?:(phase:string)=>void) {
    this.redraw=render;this.phase=phase;this.guideApply=()=>{this.guide();changed();};
    if(m)this.headWidth=m.width;
    const root=document.querySelector<HTMLElement>(".spatial-shell")!;
    this.emphasize();
    if(this.playback.source&&!this.playback.exploring&&m){
      const headSelector=['q','k','v'].includes(this.kind)||headKinds.has(this.kind)?`[data-world-head="${this.selection.head}"]`:'';
      const active=this.learningStage?root.querySelector(`svg [data-learning-stage="${this.learningStage==='compare'?'checkpoint':this.learningStage}"]`):root.querySelector(`[data-world-kind="${this.kind}"]${headSelector}`);
      active?.classList.add('explanation-active');
      if(!this.learningStage)for(const d of m.forward.upstream(this.address()))root.querySelectorAll(`[data-world-kind="${d.address.kind}"],[data-world-parameter="${d.address.kind}"]`).forEach(el=>el.classList.add('explanation-input'));
      if(!this.learningStage)root.querySelectorAll(`[data-edge-from="${this.kind}"],[data-edge-to="${this.kind}"]`).forEach(el=>el.classList.add('explanation-link'));
    }
    const on=(id:string,fn:()=>void)=>root.querySelector(id)?.addEventListener("click",fn);
    const change=()=>{this.interrupt(true);if(this.parameter&&!this.learningStage)this.pin={name:this.parameter,row:this.row,column:this.column};changed();render();};
    const home=()=>{this.interrupt();this.remember();this.lens=false;this.pendingBox={...HOME};render();};
    const back=()=>{this.interrupt();const prior=this.history.pop();if(!prior)return;Object.assign(this.selection,prior.selection);this.kind=prior.kind;this.element=prior.element;this.parameter=prior.parameter;this.row=prior.row;this.column=prior.column;this.lens=prior.lens;this.learningStage=prior.learningStage;this.pendingBox=prior.box;change();};
    for(const id of ["#spatial-home","#lens-home"])on(id,home);
    for(const id of ["#spatial-back","#lens-back"])on(id,back);
    on("#spatial-focus",()=>{this.remember();this.lens=true;this.frame();render();});
    on("#spatial-lens",()=>{this.go({kind:"attentionLogits",token:this.selection.query,head:this.selection.head});change();});
    on("#open-spatial-detail",()=>{this.lens=true;this.frame();render();});
    on("#close-spatial-lens",()=>{this.lens=false;render();});
    const gesture=()=>{this.interrupt();const status=root.querySelector('[data-testid="explanation-status"]');if(status&&this.playback.source)status.textContent=`Explore detour · ${this.playback.cursor+1}/${this.playback.length}`;this.remember();this.detour=this.guided;const label=root.querySelector("#waypoint-status");if(label&&this.guided)label.textContent=`Explore detour · ${this.playback.cursor+1}/${this.playback.length} · Resume explanation to return`;};
    const svg=root.querySelector<SVGSVGElement>("#spatial-world");
    if(svg){this.camera.attach(svg,()=>{const p=root.querySelector("#camera-footprint"),b=this.camera.box;p?.setAttribute("x",String(b.x));p?.setAttribute("y",String(b.y));p?.setAttribute("width",String(b.width));p?.setAttribute("height",String(b.height));const workspace=root.querySelector(".world-workspace")!.getBoundingClientRect(),lens=root.querySelector(".context-lens")!.getBoundingClientRect();
      const object=this.parameter?root.querySelector(`[data-world-parameter="${this.parameter}"]`):root.querySelector(`[data-world-kind="${this.kind}"]${["q","k","v"].includes(this.kind)||headKinds.has(this.kind)?`[data-world-head="${this.selection.head}"]`:""}`);
      const from=object?.querySelector("rect")?.getBoundingClientRect(),tether=root.querySelector("#context-tether-path");
      if(this.lens&&from&&from.right>workspace.left&&from.left<lens.left) tether?.setAttribute("d",`M${from.right-workspace.left} ${from.top+from.height/2-workspace.top} H${lens.left-workspace.left-7} V34 H${lens.left-workspace.left}`);else tether?.setAttribute("d","");},gesture);if(this.pendingBox){this.camera.move(this.pendingBox,!this.state?.execution);this.pendingBox=undefined;}}
    on("#zoom-in",()=>{gesture();this.camera.zoom(.8);});on("#zoom-out",()=>{gesture();this.camera.zoom(1.25);});
    root.querySelectorAll<HTMLElement>("[data-pan]").forEach(b=>b.addEventListener("click",()=>{gesture();const [x,y]=b.dataset.pan!.split(",").map(Number);this.camera.pan(x*this.camera.box.width*.15,y*this.camera.box.height*.15);}));
    for(const field of ["query","key","head","feature"] as const)root.querySelector(`#spatial-${field}`)?.addEventListener("change",event=>{this.remember();this.selection[field]=Number((event.target as HTMLSelectElement).value);if((field==="feature"||field==="head")&&["q","k","v"].includes(this.kind))this.element=this.selection.head*this.headWidth+this.selection.feature;if(field==="head"&&this.lens)this.frame();if(field==="key"&&this.kind==="attentionLogits")this.element=this.selection.key;this.detour=this.guided;change();});
    root.querySelector("#spatial-operation")?.addEventListener("change",event=>{this.go({kind:(event.target as HTMLSelectElement).value,token:["k","v"].includes((event.target as HTMLSelectElement).value)?this.selection.key:this.selection.query,...(headKinds.has((event.target as HTMLSelectElement).value)?{head:this.selection.head}:{})});change();});
    const select=(el:HTMLElement|SVGElement)=>{
      if(el.dataset.worldKind){this.go({kind:el.dataset.worldKind,token:["k","v"].includes(el.dataset.worldKind)?this.selection.key:this.selection.query,...(el.dataset.worldHead===undefined?{}:{head:Number(el.dataset.worldHead)})});}
      else if(el.dataset.worldParameter)this.go({kind:el.dataset.worldParameter,token:this.selection.query});
      else if(el.dataset.worldToken!==undefined){this.remember();this.selection.query=Number(el.dataset.worldToken);}
      change();
    };
    root.querySelectorAll<SVGElement>("[data-world-kind],[data-world-parameter],[data-world-token]").forEach(el=>{el.addEventListener("click",()=>select(el));el.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();select(el);}});});
    root.querySelectorAll<HTMLElement>("[data-dependency]").forEach(el=>el.addEventListener("click",()=>{this.go(JSON.parse(el.dataset.dependency!));change();}));
    root.querySelectorAll<HTMLElement>("[data-forward-element]").forEach(el=>el.addEventListener("click",()=>{this.element=Number(el.dataset.forwardElement);change();}));
    root.querySelectorAll<HTMLElement>("[data-spatial-key]").forEach(el=>el.addEventListener("click",()=>{this.selection.key=Number(el.dataset.spatialKey);if(this.kind==="attentionLogits")this.element=this.selection.key;change();}));
    for(const field of ["row","column"] as const)root.querySelector(`#parameter-${field}`)?.addEventListener("change",event=>{this[field]=Number((event.target as HTMLSelectElement).value);change();});
    root.querySelectorAll<HTMLElement>("[data-parameter-cell]").forEach(el=>el.addEventListener("click",()=>{[this.row,this.column]=el.dataset.parameterCell!.split(",").map(Number);change();}));
    on("#parameter-output",()=>{
      if(!this.parameter||!m)return;const name=this.parameter,kind=parameterOwners[name];
      let token=this.selection.query;
      if(name==="wte")token=m.forward.input.findIndex(id=>id===this.row);
      if(name==="wpe")token=this.row;
      if(token<0||token>=m.forward.input.length){root.querySelector("#parameter-output")?.insertAdjacentHTML("afterend",'<p role="status">This lookup row has no occurrence in the selected run; checkpoint values remain available.</p>');return;}
      this.go({kind,token});this.element=name==="wte"||name==="wpe"?this.column:this.row;change();
    });
    root.addEventListener('click',event=>{const el=(event.target as Element).closest('button,[data-world-kind],[data-learning-stage]');if(el&&!el.id.startsWith('explanation-')&&!el.id.startsWith('waypoint-')){this.interrupt();const status=root.querySelector('[data-testid="explanation-status"]');if(status&&this.playback.source)status.textContent=`Explore detour · ${this.playback.cursor+1}/${this.playback.length}`;}},{capture:true});
    root.querySelector('#explanation-route')?.addEventListener('change',event=>{this.invalidate();this.routeChoice=(event.target as HTMLSelectElement).value as 'forward'|'learning';render();});
    root.querySelector('#explanation-follow')?.addEventListener('change',event=>{this.playback.follow=(event.target as HTMLInputElement).checked;this.interrupt();render();});
    on('#explanation-play',()=>{if(this.playback.playing){this.playback.pause();render();}else{if(!this.playback.source)this.start();this.playback.play();}});
    on('#waypoint-previous',()=>this.playback.step(this.playback.cursor-1));
    on('#waypoint-next',()=>this.playback.step(this.playback.cursor+1));
    on('#waypoint-resume',()=>{if(!this.playback.source)this.start();this.playback.resume();});
    on('#explanation-restart',()=>{this.start();this.playback.step(0);});
  }
}
