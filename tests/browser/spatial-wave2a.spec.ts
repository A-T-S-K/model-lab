import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const directory=process.env.WAVE2_EVIDENCE_DIR??'test-results/wave2a-review';
async function audit(page:Page) {
 await page.addInitScript(()=>{
  const w=window as any;w.eAudit={commands:[],responses:[],outstanding:0,maxOutstanding:0};
  const send=Worker.prototype.postMessage,seen=new WeakSet();
  Worker.prototype.postMessage=function(message:any,...rest:any[]){
   w.eAudit.commands.push({...message,time:performance.now()});
   if(message.command==='advanceForward'){w.eAudit.outstanding++;w.eAudit.maxOutstanding=Math.max(w.eAudit.maxOutstanding,w.eAudit.outstanding);}
   if(!seen.has(this)){seen.add(this);this.addEventListener('message',e=>{w.eAudit.responses.push(e.data);if(e.data.status==='forward'&&e.data.progress.sequence>0||e.data.status==='result'&&w.eAudit.outstanding)w.eAudit.outstanding--;});}
   return Reflect.apply(send,this,[message,...rest]);
  };
 });
}
async function next(page:Page,n:number) {
 for(let i=0;i<n;i++){const prior=Number(await page.locator('#execution-controls').getAttribute('data-sequence'));await page.getByRole('button',{name:'Next operator',exact:true}).click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence',String(prior+1));}
}
test('E01–E08 real HTTP paused frontier, produced scalar, ReLU marks, explore/resume and completed explanation',async({page})=>{
 test.setTimeout(90000);await mkdir(directory,{recursive:true});await audit(page);const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
 await page.setViewportSize({width:1920,height:1080});await page.goto('/?presentation=spatial');await expect(page.locator('#step-prediction')).toBeEnabled();
 await page.locator('#document').fill('abca');await page.locator('#step-prediction').click();
 await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence','0');
 expect(await page.locator('[data-world-value]').count()).toBe(0);
 await expect(page.locator('#predict')).toBeDisabled();await expect(page.locator('#spatial-learn')).toBeDisabled();
 await page.screenshot({path:`${directory}/pending-1920x1080.png`});
 await next(page,6);await expect(page.getByTestId('execution-frontier')).toContainText('Last: q · p0');
 expect(await page.locator('[data-world-kind="k"] [data-world-value]').count()).toBe(0);
 expect(await page.locator('[data-world-kind="q"] [data-world-value]').count()).toBe(8);
 await page.waitForTimeout(1000);await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence','6');
 await page.getByRole('button',{name:'Inspect selected scalar',exact:true}).click();await expect(page.locator('#microscope')).toContainText('OBSERVED');
 await page.locator('#spatial-head').selectOption('1');
 await expect(page.getByTestId('component-guide')).toHaveAttribute('data-head','1');
 await expect(page.getByTestId('component-guide')).toHaveAttribute('data-component','4');
 await page.locator('#spatial-head').selectOption('0');
 await page.screenshot({path:`${directory}/q-paused-1920x1080.png`});
 await page.locator('#spatial-key').selectOption('1');await page.locator('#spatial-operation').selectOption('attentionLogits');
 await expect(page.getByTestId('pending-output')).toContainText('NOT APPLICABLE');
 await page.locator('#spatial-key').selectOption('0');await page.locator('#spatial-operation').selectOption('mlpRelu');
 await expect(page.getByTestId('pending-output')).toContainText('Not yet computed');
 await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence','6');
 await page.locator('#execution-follow').check();await next(page,14);
 await expect(page.getByTestId('execution-frontier')).toContainText('Last: mlpRelu · p0');
 await page.locator('[data-forward-element="7"]').click();
 await expect(page.getByTestId('relu-calculation')).toContainText('ReLU[7]');await expect(page.getByTestId('component-guide')).toHaveAttribute('data-component','7');
 await page.screenshot({path:`${directory}/relu-1920x1080.png`});
 await page.setViewportSize({width:1280,height:720});await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#spatial-focus').click();
 await page.screenshot({path:`${directory}/relu-1280x720.png`});
 await page.locator('#execution-next').focus();await page.keyboard.press('Enter');await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence','21');
 await page.locator('#execution-continue').click();await expect(page.locator('#execution-controls')).not.toHaveAttribute('data-sequence','21');
 await page.locator('#spatial-world').focus();await page.keyboard.press('ArrowRight');
 await expect(page.getByTestId('execution-frontier')).toContainText('paused');
 const frontier=await page.locator('#execution-controls').getAttribute('data-sequence');await page.waitForTimeout(800);await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence',frontier!);
 await page.screenshot({path:`${directory}/explore-paused-1280x720.png`});
 await page.locator('#execution-continue').click();await expect(page.locator('#step-prediction')).toBeEnabled({timeout:45000});
 await expect(page.getByTestId('status')).toContainText('Live prediction complete');
 await page.locator('#explanation-restart').click();await page.locator('#waypoint-next').click();await expect(page.getByTestId('explanation-status')).toContainText('2/21');
 const evidence=await page.evaluate(()=>(window as any).eAudit);
 expect(evidence.commands.filter((c:any)=>c.command==='predict').length).toBe(1); // startup only
 expect(evidence.commands.filter((c:any)=>c.command==='startForward').length).toBe(1);
 expect(evidence.commands.filter((c:any)=>c.command==='advanceForward').length).toBe(120);
 expect(evidence.maxOutstanding).toBe(1);
 const start=evidence.responses.find((r:any)=>r.status==='forward'&&r.progress.sequence===0);
 const completed=evidence.responses.filter((r:any)=>r.status==='result').at(-1);
 expect(completed.result.run.manifest.runId).toBe(start.progress.executionId);
 expect(completed.result.snapshots[0].state).toEqual(start.progress.start.snapshot.state);
 expect(errors).toEqual([]);await writeFile(`${directory}/http-audit.json`,JSON.stringify(evidence,null,2));
});

test('E07 HTTP input/switch/clear cancellation, paused history recovery and hidden tab',async({page})=>{
 test.setTimeout(45000);await audit(page);await page.goto('/?presentation=spatial');await expect(page.locator('#step-prediction')).toBeEnabled();
 for(const action of ['cancel','input','switch','hidden','clear']) {
  await page.locator('#step-prediction').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence','0');await next(page,3);
  if(action==='cancel'){await page.locator('#execution-continue').click();await page.locator('#execution-cancel').click();}
  if(action==='input'){await page.locator('#document').fill('abcb');}
  if(action==='switch'){await page.locator('#presentation-toggle').click();await expect(page.locator('.spatial-shell')).toHaveCount(0);await page.locator('#presentation-toggle').click();}
  if(action==='hidden'){
   await page.locator('#execution-continue').click();
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
   await expect(page.getByTestId('execution-frontier')).toContainText('paused');const seq=await page.locator('#execution-controls').getAttribute('data-sequence');
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
   await page.waitForTimeout(800);await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence',seq!);await page.locator('#execution-cancel').click();
  }
  if(action==='clear'){await page.locator('#clear-session').click();}
  await expect(page.locator('#step-prediction')).toBeEnabled();await expect(page.locator('#execution-controls')).toHaveCount(0);
 }
});

test('E07 bounded execution DOM/listener sample and worker failure while paused',async({page})=>{
 test.setTimeout(90000);await mkdir(directory,{recursive:true});
 await page.addInitScript(()=>{const w=window as any;w.liveWorkers=[];const Native=Worker;w.Worker=class extends Native{constructor(url:any,options:any){super(url,options);w.liveWorkers.push(this);}};});
 await page.goto('/?presentation=spatial');await expect(page.locator('#step-prediction')).toBeEnabled();await page.locator('#predict').click();await expect(page.locator('#step-prediction')).toBeEnabled();
 await page.locator('#document').fill('');const cdp=await page.context().newCDPSession(page);
 const sample=async()=>{await cdp.send('HeapProfiler.collectGarbage');return {dom:await cdp.send('Memory.getDOMCounters'),heap:await cdp.send('Runtime.getHeapUsage')};};
 const batch=async()=>{for(let cycle=0;cycle<6;cycle++){await page.locator('#step-prediction').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence','0');await next(page,6);if(cycle%3===0){await page.locator('#execution-continue').click();await expect(page.locator('#step-prediction')).toBeEnabled({timeout:15000});}else await page.locator('#execution-cancel').click();await expect(page.locator('#step-prediction')).toBeEnabled();}};
 await batch();const warm=await sample(),start=Date.now();await batch();const middle=await sample();await batch();const end=await sample();
 expect(end.dom.jsEventListeners).toBeLessThanOrEqual(middle.dom.jsEventListeners+10);expect(end.dom.nodes).toBeLessThanOrEqual(middle.dom.nodes+100);
 await writeFile(`${directory}/execution-resources.json`,JSON.stringify({browser:page.context().browser()?.version(),procedure:'6 warmup then 2 x 6 cycles; each starts and advances 6, every third finishes, others cancel; GC at common completed-view endpoints. History intentionally retains completed predictions.',elapsed12CyclesMs:Date.now()-start,warm,middle,end},null,2));
 await page.locator('#step-prediction').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence','0');await next(page,1);
 await page.evaluate(()=>{const worker=(window as any).liveWorkers[0];worker.terminate();worker.dispatchEvent(new ErrorEvent('error',{message:'test paused worker failure'}));});
 await expect(page.getByTestId('status')).toContainText('Worker failed');await expect(page.locator('#execution-controls')).toHaveCount(0);
 await page.locator('#clear-session').click();await expect(page.locator('#step-prediction')).toBeEnabled();
});
