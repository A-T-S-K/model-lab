import { test,expect } from '../support/browser-evidence.js';
import { writeFile } from 'node:fs/promises';
import { readReplayPair } from '../support/slice-output.js';
test('two real producers share admission, inspection, sources and saved evidence',async({page,evidenceDir:dir})=>{
  test.skip(process.env.SLICE_PHASE==='offline');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const w=window as any;w.sliceAudit={commands:[],results:[]};const send=Worker.prototype.postMessage;const seen=new WeakSet();
    Worker.prototype.postMessage=function(m:any,...args:any[]){w.sliceAudit.commands.push(m);if(!seen.has(this)){seen.add(this);this.addEventListener('message',e=>{if(e.data.status==='result')w.sliceAudit.results.push(e.data.result);});}return Reflect.apply(send,this,[m,...args]);};
  });
  await page.setViewportSize({width:1920,height:1080});await page.goto('/?presentation=spatial');
  await expect(page.locator('#predict')).toBeEnabled();await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.screenshot({path:`${dir}/canonical-world-1920.png`});
  const baseline=await page.evaluate(()=>(window as any).sliceAudit.results.at(-1));
  await page.locator('#open-shared-inspector').click();await expect(page.getByTestId('shared-provenance')).toContainText('observed');
  await expect(page.locator('#shared-inspector')).toContainText('float64');await page.screenshot({path:`${dir}/canonical-shared-1920.png`});
  await page.locator('#shared-save').click();await writeFile(`${dir}/canonical-saved.json`,await page.evaluate(()=>localStorage.getItem('model-lab-evidence-v1')!));
  const commands=await page.evaluate(()=>(window as any).sliceAudit.commands.length);
  await page.locator('#shared-model').selectOption('pythia-native-v1');await page.locator('#native-endpoint').fill(process.env.SLICE_NATIVE_ENDPOINT!);await page.locator('#native-prompt').fill('The cat sat');
  const responsePromise=page.waitForResponse(r=>r.url()===process.env.SLICE_NATIVE_ENDPOINT!&&r.request().method()==='POST');
  await page.locator('#shared-execute').click();const response=await responsePromise;expect(response.status()).toBe(200);const native=await response.json();
  await expect(page.getByTestId('shared-status')).toContainText('receipt validated');
  expect(await page.evaluate(()=>(window as any).sliceAudit.commands.length)).toBe(commands);
  const norm=native.record.points.findIndex((p:any)=>p.id==='norm.mlp');await page.locator(`[data-point="${norm}"]`).click();
  await expect(page.getByTestId('shared-point')).toContainText('gpt_neox.layers.1.post_attention_layernorm');await expect(page.locator('#shared-inspector')).toContainText('SAME residual input');
  const attention=native.record.points.findIndex((p:any)=>p.id==='attention.weights');await page.locator(`[data-point="${attention}"]`).click();
  const values=native.record.points[attention].values;expect(JSON.parse((await page.getByTestId('shared-values').textContent())!)).toEqual(values.slice(0,16));
  await page.screenshot({path:`${dir}/native-head0-1920.png`});
  await page.locator('#shared-offset').fill('9');await page.locator('#shared-offset').dispatchEvent('change');expect(JSON.parse((await page.getByTestId('shared-values').textContent())!)).toEqual(values.slice(9,25));
  await page.screenshot({path:`${dir}/native-head1-1920.png`});
  const logits=native.record.points.findIndex((p:any)=>p.id==='logits');await page.locator(`[data-point="${logits}"]`).click();
  await expect(page.getByTestId('omitted-mass')).toBeVisible();await page.locator('#shared-offset').fill('50303');await page.locator('#shared-offset').dispatchEvent('change');
  await expect(page.getByTestId('selected-probability')).toContainText('Exact selected index 50303');
  await page.screenshot({path:`${dir}/native-logits-1920.png`});
  await page.locator('summary').filter({hasText:'Read bound source'}).click();await expect(page.locator('.shared-source')).toContainText('def forward');
  await page.locator('#shared-save').click();await expect(page.getByTestId('shared-status')).toContainText('Saved selected run');
  const saved=await page.evaluate(()=>localStorage.getItem('model-lab-evidence-v1')!);await writeFile(`${dir}/browser-saved-native.json`,saved);
  await writeFile(`${dir}/browser-native-response.json`,JSON.stringify(native));
  await page.locator('#shared-model').selectOption('microgpt-legacy-v1');await page.locator('#shared-execute').click();await expect(page.getByTestId('shared-status')).toContainText('receipt validated');
  const after=await page.evaluate(()=>(window as any).sliceAudit.results.at(-1));expect(after.snapshots).toEqual(baseline.snapshots);expect(after.logits).toEqual(baseline.logits);
  expect(errors).toEqual([]);await writeFile(`${dir}/browser-live-evidence.json`,JSON.stringify({baseline:baseline.run.manifest,after:after.run.manifest,nativeRequest:response.request().postDataJSON(),nativeRuntime:native.record.runtime,nativeRun:native.record.id,errors,canonicalStateUnchanged:true},null,2));
});

test('saved native evidence replays after shutdown and canonical operation requires no Python endpoint',async({page,evidenceDir:dir})=>{
  test.skip(process.env.SLICE_PHASE!=='offline');const {saved,native}=await readReplayPair(process.cwd(),process.env.SLICE_SAVED_INPUT!,process.env.SLICE_RESPONSE_INPUT!,process.env.MODEL_LAB_SLICE_OUTPUT!);
  let nativeRequests=0;page.on('request',r=>{if(r.url()===process.env.SLICE_NATIVE_ENDPOINT)nativeRequests++;});
  await page.addInitScript(saved=>localStorage.setItem('model-lab-evidence-v1',saved),saved);
  await page.setViewportSize({width:1920,height:1080});await page.goto('/?presentation=spatial');
  await page.locator('#open-shared-inspector').click();await page.locator('#shared-load').click();await expect(page.getByTestId('shared-provenance')).toContainText('SAVED REPLAY');
  const attention=native.record.points.findIndex((p:any)=>p.id==='attention.weights');await page.locator(`[data-point="${attention}"]`).click();
  expect(JSON.parse((await page.getByTestId('shared-values').textContent())!)).toEqual(native.record.points[attention].values.slice(0,16));
  await page.locator('#shared-detail').click();await expect(page.getByTestId('shared-status')).toContainText('Not captured in this run. Executor disconnected');
  await page.screenshot({path:`${dir}/native-disconnected-1920.png`});await page.setViewportSize({width:1280,height:720});await page.screenshot({path:`${dir}/native-disconnected-1280.png`});
  await page.locator('#close-shared').click();await expect(page.locator('#predict')).toBeEnabled();await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  expect(nativeRequests).toBe(0);await writeFile(`${dir}/browser-offline-evidence.json`,JSON.stringify({nativeRequests,sharedSavedValuesExact:true,uncapturedRefusal:true,canonicalPredictWithoutBridge:true},null,2));
});

test('a real native reply delayed past a model switch cannot enter retained evidence',async({page,evidenceDir:dir})=>{
  test.skip(process.env.SLICE_PHASE==='offline');
  let release!:()=>void,received!:()=>void;
  const hold=new Promise<void>(resolve=>release=resolve),ready=new Promise<void>(resolve=>received=resolve);
  await page.route(process.env.SLICE_NATIVE_ENDPOINT!,async route=>{
    const response=await route.fetch();received();await hold;
    try{await route.fulfill({response});}catch{/* The actual client abort closes the route. */}
  });
  await page.goto('/?presentation=spatial');await page.locator('#open-shared-inspector').click();
  await page.locator('#shared-model').selectOption('pythia-native-v1');await page.locator('#native-endpoint').fill(process.env.SLICE_NATIVE_ENDPOINT!);await page.locator('#shared-execute').click();await ready;
  await page.locator('#shared-model').selectOption('microgpt-legacy-v1');release();
  await expect(page.getByTestId('shared-status')).toContainText('Producer changed');
  await expect(page.locator('#shared-run option').filter({hasText:'pythia-native-v1'})).toHaveCount(0);
  await page.locator('#shared-execute').click();await expect(page.getByTestId('shared-status')).toContainText('receipt validated');
  await expect(page.locator('#shared-model')).toHaveValue('microgpt-legacy-v1');
  await expect(page.locator('#shared-run option').filter({hasText:'pythia-native-v1'})).toHaveCount(0);
  await writeFile(`${dir}/browser-stale-evidence.json`,JSON.stringify({realNativeResponse:true,delayedUntilAfterSwitch:true,noNativeAdmission:true,canonicalStillExecutable:true},null,2));
});
