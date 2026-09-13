import {test,expect} from '@playwright/test';import {mkdir,writeFile} from 'node:fs/promises';
test.use({video:{mode:'on',size:{width:1920,height:1080}},viewport:{width:1920,height:1080}});
test('Wave 1C paced two-update learning review',async({page})=>{
 test.setTimeout(120000);const dir=process.env.SPATIAL_EVIDENCE_DIR??'/tmp/model-lab-wave1c-browser';await mkdir(dir,{recursive:true});const pause=()=>page.waitForTimeout(5000);
 await page.goto('/?presentation=spatial');await expect(page.locator('#predict')).toBeEnabled();await page.locator('#document').fill('abca');await page.locator('#predict').click();await expect(page.locator('#spatial-learn')).toBeEnabled();await page.locator('#spatial-query').selectOption('3');await page.locator('[data-world-parameter="wte"]').click();await pause();
 await page.locator('#spatial-learn').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('1');const first=await page.locator('#spatial-experiment').inputValue();await pause();
 await page.locator('button[data-learning-stage="gradient"]').first().click();await page.locator('#learning-inspect-gradient').click();await expect(page.getByTestId('contribution-accounting')).toBeVisible();await pause();
 await page.locator('button[data-learning-stage="adam"]').first().click();await pause();await page.getByTestId('adam-after').scrollIntoViewIfNeeded();await pause();
 await page.locator('button[data-learning-phase="after"]').first().click();await page.locator('#spatial-operation').selectOption('q');await pause();await page.locator('#spatial-operation').selectOption('mlpRelu');await pause();
 await page.locator('#spatial-operation').selectOption('probabilities');await page.locator('button[data-learning-stage="compare"]').first().click();await pause();
 await page.locator('#spatial-home').click();await pause();await page.locator('[data-world-parameter="layer0.attn_wq"]').click();await pause();await page.locator('#spatial-learn').click();await expect(page.getByTestId('spatial-live-step')).toHaveText('2');await pause();
 await page.locator('button[data-learning-stage="adam"]').first().click();await page.getByTestId('adam-m-before').scrollIntoViewIfNeeded();await pause();await page.getByTestId('adam-after').scrollIntoViewIfNeeded();await pause();
 await page.locator('#spatial-experiment').selectOption(first);await page.locator('button[data-learning-stage="gradient"]').first().click();await page.locator('#learning-inspect-gradient').click();await expect(page.getByTestId('inspection-provenance')).toHaveText('VERIFIED RECOMPUTATION');await pause();
 await writeFile(dir+'/recording-identities.json',JSON.stringify({firstExperiment:first,lastSelectedExperiment:await page.locator('#spatial-experiment').inputValue(),liveStep:await page.getByTestId('spatial-live-step').textContent(),source:await page.getByTestId('learning-source').textContent()},null,2));
});
