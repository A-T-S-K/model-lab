import {test,expect} from '../support/browser-evidence.js';
import {readFile,writeFile} from 'node:fs/promises';
import {validateScratchPath} from '../support/slice-output.js';

test('live MLP prediction and SGD, then noncanonical multilayer selection in the same inspector',async({page,evidenceDir:dir})=>{
  test.skip(process.env.SLICE_PHASE==='offline');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:1000});await page.goto('/?presentation=spatial');
  await page.locator('#open-shared-inspector').click();
  await page.locator('#shared-model').selectOption('mlp-native-v1');await page.locator('#native-endpoint').fill(process.env.SLICE_NATIVE_ENDPOINT!);
  await expect(page.locator('#native-prompt')).toHaveValue(/"kind":"numeric"/);
  let response=page.waitForResponse(r=>r.url()===process.env.SLICE_NATIVE_ENDPOINT&&r.request().method()==='POST');
  await page.locator('#shared-execute').click();const prediction=await (await response).json();
  await expect(page.getByTestId('shared-status')).toContainText('receipt validated');
  expect(prediction.record.run.request.action).toBe('predict');
  await page.locator('#shared-action').selectOption('train');response=page.waitForResponse(r=>r.url()===process.env.SLICE_NATIVE_ENDPOINT&&r.request().method()==='POST');
  await page.locator('#shared-execute').click();const training=await (await response).json();
  await expect(page.getByTestId('shared-status')).toContainText('receipt validated');
  expect(training.record.resulting.optimizer.step).toBe(1);expect(training.record.starting.optimizer.step).toBe(0);
  for(const id of ['prediction','loss','w1.gradient','w1.delta','prediction.after']){
    const index=training.record.run.points.findIndex((p:any)=>p.id===id);await page.locator(`[data-point="${index}"]`).click();
    expect(JSON.parse((await page.getByTestId('shared-values').textContent())!)).toEqual(training.record.run.points[index].values.slice(0,16));
  }
  await page.locator('summary').filter({hasText:'Read bound source'}).click();await expect(page.locator('.shared-source')).toContainText('parameter.add_');
  await page.screenshot({path:`${dir}/mlp-training.png`});await page.locator('#shared-save').click();
  await writeFile(`${dir}/mlp-saved.json`,await page.evaluate(()=>localStorage.getItem('model-lab-evidence-v1')!));
  await page.locator('#shared-model').selectOption('microgpt-multilayer-v1');await expect(page.locator('#native-endpoint')).toHaveCount(0);
  await page.locator('#shared-execute').click();await expect(page.getByTestId('shared-status')).toContainText('receipt validated');
  await page.locator('#shared-save').click();const saved=await page.evaluate(()=>localStorage.getItem('model-lab-evidence-v1')!);
  const run=JSON.parse(saved).envelope.record.run;
  const point=run.points.findIndex((p:any)=>p.node==='layer.1.headOutput.head.2'&&p.port==='position.5');
  expect(point).toBeGreaterThan(0);await page.locator(`[data-point="${point}"]`).click();
  expect(JSON.parse((await page.getByTestId('shared-values').textContent())!)).toEqual(run.points[point].values);
  await expect(page.locator('#shared-inspector')).toContainText('prefill:0:position:5');
  await page.locator('[data-dependency]').first().click();await expect(page.getByTestId('shared-point')).toContainText('layer.1.attentionProbabilities.head.2');
  await page.screenshot({path:`${dir}/noncanonical-layer1-head2-position5.png`});
  await writeFile(`${dir}/noncanonical-saved.json`,saved);
  expect(errors).toEqual([]);await writeFile(`${dir}/witness-browser-results.json`,JSON.stringify({liveMLPPredict:true,liveSGD:true,multilayerWorker:true,errors,trainingState:training.record.resulting.optimizer}));
});

test('new models reopen after native shutdown without executors and refuse uncaptured actions',async({page,evidenceDir:dir})=>{
  test.skip(process.env.SLICE_PHASE!=='offline');
  const base=await validateScratchPath(process.cwd(),process.env.M1_SAVED_DIR!);
  let requests=0,workers=0;page.on('request',r=>{if(r.url()===process.env.SLICE_NATIVE_ENDPOINT)requests++;});page.on('worker',()=>workers++);
  await page.goto('/?presentation=spatial');await page.locator('#open-shared-inspector').click();const initialWorkers=workers;
  for(const name of ['mlp','noncanonical']){
    const saved=await readFile(`${base}/${name}-saved.json`,'utf8'),run=JSON.parse(saved).envelope.record.run;
    await page.evaluate(value=>localStorage.setItem('model-lab-evidence-v1',value),saved);await page.locator('#shared-load').click();
    await expect(page.getByTestId('shared-provenance')).toContainText('SAVED REPLAY');
    const index=run.points.findIndex((p:any)=>p.id===(name==='mlp'?'w1.gradient':'position.5/layer.1/headOutput/head.2'));
    await page.locator(`[data-point="${index}"]`).click();expect(JSON.parse((await page.getByTestId('shared-values').textContent())!)).toEqual(run.points[index].values.slice(0,16));
    await page.locator('#shared-detail').click();await expect(page.getByTestId('shared-status')).toContainText('Executor disconnected');
    await page.screenshot({path:`${dir}/${name}-disconnected.png`});
  }
  expect(requests).toBe(0);expect(workers).toBe(initialWorkers);
  await writeFile(`${dir}/offline-results.json`,JSON.stringify({requests,newWorkers:workers-initialWorkers,replayed:['mlp','noncanonical']}));
});

test('structural and opaque imports show truthful fallback and no invented numerical display',async({page,evidenceDir:dir})=>{
  const base=process.env.WITNESS_RECORDING_DIR!;
  await page.goto('/?presentation=spatial');await page.locator('#open-shared-inspector').click();
  for(const name of ['shape','opaque']){
    const text=await readFile(`${base}/${name}.json`,'utf8');
    await page.locator('#shared-import').setInputFiles({name:`${name}.json`,mimeType:'application/json',buffer:Buffer.from(text)});
    await expect(page.getByTestId('shared-provenance')).toContainText('SAVED REPLAY');
    await page.locator('[data-point="1"]').click();await expect(page.getByTestId('shared-values')).toContainText('Numerical values unavailable');
    await expect(page.getByTestId('omitted-mass')).toHaveCount(0);await expect(page.locator('#shared-execute')).toBeDisabled();
    if(name==='opaque'){
      await page.locator('[data-point="2"]').click();await expect(page.getByTestId('shared-values')).toHaveText('[5]');
      await page.locator('[data-point="3"]').click();await expect(page.getByTestId('shared-values')).toContainText('unsupported');
    }
    await page.screenshot({path:`${dir}/${name}-fallback.png`});
  }
});
