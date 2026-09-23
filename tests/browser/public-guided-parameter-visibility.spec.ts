import { expect, test, type Page } from '@playwright/test';

const parameters = ['wte', 'wpe', 'layer0.attn_wq', 'layer0.attn_wk', 'layer0.attn_wv', 'layer0.attn_wo', 'layer0.mlp_fc1', 'layer0.mlp_fc2', 'lm_head'];

async function visibleParameterIds(page: Page): Promise<string[]> {
  return page.locator('#spatial-world .parameter-bank').evaluateAll(elements =>
    elements.filter(element => getComputedStyle(element).visibility === 'visible')
      .map(element => element.getAttribute('data-world-parameter') ?? ''),
  );
}

test('public Guided defers unrelated parameter banks and owner edges, while Part 2 and Explore reveal them', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/?presentation=spatial&kiosk=1');
  await page.locator('#exhibit-start').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state', 'p1_prediction_preview');
  await expect(page.locator('#spatial-world .parameter-bank')).toHaveCount(parameters.length);
  expect(await page.locator('#spatial-world .parameter-bank').evaluateAll(elements =>
    elements.map(element => element.getAttribute('data-world-parameter')),
  )).toEqual(parameters);
  expect(await visibleParameterIds(page)).toEqual([]);
  expect(await page.locator('#spatial-world .parameter-edge').evaluateAll(elements =>
    elements.every(element => getComputedStyle(element).visibility === 'hidden'),
  )).toBe(true);

  await page.locator('#spatial-world [data-world-kind="probabilities"]').dispatchEvent('click');
  await expect(page.locator('.world-workspace')).toHaveClass(/is-free-explore/);
  expect(await visibleParameterIds(page)).toEqual(parameters);
  expect(await page.locator('#spatial-world .parameter-edge').evaluateAll(elements =>
    elements.every(element => getComputedStyle(element).visibility === 'visible'),
  )).toBe(true);

  await page.goto('/?presentation=spatial&kiosk=1');
  await page.locator('#exhibit-start').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state', 'p1_prediction_preview');
  expect(await visibleParameterIds(page)).toEqual([]);
  for (let i = 0; i < 10; i++) await page.locator('#short-continue').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state', 'p1_complete');
  await page.locator('#short-teach').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state', 'p2_objective');

  for (const state of ['p2_backward_trace', 'p2_gradient_contribution', 'p2_final_gradient', 'p2_adam_proposal']) {
    await expect(page.locator('#reverse-continue')).toBeEnabled({ timeout: 60_000 });
    await page.locator('#reverse-continue').click();
    await expect(page.locator('.spatial-shell')).toHaveAttribute('data-public-canonical-state', state, { timeout: 60_000 });
    if (state === 'p2_backward_trace') continue;
    await expect(page.locator('#spatial-world .parameter-bank.explanation-active')).toHaveCount(1);
    expect(await visibleParameterIds(page)).toEqual(['wte']);
    expect(await page.locator('#spatial-world .parameter-edge').evaluateAll(elements =>
      elements.filter(element => getComputedStyle(element).visibility === 'visible').length,
    )).toBe(1);
  }
});
