import {test,expect} from '../support/browser-evidence.js';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {validateScratchPath} from '../support/slice-output.js';

test('M2-B live MLP prediction and SGD inhabit the shared continuous world without transformer state',async({page,evidenceDir:dir})=>{
  test.skip(process.env.SLICE_PHASE==='offline');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1920,height:1080});await page.goto('/?presentation=spatial');
  await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#open-shared-inspector').click();await page.locator('#shared-model').selectOption('mlp-native-v1');await page.locator('#native-endpoint').fill(process.env.SLICE_NATIVE_ENDPOINT!);
  let response=page.waitForResponse(r=>r.url()===process.env.SLICE_NATIVE_ENDPOINT&&r.request().method()==='POST');await page.locator('#shared-execute').click();const prediction=await (await response).json();
  expect(prediction.record.run.request.action).toBe('predict');await page.locator('#shared-world').click();
  await expect(page.locator('.world-brand')).toContainText('Numeric MLP');await expect(page.locator('#spatial-layer,#spatial-head,#spatial-query,#spatial-key')).toHaveCount(0);
  await expect(page.locator('.mlp-capabilities')).toContainText('MSE');await expect(page.locator('.mlp-capabilities')).toContainText('SGD');await expect(page.locator('.mlp-shell')).not.toContainText('Adam');
  await page.locator('#mlp-operation').selectOption('inputs');await page.getByTestId('downstream-choices').getByRole('button',{name:/First affine/}).click();await expect(page.getByTestId('forward-artifact')).toHaveText('hidden.pre');
  await page.getByTestId('downstream-choices').getByRole('button',{name:/ReLU hidden/}).click();await page.getByTestId('downstream-choices').getByRole('button',{name:/Prediction/}).click();await page.getByTestId('downstream-choices').getByRole('button',{name:/Squared error/}).click();await page.getByTestId('downstream-choices').getByRole('button',{name:/MSE loss/}).click();
  await expect(page.getByTestId('forward-artifact')).toHaveText('loss');await page.getByTestId('mlp-source').locator('summary').click();await expect(page.getByTestId('mlp-source')).toContainText('squared_error.mean()');
  await page.screenshot({path:`${dir}/m2-b-mlp-prediction-1920.png`});

  await page.locator('#return-canonical-world').click();await page.locator('#open-shared-inspector').click();await page.locator('#shared-model').selectOption('mlp-native-v1');await page.locator('#native-endpoint').fill(process.env.SLICE_NATIVE_ENDPOINT!);await page.locator('#shared-action').selectOption('train');
  response=page.waitForResponse(r=>r.url()===process.env.SLICE_NATIVE_ENDPOINT&&r.request().method()==='POST');await page.locator('#shared-execute').click();const training=await (await response).json();await page.locator('#shared-save').click();
  const saved=await page.evaluate(()=>localStorage.getItem('model-lab-evidence-v1')!);const handoff=await validateScratchPath(process.cwd(),process.env.M2B_HANDOFF_DIR!);await mkdir(`${handoff}/live`,{recursive:false});await writeFile(`${handoff}/live/mlp-saved.json`,saved);
  await page.locator('#shared-world').click();await page.locator('#mlp-operation').selectOption('b2.gradient');
  const before=training.record.run.points.find((p:any)=>p.id==='b2.before').values[0],gradient=training.record.run.points.find((p:any)=>p.id==='b2.gradient').values[0],delta=training.record.run.points.find((p:any)=>p.id==='b2.delta').values[0],after=training.record.run.points.find((p:any)=>p.id==='b2.after').values[0];expect(gradient).not.toBe(0);
  await expect(page.getByTestId('mlp-before')).toHaveAttribute('data-value',String(before));await expect(page.getByTestId('mlp-gradient')).toHaveAttribute('data-value',String(gradient));await expect(page.getByTestId('mlp-delta')).toHaveAttribute('data-value',String(delta));await expect(page.getByTestId('mlp-after')).toHaveAttribute('data-value',String(after));expect(after).toBe(Math.fround(before-0.0625*gradient));
  await page.screenshot({path:`${dir}/m2-b-mlp-sgd-1920.png`});

  await page.locator('#return-canonical-world').click();await page.locator('#open-shared-inspector').click();await page.locator('#shared-model').selectOption('microgpt-multilayer-v1');await page.locator('#native-prompt').fill('wxyz!');await page.locator('#shared-execute').click();await expect(page.getByTestId('shared-status')).toContainText('receipt validated');await page.locator('#shared-world').click();
  await expect(page.locator('#mlp-operation,[data-mlp-coordinate]')).toHaveCount(0);await expect(page.locator('#spatial-layer')).toHaveValue('0');await expect(page.locator('#spatial-head')).toHaveValue('0');await expect(page.locator('.context-lens')).toBeHidden();
  await page.setViewportSize({width:1280,height:720});await page.emulateMedia({reducedMotion:'reduce'});await page.screenshot({path:`${dir}/m2-b-return-microgpt-1280.png`});
  expect(errors).toEqual([]);await writeFile(`${dir}/m2-b-live.json`,JSON.stringify({forward:['inputs','hidden.pre','hidden','prediction','squared.error','loss'],parameter:'b2[0]',before,gradient,delta,after,optimizer:'SGD',errors},null,2));
});

test('M2-B saved MLP evidence reopens in the world with the native executor disconnected',async({page,evidenceDir:dir})=>{
  test.skip(process.env.SLICE_PHASE!=='offline');
  const handoff=await validateScratchPath(process.cwd(),process.env.M2B_HANDOFF_DIR!),saved=await readFile(`${handoff}/live/mlp-saved.json`,'utf8');let requests=0;
  page.on('request',r=>{if(r.url()===process.env.SLICE_NATIVE_ENDPOINT)requests++;});await page.goto('/?presentation=spatial');await page.locator('#open-shared-inspector').click();await page.evaluate(value=>localStorage.setItem('model-lab-evidence-v1',value),saved);await page.locator('#shared-load').click();await expect(page.getByTestId('shared-provenance')).toContainText('SAVED REPLAY');await page.locator('#shared-world').click();
  await expect(page.locator('.spatial-badge')).toContainText('SAVED REPLAY');await page.locator('#mlp-operation').selectOption('b2.gradient');await expect(page.getByTestId('mlp-sgd-proof')).toContainText('matches recorded after');
  await page.setViewportSize({width:1280,height:720});await page.emulateMedia({reducedMotion:'reduce'});await page.screenshot({path:`${dir}/m2-b-mlp-replay-1280.png`});expect(requests).toBe(0);await writeFile(`${dir}/m2-b-offline.json`,JSON.stringify({nativeRequests:requests,replay:true}));
});
