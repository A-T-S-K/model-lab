import {test,expect,type Page} from '../support/browser-evidence.js';
import {mkdir,writeFile} from 'node:fs/promises';

test.describe.configure({mode:'parallel'});
async function audit(page:Page){await page.addInitScript(()=>{
 const w=window as any;w.abq={commands:[],lastReady:undefined,lastResult:undefined,progress:undefined,results:[]};
 const send=Worker.prototype.postMessage,seen=new WeakSet();
 Worker.prototype.postMessage=function(m:any,...rest:any[]){w.abq.commands.push({command:m.command,executionId:m.executionId});if(!seen.has(this)){seen.add(this);this.addEventListener('message',e=>{const r=e.data;if(r.status==='ready')w.abq.lastReady=r.archivedSnapshot;if(r.status==='result'){w.abq.lastResult=r.result;w.abq.results.push(r.result);}if(r.status==='forward')w.abq.progress=r.progress;});}return Reflect.apply(send,this,[m,...rest]);};
});}
async function entry(page:Page){await page.goto('/?presentation=spatial&kiosk=1&facilitator=1');await expect(page.locator('#exhibit-start')).toBeEnabled();}
async function start(page:Page){await page.locator('#exhibit-start').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');}
const forwardStates=['p1_prediction_preview','p1_represent','p1_qkv','p1_attention_compare','p1_attention_weights','p1_value_mixture','p1_attention_integration','p1_transform','p1_score','p1_probabilities','p1_complete'];
const backwardStates=['p2_backward_trace','p2_gradient_contribution','p2_final_gradient','p2_adam_proposal','candidate_ready'];
async function state(page:Page,value:string){await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state',value,{timeout:60000});}
async function complete(page:Page){for(const value of forwardStates.slice(1)){await page.locator('#short-continue').click();await state(page,value);}}
async function ready(page:Page){await complete(page);await page.locator('#short-teach').click();await state(page,'p2_objective');for(const value of backwardStates){await expect(page.locator('#reverse-continue')).toBeEnabled({timeout:60000});await page.locator('#reverse-continue').click();await state(page,value);}await expect(page.locator('#execution-accept')).toBeEnabled({timeout:60000});}
for(const [width,height] of [[1920,1080],[1280,720]])test(`Q01/Q03 entry and source-bound chain ${width}`,async({page,evidenceDir:dir})=>{
 await page.setViewportSize({width,height});await audit(page);await entry(page);
 await expect(page.locator('#spatial-world')).toBeVisible();await expect(page.getByTestId('status')).toBeVisible();await expect(page.getByTestId('status')).toContainText('Recorded real run. Not live.');await expect(page.locator('.spatial-badge')).toContainText('RECORDED RUN · REPLAY');await page.screenshot({path:`${dir}/entry-${width}.png`});
 const idle=await page.evaluate(()=>(window as any).abq.commands);await page.waitForTimeout(1100);expect(await page.evaluate(()=>(window as any).abq.commands)).toEqual(idle);
 const begin=Date.now();await page.locator('#exhibit-start').press(width===1280?'Enter':'Space');await state(page,'p1_prediction_preview');
 const captured=await page.evaluate(()=>(window as any).abq.lastResult),run=captured.run.manifest.runId;
 const commands=await page.evaluate(()=>(window as any).abq.commands);
 await page.locator('#operator-controls').click();await page.locator('#short-sample').click();await state(page,'p1_prediction_preview');await expect(page.getByTestId('scene-construction')).toContainText('Known target: a');expect(await page.evaluate(()=>(window as any).abq.commands)).toEqual(commands);
 for(const value of forwardStates){
  await state(page,value);const support=page.getByTestId('dock-context-support');await expect(support).toHaveAttribute('data-source-run-id',run);
  const position=Number(await support.getAttribute('data-position'));
  const observations=await support.locator('[data-evidence-origin="observed"][data-member][data-value]').evaluateAll(els=>els.map(el=>({member:el.getAttribute('data-member'),value:Number(el.getAttribute('data-value'))})));
  expect(observations.length||value==='p1_complete').toBeTruthy();
  // Exact values must occur in the bound native artifact, including saved residuals.
  const kinds:Record<string,string>={input:'preAttentionNorm',query:'q',keys:'k',scores:'attentionLogits',weights:'attentionProbabilities',savedResidual:'embeddingNorm',headOutputs:'headOutput'};
  for(const o of observations){const kind=kinds[o.member!]??o.member;expect(captured.run.artifacts.some((a:any)=>a.kind===kind&&a.values?.includes(o.value)&&(a.concept.token===position||['k','v'].includes(kind)))).toBe(true);}
  if(['p1_attention_integration','p1_transform'].includes(value)){
   const parts=await support.locator('[data-value]').evaluateAll(els=>els.map(el=>({member:el.getAttribute('data-member'),origin:el.getAttribute('data-evidence-origin'),value:Number(el.getAttribute('data-value'))})));
   const saved=parts.find(x=>x.member===(value==='p1_transform'?'attentionResidual':'savedResidual'))!,operand=parts.find(x=>x.member===(value==='p1_transform'?'mlpDown':'attentionProjection'))!;
   const derived=parts.find(x=>x.origin==='derived')!,result=parts.find(x=>x.member===(value==='p1_transform'?'mlpResidual':'attentionResidual')&&x.origin==='observed')!;
   expect(derived.value).toBe(operand.value+saved.value);expect(result.value).toBe(derived.value);
  }
  if(['p1_represent','p1_attention_compare','p1_value_mixture','p1_transform'].includes(value)){
   await page.locator('#dock-inspect').click();await expect(page.getByTestId('selected-world-object')).toHaveAttribute('data-run-id',run);
   await page.locator('[data-dock-depth="math"]').click();
   if(value==='p1_attention_compare'){
    const products=page.locator('.construction-products > span');await expect(products).toHaveCount(4);
    const q=captured.run.artifacts.find((a:any)=>a.kind==='q'&&a.concept.token===position).values.slice(0,4),k=captured.run.artifacts.find((a:any)=>a.kind==='k'&&a.concept.token===0).values.slice(0,4);
    expect(await products.evaluateAll(spans=>spans.map(span=>[...span.querySelectorAll('[data-value]')].map(v=>Number(v.getAttribute('title')))))).toEqual(q.map((v:number,i:number)=>[v,k[i],v*k[i]]));
   }
   if(value==='p1_value_mixture')await expect(page.getByTestId('mixture-contributors').locator('tbody tr')).toHaveCount(position+1);
   await page.locator('[data-dock-depth="source"]').click();await expect(page.getByTestId('spatial-run')).toHaveText(run);await page.screenshot({path:`${dir}/${value}-source-${width}.png`});await page.locator('#dock-inspect').click();
   if(value==='p1_attention_compare'){
    // The Guided occurrence is fixed; alternate head/key selection is an
    // explicit Explore detour and must return without changing the lesson.
    await page.locator('#visitor-explore-toggle').click();await page.locator('#spatial-head').selectOption('1');await page.locator('#spatial-key').selectOption('1');
    await page.locator('#dock-inspect').click();await page.locator('[data-dock-depth="math"]').click();
    await expect(page.getByTestId('qk-products').locator('tbody tr')).toHaveCount(4);
    await expect(page.getByTestId('dock-math')).toContainText('head 1');await page.screenshot({path:`${dir}/alternate-head-key-${width}.png`});
    await page.locator('#dock-inspect').click();await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-navigation-mode','guided');
    await expect(page.getByTestId('dock-context-support')).toHaveAttribute('data-head','0');await expect(page.getByTestId('dock-context-support')).toHaveAttribute('data-key','0');
   }
  }
  await expect(page.locator('#short-continue, #short-teach').first()).toBeInViewport();await page.screenshot({path:`${dir}/${value}-${width}.png`});
  expect(await page.evaluate(()=>(window as any).abq.commands)).toEqual(commands);
  if(value!=='p1_complete')await page.locator('#short-continue').click();
 }
 expect(commands.filter((c:any)=>c.command==='predict')).toHaveLength(2);expect(commands.filter((c:any)=>c.command==='predict').length-idle.filter((c:any)=>c.command==='predict').length).toBe(1);expect(commands.some((c:any)=>/train|ablate/i.test(c.command))).toBe(false);
 await writeFile(`${dir}/activation-${width}.json`,JSON.stringify({elapsedMs:Date.now()-begin,commands,run},null,2));
});
test('Q02 complete public reset across completed, forward, partial, Ready, historical and intervention',async({page,evidenceDir:dir})=>{
 test.setTimeout(240000);await audit(page);const matrix=[];
 for(const boundary of ['completed','forward','partial','ready','historical','intervention']){
  // Actual forward stepping, archived transition selection and intervention are
  // workbench capabilities. Public
  // explanation/learning/reset use the supported facilitator lesson controls.
  const expert=['forward','historical','intervention'].includes(boundary);
  await page.goto(expert?'/?presentation=spatial':'/?presentation=spatial&kiosk=1&facilitator=1');
  if(expert){await expect(page.locator('#predict')).toBeEnabled();await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');}else await start(page);
  const initial=await page.evaluate(()=>(window as any).abq.lastReady);
  if(boundary==='completed'){await complete(page);await page.locator('#visitor-explore-toggle').click();await page.locator('#zoom-in').click();}
  if(boundary==='forward'){await page.locator('#step-prediction').click();await page.locator('#execution-next').click();await expect(page.locator('#execution-controls')).toBeVisible();}
  if(boundary==='partial'){await complete(page);await page.locator('#short-teach').click();await state(page,'p2_objective');for(const value of backwardStates.slice(0,2)){await expect(page.locator('#reverse-continue')).toBeEnabled({timeout:60000});await page.locator('#reverse-continue').click();await state(page,value);}await expect(page.locator('#reverse-continue')).toBeEnabled({timeout:60000});const t=await page.evaluate(()=>(window as any).abq.progress.training);expect(t.final).toBe(false);expect(t.count).toBeGreaterThan(0);}
  if(boundary==='ready')await ready(page);
  if(boundary==='historical'){
   await page.locator('#step-learning').click();await page.locator('#execution-pin').click();await expect(page.locator('#execution-continue')).toBeEnabled({timeout:60000});await page.locator('#execution-continue').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase','ready',{timeout:60000});
   await page.locator('#execution-accept').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');await page.locator('#spatial-experiment').selectOption({index:1});await page.locator('[data-learning-phase="before"]').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');const accepted=await page.evaluate(()=>(window as any).abq.lastResult);await expect(page.getByTestId('selected-world-object')).toHaveAttribute('data-run-id',accepted.experiment.beforeRunId);const before=accepted.runs.find((r:any)=>r.manifest.runId===accepted.experiment.beforeRunId);const snapshot=accepted.snapshots.find((s:any)=>s.id===before.manifest.startingSnapshotId);expect(snapshot.state.optimizer.step).toBe(0);
  }
  if(boundary==='intervention'){await page.locator('#spatial-operation').selectOption('headOutput');await page.locator('#spatial-ablate').click();await expect(page.getByTestId('spatial-intervention')).toBeVisible({timeout:30000});await expect(page.getByTestId('inspected-arm')).toBeVisible();}
  const accepts=await page.evaluate(()=>(window as any).abq.commands.filter((c:any)=>c.command==='acceptTraining').length);
  await page.locator('#clear-session').click();await expect(page.locator(expert?'#predict':'#exhibit-start')).toBeEnabled();
  await expect.poll(()=>page.evaluate(()=>(window as any).abq.lastReady)).toEqual(initial);
  const a=await page.evaluate(()=>(window as any).abq);expect(a.commands.filter((c:any)=>c.command==='acceptTraining')).toHaveLength(accepts);
  await expect(page.locator('#execution-controls')).toHaveCount(0);await expect(page.locator('.context-lens')).toBeHidden();
  // History is read from the actual retention authority, not the recorded opening replay.
  const retention=JSON.parse((await page.locator('.spatial-shell').getAttribute('data-retention'))!);expect(retention.runs).toBe(0);
  if(expert){await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');}else await start(page);const restored=await page.evaluate(()=>(window as any).abq.lastResult.snapshots[0]);expect(restored).toEqual(initial);
  matrix.push({boundary,profile:expert?'workbench':'facilitator',completeSnapshotRestored:true,acceptedByReset:false,retention});
  await writeFile(`${dir}/reset-${boundary}.json`,JSON.stringify(matrix.at(-1)),{flag:'wx'});
 }
 await writeFile(`${dir}/reset-matrix.json`,JSON.stringify(matrix,null,2));
});
test('Q02 warning, Keep session, wheel activity and expiry use real event ownership with fake time',async({page,evidenceDir:dir})=>{
 await page.clock.install();await audit(page);await entry(page);await start(page);await page.clock.runFor(281000);await expect(page.locator('#exhibit-warning')).toBeVisible();await expect(page.locator('#exhibit-warning')).toContainText('Unaccepted candidate');await page.locator('#stay-here').click();await page.clock.runFor(1000);await expect(page.locator('#exhibit-warning')).toHaveCount(0);await page.clock.runFor(270000);await page.mouse.wheel(0,10);await page.clock.runFor(20000);await expect(page.locator('#exhibit-warning')).toHaveCount(0);await page.clock.runFor(281000);await expect(page.locator('#exhibit-start')).toBeEnabled();await expect(page.locator('#spatial-world')).toBeVisible();
});
test('Q04/Q05 short route detour, keyboard, reduced motion and source invalidation',async({page,evidenceDir:dir})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await audit(page);await entry(page);await page.locator('#exhibit-start').press('Enter');await state(page,'p1_prediction_preview');
 await page.locator('#short-continue').press('Enter');await state(page,'p1_represent');const run=await page.getByTestId('landmark-occurrence').getAttribute('data-run-id'),commands=await page.evaluate(()=>(window as any).abq.commands);
 await page.locator('#dock-inspect').press('Enter');await page.locator('[data-dock-depth="math"]').press('Enter');await expect(page.getByTestId('dock-math')).toBeVisible();await page.locator('#dock-inspect').press('Enter');await expect(page.locator('#dock-inspect')).toBeFocused();
 await page.locator('#visitor-explore-toggle').press('Enter');await page.locator('#spatial-operation').selectOption('mlpRelu');await page.locator('#spatial-query').selectOption('0');await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-navigation-mode','explore');await page.locator('#short-resume').press('Enter');await state(page,'p1_represent');await expect(page.getByTestId('landmark-occurrence')).toHaveAttribute('data-run-id',run!);
 expect(await page.evaluate(()=>(window as any).abq.commands)).toEqual(commands);
 await page.locator('#document').fill('a');await page.locator('#document').dispatchEvent('change');await expect(page.getByTestId('landmark-occurrence')).toHaveAttribute('data-run-id',run!);
 await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');await expect(page.getByTestId('landmark-occurrence')).not.toHaveAttribute('data-run-id',run!);await expect(page.locator('#document')).toHaveValue('a');await expect(page.getByTestId('dock-context-support')).not.toContainText('NaN');const after=await page.evaluate(()=>(window as any).abq.commands);await page.locator('#operator-controls').click();await page.locator('#short-sample').click();await expect(page.getByTestId('facilitator-panel')).toContainText('explicitly Predict first');await expect(page.locator('#document')).toHaveValue('a');expect(await page.evaluate(()=>(window as any).abq.commands)).toEqual(after);await page.screenshot({path:`${dir}/fresh-short-input.png`});
});
test('Q08 test-only serialized-estimate fixture refuses new work visibly and Clear recovers',async({page,evidenceDir:dir})=>{
 await page.addInitScript(()=>{const w=window as any;w.refuseBudget=false;w.budgetHits=0;const encode=TextEncoder.prototype.encode;TextEncoder.prototype.encode=function(input?:string){if(w.refuseBudget&&input?.includes('"format":"model-lab-session-archive-v1"')&&input.includes('"directRuns":')&&input.includes('"snapshots":')){w.budgetHits++;const bytes=encode.call(this,input);Object.defineProperty(bytes,'length',{value:24*1024*1024});Object.defineProperty(bytes,'byteLength',{value:24*1024*1024});return bytes;}return encode.call(this,input);};});
 await audit(page);await entry(page);await start(page);await complete(page);
 const before=await page.evaluate(()=>(window as any).abq.commands),history=await page.locator('.spatial-shell').getAttribute('data-retention');await page.evaluate(()=>(window as any).refuseBudget=true);
 await page.locator('#short-teach').click();await expect(page.getByRole('alert')).toContainText('Retention capacity');expect(await page.evaluate(()=>(window as any).budgetHits)).toBe(1);expect(await page.evaluate(()=>(window as any).abq.commands)).toEqual(before);expect(await page.locator('.spatial-shell').getAttribute('data-retention')).toBe(history);
 await page.screenshot({path:`${dir}/budget-state.png`});await page.evaluate(()=>(window as any).refuseBudget=false);await page.locator('#clear-session').click();await expect(page.locator('#exhibit-start')).toBeEnabled();await start(page);await expect(page.getByRole('alert')).toHaveCount(0);
 // Intervention refusal belongs to workbench and reaches the same accounting boundary.
 await page.goto('/?presentation=spatial');await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');await page.locator('#spatial-operation').selectOption('headOutput');await page.evaluate(()=>(window as any).refuseBudget=true);const count=await page.evaluate(()=>(window as any).abq.commands.length);await page.locator('#spatial-ablate').click();await expect(page.getByRole('alert')).toContainText('Retention capacity');expect(await page.evaluate(()=>(window as any).budgetHits)).toBe(1);expect(await page.evaluate(()=>(window as any).abq.commands.length)).toBe(count);
 await writeFile(`${dir}/budget-fixture.json`,JSON.stringify({boundary:'portable manifest at retention preflight',budgetHitsPerRefusal:1,newTransport:0,historyRetained:true,clearRecovered:true},null,2));
});
test('Q02 facilitated opt-out disables expiry while public reset retains the spatial exhibit entry',async({page,evidenceDir:dir})=>{
 await page.clock.install();await entry(page);await start(page);await page.locator('#operator-controls').click();await page.locator('#exhibit-opt-out').click();await page.clock.runFor(301000);await expect(page.locator('#exhibit-start')).toHaveCount(0);await page.locator('#clear-session').click();await expect(page.locator('#exhibit-start')).toBeEnabled();await expect(page.locator('#spatial-world')).toBeVisible();await start(page);await expect(page.getByTestId('status')).toContainText('Live prediction complete');await page.locator('#operator-controls').click();await expect(page.locator('#exhibit-opt-out')).toContainText('Enable idle reset');await page.locator('#exhibit-opt-out').click();await page.clock.runFor(281000);await expect(page.locator('#exhibit-warning')).toBeVisible();
});

// Downstream reset race coverage for BF-003; captured stale bytes never become history.
test('Q02 late prediction reply cannot republish after public reset',async({page,evidenceDir:dir})=>{
 await page.addInitScript(()=>{const w=window as any;w.holdPrediction=false;w.lateReplies=[];const d=Object.getOwnPropertyDescriptor(Worker.prototype,'onmessage')!;Object.defineProperty(Worker.prototype,'onmessage',{configurable:true,get:d.get,set(handler:(e:MessageEvent)=>void){d.set!.call(this,(e:MessageEvent)=>{if(w.holdPrediction&&e.data.status==='result')w.lateReplies.push(()=>handler(e));else handler(e);});}});});
 await audit(page);await entry(page);await start(page);const initial=await page.evaluate(()=>(window as any).abq.lastReady);
 await page.evaluate(()=>(window as any).holdPrediction=true);await page.locator('#predict').click();await expect.poll(()=>page.evaluate(()=>(window as any).lateReplies.length)).toBe(1);
 await page.locator('#clear-session').click();await expect(page.locator('#exhibit-start')).toBeEnabled();
 await page.evaluate(()=>{const w=window as any;w.holdPrediction=false;w.lateReplies.forEach((f:any)=>f());});await page.waitForTimeout(250);
 expect(JSON.parse((await page.locator('.spatial-shell').getAttribute('data-retention'))!).runs).toBe(0);await expect(page.locator('#exhibit-start')).toBeEnabled();await expect(page.locator('#execution-controls')).toHaveCount(0);
 await start(page);expect(await page.evaluate(()=>(window as any).abq.lastResult.snapshots[0])).toEqual(initial);
 await writeFile(`${dir}/late-reset.json`,JSON.stringify({releasedLateReplies:1,retainedAfterLateReply:0,completeInitialSnapshotRestored:true}),{flag:'wx'});
});
