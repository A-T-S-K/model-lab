import {test,expect} from '../support/browser-evidence.js';
import {readFile,writeFile} from 'node:fs/promises';

const recordings=process.env.WITNESS_RECORDING_DIR;
const path=(name:string)=>`${recordings}/${name}.json`;
async function importFixture(page:import('@playwright/test').Page,name:string){
  await page.locator('#open-shared-inspector').click();await page.locator('#shared-import').setInputFiles(path(name));
  await expect(page.getByTestId('shared-status')).toContainText('Saved replay loaded');await page.locator('#shared-world').click();
}

test('M2-C grouped axes, shape-only and opaque evidence inhabit one truthful bounded world',async({page,evidenceDir:dir})=>{
  test.skip(!recordings,'fresh witness recordings required');const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1920,height:1080});await page.goto('/?presentation=spatial');

  await importFixture(page,'grouped');await expect(page.locator('.world-brand')).toContainText('Grouped query/KV attention');await expect(page.locator('.evidence-fallback-world [data-fallback-point]')).toHaveCount(7);
  await page.locator('[data-fallback-coordinate="query_head"]').selectOption('2');await expect(page.getByTestId('grouped-mapping-proof')).toHaveAttribute('data-query-head','2');await expect(page.getByTestId('grouped-mapping-proof')).toHaveAttribute('data-kv-head','1');
  await page.locator('#fallback-operation').selectOption('mapping');await expect(page.getByTestId('fallback-selected-value')).toHaveText('Selected exact value 1');
  await page.locator('#fallback-operation').selectOption('key');await expect(page.locator('[data-fallback-coordinate="kv_head"]')).toHaveValue('1');await expect(page.getByTestId('fallback-selected-value')).toHaveText('Selected exact value 2');
  await page.locator('[data-fallback-coordinate="key_position"]').selectOption('1');await expect(page.getByTestId('fallback-selected-value')).toHaveText('Selected exact value -1');
  await page.locator('#fallback-operation').selectOption('value');await expect(page.locator('[data-fallback-coordinate="kv_head"]')).toHaveValue('1');await page.locator('[data-fallback-coordinate="key_position"]').selectOption('0');await expect(page.getByTestId('fallback-selected-value')).toHaveText('Selected exact value 5');
  await page.locator('#fallback-operation').selectOption('scores');await expect(page.locator('[data-fallback-coordinate="query_head"]')).toHaveValue('2');await expect(page.getByTestId('fallback-selected-value')).toHaveText('Selected exact value 2.1213204860687256');
  await page.locator('[data-fallback-coordinate="key_position"]').selectOption('1');await expect(page.getByTestId('fallback-selected-value')).toHaveText('Selected exact value -0.7071067690849304');
  await page.locator('#fallback-operation').selectOption('weights');await expect(page.getByTestId('fallback-selected-value')).toHaveText('Selected exact value 0.0558072067797184');
  await page.locator('#fallback-operation').selectOption('output');await expect(page.locator('[data-fallback-coordinate="query_head"]')).toHaveValue('2');await expect(page.getByTestId('fallback-selected-value')).toHaveText('Selected exact value 5.111614227294922');
  await page.locator('[data-fallback-coordinate="value_feature"]').selectOption('1');await expect(page.getByTestId('fallback-selected-value')).toHaveText('Selected exact value 6.111614227294922');await page.getByTestId('fallback-source').locator('summary').click();await expect(page.getByTestId('fallback-source')).toContainText('research/witnesses/fixtures.py');
  await page.screenshot({path:`${dir}/m2-c-grouped-q2-kv1-1920.png`});

  await page.locator('#return-canonical-world').click();await importFixture(page,'shape');await expect(page.locator('.world-brand')).toContainText('Shape-only unknown operation');await expect(page.locator('[data-numerical-glyph]')).toHaveCount(0);await expect(page.getByTestId('fallback-shape')).toContainText('Shape [2, 3]');await expect(page.getByTestId('fallback-availability')).toHaveText('SHAPE ONLY');
  await page.locator('#fallback-operation').selectOption('unknown.custom');await expect(page.getByTestId('fallback-shape')).toContainText('Shape [2, 5]');await expect(page.locator('[data-numerical-glyph]')).toHaveCount(0);await page.locator('#fallback-detail').click();await expect(page.getByTestId('fallback-refusal')).toContainText('Only structural shape');await expect(page.getByTestId('fallback-refusal')).toContainText('not numerical execution');
  await page.screenshot({path:`${dir}/m2-c-shape-only-1920.png`});

  await page.locator('#return-canonical-world').click();await importFixture(page,'opaque');await expect(page.locator('.world-brand')).toContainText('Opaque operation boundary');await expect(page.locator('[data-relationship="evidence_boundary"]')).toHaveCount(3);
  await expect(page.getByTestId('fallback-values')).toContainText('3');await expect(page.getByTestId('fallback-values')).toContainText('4');await page.locator('#fallback-operation').selectOption('opaque.norm');await expect(page.getByTestId('fallback-availability')).toHaveText('OPAQUE');await expect(page.getByTestId('fallback-selected-value')).toContainText('no zero or placeholder');
  await page.locator('#fallback-operation').selectOption('output');await expect(page.getByTestId('fallback-selected-value')).toHaveText('Selected exact value 5');await page.locator('#fallback-operation').selectOption('unknown.scalar.explanation');await page.locator('#fallback-detail').click();await expect(page.getByTestId('fallback-refusal')).toContainText('does not support the requested evidence');await expect(page.getByTestId('fallback-refusal')).toContainText('no value is substituted');
  await page.screenshot({path:`${dir}/m2-c-opaque-unsupported-1920.png`});expect(errors).toEqual([]);
  await writeFile(`${dir}/m2-c-primary.json`,JSON.stringify({grouped:{queryHead:2,kvHead:1,score:[2.1213204860687256,-0.7071067690849304],weight:[0.9441927671432495,0.0558072067797184],output:[5.111614227294922,6.111614227294922]},shape:{input:[2,3],output:[2,5],numericalGlyphs:0},opaque:{input:[3,4],output:5,internal:'opaque',detail:'unsupported'},errors},null,2));
});

test('M2-C saved fixture replay is executor-free and switching to MicroGPT clears fallback state',async({page,evidenceDir:dir})=>{
  test.skip(!recordings,'fresh witness recordings required');let nativeRequests=0;const endpoint=process.env.SLICE_NATIVE_ENDPOINT??'http://127.0.0.1:4319/execute';page.on('request',request=>{if(request.url()===endpoint)nativeRequests++;});
  await page.goto('/?presentation=spatial');for(const name of ['grouped','shape','opaque']){
    const saved=await readFile(path(name),'utf8');await page.locator('#open-shared-inspector').click();await page.evaluate(value=>localStorage.setItem('model-lab-evidence-v1',value),saved);await page.locator('#shared-load').click();await expect(page.getByTestId('shared-provenance')).toContainText('SAVED REPLAY');await page.locator('#shared-world').click();await expect(page.locator('.spatial-badge')).toContainText(name==='shape'?'NO EXECUTION':'SAVED REPLAY');await page.locator('#return-canonical-world').click();
  }
  await page.locator('#open-shared-inspector').click();await page.locator('#shared-model').selectOption('microgpt-multilayer-v1');await page.locator('#native-prompt').fill('wxyz!');await page.locator('#shared-execute').click();await expect(page.getByTestId('shared-status')).toContainText('receipt validated');await page.locator('#shared-world').click();
  await expect(page.locator('#fallback-operation,[data-fallback-coordinate],.fallback-mapping')).toHaveCount(0);await expect(page.locator('#spatial-layer')).toHaveValue('0');await expect(page.locator('#spatial-head')).toHaveValue('0');await page.setViewportSize({width:1280,height:720});await page.emulateMedia({reducedMotion:'reduce'});await page.screenshot({path:`${dir}/m2-c-switch-microgpt-reduced-1280.png`});expect(nativeRequests).toBe(0);await writeFile(`${dir}/m2-c-replay.json`,JSON.stringify({fixtures:['grouped','shape','opaque'],nativeRequests,switch:'microgpt-multilayer-v1',fallbackControlsAfterSwitch:0,reducedMotion:true},null,2));
});
