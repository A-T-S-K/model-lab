import {test,expect,evidenceDirectory} from '../support/browser-evidence.js';
import {writeFile} from 'node:fs/promises';

for(const size of [{name:'desktop',width:1920,height:1080,reduce:false,decision:'accept'},{name:'compact',width:1280,height:720,reduce:true,decision:'discard'},{name:'mobile',width:390,height:844,reduce:true,decision:'discard'}])test(`release training chapter · ${size.name} · ${size.decision}`,async({page})=>{
  test.setTimeout(120_000);
  await page.setViewportSize(size);await page.emulateMedia({reducedMotion:size.reduce?'reduce':'no-preference'});
  await page.addInitScript(()=>{
    const w=window as any;w.trainingAudit={commands:[],progress:null,results:[]};const post=Worker.prototype.postMessage,seen=new WeakSet();
    Worker.prototype.postMessage=function(message:any,...rest:any[]){w.trainingAudit.commands.push(message.command);if(!seen.has(this)){seen.add(this);this.addEventListener('message',e=>{if(e.data.status==='forward')w.trainingAudit.progress=e.data.progress;if(e.data.status==='result')w.trainingAudit.results.push(e.data.result);});}return Reflect.apply(post,this,[message,...rest]);};
  });
  const dir=await evidenceDirectory(test.info()),shell=page.locator('.spatial-shell');
  const capture=(name:string)=>page.screenshot({path:`${dir}/${name}.png`});
  const audit=()=>page.evaluate(()=>{const a=(window as any).trainingAudit;return {commands:[...a.commands],pin:a.progress?.training?.pin,candidate:a.progress?.training?.candidateId,step:a.progress?.training?.acceptedStep};});
  await page.goto('/?experience=learn');await page.locator('#learn-predict').click();await expect(shell).toHaveAttribute('data-public-canonical-state','p1_prediction_preview');
  for(let i=0;i<10;i++)await page.locator('#short-continue').click();await page.locator('#short-teach').click();
  for(const state of ['p2_objective','p2_backward_trace','p2_gradient_contribution','p2_final_gradient','p2_adam_proposal','candidate_ready']){
    await expect(shell).toHaveAttribute('data-public-canonical-state',state,{timeout:30_000});
    await expect(page.locator('#reverse-continue, #execution-accept').first()).toBeEnabled({timeout:30_000});
    await expect(page.getByTestId('learn-orientation')).toContainText('accepted model unchanged');
    await capture(state);
    await page.locator('.learn-bound-result').first().scrollIntoViewIfNeeded();await capture(`${state}-result`);
    const before=await audit();
    await page.locator('#dock-inspect').focus();await page.keyboard.press('Enter');await expect(shell).toHaveAttribute('data-public-navigation-mode','detail');
    for(const depth of ['values','math','source']) {
      if(depth!=='values')await page.locator(`[data-dock-depth=${depth}]`).first().click();await expect(page.getByTestId(`dock-${depth}`)).toBeVisible();
      await page.locator('.learn-exact summary').click();await expect(page.getByTestId('learn-exact-values')).toBeVisible();await capture(`${state}-${depth}`);await page.locator('.learn-exact summary').click();
      if(depth==='source'){if(!await page.locator('.source pre').first().isVisible())await page.locator('.source summary').first().click();await page.locator('.source pre').first().scrollIntoViewIfNeeded();await capture(`${state}-native-source`);}
    }
    if(state==='p2_objective'){
      await page.locator('[data-dock-depth=values]').first().click();await page.locator('[data-training-objective-position="0"]').click();await expect(page.getByTestId('detail-selection-scope')).toContainText('render only');
    }
    await page.locator('#dock-inspect').click();await expect(page.locator('#dock-inspect')).toBeFocused();
    expect(await audit()).toEqual(before);await expect(page.locator('#learn-workbench')).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const id of ['dock-inspect',state==='candidate_ready'?'execution-accept':'reverse-continue']){
      const box=(await page.locator(`#${id}`).boundingBox())!;expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(size.width);expect(box.y+box.height).toBeLessThanOrEqual(size.height);
    }
    if(state==='p2_objective')await expect(page.getByTestId('learn-objective-scope')).toContainText('p4 → END');
    if(state==='p2_adam_proposal')await expect(page.getByTestId('adam-guided-inputs')).toBeHidden();
    if(state==='p2_gradient_contribution')await expect(page.getByTestId('learn-contribution-result')).toContainText('partial accumulation');
    if(state==='candidate_ready') {
      const t=await page.evaluate(()=>(window as any).trainingAudit.progress.training);
      const rows=page.getByTestId('learn-candidate-result').locator('[data-value]');
      const artifact=(run:any)=>run.artifacts.find((a:any)=>a.kind==='probabilities'&&a.concept.token===3).values[0];
      await expect(rows.nth(0)).toHaveAttribute('data-value',String(artifact(t.readyOutputs.before)));await expect(rows.nth(1)).toHaveAttribute('data-value',String(artifact(t.readyOutputs.after)));
      await page.locator('.learn-check summary').click();await page.locator('#learn-check-update').click();await expect(page.getByTestId('learn-feedback')).toContainText('not the applied update');await expect(page.locator('#learn-check-update')).toBeFocused();
      expect(await audit()).toEqual(before);
    } else await page.locator('#reverse-continue').click();
  }
  await page.locator(size.decision==='accept'?'#execution-accept':'#execution-cancel').click();
  await expect(shell).toHaveAttribute('data-public-canonical-state','tour_complete');await expect(shell).toHaveAttribute('data-public-outcome',size.decision==='accept'?'accepted':'discarded');
  await expect(page.getByTestId('learn-completion')).toContainText(size.decision==='accept'?'Acceptance succeeded':'Discard succeeded');await capture('resolved');
  const resolved=await audit();await page.locator('#dock-inspect').click();await page.locator('[data-dock-depth=source]').first().click();await expect(page.getByTestId('learn-resolved-evidence')).toContainText('Decision succeeded');await capture('resolved-source');await page.locator('#dock-inspect').click();
  await page.locator('#visitor-explore-toggle').click();await expect(shell).toHaveAttribute('data-public-navigation-mode','explore');await page.locator('#zoom-in').click();await capture('explore');await page.locator('#visitor-explore-toggle').click();await capture('return');
  await page.locator('#learn-workbench').click();await page.locator('#presentation-toggle').click();await page.locator('#learn-workbench').click();await expect(shell).toHaveAttribute('data-public-canonical-state','tour_complete');expect(await audit()).toEqual(resolved);
  if(size.decision==='accept'){const accepted=await page.evaluate(()=>(window as any).trainingAudit.results.at(-1).run.manifest.runId);await expect(page.getByTestId('landmark-occurrence')).toHaveAttribute('data-run-id',accepted);
    // The lesson retains its decision evidence after later explicit workbench training.
    await page.locator('#learn-workbench').click();await page.locator('#spatial-learn').click();await expect(page.locator('#learn-workbench')).toBeEnabled();
    await expect.poll(()=>page.evaluate(()=>(window as any).trainingAudit.results.at(-1).trainingStep)).toBe(2);
    const afterTraining=await audit();await page.locator('#learn-workbench').click();await expect(page.getByTestId('learn-orientation')).toContainText('recorded decision');await expect(page.getByTestId('learn-completion')).toContainText('current accepted state');expect(await audit()).toEqual(afterTraining);
    await capture('historical-decision-after-training');await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
    expect(await page.evaluate(()=>(window as any).trainingAudit.results.at(-1).trainingStep)).toBe(2);
  }
  await writeFile(`${dir}/audit.json`,JSON.stringify(await page.evaluate(()=>(window as any).trainingAudit),null,2),{flag:'wx'});
});

test('release chapter cancellation and reset preserve the authoritative accepted boundary',async({page})=>{
  const dir=await evidenceDirectory(test.info());
  await page.goto('/?experience=learn');await page.locator('#learn-predict').click();await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state','p1_prediction_preview');
  for(let i=0;i<10;i++)await page.locator('#short-continue').click();await page.locator('#short-teach').click();await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state','p2_objective');
  await page.locator('#learn-cancel-work').click();await expect(page.locator('#learn-workbench')).toBeEnabled();await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-outcome','');
  await expect(page.getByTestId('status')).toContainText('cancel');await page.screenshot({path:`${dir}/cancelled.png`});
  await page.locator('#clear-session').click();await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state','cold');await page.screenshot({path:`${dir}/reset.png`});
});

test('release acceptance remains accepted after persistent archival failure and refuses further mutation',async({page})=>{
  test.setTimeout(90_000);
  await page.addInitScript(()=>{
    const w=window as any;w.retentionAudit={fail:false,commands:[],accepted:null};const digest=crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest=(...args:Parameters<SubtleCrypto['digest']>)=>w.retentionAudit.fail?Promise.reject(new Error('Controlled chapter retention failure')):digest(...args);
    const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m:any,...rest:any[]){w.retentionAudit.commands.push(m.command);return Reflect.apply(post,this,[m,...rest]);};
    const descriptor=Object.getOwnPropertyDescriptor(Worker.prototype,'onmessage')!;
    Object.defineProperty(Worker.prototype,'onmessage',{configurable:true,get:descriptor.get,set(handler:(e:MessageEvent)=>void){descriptor.set!.call(this,(e:MessageEvent)=>{handler(e);if(e.data.status==='result'&&e.data.result.learn){w.retentionAudit.accepted=e.data.result;w.retentionAudit.fail=true;}});}});
  });
  await page.goto('/?experience=learn');await page.locator('#learn-predict').click();await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state','p1_prediction_preview');
  for(let i=0;i<10;i++)await page.locator('#short-continue').click();await page.locator('#short-teach').click();
  for(const state of ['p2_backward_trace','p2_gradient_contribution','p2_final_gradient','p2_adam_proposal','candidate_ready']){await page.locator('#reverse-continue').click();await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state',state,{timeout:30_000});}
  await page.locator('#execution-accept').click();await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-outcome','accepted');await expect(page.getByRole('alert')).toContainText('Controlled chapter retention failure');await expect(page.getByTestId('status')).toContainText('Accepted update');
  await expect(page.getByTestId('learn-completion')).toContainText('Acceptance succeeded');const dir=await evidenceDirectory(test.info());await page.screenshot({path:`${dir}/accepted-retention-failed.png`});
  const before=await page.evaluate(()=>[...(window as any).retentionAudit.commands]);await page.locator('#predict').click();await expect(page.getByRole('alert')).toContainText('Accepted update evidence is not retained');expect(await page.evaluate(()=>(window as any).retentionAudit.commands)).toEqual(before);await page.screenshot({path:`${dir}/mutation-refused.png`});
  await writeFile(`${dir}/retention.json`,JSON.stringify(await page.evaluate(()=>(window as any).retentionAudit),null,2),{flag:'wx'});
});
