import { test, expect, evidenceDirectory } from '../support/browser-evidence.js';
import { writeFile } from 'node:fs/promises';

for (const profile of [
  {name:'desktop', width:1920, height:1080, reduce:false, accept:false},
  {name:'compact', width:1280, height:720, reduce:false, accept:true},
  {name:'compact reduced motion', width:1280, height:720, reduce:true, accept:false},
]) {
  test(`shared context and intentional navigation · ${profile.name}`, async ({page}) => {
    test.setTimeout(120000);
    await page.setViewportSize({width:profile.width,height:profile.height});
    await page.emulateMedia({reducedMotion:profile.reduce?'reduce':'no-preference'});
    await page.addInitScript(() => {
      const w=window as any; w.navigationAudit={commands:[],progress:undefined};
      const send=Worker.prototype.postMessage; const seen=new WeakSet();
      Worker.prototype.postMessage=function(message:any,...rest:any[]) {
        w.navigationAudit.commands.push(message.command);
        if(!seen.has(this)){seen.add(this);this.addEventListener('message',event=>{
          if(event.data.status==='forward')w.navigationAudit.progress=event.data.progress;
        });}
        return Reflect.apply(send,this,[message,...rest]);
      };
    });
    const directory=await evidenceDirectory(test.info());
    const capture=async(name:string)=>page.screenshot({path:`${directory}/${name}.png`});
    const shell=page.locator('.spatial-shell');
    const mode=async(value:string)=>expect(shell).toHaveAttribute('data-public-navigation-mode',value);
    const state=async(value:string)=>expect(shell).toHaveAttribute('data-public-canonical-state',value, value.startsWith('p2_')||value==='candidate_ready'?{timeout:60000}:{});
    const audit=()=>page.evaluate(() => {
      const a=(window as any).navigationAudit;
      return {commands:[...a.commands],pin:a.progress?.training?.pin,candidate:a.progress?.training?.candidateId,acceptedStep:a.progress?.training?.acceptedStep};
    });
    const camera=()=>page.locator('#spatial-world').getAttribute('viewBox');
    const settledCamera=()=>page.evaluate(() => new Promise<string|null>(resolve=>{
      let previous:string|null=null, stable=0;
      const tick=()=>{
        const current=document.querySelector('#spatial-world')?.getAttribute('viewBox')??null;
        stable=current===previous?stable+1:0; previous=current;
        if(stable>=3)resolve(current); else requestAnimationFrame(tick);
      }; requestAnimationFrame(tick);
    }));
    const selection=()=>page.getByTestId('selected-world-object').getAttribute('data-position');
    await page.goto('/?presentation=spatial&kiosk=1');
    await page.locator('#exhibit-start').click(); await state('p1_prediction_preview');
    const initial=await audit(); const position=await selection();
    await page.locator('#dock-inspect').focus(); await page.keyboard.press('Enter'); await mode('detail');
    await expect(page.locator('[data-dock-depth="values"]').first()).toBeFocused();
    await page.locator('#dock-inspect').click(); await mode('guided'); await expect(page.locator('#dock-inspect')).toBeFocused();
    await expect.poll(audit).toEqual(initial);
    await page.locator('#visitor-explore-toggle').focus(); await page.keyboard.press('Enter'); await mode('explore');
    await expect(page.getByTestId('public-activity')).toHaveText('Explore');
    await page.locator('#zoom-in').click();
    await page.locator('[data-pan]').first().click();
    await mode('explore'); await expect.poll(audit).toEqual(initial);
    await capture('part1-explore');
    await page.locator('#visitor-explore-toggle').click(); await mode('guided');
    await expect(page.locator('#visitor-explore-toggle')).toBeFocused();
    expect(await selection()).toBe(position); await expect.poll(audit).toEqual(initial);
    await capture('part1-resumed');
    const beforeCamera=await camera();
    await page.locator('#spatial-world').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('-');
    await page.locator('#spatial-world').dispatchEvent('wheel',{deltaY:100,clientX:200,clientY:200});
    const svg=page.locator('#spatial-world');
    const box=(await svg.boundingBox())!;
    const touch=await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+80,y:box.y+80}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+130,y:box.y+100}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await touch.detach();
    await mode('guided'); await state('p1_prediction_preview');
    expect(await selection()).toBe(position); await expect.poll(audit).toEqual(initial);
    expect(await camera()).not.toBe(beforeCamera); await capture('camera-adjusted');
    for(const target of ['p1_represent','p1_qkv','p1_attention_compare','p1_attention_weights','p1_value_mixture','p1_attention_integration','p1_transform','p1_score','p1_probabilities','p1_complete']) {
      await page.locator('#short-continue').click(); await state(target);
      if(target==='p1_attention_compare') {
        const occurrence=await selection(), frame=await settledCamera(), commands=await audit();
        await page.locator('#dock-inspect').click(); await mode('detail');
        await page.locator('[data-depth-key="1"]').first().click();
        await expect(page.getByTestId('detail-selection-scope')).toContainText('Temporary detail selection');
        expect(await selection()).toBe(occurrence); expect(await camera()).toBe(frame);
        await expect.poll(audit).toEqual(commands);
        await page.locator('[data-dock-depth="source"]').click();
        await expect(page.getByTestId('detail-selection-scope')).toContainText('Temporary detail selection');
        await page.locator('#dock-inspect').click(); await mode('guided');
        expect(await selection()).toBe(occurrence); await expect.poll(audit).toEqual(commands);
      }
    }
    await page.locator('#short-teach').click(); await state('p2_objective');
    for(const target of ['p2_backward_trace','p2_gradient_contribution','p2_final_gradient','p2_adam_proposal','candidate_ready']) {
      await expect(page.locator('#reverse-continue')).toBeEnabled({timeout:60000});
      await page.locator('#reverse-continue').click(); await state(target);
    }
    await expect(page.locator('#execution-accept')).toBeEnabled({timeout:60000});
    const ready=await audit(); const worldPosition=await selection();
    const observed=await page.evaluate(() => (window as any).navigationAudit.progress.training);
    const summary=page.getByTestId('candidate-summary'); const witness=page.getByTestId('part2-numerical-witness');
    const target=(observed.readyOutputs.before.manifest.targets as number[])[3];
    for(const node of [summary,witness]) {
      await expect(node).toHaveAttribute('data-position','3'); await expect(node).toHaveAttribute('data-target',String(target));
      await expect(node).toHaveAttribute('data-baseline-run-id',observed.readyOutputs.before.manifest.runId);
      await expect(node).toHaveAttribute('data-candidate-run-id',observed.readyOutputs.after.manifest.runId);
    }
    const distribution=(run:any,p:number)=>run.artifacts.find((a:any)=>a.kind==='probabilities'&&a.concept.token===p).values as number[];
    const exact=distribution(observed.readyOutputs.after,3)[target];
    await expect(page.locator('[data-witness-field="candidate-target-probability"]')).toHaveAttribute('data-value',String(exact));
    await expect(page.locator('[data-witness-field="candidate-position-loss"]')).toHaveAttribute('data-value',String(await page.evaluate(probability=>-Math.log(probability),exact)));
    await capture('candidate-default');
    await page.locator('#dock-inspect').click(); await mode('detail');
    await expect(page.getByTestId('candidate-selection-scope')).toHaveAttribute('data-selection-scope','lesson');
    const boundCamera=await camera();
    await page.locator('[data-training-candidate-position="4"]').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('[data-training-candidate-position="4"]')).toBeFocused();
    await expect(page.getByTestId('candidate-selection-scope')).toContainText('Temporary detail selection');
    await expect(page.getByTestId('candidate-selection-scope')).toContainText('p4 target END');
    expect(await selection()).toBe(worldPosition); expect(await camera()).toBe(boundCamera);
    await page.locator('[data-dock-depth="math"]').click();
    await expect(page.getByTestId('candidate-selection-scope')).toHaveAttribute('data-position','4');
    await expect(page.locator('[data-artifact][data-source-run]')).toHaveAttribute('data-source-run',observed.readyOutputs.after.manifest.runId);
    await capture('candidate-alternative-math');
    await page.locator('[data-dock-depth="source"]').click();
    await expect(page.getByTestId('dock-source')).toContainText(observed.readyOutputs.after.manifest.runId);
    await expect(page.getByTestId('candidate-selection-scope')).toHaveAttribute('data-position','4');
    await page.getByTestId('candidate-selection-scope').scrollIntoViewIfNeeded();
    await capture('candidate-alternative-source');
    await page.locator('#dock-inspect').click(); await mode('guided');
    await expect(page.locator('#dock-inspect')).toBeFocused();
    await expect(witness).toHaveAttribute('data-position','3'); await capture('candidate-return');
    await page.locator('#visitor-explore-toggle').click(); await mode('explore'); await capture('candidate-explore');
    await page.locator('#visitor-explore-toggle').click(); await mode('guided'); await capture('candidate-resumed');
    await expect.poll(audit).toEqual(ready); expect(await selection()).toBe(worldPosition);
    await writeFile(`${directory}/comparison-and-navigation.json`,JSON.stringify({profile,initial,ready,observed,exact,worldPosition},null,2),{flag:'wx'});
    await page.locator(profile.accept?'#execution-accept':'#execution-cancel').click(); await state('tour_complete');
    await expect(shell).toHaveAttribute('data-public-outcome',profile.accept?'accepted':'discarded');
    await page.locator('#dock-inspect').click(); await mode('detail'); await page.locator('#dock-inspect').click(); await mode('guided');
  });
}

test('workbench camera pauses explanation without entering an exploration detour on rerender', async ({page}) => {
  await page.addInitScript(() => {
    const send=Worker.prototype.postMessage; (window as any).cameraCommands=[];
    Worker.prototype.postMessage=function(message:any,...rest:any[]) {
      (window as any).cameraCommands.push(message.command);
      return Reflect.apply(send,this,[message,...rest]);
    };
  });
  await page.goto('/?presentation=spatial');
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('.short-guide > summary').click();
  await page.locator('#explanation-restart').click();
  const selection=await page.getByTestId('selected-world-object').getAttribute('data-position');
  const commands=await page.evaluate(() => [...(window as any).cameraCommands]);
  await page.locator('#explanation-play').click();
  await page.locator('#spatial-world').dispatchEvent('wheel',{deltaY:100,clientX:200,clientY:200});
  await expect(page.getByTestId('explanation-status')).toContainText('Camera adjusted');
  await page.locator('#operator-controls').click();
  await expect(page.getByTestId('explanation-status')).toContainText('Paused');
  await expect(page.getByTestId('explanation-status')).not.toContainText('Explore detour');
  expect(await page.getByTestId('selected-world-object').getAttribute('data-position')).toBe(selection);
  expect(await page.evaluate(() => (window as any).cameraCommands)).toEqual(commands);
  await page.screenshot({path:`${await evidenceDirectory(test.info())}/workbench-camera-paused.png`});
});
