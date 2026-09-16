import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '../support/browser-evidence.js';

const generationRecording=process.env.NATIVE_GENERATION_RECORDING;

test('M4-B2 mixed historical archive exports, imports inertly, and survives a tampered replacement attempt',{tag:'@m4-b2'},async({page,context,evidenceDir:directory})=>{
  test.skip(!generationRecording,'qualified M4-A generation recording required');test.setTimeout(240_000);
  const generation=JSON.parse(await readFile(generationRecording!,'utf8')),runId=generation.record.run.id;let nativeRequests=0;
  const countNative=(request:import('@playwright/test').Request)=>{if(new URL(request.url()).pathname.endsWith('/execute'))nativeRequests++;};page.on('request',countNative);
  await page.setViewportSize({width:1920,height:1080});await page.goto('/?presentation=spatial');await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#spatial-learn').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');await page.locator('#spatial-current').click();
  await page.locator('#spatial-operation').selectOption('headOutput');await page.locator('#spatial-ablate').click();await expect(page.getByTestId('status')).toContainText('Observed ablation complete');await page.locator('#spatial-current').click();
  await page.locator('#spatial-query').selectOption('3');await page.locator('#spatial-head').selectOption('1');await page.locator('#spatial-patch').click();await expect(page.getByTestId('status')).toContainText('Observed donor patch complete');await page.locator('#spatial-current').click();
  await page.locator('#open-activation-variant').click();await expect(page.getByTestId('status')).toContainText('Leaky ReLU model variant complete');await page.locator('#variant-current').click();
  await page.locator('#open-composite-variant').click();await expect(page.getByTestId('status')).toContainText('Composite A/B variant trained');await page.locator('#composite-current').click();
  await page.locator('#open-data-experiment').click();await expect(page.getByTestId('status')).toContainText('Matched data experiment complete');await page.locator('#data-current').click();
  await page.locator('#open-shared-inspector').click();await page.locator('#shared-import').setInputFiles(generationRecording!);await expect(page.getByTestId('shared-status')).toContainText('Saved replay loaded');await page.locator('#shared-world').click();
  await page.getByTestId('portable-archive-controls').getByText('Portable historical archive').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-archive').click();const download=await downloadPromise,archivePath=`${directory}/m4-b2-mixed.mlarchive`;await download.saveAs(archivePath);
  await expect(page.getByTestId('portable-archive-status')).toContainText('Portable archive exported');

  const importedPage=await context.newPage();importedPage.on('request',countNative);await importedPage.setViewportSize({width:1920,height:1080});await importedPage.goto('/?presentation=spatial');await importedPage.locator('#predict').click();await expect(importedPage.getByTestId('status')).toContainText('Live prediction complete');const liveStep=await importedPage.getByTestId('spatial-live-step').textContent();
  await importedPage.getByTestId('portable-archive-controls').getByText('Portable historical archive').click();await importedPage.locator('#import-archive').setInputFiles(archivePath);await expect(importedPage.getByTestId('imported-archive-status')).toContainText('live accepted model unchanged');await expect(importedPage.getByTestId('spatial-live-step')).toHaveText(liveStep!);
  const archiveIdentity=await importedPage.getByTestId('imported-archive-status').textContent();
  await importedPage.locator('#open-shared-inspector').click();await importedPage.locator('#shared-run').selectOption(runId);await importedPage.locator('#shared-world').click();await importedPage.locator('#pythia-invocation').selectOption('generation:2');await importedPage.locator('#pythia-operation').selectOption('generation:2/logits');const output=importedPage.locator('[data-pythia-coordinate="output_index"]');await output.fill('50303');await output.dispatchEvent('change');await expect(importedPage.getByTestId('pythia-selected-output')).toContainText('-3.8919265270233154');await expect(importedPage.getByTestId('pythia-effective-prefix')).toContainText('generation:2');await expect(importedPage.getByTestId('pythia-cache-policy')).toContainText('cache unsupported/unqualified');
  await importedPage.locator('#pythia-operation').selectOption('generation:2/attention.qkv');await importedPage.screenshot({path:`${directory}/m4-b2-imported-generation-1920.png`});
  await importedPage.locator('#return-canonical-world').click();await expect(importedPage.getByTestId('spatial-live-step')).toHaveText(liveStep!);
  const tampered=await readFile(archivePath);tampered[tampered.length-1]^=1;const tamperedPath=`${directory}/m4-b2-tampered.mlarchive`;await writeFile(tamperedPath,tampered);
  await importedPage.getByTestId('portable-archive-controls').getByText('Portable historical archive').click();await importedPage.locator('#import-archive').setInputFiles(tamperedPath);await expect(importedPage.getByTestId('portable-archive-status')).toContainText('Archive import refused');await expect(importedPage.getByTestId('imported-archive-status')).toHaveText(archiveIdentity!);await expect(importedPage.getByTestId('spatial-live-step')).toHaveText(liveStep!);await importedPage.screenshot({path:`${directory}/m4-b2-tamper-refusal-1920.png`});
  expect(nativeRequests).toBe(0);await writeFile(`${directory}/m4-b2-browser.json`,JSON.stringify({runId,archiveIdentity,liveStep,exactLogit:-3.8919265270233154,generatedChoices:[327,253],nativeRequests,tamperRefused:true},null,2));
});
