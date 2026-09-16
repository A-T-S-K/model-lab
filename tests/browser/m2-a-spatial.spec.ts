import {test,expect} from '../support/browser-evidence.js';
import {writeFile} from 'node:fs/promises';

test('M2-A canonical and multilayer evidence share the topology-composed continuous world',async({page,evidenceDir:dir})=>{
  const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.log('M2-A page error:',e.stack);});
  await page.addInitScript(()=>{
    const w=window as any;w.m2Audit={noncanonicalRequests:0,envelopes:[]};const send=Worker.prototype.postMessage,seen=new WeakSet<Worker>();
    Worker.prototype.postMessage=function(message:any,...args:any[]){if(message?.integration==='microgpt-multilayer-v1')w.m2Audit.noncanonicalRequests++;
      if(!seen.has(this)){seen.add(this);this.addEventListener('message',(event:any)=>{if(event.data?.envelope?.codec==='microgpt-multilayer-v1')w.m2Audit.envelopes.push(event.data.envelope);});}
      return Reflect.apply(send,this,[message,...args]);};
  });
  await page.setViewportSize({width:1920,height:1080});await page.goto('/?presentation=spatial');await expect(page.locator('#predict')).toBeEnabled();await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await expect(page.locator('#spatial-layer option')).toHaveCount(1);await expect(page.locator('#spatial-head option')).toHaveCount(2);await page.screenshot({path:`${dir}/m2-a-canonical-overview-1920.png`});

  await page.locator('#open-shared-inspector').click();await page.locator('#shared-model').selectOption('microgpt-multilayer-v1');await page.locator('#native-prompt').fill('wxyz!');await page.locator('#shared-execute').click();await expect(page.getByTestId('shared-status')).toContainText('receipt validated');
  await page.locator('#shared-save').click();await expect(page.getByTestId('shared-status')).toContainText('Saved selected run');
  const expected=await page.evaluate(()=>{const e=(window as any).m2Audit.envelopes.at(-1);const p=e.record.run.points.find((p:any)=>p.id==='position.5/layer.1/headOutput/head.2');return {run:e.record.run.id,values:p.values,requests:(window as any).m2Audit.noncanonicalRequests};});
  await page.locator('#shared-world').click();await expect(page.locator('.world-brand')).toContainText('2 layers / 3 heads');await expect(page.locator('#spatial-layer option')).toHaveCount(2);await expect(page.locator('#spatial-head option')).toHaveCount(3);
  await page.screenshot({path:`${dir}/m2-a-multilayer-overview-1920.png`});

  await page.locator('#spatial-layer').selectOption('1');await page.locator('#spatial-query').selectOption('5');await page.locator('#spatial-head').selectOption('2');await page.locator('#spatial-operation').selectOption('headOutput');
  await expect(page.getByTestId('forward-artifact')).toHaveText('position.5/layer.1/headOutput/head.2');
  expect(await page.getByTestId('forward-elements').locator('[data-value]').evaluateAll(els=>els.map(e=>Number(e.getAttribute('data-value'))))).toEqual(expected.values);
  await expect(page.getByTestId('semantic-address')).toContainText('layer.1.headOutput.head.2');await expect(page.getByTestId('semantic-address')).toContainText(expected.run);
  await page.screenshot({path:`${dir}/m2-a-layer1-head2-position5-1920.png`});

  await page.getByTestId('upstream-choices').getByRole('button',{name:/Attention softmax · L1 · p5 \/ h2/}).click();await expect(page.getByTestId('forward-artifact')).toHaveText('position.5/layer.1/attentionProbabilities/head.2');
  await page.getByTestId('upstream-choices').getByRole('button',{name:/Attention scores · L1 · p5 \/ h2/}).click();await page.getByTestId('upstream-choices').getByRole('button',{name:/K · key · L1 · p0/}).click();await expect(page.getByTestId('forward-artifact')).toHaveText('position.0/layer.1/k');
  await page.screenshot({path:`${dir}/m2-a-causal-k-dependency-1920.png`});
  await page.locator('#spatial-operation').selectOption('headOutput');await page.getByTestId('upstream-choices').getByRole('button',{name:/V · value · L1 · p0/}).click();await expect(page.getByTestId('forward-artifact')).toHaveText('position.0/layer.1/v');

  await page.locator('#spatial-operation').selectOption('preAttentionNorm');await page.getByTestId('upstream-choices').getByRole('button',{name:/MLP residual · L0 · p5/}).click();await expect(page.getByTestId('forward-artifact')).toHaveText('position.5/layer.0/mlpResidual');
  await page.locator('#spatial-layer').selectOption('1');await page.locator('#spatial-operation').selectOption('q');await page.getByTestId('upstream-choices').getByRole('button',{name:/layer1\.attn_wq/}).click();await expect(page.locator('.context-lens')).toContainText('layer1.attn_wq');await expect(page.locator('.context-lens')).toContainText('pinned-source-derived');
  await page.screenshot({path:`${dir}/m2-a-layer1-parameter-owner-1920.png`});
  await page.locator('#spatial-back').click();await page.locator('#spatial-home').click();await page.locator('#spatial-focus').click();

  await page.locator('#open-shared-inspector').click();await page.locator('#shared-model').selectOption('microgpt-multilayer-v1');await page.locator('#native-prompt').fill('wxyz!');await page.locator('#shared-execute').click();await expect(page.getByTestId('shared-status')).toContainText('receipt validated');await page.locator('#shared-world').click();
  await expect(page.locator('.context-lens')).toBeHidden();await expect(page.locator('[data-world-parameter][aria-pressed="true"]')).toHaveCount(0);await expect(page.getByTestId('spatial-run')).not.toHaveText(expected.run);

  await page.locator('#return-canonical-world').click();await expect(page.locator('#spatial-layer')).toHaveValue('0');await expect(page.locator('#spatial-head')).toHaveValue('0');await expect(page.locator('#spatial-layer option')).toHaveCount(1);await expect(page.locator('.context-lens')).toBeHidden();await page.screenshot({path:`${dir}/m2-a-return-canonical-1920.png`});

  await page.locator('#open-shared-inspector').click();await page.locator('#shared-load').click();await expect(page.getByTestId('shared-provenance')).toContainText('SAVED REPLAY');const before=await page.evaluate(()=>(window as any).m2Audit.noncanonicalRequests);await page.locator('#shared-world').click();await expect(page.locator('.spatial-badge')).toContainText('SAVED REPLAY');expect(await page.evaluate(()=>(window as any).m2Audit.noncanonicalRequests)).toBe(before);
  await page.setViewportSize({width:1280,height:720});await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#spatial-layer').selectOption('1');await page.locator('#spatial-query').selectOption('5');await page.locator('#spatial-head').selectOption('2');await page.locator('#spatial-operation').selectOption('headOutput');await page.screenshot({path:`${dir}/m2-a-replay-selected-1280.png`});
  expect(errors).toEqual([]);await writeFile(`${dir}/m2-a-browser-evidence.json`,JSON.stringify({witness:'position.5/layer.1/headOutput/head.2',values:expected.values,run:expected.run,noncanonicalExecutions:before,savedReplayAdditionalExecutions:0,errors},null,2));
});
