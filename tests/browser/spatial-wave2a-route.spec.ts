import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test.use({video:{mode:'on',size:{width:1920,height:1080}},viewport:{width:1920,height:1080}});
test('Wave 2A paced genuine execution review',async({page})=>{
 test.setTimeout(120000);const dir=process.env.WAVE2_EVIDENCE_DIR??'test-results/wave2a-review';await mkdir(dir,{recursive:true});
 await page.addInitScript(()=>{const w=window as any;w.routeAudit=[];const original=Worker.prototype.postMessage;const seen=new WeakSet();Worker.prototype.postMessage=function(m:any,...args:any[]){w.routeAudit.push({direction:'request',message:m,time:performance.now()});if(!seen.has(this)){seen.add(this);this.addEventListener('message',e=>w.routeAudit.push({direction:'response',message:e.data,time:performance.now()}));}return Reflect.apply(original,this,[m,...args]);};});
 const pause=()=>page.waitForTimeout(3500);
 await page.goto('/?presentation=spatial');await expect(page.locator('#step-prediction')).toBeEnabled();await page.locator('#predict').click();await expect(page.locator('#step-prediction')).toBeEnabled();
 await page.locator('#step-prediction').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence','0');await pause();
 for(let i=1;i<=6;i++){await page.locator('#execution-next').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence',String(i));await page.waitForTimeout(450);}
 await pause();await page.getByRole('button',{name:'Inspect selected scalar',exact:true}).click();await page.locator('#microscope').scrollIntoViewIfNeeded();await pause();
 await page.locator('#spatial-operation').selectOption('k');await expect(page.getByTestId('pending-output')).toContainText('Not yet computed');await pause();
 await page.locator('#execution-follow').check();
 for(let i=7;i<=20;i++){await page.locator('#execution-next').click();await expect(page.locator('#execution-controls')).toHaveAttribute('data-sequence',String(i));await page.waitForTimeout(200);}
 await page.locator('[data-forward-element="7"]').click();await expect(page.getByTestId('component-guide')).toHaveAttribute('data-component','7');await pause();
 await page.locator('#execution-continue').click();await page.waitForTimeout(1100);await page.locator('#execution-pause').click();await expect(page.getByTestId('execution-frontier')).toContainText('paused');await pause();
 await page.locator('#spatial-home').click();await page.locator('#spatial-operation').selectOption('q');await page.locator('#spatial-query').selectOption('0');await page.locator('#spatial-focus').click();await pause();
 await page.locator('#execution-continue').click();await page.waitForTimeout(650);await page.locator('#spatial-world').focus();await page.keyboard.press('ArrowRight');await expect(page.getByTestId('execution-frontier')).toContainText('paused');await pause();
 await page.locator('#execution-follow').check();await page.locator('#execution-continue').click();await expect(page.locator('#step-prediction')).toBeEnabled({timeout:50000});
 await page.locator('#spatial-home').click();await pause();await page.locator('#explanation-restart').click();await page.locator('#waypoint-next').click();await pause();
 await writeFile(`${dir}/recording-audit.json`,JSON.stringify(await page.evaluate(()=>(window as any).routeAudit),null,2));
 await page.close();await page.video()!.saveAs(`${dir}/wave-2a-route.webm`);
});
