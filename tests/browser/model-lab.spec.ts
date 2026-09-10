import { test, expect } from '@playwright/test';
import fixture from '../../fixtures/canonical.expected.json' with { type: 'json' };

test('production browser Predict exposes real arithmetic; Learn applies Adam and reset restores the fixture without WAN', async ({ page }) => {
  const errors: string[] = []; const externalRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (!route.request().url().startsWith('http://127.0.0.1:4173/')) { externalRequests.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await page.goto('/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled(); await page.locator('details.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await expect(page.getByTestId('training-step')).toHaveText('0');
  await expect(page.getByText('LIVE RUN', { exact: true })).toBeVisible();
  const probabilities = async () => page.getByTestId('probabilities').locator('code').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('title'))));
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const before = await probabilities();
  for (let i = 0; i < before.length; i++) expect(before[i]).toBeCloseTo(fixture.positions[4].probabilities[i], 10);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.locator('#head').selectOption('1');
  await page.locator('[data-query="3"][data-key="2"]').click();
  await expect(page.getByTestId('attention-detail')).toContainText('DERIVED FROM OBSERVED EVIDENCE');
  const rows = await page.getByTestId('attention-detail').locator('tbody tr').evaluateAll(nodes => nodes.map(row => Array.from(row.querySelectorAll('td[title]')).map(cell => Number(cell.getAttribute('title')))));
  expect(rows).toHaveLength(4);
  rows.forEach(([q, k, product]) => expect(q * k).toBeCloseTo(product, 14));
  const scaled = rows.reduce((sum, row) => sum + row[2], 0) / 2;
  expect(scaled).toBeCloseTo(fixture.positions[3].layers[0].heads[1].attentionLogits[2], 12);
  await expect(page.locator('.attention-grid .masked')).toHaveCount(10);
  await page.getByRole('button', { name: 'Learn · one update', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('Live update complete');
  await expect(page.getByTestId('training-step')).toHaveText('1');
  await expect(page.getByTestId('learn-evidence')).toContainText('Gradient used by Adam');
  await expect(page.getByTestId('learn-evidence')).toContainText('Applied delta');
  const after = await probabilities();
  expect(after).not.toEqual(before);
  for (let i = 0; i < after.length; i++) expect(after[i]).toBeCloseTo(fixture.postUpdate.positions[4].probabilities[i], 10);
  await page.locator('#parameter-select').selectOption('0');
  const optimizerEvidence = await page.getByTestId('learn-evidence').locator('table').first().locator('tbody tr').evaluateAll(nodes => Object.fromEntries(nodes.map(row => [row.querySelector('td')!.textContent, Number(row.querySelector('td[title]')!.getAttribute('title'))])));
  expect(optimizerEvidence['Parameter after']).toBe(optimizerEvidence['Parameter before'] + optimizerEvidence['Applied delta (after − before)']);
  expect(optimizerEvidence['Gradient used by Adam']).toBeCloseTo(fixture.gradients.wte[0][0], 10);
  expect(optimizerEvidence['First moment m after']).toBeCloseTo(fixture.adam.mAfter[0], 10);
  expect(optimizerEvidence['Second moment v after']).toBeCloseTo(fixture.adam.vAfter[0], 10);
  expect(optimizerEvidence['Applied delta (after − before)']).toBeCloseTo(fixture.adam.delta[0], 10);
  await page.screenshot({ path: 'test-results/model-lab-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Reset model', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('Model reset');
  await page.getByRole('button', { name: 'Predict', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  expect(await probabilities()).toEqual(before);
  await page.getByTestId('document-input').fill('bad');
  await page.getByRole('button', { name: 'Predict', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Use up to seven characters');
  expect(errors).toEqual([]); expect(externalRequests).toEqual([]);
});

test('mobile layout and rapid reset leave a usable fresh model', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled(); await page.locator('details.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.evaluate(() => {
    (document.querySelector('#train') as HTMLButtonElement).click();
    (document.querySelector('#cancel') as HTMLButtonElement).click();
  });
  await expect(page.getByTestId('status')).toContainText('Cancelled');
  await expect(page.getByTestId('training-step')).toHaveText('0');
  await page.getByRole('button', { name: 'Predict', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByTestId('document-input').fill('abcabca');
  await page.getByRole('button', { name: 'Learn · one update', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('Live update complete');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/model-lab-mobile.png', fullPage: true });
});
