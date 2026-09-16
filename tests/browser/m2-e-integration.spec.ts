import {test,expect} from '../support/browser-evidence.js';
import {writeFile} from 'node:fs/promises';

const recordings=process.env.WITNESS_RECORDING_DIR;
const mlpReplay=process.env.M2E_MLP_REPLAY;
const pythiaReplay=process.env.M2E_PYTHIA_REPLAY;

async function importRecording(page:import('@playwright/test').Page,path:string){
  await page.locator('#open-shared-inspector').click();
  await page.locator('#shared-import').setInputFiles(path);
  await expect(page.getByTestId('shared-status')).toContainText('Saved replay loaded');
  await page.locator('#shared-world').click();
}

test('M2-E cross-world switching preserves canonical state and keeps replay inert',async({page,evidenceDir:dir})=>{
  test.skip(!recordings||!mlpReplay||!pythiaReplay,'qualified retained M2 evidence required');
  test.setTimeout(90_000);
  const witnessDir=recordings!,mlpPath=mlpReplay!,pythiaPath=pythiaReplay!;
  const errors:string[]=[];let nativeRequests=0;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('/execute'))nativeRequests++;});
  await page.addInitScript(()=>{
    const w=window as any;w.m2eWorkerRequests=0;const send=Worker.prototype.postMessage;
    Worker.prototype.postMessage=function(message:any,...args:any[]){if(message?.integration==='microgpt-multilayer-v1')w.m2eWorkerRequests++;return Reflect.apply(send,this,[message,...args]);};
  });

  await page.setViewportSize({width:1920,height:1080});await page.goto('/?presentation=spatial');
  await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#spatial-learn').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');const canonicalExperiment=await page.locator('#spatial-experiment').inputValue();expect(canonicalExperiment).not.toBe('');
  await page.locator('button[data-learning-stage="gradient"]').first().click();await page.locator('#learning-inspect-gradient').click();await expect(page.getByTestId('contribution-accounting')).toBeVisible();await page.screenshot({path:`${dir}/m2-e-canonical-learning-1920.png`});await page.locator('#spatial-current').click();
  await page.screenshot({path:`${dir}/m2-e-canonical-overview-1920.png`});

  await page.locator('#open-shared-inspector').click();await page.locator('#shared-model').selectOption('microgpt-multilayer-v1');await page.locator('#native-prompt').fill('wxyz!');await page.locator('#shared-execute').click();await expect(page.getByTestId('shared-status')).toContainText('receipt validated');await page.locator('#shared-save').click();
  const multilayerSaved=await page.evaluate(()=>localStorage.getItem('model-lab-evidence-v1')!);
  await page.locator('#shared-world').click();await page.locator('#spatial-layer').selectOption('1');await page.locator('#spatial-head').selectOption('2');await page.locator('#spatial-query').selectOption('5');await page.locator('#spatial-operation').selectOption('headOutput');
  await expect(page.getByTestId('forward-artifact')).toHaveText('position.5/layer.1/headOutput/head.2');await page.screenshot({path:`${dir}/m2-e-multilayer-selected-1920.png`});await page.locator('#return-canonical-world').click();

  await importRecording(page,mlpPath);await expect(page.locator('.mlp-shell')).toBeVisible();await page.locator('#mlp-operation').selectOption('b2.gradient');await expect(page.getByTestId('forward-artifact')).toHaveText('b2.gradient');await page.screenshot({path:`${dir}/m2-e-mlp-sgd-1920.png`});
  await page.locator('#spatial-home').click();await expect(page.getByTestId('forward-artifact')).toHaveText('inputs');await expect(page.locator('#spatial-home')).toBeFocused();await page.locator('#return-canonical-world').click();

  await importRecording(page,`${witnessDir}/grouped.json`);await page.locator('[data-fallback-coordinate="query_head"]').selectOption('2');await page.locator('#fallback-operation').selectOption('mapping');await expect(page.getByTestId('grouped-mapping-proof')).toHaveAttribute('data-kv-head','1');await page.locator('#return-canonical-world').click();
  await importRecording(page,`${witnessDir}/shape.json`);await page.locator('#fallback-operation').selectOption('unknown.custom');await expect(page.getByTestId('fallback-availability')).toHaveText('SHAPE ONLY');await expect(page.locator('[data-numerical-glyph]')).toHaveCount(0);await page.locator('#return-canonical-world').click();
  await importRecording(page,`${witnessDir}/opaque.json`);await page.locator('#fallback-operation').selectOption('unknown.scalar.explanation');await page.locator('#fallback-detail').click();await expect(page.getByTestId('fallback-refusal')).toContainText('unsupported');await page.screenshot({path:`${dir}/m2-e-opaque-refusal-1920.png`});await page.locator('#return-canonical-world').click();

  await importRecording(page,pythiaPath);await expect(page.locator('.pythia-overview-node[data-pythia-block]')).toHaveCount(6);await page.screenshot({path:`${dir}/m2-e-pythia-overview-1920.png`});await page.locator('#pythia-operation').selectOption('logits');await page.locator('[data-pythia-coordinate="output_index"]').fill('50303');await page.locator('[data-pythia-coordinate="output_index"]').dispatchEvent('change');await expect(page.getByTestId('pythia-selected-output')).toContainText('Exact output index 50303');await page.screenshot({path:`${dir}/m2-e-pythia-output-50303-1920.png`});await page.locator('#return-canonical-world').click();

  await expect(page.getByTestId('spatial-live-step')).toHaveText('1');await expect(page.locator('#spatial-experiment')).toHaveValue(canonicalExperiment);await expect(page.locator('#spatial-layer')).toHaveValue('0');await expect(page.locator('#execution-controls')).toHaveCount(0);
  await page.locator('#step-prediction').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence','0');await page.locator('#open-shared-inspector').click();await expect(page.locator('#shared-world')).toBeDisabled();await expect(page.locator('#shared-execute')).toBeDisabled();await page.locator('#close-shared').click();await page.locator('#execution-cancel').click();await expect(page.locator('#execution-controls')).toHaveCount(0);

  await importRecording(page,mlpPath);await expect(page.locator('.spatial-badge')).toContainText('SAVED REPLAY');await page.locator('#return-canonical-world').click();
  await importRecording(page,pythiaPath);await expect(page.locator('.spatial-badge')).toContainText('SAVED REPLAY · NO EXECUTION');await page.locator('#return-canonical-world').click();
  await page.locator('#open-shared-inspector').click();await page.evaluate(value=>localStorage.setItem('model-lab-evidence-v1',value),multilayerSaved);await page.locator('#shared-load').click();await expect(page.getByTestId('shared-provenance')).toContainText('SAVED REPLAY');const beforeReplay=await page.evaluate(()=>(window as any).m2eWorkerRequests);await page.locator('#shared-world').click();await expect(page.locator('.spatial-badge')).toContainText('SAVED REPLAY');await expect(page.locator('#spatial-layer')).toHaveValue('0');await expect(page.locator('#spatial-head')).toHaveValue('0');expect(await page.evaluate(()=>(window as any).m2eWorkerRequests)).toBe(beforeReplay);

  await page.setViewportSize({width:1280,height:720});await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#return-canonical-world').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');await expect(page.locator('#spatial-experiment')).toHaveValue(canonicalExperiment);await expect(page.locator('.context-lens')).toBeHidden();await page.screenshot({path:`${dir}/m2-e-cross-world-return-reduced-1280.png`});
  await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  expect(nativeRequests).toBe(0);expect(errors).toEqual([]);
  await writeFile(`${dir}/m2-e-integration.json`,JSON.stringify({sequence:['canonical','multilayer','mlp','grouped','shape','opaque','pythia','canonical','mlp-replay','pythia-replay','multilayer-replay'],nativeRequests,noncanonicalRequests:beforeReplay,canonicalStep:1,canonicalExperiment,reducedMotion:true,errors},null,2));
});
