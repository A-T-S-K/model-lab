import {test, expect, evidenceDirectory} from '../support/browser-evidence.js';
import {writeFile} from 'node:fs/promises';

for (const size of [{name:'desktop',width:1920,height:1080,reduce:false},{name:'compact',width:1280,height:720,reduce:true},{name:'mobile',width:390,height:844,reduce:true}]) {
  test(`release learning introduction · ${size.name}`, async ({page}) => {
    await page.setViewportSize(size); await page.emulateMedia({reducedMotion:size.reduce?'reduce':'no-preference'});
    await page.addInitScript(() => {
      const w=window as any; w.learnAudit={commands:[],results:[]};
      const send=Worker.prototype.postMessage,seen=new WeakSet();
      Worker.prototype.postMessage=function(message:any,...rest:any[]) {
        w.learnAudit.commands.push(message.command);
        if(!seen.has(this)) {seen.add(this);this.addEventListener('message', event=>{if(event.data.status==='result')w.learnAudit.results.push(event.data.result);});}
        return Reflect.apply(send,this,[message,...rest]);
      };
    });
    const dir=await evidenceDirectory(test.info());
    const capture=(name:string)=>page.screenshot({path:`${dir}/${name}.png`});
    const audit=()=>page.evaluate(()=>JSON.parse(JSON.stringify((window as any).learnAudit)));
    const commands=()=>page.evaluate(()=>[...(window as any).learnAudit.commands]);
    const shell=page.locator('.spatial-shell');
    await page.goto('/?experience=learn');
    await expect(page.locator('#learn-predict')).toBeEnabled();
    await expect(shell).toHaveAttribute('data-experience-profile','workbench');
    await expect(page.getByTestId('learn-orientation')).toContainText('Recorded replay');
    await capture('opening');
    await page.locator('#learn-expand-world').click(); await expect(page.locator('#spatial-world')).not.toHaveClass(/learn-collapsed-world/);
    await page.locator('#learn-expand-world').click(); await expect(page.locator('#spatial-world')).toHaveClass(/learn-collapsed-world/);
    const initial=await commands(); const replay=await page.getByTestId('learn-orientation').getAttribute('data-run');
    // Direct exploration and returning are available before a fresh prediction.
    await page.locator('#visitor-explore-toggle').click();
    await expect(shell).toHaveAttribute('data-public-navigation-mode','explore');
    await page.locator('#zoom-in').click(); await capture('opening-explore');
    await page.locator('#visitor-explore-toggle').click();
    await expect(page.locator('#visitor-explore-toggle')).toBeFocused();
    expect(await commands()).toEqual(initial);
    await page.locator('#learn-predict').focus();await page.keyboard.press('Enter');
    await expect(shell).toHaveAttribute('data-public-canonical-state','p1_prediction_preview');
    await expect(page.locator('#short-continue')).toBeFocused();
    await expect(page.getByTestId('learn-orientation')).toContainText('Fresh completed');
    const run=await page.getByTestId('learn-orientation').getAttribute('data-run'); expect(run).not.toBe(replay);
    const after=await audit();const result=after.results.at(-1); const p=result.probabilities[3];
    await expect(page.getByTestId('learn-example')).toHaveText('abca');await expect(page.getByTestId('learn-prefix')).toHaveText('START → abc');
    await expect(page.getByTestId('learn-target')).toHaveText('a');
    const predicted=p.reduce((b:number,x:number,i:number)=>x>p[b]?i:b,0);
    await expect(page.getByTestId('learn-predicted')).toHaveText(predicted===3?'END':['a','b','c'][predicted]!);
    await expect(page.locator('[data-output]')).toHaveCount(4);
    for(let i=0;i<p.length;i++)await expect(page.locator(`[data-output="${i}"]`)).toHaveAttribute('data-value',String(p[i]));
    await capture('prediction');
    await page.getByTestId('learn-distribution').scrollIntoViewIfNeeded();await capture('prediction-table');
    await page.locator('.learn-check summary').click();await page.locator('#learn-check-guarantee').click();
    await expect(page.getByTestId('learn-feedback')).toContainText('no guarantee');
    await page.locator('#learn-check-train').click();await expect(page.getByTestId('learn-feedback')).toContainText('did not train');
    await page.locator('#learn-check-next').click();await expect(page.getByTestId('learn-feedback')).toContainText('abc');
    await page.locator('#short-continue').click();
    await expect(shell).toHaveAttribute('data-public-canonical-state','p1_represent');
    await expect(page.getByTestId('learn-token-id')).toHaveText('2');
    for(const kind of ['tokenEmbedding','positionEmbedding','embeddingSum','embeddingNorm','preAttentionNorm']) {
      const artifact=result.run.artifacts.find((a:any)=>a.kind===kind&&a.concept.token===3);
      await expect(page.locator(`[data-testid="learn-representation-member"][data-kind="${kind}"]`)).toHaveAttribute('data-artifact',artifact.id);
      await expect(page.locator(`[data-kind="${kind}"] code`)).toHaveAttribute('data-value',String(artifact.values[0]));
    }
    await capture('representation');
    await page.locator('[data-kind="preAttentionNorm"][data-testid="learn-representation-member"]').scrollIntoViewIfNeeded();await capture('representation-values');
    const navigation=await commands();
    await page.locator('#dock-inspect').focus();await page.keyboard.press('Enter');
    await expect(shell).toHaveAttribute('data-public-navigation-mode','detail');
    await page.locator('[data-depth-member="tokenEmbedding"]:not([data-depth-element])').click();
    await expect(page.getByTestId('detail-selection-scope')).toContainText('Temporary detail selection');
    for(const depth of ['values','math','source']) {
      if(depth!=='values') await page.locator(`[data-dock-depth="${depth}"]`).click();
      await capture(depth);await expect(page.getByTestId('selected-world-object')).toHaveAttribute('data-run-id',run!);
    }
    await page.locator('#dock-inspect').click();await expect(page.locator('#dock-inspect')).toBeFocused();
    await page.locator('#visitor-explore-toggle').click();await page.locator('#zoom-in').click();
    await capture('explore');await expect(shell).toHaveAttribute('data-public-navigation-mode','explore');
    await page.locator('#visitor-explore-toggle').click();await capture('resumed');
    await expect(page.getByTestId('learn-orientation')).toHaveAttribute('data-run',run!);
    expect(await commands()).toEqual(navigation);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for (const id of ['dock-inspect','visitor-explore-toggle','short-continue']) {
      const box=(await page.locator(`#${id}`).boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(size.width);
    }
    // Same session, expert capabilities; returning restores the retained lesson run.
    await page.locator('#learn-workbench').click();await expect(shell).toHaveAttribute('data-release-learning','false');
    await expect(page.locator('#step-learning')).toBeVisible();
    await page.locator('#presentation-toggle').click();
    await expect(page.locator('.instrument-header')).toBeVisible();
    await expect(page.locator('#learn-workbench')).toBeVisible();
    expect(await commands()).toEqual(navigation);
    await page.locator('#learn-workbench').click();await expect(shell).toHaveAttribute('data-release-learning','true');
    expect(await commands()).toEqual(navigation);
    await page.locator('#document').fill('ab');await page.locator('#document').dispatchEvent('change');
    await expect(page.locator('.learn-stale')).toContainText('still shows recorded abca');
    expect(await commands()).toEqual(navigation);
    await page.locator('#predict').click();await expect(page.getByTestId('learn-orientation')).toContainText('Fresh completed');
    await expect(page.getByTestId('dock-body')).toContainText('no lesson occurrence p3');
    await page.locator('#document').fill('z');await page.locator('#document').dispatchEvent('change');await page.locator('#predict').click();
    await expect(page.getByRole('alert')).toBeVisible();
    await writeFile(`${dir}/audit.json`,JSON.stringify(await audit(),null,2),{flag:'wx'});
  });
}

test('release entry leaves explicit legacy routes and deployment policies intact', async ({page})=>{
  for(const route of ['/?presentation=spatial','/?presentation=spatial&kiosk=1','/?presentation=spatial&kiosk=1&facilitator=1','/?presentation=spatial&demo=1']) {
    await page.goto(route);await expect(page.locator('.spatial-shell')).toHaveAttribute('data-release-learning','false');
    await expect(page.locator('#learn-predict')).toHaveCount(0);
  }
  for(const route of ['/','/?presentation=classic&experience=learn']) {
    await page.goto(route); await expect(page.locator('.instrument-header')).toBeVisible(); await expect(page.locator('#learn-predict')).toHaveCount(0);
  }
});

test('release activity refuses navigation during explicit runtime work and restores retained lesson after cancellation',async({page})=>{
  await page.goto('/?experience=learn');await page.locator('#learn-predict').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state','p1_prediction_preview');
  const run=await page.getByTestId('learn-orientation').getAttribute('data-run');
  await page.locator('#learn-workbench').click();await page.locator('#step-learning').click();
  await expect(page.locator('#execution-next')).toBeVisible();
  await expect(page.locator('#learn-workbench')).toBeDisabled();
  await expect(page.locator('#presentation-toggle')).toBeDisabled();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-release-learning','false');
  await page.locator('#execution-cancel').click();await expect(page.locator('#learn-workbench')).toBeEnabled();
  await page.locator('#learn-workbench').click();
  await expect(page.getByTestId('learn-orientation')).toHaveAttribute('data-run',run!);
  await expect(page.getByTestId('status')).toContainText('no execution requested');
});

test('introductory representation hands off to the existing attention lesson in the same computation',async({page})=>{
  await page.goto('/?experience=learn');await page.locator('#learn-predict').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state','p1_prediction_preview');
  const run=await page.getByTestId('learn-orientation').getAttribute('data-run');
  await page.locator('#short-continue').click();await page.locator('#short-continue').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state','p1_qkv');
  await expect(page.getByTestId('selected-world-object')).toHaveAttribute('data-run-id',run!);
  await expect(page.locator('#dock-inspect')).toBeVisible();
  // Later curriculum is preserved. Its explicitly requested learning still uses the controller.
  for(let i=0;i<8;i++)await page.locator('#short-continue').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state','p1_complete');
  await page.locator('#short-teach').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state','p2_objective');
  await expect(page.locator('#learn-workbench')).toBeDisabled();
  await page.locator('#learn-cancel-work').click();await expect(page.locator('#learn-workbench')).toBeEnabled();
});

test('return from existing multilayer world restores canonical lesson and accepted state without execution',async({page})=>{
  await page.addInitScript(()=>{
    const w=window as any;w.returnAudit={commands:[],results:[]};const send=Worker.prototype.postMessage,seen=new WeakSet();
    Worker.prototype.postMessage=function(message:any,...rest:any[]){w.returnAudit.commands.push(message.command);if(!seen.has(this)){seen.add(this);this.addEventListener('message',e=>{if(e.data.status==='result')w.returnAudit.results.push(e.data.result);});}return Reflect.apply(send,this,[message,...rest]);};
  });
  await page.goto('/?experience=learn');await page.locator('#learn-predict').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state','p1_prediction_preview');
  const run=await page.getByTestId('learn-orientation').getAttribute('data-run');const accepted=await page.evaluate(()=>(window as any).returnAudit.results.at(-1));
  await page.locator('#learn-workbench').click();await page.locator('#open-shared-inspector').click();
  await page.locator('#shared-model').selectOption('microgpt-multilayer-v1');await page.locator('#native-prompt').fill('wxyz!');
  await page.locator('#shared-execute').click();await expect(page.getByTestId('shared-status')).toContainText('receipt validated');
  await page.locator('#shared-world').click();await expect(page.locator('.world-brand')).toContainText('2 layers / 3 heads');
  const beforeReturn=await page.evaluate(()=>(window as any).returnAudit.commands);
  await page.locator('#learn-workbench').click();await expect(page.getByTestId('learn-orientation')).toHaveAttribute('data-run',run!);
  await expect(page.getByTestId('learn-distribution')).toHaveAttribute('data-run',run!);await expect(page.locator('[data-output]')).toHaveCount(4);
  expect(await page.evaluate(()=>(window as any).returnAudit.commands)).toEqual(beforeReturn);
  await page.locator('#predict').click();await expect(page.getByTestId('learn-orientation')).not.toHaveAttribute('data-run',run!);
  const after=await page.evaluate(()=>(window as any).returnAudit.results.at(-1));
  expect(after.snapshots).toEqual(accepted.snapshots);expect(after.probabilities).toEqual(accepted.probabilities);
});
