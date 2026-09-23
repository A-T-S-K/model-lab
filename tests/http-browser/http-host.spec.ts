import { expect, test } from '@playwright/test';

test('complete browser-local workflow runs on an insecure non-loopback HTTP origin', async ({ page, context }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith('http://model-lab.test:4176/') && !url.startsWith('blob:') && !url.startsWith('data:')) {
      external.push(url); return route.abort();
    }
    return route.continue();
  });
  await page.goto('/?presentation=spatial');
  expect(await page.evaluate(() => ({
    secure: isSecureContext,
    hostname: location.hostname,
    randomUUID: typeof crypto.randomUUID,
    subtle: typeof crypto.subtle,
    getRandomValues: typeof crypto.getRandomValues,
  }))).toEqual({secure:false,hostname:'model-lab.test',randomUUID:'undefined',subtle:'undefined',getRandomValues:'function'});
  await expect(page.locator('#predict')).toBeEnabled();
  await expect(page.getByTestId('status')).toContainText('Recorded real run');

  await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#spatial-learn').click();
  await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
  await page.locator('#spatial-current').click();

  await page.locator('#open-activation-variant').click();
  await expect(page.getByTestId('status')).toContainText('Leaky ReLU model variant complete',{timeout:60_000});
  await page.locator('#variant-current').click();
  await page.locator('#open-composite-variant').click();
  await expect(page.getByTestId('status')).toContainText('Composite A/B variant trained',{timeout:60_000});
  await page.locator('#composite-current').click();
  await page.locator('#open-data-experiment').click();
  await expect(page.getByTestId('status')).toContainText('Matched data experiment complete',{timeout:60_000});
  await page.locator('#data-current').click();

  await page.locator('#open-shared-inspector').click();
  await page.locator('#shared-model').selectOption('microgpt-multilayer-v1');
  await page.locator('#shared-execute').click();
  await expect(page.getByTestId('shared-status')).toContainText('receipt validated');
  await page.locator('#shared-model').selectOption('pythia-native-v1');
  await expect(page.locator('#shared-execute')).toBeDisabled();
  await expect(page.getByTestId('native-origin-unavailable')).toContainText('loopback application origin');
  await page.locator('#close-shared').click();

  await page.getByTestId('portable-archive-controls').getByText('Portable historical archive').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-archive').click();
  const download = await downloadPromise, archivePath = testInfo.outputPath('http-host.mlarchive');
  await download.saveAs(archivePath);
  await expect(page.getByTestId('portable-archive-status')).toContainText('Portable archive exported',{timeout:60_000});

  const imported = await context.newPage();
  const importedErrors: string[] = [];
  imported.on('pageerror', error => importedErrors.push(error.message));
  await imported.goto('/?presentation=spatial');
  await expect(imported.locator('#predict')).toBeEnabled();
  await imported.getByTestId('portable-archive-controls').getByText('Portable historical archive').click();
  await imported.locator('#import-archive').setInputFiles(archivePath);
  await expect(imported.getByTestId('imported-archive-status')).toContainText('live accepted model unchanged',{timeout:60_000});
  expect(importedErrors).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
