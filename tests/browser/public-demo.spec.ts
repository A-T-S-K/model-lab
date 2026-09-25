import { expect, test } from '@playwright/test';

test('demo traverses the public lesson, discards, and restarts; visitor takes control', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/?presentation=spatial&demo=1');
  await expect(page.locator('.demo-indicator')).toHaveText('Demo mode · autoplay');
  const shell = page.locator('.spatial-shell');
  await expect(shell).toHaveAttribute('data-public-canonical-state', 'cold');
  const states = [
    'p1_prediction_preview', 'p1_represent', 'p1_qkv', 'p1_attention_compare',
    'p1_attention_weights', 'p1_value_mixture', 'p1_attention_integration',
    'p1_transform', 'p1_score', 'p1_probabilities', 'p1_complete',
    'p2_objective', 'p2_backward_trace', 'p2_gradient_contribution',
    'p2_final_gradient', 'p2_adam_proposal', 'candidate_ready', 'tour_complete',
  ];
  for (const state of states) {
    await expect(shell).toHaveAttribute('data-public-canonical-state', state, { timeout: 45_000 });
    if (state === 'p2_objective') {
      await expect(page.getByTestId('objective-anchor')).toHaveAttribute('data-objective-availability', 'available', { timeout: 45_000 });
    }
  }
  await expect(shell).toHaveAttribute('data-public-outcome', 'discarded');
  await expect(shell).toHaveAttribute('data-public-canonical-state', 'p1_prediction_preview', { timeout: 45_000 });
  await page.locator('#short-continue').click();
  await expect(page.locator('.demo-indicator')).toHaveCount(0);
  const state = await shell.getAttribute('data-public-canonical-state');
  await page.waitForTimeout(6_000);
  await expect(shell).toHaveAttribute('data-public-canonical-state', state!);
});
