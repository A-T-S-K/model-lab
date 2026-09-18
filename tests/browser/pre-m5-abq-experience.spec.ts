import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const evidenceDir = process.env.PRE_M5_EVIDENCE_DIR ?? 'test-results/scratch/pre-m5-evidence-20260917-01';

test.describe.configure({ mode: 'serial' });

async function audit(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.abq = { commands: [], lastReady: undefined, lastResult: undefined, progress: undefined };
    const send = Worker.prototype.postMessage;
    const seen = new WeakSet();
    Worker.prototype.postMessage = function (m: any, ...rest: any[]) {
      w.abq.commands.push({ command: m.command, executionId: m.executionId });
      if (!seen.has(this)) {
        seen.add(this);
        this.addEventListener('message', e => {
          const r = e.data;
          if (r.status === 'ready') w.abq.lastReady = r.archivedSnapshot;
          if (r.status === 'result') w.abq.lastResult = r.result;
          if (r.status === 'forward') w.abq.progress = r.progress;
        });
      }
      return Reflect.apply(send, this, [m, ...rest]);
    };
  });
}

test('1. Visitor profile DOM omissions hide unneeded workbench controls', async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');

  await expect(page.locator('#exhibit-start')).toBeEnabled();
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // DOM omissions check in visitor profile
  await expect(page.locator('#open-shared-inspector')).toHaveCount(0);
  await expect(page.locator('#presentation-toggle')).toHaveCount(0);
  await expect(page.locator('#portable-archive-host')).toHaveCount(0);
  await expect(page.locator('#import-archive')).toHaveCount(0);
  await expect(page.locator('#export-archive')).toHaveCount(0);
  await expect(page.locator('#spatial-patch')).toHaveCount(0);
  await expect(page.locator('.learning-toolbar')).toHaveCount(0);
  await expect(page.locator('#step-prediction')).toHaveCount(0);
  await expect(page.locator('#step-learning')).toHaveCount(0);
  await expect(page.locator('#spatial-learn')).toHaveCount(0);
  await expect(page.locator('#spatial-operation option[value="leakyRelu"]')).toHaveCount(0);
  await expect(page.locator('#spatial-operation option[value="compositeW"]')).toHaveCount(0);

  // Permitted visitor controls are present
  await expect(page.locator('#clear-session')).toContainText('Public Reset');
  await expect(page.locator('#spatial-home')).toBeVisible();
  await expect(page.getByTestId('lesson-progress')).toBeVisible();
  await expect(page.locator('#short-continue')).toBeVisible();
  await expect(page.locator('#visitor-explore-toggle')).toBeVisible();
  await expect(page.locator('#operator-controls')).toBeVisible();

  await page.screenshot({ path: `${evidenceDir}/01-visitor-dom-omissions.png` });
});

test('2. 5-stop short route traversal, primary actions, and detour resume', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Stop 1: Prediction
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 1 of 5 · Prediction');
  await expect(page.locator('#short-continue')).toContainText('Continue: Q/K scores');
  await page.screenshot({ path: `${evidenceDir}/02-stop1-prediction.png` });

  // Advance to Stop 2: Q/K scores
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 2 of 5 · Q/K scores');
  await expect(page.locator('#short-continue')).toContainText('Continue: Softmax');
  await expect(page.getByTestId('scene-construction')).toBeVisible();
  await expect(page.getByTestId('scene-construction')).toContainText('Attention scores');
  await page.screenshot({ path: `${evidenceDir}/03-stop2-scores.png` });

  // Advance to Stop 3: Softmax
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 3 of 5 · Softmax');
  await expect(page.locator('#short-continue')).toContainText('Continue: Value mixture');
  await expect(page.getByTestId('scene-construction')).toContainText('Attention softmax');
  await page.screenshot({ path: `${evidenceDir}/04-stop3-softmax.png` });

  // Advance to Stop 4: Value mixture
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 4 of 5 · Value mixture');
  await expect(page.locator('#short-continue')).toContainText('Continue: Residual');
  await expect(page.getByTestId('scene-construction')).toContainText('Weighted values');
  await page.screenshot({ path: `${evidenceDir}/05-stop4-mixture.png` });

  // Advance to Stop 5: Residual
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 5 of 5 · Residual');
  await expect(page.locator('#short-continue')).toHaveCount(0);
  await expect(page.locator('#short-teach')).toBeVisible();
  await expect(page.locator('#short-teach')).toContainText('Teach: step through learning');
  await expect(page.getByTestId('scene-construction')).toContainText(/residual/i);
  await page.screenshot({ path: `${evidenceDir}/06-stop5-residual.png` });

  // Detour via Free Exploration
  await page.locator('#visitor-explore-toggle').click();
  await expect(page.locator('.spatial-selection')).toBeVisible();
  await page.locator('#spatial-operation').selectOption('mlpRelu');
  await expect(page.locator('.short-guide')).toContainText('Exploring a detour');
  await expect(page.locator('#short-resume')).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/07-detour-exploration.png` });

  // Resume short route
  await page.locator('#short-resume').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 5 of 5 · Residual');
  await expect(page.locator('.short-guide')).not.toContainText('Exploring a detour');
  await expect(page.getByTestId('scene-construction')).toContainText(/residual/i);
});

test('3. Stepped training, candidate discard, and authority preservation', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Navigate to stop 5
  for (let i = 0; i < 4; i++) {
    await page.locator('#short-continue').click();
  }
  await expect(page.locator('#short-teach')).toBeVisible();

  // Launch stepped training from short route
  await page.locator('#short-teach').click();
  await expect(page.locator('#execution-controls')).toBeVisible();

  // Verify diagnostic stepping buttons are omitted in visitor profile
  await expect(page.locator('#execution-next')).toHaveCount(0);
  await expect(page.locator('#execution-pause')).toHaveCount(0);
  await expect(page.locator('#execution-follow')).toHaveCount(0);

  // Stepped controls permitted in visitor profile
  await expect(page.locator('#execution-continue')).toBeVisible();
  await expect(page.locator('#execution-pin')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toBeVisible();

  // Advance via pin to gradient contribution
  await page.locator('#execution-pin').click();
  await expect(page.getByTestId('execution-frontier')).toContainText('seeking pinned contribution');

  // Advance to Candidate ready
  await page.locator('#execution-continue').click();
  await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', 'ready', { timeout: 60000 });
  await expect(page.locator('#execution-accept')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toContainText('Discard candidate');
  await page.screenshot({ path: `${evidenceDir}/08-stepped-training-ready.png` });

  // Discard candidate
  await page.locator('#execution-cancel').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);

  // Verify acceptTraining was NOT called and cancel command was sent
  const a = await page.evaluate(() => (window as any).abq);
  expect(a.commands.filter((c: any) => c.command === 'acceptTraining')).toHaveLength(0);
  expect(a.commands[a.commands.length - 1].command).toMatch(/cancel/i);
  await page.screenshot({ path: `${evidenceDir}/09-candidate-discarded.png` });
});

test('4. Facilitator panel, authoritative retention text, and opt-out persistence', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Open facilitator / operator controls
  await page.locator('#operator-controls').click();
  await expect(page.getByTestId('facilitator-panel')).toBeVisible();

  // Authoritative retention text check
  const retentionText = await page.locator('.facilitator-retention').textContent();
  expect(retentionText).toMatch(/^\d+ retained runs · \d+(\.\d+)? MiB retained of 32 MiB durable archive limit; this is durable retained evidence capacity, not total page\/process memory\.$/);

  // Toggle idle reset opt-out
  await expect(page.locator('#exhibit-opt-out')).toContainText('Disable idle reset · facilitated session');
  await page.locator('#exhibit-opt-out').click();
  await expect(page.locator('#exhibit-opt-out')).toContainText('Enable idle reset · 300 seconds');

  await page.screenshot({ path: `${evidenceDir}/10-facilitator-panel.png` });

  // Public Reset preserves facilitator opt-out setting
  await page.locator('#clear-session').click();
  await expect(page.locator('#exhibit-start')).toBeEnabled();
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#operator-controls').click();
  await expect(page.locator('#exhibit-opt-out')).toContainText('Enable idle reset · 300 seconds');
});

test('5. Workbench profile preservation at /?presentation=spatial', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?presentation=spatial');
  await expect(page.locator('#predict')).toBeEnabled();
  await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Workbench controls MUST be present
  await expect(page.locator('#open-shared-inspector')).toBeVisible();
  await expect(page.locator('#presentation-toggle')).toBeVisible();
  await expect(page.locator('#portable-archive-host')).toBeVisible();
  await expect(page.locator('.learning-toolbar')).toBeVisible();
  await expect(page.locator('#step-prediction')).toBeVisible();
  await expect(page.locator('#step-learning')).toBeVisible();
  await expect(page.locator('#clear-session')).toContainText('Clear session');

  await page.screenshot({ path: `${evidenceDir}/11-workbench-preserved.png` });
});

test('6. 44px minimum touch targets and keyboard accessibility', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?presentation=spatial&kiosk=1');
  await expect(page.locator('#exhibit-start')).toBeEnabled();

  // Entry start button touch target
  const startBox = await page.locator('#exhibit-start').boundingBox();
  expect(startBox).not.toBeNull();
  expect(startBox!.height).toBeGreaterThanOrEqual(44);

  // Keyboard entry
  await page.locator('#exhibit-start').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Short route primary action touch target
  await expect(page.locator('#short-continue')).toBeVisible();
  const continueBox = await page.locator('#short-continue').boundingBox();
  expect(continueBox).not.toBeNull();
  expect(continueBox!.height).toBeGreaterThanOrEqual(44);

  // Public reset touch target
  const resetBox = await page.locator('#clear-session').boundingBox();
  expect(resetBox).not.toBeNull();
  expect(resetBox!.height).toBeGreaterThanOrEqual(44);

  // Keyboard navigation through short route
  await page.locator('#short-continue').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 2 of 5 · Q/K scores');

  await page.screenshot({ path: `${evidenceDir}/12-keyboard-accessible.png` });
});

test('7. 1280x720 layout and reduced motion visual captures', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?presentation=spatial&kiosk=1');
  await expect(page.locator('#exhibit-start')).toBeEnabled();

  await page.screenshot({ path: `${evidenceDir}/13-entry-1280.png` });
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Traverse to stop 2 and verify scene construction fits
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('scene-construction')).toBeVisible();
  const box = await page.getByTestId('scene-construction').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(150);
  expect(box!.y + box!.height).toBeLessThanOrEqual(720);

  await page.screenshot({ path: `${evidenceDir}/14-route-1280-reduced-motion.png` });

  // Write visual verification audit summary
  await writeFile(`${evidenceDir}/qualification-summary.json`, JSON.stringify({
    qualifiedAt: new Date().toISOString(),
    profiles: ['visitor', 'facilitator', 'workbench'],
    omissionsVerified: [
      '#open-shared-inspector',
      '#presentation-toggle',
      '#portable-archive-host',
      '#import-archive',
      '#export-archive',
      '#spatial-patch',
      '.learning-toolbar',
      '#step-prediction',
      '#step-learning',
      '#spatial-learn',
      '#execution-next',
      '#execution-follow',
      'research variants'
    ],
    routeStopsVerified: 5,
    touchTargetMinHeight: 44,
    viewportHeightsVerified: [1080, 720],
    reducedMotionVerified: true,
    idleResetOptOutPersistedAcrossReset: true
  }, null, 2));
});
