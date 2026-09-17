import { stat, writeFile } from 'node:fs/promises';
import { expect, test } from '../support/browser-evidence.js';

const nearArchive=process.env.M4_C1_NEAR_ARCHIVE;

test('M4-C1 near-limit history stays inspectable while native work refuses before transport and Clear Session restores capacity',{tag:'@m4-c1'},async({page,evidenceDir:directory})=>{
  test.skip(!nearArchive,'valid near-limit M4-C1 archive required');test.setTimeout(300_000);const archiveStat=await stat(nearArchive!);

  let nativeRequests=0;page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('/execute'))nativeRequests++;});
  await page.setViewportSize({width:1920,height:1080});await page.goto('/?presentation=spatial');
  await page.getByTestId('portable-archive-controls').getByText('Portable historical archive').click();await page.locator('#import-archive').setInputFiles(nearArchive!);
  await expect(page.getByTestId('imported-archive-status')).toContainText('live accepted model unchanged');
  await page.locator('#open-shared-inspector').click();await page.locator('#shared-run-id').fill('qualification:qualification-generate');await page.locator('#shared-run-open').click();await page.locator('#shared-world').click();
  await page.locator('#pythia-invocation').selectOption('generation:2');await page.locator('#pythia-operation').selectOption('generation:2/logits');const output=page.locator('[data-pythia-coordinate="output_index"]');await output.fill('50303');await output.dispatchEvent('change');
  await expect(page.getByTestId('pythia-selected-output')).toContainText('-3.8919265270233154');await page.screenshot({path:`${directory}/m4-c1-near-limit-pythia-1920.png`});
  await page.locator('#return-canonical-world').click();await page.locator('#open-shared-inspector').click();await page.locator('#shared-model').selectOption('pythia-native-v1');await page.locator('#shared-action').selectOption('generate');
  await page.locator('#shared-execute').click();await expect(page.getByTestId('shared-status')).toContainText('Retention capacity exceeded');expect(nativeRequests).toBe(0);
  await page.screenshot({path:`${directory}/m4-c1-native-refusal-1920.png`});await page.locator('#close-shared').click();
  await expect(page.locator('#export-archive')).toBeEnabled();await page.locator('#clear-session').click();await expect(page.getByTestId('status')).toContainText(/Session cleared|Recorded real run/);
  await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');await page.screenshot({path:`${directory}/m4-c1-cleared-predict-1920.png`});
  await writeFile(`${directory}/m4-c1-browser.json`,JSON.stringify({archiveBytes:archiveStat.size,nativeRequests,pythiaInspectable:true,nativeRefusedBeforeTransport:true,exportAvailableAtLimit:true,clearRestoredPredict:true},null,2));
});
