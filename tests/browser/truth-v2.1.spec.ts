import { test, expect } from '@playwright/test';
import { RUNTIME_REVISION } from '../../runtime/revision.js';
import { forwardStages, trainingStages } from '../../app/source/stages.js';

test('edited valid and invalid inputs preserve and visibly unbind captured evidence', async ({ page }) => {
  await page.goto('/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled(); await page.locator('details.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await expect(page.getByTestId('run-state')).toHaveText('LIVE RUN');
  await expect(page.getByTestId('captured-input')).toHaveText('abca');
  const probabilities = () => page.getByTestId('probabilities').locator('code').evaluateAll(nodes => nodes.map(node => node.getAttribute('title')));
  const oldValues = await probabilities();
  await page.getByTestId('document-input').fill('ccccccc');
  await expect(page.getByTestId('run-state')).toHaveText('STALE EVIDENCE');
  await expect(page.getByTestId('captured-input')).toHaveText('abca');
  await expect(page.getByTestId('run-binding')).toContainText('Current input: ccccccc');
  expect(await probabilities()).toEqual(oldValues);
  await page.getByRole('button', { name: 'Predict', exact: true }).click();
  await expect(page.getByTestId('run-state')).toHaveText('LIVE RUN');
  await expect(page.getByTestId('captured-input')).toHaveText('ccccccc');
  await expect(page.getByTestId('document-input')).toBeEnabled();
  const newValues = await probabilities();
  expect(newValues).not.toEqual(oldValues);
  await page.getByTestId('document-input').fill('bad');
  await expect(page.getByTestId('run-state')).toHaveText('STALE EVIDENCE');
  await page.getByRole('button', { name: 'Predict', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Use up to seven characters');
  await expect(page.getByTestId('captured-input')).toHaveText('ccccccc');
  await expect(page.getByTestId('run-state')).toHaveText('STALE EVIDENCE');
  expect(await probabilities()).toEqual(newValues);
  // Returning the editor to the exact captured input can truthfully show current evidence again.
  await page.getByTestId('document-input').fill('ccccccc');
  await expect(page.getByTestId('run-state')).toHaveText('LIVE RUN');
  await page.getByRole('button', { name: 'Reset model', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('Model reset');
  await expect(page.getByTestId('run-state')).toHaveText('ARCHIVED RUN');
});

test('forward and training paths are separate and Combined heads and gradients expose real source', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled(); await page.locator('details.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  expect(await page.getByTestId('forward-stages').locator('button').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-stage')))).toEqual(forwardStages.map(([kind]) => kind));
  expect(await page.getByTestId('training-stages').locator('button').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-stage')))).toEqual(trainingStages.map(([kind]) => kind));
  await expect(page.locator('[data-stage="probabilities"]')).toHaveCount(1);
  await expect(page.locator('[data-stage="greedy"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Combined heads', exact: true }).click();
  const combinedSource = page.locator('details.source').filter({ has: page.getByText('Read source · Combined heads', { exact: true }) });
  await combinedSource.locator('summary').click();
  await expect(combinedSource).toContainText('model/microgpt.ts · forward');
  await expect(combinedSource.locator('pre')).toContainText('combinedHeads.push(...headOutput)');
  await page.getByRole('button', { name: 'Learn · one update', exact: true }).click();
  await expect(page.getByTestId('training-step')).toHaveText('1');
  await expect(page.getByTestId('document-input')).toBeEnabled();
  await page.getByRole('button', { name: 'Parameter gradients', exact: true }).click();
  const backwardSource = page.locator('details.source').filter({ has: page.getByText('Read source · Chain-rule edge', { exact: true }) });
  await backwardSource.locator('summary').click();
  await expect(backwardSource).toContainText('model/autograd.ts · backward');
  await expect(backwardSource.locator('pre')).toContainText('parent.grad +=');
  await expect(page.getByTestId('vector-evidence')).toContainText('OBSERVED');
  expect(errors).toEqual([]);
});


test('exact runtime provenance is visible offline for current and archived runs', async ({ page }) => {
  const external: string[] = [];
  await page.route('**/*', route => {
    if (!route.request().url().startsWith('http://127.0.0.1:4173/')) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await page.goto('/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled(); await page.locator('details.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByTestId('runtime-provenance').locator('summary').click();
  await expect(page.getByTestId('runtime-revision')).toHaveText(RUNTIME_REVISION);
  expect(RUNTIME_REVISION).toMatch(/^sha256:[a-f0-9]{64}$/);
  await page.getByRole('button', { name: 'Reset model', exact: true }).click();
  await expect(page.getByTestId('status')).toContainText('Model reset');
  await expect(page.getByTestId('run-state')).toHaveText('ARCHIVED RUN');
  await expect(page.getByTestId('runtime-revision')).toHaveText(RUNTIME_REVISION);
  expect(external).toEqual([]);
});
