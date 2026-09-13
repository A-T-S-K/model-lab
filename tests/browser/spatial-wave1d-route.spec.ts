import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test.use({video:{mode:'on',size:{width:1920,height:1080}},viewport:{width:1920,height:1080}});
test('Wave 1D paced Forward and Learning explanation review',async({page})=>{
 test.setTimeout(120000);const dir=process.env.SPATIAL_EVIDENCE_DIR??'/tmp/model-lab-wave1d';await mkdir(dir,{recursive:true});const pause=()=>page.waitForTimeout(5000);
 await page.addInitScript(()=>{const w=window as any;w.routeManifests=[];const send=Worker.prototype.postMessage,seen=new WeakSet();Worker.prototype.postMessage=function(message:any,...rest:any[]){if(!seen.has(this)){seen.add(this);this.addEventListener('message',event=>{if(event.data.status==='result')w.routeManifests.push(...event.data.result.runs.map((r:any)=>r.manifest));});}return Reflect.apply(send,this,[message,...rest]);};});
 await page.goto('/?presentation=spatial');await expect(page.locator('#predict')).toBeEnabled();await page.locator('#document').fill('abca');await page.locator('#predict').click();await expect(page.locator('#spatial-learn')).toBeEnabled();await pause();
 await page.locator('#explanation-play').click();await page.waitForTimeout(7000);await page.locator('#explanation-play').click();await pause();
 for(let i=1;i<8;i++)await page.locator('#waypoint-next').click();await page.locator('.geometry').scrollIntoViewIfNeeded();await pause();await page.getByTestId('qk-products').scrollIntoViewIfNeeded();await pause();
 await page.locator('#spatial-operation').selectOption('mlpRelu');await page.getByTestId('relu-calculation').scrollIntoViewIfNeeded();await pause();await page.locator('#waypoint-resume').click();await page.locator('.geometry').scrollIntoViewIfNeeded();await pause();
 await page.locator('#spatial-learn').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');await page.locator('#explanation-route').selectOption('learning');await page.locator('#explanation-restart').click();await pause();await page.locator('#explanation-play').click();await page.waitForTimeout(7000);await page.locator('#explanation-play').click();await page.locator('#learning-inspect-gradient').click();await expect(page.getByTestId('learning-contributions')).toBeVisible();await page.getByTestId('learning-contributions').scrollIntoViewIfNeeded();await pause();
 await page.locator('#waypoint-next').click();await pause();await page.getByTestId('adam-after').scrollIntoViewIfNeeded();await pause();await page.locator('#waypoint-next').click();await pause();await page.locator('#waypoint-next').click();await pause();await page.locator('#spatial-operation').selectOption('probabilities');await pause();
 await writeFile(`${dir}/recording-identities.json`,JSON.stringify({manifests:await page.evaluate(()=>(window as any).routeManifests),experiment:await page.locator('#spatial-experiment').inputValue(),liveStep:await page.getByTestId('spatial-live-step').textContent()},null,2));
 await page.close();
 await page.video()!.saveAs(`${dir}/wave-1d-route.webm`);
});
