import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  qualificationBrowserContext,
  writeQualificationJson,
} from '../support/qualification-evidence.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const qualification = await qualificationBrowserContext(root);

test.describe.configure({ mode: 'serial' });

interface EvidenceCapture {
  filename: string;
  sha256: string;
  capturedAt: string;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  reducedMotion: 'reduce' | 'no-preference';
  experienceProfile?: string;
  activeDepth?: string;
  lesson?: {
    canonicalState?: string;
    displayedState?: string;
    targetState?: string;
    navigationMode?: string;
    outcome?: string;
  };
  legacyStateLabel: string;
  cameraViewBox?: { x: number; y: number; width: number; height: number };
  evidenceWorldBounds?: Record<string, any>;
  intersectionRatio?: number;
  centerInside?: boolean;
}

const manifestCaptures: EvidenceCapture[] = [];
let browserMetadata: { name: string; version: string } | undefined;
let servedRuntimeObservation: string | undefined;

async function assertSvgElementInViewBox(
  page: Page,
  selector: string,
  options?: {
    minIntersectionRatio?: number;
    requireCenterInside?: boolean;
    description?: string;
  }
) {
  let lastResult: any;
  await expect.poll(async () => {
    lastResult = await page.evaluate(({ sel }) => {
      const svg = document.querySelector<SVGSVGElement>('#spatial-world');
      if (!svg) throw new Error('Missing #spatial-world SVG');
      const vb = svg.viewBox.baseVal;
      const viewBox = { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
      const el = svg.querySelector<SVGGraphicsElement>(sel);
      if (!el) throw new Error(`Missing SVG element matching selector: ${sel}`);
      const bbox = el.getBBox();
      const bounds = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };

      const interLeft = Math.max(bounds.x, viewBox.x);
      const interTop = Math.max(bounds.y, viewBox.y);
      const interRight = Math.min(bounds.x + bounds.width, viewBox.x + viewBox.width);
      const interBottom = Math.min(bounds.y + bounds.height, viewBox.y + viewBox.height);

      const interWidth = Math.max(0, interRight - interLeft);
      const interHeight = Math.max(0, interBottom - interTop);
      const interArea = interWidth * interHeight;
      const boundsArea = bounds.width * bounds.height;
      const ratio = boundsArea > 0 ? interArea / boundsArea : 0;

      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const centerInside =
        centerX >= viewBox.x &&
        centerX <= viewBox.x + viewBox.width &&
        centerY >= viewBox.y &&
        centerY <= viewBox.y + viewBox.height;

      return {
        viewBox,
        bounds,
        ratio,
        centerInside,
        interArea,
        boundsArea,
      };
    }, { sel: selector });

    const requireCenter = options?.requireCenterInside ?? true;
    const minRatio = options?.minIntersectionRatio ?? 0.8;
    if (requireCenter && !lastResult.centerInside) return false;
    if (minRatio > 0 && lastResult.ratio < minRatio) return false;
    return true;
  }, {
    message: `Expected ${selector} (${options?.description ?? ''}) to be framed inside viewBox`,
    timeout: 5000,
  }).toBe(true);

  return lastResult;
}

async function captureEvidence(
  page: Page,
  filename: string,
  actualState: string,
  targetSelector?: string,
  extraBoundsSelectors?: Record<string, string>
) {
  const vp = page.viewportSize() ?? { width: 1920, height: 1080 };
  let cameraViewBox: any = undefined;
  let intersectionRatio: number | undefined = undefined;
  let centerInside: boolean | undefined = undefined;
  const evidenceWorldBounds: Record<string, any> = {};

  try {
    const data = await page.evaluate(({ primarySel, extraSels }) => {
      const svg = document.querySelector<SVGSVGElement>('#spatial-world');
      if (!svg) return null;
      const vb = svg.viewBox.baseVal;
      const viewBox = { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
      const bounds: Record<string, any> = {};
      let pRatio: number | undefined;
      let pCenter: boolean | undefined;

      if (primarySel) {
        const el = svg.querySelector<SVGGraphicsElement>(primarySel);
        if (el) {
          const b = el.getBBox();
          bounds[primarySel] = { x: b.x, y: b.y, width: b.width, height: b.height };

          const interLeft = Math.max(b.x, viewBox.x);
          const interTop = Math.max(b.y, viewBox.y);
          const interRight = Math.min(b.x + b.width, viewBox.x + viewBox.width);
          const interBottom = Math.min(b.y + b.height, viewBox.y + viewBox.height);
          const interW = Math.max(0, interRight - interLeft);
          const interH = Math.max(0, interBottom - interTop);
          const interArea = interW * interH;
          const bArea = b.width * b.height;
          pRatio = bArea > 0 ? interArea / bArea : 0;
          const cx = b.x + b.width / 2;
          const cy = b.y + b.height / 2;
          pCenter = cx >= viewBox.x && cx <= viewBox.x + viewBox.width && cy >= viewBox.y && cy <= viewBox.y + viewBox.height;
        }
      }

      if (extraSels) {
        for (const [key, sel] of Object.entries(extraSels)) {
          const el = svg.querySelector<SVGGraphicsElement>(sel as string);
          if (el) {
            const b = el.getBBox();
            bounds[key] = { x: b.x, y: b.y, width: b.width, height: b.height };
          }
        }
      }

      return { viewBox, bounds, pRatio, pCenter };
    }, { primarySel: targetSelector, extraSels: extraBoundsSelectors });

    if (data) {
      cameraViewBox = data.viewBox;
      intersectionRatio = data.pRatio;
      centerInside = data.pCenter;
      Object.assign(evidenceWorldBounds, data.bounds);
    }
  } catch {}

  const browser = page.context().browser();
  if (!browserMetadata && browser) {
    browserMetadata = { name: browser.browserType().name(), version: browser.version() };
  }
  const observed = await page.evaluate(() => ({
    devicePixelRatio: window.devicePixelRatio,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'reduce' as const
      : 'no-preference' as const,
    experienceProfile: document.querySelector('.spatial-shell')?.getAttribute('data-experience-profile') ?? undefined,
    activeDepth: document.querySelector('[data-testid="contextual-dock"]')?.getAttribute('data-active-depth') ?? undefined,
  }));
  const fullPath = qualification
    ? join(qualification.captureDirectory, filename)
    : test.info().outputPath(filename);
  await page.screenshot({ path: fullPath });
  const bytes = await readFile(fullPath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const recordedFilename = qualification
    ? relative(qualification.evidence, fullPath).split(sep).join('/')
    : filename;

  manifestCaptures.push({
    filename: recordedFilename,
    sha256,
    capturedAt: new Date().toISOString(),
    viewport: vp,
    devicePixelRatio: observed.devicePixelRatio,
    reducedMotion: observed.reducedMotion,
    experienceProfile: observed.experienceProfile,
    activeDepth: observed.activeDepth,
    legacyStateLabel: actualState,
    cameraViewBox,
    evidenceWorldBounds: Object.keys(evidenceWorldBounds).length > 0 ? evidenceWorldBounds : undefined,
    intersectionRatio,
    centerInside,
  });
}

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
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');

  await expect(page.locator('#exhibit-start')).toBeEnabled();
  await captureEvidence(page, '01-attract-1920.png', 'attract', '#exhibit-start');
  await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  if (qualification) {
    const servedRuntime = await page.evaluate(() =>
      (window as any).abq.lastResult?.run?.manifest?.runtimeRevision as string | undefined
    );
    servedRuntimeObservation = servedRuntime;
    await writeQualificationJson(
      root,
      qualification.allocation,
      join(qualification.report, 'served-runtime.json'),
      {
        observedAt: new Date().toISOString(),
        runtimeRevision: servedRuntime ?? null,
      },
    );
    expect(servedRuntime).toBe(qualification.expectedRuntimeIdentity);
  }
  await captureEvidence(page, '02-prediction-payoff-1920.png', 'prediction payoff', '[data-world-kind="probabilities"]');

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
  await expect(page.locator('#operator-controls')).toHaveCount(0);

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
  // Distinct normalizations check in Math, plain meaning in dock overview
  await expect(page.getByTestId('scene-construction')).toContainText('preAttentionNorm');
  await expect(page.getByTestId('scene-construction')).toContainText('working representation');
  await page.locator('#dock-inspect').click();
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toContainText('embeddingNorm');
  await expect(page.getByTestId('dock-math')).toContainText('preAttentionNorm');
  await expect(page.getByTestId('dock-math')).toContainText('Two distinct normalizations are preserved');
  await page.locator('.dock-tab-close').click();
  await expect(page.getByTestId('dock-explain')).toBeVisible();
  await captureEvidence(page, '03-represent-1920.png', 'REPRESENT', '[data-world-kind="tokenEmbedding"]');
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
  await captureEvidence(page, '04-mix-context-1920.png', 'MIX CONTEXT', '[data-world-kind="attentionBlock"]');
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
  // Stage meaning in dock overview, Canonical 5-op MLP pipeline preserved in Math
  await expect(page.getByTestId('scene-construction')).toContainText('TRANSFORM');
  await expect(page.getByTestId('scene-construction')).toContainText('feed-forward');
  await page.locator('#dock-inspect').click();
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toContainText('preMlpNorm');
  await expect(page.getByTestId('dock-math')).toContainText('mlpUp');
  await expect(page.getByTestId('dock-math')).toContainText('ReLU');
  await expect(page.getByTestId('dock-math')).toContainText('mlpDown');
  await expect(page.getByTestId('dock-math')).toContainText('mlpResidual');
  await expect(page.getByTestId('dock-math')).toContainText('Canonical MLP pipeline');
  await page.locator('.dock-tab-close').click();
  await expect(page.getByTestId('dock-explain')).toBeVisible();
  await captureEvidence(page, '06-transform-1920.png', 'TRANSFORM', '[data-world-kind="mlpBlock"]');
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
  // Raw score vs probability distinction check in Math, plain meaning in dock overview
  await expect(page.getByTestId('scene-construction')).toContainText('SCORE');
  await expect(page.getByTestId('scene-construction')).toContainText('raw score');
  await page.locator('#dock-inspect').click();
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toContainText('Raw unnormalized scores');
  await expect(page.getByTestId('dock-math')).toContainText('Raw token scores are unnormalized logits, not probabilities');
  await page.locator('.dock-tab-close').click();
  await expect(page.getByTestId('dock-explain')).toBeVisible();
  await captureEvidence(page, '07-score-1920.png', 'SCORE', '[data-world-kind="unembed"]');
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
  await captureEvidence(page, '08-predict-1920.png', 'PREDICT', '[data-world-kind="probabilities"]');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Detour via Free Exploration: changing operation sets shortDetour = true
  await page.locator('#visitor-explore-toggle').click();
  await expect(page.locator('.spatial-selection')).toBeVisible();
  await page.locator('#spatial-operation').selectOption('mlpRelu');
  await expect(page.locator('.short-guide')).toContainText('Exploring a detour');
  await expect(page.locator('#short-resume')).toBeVisible();
  await captureEvidence(page, '09-free-explore-resume-1920.png', 'Free Explore / Resume', '#short-resume');

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
  await captureEvidence(page, '05-attention-drilldown-1920.png', 'attention drill-down', '[data-world-kind="attentionBlock"]');

  // Q/K Math in contextual dock via inspect affordance
  await page.locator('#dock-inspect').click();
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
  await page.locator('#dock-inspect').click();
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toContainText('Shifted exponentials and denominator are derived from observed scores');
  await page.locator('.dock-tab-close').click();
  await expect(page.getByTestId('dock-explain')).toBeVisible();
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

  // Verify objective anchor and output probabilities are inside camera viewBox
  await assertSvgElementInViewBox(page, '[data-testid="objective-anchor"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: 'Objective anchor' });
  await assertSvgElementInViewBox(page, '[data-world-kind="probabilities"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: 'Probabilities station' });

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
  await captureEvidence(page, '10-learning-objective-1920.png', 'learning objective', '[data-testid="objective-anchor"]', { probabilities: '[data-world-kind="probabilities"]' });
  await page.locator('.dock-tab-close').click();
  await expect(page.getByTestId('dock-explain')).toBeVisible();

  // Stop 0 output probabilities
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Advance to Stop 1: SCORE
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Stop 2 of 7 · SCORE');
  await expect(page.locator('.reverse-causal-overlay')).toHaveAttribute('data-active-reverse-landmark', 'logits');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
  await captureEvidence(page, '11-reverse-path-1920.png', 'reverse path', '.reverse-causal-overlay');

  // Advance to Stop 2: TRANSFORM
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Stop 3 of 7 · TRANSFORM');
  await expect(page.locator('.reverse-causal-overlay')).toHaveAttribute('data-active-reverse-landmark', 'mlpResidual');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Advance to Stop 3: MIX CONTEXT
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Stop 4 of 7 · MIX CONTEXT');
  await expect(page.locator('.reverse-causal-overlay')).toHaveAttribute('data-active-reverse-landmark', 'attentionResidual');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Advance to Stop 4: REPRESENT
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Stop 5 of 7 · REPRESENT');
  await expect(page.locator('.reverse-causal-overlay')).toHaveAttribute('data-active-reverse-landmark', 'preAttentionNorm');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Advance to Stop 5: PARAMETER (reached in the same world, parameter contribution overlay visible)
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Stop 6 of 7 · PARAMETER');
  await expect(page.getByTestId('parameter-learning-overlay')).toBeVisible();
  await expect(page.locator('.param-overlay-title')).toContainText('tokenEmbedding');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Parameter math in dock via inspect affordance
  await page.locator('#dock-inspect').click();
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toBeVisible();
  await expect(page.getByTestId('dock-math')).toContainText('child adjoint');
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
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
  await captureEvidence(page, '14-adam-pending-1920.png', 'Adam pending', '[data-testid="adam-learning-overlay"]');

  // Adam dock values: pending proposal status
  await page.locator('button[data-dock-depth="values"]').click();
  await expect(page.getByTestId('dock-values')).toBeVisible();
  await expect(page.getByTestId('dock-values')).toContainText('Adam Optimizer Proposal');
  await expect(page.getByTestId('dock-values').getByTestId('adam-proposal-pending')).toBeVisible();
  await page.locator('.dock-tab-close').click();

  // Adam math in dock via inspect affordance
  await page.locator('#dock-inspect').click();
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toBeVisible();
  await expect(page.getByTestId('dock-math')).toContainText('Adam Optimizer Equations');
  await expect(page.getByTestId('dock-math').getByTestId('proposal-pending')).toBeVisible();
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
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
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Backward');
  await expect(page.getByTestId('lesson-progress')).not.toContainText('Candidate');

  // Positive contract for live backward camera (Amendments 6 & 7)
  await assertSvgElementInViewBox(page, '.parameter-learning-overlay', { requireCenterInside: true, minIntersectionRatio: 0.8, description: 'Parameter accumulation overlay' });
  await assertSvgElementInViewBox(page, '[data-world-parameter="wte"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: 'wte parameter bank' });
  await assertSvgElementInViewBox(page, '[data-world-kind="tokenEmbedding"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: 'tokenEmbedding owner station' });
  await expect(page.locator('.learning-stations')).toHaveCount(0);
  await expect(page.locator('[data-learning-stage]')).toHaveCount(0);

  // Explain tab is meaning-first (no raw contribution arithmetic or signed tracks)
  await expect(page.getByTestId('dock-explain')).toContainText('Parameter uses contribute and accumulate');
  await expect(page.getByTestId('dock-explain')).toContainText('Partial gradient');
  await expect(page.getByTestId('dock-explain').locator('[data-testid="live-contribution"]')).toHaveCount(0);
  await expect(page.getByTestId('dock-explain').locator('.live-signed-track')).toHaveCount(0);
  await captureEvidence(page, '12-live-backward-contribution-explain-1920.png', 'live backward contribution Explain', '.parameter-learning-overlay', { wteBank: '[data-world-parameter="wte"]', owner: '[data-world-kind="tokenEmbedding"]' });

  // Math tab retains exact learning evidence
  await page.locator('#dock-inspect').click();
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toBeVisible();
  await expect(page.getByTestId('dock-math').getByTestId('live-contribution')).toBeVisible();
  await expect(page.getByTestId('dock-math').locator('.live-signed-track').first()).toBeVisible();
  await captureEvidence(page, '13-live-backward-contribution-math-1920.png', 'live backward contribution Math', '.parameter-learning-overlay');

  // Return to Explain tab
  await page.locator('.dock-tab-close').click();
  await expect(page.getByTestId('dock-explain')).toBeVisible();

  // Advance to Candidate ready
  await page.locator('#execution-continue').click();
  await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', 'ready', { timeout: 60000 });
  await expect(page.getByTestId('lesson-progress')).toContainText('Learning · Candidate Ready');
  await expect(page.getByTestId('lesson-progress')).not.toContainText('Backward');
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

  // Positive contract for Candidate Ready camera (Amendments 6 & 7)
  await assertSvgElementInViewBox(page, '[data-testid="adam-learning-overlay"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: 'Adam learning overlay' });
  await assertSvgElementInViewBox(page, '[data-world-parameter="wte"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: 'wte parameter bank' });
  await expect(page.locator('.learning-stations')).toHaveCount(0);
  await expect(page.locator('[data-learning-stage]')).toHaveCount(0);

  await captureEvidence(page, '15-candidate-ready-1920.png', 'Candidate Ready', '[data-testid="adam-learning-overlay"]', { wteBank: '[data-world-parameter="wte"]' });

  // Candidate Ready Compare regression (Amendment 8):
  // Assert Compare tab exists in the contextual dock
  const compareTab = page.locator('button[data-dock-depth="compare"]');
  await expect(compareTab).toBeVisible();

  // Capture world camera box before opening Compare
  const cameraBeforeCompare = await page.evaluate(() => {
    const vb = (document.querySelector('#spatial-world') as any).viewBox.baseVal;
    return { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
  });

  // Assert opening Compare issues zero execution
  const commandsBeforeCompare = await page.evaluate(() => (window as any).abq.commands.length);
  const runBefore = await page.locator('[data-testid="selected-world-object"]').getAttribute('data-run-id');
  await compareTab.click();
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(commandsBeforeCompare);

  // Assert camera remains unchanged after opening Compare (Amendment 8)
  const cameraAfterCompare = await page.evaluate(() => {
    const vb = (document.querySelector('#spatial-world') as any).viewBox.baseVal;
    return { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
  });
  expect(cameraAfterCompare.x).toBeCloseTo(cameraBeforeCompare.x, 0);
  expect(cameraAfterCompare.y).toBeCloseTo(cameraBeforeCompare.y, 0);
  expect(cameraAfterCompare.width).toBeCloseTo(cameraBeforeCompare.width, 0);
  expect(cameraAfterCompare.height).toBeCloseTo(cameraBeforeCompare.height, 0);

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

  // Assert Adam overlay and parameter bank remain visible inside active viewBox
  await assertSvgElementInViewBox(page, '[data-testid="adam-learning-overlay"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: 'Adam overlay during Compare' });
  await assertSvgElementInViewBox(page, '[data-world-parameter="wte"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: 'wte bank during Compare' });

  // Assert Accept / Discard transaction controls remain visible
  await expect(page.locator('#execution-accept')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toContainText('Discard candidate');

  // Assert run/candidate identities remain unchanged
  expect(await page.locator('[data-testid="selected-world-object"]').getAttribute('data-run-id')).toBe(runBefore);
  await captureEvidence(page, '16-candidate-compare-1920.png', 'Candidate Compare', '[data-testid="adam-learning-overlay"]', { wteBank: '[data-world-parameter="wte"]' });

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
  await captureEvidence(page, '18-post-discard-1920.png', 'post Discard');

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
  await captureEvidence(page, '17-post-accept-1920.png', 'post Accept');

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
  await page.goto('/?presentation=spatial&kiosk=1&facilitator=1');
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

  // Advance via pin to stopped gradient contribution
  await page.locator('#execution-pin').click();
  await expect(page.locator('#execution-continue')).toBeEnabled({ timeout: 60000 });
  await expect(page.getByTestId('execution-frontier')).toContainText('stopped after matching backward node');

  // Positive contract for facilitator live backward camera
  await assertSvgElementInViewBox(page, '.parameter-learning-overlay', { requireCenterInside: true, minIntersectionRatio: 0.8, description: 'Facilitator parameter accumulation overlay' });
  await assertSvgElementInViewBox(page, '[data-world-parameter="wte"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: 'Facilitator wte parameter bank' });
  await assertSvgElementInViewBox(page, '[data-world-kind="tokenEmbedding"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: 'Facilitator tokenEmbedding owner station' });
  await expect(page.locator('.learning-stations')).toHaveCount(0);
  await expect(page.locator('[data-learning-stage]')).toHaveCount(0);

  await page.locator('#execution-cancel').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);

  // Toggle idle reset opt-out
  await expect(page.locator('#exhibit-opt-out')).toContainText('Disable idle reset · facilitated session');
  await page.locator('#exhibit-opt-out').click();
  await expect(page.locator('#exhibit-opt-out')).toContainText('Enable idle reset · 300 seconds');

  // Show facilitator reverse learning controls and overlay
  await page.locator('[data-reverse-stop="0"]').click();
  await expect(page.locator('.reverse-causal-overlay')).toBeVisible();
  await captureEvidence(page, '19-facilitator-1920.png', 'Facilitator', '[data-testid="facilitator-panel"]');

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

  // 7. Workbench profile learning preserves legacy expert learning rail / learning stations
  await page.locator('#step-learning').click();
  await expect(page.locator('#execution-controls')).toBeVisible();
  await page.locator('#execution-pin').click();
  await expect(page.locator('#execution-continue')).toBeEnabled({ timeout: 60000 });
  await expect(page.getByTestId('execution-frontier')).toContainText('stopped after matching backward node');

  // Verify legacy lower learning rail camera and lens in Workbench
  const vbDuringExecution = await page.evaluate(() => {
    const vb = (document.querySelector('#spatial-world') as any).viewBox.baseVal;
    return { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
  });
  expect(vbDuringExecution.x).toBe(2390);
  expect(vbDuringExecution.y).toBe(1160);
  await expect(page.locator('.context-lens')).toBeVisible();
  await expect(page.locator('[data-testid="live-local-construction"]')).toBeVisible();

  // Cancel execution
  await page.locator('#execution-cancel').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);

  // Focus gradient stage via toolbar button to verify learning stations and reticle
  await page.locator('.learning-toolbar button[data-learning-stage="gradient"]').click();
  await expect(page.locator('g[data-learning-stage="gradient"]')).toBeVisible();
  await expect(page.locator('g[data-learning-stage="gradient"] .external-reticle')).toBeVisible();
  await expect(page.locator('.context-lens')).toBeVisible();

  await expect.poll(async () => {
    return await page.evaluate(() => {
      const vb = (document.querySelector('#spatial-world') as any).viewBox.baseVal;
      return { x: Math.round(vb.x), y: Math.round(vb.y) };
    });
  }, { timeout: 5000 }).toEqual({ x: 2390, y: 1160 });

  await captureEvidence(
    page,
    '20-workbench-1920.png',
    'Workbench',
    'g[data-learning-stage="gradient"]'
  );
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
  await expect(page.locator('#exhibit-start')).toBeEnabled();

  // Keyboard entry
  await page.locator('#exhibit-start').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Payoff visitor buttons
  await assertMin44('#short-continue', 'Payoff Continue button');
  await assertMin44('#visitor-explore-toggle', 'Visitor Explore Toggle');
  await assertMin44('#clear-session', 'Public Reset button');
  await assertMin44('#dock-inspect', 'Dock inspect button');

  // Deeper inspection touch targets when expanded
  await page.locator('#dock-inspect').click();
  await assertMin44('[data-dock-depth="math"]', 'Dock tab Math');
  await assertMin44('.dock-tab-close', 'Dock tab Return');
  await assertMin44('[data-dock-depth="values"]', 'Dock tab Values');
  await assertMin44('[data-dock-depth="source"]', 'Dock tab Source');
  await page.locator('.dock-tab-close').click();

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
  await page.goto('/?presentation=spatial&kiosk=1&facilitator=1');
  await page.locator('#exhibit-start').click();
  await assertMin44('#operator-controls', 'Operator Controls button');
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
  await page.goto('/?presentation=spatial&kiosk=1');
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
  await assertMin44('#dock-inspect', '720p Dock inspect button');

  // Launch stepped training as visitor at 1280x720
  await page.locator('#short-teach').click();
  await expect(page.locator('#execution-controls')).toBeVisible();
  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'visitor');

  // Advance via pin to partial/stopped gradient contribution state
  await page.locator('#execution-pin').click();
  await expect(page.locator('#execution-continue')).toBeEnabled({ timeout: 60000 });
  await expect(page.getByTestId('execution-frontier')).toContainText('stopped after matching backward node');

  // Verify Math tab exposes live-contribution at 1280x720
  await page.locator('#dock-inspect').click();
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
  await captureEvidence(page, '21-prediction-1280.png', 'prediction', '[data-world-kind="probabilities"]');

  // Advance through forward stops
  await page.locator('#short-continue').click();
  await expect(page.getByTestId('lesson-progress')).toContainText('Step 1 of 5 · REPRESENT');
  await captureEvidence(page, '22-forward-route-1280.png', 'forward route', '[data-world-kind="tokenEmbedding"]');
  for (let i = 1; i < 5; i++) {
    await page.locator('#short-continue').click();
  }
  await expect(page.locator('#start-reverse-learning')).toBeVisible();

  // Enter reverse route: Stop 0 (probabilities)
  await page.locator('#start-reverse-learning').click();
  await expect(page.getByTestId('objective-anchor')).toBeVisible();

  // Advance along reverse route to Stop 2 (TRANSFORM)
  await page.locator('#reverse-continue').click(); // to Stop 1 (SCORE)
  await page.locator('#reverse-continue').click(); // to Stop 2 (TRANSFORM)
  await expect(page.getByTestId('lesson-progress')).toContainText('TRANSFORM');

  // Advance to Stop 5 (PARAMETER)
  await page.locator('#reverse-continue').click(); // to Stop 3 (MIX CONTEXT)
  await page.locator('#reverse-continue').click(); // to Stop 4 (REPRESENT)
  await page.locator('#reverse-continue').click(); // to Stop 5 (PARAMETER)
  await expect(page.getByTestId('parameter-learning-overlay')).toBeVisible();

  // Parameter contribution math at 1280x720
  await page.locator('#dock-inspect').click();
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toBeVisible();
  await page.locator('.dock-tab-close').click();

  // Advance to Stop 6 (ADAM)
  await page.locator('#reverse-continue').click();
  await expect(page.getByTestId('adam-learning-overlay')).toBeVisible();
  await expect(page.getByTestId('adam-learning-overlay')).toHaveAttribute('data-status', 'pending');
  await expect(page.getByTestId('adam-proposal-pending')).toBeVisible();
  await expect(page.getByTestId('adam-learning-overlay')).not.toContainText('-0.042');

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
  await expect(page.getByTestId('execution-frontier')).toContainText('stopped after matching backward node');

  // Positive contract for 1280x720 stopped backward camera
  await assertSvgElementInViewBox(page, '.parameter-learning-overlay', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p Parameter accumulation overlay' });
  await assertSvgElementInViewBox(page, '[data-world-parameter="wte"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p wte parameter bank' });
  await assertSvgElementInViewBox(page, '[data-world-kind="tokenEmbedding"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p tokenEmbedding owner station' });
  await expect(page.locator('.learning-stations')).toHaveCount(0);
  await expect(page.locator('[data-learning-stage]')).toHaveCount(0);

  // 25-live-backward-1280.png
  await captureEvidence(page, '25-live-backward-1280.png', 'live backward', '.parameter-learning-overlay', { wteBank: '[data-world-parameter="wte"]', owner: '[data-world-kind="tokenEmbedding"]' });

  // Advance to Candidate Ready at 1280x720
  await page.locator('#execution-continue').click();
  await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', 'ready', { timeout: 60000 });
  await expect(page.getByTestId('adam-learning-overlay')).toBeVisible();
  await expect(page.getByTestId('adam-learning-overlay')).toHaveAttribute('data-status', 'ready');
  await expect(page.getByTestId('adam-learning-overlay').getByTestId('adam-proposal-table')).toBeVisible();

  // Positive contract for 1280x720 Candidate Ready camera
  await assertSvgElementInViewBox(page, '[data-testid="adam-learning-overlay"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p Adam learning overlay' });
  await assertSvgElementInViewBox(page, '[data-world-parameter="wte"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p wte parameter bank' });
  await expect(page.locator('.learning-stations')).toHaveCount(0);
  await expect(page.locator('[data-learning-stage]')).toHaveCount(0);

  // 26-candidate-ready-1280.png
  await captureEvidence(page, '26-candidate-ready-1280.png', 'Candidate Ready', '[data-testid="adam-learning-overlay"]', { wteBank: '[data-world-parameter="wte"]' });

  // Candidate Ready Compare at 1280x720
  const cameraBeforeCompare720 = await page.evaluate(() => {
    const vb = (document.querySelector('#spatial-world') as any).viewBox.baseVal;
    return { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
  });

  await page.locator('button[data-dock-depth="compare"]').click();
  await expect(page.getByTestId('dock-compare')).toBeVisible();

  // Assert camera unchanged after opening compare
  const cameraAfterCompare720 = await page.evaluate(() => {
    const vb = (document.querySelector('#spatial-world') as any).viewBox.baseVal;
    return { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
  });
  expect(cameraAfterCompare720.x).toBeCloseTo(cameraBeforeCompare720.x, 0);
  expect(cameraAfterCompare720.y).toBeCloseTo(cameraBeforeCompare720.y, 0);
  expect(cameraAfterCompare720.width).toBeCloseTo(cameraBeforeCompare720.width, 0);
  expect(cameraAfterCompare720.height).toBeCloseTo(cameraBeforeCompare720.height, 0);

  // Assert Adam overlay and parameter bank remain visible inside active viewBox
  await assertSvgElementInViewBox(page, '[data-testid="adam-learning-overlay"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p Adam overlay during Compare' });
  await assertSvgElementInViewBox(page, '[data-world-parameter="wte"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p wte bank during Compare' });

  // 27-candidate-compare-1280.png
  await captureEvidence(page, '27-candidate-compare-1280.png', 'Candidate Compare', '[data-testid="adam-learning-overlay"]', { wteBank: '[data-world-parameter="wte"]' });

  await page.locator('.dock-tab-close').click();

  // Discard candidate
  await page.locator('#execution-cancel').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);

  // Facilitator mode at 1280x720 live learning stopped on wte
  await page.goto('/?presentation=spatial&kiosk=1&facilitator=1');
  await page.locator('#exhibit-start').click();
  await page.locator('#operator-controls').click();
  await expect(page.getByTestId('facilitator-panel')).toBeVisible();
  await page.locator('#step-learning').click();
  await expect(page.locator('#execution-controls')).toBeVisible();
  await page.locator('#execution-pin').click();
  await expect(page.locator('#execution-continue')).toBeEnabled({ timeout: 60000 });
  await expect(page.getByTestId('execution-frontier')).toContainText('stopped after matching backward node');

  // Positive contract for 720p facilitator live backward camera
  await assertSvgElementInViewBox(page, '.parameter-learning-overlay', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p Facilitator parameter accumulation overlay' });
  await assertSvgElementInViewBox(page, '[data-world-parameter="wte"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p Facilitator wte parameter bank' });
  await assertSvgElementInViewBox(page, '[data-world-kind="tokenEmbedding"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p Facilitator tokenEmbedding owner station' });
  await expect(page.locator('.learning-stations')).toHaveCount(0);
  await expect(page.locator('[data-learning-stage]')).toHaveCount(0);

  // 28-facilitator-1280.png
  await captureEvidence(page, '28-facilitator-1280.png', 'Facilitator', '.parameter-learning-overlay', { wteBank: '[data-world-parameter="wte"]', owner: '[data-world-kind="tokenEmbedding"]' });

  await page.locator('#execution-cancel').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);

  // Reduced motion live learning at 1280x720
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#step-learning').click();
  await expect(page.locator('#execution-controls')).toBeVisible();
  await page.locator('#execution-pin').click();
  await expect(page.locator('#execution-continue')).toBeEnabled({ timeout: 60000 });
  await expect(page.getByTestId('execution-frontier')).toContainText('stopped after matching backward node');

  // Positive contract for 720p reduced motion live backward camera
  await assertSvgElementInViewBox(page, '.parameter-learning-overlay', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p Reduced motion parameter accumulation overlay' });
  await assertSvgElementInViewBox(page, '[data-world-parameter="wte"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p Reduced motion wte parameter bank' });
  await assertSvgElementInViewBox(page, '[data-world-kind="tokenEmbedding"]', { requireCenterInside: true, minIntersectionRatio: 0.8, description: '720p Reduced motion tokenEmbedding owner station' });
  await expect(page.locator('.learning-stations')).toHaveCount(0);
  await expect(page.locator('[data-learning-stage]')).toHaveCount(0);

  // 29-reduced-motion-1280.png
  await captureEvidence(page, '29-reduced-motion-1280.png', 'reduced motion', '.parameter-learning-overlay', { wteBank: '[data-world-parameter="wte"]', owner: '[data-world-kind="tokenEmbedding"]' });

  await page.locator('#execution-cancel').click();
  await expect(page.locator('#execution-controls')).toHaveCount(0);
});

test('8. P0-E2 Unified contextual dock, depth switching, world dominant floor, and 40vh bound', async ({ page }) => {

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
  await captureEvidence(page, '23-deep-math-1280.png', 'deep Math', '[data-testid="dock-math"]');

  // Depth: Source
  await page.locator('[data-dock-depth="source"]').click();
  await expect(page.getByTestId('dock-source')).toBeVisible();
  const sourceDockBox = await page.getByTestId('contextual-dock').boundingBox();
  expect(sourceDockBox!.height).toBeLessThanOrEqual(720 * 0.40 + 1);
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);
  await captureEvidence(page, '24-source-1280.png', 'Source', '[data-testid="dock-source"]');

  // Return to Explain via Close button
  await page.locator('.dock-tab-close').click();
  await expect(page.getByTestId('dock-explain')).toBeVisible();
  expect(await page.evaluate(() => (window as any).abq.commands.length)).toBe(initialCommands);

  // Verify route controls remain intact and visible in Explain state
  await expect(page.getByTestId('lesson-progress')).toBeVisible();
  await expect(page.locator('#short-continue')).toBeVisible();

  // Test touch targets for dock tabs >= 44px
  const inspectBox = await page.locator('#dock-inspect').boundingBox();
  expect(inspectBox).not.toBeNull();
  expect(inspectBox!.height).toBeGreaterThanOrEqual(44);
  expect(inspectBox!.width).toBeGreaterThanOrEqual(44);
  await page.locator('#dock-inspect').click();
  for (const tab of ['explain', 'values', 'math', 'source']) {
    const tabBox = await page.locator(`button[data-dock-depth="${tab}"]`).boundingBox();
    expect(tabBox).not.toBeNull();
    expect(tabBox!.height).toBeGreaterThanOrEqual(44);
    expect(tabBox!.width).toBeGreaterThanOrEqual(44);
  }
  await page.locator('.dock-tab-close').click();

  // Facilitator mode verification: dock is also present at bottom, lens omitted
  await page.goto('/?presentation=spatial&kiosk=1&facilitator=1');
  await page.locator('#exhibit-start').click();
  await page.locator('#operator-controls').click();
  await expect(page.getByTestId('facilitator-panel')).toBeVisible();
  await expect(page.getByTestId('contextual-dock')).toBeVisible();
  await expect(page.locator('.context-lens')).toHaveCount(0);
});

test.afterAll(async () => {
  if (!qualification) return;
  await writeQualificationJson(
    root,
    qualification.allocation,
    join(qualification.report, 'browser-evidence.json'),
    {
      schemaVersion: 1,
      recordedAt: new Date().toISOString(),
      expectedRuntimeIdentity: qualification.expectedRuntimeIdentity,
      servedRuntimeRevision: servedRuntimeObservation ?? null,
      browser: browserMetadata ?? null,
      captures: manifestCaptures,
    },
  );
});
