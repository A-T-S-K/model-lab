import { EvidencePlayer, serializeEvidence, parseEvidence, MAX_RECORD_BYTES, check, type EvidenceStore, type EvidencePoint } from '../../trace/evidence.js';
import { ExecutorRegistry, type CanonicalReceipt } from '../worker/executors.js';
import { RUNTIME_REVISION } from '../../runtime/revision.js';
import { boundSource } from '../source/registered.js';
import { memoizedFullSupportDistribution } from './full-support-distribution.js';
import type { RetentionOperation } from '../../archive/retention.js';
import { PRESENTATION_WORK, nextWindowOffset, presentationWindow, previousWindowOffset, windowSummary } from '../presentation/work-contract.js';
import { availabilityPresentation } from '../presentation/availability.js';
const esc=(x:unknown)=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const SAVED='model-lab-evidence-v1';
const nativeOriginUnavailable=()=>!(location.protocol==='http:'&&location.hostname==='127.0.0.1'&&!!location.port);

export interface SharedEvidenceTransaction {
  readonly store: EvidenceStore;
  commit(): Promise<void>;
  cancel(): void;
}
export interface SharedEvidenceRetention {
  begin(operation: RetentionOperation): Promise<SharedEvidenceTransaction>;
}

/** One inspector/player for every registered producer; all values come from bounded store queries. */
export class SharedInspector {
  #root=document.createElement('section');#executors=new ExecutorRegistry();#player?:EvidencePlayer;
  #store?:EvidenceStore;#open=false;#busy=false;#message='';#selected=this.#executors.list()[0].id;#offset=0;
  #runOffset=0;#pointOffset=0;#dependencyOffset=0;
  #action='predict';#endpoint='http://127.0.0.1:4319/execute';#input='The cat sat';#replay=false;#rendering=false;#operation=0;
  #retention?:SharedEvidenceRetention;#pendingRetention?:SharedEvidenceTransaction;
  #allowOpen=true;
  constructor(){
    this.#root.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&this.#open){this.#open=false;this.render();this.#root.querySelector<HTMLButtonElement>('button')?.focus();}
      if(event.key==='Tab'&&this.#open){
        const items=Array.from(this.#root.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,summary')).filter(e=>e.getClientRects().length);
        const first=items[0],last=items.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    });
    this.#root.id='shared-inspector';document.body.append(this.#root);}
  sync(store:EvidenceStore,liveId:string|undefined,canSwitch:boolean,onCanonical:()=>Promise<CanonicalReceipt>,onWorld?:(runId:string,replay:boolean)=>void,worldAvailability?:(runId:string)=>string|undefined,retention?:SharedEvidenceRetention,allowOpen=true){
    this.#retention=retention;
    this.#allowOpen=allowOpen;
    if(!allowOpen&&this.#open){this.#open=false;}
    if(this.#store!==store){this.#operation++;this.#executors.cancel();this.#pendingRetention?.cancel();this.#pendingRetention=undefined;this.#store=store;this.#player=undefined;this.#offset=0;this.#runOffset=0;this.#pointOffset=0;this.#dependencyOffset=0;this.#replay=false;}
    if(!this.#open&&liveId&&store.list().some(r=>r.id===liveId)&&this.#executors.get(this.#selected).inputLocation==='world'&&this.#player?.runId!==liveId)this.select(liveId,false);
    this.#canSwitch=canSwitch;this.#canonical=onCanonical;this.#onWorld=onWorld;this.#worldAvailability=worldAvailability;this.render();
  }
  #canSwitch=true;#canonical:()=>Promise<CanonicalReceipt>=async()=>({status:'refused',reason:'Canonical executor unavailable'});
  #onWorld?: (runId:string,replay:boolean)=>void;#worldAvailability?: (runId:string)=>string|undefined;
  private select(id:string,replay=false){check(this.#store,'Store unavailable');this.#player=new EvidencePlayer(this.#store,id);this.#offset=0;this.#dependencyOffset=0;this.#replay=replay;this.#selected=this.#player.run.integration;const runIndex=this.#store.list().findIndex(item=>item.id===id);this.#runOffset=Math.floor(Math.max(0,runIndex)/PRESENTATION_WORK.sharedRuns)*PRESENTATION_WORK.sharedRuns;this.#pointOffset=0;}
  private distribution(p:EvidencePoint):string{
    if(p.availability!=='available'||p.axes.length!==1||p.axes[0].role!=='output_index'||!this.#store||!this.#player)return '';
    const size=p.shape.reduce((product,value)=>product*value,1),distribution=memoizedFullSupportDistribution(this.#store,`${this.#player.runId}/${p.id}`,size,this.#offset,(start,count)=>this.#store!.slice(this.#player!.runId,p.id,start,count));
    return `<h3>Derived full-support softmax</h3><p>Denominator covers all ${distribution.size} output indices. No sampling or top-k renormalization. Output indices are shown without invented tokenizer labels.</p><table><thead><tr><th>Output index</th><th>Observed logit</th><th>Derived probability</th></tr></thead><tbody>${distribution.top.map(p=>`<tr><td>${p.index}</td><td>${p.logit}</td><td>${p.probability}</td></tr>`).join('')}</tbody></table><p data-testid="omitted-mass">Omitted mass: ${distribution.omittedMass}</p><p data-testid="selected-probability">Exact selected index ${distribution.selected.index}: logit ${distribution.selected.logit}; derived probability ${distribution.selected.probability}</p>`;
  }
  private source(p:EvidencePoint):string {
    const code=boundSource(p.source);
    return `<details><summary>Read bound source · ${esc(p.source.symbol)}</summary><p>${esc(p.source.file)}<br><code>${esc(p.source.revision)}</code></p>${code?`<pre class="shared-source">${esc(code)}</pre>`:'<p>Source body not bundled for this historical revision; identity retained. No source from a different runtime is substituted.</p>'}</details>`;
  }
  render(){
    if(this.#rendering)return;
    this.#rendering=true;
    const active=this.#root.contains(document.activeElement)?document.activeElement as HTMLElement:null;
    const focusId=active?.id,focusPoint=active?.dataset.point;
    try {
    if(!this.#store)return;
    if(!this.#open){
      if(!this.#allowOpen){this.#root.innerHTML='';return;}
      this.#root.innerHTML='<button id="open-shared-inspector">Models & saved evidence</button>';this.#root.querySelector('button')!.onclick=()=>{this.#open=true;this.render();this.#root.querySelector<HTMLElement>('#shared-model')?.focus();};return;}
    const player=this.#player,p=player?.current,run=player?.run;
    const list=this.#store.list(),binding=this.#executors.get(this.#selected),nativeUnavailable=!!binding.endpoint&&nativeOriginUnavailable();
    const selectedRunIndex=run?list.findIndex(item=>item.id===run.id):-1,runWindow=presentationWindow(list,this.#runOffset,PRESENTATION_WORK.sharedRuns);
    this.#runOffset=runWindow.offset;
    const runItems=run&&selectedRunIndex>=0&&!runWindow.items.includes(run)?[run,...runWindow.items.slice(0,PRESENTATION_WORK.sharedRuns-1)]:runWindow.items;
    const pointWindow=run?presentationWindow(run.points,this.#pointOffset,PRESENTATION_WORK.sharedPoints):undefined;
    if(pointWindow)this.#pointOffset=pointWindow.offset;
    const pointItems=pointWindow&&p&&!pointWindow.items.includes(p)?[p,...pointWindow.items.slice(0,PRESENTATION_WORK.sharedPoints-1)]:pointWindow?.items;
    const dependencyWindow=p?presentationWindow(p.dependencies,this.#dependencyOffset,PRESENTATION_WORK.relationships):undefined;if(dependencyWindow)this.#dependencyOffset=dependencyWindow.offset;
    const inputLabel=(input:typeof list[number]['input'])=>'text' in input?input.text:JSON.stringify(input.values);
    this.#root.innerHTML=`<div class="shared-shade"><section class="shared-panel" role="dialog" aria-modal="true" aria-labelledby="shared-title"><header><div><small>MODEL LAB · SHARED EVIDENCE</small><h2 id="shared-title">Inspect a recorded computation</h2></div><button id="close-shared">Return to world</button></header>
      <div class="shared-controls"><label>Producer<select id="shared-model">${this.#executors.list().map(binding=>`<option value="${esc(binding.id)}" ${binding.id===this.#selected?'selected':''}>${esc(binding.label)}</option>`).join('')}${binding.inputLocation==='saved'?`<option selected value="${esc(binding.id)}">${esc(binding.label)} · saved only</option>`:''}</select></label>
      ${binding.inputLocation==='request'?`<label>${esc(binding.inputLabel??'Input')}<input id="native-prompt" value="${esc(this.#input)}" maxlength="2048"></label>${binding.endpoint?`<label>Local bridge endpoint<input id="native-endpoint" value="${esc(this.#endpoint)}"></label>`:''}<label>Action<select id="shared-action">${(binding.actions??['predict']).map(a=>`<option ${a===this.#action?'selected':''}>${esc(a)}</option>`).join('')}</select></label>`:binding.inputLocation==='saved'?'<p>Saved structural or numerical evidence. No registered execution action.</p>':'<p>Predict uses the canonical input in the world. Accepted state and candidate decisions remain in the canonical controls.</p>'}
      <button id="shared-execute" ${this.#busy||!this.#canSwitch||binding.inputLocation==='saved'||nativeUnavailable?'disabled':''}>Run selected producer</button><button id="shared-cancel" ${!this.#busy?'disabled':''}>Cancel request</button>${nativeUnavailable?'<p data-testid="native-origin-unavailable">Optional native execution is qualified only from an exact HTTP loopback application origin. Saved evidence remains available.</p>':''}</div>
      <div class="shared-controls"><label>Run<select id="shared-run"><option value="">Select retained evidence</option>${runItems.map(r=>`<option value="${esc(r.id)}" ${r.id===run?.id?'selected':''}>${esc(r.integration)} · ${esc(inputLabel(r.input))} · ${esc(r.id)}</option>`).join('')}</select></label><button id="shared-run-prev" ${runWindow.hasPrevious?'':'disabled'}>Previous retained runs</button><button id="shared-run-next" ${runWindow.hasNext?'':'disabled'}>Next retained runs</button><span data-testid="shared-run-window">${windowSummary(runWindow)}${run&&selectedRunIndex>=0&&!runWindow.items.includes(run)?' · selected run kept visible':''}</span><label>Exact run ID<input id="shared-run-id" value="${esc(run?.id??'')}" maxlength="2048"></label><button id="shared-run-open">Open exact run</button><button id="shared-world" ${!run||!this.#canSwitch||this.#worldAvailability?.(run.id)?'disabled':''}>Open in continuous world</button><button id="shared-save" ${!run||!this.#store.hasEnvelope(run.id)?'disabled':''}>Save selected run</button><button id="shared-load">Open saved run</button><button id="shared-export" ${!run||!this.#store.hasEnvelope(run.id)?'disabled':''}>Export JSON</button><label>Import inert recording<input id="shared-import" type="file" accept="application/json"></label></div>
      <p role="status" data-testid="shared-status">${esc(this.#message)}</p>
      ${p&&run&&pointWindow&&pointItems?`<p class="shared-provenance" data-testid="shared-provenance">${this.#replay?'SAVED REPLAY':'RETAINED EVIDENCE'} · ${esc(run.execution)} · ${esc(p.origin)} · ${esc(p.availability)} · verification: not independently certified · executor ${!this.#replay&&this.#executors.get(run.integration).connected()?'connected':'not required for inspection'}</p><div class="shared-grid"><nav aria-label="Captured points"><h3>Captured boundaries</h3><p data-testid="shared-point-window">${windowSummary(pointWindow)}${!pointWindow.items.includes(p)?' · selected point kept visible':''}</p><div class="shared-controls"><button id="shared-point-prev" ${pointWindow.hasPrevious?'':'disabled'}>Previous recorded points</button><button id="shared-point-next" ${pointWindow.hasNext?'':'disabled'}>Next recorded points</button></div>${pointItems.map(point=>{const i=run.points.indexOf(point);return `<button data-point="${i}" aria-pressed="${i===player!.index}">${esc(point.node)} / ${esc(point.port)}</button>`;}).join('')}</nav><article>
      <div class="shared-controls"><button id="shared-next">Next recorded point</button><span>Explanation playback · no execution or timing claim</span></div>
      <h3 data-testid="shared-point">${esc(p.node)} / ${esc(p.port)}</h3><p>${esc(p.semantics)}</p><p>${esc(p.dtype)} · ${esc(p.encoding)} · shape [${p.shape.join(', ')}]<br>${p.axes.map(a=>`${esc(a.role)}: ${a.size} [${esc(a.space)}]`).join(' · ')}</p><p data-testid="shared-storage">${p.payload?`payload-backed · ${esc(p.payload.format)} · ${p.payload.byteLength} bytes · ${esc(p.payload.byteOrder)} · ${esc(p.payload.layout)}`:p.availability==='available'?'inline retained values':'no numerical payload'}</p><p data-testid="shared-availability">${esc(availabilityPresentation(p).label)} · ${esc(availabilityPresentation(p).explanation)}</p>
      <label>Flat row-major offset<input id="shared-offset" type="number" min="0" max="${Math.max(0,(p.availability==='available'?p.shape.reduce((product,value)=>product*value,1):1)-1)}" value="${this.#offset}"></label><pre data-testid="shared-values">${p.availability==='available'?esc(JSON.stringify(this.#store.slice(run.id,p.id,this.#offset,Math.min(16,p.shape.reduce((product,value)=>product*value,1)-this.#offset)))):`Numerical values unavailable: ${esc(p.availability)}; no value substituted`}</pre>
      <p>Invocation ${esc(p.invocation)} · phase ${esc(p.phase)} · request epoch ${run.request.epoch}</p><p>Parameter/module owners: ${esc(p.owners.join(', ')||'Not declared in this capture')}</p><section><p>Captured dependencies: ${dependencyWindow?windowSummary(dependencyWindow):'showing 0 of 0 retained'}</p><button id="shared-dependency-prev" ${dependencyWindow?.hasPrevious?'':'disabled'}>Previous dependencies</button><button id="shared-dependency-next" ${dependencyWindow?.hasNext?'':'disabled'}>Next dependencies</button>${dependencyWindow?.items.map(d=>`<button data-dependency="${esc(d)}">${esc(d)}</button>`).join(' ')||'No captured dependency edge; see coverage above'}</section>
      ${this.distribution(p)}${this.source(p)}<button id="shared-detail">Request uncaptured scalar detail</button><p>${run.limits.map(esc).join('<br>')}</p>
      <details><summary>Exact run and execution identities</summary><pre>${esc(JSON.stringify({...run,points:undefined},null,2))}</pre></details><details><summary>${this.#store.hasEnvelope(run.id)?'Original recording and supported state':'Bounded retained codec metadata · original large envelope not retained'}</summary><pre>${esc(JSON.stringify(this.#store.metadataEnvelope(run.id),(_k,v)=>_k==='points'?undefined:v,2))}</pre></details></article></div>`:'<p>Choose a retained run or explicitly request an execution. Opening saved evidence never starts Python or downloads weights.</p>'}</section></div>`;
    const on=(id:string,fn:()=>void)=>this.#root.querySelector<HTMLElement>(id)?.addEventListener('click',fn);
    on('#close-shared',()=>{this.#open=false;this.render();});
    this.#root.querySelector<HTMLSelectElement>('#shared-model')!.onchange=e=>{
      if(!this.#canSwitch){this.#message='Resolve the active canonical operation before changing producers.';this.render();return;}
      this.#operation++;this.#executors.cancel();this.#busy=false;this.#selected=(e.target as HTMLSelectElement).value;this.#player=undefined;this.#offset=0;this.#replay=false;
      const binding=this.#executors.get(this.#selected);this.#input=binding.defaultInput??'';this.#action=binding.actions?.[0]??'predict';
      this.#message='Producer changed. Evidence selection cleared explicitly; canonical state and its world selection are retained.';this.render();};
    const action=this.#root.querySelector<HTMLSelectElement>('#shared-action');if(action)action.onchange=()=>this.#action=action.value;
    for(const [id,set] of [['#native-prompt',(v:string)=>this.#input=v],['#native-endpoint',(v:string)=>this.#endpoint=v]] as const){const el=this.#root.querySelector<HTMLInputElement>(id);if(el)el.oninput=()=>set(el.value);}
    this.#root.querySelector<HTMLSelectElement>('#shared-run')!.onchange=e=>{const id=(e.target as HTMLSelectElement).value;if(id){this.#operation++;this.#executors.cancel();this.#busy=false;this.select(id);this.#message='Selected immutable evidence; no executor invoked.';this.render();}};
    on('#shared-run-prev',()=>{this.#runOffset=previousWindowOffset(this.#runOffset,PRESENTATION_WORK.sharedRuns);this.render();});
    on('#shared-run-next',()=>{this.#runOffset=nextWindowOffset(this.#runOffset,PRESENTATION_WORK.sharedRuns,list.length);this.render();});
    on('#shared-run-open',()=>{const id=this.#root.querySelector<HTMLInputElement>('#shared-run-id')?.value??'';if(list.some(item=>item.id===id)){this.select(id);this.#message='Selected exact immutable run ID; no executor invoked.';}else this.#message='No retained run has that exact ID.';this.render();});
    on('#shared-point-prev',()=>{this.#pointOffset=previousWindowOffset(this.#pointOffset,PRESENTATION_WORK.sharedPoints);this.render();});
    on('#shared-point-next',()=>{this.#pointOffset=nextWindowOffset(this.#pointOffset,PRESENTATION_WORK.sharedPoints,run?.points.length??0);this.render();});
    on('#shared-execute',()=>void this.execute());on('#shared-cancel',()=>{this.#operation++;this.#executors.cancel();this.#pendingRetention?.cancel();this.#pendingRetention=undefined;this.#busy=false;this.#message='Cancelled admission; canonical state unchanged.';this.render();});
    on('#shared-world',()=>{if(!run||!this.#onWorld)return;if(!this.#canSwitch){this.#message='Finish or cancel the active canonical operation before opening another world.';this.render();return;}const unavailable=this.#worldAvailability?.(run.id);if(unavailable){this.#message=unavailable;this.render();return;}this.#open=false;this.#onWorld(run.id,this.#replay);this.render();});
    this.#root.querySelectorAll<HTMLElement>('[data-point]').forEach(el=>el.onclick=()=>{player!.seek(Number(el.dataset.point));this.#pointOffset=Math.floor(player!.index/PRESENTATION_WORK.sharedPoints)*PRESENTATION_WORK.sharedPoints;this.#offset=0;this.#dependencyOffset=0;this.render();});
    this.#root.querySelectorAll<HTMLElement>('[data-dependency]').forEach(el=>el.onclick=()=>{player!.seek(player!.run.points.findIndex(p=>p.id===el.dataset.dependency));this.#pointOffset=Math.floor(player!.index/PRESENTATION_WORK.sharedPoints)*PRESENTATION_WORK.sharedPoints;this.#offset=0;this.#dependencyOffset=0;this.render();});
    on('#shared-next',()=>{player!.step();this.#pointOffset=Math.floor(player!.index/PRESENTATION_WORK.sharedPoints)*PRESENTATION_WORK.sharedPoints;this.#offset=0;this.#dependencyOffset=0;this.render();});
    on('#shared-dependency-prev',()=>{this.#dependencyOffset=previousWindowOffset(this.#dependencyOffset,PRESENTATION_WORK.relationships);this.render();});
    on('#shared-dependency-next',()=>{this.#dependencyOffset=nextWindowOffset(this.#dependencyOffset,PRESENTATION_WORK.relationships,p?.dependencies.length??0);this.render();});
    const offset=this.#root.querySelector<HTMLInputElement>('#shared-offset');if(offset)offset.onchange=()=>{const n=Number(offset.value),length=p?.availability==='available'?p.shape.reduce((product,value)=>product*value,1):0;if(Number.isSafeInteger(n)&&n>=0&&n<length)this.#offset=n;this.render();};
    on('#shared-detail',()=>{this.#message=this.#store!.capability(run!.id,'uncaptured.scalar','scalar',!this.#replay&&this.#executors.get(run!.integration).connected());this.render();});
    on('#shared-save',()=>{try{localStorage.setItem(SAVED,serializeEvidence(this.#store!.envelope(run!.id)));this.#message='Saved selected run locally. Replay needs no executor.';}catch(e){this.#message=`Save failed: ${e}`;}this.render();});
    on('#shared-load',()=>void this.load(localStorage.getItem(SAVED)));
    on('#shared-export',()=>{const blob=new Blob([serializeEvidence(this.#store!.envelope(run!.id))],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='model-lab-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    this.#root.querySelector<HTMLInputElement>('#shared-import')!.onchange=async e=>{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;if(file.size>MAX_RECORD_BYTES){this.#message='Import exceeds byte budget';this.render();return;}await this.load(await file.text());};
    } finally {
      this.#rendering=false;
      const target=focusId?this.#root.querySelector<HTMLElement>(`#${CSS.escape(focusId)}`):focusPoint?this.#root.querySelector<HTMLElement>(`[data-point="${focusPoint}"]`):null;
      target?.focus({preventScroll:true});
    }
  }
  private async execute(){
    const operation=++this.#operation;
    this.#busy=true;this.#message='Checking durable retention capacity…';this.render();
    try{
      const binding=this.#executors.get(this.#selected);check(!binding.endpoint||!nativeOriginUnavailable(),'Optional native execution requires an exact HTTP loopback application origin');
      const transaction=binding.inputLocation==='world'?undefined:await this.#retention?.begin('nativeEvidence');
      if(operation!==this.#operation){transaction?.cancel();return;}
      this.#pendingRetention=transaction;this.#message='Executing selected producer…';this.render();
      const run=await binding.execute({action:this.#action,input:this.#input,endpoint:this.#endpoint,store:transaction?.store??this.#store!,canonical:this.#canonical});
      if(operation!==this.#operation){transaction?.cancel();return;}
      if(transaction){await transaction.commit();if(operation!==this.#operation)return;this.#store=transaction.store;this.#pendingRetention=undefined;}
      this.select(run.id);
      this.#message='Execution receipt validated and admitted; inspection reads retained evidence.';
    }catch(e){this.#pendingRetention?.cancel();this.#pendingRetention=undefined;if(operation!==this.#operation)return;this.#message=`Execution refused or failed: ${e instanceof Error?e.message:String(e)}`;}
    finally{if(operation===this.#operation){this.#busy=false;this.render();}}
  }
  private async load(json:string|null){
    const operation=++this.#operation;this.#executors.cancel();this.#pendingRetention?.cancel();this.#pendingRetention=undefined;
    try{check(json,'No saved recording');check(new TextEncoder().encode(json).length<=MAX_RECORD_BYTES,'Import byte budget');const transaction=await this.#retention?.begin('standaloneImport');if(operation!==this.#operation){transaction?.cancel();return;}this.#pendingRetention=transaction;const store=transaction?.store??this.#store!;const run=await store.admit(parseEvidence(json),undefined,()=>operation===this.#operation);if(operation!==this.#operation){transaction?.cancel();return;}if(transaction){await transaction.commit();this.#store=transaction.store;this.#pendingRetention=undefined;}this.select(run.id,true);this.#message='Saved replay loaded. Native executor disconnected; no execution requested.';}
    catch(e){this.#pendingRetention?.cancel();this.#pendingRetention=undefined;if(operation===this.#operation)this.#message=`Recording refused: ${e instanceof Error?e.message:String(e)}`;}
    this.render();
  }
}
