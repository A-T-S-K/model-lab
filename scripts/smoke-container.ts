import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const origin = process.argv[2] ?? 'http://127.0.0.1:4188';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('Use the local container origin');
const browser = await chromium.launch();
try {
  const page = await browser.newPage(); const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (!route.request().url().startsWith(`${origin}/`)) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await page.goto(origin);
  await page.getByTestId('status').filter({ hasText: 'Live prediction complete' }).waitFor();
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.locator('#train').click();
  await page.getByTestId('status').filter({ hasText: 'Live update complete' }).waitFor();
  await page.locator('#inspect-gradient').click();
  await page.getByTestId('inspection-provenance').filter({ hasText: 'OBSERVED LIVE SCALAR' }).waitFor();
  await page.getByText('Experiment · head ablation', { exact: true }).click();
  await page.locator('#ablate-head').click();
  await page.getByTestId('status').filter({ hasText: 'Observed ablation complete' }).waitFor();
  await page.locator('[data-stage="headOutput"]').click();
  await page.getByTestId('vector-evidence').locator('[data-element="0"]').click();
  await page.getByTestId('inspection-provenance').filter({ hasText: 'VERIFIED RECOMPUTATION' }).waitFor();
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log('PASS container Chromium Predict, Learn, actual gradient, ablation, historical inspection; zero errors/WAN');
} finally { await browser.close(); }
