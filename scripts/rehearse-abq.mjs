#!/usr/bin/env node
// Built-HTTP rehearsal only: the page is driven through visible controls.
// Audit hooks observe bounded metadata; they never grant model permits.
import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const mode=process.argv[2]??'probe',base=process.env.ABQ_URL??'http://127.0.0.1:4173';
if(!['probe','cold','route','soak'].includes(mode))throw Error('mode: probe | cold | route | soak');
const root='test-results/abq-overnight',out=`${root}/${mode}`;
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile(`${root}/release/manifest.json`,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
async function verifyArtifact(){for(const [file,hash] of Object.entries(manifest.files))if(sha(await readFile(`${root}/release/${file}`))!==hash)throw Error(`Artifact changed: ${file}`);}
await verifyArtifact();
const browser=await chromium.launch({args:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost']});
const context=await browser.newContext({viewport:{width:1920,height:1080},serviceWorkers:'block',...(mode==='route'?{recordVideo:{dir:`${root}/final-media`,size:{width:1920,height:1080}}}:{})});
const blocked=[];await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'||u.hostname==='localhost')return route.continue();if(blocked.length<20)blocked.push(u.href);return route.abort('blockedbyclient');});
await context.addInitScript(()=>{
 const w=window;w.abqAudit={commands:{},activeWorkers:0,createdWorkers:0,maxPendingPermits:0,pendingPermits:0,last:{},canonical:undefined,snapshot:undefined,progress:undefined};
 for(const event of ["pointerdown","pointermove","keydown","touchstart","wheel"])window.addEventListener(event,()=>{w.abqAudit.lastHumanEpochMs=Date.now();},{capture:true,passive:true});
 const Native=Worker;
 window.Worker=class extends Native{
  requests=new Map();terminated=false;
  constructor(url,options){super(url,options);w.abqAudit.activeWorkers++;w.abqAudit.createdWorkers++;this.addEventListener('message',e=>{const r=e.data,a=w.abqAudit,request=this.requests.get(r.runId);this.requests.delete(r.runId);if(request?.permit)a.pendingPermits--;
   if(r.status==='ready'){a.snapshot=r.archivedSnapshot;if(!a.canonical)a.canonical=r.archivedSnapshot;}
   if(r.status==='result'){a.snapshot=r.result.snapshots.at(-1);a.last={run:r.result.run.manifest.runId,step:r.result.trainingStep,runtime:r.result.run.manifest.runtimeRevision,input:r.result.run.manifest.document,targets:r.result.targetIds};}
   if(r.status==='forward'){const p=r.progress,t=p.training;a.progress={id:p.executionId,sequence:p.sequence,phase:t?.phase??'forward',step:t?.acceptedStep,partial:t?.gradient,contributions:t?.contributions?.length??0,final:t?.final};}
   if(r.status==='cancelled'){for(const [id,v]of this.requests)if(v.executionId===request?.executionId){if(v.permit)a.pendingPermits--;this.requests.delete(id);}}
  });}
  postMessage(m,...rest){const a=w.abqAudit;a.commands[m.command]=(a.commands[m.command]??0)+1;const permit=['advanceForward','advanceTraining'].includes(m.command);this.requests.set(m.runId,{permit,executionId:m.executionId});if(permit){a.pendingPermits++;a.maxPendingPermits=Math.max(a.maxPendingPermits,a.pendingPermits);}return super.postMessage(m,...rest);}
  terminate(){if(!this.terminated){this.terminated=true;w.abqAudit.activeWorkers--;for(const v of this.requests.values())if(v.permit)w.abqAudit.pendingPermits--;this.requests.clear();}return super.terminate();}
 };
});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>{if(errors.length<20)errors.push(e.message);});
const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');const system=await browser.newBrowserCDPSession();
const started=performance.now(),wallStart=new Date().toISOString();let samples=0,cycles=0;
const elapsed=()=>Math.round((performance.now()-started)/1000);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const audit=()=>page.evaluate(()=>({lastHumanEpochMs:window.abqAudit.lastHumanEpochMs,commands:window.abqAudit.commands,activeWorkers:window.abqAudit.activeWorkers,createdWorkers:window.abqAudit.createdWorkers,maxPendingPermits:window.abqAudit.maxPendingPermits,pendingPermits:window.abqAudit.pendingPermits,last:window.abqAudit.last,progress:window.abqAudit.progress,snapshotId:window.abqAudit.snapshot?.id,step:window.abqAudit.snapshot?.state.optimizer.step,retention:JSON.parse(document.querySelector('.spatial-shell')?.getAttribute('data-retention')??'null')}));
async function sample(label){const dom=await cdp.send('Memory.getDOMCounters'),metrics=await cdp.send('Performance.getMetrics');let processes;try{const info=await system.send('SystemInfo.getProcessInfo');processes=info.processInfo.map(p=>{let rssKiB;try{rssKiB=Number(execFileSync('ps',['-o','rss=','-p',String(p.id)],{encoding:'utf8'}).trim());}catch{}return {pid:p.id,type:p.type,cpuSeconds:p.cpuTime,rssKiB};});}catch{}
 const result={label,elapsedSeconds:elapsed(),utc:new Date().toISOString(),...await audit(),dom,heap:Object.fromEntries(metrics.metrics.filter(m=>['JSHeapUsedSize','JSHeapTotalSize','Documents','Nodes','JSEventListeners'].includes(m.name)).map(m=>[m.name,m.value])),processes};await appendFile(`${out}/resource-samples.jsonl`,JSON.stringify(result)+'\n');samples++;console.log(JSON.stringify({label,elapsedSeconds:result.elapsedSeconds,cycles,workers:result.activeWorkers,pendingPermits:result.pendingPermits,runs:result.retention?.runs,heap:result.heap.JSHeapUsedSize}));return result;}
async function idleEntry(){await expect(page.locator('#exhibit-start')).toBeEnabled({timeout:30000});await expect(page.locator('#spatial-world')).toBeVisible();}
async function activate(){await page.locator('#exhibit-start').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');}
async function clear(){await page.locator('#clear-session').click();await idleEntry();await expect(page.locator('#execution-controls')).toHaveCount(0);await expect(page.locator('#spatial-world')).toHaveAttribute('viewBox','0 0 4500 1700');const a=await audit();expect(a.step).toBe(0);expect(a.pendingPermits).toBe(0);expect(a.retention.runs).toBe(0);expect(a.last.runtime).toBe(manifest.runtime);}
async function predict(input){await page.locator('#document').fill(input);await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');}
async function partial(){await page.locator('#step-learning').click();await page.locator('#execution-pin').click();await expect(page.locator('#execution-next')).toBeEnabled({timeout:90000});const a=await audit();expect(a.progress.phase).toBe('backward');expect(a.progress.final).toBe(false);expect(a.progress.contributions).toBeGreaterThan(0);}
async function toReady(){await page.locator('#execution-continue').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase','ready',{timeout:90000});}
async function head(h){await page.locator('#spatial-operation').selectOption('headOutput');await page.locator('#spatial-head').selectOption(String(h));const before=(await audit()).snapshotId;await page.locator('#spatial-ablate').click();await expect(page.getByTestId('spatial-intervention')).toBeVisible({timeout:30000});await page.locator('#spatial-current').click();await expect(page.getByTestId('spatial-intervention')).toHaveCount(0);expect((await audit()).snapshotId).toBe(before);}
async function capture(name){for(const [width,height]of [[1920,1080],[1280,720]]){await page.setViewportSize({width,height});await pause(350);await page.screenshot({path:`${out}/${name}-${width}.png`});}await page.setViewportSize({width:1920,height:1080});}
async function chain(){await page.locator('#short-sample').click();for(const stop of [1,2,3,4]){await page.locator(`[data-short-stop="${stop}"]`).click();await expect(page.getByTestId('scene-construction')).toBeVisible();}await page.locator('#spatial-operation').selectOption('mlpRelu');await page.locator('#short-resume').click();await expect(page.getByTestId('scene-construction')).toContainText('Attention residual');}
async function cycle(){
 await activate();await predict('abca');await chain();await partial();await toReady();await page.locator('#execution-accept').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
 await partial();await toReady();await page.locator('#execution-cancel').click();await expect(page.locator('#execution-controls')).toHaveCount(0);
 await page.locator('#operator-controls').click();await page.locator('#spatial-experiment').selectOption({index:1});await page.locator('[data-learning-phase="before"]').click();await page.locator('#spatial-current').click();
 await head(0);await head(1);
 for(const input of ['', 'a','abcabca'])await predict(input);
 await page.locator('#step-prediction').click();await page.locator('#execution-next').click();await page.locator('#execution-cancel').click();await expect(page.locator('#execution-controls')).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#spatial-home').press('Enter');await page.locator('#spatial-back').press('Enter');await page.emulateMedia({reducedMotion:'no-preference'});
 await sample('retained-history');await clear();cycles++;await sample('post-reset');
}
async function realIdle(candidate){await activate();if(candidate){await partial();await toReady();}const before=await audit(),lastActivity=performance.now();let warning=false,warningEpochMs;
 // The last UI action is above. All following reads and monotonic waits are passive.
 while(await page.locator('#exhibit-start').count()===0){if(!warning&&await page.locator('#exhibit-warning').count()){warning=true;warningEpochMs=Date.now();await page.screenshot({path:`${out}/idle-warning-${candidate?'candidate':'completed'}.png`});}if(performance.now()-lastActivity>340000)throw Error('Idle expiry exceeded 340 seconds');await pause(1000);if(Math.round((performance.now()-lastActivity)/1000)%60===0)await sample(candidate?'candidate-idle':'completed-idle');}
 await idleEntry();const after=await audit();expect(warning).toBe(true);expect(after.commands.acceptTraining??0).toBe(before.commands.acceptTraining??0);expect(after.step).toBe(0);await appendFile(`${out}/idle-cycle-audit.jsonl`,JSON.stringify({candidate,observedWaitSeconds:(performance.now()-lastActivity)/1000,lastHumanEpochMs:before.lastHumanEpochMs,realCycleSeconds:(Date.now()-before.lastHumanEpochMs)/1000,warningSeconds:warningEpochMs?(Date.now()-warningEpochMs)/1000:undefined,warningObserved:warning,acceptedBefore:before.commands.acceptTraining??0,acceptedAfter:after.commands.acceptTraining??0,after})+'\n');await sample('post-real-idle-reset');}
let failure;
try{
 await page.goto(base+'/?presentation=spatial&kiosk=1');await idleEntry();await page.evaluate(()=>document.fonts.ready);await sample('startup');
 const failed=await page.evaluate(()=>fetch('https://example.invalid/abq-negative-control').then(()=>false,()=>true));expect(failed).toBe(true);expect(blocked).toContain('https://example.invalid/abq-negative-control');
 if(mode==='cold'){await activate();await chain();await page.locator('#open-spatial-detail').click();await page.getByText('Read operation source',{exact:true}).click();await expect(page.locator('.context-lens pre').first()).toBeVisible();await partial();await toReady();await page.locator('#execution-cancel').click();await head(0);await clear();await sample('cold-complete');}
 if(mode==='probe'){await cycle();}
 if(mode==='route'){
  await capture('entry');await pause(8000);await activate();await page.locator('#short-sample').click();await capture('prediction');await pause(12000);
  for(const [stop,name]of [[1,'qk-scene'],[2,'softmax-scene'],[3,'mixture-scene'],[4,'residual-scene']]){await page.locator(`[data-short-stop="${stop}"]`).click();await capture(name);await pause(10000);}
  await page.locator('#spatial-operation').selectOption('mlpRelu');await capture('detour');await pause(7000);await page.locator('#short-resume').click();await pause(5000);
  await partial();await capture('partial-gradient');await pause(12000);await toReady();await capture('ready');await pause(15000);await page.locator('#execution-accept').click();await pause(7000);
  await page.locator('#spatial-operation').selectOption('headOutput');await page.locator('#spatial-ablate').click();await expect(page.getByTestId('spatial-intervention')).toBeVisible({timeout:30000});await capture('head-test');await pause(10000);await page.locator('#spatial-current').click();await clear();await capture('returned-idle');await pause(6000);
 }
 if(mode==='soak'){
  await cycle();await realIdle(false);await realIdle(true);
  while(performance.now()-started<7200000){await cycle();for(let i=0;i<3&&performance.now()-started<7200000;i++){await pause(60000);await sample('idle-between-visitors');}}
  await verifyArtifact();await sample('final');
 }
 expect(errors).toEqual([]);expect((await audit()).maxPendingPermits).toBeLessThanOrEqual(1);
}catch(e){failure=e;console.error(e);await page.screenshot({path:`out/error.png`.replace('out',out)}).catch(()=>{});}
const result={status:failure?'FAILED':'PASSED',mode,qualified120Minutes:mode==='soak'&&!failure&&performance.now()-started>=7200000,wallStart,wallEnd:new Date().toISOString(),elapsedSeconds:(performance.now()-started)/1000,runtime:manifest.runtime,sourceCommit:manifest.sourceCommit,launcherSHA256:manifest.launcherSHA256,artifactManifestSHA256:sha(await readFile(`${root}/release/manifest.json`)),cycles,samples,errors,blocked,final:await audit().catch(()=>undefined),failure:failure?.stack,scope:'One browser context and page; no test-driven restart or forced GC. CDP page heap and per-process RSS are distinct. No worker heap claim. Native headless browser; physical display and real OS background/resume not qualified.'};
await writeFile(`${out}/${mode}.json`,JSON.stringify(result,null,2)+'\n');await context.close();await browser.close();if(mode==='route'){const {readdir,rename}=await import('node:fs/promises');const files=(await readdir(`${root}/final-media`)).filter(f=>f.endsWith('.webm')&&f!=='paced-route.webm');if(files.length===1)await rename(`${root}/final-media/${files[0]}`,`${root}/final-media/paced-route.webm`);}
console.log(JSON.stringify(result));if(failure)process.exitCode=1;
