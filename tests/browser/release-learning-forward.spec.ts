import {test,expect,evidenceDirectory} from '../support/browser-evidence.js';
import {writeFile} from 'node:fs/promises';

for(const size of [{name:'desktop',width:1920,height:1080,reduce:false},{name:'compact',width:1280,height:720,reduce:true},{name:'mobile',width:390,height:844,reduce:true}]) {
  test(`release forward tour · ${size.name}`,async({page})=>{
    await page.setViewportSize(size);await page.emulateMedia({reducedMotion:size.reduce?'reduce':'no-preference'});
    await page.addInitScript(()=>{
      const w=window as any;w.forwardAudit={commands:[],results:[]};const send=Worker.prototype.postMessage,seen=new WeakSet();
      Worker.prototype.postMessage=function(message:any,...rest:any[]){w.forwardAudit.commands.push(message.command);if(!seen.has(this)){seen.add(this);this.addEventListener('message',e=>{if(e.data.status==='result')w.forwardAudit.results.push(e.data.result);});}return Reflect.apply(send,this,[message,...rest]);};
    });
    const dir=await evidenceDirectory(test.info()),shell=page.locator('.spatial-shell');
    const commands=()=>page.evaluate(()=>[...(window as any).forwardAudit.commands]);
    const capture=(name:string)=>page.screenshot({path:`${dir}/${name}.png`});
    await page.goto('/?experience=learn');await page.locator('#learn-predict').click();
    await expect(shell).toHaveAttribute('data-public-canonical-state','p1_prediction_preview');
    const run=await page.getByTestId('learn-orientation').getAttribute('data-run');const before=await commands();
    const distribution=await page.locator('[data-output]').evaluateAll(rows=>rows.map(r=>r.getAttribute('data-value')));
    await page.locator('#short-continue').click();await expect(shell).toHaveAttribute('data-public-canonical-state','p1_represent');await page.locator('#short-continue').click();
    for(const [state,name] of [['p1_qkv','qkv'],['p1_attention_compare','score-arithmetic'],['p1_attention_weights','attention-weights'],['p1_value_mixture','weighted-values'],['p1_attention_integration','head-combination-residual'],['p1_transform','mlp'],['p1_score','logits'],['p1_probabilities','output'],['p1_complete','endpoint']]) {
      await expect(shell).toHaveAttribute('data-public-canonical-state',state!);
      await expect(page.getByTestId('learn-orientation')).toHaveAttribute('data-run',run!);
      await expect(page.getByTestId('learn-context')).toContainText('START → abc');
      await expect(page.locator('#short-continue, #short-teach')).toBeFocused();
      await capture(name!);
      if(state==='p1_qkv')for(const kind of ['q','k','v']) {
        await page.locator(`.learn-operation-grid [data-kind=${kind}]`).scrollIntoViewIfNeeded();await capture(`qkv-${kind}`);
      }
      const numerical = ({p1_attention_weights:'learn-attention-row',p1_value_mixture:'learn-weighted-values',p1_score:'learn-logits',p1_probabilities:'learn-distribution'} as Record<string,string>)[state!];
      if(numerical){await page.getByTestId(numerical).scrollIntoViewIfNeeded();await capture(`${name}-numbers`);}
      if(state==='p1_attention_compare'){
        const table=page.getByTestId('learn-dot');await expect(table.locator('tbody tr')).toHaveCount(4);
        const scroll=table.locator('..');await scroll.focus();await page.keyboard.press('End');
        await scroll.evaluate(el=>{el.scrollLeft=el.scrollWidth;});await capture('score-products-horizontal');
        await scroll.evaluate(el=>{el.scrollLeft=0;});
      }
      if(state==='p1_attention_compare') {
        await expect(page.locator('[data-testid="learn-positions"] [data-eligible=true]')).toHaveCount(4);
        await expect(page.locator('[data-testid="learn-positions"] [data-eligible=false]')).toHaveText('p4 · a · future · excluded; no score coordinate');
        await page.getByTestId('learn-score-arithmetic').scrollIntoViewIfNeeded();await capture('score-complete');
        await page.locator('.learn-check summary').click();await page.locator('#learn-check-future').click();await expect(page.getByTestId('learn-feedback')).toContainText('not an observed zero');await expect(page.locator('#learn-check-future')).toBeFocused();
        await page.locator('#learn-check-importance').click();await expect(page.getByTestId('learn-feedback')).toContainText('do not establish');
        await page.locator('#learn-check-positions').click();await expect(page.getByTestId('learn-feedback')).toContainText('not possible output');
      }
      if(state==='p1_attention_integration'){await page.getByTestId('learn-attention-residual').scrollIntoViewIfNeeded();await capture('residual-source');}
      if(state==='p1_transform'){
        await page.getByText('Every component before and after ReLU',{exact:true}).click();await page.getByTestId('learn-relu').scrollIntoViewIfNeeded();await capture('relu');
        await page.getByTestId('learn-mlp-residual').scrollIntoViewIfNeeded();await capture('mlp-residual');
      }
      if(state==='p1_attention_weights'||state==='p1_probabilities') {
        for(const depth of ['values','math','source']){
          if(depth==='values')await page.locator('#dock-inspect').click();else await page.locator(`[data-dock-depth=${depth}]`).click();
          await expect(page.getByTestId('selected-world-object')).toHaveAttribute('data-run-id',run!);await capture(`${name}-${depth}`);
        }
        await page.locator('#dock-inspect').click();await expect(page.locator('#dock-inspect')).toBeFocused();
        await page.locator('#visitor-explore-toggle').click();await page.locator('#zoom-in').click();
        await expect(shell).toHaveAttribute('data-public-navigation-mode','explore');await capture(`${name}-explore`);
        await page.locator('#visitor-explore-toggle').click();await expect(page.locator('#visitor-explore-toggle')).toBeFocused();
        await expect(page.getByTestId('learn-orientation')).toHaveAttribute('data-run',run!);
      }
      const dockBox=(await page.getByTestId('contextual-dock').boundingBox())!, evidenceBox=(await page.locator('#open-shared-inspector').boundingBox())!;
      expect(dockBox.y+dockBox.height).toBeLessThanOrEqual(evidenceBox.y);
      expect(await commands()).toEqual(before);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      for(const id of ['dock-inspect','visitor-explore-toggle',state==='p1_complete'?'short-teach':'short-continue']) {
        const b=(await page.locator(`#${id}`).boundingBox())!;expect(b.height).toBeGreaterThanOrEqual(44);expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(size.width);expect(b.y+b.height).toBeLessThanOrEqual(size.height);
      }
      if(state!=='p1_complete')await page.locator('#short-continue').click();
    }
    expect(await page.locator('[data-output]').evaluateAll(rows=>rows.map(r=>r.getAttribute('data-value')))).toEqual(distribution);
    await expect(page.getByTestId('learn-endpoint')).toContainText('No output was sampled');
    await page.locator('.learn-check summary').click();await page.locator('#learn-check-outputs').click();await expect(page.getByTestId('learn-feedback')).toContainText('eligible positions');
    await page.locator('#learn-check-sample').click();await expect(page.getByTestId('learn-feedback')).toContainText('No token was sampled');
    await page.locator('#learn-workbench').click();await page.locator('#presentation-toggle').click();await expect(page.locator('.instrument-header')).toBeVisible();await page.locator('#learn-workbench').click();
    await expect(shell).toHaveAttribute('data-public-canonical-state','p1_complete');expect(await commands()).toEqual(before);
    await page.locator('#document').fill('ab');await page.locator('#document').dispatchEvent('change');
    await expect(page.locator('#short-teach')).toBeDisabled();await expect(page.getByTestId('learn-handoff-refusal')).toContainText('edited input differs');
    await page.locator('#short-teach').dispatchEvent('click');await expect(page.getByRole('alert')).toContainText('retained prediction must match');
    expect(await commands()).toEqual(before);
    await page.locator('#document').fill('abca');await page.locator('#document').dispatchEvent('change');await expect(page.locator('#short-teach')).toBeEnabled();
    await expect(page.locator('#short-teach')).toHaveText('Start learning computation · propose one update');await page.locator('#short-teach').click();
    await expect(shell).toHaveAttribute('data-public-canonical-state','p2_objective');await expect(page.locator('#learn-workbench')).toBeDisabled();
    expect((await commands()).length).toBeGreaterThan(before.length);
    await page.locator('#learn-cancel-work').click();await expect(page.locator('#learn-workbench')).toBeEnabled();
    await writeFile(`${dir}/audit.json`,JSON.stringify(await page.evaluate(()=>(window as any).forwardAudit),null,2),{flag:'wx'});
  });
}

// This separate control includes intentionally paced native objective/backward/
// candidate computation, unlike the explanation-only routes above.
test('release handoff retains unresolved candidate restrictions until explicit discard',async({page})=>{
  test.setTimeout(90_000);
  const shell=page.locator('.spatial-shell');
  await page.goto('/?experience=learn');await page.locator('#learn-predict').click();
  await expect(shell).toHaveAttribute('data-public-canonical-state','p1_prediction_preview');
  for(let i=0;i<10;i++)await page.locator('#short-continue').click();
  await expect(shell).toHaveAttribute('data-public-canonical-state','p1_complete');
  await page.locator('#short-teach').click();await expect(shell).toHaveAttribute('data-public-canonical-state','p2_objective');
  for(const state of ['p2_backward_trace','p2_gradient_contribution','p2_final_gradient','p2_adam_proposal','candidate_ready']) {
    await page.locator('#reverse-continue').click();await expect(shell).toHaveAttribute('data-public-canonical-state',state,{timeout:30_000});
  }
  await expect(page.locator('#learn-workbench')).toBeDisabled();
  await expect(page.locator('#learn-cancel-work')).toHaveText('Discard candidate');
  await expect(shell).toHaveAttribute('data-public-outcome','');
  await page.screenshot({path:`${await evidenceDirectory(test.info())}/unresolved-candidate.png`});
  await page.locator('#learn-cancel-work').click();await expect(page.locator('#learn-workbench')).toBeEnabled();
  await expect(shell).toHaveAttribute('data-public-outcome','discarded');
});
