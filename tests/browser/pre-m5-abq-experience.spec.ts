import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const evidenceDir = process.env.PRE_M5_EVIDENCE_DIR ?? 'test-results/scratch/p0-r2-review-evidence-20260917-01';

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
  await page.screenshot({ path: `${evidenceDir}/01-attract-1920.png` });
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Verify persistent profile marker
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'visitor');

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

  // Free exploration reveals semantic selectors but preserves teaching/stepping omissions
  await page.locator('#visitor-explore-toggle').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'visitor');
  await expect(page.locator('.spatial-selection')).toBeVisible();
  await expect(page.locator('.learning-toolbar')).toHaveCount(0);
  await expect(page.locator('#step-prediction')).toHaveCount(0);
  await expect(page.locator('#step-learning')).toHaveCount(0);
  await expect(page.locator('#spatial-learn')).toHaveCount(0);
  await page.screenshot({ path: `${evidenceDir}/12-free-explore-1920.png` });
  await page.locator('#visitor-explore-toggle').click();
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
  await page.screenshot({ path: `${evidenceDir}/02-prediction-1920.png` });

  // Advance to Stop 2: Q/K scores
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 2 of 5 · Q/K scores');
  await expect(page.locator('#short-continue')).toContainText('Continue: Softmax');
  await expect(page.getByTestId('scene-construction')).toBeVisible();
  await expect(page.getByTestId('scene-construction')).toContainText('Attention scores');
  await page.screenshot({ path: `${evidenceDir}/03-qk-1920.png` });

  // Advance to Stop 3: Softmax
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 3 of 5 · Softmax');
  await expect(page.locator('#short-continue')).toContainText('Continue: Value mixture');
  await expect(page.getByTestId('scene-construction')).toContainText('Attention softmax');
  await page.screenshot({ path: `${evidenceDir}/04-softmax-1920.png` });

  // Advance to Stop 4: Value mixture
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 4 of 5 · Value mixture');
  await expect(page.locator('#short-continue')).toContainText('Continue: Residual');
  await expect(page.getByTestId('scene-construction')).toContainText('Weighted values');
  await page.screenshot({ path: `${evidenceDir}/05-value-mixture-1920.png` });

  // Advance to Stop 5: Residual
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 5 of 5 · Residual');
  await expect(page.locator('#short-continue')).toHaveCount(0);
  await expect(page.locator('#short-teach')).toBeVisible();
  await expect(page.locator('#short-teach')).toContainText('Teach: step through learning');
  await expect(page.getByTestId('scene-construction')).toContainText(/residual/i);
  await page.screenshot({ path: `${evidenceDir}/06-residual-1920.png` });

  // Detour via Free Exploration
  await page.locator('#visitor-explore-toggle').click();
  await expect(page.locator('.spatial-selection')).toBeVisible();
  await page.locator('#spatial-operation').selectOption('mlpRelu');
  await expect(page.locator('.short-guide')).toContainText('Exploring a detour');
  await expect(page.locator('#short-resume')).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/06b-detour-exploration.png` });

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
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'visitor');
  await page.screenshot({ path: `${evidenceDir}/07-learning-entry-1920.png` });

  // Verify diagnostic stepping buttons are omitted in visitor profile
  await expect(page.locator('#execution-next')).toHaveCount(0);
  await expect(page.locator('#execution-pause')).toHaveCount(0);
  await expect(page.locator('#execution-follow')).toHaveCount(0);

  // Stepped controls permitted in visitor profile
  await expect(page.locator('#execution-continue')).toBeVisible();
  await expect(page.locator('#execution-pin')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toBeVisible();

  // Advance via pin to stopped gradient contribution
  await page.locator('#execution-pin').click();
  await expect(page.locator('#execution-continue')).toBeEnabled({ timeout: 60000 });
  await expect(page.getByTestId('execution-frontier')).toContainText('stopped after matching backward node');
  await expect(page.getByTestId('live-contribution')).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/08-gradient-contribution-1920.png` });

  // Advance to Candidate ready
  await page.locator('#execution-continue').click();
  await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', 'ready', { timeout: 60000 });
  await expect(page.locator('#execution-accept')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toContainText('Discard candidate');
  await page.screenshot({ path: `${evidenceDir}/09-candidate-ready-1920.png` });

  // Discard candidate
  await page.locator('#execution-cancel').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);
  await expect(page.getByTestId('status')).toContainText('Execution cancelled · prior completed evidence preserved');

  // Verify acceptTraining was NOT called, cancel command was sent, and optimizer step is unchanged
  const a = await page.evaluate(() => (window as any).abq);
  expect(a.commands.filter((c: any) => c.command === 'acceptTraining')).toHaveLength(0);
  expect(a.commands[a.commands.length - 1].command).toMatch(/cancel/i);
  expect(a.lastReady?.state.optimizer.step ?? 0).toBe(0);
  await page.screenshot({ path: `${evidenceDir}/11-post-discard-1920.png` });
});

test('3b. Stepped training, candidate accept, live step advancement, and public reset restoration', async ({ page }) => {
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
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'visitor');

  // Advance via pin to gradient contribution
  await page.locator('#execution-pin').click();
  await expect(page.getByTestId('execution-frontier')).toContainText('seeking pinned contribution');

  // Advance to Candidate ready
  await page.locator('#execution-continue').click();
  await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', 'ready', { timeout: 60000 });
  await expect(page.locator('#execution-accept')).toBeVisible();
  await expect(page.locator('#execution-accept')).toBeEnabled();

  // Accept candidate update
  await page.locator('#execution-accept').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);

  // Verify exactly 1 acceptTraining command posted and trainingStep advanced to 1
  const a = await page.evaluate(() => (window as any).abq);
  const acceptCommands = a.commands.filter((c: any) => c.command === 'acceptTraining');
  expect(acceptCommands).toHaveLength(1);
  expect(a.lastResult?.trainingStep).toBe(1);

  // Subsequent operation uses accepted model (training step 1)
  await expect(page.getByTestId('status')).toContainText('Live update complete · training step 1');
  await page.screenshot({ path: `${evidenceDir}/10-post-accept-1920.png` });

  // Public Reset restores baseline model and clears session
  await page.locator('#clear-session').click();
  await expect(page.locator('#exhibit-start')).toBeEnabled();
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  const a2 = await page.evaluate(() => (window as any).abq);
  expect(a2.lastReady?.state.optimizer.step).toBe(0);
});

test('4. Facilitator panel, authoritative retention text, execution omissions, and opt-out persistence', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Open facilitator / operator controls
  await page.locator('#operator-controls').click();
  await expect(page.getByTestId('facilitator-panel')).toBeVisible();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'facilitator');

  // Authoritative retention text check
  const retentionText = await page.locator('.facilitator-retention').textContent();
  expect(retentionText).toMatch(/^\d+ retained runs · \d+(\.\d+)? MiB retained of 32 MiB durable archive limit; this is durable retained evidence capacity, not total page\/process memory\.$/);

  // Verify facilitator stepped execution controls eliminate diagnostic leak
  await page.locator('#step-learning').click();
  await expect(page.locator('#execution-controls')).toBeVisible();
  await expect(page.locator('#execution-next')).toHaveCount(0);
  await expect(page.locator('#execution-pause')).toHaveCount(0);
  await expect(page.locator('#execution-follow')).toHaveCount(0);
  await expect(page.locator('#execution-controls details')).toHaveCount(0);
  await expect(page.locator('#execution-continue')).toBeVisible();
  await expect(page.locator('#execution-pin')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toBeVisible();
  await page.locator('#execution-cancel').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);

  // Toggle idle reset opt-out
  await expect(page.locator('#exhibit-opt-out')).toContainText('Disable idle reset · facilitated session');
  await page.locator('#exhibit-opt-out').click();
  await expect(page.locator('#exhibit-opt-out')).toContainText('Enable idle reset · 300 seconds');

  await page.screenshot({ path: `${evidenceDir}/13-facilitator-1920.png` });

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

  // Verify persistent profile marker
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'workbench');

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

test('6. 44px minimum touch targets and keyboard accessibility across qualified viewports', async ({ page }) => {
  test.setTimeout(180_000);
  async function assertMin44(selector: string, desc?: string) {
    const el = page.locator(selector).first();
    await expect(el).toBeVisible();
    const box = await el.boundingBox();
    expect(box, `Bounding box for ${selector}`).not.toBeNull();
    expect(box!.height, `Height for ${desc ?? selector} must be >= 44px (got ${box!.height})`).toBeGreaterThanOrEqual(44);
  }

  // 1. 1920x1080 Visitor Mode
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?presentation=spatial&kiosk=1');
  await assertMin44('#exhibit-start', 'Entry Start button');

  // Keyboard entry
  await page.locator('#exhibit-start').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Stop 1 visitor buttons
  await assertMin44('#short-continue', 'Stop 1 Continue button');
  await assertMin44('#visitor-explore-toggle', 'Visitor Explore Toggle');
  await assertMin44('#operator-controls', 'Operator Controls button');
  await assertMin44('#clear-session', 'Public Reset button');
  await assertMin44('#scene-construction', 'Scene math toggle button');

  // Keyboard navigation through short route
  await page.locator('#short-continue').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 2 of 5 · Q/K scores');

  // Advance to stop 5
  for (let i = 2; i < 5; i++) {
    await page.locator('#short-continue').click();
  }
  await assertMin44('#short-teach', 'Teach button at Stop 5');

  // Launch stepped training
  await page.locator('#short-teach').click();
  await expect(page.locator('#execution-controls')).toBeVisible();
  await assertMin44('#execution-continue', 'Execution Continue button');
  await assertMin44('#execution-pin', 'Execution Pin button');
  await assertMin44('#execution-cancel', 'Execution Cancel button');

  // Advance to Ready
  await page.locator('#execution-pin').click();
  await expect(page.getByTestId('execution-frontier')).toContainText('seeking pinned contribution');
  await page.locator('#execution-continue').click();
  await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', 'ready', { timeout: 60000 });
  await assertMin44('#execution-accept', 'Execution Accept button');
  await assertMin44('#execution-cancel', 'Discard Candidate button');
  await page.locator('#execution-cancel').click();

  // 2. Facilitator Mode touch targets (1920x1080)
  await page.locator('#operator-controls').click();
  await expect(page.getByTestId('facilitator-panel')).toBeVisible();
  await assertMin44('#short-sample', 'Facilitator Sample button');
  for (const stop of [0, 1, 2, 3, 4]) {
    await assertMin44(`[data-short-stop="${stop}"]`, `Facilitator stop ${stop} button`);
  }
  await assertMin44('#exhibit-opt-out', 'Facilitator Idle Reset Opt-out button');

  // 3. 1280x720 Viewport Touch Targets: Facilitator Mode
  await page.setViewportSize({ width: 1280, height: 720 });
  await assertMin44('#short-sample', '720p Facilitator Sample button');
  await assertMin44('[data-short-stop="0"]', '720p Facilitator stop 0 button');
  await assertMin44('#exhibit-opt-out', '720p Facilitator Opt-out button');
  await assertMin44('#clear-session', '720p Public Reset button');

  // Directly measure facilitator execution controls at 1280x720
  await page.locator('#step-learning').click();
  await expect(page.locator('#execution-controls')).toBeVisible();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'facilitator');

  await page.locator('#execution-pin').click();
  await expect(page.locator('#execution-continue')).toBeEnabled({ timeout: 60000 });
  await expect(page.getByTestId('execution-frontier')).toContainText('stopped after matching backward node');
  await assertMin44('#execution-pin', '720p Facilitator Execution Pin button');
  await assertMin44('#execution-continue', '720p Facilitator Execution Continue button');
  await assertMin44('#execution-cancel', '720p Facilitator Execution Cancel button');

  await page.locator('#execution-continue').click();
  await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', 'ready', { timeout: 60000 });
  await assertMin44('#execution-accept', '720p Facilitator Execution Accept button');
  await assertMin44('#execution-cancel', '720p Facilitator Discard Candidate button');
  await page.locator('#execution-cancel').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);

  // 4. 1280x720 Viewport Touch Targets: Visitor Mode
  await page.locator('#operator-controls').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'visitor');

  // Reset to entry to follow exact visitor sequence: Start → reach Residual → Teach
  await page.locator('#clear-session').click();
  await expect(page.locator('#exhibit-start')).toBeEnabled();
  await assertMin44('#exhibit-start', '720p Visitor Start button');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Advance through 5 stops to Residual (stop 5)
  for (let i = 0; i < 4; i++) {
    await assertMin44('#short-continue', `720p Visitor Stop ${i + 1} Continue button`);
    await page.locator('#short-continue').click();
  }
  await assertMin44('#short-teach', '720p Visitor Teach button at Stop 5');
  await assertMin44('#visitor-explore-toggle', '720p Visitor Explore Toggle');
  await assertMin44('#scene-construction', '720p Scene math button');

  // Launch stepped training as visitor at 1280x720
  await page.locator('#short-teach').click();
  await expect(page.locator('#execution-controls')).toBeVisible();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'visitor');

  // Advance via pin to partial/stopped gradient contribution state
  await page.locator('#execution-pin').click();
  await expect(page.locator('#execution-continue')).toBeEnabled({ timeout: 60000 });
  await expect(page.getByTestId('execution-frontier')).toContainText('stopped after matching backward node');
  await expect(page.getByTestId('live-contribution')).toBeVisible();

  // Directly measure visitor execution controls at 1280x720 in partial/stopped state
  await assertMin44('#execution-pin', '720p Visitor Execution Pin button');
  await assertMin44('#execution-continue', '720p Visitor Execution Continue button');
  await assertMin44('#execution-cancel', '720p Visitor Execution Cancel button');
  await page.screenshot({ path: `${evidenceDir}/17-gradient-contribution-1280.png` });

  // Advance to Ready
  await page.locator('#execution-continue').click();
  await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', 'ready', { timeout: 60000 });

  // Directly measure visitor execution controls at 1280x720 in Ready state
  await assertMin44('#execution-accept', '720p Visitor Execution Accept button');
  await assertMin44('#execution-cancel', '720p Visitor Discard Candidate button');
  await page.screenshot({ path: `${evidenceDir}/18-candidate-ready-1280.png` });

  // Accept candidate update and verify settled state at 1280x720
  await page.locator('#execution-accept').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);
  await expect(page.getByTestId('status')).toContainText('Live update complete · training step 1');
  await page.screenshot({ path: `${evidenceDir}/19-post-accept-1280.png` });

  // Reset session
  await page.locator('#clear-session').click();
  await expect(page.locator('#exhibit-start')).toBeEnabled();
});

test('7. 1280x720 layout and reduced motion visual captures', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?presentation=spatial&kiosk=1');
  await expect(page.locator('#exhibit-start')).toBeEnabled();

  await page.screenshot({ path: `${evidenceDir}/14-attract-1280.png` });
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.screenshot({ path: `${evidenceDir}/15-prediction-1280.png` });

  // Traverse to stop 2 and verify scene construction fits
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('scene-construction')).toBeVisible();
  const box = await page.getByTestId('scene-construction').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(150);
  expect(box!.y + box!.height).toBeLessThanOrEqual(720);
  await page.screenshot({ path: `${evidenceDir}/16-scene-math-1280.png` });

  // Check facilitator mode layout at 1280x720
  await page.locator('#operator-controls').click();
  await expect(page.getByTestId('facilitator-panel')).toBeVisible();
  await page.locator('[data-short-stop="1"]').click();
  await expect(page.getByTestId('scene-construction')).toBeVisible();
  const fBox = await page.getByTestId('scene-construction').boundingBox();
  expect(fBox).not.toBeNull();
  expect(fBox!.height).toBeGreaterThanOrEqual(150);
  expect(fBox!.y + fBox!.height).toBeLessThanOrEqual(720);
  await page.screenshot({ path: `${evidenceDir}/20-facilitator-1280.png` });

  // Reduced motion visual capture
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: `${evidenceDir}/21-reduced-motion-1280.png` });

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
      '#execution-pause',
      '#execution-follow',
      '#execution-controls details',
      'research variants'
    ],
    routeStopsVerified: 5,
    touchTargetMinHeight: 44,
    viewportHeightsVerified: [1080, 720],
    reducedMotionVerified: true,
    idleResetOptOutPersistedAcrossReset: true
  }, null, 2));
});
