import { test, expect } from '@playwright/test';
import fixture from '../../fixtures/canonical.initial.json' with { type: 'json' };
import { loadModel, createOptimizerState } from '../../model/state.js';
import { predict, tokenize } from '../../model/microgpt.js';
import { trainStep } from '../../model/training.js';

function measured(updates: number, document = fixture.document): number {
  const model = loadModel(fixture.config, fixture.parameters);
  const optimizer = createOptimizerState(model, fixture.optimizer);
  const { tokenIds, targetIds } = tokenize(model, document);
  for (let step = 0; step < updates; step++) trainStep(model, optimizer, tokenIds, targetIds);
  const position = Math.max(0, tokenIds.length - 2);
  return predict(model, tokenIds).probabilities[position]![targetIds[position]!]!;
}

test('fresh Guided predicts, teaches ten real updates, reveals measured change, then opens authentic depth', async ({ page }) => {
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (!route.request().url().startsWith('http://127.0.0.1:4173/')) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await expect(page.getByTestId('guided-lesson')).toBeVisible();
  await expect(page.locator('#parameter-select')).toHaveCount(0);
  await expect(page.getByTestId('adam-equations')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/binary64|artifact|snapshot|SHA-256|Adam/);
  await expect(page.getByTestId('guided-target')).toHaveText('a');
  expect(await page.locator('.model-map button').allTextContents()).toEqual(['Characters', 'Tokens + position', 'Attention', 'MLP', 'Scores', 'Probabilities']);
  await page.getByRole('button', { name: 'Attention', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Attention', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('map-explanation')).toContainText('cannot look at future');
  await page.getByRole('button', { name: 'Predict', exact: true }).click();
  await expect(page.getByTestId('document-input')).toBeEnabled();
  await page.getByRole('button', { name: 'Teach · 10 real updates', exact: true }).click();
  await expect(page.getByTestId('guided-completed')).toHaveText('10');
  await expect(page.getByTestId('document-input')).toBeEnabled();
  expect(Number(await page.getByTestId('guided-before').getAttribute('data-value'))).toBeCloseTo(measured(0), 12);
  expect(Number(await page.getByTestId('guided-after').getAttribute('data-value'))).toBeCloseTo(measured(10), 12);
  await expect(page.getByTestId('training-step')).toHaveText('10');
  await expect(page.locator('#parameter-select')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/model-lab-v2.1-guided-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Why did that change? · Explore', exact: true }).click();
  await expect(page.locator('#parameter-select')).toBeVisible();
  await expect(page.getByTestId('learn-evidence')).toContainText('Gradient used by Adam');
  await page.getByRole('button', { name: 'Guided', exact: true }).click();
  await page.getByRole('button', { name: 'Follow one number · Microscope', exact: true }).click();
  await expect(page.getByTestId('inspection-provenance')).toHaveText('OBSERVED LIVE SCALAR');
  await expect(page.getByTestId('scalar-operation')).toContainText('multiply');
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('repeat Teach uses current model; edits and reset preserve explicitly earlier comparisons', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#teach').click(); await expect(page.getByTestId('guided-completed')).toHaveText('10');
  await expect(page.locator('#teach')).toBeEnabled();
  await page.locator('#teach').click(); await expect(page.getByTestId('training-step')).toHaveText('20');
  await expect(page.locator('#teach')).toBeEnabled();
  expect(Number(await page.getByTestId('guided-before').getAttribute('data-value'))).toBeCloseTo(measured(10), 12);
  expect(Number(await page.getByTestId('guided-after').getAttribute('data-value'))).toBeCloseTo(measured(20), 12);
  await expect(page.getByTestId('guided-completed')).toHaveText('10');
  await page.getByTestId('document-input').fill('cccc');
  await expect(page.getByTestId('run-state')).toHaveText('STALE EVIDENCE');
  await expect(page.locator('#teach')).toBeDisabled();
  await expect(page.getByTestId('guided-change')).toContainText('This comparison used abca');
  await page.locator('#predict').click(); await expect(page.locator('#teach')).toBeEnabled();
  await expect(page.getByTestId('guided-target')).toHaveText('c');
  await expect(page.getByTestId('guided-change')).toContainText('Earlier teaching comparison');
  await page.locator('#guided-explore').click();
  await expect(page.getByTestId('captured-input')).toHaveText('abca');
  expect(Number(await page.getByTestId('probabilities').locator('code').first().getAttribute('title'))).toBeCloseTo(measured(20), 12);
  const comparedRun = await page.locator('#history-run').inputValue();
  await page.getByRole('button', { name: 'Guided', exact: true }).click();
  await page.locator('#guided-microscope').click();
  await expect(page.getByTestId('inspection-provenance')).toHaveText('VERIFIED RECOMPUTATION');
  await expect(page.getByTestId('microscope-evidence')).toContainText(comparedRun);
  await page.getByRole('button', { name: 'Guided', exact: true }).click();
  await page.locator('#reset').click(); await expect(page.getByTestId('training-step')).toHaveText('0');
  await expect(page.locator('#teach')).toBeDisabled();
  await expect(page.getByTestId('guided-change')).toContainText('Earlier teaching comparison');
  await page.locator('#clear-session').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await expect(page.getByTestId('guided-before')).toHaveCount(0);
});

test('cancelling a Guided batch reports only completed updates and their actual probabilities', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (Number(document.querySelector('[data-testid="guided-completed"]')?.textContent) >= 2) {
        observer.disconnect(); (document.querySelector('#cancel') as HTMLButtonElement).click();
      }
    });
    observer.observe(document.querySelector('#app')!, { childList: true, subtree: true });
  });
  await page.locator('#teach').click();
  await expect(page.getByTestId('status')).toContainText('Cancelled');
  const completed = Number(await page.getByTestId('guided-completed').textContent());
  expect(completed).toBeGreaterThanOrEqual(2); expect(completed).toBeLessThan(10);
  await expect(page.getByTestId('training-step')).toHaveText(String(completed));
  expect(Number(await page.getByTestId('guided-after').getAttribute('data-value'))).toBeCloseTo(measured(completed), 12);
  await expect(page.locator('#teach')).toBeDisabled();
  await page.locator('#predict').click(); await expect(page.locator('#teach')).toBeEnabled();
});

test('Guided narrow touch lesson has no overflow and retains progressive disclosure', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage(); await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#teach').tap(); await expect(page.getByTestId('guided-completed')).toHaveText('10');
  await expect(page.locator('#teach')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#parameter-select')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/model-lab-v2.1-guided-mobile.png', fullPage: true });
  await context.close();
});


test('Guided preserves the declared intervention when opening a head-ablation run', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByText('Experiment · head ablation', { exact: true }).click();
  await page.locator('#ablate-head').click();
  await expect(page.getByTestId('status')).toContainText('Observed ablation complete');
  await page.getByRole('button', { name: 'Guided', exact: true }).click();
  await expect(page.getByTestId('intervention-declaration')).toContainText('one attention head’s output was disabled');
  await expect(page.locator('#teach')).toBeDisabled();
});

test('optimizer exhaustion retains the last completed partial lesson for later comparison drilldown', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/'); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByTestId('document-input').fill('ab');
  await page.getByText('Bounded learning and complete capture', { exact: true }).click();
  for (const count of [500, 495]) {
    await page.locator('#training-count').fill(String(count)); await page.locator('#training-count').press('Tab');
    await page.locator('#train-many').click();
    await expect(page.getByTestId('document-input')).toBeEnabled({ timeout: 90000 });
  }
  await expect(page.getByTestId('training-step')).toHaveText('995');
  await page.getByRole('button', { name: 'Guided', exact: true }).click();
  await page.locator('#teach').click();
  await expect(page.getByRole('alert')).toContainText('exhausted training schedule');
  await expect(page.getByTestId('document-input')).toBeEnabled();
  await expect(page.getByTestId('guided-completed')).toHaveText('5');
  await expect(page.getByTestId('training-step')).toHaveText('1000');
  const after = Number(await page.getByTestId('guided-after').getAttribute('data-value'));
  await page.locator('#guided-explore').click();
  const expectedCompletedRun = await page.locator('#history-run').inputValue();
  await page.getByRole('button', { name: 'Guided', exact: true }).click();
  await page.locator('#predict').click(); await expect(page.getByTestId('document-input')).toBeEnabled();
  await expect(page.getByTestId('guided-change')).toContainText('Earlier teaching comparison');
  await page.locator('#guided-explore').click();
  expect(Number(await page.getByTestId('probabilities').locator('code').nth(1).getAttribute('title'))).toBe(after);
  const completedRun = await page.locator('#history-run').inputValue();
  expect(completedRun).toBe(expectedCompletedRun);
  await page.getByRole('button', { name: 'Guided', exact: true }).click();
  await page.locator('#guided-microscope').click();
  await expect(page.getByTestId('inspection-provenance')).toHaveText('VERIFIED RECOMPUTATION');
  await expect(page.getByTestId('microscope-evidence')).toContainText(completedRun);
});


test('Clear session during partial-batch cancellation cannot count old evidence into the new session', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const initialHistory = await page.getByTestId('history-count').textContent();
  await page.getByRole('button', { name: 'Guided', exact: true }).click();
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (Number(document.querySelector('[data-testid="guided-completed"]')?.textContent) === 2) {
        observer.disconnect();
        (document.querySelector('#cancel') as HTMLButtonElement).click();
        (document.querySelector('#clear-session') as HTMLButtonElement).click();
      }
    });
    observer.observe(document.querySelector('#app')!, { childList: true, subtree: true });
  });
  await page.locator('#teach').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await expect(page.getByTestId('training-step')).toHaveText('0');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByTestId('history-count')).toHaveText(initialHistory!);
});

test('Guided depth navigation rebinds attention arithmetic and clamps the selected key', async ({ page }) => {
  await page.goto('/'); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  for (const action of ['#why-prediction', '#guided-explore', '#guided-microscope']) {
    if (action !== '#why-prediction') {
      await page.getByRole('button', { name: 'Guided', exact: true }).click();
      await page.locator('#teach').click();
      await expect(page.getByTestId('document-input')).toBeEnabled();
    }
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await page.locator('[data-query="4"][data-key="4"]').click();
    await expect(page.getByTestId('attention-detail')).toContainText('all 5 available key logits');
    await page.getByRole('button', { name: 'Guided', exact: true }).click();
    await page.locator(action).click();
    await expect(page.locator('[data-token="3"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-query="3"][data-key="3"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('attention-detail')).toContainText('all 4 available key logits');
    const arithmetic = await page.getByTestId('attention-detail').textContent();
    await page.locator('[data-token="3"]').click();
    await expect(page.getByTestId('attention-detail')).toHaveText(arithmetic!);
  }
});
