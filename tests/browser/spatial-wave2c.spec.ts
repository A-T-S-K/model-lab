import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const directory=process.env.WAVE2C_EVIDENCE_DIR??'test-results/wave2c-review';
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

test('U01/U03/U06/U07 decision → selected head intervention → downstream → current',async({browser,baseURL})=>{
 test.setTimeout(180000);await mkdir(directory,{recursive:true});
 const context=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:directory,size:{width:1920,height:1080}},reducedMotion:'reduce'});
 const page=await context.newPage();await audit(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const pause=()=>page.waitForTimeout(process.env.WAVE2C_RECORD?2500:50);
 const capture=async(name:string)=>{await page.screenshot({path:`${directory}/${name}-1920.png`});await page.setViewportSize({width:1280,height:720});await page.screenshot({path:`${directory}/${name}-1280.png`});await page.setViewportSize({width:1920,height:1080});};
 await page.goto(baseURL+'/?presentation=spatial');await expect(page.locator('#step-learning')).toBeEnabled();
 await page.locator('#step-learning').click();await continueUntil(page,'backward');await page.locator('#execution-pin').click();
 await expect(page.getByTestId('live-contribution')).toBeVisible();await expect(page.getByTestId('pin-owner')).toContainText('Token embedding');await capture('owner');await pause();
 await continueUntil(page,'optimizer proposal');await page.locator('#execution-pin').click();await expect(page.getByTestId('live-proposal')).toBeVisible();await capture('proposal');await pause();
 await page.locator('#execution-continue').click();await phase(page,'ready');await expect(page.getByTestId('output-comparison')).toContainText('Current / Candidate');
 const seq=await page.locator('#execution-controls').getAttribute('data-sequence');
 const pair=await page.evaluate(()=>(window as any).trainingAudit.responses.filter((r:any)=>r.progress?.training?.readyOutputs).at(-1).progress.training.readyOutputs);
 const mean=(run:any)=>run.artifacts.filter((a:any)=>a.kind==='probabilities').reduce((s:number,a:any)=>s-Math.log(a.values[run.manifest.targets[a.concept.token]]),0)/run.manifest.input.length;
 expect(Number(await page.getByTestId('before-mean').getAttribute('data-value'))).toBe(mean(pair.before));expect(Number(await page.getByTestId('after-mean').getAttribute('data-value'))).toBe(mean(pair.after));
 await page.locator('#spatial-query').selectOption('4');await expect(page.getByTestId('output-comparison')).toContainText('target END');await capture('ready');await pause();
 const commands=await page.evaluate(()=>(window as any).trainingAudit.commands.length);
 for(const arm of ['before','after','pair']){await page.locator(`[data-compare-arm="${arm}"]`).click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence',seq!);}
 expect(await page.evaluate(()=>(window as any).trainingAudit.commands.length)).toBe(commands);
 await page.locator('#spatial-operation').selectOption('headOutput');await expect(page.locator('#spatial-ablate')).toBeDisabled();await pause();
 await page.locator('#execution-accept').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');await pause();
 await page.locator('#spatial-operation').selectOption('headOutput');await page.locator('#spatial-head').selectOption('1');await page.locator('#spatial-ablate').click();
 await expect(page.getByTestId('spatial-intervention')).toContainText('head 1');await expect(page.getByTestId('zeroed-head-arithmetic')).toBeVisible();await capture('head');await pause();
 const exp=await page.evaluate(()=>(window as any).trainingAudit.responses.find((r:any)=>r.status==='ablation'));
 await page.locator('#spatial-operation').selectOption('attentionProbabilities');await expect(page.getByTestId('paired-components')).toContainText('exactly equal');await capture('upstream');await pause();
 await page.locator('#spatial-operation').selectOption('attentionOutput');await expect(page.getByTestId('paired-components')).toContainText('exactly equal');await capture('concat');await pause();
 for(const kind of ['attentionProjection','attentionResidual','mlpUp','mlpRelu','mlpDown','mlpResidual','logits','probabilities']){await page.locator('#spatial-operation').selectOption(kind);await expect(page.getByTestId('paired-components')).toContainText(kind);if(['attentionProjection','mlpResidual','probabilities'].includes(kind)){await capture(kind);await pause();}}
 await page.locator('[data-artifact][data-element]').first().click();await expect(page.locator('#microscope')).toContainText('RECOMPUTED');await pause();
 await page.locator('[data-compare-arm="before"]').click();await expect(page.locator('#microscope')).not.toContainText('RECOMPUTED');await expect(page.getByTestId('spatial-intervention')).toContainText('Baseline');
 await page.locator('#spatial-current').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');await expect(page.getByTestId('spatial-intervention')).toHaveCount(0);await capture('returned');await pause();
 await page.locator('#step-learning').click();await page.locator('#execution-continue').click();await phase(page,'ready');await page.locator('#execution-cancel').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
 expect(errors).toEqual([]);const evidence=await page.evaluate(()=>(window as any).trainingAudit);
 expect(evidence.commands.filter((c:any)=>c.command==='acceptTraining')).toHaveLength(1);expect(evidence.commands.filter((c:any)=>c.command==='train')).toHaveLength(0);
 await writeFile(`${directory}/http-audit.json`,JSON.stringify(evidence,null,2));
 const video=page.video()!;await context.close();await video.saveAs(`${directory}/wave-2c-route.webm`);
});

test('U06/U07 cancelled, failed and replaced experiments preserve the full accepted snapshot and clear stale inspection',async({page})=>{
 test.setTimeout(90000);await audit(page);
 await page.addInitScript(()=>{const w=window as any;const send=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m:any,...rest:any[]){
  if(m.command==='ablate'&&w.ablationFault==='hold')return;
  if(m.command==='ablate'&&w.ablationFault==='fail'){setTimeout(()=>this.dispatchEvent(new MessageEvent('message',{data:{...m,status:'error',error:'injected disposable comparison failure'}})),50);return;}
  return Reflect.apply(send,this,[m,...rest]);
 };});
 await page.goto('/?presentation=spatial');await expect(page.locator('#predict')).toBeEnabled();await page.locator('#predict').click();await expect(page.locator('#spatial-learn')).toBeEnabled();await page.locator('#spatial-learn').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
 const accepted=await page.evaluate(()=>(window as any).trainingAudit.responses.filter((r:any)=>r.status==='result'&&r.result.learn).at(-1).result.snapshots.at(-1));
 for(const fault of ['hold','fail']){
  await page.locator('#spatial-operation').selectOption('headOutput');await page.evaluate(fault=>(window as any).ablationFault=fault,fault);await page.locator('#spatial-ablate').click();
  if(fault==='hold'){await expect(page.locator('#cancel-ablation')).toBeVisible();await page.locator('#cancel-ablation').click();await expect(page.getByTestId('status')).toContainText('cancelled');}
  else await expect(page.getByTestId('status')).toContainText('Ablation failed');
  await expect(page.getByTestId('spatial-live-step')).toHaveText('1');await expect(page.getByTestId('spatial-intervention')).toHaveCount(0);
 }
 await page.evaluate(()=>(window as any).ablationFault='');
 await page.locator('#spatial-ablate').click();await expect(page.getByTestId('spatial-intervention')).toBeVisible();
 await page.locator('#spatial-operation').selectOption('logits');await page.getByRole('button',{name:'Inspect selected scalar',exact:true}).click();await expect(page.locator('#microscope')).toContainText('RECOMPUTED');
 await page.locator('#spatial-operation').selectOption('headOutput');await page.locator('#spatial-head').selectOption('0');await page.locator('#spatial-ablate').click();await expect(page.getByTestId('spatial-intervention')).toContainText('head 0');await expect(page.locator('#microscope')).not.toContainText('RECOMPUTED');
 await page.locator('#spatial-current').click();await page.locator('#document').fill('bc');await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');await expect(page.getByTestId('spatial-intervention')).toHaveCount(0);await expect(page.getByTestId('paired-components')).toHaveCount(0);
 const after=await page.evaluate(()=>(window as any).trainingAudit.responses.filter((r:any)=>r.status==='result').at(-1).result.snapshots[0]);expect(after).toEqual(accepted);
});
