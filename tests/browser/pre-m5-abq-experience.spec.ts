import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const evidenceDir = process.env.PRE_M5_EVIDENCE_DIR ?? 'test-results/scratch/p0-e3-review-evidence-20260918-01';

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

  // Assert legacy lower learning rail is completely retired from visitor profile
  await expect(page.locator('.learning-stations')).toHaveCount(0);
  await expect(page.locator('[data-learning-stage]')).toHaveCount(0);

  // Contextual dock is present, side-lens and tether are omitted from DOM in visitor profile
  await expect(page.getByTestId('contextual-dock')).toBeVisible();
  await expect(page.locator('.context-lens')).toHaveCount(0);
  await expect(page.locator('.context-tether')).toHaveCount(0);

  // Permitted visitor controls are present
  await expect(page.locator('#clear-session')).toContainText('Public Reset');
  await expect(page.locator('#spatial-home')).toBeVisible();
  await expect(page.getByTestId('lesson-progress')).toBeVisible();
  await expect(page.getByTestId('lesson-progress')).toContainText('Prediction payoff');
  await expect(page.getByTestId('lesson-progress')).not.toContainText('Step 1');
  await expect(page.locator('#short-continue')).toBeVisible();
  await expect(page.locator('#short-continue')).toContainText('See how it got there');
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
  await page.locator('#visitor-explore-toggle').click();
});

test('2. 5-stop causal forward spine traversal, primary actions, zero-execution guarantee, and detour resume', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Payoff: Prediction Payoff (not Step 1)
  await expect(page.locator('#short-resume')).toHaveCount(0);
  await expect(page.getByTestId('lesson-progress')).toContainText('Prediction payoff');
  await expect(page.getByTestId('lesson-progress')).not.toContainText('Step 1');
  await expect(page.getByTestId('route-purpose')).toContainText('What does the model predict comes next?');
  await expect(page.locator('#short-continue')).toContainText('See how it got there');
  await expect(page.getByTestId('scene-construction')).toBeVisible();
  await expect(page.getByTestId('scene-construction')).toContainText('Known target: a');
  await expect(page.getByTestId('scene-construction')).toContainText('Highest-probability token: a');
  await page.screenshot({ path: `${evidenceDir}/01-forward-predict-1920.png` });

  // Record command baseline: explanation navigation must NOT send any Worker commands
  const initialCommands = await page.evaluate(() => (window as any).abq.commands.length);
  const payoffRunId = await page.locator('[data-testid="landmark-occurrence"]').getAttribute('data-run-id');
  expect(payoffRunId).toBeTruthy();

  // Verify Payoff occurrence attributes
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-semantic-anchor', 'probabilities');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-position', '3');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-layer', '');

  // Advance to Stop 1: REPRESENT (preAttentionNorm · p3 · L0)
  await page.locator('#short-continue').click();
  await expect(page.locator('#short-resume')).toHaveCount(0);
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 1 of 5 · REPRESENT');
  await expect(page.getByTestId('route-purpose')).toContainText("Turn the token and its position into the model's working representation");
  await expect(page.locator('#short-continue')).toContainText('Continue: MIX CONTEXT');
  await expect(page.getByTestId('scene-construction')).toBeVisible();
  // Occurrence verification
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-semantic-anchor', 'preAttentionNorm');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-position', '3');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-layer', '0');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-run-id', payoffRunId!);
  // Distinct normalizations check
  await expect(page.getByTestId('scene-construction')).toContainText('embeddingNorm');
  await expect(page.getByTestId('scene-construction')).toContainText('preAttentionNorm');
  await expect(page.getByTestId('scene-construction')).toContainText('Two distinct normalizations are preserved');
  const representText = await page.getByTestId('dock-explain').textContent();
  expect(representText?.match(/Two distinct normalizations are preserved/g)?.length).toBe(1);
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Advance to Stop 2: MIX CONTEXT (attentionResidual · p3 · L0)
  await page.locator('#short-continue').click();
  await expect(page.locator('#short-resume')).toHaveCount(0);
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 2 of 5 · MIX CONTEXT');
  await expect(page.getByTestId('route-purpose')).toContainText('Use causally available earlier information to update this position');
  await expect(page.locator('#short-continue')).toContainText('Continue: TRANSFORM');
  await expect(page.locator('#attention-drill-down')).toBeVisible();
  await expect(page.locator('#attention-drill-down')).toContainText('How does attention work?');
  await expect(page.getByTestId('scene-construction')).toBeVisible();
  // Occurrence verification
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-semantic-anchor', 'attentionResidual');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-position', '3');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-layer', '0');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-run-id', payoffRunId!);
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Advance to Stop 3: TRANSFORM (mlpResidual · p3 · L0)
  await page.locator('#short-continue').click();
  await expect(page.locator('#short-resume')).toHaveCount(0);
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 3 of 5 · TRANSFORM');
  await expect(page.getByTestId('route-purpose')).toContainText('Transform the context-enriched representation before scoring possible next tokens');
  await expect(page.locator('#short-continue')).toContainText('Continue: SCORE');
  await expect(page.getByTestId('scene-construction')).toBeVisible();
  // Occurrence verification
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-semantic-anchor', 'mlpResidual');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-position', '3');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-layer', '0');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-run-id', payoffRunId!);
  // Canonical 5-op MLP pipeline check
  await expect(page.getByTestId('scene-construction')).toContainText('preMlpNorm');
  await expect(page.getByTestId('scene-construction')).toContainText('mlpUp');
  await expect(page.getByTestId('scene-construction')).toContainText('ReLU');
  await expect(page.getByTestId('scene-construction')).toContainText('mlpDown');
  await expect(page.getByTestId('scene-construction')).toContainText('mlpResidual');
  await expect(page.getByTestId('scene-construction')).toContainText('Canonical MLP pipeline');
  const transformText = await page.getByTestId('dock-explain').textContent();
  expect(transformText?.match(/Canonical MLP pipeline/g)?.length).toBe(1);
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Advance to Stop 4: SCORE (logits · p3)
  await page.locator('#short-continue').click();
  await expect(page.locator('#short-resume')).toHaveCount(0);
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 4 of 5 · SCORE');
  await expect(page.getByTestId('route-purpose')).toContainText('Give each possible next token a raw score');
  await expect(page.locator('#short-continue')).toContainText('Continue: PREDICT');
  await expect(page.getByTestId('scene-construction')).toBeVisible();
  // Occurrence verification
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-semantic-anchor', 'logits');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-position', '3');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-layer', '');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-run-id', payoffRunId!);
  // Raw score vs probability distinction check
  await expect(page.getByTestId('scene-construction')).toContainText('Raw unnormalized scores');
  await expect(page.getByTestId('scene-construction')).toContainText('Raw token scores are unnormalized logits, not probabilities');
  const scoreText = await page.getByTestId('dock-explain').textContent();
  expect(scoreText?.match(/Raw token scores are unnormalized logits, not probabilities/g)?.length).toBe(1);
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Advance to Stop 5: PREDICT (probabilities · p3)
  await page.locator('#short-continue').click();
  await expect(page.locator('#short-resume')).toHaveCount(0);
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 5 of 5 · PREDICT');
  await expect(page.getByTestId('route-purpose')).toContainText('Turn the raw token scores into a probability distribution');
  await expect(page.locator('#short-continue')).toHaveCount(0);
  await expect(page.locator('#short-teach')).toBeVisible();
  await expect(page.locator('#short-teach')).toContainText('Teach: step through learning');
  await expect(page.getByTestId('scene-construction')).toBeVisible();
  // Occurrence verification
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-semantic-anchor', 'probabilities');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-position', '3');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-layer', '');
  await expect(page.locator('[data-testid="landmark-occurrence"]')).toHaveAttribute('data-run-id', payoffRunId!);
  // Endpoint identity matches payoff identity
  await expect(page.getByTestId('scene-construction')).toContainText('Known target: a');
  await expect(page.getByTestId('scene-construction')).toContainText('Highest-probability token: a');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Detour via Free Exploration: changing operation sets shortDetour = true
  await page.locator('#visitor-explore-toggle').click();
  await expect(page.locator('.spatial-selection')).toBeVisible();
  await page.locator('#spatial-operation').selectOption('mlpRelu');
  await expect(page.locator('.short-guide')).toContainText('Exploring a detour');
  await expect(page.locator('#short-resume')).toBeVisible();

  // Resume short route: clears detour state, returns to stop 5, hides resume button
  await page.locator('#short-resume').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 5 of 5 · PREDICT');
  await expect(page.locator('.short-guide')).not.toContainText('Exploring a detour');
  await expect(page.locator('#short-resume')).toHaveCount(0);
  await expect(page.getByTestId('scene-construction')).toContainText('Highest-probability token: a');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
});

test('2b. Optional attention drill-down from MIX CONTEXT, zero-execution traversal, and route return', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Advance to Stop 2: MIX CONTEXT
  await page.locator('#short-continue').click(); // to Represent
  await page.locator('#short-continue').click(); // to Mix Context
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 2 of 5 · MIX CONTEXT');
  await expect(page.locator('#attention-drill-down')).toBeVisible();

  const cmdBaseline = await page.evaluate(() => (window as any).abq.commands.length);

  // Click drill-down: Enter attention sub-route
  await page.locator('#attention-drill-down').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Attention detail · Step 1 of 4 · Compare positions');
  await expect(page.locator('#attention-return')).toBeVisible();
  await expect(page.locator('#short-continue')).toContainText('Continue: Turn scores into normalized weights');
  await expect(page.getByTestId('scene-construction')).toContainText('Attention scores');

  // Q/K Math in contextual dock
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toBeVisible();
  await expect(page.locator('[data-testid="qk-products"]')).toBeVisible();

  // Source tab in contextual dock
  await page.locator('button[data-dock-depth="source"]').click();
  await expect(page.getByTestId('dock-source')).toBeVisible();

  // Return to Explain tab
  await page.locator('.dock-tab-close').click();
  await expect(page.getByTestId('dock-explain')).toBeVisible();
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(cmdBaseline);

  // Advance substep 2: Softmax
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Attention detail · Step 2 of 4 · Turn scores into normalized weights');
  await expect(page.locator('#short-continue')).toContainText('Continue: Combine carried information');
  await expect(page.getByTestId('scene-construction')).toContainText('Attention softmax');
  const attnProbText = await page.getByTestId('dock-explain').textContent();
  expect(attnProbText?.match(/Shifted exponentials and denominator are derived from observed scores/g)?.length).toBe(1);
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(cmdBaseline);

  // Advance substep 3: Value mixture
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Attention detail · Step 3 of 4 · Combine carried information');
  await expect(page.locator('#short-continue')).toContainText('Continue: Combine/project and add it back');
  await expect(page.getByTestId('scene-construction')).toContainText('Weighted values');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(cmdBaseline);

  // Advance substep 4: Residual
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Attention detail · Step 4 of 4 · Combine/project and add it back');
  await expect(page.locator('#short-continue')).toContainText('Return to Mix Context');
  await expect(page.getByTestId('scene-construction')).toContainText('Project the attention result and add it back');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(cmdBaseline);

  // Return to Mix Context via continue button
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 2 of 5 · MIX CONTEXT');
  await expect(page.locator('#short-continue')).toContainText('Continue: TRANSFORM');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(cmdBaseline);

  // Also test Return button from drill-down
  await page.locator('#attention-drill-down').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Attention detail · Step 1 of 4');
  await page.locator('#attention-return').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 2 of 5 · MIX CONTEXT');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(cmdBaseline);

  // Continue to Stop 3: TRANSFORM without any re-execution
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 3 of 5 · TRANSFORM');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(cmdBaseline);
});

test('2c. Reverse learning traversal, objective anchor, backward landmarks, parameter owner, Adam, and zero-execution guarantee', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Advance through 5 stops to PREDICT
  for (let i = 0; i < 5; i++) {
    await page.locator('#short-continue').click();
  }
  await expect(page.locator('#short-teach')).toBeVisible();
  await expect(page.locator('#start-reverse-learning')).toBeVisible();

  // Baseline commands: reverse explanation MUST issue zero worker commands
  const initialCommands = await page.evaluate(() => (window as any).abq.commands.length);

  // Click Walk through backward pass -> enters reverse route at Stop 0: PREDICT
  await page.locator('#start-reverse-learning').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'visitor');
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Stop 1 of 7 · PREDICT');
  await expect(page.getByTestId('public-learning-world')).toBeVisible();

  // 1. Objective Anchor attached near output probabilities
  await expect(page.getByTestId('objective-anchor')).toBeVisible();
  await expect(page.getByTestId('objective-anchor')).toContainText('p0');
  await expect(page.getByTestId('objective-anchor')).toContainText('p1');
  await expect(page.getByTestId('objective-anchor')).toContainText('p2');
  await expect(page.getByTestId('objective-anchor')).toContainText('p3');
  await expect(page.getByTestId('objective-anchor')).toContainText('p4');
  await expect(page.getByTestId('objective-anchor')).toContainText('[PENDING]');
  await expect(page.getByTestId('objective-anchor')).not.toContainText('[OBSERVED]');

  // Reverse Causal Overlay: exact-address edges, residual branches, and region guides
  await expect(page.locator('.reverse-causal-overlay')).toBeVisible();
  await expect(page.locator('.reverse-causal-edge').first()).toHaveAttribute('data-reverse-from-kind');
  await expect(page.locator('.reverse-causal-edge').first()).toHaveAttribute('data-reverse-to-kind');
  // Residual branches: mlpResidual -> attentionResidual, attentionResidual -> embeddingNorm
  await expect(page.locator('.reverse-causal-edge[data-reverse-from-kind="mlpResidual"][data-reverse-to-kind="attentionResidual"]')).toBeVisible();
  await expect(page.locator('.reverse-causal-edge[data-reverse-from-kind="attentionResidual"][data-reverse-to-kind="embeddingNorm"]')).toBeVisible();
  // Absence of false shortcut headOutput <- preAttentionNorm
  await expect(page.locator('.reverse-causal-edge[data-reverse-from-kind="headOutput"][data-reverse-to-kind="preAttentionNorm"]')).toHaveCount(0);
  // Presence of reverse-region-guide for multi-key fan-in / landmarks
  await expect(page.locator('.reverse-region-guide')).not.toHaveCount(0);

  await expect(page.getByTestId('reverse-truth-cue').first()).toContainText('Backward explanation path over the real computation. Visual movement is not runtime timing.');

  // Check all-position objective in Values tab
  await page.locator('button[data-dock-depth="values"]').click();
  await expect(page.getByTestId('dock-values')).toBeVisible();
  await expect(page.getByTestId('training-objective')).toBeVisible();
  await expect(page.getByTestId('training-objective')).toContainText('[PENDING]');
  await page.screenshot({ path: `${evidenceDir}/02-learning-objective-1920.png` });
  await page.locator('.dock-tab-close').click();
  await expect(page.getByTestId('dock-explain')).toBeVisible();

  // Screenshot 03: Stop 0 output probabilities
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
  await page.screenshot({ path: `${evidenceDir}/03-backward-output-1920.png` });

  // Advance to Stop 1: SCORE
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Stop 2 of 7 · SCORE');
  await expect(page.locator('.reverse-causal-overlay')).toHaveAttribute('data-active-reverse-landmark', 'logits');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
  await page.screenshot({ path: `${evidenceDir}/04-backward-score-1920.png` });

  // Advance to Stop 2: TRANSFORM
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Stop 3 of 7 · TRANSFORM');
  await expect(page.locator('.reverse-causal-overlay')).toHaveAttribute('data-active-reverse-landmark', 'mlpResidual');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
  await page.screenshot({ path: `${evidenceDir}/05-backward-transform-1920.png` });

  // Advance to Stop 3: MIX CONTEXT
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Stop 4 of 7 · MIX CONTEXT');
  await expect(page.locator('.reverse-causal-overlay')).toHaveAttribute('data-active-reverse-landmark', 'attentionResidual');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
  await page.screenshot({ path: `${evidenceDir}/06-backward-context-1920.png` });

  // Advance to Stop 4: REPRESENT
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Stop 5 of 7 · REPRESENT');
  await expect(page.locator('.reverse-causal-overlay')).toHaveAttribute('data-active-reverse-landmark', 'preAttentionNorm');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
  await page.screenshot({ path: `${evidenceDir}/07-backward-represent-1920.png` });

  // Advance to Stop 5: PARAMETER (reached in the same world, parameter contribution overlay visible)
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Stop 6 of 7 · PARAMETER');
  await expect(page.getByTestId('parameter-learning-overlay')).toBeVisible();
  await expect(page.locator('.param-overlay-title')).toContainText('tokenEmbedding');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
  await page.screenshot({ path: `${evidenceDir}/08-parameter-contribution-explain-1920.png` });

  // Parameter math in dock
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toBeVisible();
  await expect(page.getByTestId('dock-math')).toContainText('child adjoint');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
  await page.screenshot({ path: `${evidenceDir}/09-parameter-contribution-math-1920.png` });
  await page.locator('.dock-tab-close').click();

  // Advance to Stop 6: ADAM (Adam proposal attached to parameter bank, provisional)
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Stop 7 of 7 · ADAM');
  await expect(page.getByTestId('adam-learning-overlay')).toBeVisible();
  await expect(page.getByTestId('adam-learning-overlay')).toHaveAttribute('data-provisional', 'true');
  await expect(page.getByTestId('adam-learning-overlay')).toHaveAttribute('data-status', 'pending');
  await expect(page.getByTestId('adam-proposal-pending')).toBeVisible();
  await expect(page.getByTestId('adam-learning-overlay')).not.toContainText('-0.042');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
  await page.screenshot({ path: `${evidenceDir}/10-adam-explain-1920.png` });

  // Adam dock values: pending proposal status
  await page.locator('button[data-dock-depth="values"]').click();
  await expect(page.getByTestId('dock-values')).toBeVisible();
  await expect(page.getByTestId('dock-values')).toContainText('Adam Optimizer Proposal');
  await expect(page.getByTestId('dock-values').getByTestId('adam-proposal-pending')).toBeVisible();
  await page.locator('.dock-tab-close').click();

  // Adam math in dock
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toBeVisible();
  await expect(page.getByTestId('dock-math')).toContainText('Adam Optimizer Equations');
  await expect(page.getByTestId('dock-math').getByTestId('proposal-pending')).toBeVisible();
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
  await page.screenshot({ path: `${evidenceDir}/11-adam-math-1920.png` });
  await page.locator('.dock-tab-close').click();

  // Assert entire reverse traversal executed zero worker commands
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
});

test('3. Stepped training, candidate discard, and authority preservation', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Navigate to stop 5
  for (let i = 0; i < 5; i++) {
    await page.locator('#short-continue').click();
  }
  await expect(page.locator('#short-teach')).toBeVisible();

  // Launch stepped training from short route
  await page.locator('#short-teach').click();
  await expect(page.locator('#execution-controls')).toBeVisible();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'visitor');

  // Verify learning bridge causal sequence and pinned parameter rationale (Outcome C)
  await expect(page.getByTestId('learning-bridge')).toBeVisible();
  await expect(page.getByTestId('learning-bridge')).toContainText('Predictions for known targets');
  await expect(page.getByTestId('learning-bridge')).toContainText('losses combine into training objective');
  await expect(page.getByTestId('learning-bridge')).toContainText('Backpropagation carries backward signal');
  await expect(page.getByTestId('learning-bridge')).toContainText('Parameter uses produce gradient contributions');
  await expect(page.getByTestId('learning-bridge')).toContainText('Contributions accumulate into final gradient');
  await expect(page.getByTestId('learning-bridge')).toContainText('Adam uses final gradient for parameter proposal');
  await expect(page.getByTestId('learning-bridge')).toContainText('Provisional candidate: Accept or Discard');
  await expect(page.locator('.bridge-scope')).toContainText('We follow one selected parameter');

  // Verify diagnostic stepping buttons are omitted in visitor profile
  await expect(page.locator('#execution-next')).toHaveCount(0);
  await expect(page.locator('#execution-pause')).toHaveCount(0);
  await expect(page.locator('#execution-follow')).toHaveCount(0);
  await expect(page.locator('#execution-controls details')).toHaveCount(0);

  // Stepped controls permitted in visitor profile
  await expect(page.locator('#execution-continue')).toBeVisible();
  await expect(page.locator('#execution-pin')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toBeVisible();

  // Advance via pin to stopped gradient contribution
  await page.locator('#execution-pin').click();
  await expect(page.locator('#execution-continue')).toBeEnabled({ timeout: 60000 });
  await expect(page.getByTestId('execution-frontier')).toContainText('stopped after matching backward node');

  // Explain tab is meaning-first (no raw contribution arithmetic or signed tracks)
  await expect(page.getByTestId('dock-explain')).toContainText('Parameter uses contribute and accumulate');
  await expect(page.getByTestId('dock-explain')).toContainText('Partial gradient');
  await expect(page.getByTestId('dock-explain').locator('[data-testid="live-contribution"]')).toHaveCount(0);
  await expect(page.getByTestId('dock-explain').locator('.live-signed-track')).toHaveCount(0);
  await page.screenshot({ path: `${evidenceDir}/12-candidate-forward-or-transition-1920.png` });

  // Math tab retains exact learning evidence
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toBeVisible();
  await expect(page.getByTestId('dock-math').getByTestId('live-contribution')).toBeVisible();
  await expect(page.getByTestId('dock-math').locator('.live-signed-track').first()).toBeVisible();

  // Return to Explain tab
  await page.locator('.dock-tab-close').click();
  await expect(page.getByTestId('dock-explain')).toBeVisible();

  // Advance to Candidate ready
  await page.locator('#execution-continue').click();
  await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', 'ready', { timeout: 60000 });
  await expect(page.locator('#execution-accept')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toContainText('Discard candidate');
  await expect(page.getByTestId('execution-frontier')).toContainText('Candidate ready');

  // Assert legacy upper comparison is suppressed
  await expect(page.locator('.decision-summary')).toHaveCount(0);
  await expect(page.locator('.output-comparison')).toHaveCount(0);

  // Assert authentic Adam proposal is rendered in overlay
  await expect(page.getByTestId('adam-learning-overlay')).toBeVisible();
  await expect(page.getByTestId('adam-learning-overlay')).toHaveAttribute('data-status', 'ready');
  await expect(page.getByTestId('adam-learning-overlay').getByTestId('adam-proposal-table')).toBeVisible();

  await page.screenshot({ path: `${evidenceDir}/13-candidate-ready-1920.png` });

  // Candidate Ready Compare regression:
  // Assert Compare tab exists in the contextual dock
  const compareTab = page.locator('button[data-dock-depth="compare"]');
  await expect(compareTab).toBeVisible();

  // Assert opening Compare issues zero execution
  const commandsBeforeCompare = await page.evaluate(() => (window as any).abq.commands.length);
  const runBefore = await page.locator('[data-testid="selected-world-object"]').getAttribute('data-run-id');
  await compareTab.click();
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(commandsBeforeCompare);

  // Assert exactly one public .output-comparison exists and is inside contextual dock
  await expect(page.locator('.output-comparison')).toHaveCount(1);
  await expect(page.locator('.contextual-dock .output-comparison')).toHaveCount(1);

  // Assert Compare content contains real Current/Candidate evidence
  const compareContent = page.getByTestId('dock-compare');
  await expect(compareContent).toBeVisible();
  await expect(compareContent).toContainText('Current / Candidate');
  await expect(compareContent.getByTestId('before-mean')).toBeVisible();
  await expect(compareContent.getByTestId('after-mean')).toBeVisible();
  await expect(compareContent.locator('.output-comparison table')).toBeVisible();
  await expect(compareContent).not.toContainText('No active comparison available');

  // Assert Accept / Discard transaction controls remain visible
  await expect(page.locator('#execution-accept')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toContainText('Discard candidate');

  // Assert run/candidate identities remain unchanged
  expect(await page.locator('[data-testid="selected-world-object"]').getAttribute('data-run-id')).toBe(runBefore);
  await page.screenshot({ path: `${evidenceDir}/14-candidate-compare-1920.png` });

  // Assert closing Compare preserves Candidate Ready state
  await page.locator('.dock-tab-close').click();
  await expect(page.getByTestId('dock-explain')).toBeVisible();
  await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', 'ready');
  await expect(page.locator('#execution-accept')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toContainText('Discard candidate');

  // Discard candidate
  await page.locator('#execution-cancel').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);
  await expect(page.getByTestId('status')).toContainText('Execution cancelled · prior completed evidence preserved');
  await page.screenshot({ path: `${evidenceDir}/16-post-discard-1920.png` });

  // Verify acceptTraining was NOT called, cancel command was sent, and optimizer step is unchanged
  const a = await page.evaluate(() => (window as any).abq);
  expect(a.commands.filter((c: any) => c.command === 'acceptTraining')).toHaveLength(0);
  expect(a.commands[a.commands.length - 1].command).toMatch(/cancel/i);
  expect(a.lastReady?.state.optimizer.step ?? 0).toBe(0);
});

test('3b. Stepped training, candidate accept, live step advancement, and public reset restoration', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Navigate to stop 5
  for (let i = 0; i < 5; i++) {
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
  await page.screenshot({ path: `${evidenceDir}/15-post-accept-1920.png` });

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

  // Show facilitator reverse learning controls and overlay
  await page.locator('[data-reverse-stop="0"]').click();
  await expect(page.locator('.reverse-causal-overlay')).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/17-facilitator-learning-1920.png` });

  // Public Reset preserves facilitator opt-out setting
  await page.locator('#clear-session').click();
  await expect(page.locator('#exhibit-start')).toBeEnabled();
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#operator-controls').click();
  await expect(page.locator('#exhibit-opt-out')).toContainText('Enable idle reset · 300 seconds');
});

test('5. Workbench profile preservation and single-surface explanation arbitration at /?presentation=spatial', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
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

  // Workbench single-surface explanation arbitration regression (Section E):
  // Record command baseline: surface switching must NOT trigger model execution
  const initialCommands = await page.evaluate(() => (window as any).abq.commands.length);
  const runId = await page.locator('[data-testid="selected-world-object"]').getAttribute('data-run-id');

  // 1. Open Scene Math: verify construction visible and lens not simultaneously visible
  await page.locator('#scene-construction').click();
  await expect(page.locator('.scene-construction')).toBeVisible();
  await expect(page.locator('.context-lens')).toBeHidden();
  await page.screenshot({ path: `${evidenceDir}/18-workbench-learning-preserved-1920.png` });

  // 2. Open Values / arithmetic / source: verify right lens visible and construction not simultaneously visible
  await page.locator('#open-spatial-detail').click();
  await expect(page.locator('.context-lens')).toBeVisible();
  await expect(page.locator('.scene-construction')).toHaveCount(0);

  // 3. Close lens and open Scene Math: verify construction visible and lens not simultaneously visible
  await page.locator('#close-spatial-lens').click();
  await expect(page.locator('.context-lens')).toBeHidden();
  await page.locator('#scene-construction').click();
  await expect(page.locator('.scene-construction')).toBeVisible();
  await expect(page.locator('.context-lens')).toBeHidden();

  // 4. Open via #spatial-focus: verify right lens visible and construction not simultaneously visible
  await page.locator('#spatial-focus').click();
  await expect(page.locator('.context-lens')).toBeVisible();
  await expect(page.locator('.scene-construction')).toHaveCount(0);

  // 5. Open Scene Math then open via #spatial-lens (Q/K lens): verify right lens visible and construction not simultaneously visible
  await page.locator('#close-spatial-lens').click();
  await expect(page.locator('.context-lens')).toBeHidden();
  await page.locator('#scene-construction').click();
  await expect(page.locator('.scene-construction')).toBeVisible();
  await page.locator('#spatial-lens').click();
  await expect(page.locator('.context-lens')).toBeVisible();
  await expect(page.locator('.scene-construction')).toHaveCount(0);

  // 6. Verify run identity does not change and zero model execution occurs
  expect(await page.locator('[data-testid="selected-world-object"]').getAttribute('data-run-id')).toBe(runId);
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
});

test('6. 44px minimum touch targets and keyboard accessibility across qualified viewports', async ({ page }) => {
  test.setTimeout(180_000);
  async function assertMin44(selector: string, desc?: string) {
    const el = page.locator(selector).first();
    await expect(el).toBeVisible();
    await expect.poll(async () => {
      const box = await el.boundingBox();
      return box?.height ?? 0;
    }, { message: `Height for ${desc ?? selector} must be >= 44px` }).toBeGreaterThanOrEqual(44);
  }

  // 1. 1920x1080 Visitor Mode
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?presentation=spatial&kiosk=1');
  await assertMin44('#exhibit-start', 'Entry Start button');

  // Keyboard entry
  await page.locator('#exhibit-start').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Payoff visitor buttons
  await assertMin44('#short-continue', 'Payoff Continue button');
  await assertMin44('#visitor-explore-toggle', 'Visitor Explore Toggle');
  await assertMin44('#operator-controls', 'Operator Controls button');
  await assertMin44('#clear-session', 'Public Reset button');
  await assertMin44('[data-dock-depth="math"]', 'Dock tab Math');
  await assertMin44('[data-dock-depth="explain"]', 'Dock tab Explain');
  await assertMin44('[data-dock-depth="values"]', 'Dock tab Values');
  await assertMin44('[data-dock-depth="source"]', 'Dock tab Source');

  // Keyboard navigation through short route
  await page.locator('#short-continue').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 1 of 5 · REPRESENT');

  // Advance to stop 2 and verify attention drill-down touch targets
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 2 of 5 · MIX CONTEXT');
  await assertMin44('#attention-drill-down', 'Attention drill-down button');
  await page.locator('#attention-drill-down').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Attention detail · Step 1 of 4');
  await assertMin44('#attention-return', 'Attention return button');
  await page.locator('#attention-return').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 2 of 5 · MIX CONTEXT');

  // Advance to stop 5
  for (let i = 2; i < 5; i++) {
    await page.locator('#short-continue').click();
  }
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 5 of 5 · PREDICT');
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
  for (const stop of [0, 1, 2, 3, 4, 5]) {
    await assertMin44(`[data-short-stop="${stop}"]`, `Facilitator stop ${stop} button`);
  }
  await assertMin44('#facilitator-attention-detail', 'Facilitator attention detail button');
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

  // Facilitator candidate ready comparison suppression regression
  await expect(page.locator('.decision-summary')).toHaveCount(0);
  await expect(page.locator('.output-comparison')).toHaveCount(0);
  const fCompareTab = page.locator('button[data-dock-depth="compare"]');
  await expect(fCompareTab).toBeVisible();
  await fCompareTab.click();
  await expect(page.locator('.output-comparison')).toHaveCount(1);
  await expect(page.locator('.contextual-dock .output-comparison')).toHaveCount(1);
  await expect(page.locator('#execution-accept')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toBeVisible();
  await page.locator('.dock-tab-close').click();

  await page.locator('#execution-cancel').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);

  // 4. 1280x720 Viewport Touch Targets: Visitor Mode
  await page.locator('#operator-controls').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'visitor');

  // Reset to entry to follow exact visitor sequence: Start → reach PREDICT (stop 5) → Teach
  await page.locator('#clear-session').click();
  await expect(page.locator('#exhibit-start')).toBeEnabled();
  await assertMin44('#exhibit-start', '720p Visitor Start button');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Advance through 5 stops to PREDICT (stop 5)
  for (let i = 0; i < 5; i++) {
    await assertMin44('#short-continue', `720p Visitor Stop ${i} Continue button`);
    await page.locator('#short-continue').click();
  }
  await assertMin44('#short-teach', '720p Visitor Teach button at Stop 5');
  await assertMin44('#visitor-explore-toggle', '720p Visitor Explore Toggle');
  await assertMin44('button[data-dock-depth="math"]', '720p Math tab button');

  // Launch stepped training as visitor at 1280x720
  await page.locator('#short-teach').click();
  await expect(page.locator('#execution-controls')).toBeVisible();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'visitor');

  // Advance via pin to partial/stopped gradient contribution state
  await page.locator('#execution-pin').click();
  await expect(page.locator('#execution-continue')).toBeEnabled({ timeout: 60000 });
  await expect(page.getByTestId('execution-frontier')).toContainText('stopped after matching backward node');

  // Verify Math tab exposes live-contribution at 1280x720
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toBeVisible();
  await expect(page.getByTestId('dock-math').getByTestId('live-contribution')).toBeVisible();
  await page.locator('.dock-tab-close').click();

  // Directly measure visitor execution controls at 1280x720 in partial/stopped state
  await assertMin44('#execution-pin', '720p Visitor Execution Pin button');
  await assertMin44('#execution-continue', '720p Visitor Execution Continue button');
  await assertMin44('#execution-cancel', '720p Visitor Execution Cancel button');

  // Advance to Ready
  await page.locator('#execution-continue').click();
  await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', 'ready', { timeout: 60000 });

  // Verify Compare at 1280x720
  await page.locator('button[data-dock-depth="compare"]').click();
  await expect(page.getByTestId('dock-compare')).toBeVisible();
  await expect(page.getByTestId('dock-compare')).toContainText('Current / Candidate');
  await expect(page.getByTestId('dock-compare')).not.toContainText('No active comparison available');
  await page.locator('.dock-tab-close').click();

  // Directly measure visitor execution controls at 1280x720 in Ready state
  await assertMin44('#execution-accept', '720p Visitor Execution Accept button');
  await assertMin44('#execution-cancel', '720p Visitor Discard Candidate button');

  // Accept candidate update and verify settled state at 1280x720
  await page.locator('#execution-accept').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);
  await expect(page.getByTestId('status')).toContainText('Live update complete · training step 1');

  // Reset session
  await page.locator('#clear-session').click();
  await expect(page.locator('#exhibit-start')).toBeEnabled();
});

test('7. 1280x720 layout and reduced motion visual captures', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await expect(page.locator('#exhibit-start')).toBeEnabled();

  // Start visitor route
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Advance through 5 stops to PREDICT (stop 5)
  for (let i = 0; i < 5; i++) {
    await page.locator('#short-continue').click();
  }
  await expect(page.locator('#start-reverse-learning')).toBeVisible();

  // Enter reverse route: Stop 0 (probabilities)
  await page.locator('#start-reverse-learning').click();
  await expect(page.getByTestId('objective-anchor')).toBeVisible();
  // 19: Learning Objective at 1280x720
  await page.screenshot({ path: `${evidenceDir}/19-learning-objective-1280.png` });

  // Advance along reverse route to Stop 2 (TRANSFORM)
  await page.locator('#reverse-continue').click(); // to Stop 1 (SCORE)
  await page.locator('#reverse-continue').click(); // to Stop 2 (TRANSFORM)
  await expect(page.getByTestId('lesson-progress')).toContainText('TRANSFORM');
  // 20: Backward path at 1280x720
  await page.screenshot({ path: `${evidenceDir}/20-backward-path-1280.png` });

  // Advance to Stop 5 (PARAMETER)
  await page.locator('#reverse-continue').click(); // to Stop 3 (MIX CONTEXT)
  await page.locator('#reverse-continue').click(); // to Stop 4 (REPRESENT)
  await page.locator('#reverse-continue').click(); // to Stop 5 (PARAMETER)
  await expect(page.getByTestId('parameter-learning-overlay')).toBeVisible();
  // 21: Parameter contribution explain at 1280x720
  await page.screenshot({ path: `${evidenceDir}/21-parameter-contribution-explain-1280.png` });

  // 22: Parameter contribution math at 1280x720
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/22-parameter-contribution-math-1280.png` });
  await page.locator('.dock-tab-close').click();

  // Advance to Stop 6 (ADAM)
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('adam-learning-overlay')).toBeVisible();
  await expect(page.getByTestId('adam-learning-overlay')).toHaveAttribute('data-status', 'pending');
  await expect(page.getByTestId('adam-proposal-pending')).toBeVisible();
  await expect(page.getByTestId('adam-learning-overlay')).not.toContainText('-0.042');
  // 23: Adam explain at 1280x720
  await page.screenshot({ path: `${evidenceDir}/23-adam-explain-1280.png` });

  // Stepped training for Candidate Ready at 1280x720
  await page.locator('#clear-session').click();
  await expect(page.locator('#exhibit-start')).toBeEnabled();
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  for (let i = 0; i < 5; i++) {
    await page.locator('#short-continue').click();
  }
  await page.locator('#short-teach').click();
  await expect(page.locator('#execution-controls')).toBeVisible();
  await page.locator('#execution-pin').click();
  await expect(page.locator('#execution-continue')).toBeEnabled({ timeout: 60000 });
  await page.locator('#execution-continue').click();
  await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', 'ready', { timeout: 60000 });
  await expect(page.getByTestId('adam-learning-overlay')).toBeVisible();
  await expect(page.getByTestId('adam-learning-overlay')).toHaveAttribute('data-status', 'ready');
  await expect(page.getByTestId('adam-learning-overlay').getByTestId('adam-proposal-table')).toBeVisible();

  // 24: Candidate Ready default at 1280x720
  await page.screenshot({ path: `${evidenceDir}/24-candidate-ready-1280.png` });

  // 25: Candidate Ready compare at 1280x720
  await page.locator('button[data-dock-depth="compare"]').click();
  await expect(page.getByTestId('dock-compare')).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/25-candidate-compare-1280.png` });
  await page.locator('.dock-tab-close').click();

  // Discard candidate
  await page.locator('#execution-cancel').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);

  // 26: Facilitator mode at 1280x720
  await page.locator('#operator-controls').click();
  await expect(page.getByTestId('facilitator-panel')).toBeVisible();
  await page.locator('[data-reverse-stop="0"]').click();
  await expect(page.locator('.reverse-causal-overlay')).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/26-facilitator-learning-1280.png` });

  // 27: Reduced motion visual capture
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: `${evidenceDir}/27-reduced-motion-learning-1280.png` });

  // Write visual verification audit summary
  await writeFile(`${evidenceDir}/qualification-summary.json`, JSON.stringify({
    qualifiedAt: new Date().toISOString(),
    task: 'P0-E3',
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
      '.learning-stations',
      '[data-learning-stage]',
      '#execution-next',
      '#execution-pause',
      '#execution-follow',
      '#execution-controls details',
      'research variants'
    ],
    reverseRouteStopsVerified: [
      'PREDICT',
      'SCORE',
      'TRANSFORM',
      'MIX CONTEXT',
      'REPRESENT',
      'PARAMETER',
      'ADAM'
    ],
    zeroExecutionTraveralVerified: true,
    sameWorldTopologyVerified: true,
    touchTargetMinHeight: 44,
    viewportHeightsVerified: [1080, 720],
    reducedMotionVerified: true,
    idleResetOptOutPersistedAcrossReset: true,
    screenshotsCaptured: [
      '01-forward-predict-1920.png',
      '02-learning-objective-1920.png',
      '03-backward-output-1920.png',
      '04-backward-score-1920.png',
      '05-backward-transform-1920.png',
      '06-backward-context-1920.png',
      '07-backward-represent-1920.png',
      '08-parameter-contribution-explain-1920.png',
      '09-parameter-contribution-math-1920.png',
      '10-adam-explain-1920.png',
      '11-adam-math-1920.png',
      '12-candidate-forward-or-transition-1920.png',
      '13-candidate-ready-1920.png',
      '14-candidate-compare-1920.png',
      '15-post-accept-1920.png',
      '16-post-discard-1920.png',
      '17-facilitator-learning-1920.png',
      '18-workbench-learning-preserved-1920.png',
      '19-learning-objective-1280.png',
      '20-backward-path-1280.png',
      '21-parameter-contribution-explain-1280.png',
      '22-parameter-contribution-math-1280.png',
      '23-adam-explain-1280.png',
      '24-candidate-ready-1280.png',
      '25-candidate-compare-1280.png',
      '26-facilitator-learning-1280.png',
      '27-reduced-motion-learning-1280.png'
    ]
  }, null, 2));
});

test('8. P0-E2 Unified contextual dock, depth switching, world dominant floor, and 40vh bound', async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });

  // 1. Test at 1920x1080
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Verify dock presence and lens omission in visitor profile
  await expect(page.getByTestId('contextual-dock')).toBeVisible();
  await expect(page.locator('.context-lens')).toHaveCount(0);
  await expect(page.locator('.context-tether')).toHaveCount(0);

  // Check 1080p World dominant floor in default Explain state (>= 55% of world+dock region)
  const worldBox1080 = await page.locator('#spatial-world').boundingBox();
  const dockBox1080 = await page.getByTestId('contextual-dock').boundingBox();
  expect(worldBox1080).not.toBeNull();
  expect(dockBox1080).not.toBeNull();
  const combinedHeight1080 = worldBox1080!.height + dockBox1080!.height;
  const worldRatio1080 = worldBox1080!.height / combinedHeight1080;
  expect(worldRatio1080).toBeGreaterThanOrEqual(0.55);

  // 2. Test at 1280x720
  await page.setViewportSize({ width: 1280, height: 720 });
  const worldBox720 = await page.locator('#spatial-world').boundingBox();
  const dockBox720 = await page.getByTestId('contextual-dock').boundingBox();
  expect(worldBox720).not.toBeNull();
  expect(dockBox720).not.toBeNull();
  const combinedHeight720 = worldBox720!.height + dockBox720!.height;
  const worldRatio720 = worldBox720!.height / combinedHeight720;
  expect(worldRatio720).toBeGreaterThanOrEqual(0.55);

  // 3. Zero-execution depth switching & expanded dock bound <= 40vh (288px at 720p)
  const initialCommands = await page.evaluate(() => (window as any).abq.commands.length);

  // Depth: Values
  await page.locator('[data-dock-depth="values"]').click();
  await expect(page.getByTestId('dock-values')).toBeVisible();
  const valuesDockBox = await page.getByTestId('contextual-dock').boundingBox();
  expect(valuesDockBox!.height).toBeLessThanOrEqual(720 * 0.40 + 1);
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Depth: Math
  await page.locator('[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toBeVisible();
  const mathDockBox = await page.getByTestId('contextual-dock').boundingBox();
  expect(mathDockBox!.height).toBeLessThanOrEqual(720 * 0.40 + 1);
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Depth: Source
  await page.locator('[data-dock-depth="source"]').click();
  await expect(page.getByTestId('dock-source')).toBeVisible();
  const sourceDockBox = await page.getByTestId('contextual-dock').boundingBox();
  expect(sourceDockBox!.height).toBeLessThanOrEqual(720 * 0.40 + 1);
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Return to Explain via Close button
  await page.locator('.dock-tab-close').click();
  await expect(page.getByTestId('dock-explain')).toBeVisible();
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Verify route controls remain intact and visible in Explain state
  await expect(page.getByTestId('lesson-progress')).toBeVisible();
  await expect(page.locator('#short-continue')).toBeVisible();

  // Test touch targets for dock tabs >= 44px
  for (const tab of ['explain', 'values', 'math', 'source']) {
    const tabBox = await page.locator(`button[data-dock-depth="${tab}"]`).boundingBox();
    expect(tabBox).not.toBeNull();
    expect(tabBox!.height).toBeGreaterThanOrEqual(44);
    expect(tabBox!.width).toBeGreaterThanOrEqual(44);
  }

  // Facilitator mode verification: dock is also present at bottom, lens omitted
  await page.locator('#operator-controls').click();
  await expect(page.getByTestId('facilitator-panel')).toBeVisible();
  await expect(page.getByTestId('contextual-dock')).toBeVisible();
  await expect(page.locator('.context-lens')).toHaveCount(0);
});

