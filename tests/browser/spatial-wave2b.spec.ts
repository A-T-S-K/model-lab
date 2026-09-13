import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const directory=process.env.WAVE2B_EVIDENCE_DIR??'test-results/wave2b-review';
async function audit(page:Page) {
 await page.addInitScript(()=>{
  const w=window as any;w.trainingAudit={commands:[],responses:[],outstanding:0,max:0,durations:[]};
  const send=Worker.prototype.postMessage,seen=new WeakSet(),starts=new Map();
  Worker.prototype.postMessage=function(m:any,...rest:any[]){
   w.trainingAudit.commands.push({...m,time:performance.now()});
   if(['advanceTraining','acceptTraining'].includes(m.command)){starts.set(m.runId,performance.now());w.trainingAudit.outstanding++;w.trainingAudit.max=Math.max(w.trainingAudit.max,w.trainingAudit.outstanding);}
   if(!seen.has(this)){seen.add(this);this.addEventListener('message',e=>{w.trainingAudit.responses.push(e.data);if(starts.has(e.data.runId)){w.trainingAudit.durations.push(performance.now()-starts.get(e.data.runId));starts.delete(e.data.runId);w.trainingAudit.outstanding--;}});}
   return Reflect.apply(send,this,[m,...rest]);
  };
 });
}
async function phase(page:Page,value:string){await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase',value,{timeout:60000});}
async function step(page:Page){const n=Number(await page.locator('#execution-controls').getAttribute('data-sequence'));await page.locator('#execution-next').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence',String(n+1));}
async function continueUntil(page:Page,target:string){
 // User boundary Pause, issued when the acknowledged phase first appears.
 await page.evaluate((target)=>{
  const observer=new MutationObserver(()=>{const e=document.querySelector('#execution-controls');if(e?.getAttribute('data-training-phase')===target){(document.querySelector('#execution-pause') as HTMLButtonElement)?.click();observer.disconnect();}});
  observer.observe(document.querySelector('#app')!,{childList:true,subtree:true});
 },target);
 await page.locator('#execution-continue').click();await phase(page,target);await expect(page.locator('#execution-next')).toBeEnabled();
}
test('T09 real partial gradient → proposal → candidate → acceptance and second discard',async({browser,baseURL})=>{
 test.setTimeout(180000);await mkdir(directory,{recursive:true});
 const context=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:directory,size:{width:1920,height:1080}},reducedMotion:'reduce'});
 const page=await context.newPage();await audit(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(baseURL+'/?presentation=spatial');await expect(page.locator('#step-learning')).toBeEnabled();
 await page.locator('#step-learning').click();await phase(page,'baseline forward');
 await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence','0');
 await page.screenshot({path:`${directory}/start-1920.png`});
 await continueUntil(page,'backward');
 await page.locator('#execution-pin').click();await expect(page.getByTestId('live-contribution')).toBeVisible({timeout:30000});await expect(page.locator('#execution-next')).toBeEnabled();
 const first=await page.getByTestId('live-gradient').getAttribute('data-value');
 await page.screenshot({path:`${directory}/partial-1920.png`});await page.waitForTimeout(2500);
 await page.locator('[data-live-child]').click();await expect(page.locator('#microscope')).toContainText('OBSERVED');await step(page);await expect(page.locator('#microscope')).not.toContainText('OBSERVED');await page.locator('#execution-follow').check();
 await page.locator('#execution-pin').click();await expect(page.locator('#execution-next')).toBeEnabled();
 await expect(page.getByTestId('live-gradient')).not.toHaveAttribute('data-value',first!);
 await page.setViewportSize({width:1280,height:720});await page.screenshot({path:`${directory}/partial-1280.png`});await page.waitForTimeout(2000);
 await page.setViewportSize({width:1920,height:1080});await continueUntil(page,'optimizer proposal');
 await page.screenshot({path:`${directory}/final-gradient-1920.png`});
 await page.locator('#execution-pin').click();await expect(page.getByTestId('live-proposal')).toBeVisible();await expect(page.locator('#execution-next')).toBeEnabled();
 await page.screenshot({path:`${directory}/proposal-1920.png`});await page.waitForTimeout(2500);
 await page.setViewportSize({width:1280,height:720});await page.screenshot({path:`${directory}/proposal-1280.png`});await page.setViewportSize({width:1920,height:1080});
 await continueUntil(page,'candidate forward');await step(page);
 await page.screenshot({path:`${directory}/candidate-pending-1920.png`});await page.waitForTimeout(2000);
 await page.locator('#execution-continue').click();await phase(page,'ready');
 await expect(page.getByTestId('status')).toContainText('Candidate ready — not accepted');
 await page.screenshot({path:`${directory}/ready-1920.png`});
 await page.locator('[data-live-child]').click();await expect(page.locator('#microscope')).toContainText('OBSERVED');
 let evidence=await page.evaluate(()=>(window as any).trainingAudit);
 expect(evidence.commands.filter((c:any)=>c.command==='train').length).toBe(0);
 expect(evidence.responses.filter((r:any)=>r.status==='result').length).toBe(1);
 await page.locator('#execution-accept').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
 await page.screenshot({path:`${directory}/accepted-1920.png`});await page.waitForTimeout(2500);
 await page.locator('#step-learning').click();await page.locator('#execution-continue').click();await phase(page,'ready');
 await page.screenshot({path:`${directory}/discard-ready-1920.png`});await page.locator('#execution-cancel').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
 await page.screenshot({path:`${directory}/discarded-1920.png`});
 evidence=await page.evaluate(()=>(window as any).trainingAudit);expect(evidence.max).toBe(1);expect(errors).toEqual([]);
 expect(evidence.commands.filter((c:any)=>c.command==='acceptTraining').length).toBe(1);
 expect(evidence.commands.filter((c:any)=>c.command==='predict').length).toBe(1);
 await writeFile(`${directory}/http-audit.json`,JSON.stringify(evidence,null,2));
 const video=page.video()!;await context.close();await video.saveAs(`${directory}/wave-2b-route.webm`);
});

test('T07/T08/T09 negative ReLU, navigation suspension, hidden tab and historical update after second acceptance',async({page})=>{
 test.setTimeout(180000);await mkdir(directory,{recursive:true});await audit(page);await page.goto('/?presentation=spatial');await expect(page.locator('#step-learning')).toBeEnabled();
 await page.locator('#document').fill('');await page.locator('#step-learning').click();
 // Baseline also uses the real forward generator. Stop at its negative ReLU example.
 for(let i=0;i<20;i++)await step(page);
 await page.locator('#spatial-operation').selectOption('mlpRelu');
 const negative=await page.evaluate(()=>{const a=(window as any).trainingAudit.responses.flatMap((r:any)=>r.progress?.artifacts??[]).find((a:any)=>a.kind==='mlpUp');return a.values.findIndex((v:number)=>v<0);});
 expect(negative).toBeGreaterThanOrEqual(0);await page.locator(`[data-forward-element="${negative}"]`).click();
 await expect(page.getByTestId('relu-calculation')).toContainText('0');
 await page.screenshot({path:`${directory}/negative-relu-1920.png`});
 await page.setViewportSize({width:1280,height:720});await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#spatial-focus').click();await page.screenshot({path:`${directory}/negative-relu-1280.png`});
 const seq=await page.locator('#execution-controls').getAttribute('data-sequence');await page.locator('#spatial-home').click();await page.locator('#spatial-back').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence',seq!);
 await page.locator('#execution-next').focus();await page.keyboard.press('Enter');await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence',String(Number(seq)+1));
 await page.locator('#execution-continue').click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(page.locator('#execution-next')).toBeEnabled();const paused=await page.locator('#execution-controls').getAttribute('data-sequence');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(400);await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence',paused!);
 await page.locator('#execution-continue').click();await phase(page,'ready');await page.locator('#execution-accept').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
 await page.locator('#step-learning').click();await page.locator('#execution-continue').click();await phase(page,'ready');await page.locator('#execution-accept').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('2');
 const first=await page.locator('#spatial-experiment option').nth(1).getAttribute('value');await page.locator('#spatial-experiment').selectOption(first!);
 await page.locator('[data-learning-stage="adam"]').first().click();await expect(page.getByTestId('adam-m-before')).toHaveAttribute('data-value','0');await expect(page.getByTestId('spatial-live-step')).toHaveText('2');
 await page.screenshot({path:`${directory}/historical-first-after-second-1280.png`});
 const evidence=await page.evaluate(()=>(window as any).trainingAudit);expect(evidence.commands.filter((c:any)=>c.command==='acceptTraining').length).toBe(2);expect(evidence.commands.filter((c:any)=>c.command==='train').length).toBe(0);
 await writeFile(`${directory}/historical-audit.json`,JSON.stringify(evidence,null,2));
});

test('T06 controlled acceptance retains receipt after archive failure; cancel and worker restart preserve accepted state',async({page})=>{
 test.setTimeout(90000);await audit(page);
 await page.addInitScript(()=>{const w=window as any;w.modelWorkers=[];const Native=Worker;w.Worker=class extends Native{constructor(url:any,options:any){super(url,options);w.modelWorkers.push(this);}};let fail=false;const send=Worker.prototype.postMessage,digest=crypto.subtle.digest.bind(crypto.subtle);Worker.prototype.postMessage=function(m:any,...rest:any[]){if(m.command==='acceptTraining')fail=true;return Reflect.apply(send,this,[m,...rest]);};crypto.subtle.digest=(...args:Parameters<SubtleCrypto['digest']>)=>{if(fail){fail=false;return Promise.reject(Error('controlled archive admission failure'));}return digest(...args);};});
 await page.goto('/?presentation=spatial');await expect(page.locator('#step-learning')).toBeEnabled();await page.locator('#document').fill('');
 await page.locator('#step-learning').click();await page.locator('#execution-continue').click();await phase(page,'ready');await page.locator('#execution-accept').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');await expect(page.getByTestId('status')).toContainText('Accepted');await expect(page.locator('#spatial-experiment option')).toHaveCount(2);
 for(const action of ['input','switch','cancel','failure']) {
  await page.locator('#step-learning').click();await phase(page,'baseline forward');await step(page);
  if(action==='input')await page.locator('#document').fill('a');
  if(action==='switch'){await page.locator('#presentation-toggle').click();await page.locator('#presentation-toggle').click();}
  if(action==='cancel')await page.locator('#execution-cancel').click();
  if(action==='failure')await page.evaluate(()=>{const worker=(window as any).modelWorkers[0];worker.terminate();worker.dispatchEvent(new ErrorEvent('error',{message:'controlled worker failure'}));});
  await expect(page.locator('#execution-controls')).toHaveCount(0);
  if(action!=='failure')await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
 }
 await expect(page.getByTestId('status')).toContainText('Worker failed');await page.locator('#clear-session').click();await expect(page.locator('#step-learning')).toBeEnabled();await expect(page.locator('#execution-controls')).toHaveCount(0);await expect(page.getByTestId('spatial-relationship')).toContainText('NO SELECTED RUN');const reset=await page.evaluate(()=>(window as any).trainingAudit.responses.filter((r:any)=>r.status==='ready').at(-1));expect(reset.snapshot.optimizer.step).toBe(0);
 const evidence=await page.evaluate(()=>(window as any).trainingAudit);expect(evidence.commands.filter((c:any)=>c.command==='acceptTraining')).toHaveLength(1);expect(evidence.commands.filter((c:any)=>c.command==='train')).toHaveLength(0);
});

test('T10 controlled start/cancel retains bounded DOM and listeners',async({page})=>{
 test.setTimeout(60000);await page.goto('/?presentation=spatial');await expect(page.locator('#step-learning')).toBeEnabled();
 const cdp=await page.context().newCDPSession(page);const samples:any[]=[];
 for(let batch=0;batch<3;batch++) {
  for(let cycle=0;cycle<4;cycle++){await page.locator('#step-learning').click();await phase(page,'baseline forward');await step(page);await page.locator('#execution-cancel').click();await expect(page.locator('#step-learning')).toBeEnabled();}
  await cdp.send('HeapProfiler.collectGarbage');samples.push({dom:await cdp.send('Memory.getDOMCounters'),heap:await cdp.send('Runtime.getHeapUsage')});
 }
 expect(samples[2].dom.jsEventListeners).toBeLessThanOrEqual(samples[1].dom.jsEventListeners+10);expect(samples[2].dom.nodes).toBeLessThanOrEqual(samples[1].dom.nodes+100);
 await mkdir(directory,{recursive:true});await writeFile(`${directory}/training-resources.json`,JSON.stringify({procedure:'3 batches of 4 start / one baseline operator / cancel; GC at completed-view boundary; first batch warmup',samples},null,2));
});
