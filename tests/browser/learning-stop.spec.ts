import {test,expect,type Page} from '../support/browser-evidence.js';
import {mkdir,writeFile} from 'node:fs/promises';
test.describe.configure({mode:'parallel'});
test.use({viewport:{width:1920,height:1080},video:{mode:'on',size:{width:1920,height:1080}}});
async function audit(page:Page){await page.addInitScript(()=>{
 const w=window as any;w.stopAudit={commands:[],progress:[],results:[],pending:0,max:0};
 const send=Worker.prototype.postMessage,terminate=Worker.prototype.terminate,seen=new WeakSet(),permits=new Map<string,{executionId:string;worker:Worker}>(),requests=new Map();
 const retire=(worker:Worker,executionId?:string)=>{for(const [id,p] of permits)if(p.worker===worker&&(!executionId||p.executionId===executionId)){permits.delete(id);w.stopAudit.pending--;}};
 Worker.prototype.terminate=function(){retire(this);return Reflect.apply(terminate,this,[]);};
 Worker.prototype.postMessage=function(m:any,...rest:any[]){const a=w.stopAudit;a.commands.push(m);requests.set(m.runId,m);
 if(m.command==='advanceTraining'){permits.set(m.runId,{executionId:m.executionId,worker:this});a.pending++;a.max=Math.max(a.max,a.pending);}
 if(!seen.has(this)){seen.add(this);this.addEventListener('message',e=>{const r=e.data;if(permits.delete(r.runId))a.pending--;if(r.status==='cancelled')retire(this,requests.get(r.runId)?.executionId);if(r.status==='forward')a.progress.push(r.progress);if(r.status==='result')a.results.push(r.result);});}
 return Reflect.apply(send,this,[m,...rest]);};
});}
async function stopped(page:Page){await expect(page.locator('#execution-next')).toBeEnabled({timeout:60000});}
async function capture(page:Page,name:string,dir:string){for(const [width,height] of [[1920,1080],[1280,720]]){await page.setViewportSize({width,height});await page.waitForTimeout(500);await page.screenshot({path:`${dir}/${name}-${width}.png`});}await page.setViewportSize({width:1920,height:1080});}
async function state(page:Page){return page.evaluate(()=>(window as any).stopAudit.progress.at(-1));}
test('S01/S02/S05 untimed initial request → actual partial → next → Ready → Accept; separate discard',async({page,evidenceDir:dir})=>{
 test.setTimeout(180000);await mkdir(dir,{recursive:true});await audit(page);await page.goto('/?presentation=spatial');
 await page.locator('#step-learning').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase','baseline forward');
 await expect(page.locator('#execution-pin')).toHaveText('Run to next gradient contribution');await expect(page.locator('#execution-controls')).toContainText('wte[0,0]');
 const initial=await state(page);await capture(page,'initial',dir);await page.waitForTimeout(2000);
 await page.locator('#execution-pin').click();await stopped(page);
 const partial=await state(page),t=partial.training,e=t.contributions.at(-1);
 expect(t.phase).toBe('backward');expect(t.stopped).toBe(true);expect(t.final).toBe(false);expect(t.proposal).toBeUndefined();expect(t.pin).toBe(0);expect(e.child).toBeDefined();expect(e.after).toBe(e.before+e.contribution);expect(t.gradient).toBe(e.after);expect(partial.executionId).toBe(initial.executionId);expect(t.startingSnapshotId).toBe(initial.start.snapshot.id);
 await expect(page.getByTestId('pin-owner')).toBeVisible();await expect(page.getByTestId('live-contribution')).toBeVisible();await expect(page.getByTestId('live-gradient')).toHaveAttribute('data-value',String(t.gradient));
 await capture(page,'partial',dir);await page.waitForTimeout(3000);expect((await state(page)).sequence).toBe(partial.sequence);
 await page.locator('#execution-pin').click();await stopped(page);const next=await state(page);expect(next.training.final||next.training.contributions.at(-1).ordinal>e.ordinal).toBe(true);await capture(page,'next',dir);await page.waitForTimeout(2000);
 await page.locator('#execution-continue').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase','ready',{timeout:60000});await capture(page,'ready',dir);await page.waitForTimeout(2000);
 const ready=await state(page);expect(ready.training.readyOutputs.starting).toEqual(initial.start.snapshot);
 const beforeAccept=await page.evaluate(()=>(window as any).stopAudit);expect(beforeAccept.commands.filter((c:any)=>c.command==='acceptTraining')).toHaveLength(0);expect(beforeAccept.commands.filter((c:any)=>c.command==='startTraining')).toHaveLength(1);expect(beforeAccept.commands.filter((c:any)=>c.command==='train')).toHaveLength(0);expect(beforeAccept.max).toBe(1);
 await page.locator('#execution-accept').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
 await page.locator('#step-learning').click();await page.locator('#execution-pin').click();await stopped(page);await page.locator('#execution-cancel').click();await expect(page.locator('#execution-controls')).toHaveCount(0);await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
 await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
 const a=await page.evaluate(()=>(window as any).stopAudit);const accepted=a.results.find((r:any)=>r.learn);expect(a.results.at(-1).snapshots[0]).toEqual(accepted.snapshots.at(-1));
 await writeFile(`${dir}/route.json`,JSON.stringify({actionsToPartial:2,actionsAfterPausedStart:1,phaseTimedPause:false,initial,partial,next,readySequence:ready.sequence,maxInFlight:a.max,commands:a.commands,acceptedSnapshot:accepted.snapshots.at(-1)},null,2));
});
test('S03 no matching embedding row stops before proposals and explains unavailable future',async({page,evidenceDir:dir})=>{
 test.setTimeout(90000);await audit(page);await page.goto('/?presentation=spatial');
 await page.locator('#document').fill('a');await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
 await page.locator('[data-world-parameter="wte"]').click();await page.locator('#parameter-row').selectOption('1');
 await page.locator('#step-learning').click();await page.locator('#execution-pin').click();await stopped(page);
 const p=await state(page);expect(p.training.phase).toBe('optimizer proposal');expect(p.training.count).toBe(0);expect(p.training.gradient).toBe(0);expect(p.training.contributions).toEqual([]);expect(p.training.proposal).toBeUndefined();
 await expect(page.getByTestId('execution-frontier')).toContainText('no remaining contributions');await expect(page.getByTestId('gradient-stop-unavailable')).toBeVisible();await page.waitForTimeout(1500);expect((await state(page)).sequence).toBe(p.sequence);
 await page.locator('#execution-cancel').click();
});
for(const document of ['a','abcabca'])test('S02 HTTP two accepted updates equal ordinary Learn, including non-embedding prior moments: '+document,async({page,browser,baseURL,evidenceDir:dir})=>{
 test.setTimeout(180000);await audit(page);await page.goto('/?presentation=spatial');await page.locator('#document').fill(document);
 const fast=await browser.newPage();await audit(fast);await fast.goto(baseURL+'/?presentation=spatial');await fast.locator('#document').fill(document);
 for(let pass=0;pass<2;pass++){
  await fast.locator('#predict').click();await expect(fast.getByTestId('status')).toContainText('Live prediction complete');await fast.locator('#spatial-learn').click();await expect(fast.getByTestId('spatial-live-step')).toHaveText(String(pass+1));
  if(pass===1){await page.locator('#spatial-home').click();await page.locator('[data-world-parameter="layer0.attn_wq"]').click();}
  await page.locator('#step-learning').click();await stopped(page);const start=await state(page);await page.locator('#execution-pin').click();await stopped(page);const partial=await state(page);expect(partial.training.contributions.length).toBeGreaterThan(0);expect(partial.training.final).toBe(false);if(pass===0)expect(partial.training.old.m).toBe(0);if(pass===1)expect(partial.training.old.m).not.toBe(0);
  expect(partial.executionId).toBe(start.executionId);await page.locator('#execution-continue').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase','ready',{timeout:60000});await page.locator('#execution-accept').click();await expect(page.getByTestId('spatial-live-step')).toHaveText(String(pass+1));
  const actual=await page.evaluate(()=>(window as any).stopAudit.results.filter((r:any)=>r.learn).at(-1)),reference=await fast.evaluate(()=>(window as any).stopAudit.results.filter((r:any)=>r.learn).at(-1));expect(actual.learn).toEqual(reference.learn);expect(actual.snapshots).toEqual(reference.snapshots);
 }
 await fast.close();
});
test('S04 HTTP delayed acknowledgements: untimed Pause, exploration, pin replacement, input and presentation cancellation',async({page,evidenceDir:dir})=>{
 test.setTimeout(120000);
 // Delay actual inbound transport events for both onmessage and audit listeners.
 await page.addInitScript(()=>{
  const NativeWorker=Worker;
  window.Worker=class extends NativeWorker {
   constructor(url:string|URL,options?:WorkerOptions){super(url,options);const forwarded=new WeakSet<Event>();
    this.addEventListener('message',e=>{if(e.data.status!=='forward'||forwarded.has(e))return;e.stopImmediatePropagation();
     const reply=new MessageEvent('message',{data:e.data});forwarded.add(reply);
     setTimeout(()=>this.dispatchEvent(reply),e.data.progress.sequence===1?400:5+(String(e.data.runId).length%3)*5);
    },true);
   }
  };
 });
 await audit(page);await page.goto('/?presentation=spatial');
 for(const action of ['pause','explore','pin','hidden','input','presentation','cancel','clear']){
  console.log('S04 control:',action);
  await page.locator('#step-learning').click();await page.locator('#execution-pin').click();
  if(action==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  if(action==='clear')await page.locator('#clear-session').click();
  if(action==='pause')await page.locator('#execution-pause').evaluate((button:HTMLButtonElement)=>button.click());
  if(action==='explore')await page.locator('#spatial-operation').selectOption('q');
  if(action==='pin'){await page.locator('#spatial-home').evaluate((button:HTMLButtonElement)=>button.click());await stopped(page);await page.locator('#spatial-home').click();await page.locator('[data-world-parameter="layer0.attn_wq"]').click();}
  if(action==='input')await page.locator('#document').fill('a');
  if(action==='presentation'){await page.locator('#presentation-toggle').click();await page.locator('#presentation-toggle').click();}
  if(action==='cancel')await page.locator('#execution-cancel').click();
  if(['pause','explore','pin','hidden'].includes(action)){
   await stopped(page);const p=await state(page);await page.waitForTimeout(400);expect((await state(page)).sequence).toBe(p.sequence);
   if(action==='hidden'){await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(400);expect((await state(page)).sequence).toBe(p.sequence);}
   if(action==='pin'){await page.locator('#execution-pin').click();await stopped(page);expect((await state(page)).training.pin).not.toBe(0);}
   await page.locator('#execution-cancel').click();
  }
  await expect(page.locator('#execution-controls')).toHaveCount(0);
 }
 const evidence=await page.evaluate(()=>(window as any).stopAudit);expect(evidence.max).toBe(1);
 await mkdir(dir,{recursive:true});await writeFile(`${dir}/cancellation.json`,JSON.stringify({method:'Actual Worker events delayed; cancellation acknowledgements and termination retire old permits, whose late replies cannot resume the driver.',...evidence},null,2));
});
