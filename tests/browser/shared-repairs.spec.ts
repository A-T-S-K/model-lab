import { test, expect, type Page } from '../support/browser-evidence.js';
import { writeFile } from 'node:fs/promises';

async function prediction(page: Page) {
  await page.goto('/?presentation=spatial');
  await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#open-shared-inspector').click();
  await expect(page.locator('#shared-run')).not.toHaveValue('');
  return page.locator('#shared-run').inputValue();
}
for (const failure of ['invalid input', 'budget refusal', 'worker failure']) {
  test(`shared canonical receipt refuses ${failure} after a successful run`, async ({ page, evidenceDir }) => {
    await page.addInitScript((failure) => {
      const w=window as any;w.requestAudit=[];w.failNext=false;
      const send=Worker.prototype.postMessage;
      Worker.prototype.postMessage=function(message:any,...rest:any[]) {
        w.requestAudit.push(message.command);
        if(w.failNext&&message.command==='predict') {
          w.failNext=false;
          queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{sessionId:message.sessionId,generationId:message.generationId,runId:message.runId,status:'error',error:'injected worker failure'}})));
          return;
        }
        return Reflect.apply(send,this,[message,...rest]);
      };
      if(failure==='budget refusal') {
        const encode=TextEncoder.prototype.encode;
        TextEncoder.prototype.encode=function(input?:string) {
          // Fault injection at the existing accounting boundary; never change a
          // numerical payload or disable the real SESSION_BUDGET refusal.
          if(input?.includes('"snapshots":')&&input.includes('"runs":')&&input.includes('"trainingStep":')) return new Uint8Array(64*1024*1024);
          return encode.call(this,input);
        };
      }
    }, failure);
    const original=await prediction(page);
    const historyCount=await page.locator('#shared-run option').count();
    if(failure==='invalid input') {
      await page.locator('#close-shared').click();await page.locator('#document').fill('d');
      await page.locator('#open-shared-inspector').click();
    }
    if(failure==='worker failure') await page.evaluate(()=>(window as any).failNext=true);
    const requests=await page.evaluate(()=>(window as any).requestAudit.filter((c:string)=>c==='predict').length);
    await page.locator('#shared-execute').click();
    await expect(page.getByTestId('shared-status')).toContainText('Execution refused or failed');
    await expect(page.getByTestId('shared-status')).not.toContainText('receipt validated');
    await expect(page.locator('#shared-run')).toHaveValue(original);
    await expect(page.locator('#shared-run option')).toHaveCount(historyCount);
    const after=await page.evaluate(()=>(window as any).requestAudit.filter((c:string)=>c==='predict').length);
    expect(after-requests).toBe(failure==='worker failure'?1:0);
    await writeFile(`${evidenceDir}/refusal.json`,JSON.stringify({failure,original,historyCount,requests,after,status:await page.getByTestId('shared-status').textContent()}),{flag:'wx'});
  });
}

test('shared inspector resets offset coherently for a new prediction and preserves valid navigation',async({page,evidenceDir})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const first=await prediction(page);
  await page.locator('[data-point]').filter({hasText:'mlpUp'}).first().click();
  await page.locator('#shared-offset').fill('31');await page.locator('#shared-offset').dispatchEvent('change');
  await expect(page.getByTestId('shared-values')).toContainText('[');
  // Closing/reopening without a new run preserves a valid point and offset.
  await page.locator('#close-shared').click();await page.locator('#open-shared-inspector').click();
  await expect(page.locator('#shared-offset')).toHaveValue('31');
  await page.locator('#close-shared').click();await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#open-shared-inspector').click();
  await expect(page.locator('#shared-run')).not.toHaveValue(first);
  await expect(page.locator('#shared-offset')).toHaveValue('0');
  await expect(page.getByTestId('shared-point')).toContainText('tokenEmbedding');
  expect(errors).toEqual([]);
  await page.screenshot({path:`${evidenceDir}/fresh-selection.png`});
});

test('saved canonical replay becomes live evidence after a fresh prediction',async({page,evidenceDir})=>{
  await prediction(page);await page.locator('#shared-save').click();await page.locator('#shared-load').click();
  await expect(page.getByTestId('shared-provenance')).toContainText('SAVED REPLAY');
  const saved=await page.locator('#shared-run').inputValue();
  await page.locator('#close-shared').click();await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');await page.locator('#open-shared-inspector').click();
  await expect(page.locator('#shared-run')).not.toHaveValue(saved);
  await expect(page.getByTestId('shared-provenance')).toContainText('RETAINED EVIDENCE');
  await expect(page.getByTestId('shared-provenance')).not.toContainText('SAVED REPLAY');
  await page.screenshot({path:`${evidenceDir}/live-after-replay.png`});
});
