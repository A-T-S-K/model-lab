import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test.use({video:{mode:'on',size:{width:1920,height:1080}}});
const dir=process.env.FIXES_EVIDENCE_DIR??'test-results/end-to-end-fixes/focused';
async function capture(page:Page,name:string){
 for(const [width,height] of [[1920,1080],[1280,720]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(300);
  await page.screenshot({path:`${dir}/${name}-${width}.png`});
  await writeFile(`${dir}/${name}-${width}.json`,JSON.stringify(await page.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight},world:document.querySelector('.world-pane')?.getBoundingClientRect().toJSON(),calculation:document.querySelector('.teaching-step')?.getBoundingClientRect().toJSON(),learningCard:document.querySelector('[data-testid="live-local-construction"]>rect')?.getBoundingClientRect().toJSON()})),null,2));
 }
}
async function scalar(page:Page,name:string){
 await page.getByRole('button',{name:'Inspect selected scalar',exact:true}).click();
 const equation=page.getByTestId('scalar-equation');await expect(equation).toBeVisible();await equation.scrollIntoViewIfNeeded();
 const colors=await equation.evaluate(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}));
 expect(colors).toEqual({fg:'rgb(242, 245, 247)',bg:'rgb(32, 44, 52)'});
 await capture(page,name);
}
test('five corrections: public same-session route, scalar arms, compact Ready and prediction meaning',async({page})=>{
 test.setTimeout(180000);await mkdir(dir,{recursive:true});
 await page.addInitScript(()=>{
  const w=window as any;w.fixes={commands:[],responses:[],identity:Math.random()};
  const send=Worker.prototype.postMessage,seen=new WeakSet();
  Worker.prototype.postMessage=function(m:any,...rest:any[]){w.fixes.commands.push(m);if(!seen.has(this)){seen.add(this);this.addEventListener('message',e=>w.fixes.responses.push(e.data));}return Reflect.apply(send,this,[m,...rest]);};
 });
 await page.goto('/');await expect(page.locator('#presentation-toggle')).toHaveCount(0);
 await page.getByRole('button',{name:'TOUCH TO START'}).click();
 await page.getByRole('button',{name:'Why this prediction? · Explore'}).click();
 await capture(page,'entry');const identity=await page.evaluate(()=>(window as any).fixes.identity);
 await page.getByRole('button',{name:'Spatial presentation · controlled learning',exact:true}).click();
 await expect(page.locator('#step-learning')).toBeEnabled();expect(await page.evaluate(()=>(window as any).fixes.identity)).toBe(identity);expect(new URL(page.url()).search).toBe('');
 await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
 await page.locator('#spatial-operation').selectOption('q');await scalar(page,'scalar-live');
 await page.locator('#spatial-operation').selectOption('probabilities');
 await expect(page.getByTestId('prediction-summary')).toContainText('Highest-probability token: END');await expect(page.getByTestId('prediction-summary')).toContainText('Inspected component: a [0]');await expect(page.getByTestId('prediction-summary')).toContainText('target END');
 await page.locator('[data-forward-element="3"]').click();await expect(page.getByTestId('prediction-summary')).toContainText('Inspected component: END [3]');await page.getByTestId('prediction-summary').scrollIntoViewIfNeeded();await capture(page,'prediction');
 await page.locator('#step-learning').click();await expect(page.getByTestId('learning-guidance')).toContainText('Next step until backward');await capture(page,'guidance');
 await page.locator('#execution-continue').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase','ready',{timeout:60000});await capture(page,'ready');
 const rect=await page.locator('[data-testid="live-local-construction"]>rect').first().boundingBox();expect(rect!.width).toBeGreaterThan(400);
 await expect(page.locator('#execution-accept')).toBeInViewport();await expect(page.locator('#execution-cancel')).toBeInViewport();await expect(page.getByTestId('inspected-arm')).toBeInViewport();
 for(const arm of ['before','after','pair'])await page.locator(`[data-compare-arm="${arm}"]`).click();
 await page.locator('#execution-accept').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
 const history=await page.locator('#spatial-experiment').innerText();
 await page.locator('#presentation-toggle').click();await page.locator('#presentation-toggle').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');expect(await page.locator('#spatial-experiment').innerText()).toBe(history);
 await page.locator('#spatial-operation').selectOption('headOutput');await page.locator('#spatial-head').selectOption('1');await page.locator('#spatial-ablate').click();await expect(page.getByTestId('spatial-intervention')).toBeVisible();await capture(page,'head');
 await expect(page.getByTestId('teaching-step')).toBeInViewport({ratio:1});await expect(page.getByTestId('inspected-arm')).toBeInViewport();
 await page.locator('#spatial-operation').selectOption('probabilities');await scalar(page,'scalar-reconstructed-intervention');await expect(page.locator('#microscope')).toContainText('RECOMPUTED');
 await page.locator('[data-compare-arm="before"]').click();await expect(page.locator('#microscope')).not.toContainText('RECOMPUTED');await scalar(page,'scalar-reconstructed-baseline');
 await page.locator('#spatial-current').click();await page.locator('#step-learning').click();await page.locator('#presentation-toggle').click();await page.locator('#presentation-toggle').click();await expect(page.locator('#execution-controls')).toHaveCount(0);await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
 expect(await page.evaluate(()=>(window as any).fixes.identity)).toBe(identity);
 await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
 const audit=await page.evaluate(()=>(window as any).fixes);
 const accepted=audit.responses.filter((r:any)=>r.status==='result'&&r.result.learn).at(-1).result.snapshots.at(-1);
 expect(audit.responses.filter((r:any)=>r.status==='result').at(-1).result.snapshots[0]).toEqual(accepted);expect(new Set(audit.commands.filter((m:any)=>['initialize','predict','startTraining','advanceTraining','acceptTraining','cancelForward'].includes(m.command)).map((m:any)=>m.sessionId)).size).toBe(1);
 await writeFile(`${dir}/route-audit.json`,JSON.stringify(audit,null,2));await capture(page,'returned');
});

test('learning instructions: manual steps reach pinned partial contribution without a phase-timed Pause',async({page})=>{
 test.setTimeout(120000);await mkdir(dir,{recursive:true});await page.setViewportSize({width:1280,height:720});
 await page.goto('/?presentation=spatial');await page.locator('#step-learning').click();await expect(page.getByTestId('learning-guidance')).toBeInViewport();
 let steps=0;
 while(await page.locator('#execution-controls').getAttribute('data-training-phase')!=='backward'){
  expect(steps++).toBeLessThan(500);
  const seq=Number(await page.locator('#execution-controls').getAttribute('data-sequence'));
  await page.locator('#execution-next').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence',String(seq+1));
 }
 await page.locator('#execution-pin').click();await expect(page.getByTestId('live-contribution')).toBeVisible();await expect(page.locator('.live-learning')).toContainText('Partial gradient');
 await capture(page,'partial-manual-steps');
 await page.locator('[data-live-child]').click();
 await expect(page.getByTestId('scalar-equation')).toBeVisible();await page.getByTestId('scalar-equation').scrollIntoViewIfNeeded();
 expect(await page.getByTestId('scalar-equation').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(32, 44, 52)');
 await capture(page,'scalar-active-backward');await page.locator('#execution-cancel').click();
 await writeFile(`${dir}/manual-step-count.json`,JSON.stringify({steps,phaseTimedPause:false}));
});

test('public presentation entry leaves narrow source controls clickable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('#activate-attract').click();
 await page.getByRole('button',{name:'Why this prediction? · Explore'}).click();
 await page.getByText('Source controls and other evidence',{exact:true}).click();
 await expect(page.locator('.attention-controls')).toHaveAttribute('open','');
 await page.locator('#presentation-toggle').click();await expect(page.locator('#step-learning')).toBeEnabled();
});
