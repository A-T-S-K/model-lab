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


interface PublicLessonDomState {
  canonicalState: string;
  displayedState: string;
  navigationMode: string;
  targetState: string;
  outcome: string;
}

type PublicLessonExpectation = Pick<PublicLessonDomState, 'canonicalState'>
  & Partial<Omit<PublicLessonDomState, 'canonicalState'>>;

async function readPublicLesson(page: Page): Promise<PublicLessonDomState> {
  return page.locator('.spatial-shell').evaluate(shell => ({
    canonicalState: shell.getAttribute('data-public-canonical-state') ?? '',
    displayedState: shell.getAttribute('data-public-displayed-state') ?? '',
    navigationMode: shell.getAttribute('data-public-navigation-mode') ?? '',
    targetState: shell.getAttribute('data-public-target-state') ?? '',
    outcome: shell.getAttribute('data-public-outcome') ?? '',
  }));
}

async function expectPublicLesson(
  page: Page,
  expected: PublicLessonExpectation,
): Promise<void> {
  const complete: PublicLessonDomState = {
    canonicalState: expected.canonicalState,
    displayedState: expected.displayedState ?? expected.canonicalState,
    navigationMode: expected.navigationMode ?? 'guided',
    targetState: expected.targetState ?? '',
    outcome: expected.outcome ?? '',
  };
  await expect.poll(() => readPublicLesson(page)).toEqual(complete);
}

async function workerCommandCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).abq.commands.length as number);
}

async function displayedRunId(page: Page): Promise<string> {
  const runId = await page.getByTestId('landmark-occurrence').getAttribute('data-run-id');
  if (!runId) throw new Error('Expected a displayed source run ID');
  return runId;
}

async function displayedCapturedInput(page: Page): Promise<string> {
  const relationship = await page.getByTestId('spatial-relationship').textContent();
  const marker = 'captured input ';
  const offset = relationship?.lastIndexOf(marker) ?? -1;
  if (!relationship || offset < 0) throw new Error('Expected displayed captured input metadata');
  return relationship.slice(offset + marker.length).trim();
}

async function expectDisplayedComputation(
  page: Page,
  runId: string,
  capturedInput: string,
  commandCount: number,
): Promise<void> {
  await expect(page.getByTestId('landmark-occurrence')).toHaveAttribute('data-run-id', runId);
  await expect.poll(() => displayedCapturedInput(page)).toBe(capturedInput);
  await expect.poll(() => workerCommandCount(page)).toBe(commandCount);
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
  const observed = await page.evaluate(() => {
    const shell = document.querySelector('.spatial-shell');
    return {
      devicePixelRatio: window.devicePixelRatio,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'reduce' as const
        : 'no-preference' as const,
      experienceProfile: shell?.getAttribute('data-experience-profile') ?? undefined,
      activeDepth: document.querySelector('[data-testid="contextual-dock"]')?.getAttribute('data-active-depth') ?? undefined,
      lesson: shell ? {
        canonicalState: shell.getAttribute('data-public-canonical-state') ?? undefined,
        displayedState: shell.getAttribute('data-public-displayed-state') ?? undefined,
        targetState: shell.getAttribute('data-public-target-state') ?? undefined,
        navigationMode: shell.getAttribute('data-public-navigation-mode') ?? undefined,
        outcome: shell.getAttribute('data-public-outcome') ?? undefined,
      } : undefined,
    };
  });
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
    lesson: observed.lesson,
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

test('2. current Part 1 semantics, representative depth, and zero-execution continuity', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await expect(page.locator('#exhibit-start')).toBeEnabled();
  await page.locator('#exhibit-start').click();

  await expectPublicLesson(page, { canonicalState: 'p1_prediction_preview' });
  const commandBaseline = await workerCommandCount(page);
  const guidedRunId = await displayedRunId(page);
  const guidedInput = await displayedCapturedInput(page);
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);
  await captureEvidence(page, '03-part1-opening-1920.png', 'p1_prediction_preview', '[data-world-kind="probabilities"]');

  await page.locator('#short-continue').click();
  await expectPublicLesson(page, { canonicalState: 'p1_represent' });
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);
  await captureEvidence(page, '04-part1-representation-1920.png', 'p1_represent', '[data-world-kind="preAttentionNorm"]');

  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p1_represent', navigationMode: 'detail' });
  await expect(page.getByTestId('contextual-dock')).toHaveAttribute('data-active-depth', 'values');
  await expect(page.getByTestId('dock-values')).toHaveAttribute('data-public-depth-kind', 'representation');
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);

  await page.locator('button[data-dock-depth="math"]').click();
  await expectPublicLesson(page, { canonicalState: 'p1_represent', navigationMode: 'detail' });
  await expect(page.getByTestId('contextual-dock')).toHaveAttribute('data-active-depth', 'math');
  await expect(page.getByTestId('dock-math')).toHaveAttribute('data-public-depth-kind', 'representation');
  const scalarAction = page.locator('#microscope button[data-source-run][data-artifact][data-element]');
  await expect(scalarAction).toHaveAttribute('data-source-run', guidedRunId);
  await expect(scalarAction).toHaveAttribute('data-artifact', /.+/);
  await expect(scalarAction).toHaveAttribute('data-element', /^\d+$/);
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);

  await page.locator('button[data-dock-depth="source"]').click();
  await expectPublicLesson(page, { canonicalState: 'p1_represent', navigationMode: 'detail' });
  await expect(page.getByTestId('contextual-dock')).toHaveAttribute('data-active-depth', 'source');
  await expect(page.getByTestId('dock-source')).toHaveAttribute('data-public-depth-kind', 'representation');
  await expect(page.getByTestId('spatial-run')).toHaveText(guidedRunId);
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);

  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p1_represent' });
  await expect(page.getByTestId('contextual-dock')).toHaveAttribute('data-active-depth', 'explain');
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);

  await page.locator('#short-continue').click();
  await expectPublicLesson(page, { canonicalState: 'p1_qkv' });
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);
  await captureEvidence(page, '05-part1-qkv-1920.png', 'p1_qkv', '[data-world-kind="q"]');

  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p1_qkv', navigationMode: 'detail' });
  await expect(page.getByTestId('dock-values')).toHaveAttribute('data-public-depth-kind', 'qkv');
  for (const member of ['q', 'k', 'v']) {
    await expect(page.locator(`button[data-depth-member="${member}"]`).first()).toBeVisible();
  }
  await page.locator('button[data-dock-depth="source"]').click();
  await expect(page.getByTestId('spatial-run')).toHaveText(guidedRunId);
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);
  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p1_qkv' });

  await page.locator('#short-continue').click();
  await expectPublicLesson(page, { canonicalState: 'p1_attention_compare' });
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);

  await page.locator('#short-continue').click();
  await expectPublicLesson(page, { canonicalState: 'p1_attention_weights' });
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);

  await page.locator('#short-continue').click();
  await expectPublicLesson(page, { canonicalState: 'p1_value_mixture' });
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);
  await captureEvidence(page, '06-part1-value-mixture-1920.png', 'p1_value_mixture', '[data-world-kind="headOutput"]');

  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p1_value_mixture', navigationMode: 'detail' });
  await expect(page.getByTestId('dock-values')).toHaveAttribute('data-public-depth-kind', 'value-mixture');
  await expect(page.getByTestId('value-mixture-support')).toBeVisible();
  await expect(page.getByTestId('value-mixture-incomplete')).toHaveCount(0);
  for (const member of ['weights', 'values', 'headOutput']) {
    await expect(page.locator(`button[data-depth-member="${member}"]`).first()).toBeVisible();
  }
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);
  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p1_value_mixture' });

  await page.locator('#short-continue').click();
  await expectPublicLesson(page, { canonicalState: 'p1_attention_integration' });
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);

  await page.locator('#short-continue').click();
  await expectPublicLesson(page, { canonicalState: 'p1_transform' });
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);
  await captureEvidence(page, '07-part1-mlp-1920.png', 'p1_transform', '[data-world-kind="mlpResidual"]');

  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p1_transform', navigationMode: 'detail' });
  await expect(page.getByTestId('dock-values')).toHaveAttribute('data-public-depth-kind', 'mlp');
  await expect(page.getByTestId('mlp-depth-shapes')).toContainText('8 -> 32 -> 32 -> 8');
  for (const member of ['mlpUp', 'mlpRelu', 'mlpDown']) {
    await expect(page.locator(`button[data-depth-member="${member}"]`).first()).toBeVisible();
  }
  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toHaveAttribute('data-public-depth-kind', 'mlp');
  await expect(page.getByTestId('mlp-contraction-support')).toContainText('all 32 hidden activations');
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);
  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p1_transform' });

  await page.locator('#short-continue').click();
  await expectPublicLesson(page, { canonicalState: 'p1_score' });
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);

  await page.locator('#short-continue').click();
  await expectPublicLesson(page, { canonicalState: 'p1_probabilities' });
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);

  await page.locator('#short-continue').click();
  await expectPublicLesson(page, { canonicalState: 'p1_complete' });
  await expectDisplayedComputation(page, guidedRunId, guidedInput, commandBaseline);
  await captureEvidence(page, '08-part1-complete-1920.png', 'p1_complete', '[data-world-kind="probabilities"]');
});

test('2b. Guided Explore restores the exact Part 1 computation', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await expect(page.locator('#exhibit-start')).toBeEnabled();
  await page.locator('#exhibit-start').click();

  await expectPublicLesson(page, { canonicalState: 'p1_prediction_preview' });
  await page.locator('#short-continue').click();
  await expectPublicLesson(page, { canonicalState: 'p1_represent' });

  const originalRunId = await displayedRunId(page);
  const originalInput = await displayedCapturedInput(page);
  const commandBaseline = await workerCommandCount(page);

  const guidedAnchor = page
    .locator('#spatial-world [data-world-kind="preAttentionNorm"].explanation-active')
    .first();
  await expect(guidedAnchor).toBeVisible();
  await guidedAnchor.click();
  await expectPublicLesson(page, {
    canonicalState: 'p1_represent',
    navigationMode: 'explore',
  });
  await expect(page.locator('#document')).toBeVisible();
  await expect(page.locator('#predict')).toBeVisible();
  await expect(page.getByTestId('landmark-occurrence')).toHaveAttribute('data-run-id', originalRunId);

  const exploreInput = originalInput === 'abc' ? 'cba' : 'abc';
  await page.locator('#document').fill(exploreInput);
  await expect(page.locator('#document')).toHaveValue(exploreInput);
  await page.locator('#predict').click();

  await expect.poll(() => displayedRunId(page)).not.toBe(originalRunId);
  await expectPublicLesson(page, {
    canonicalState: 'p1_represent',
    navigationMode: 'explore',
  });
  const exploreRunId = await displayedRunId(page);
  expect(exploreRunId).not.toBe(originalRunId);
  await expect.poll(() => displayedCapturedInput(page)).toBe(exploreInput);
  const commandsAfterExplorePrediction = await workerCommandCount(page);
  expect(commandsAfterExplorePrediction).toBeGreaterThan(commandBaseline);

  await expect(page.locator('#short-resume')).toBeVisible();
  await page.locator('#short-resume').click();
  await expectPublicLesson(page, { canonicalState: 'p1_represent' });
  await expect(page.getByTestId('landmark-occurrence')).toHaveAttribute('data-run-id', originalRunId);
  await expect.poll(() => displayedCapturedInput(page)).toBe(originalInput);
  await expect.poll(() => workerCommandCount(page)).toBe(commandsAfterExplorePrediction);

  const latestExecutedRunId = await page.evaluate(() =>
    (window as any).abq.lastResult?.run?.manifest?.runId as string | undefined
  );
  expect(latestExecutedRunId).toBe(exploreRunId);
});

async function reachCurrentPart1Complete(page: Page): Promise<void> {
  await page.goto('/?presentation=spatial&kiosk=1');
  await expect(page.locator('#exhibit-start')).toBeEnabled();
  await page.locator('#exhibit-start').click();
  await expectPublicLesson(page, { canonicalState: 'p1_prediction_preview' });

  const remainingStates = [
    'p1_represent',
    'p1_qkv',
    'p1_attention_compare',
    'p1_attention_weights',
    'p1_value_mixture',
    'p1_attention_integration',
    'p1_transform',
    'p1_score',
    'p1_probabilities',
    'p1_complete',
  ];

  for (const canonicalState of remainingStates) {
    await page.locator('#short-continue').click();
    await expectPublicLesson(page, { canonicalState });
  }
}

async function waitForCurrentPublicState(
  page: Page,
  canonicalState: string,
  timeout = 60_000,
): Promise<void> {
  await expect(page.locator('.spatial-shell')).toHaveAttribute(
    'data-public-canonical-state',
    canonicalState,
    { timeout },
  );
  await expectPublicLesson(page, { canonicalState });
}

async function startCurrentPart2(page: Page): Promise<void> {
  await reachCurrentPart1Complete(page);
  await expect(page.locator('#short-teach')).toBeVisible();
  await expect(page.locator('#short-teach')).toBeEnabled();
  await page.locator('#short-teach').click();
  await waitForCurrentPublicState(page, 'p2_objective');
  await expect(page.locator('#reverse-continue')).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByTestId('objective-anchor')).toHaveAttribute('data-objective-availability', 'available');
}

async function advanceCurrentPart2(page: Page, target: string): Promise<void> {
  await expect(page.locator('#reverse-continue')).toBeEnabled({ timeout: 60_000 });
  await page.locator('#reverse-continue').click();
  await waitForCurrentPublicState(page, target);
  if (target === 'candidate_ready') {
    await expect(page.locator('#execution-accept')).toBeEnabled({ timeout: 60_000 });
    await expect(page.locator('#execution-cancel')).toBeEnabled({ timeout: 60_000 });
  } else {
    await expect(page.locator('#reverse-continue')).toBeEnabled({ timeout: 60_000 });
  }
}

async function driveCurrentPart2ToCandidateReady(page: Page): Promise<void> {
  await startCurrentPart2(page);
  await advanceCurrentPart2(page, 'p2_backward_trace');
  await advanceCurrentPart2(page, 'p2_gradient_contribution');
  await advanceCurrentPart2(page, 'p2_final_gradient');
  await advanceCurrentPart2(page, 'p2_adam_proposal');
  await advanceCurrentPart2(page, 'candidate_ready');
}

test('2c. current Part 2 semantics, authentic depth, ancestry, and candidate contract', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await startCurrentPart2(page);

  await expect(page.locator('.spatial-shell')).toHaveAttribute('data-experience-profile', 'visitor');

  // Objective is authentic multi-position evidence. Details are read-only.
  const objectiveAnchor = page.getByTestId('objective-anchor');
  await expect(objectiveAnchor).toBeVisible();
  await expect(objectiveAnchor).toHaveAttribute('data-objective-availability', 'available');
  await expect(objectiveAnchor).toHaveAttribute('data-objective-mean-origin', 'OBSERVED');
  const objectivePositions = Number(await objectiveAnchor.getAttribute('data-objective-positions'));
  expect(objectivePositions).toBeGreaterThan(1);
  const objectiveCommands = await workerCommandCount(page);
  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p2_objective', navigationMode: 'detail' });
  await expect(page.getByTestId('contextual-dock')).toHaveAttribute('data-active-depth', 'values');
  await expect(page.getByTestId('dock-values')).toHaveAttribute('data-public-training-depth-kind', 'objective');
  await expect(page.getByTestId('public-training-objective')).toBeVisible();
  expect(await page.getByTestId('public-training-objective').locator('tbody tr').count()).toBeGreaterThan(1);
  expect(await workerCommandCount(page)).toBe(objectiveCommands);

  await page.locator('button[data-dock-depth="math"]').click();
  await expectPublicLesson(page, { canonicalState: 'p2_objective', navigationMode: 'detail' });
  await expect(page.getByTestId('contextual-dock')).toHaveAttribute('data-active-depth', 'math');
  await expect(page.getByTestId('dock-math')).toHaveAttribute('data-public-training-depth-kind', 'objective');
  expect(await workerCommandCount(page)).toBe(objectiveCommands);

  await page.locator('button[data-dock-depth="source"]').click();
  await expectPublicLesson(page, { canonicalState: 'p2_objective', navigationMode: 'detail' });
  await expect(page.getByTestId('contextual-dock')).toHaveAttribute('data-active-depth', 'source');
  await expect(page.getByTestId('dock-source')).toHaveAttribute('data-public-training-depth-kind', 'objective');
  const objectiveTrainingSource = (
    await page.getByTestId('dock-source')
      .locator('p', { hasText: 'Training source:' })
      .locator('code')
      .textContent()
  )?.trim() ?? '';
  expect(objectiveTrainingSource).not.toBe('');
  expect(await workerCommandCount(page)).toBe(objectiveCommands);

  await page.locator('button[data-dock-depth="math"]').click();
  const objectiveMicroscopeActions = page.getByTestId('dock-math')
    .locator('button[data-source-run][data-artifact][data-element]');
  await expect(objectiveMicroscopeActions.first()).toBeVisible();
  const objectiveMicroscopeCount = await objectiveMicroscopeActions.count();
  expect(objectiveMicroscopeCount).toBeGreaterThan(0);
  for (let i = 0; i < objectiveMicroscopeCount; i++) {
    await expect(objectiveMicroscopeActions.nth(i)).toHaveAttribute('data-source-run', objectiveTrainingSource);
    await expect(objectiveMicroscopeActions.nth(i)).toHaveAttribute('data-artifact', /.+/);
    await expect(objectiveMicroscopeActions.nth(i)).toHaveAttribute('data-element', /^\d+$/);
  }
  expect(await workerCommandCount(page)).toBe(objectiveCommands);
  await captureEvidence(page, '10-part2-objective-1920.png', 'p2_objective', '[data-testid="objective-anchor"]', {
    probabilities: '[data-world-kind="probabilities"]',
  });

  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p2_objective' });
  expect(await workerCommandCount(page)).toBe(objectiveCommands);

  // Objective -> backward trace is explanatory state progression, not new execution.
  const beforeBackwardTrace = await workerCommandCount(page);
  await advanceCurrentPart2(page, 'p2_backward_trace');
  expect(await workerCommandCount(page)).toBe(beforeBackwardTrace);
  await expect(page.getByTestId('reverse-causal-overlay')).toBeVisible();
  await expect(page.locator('.reverse-causal-edge').first()).toHaveAttribute('data-reverse-from-kind');
  await expect(page.locator('.reverse-causal-edge').first()).toHaveAttribute('data-reverse-to-kind');
  await expect(page.locator('.reverse-causal-edge[data-reverse-from-kind="mlpResidual"][data-reverse-to-kind="attentionResidual"]')).toBeVisible();
  await expect(page.locator('.reverse-causal-edge[data-reverse-from-kind="attentionResidual"][data-reverse-to-kind="embeddingNorm"]')).toBeVisible();
  await expect(page.locator('.reverse-causal-edge[data-reverse-from-kind="headOutput"][data-reverse-to-kind="preAttentionNorm"]')).toHaveCount(0);
  await expect(page.locator('.reverse-region-guide')).not.toHaveCount(0);
  const reverseTruthCue = page.getByTestId('reverse-truth-cue');
  await expect(reverseTruthCue).toContainText('dependency and sensitivity through the same computation');
  await expect(reverseTruthCue).toContainText('not measured runtime timing');
  await expect(reverseTruthCue).toContainText('execution being undone');
  await captureEvidence(page, '11-part2-backward-trace-1920.png', 'p2_backward_trace', '.reverse-causal-overlay');

  // Backward trace -> one contribution is evidence-gated authentic execution.
  const beforeContribution = await workerCommandCount(page);
  await advanceCurrentPart2(page, 'p2_gradient_contribution');
  expect(await workerCommandCount(page)).toBeGreaterThan(beforeContribution);
  await expect(page.getByTestId('parameter-learning-overlay')).toBeVisible();
  await expect(page.getByTestId('dock-explain')).toContainText('still a partial gradient');
  await expect(page.locator('.learning-stations')).toHaveCount(0);
  await expect(page.locator('[data-learning-stage]')).toHaveCount(0);

  const contributionCommands = await workerCommandCount(page);
  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p2_gradient_contribution', navigationMode: 'detail' });
  await expect(page.getByTestId('contextual-dock')).toHaveAttribute('data-active-depth', 'values');
  await expect(page.getByTestId('dock-values')).toHaveAttribute('data-public-training-depth-kind', 'gradient-contribution');
  await expect(page.getByTestId('retained-contribution-truth')).toContainText('retained matching subset');
  await expect(page.getByTestId('retained-contribution-truth')).toContainText('not claimed to be complete fan-in');
  await expect(page.getByTestId('public-final-gradient')).toHaveCount(0);

  const contributionHeading = page.getByTestId('dock-values').locator('h3');
  const parameterWitnessBeforeSelection = (await contributionHeading.textContent())?.trim() ?? '';
  expect(parameterWitnessBeforeSelection).toContain('wte[');
  expect(parameterWitnessBeforeSelection).toContain('flat index');

  const firstRetainedOccurrence = page.locator('button[data-training-contribution-ordinal]').first();
  await expect(firstRetainedOccurrence).toBeVisible();
  const retainedRow = firstRetainedOccurrence.locator('xpath=ancestor::tr');
  const retainedChild = (await retainedRow.locator('td').nth(1).textContent())?.trim() ?? '';
  expect(retainedChild).not.toBe('');
  await firstRetainedOccurrence.click();
  await expect(contributionHeading).toHaveText(parameterWitnessBeforeSelection);
  await expectPublicLesson(page, { canonicalState: 'p2_gradient_contribution', navigationMode: 'detail' });
  expect(await workerCommandCount(page)).toBe(contributionCommands);

  await page.locator('button[data-dock-depth="source"]').click();
  const contributionSource = page.getByTestId('dock-source');
  await expect(contributionSource).toHaveAttribute('data-public-training-depth-kind', 'gradient-contribution');
  const contributionTrainingSource = (
    await contributionSource.locator('p', { hasText: 'Training source:' }).locator('code').textContent()
  )?.trim() ?? '';
  expect(contributionTrainingSource).not.toBe('');
  const exactParameterWitness = (await contributionSource.locator('p', { hasText: 'Parameter witness:' }).textContent())?.trim() ?? '';
  expect(exactParameterWitness).toContain('wte[');
  expect(exactParameterWitness).toContain('flat index');
  expect(await workerCommandCount(page)).toBe(contributionCommands);

  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toHaveAttribute('data-public-training-depth-kind', 'gradient-contribution');
  await expect(page.getByTestId('public-contribution-math')).toBeVisible();
  const retainedChildAction = page.getByTestId('dock-math').locator('button[data-live-source][data-live-child]');
  await expect(retainedChildAction).toHaveAttribute('data-live-source', contributionTrainingSource);
  await expect(retainedChildAction).toHaveAttribute('data-live-child', retainedChild);
  expect(await workerCommandCount(page)).toBe(contributionCommands);
  await captureEvidence(page, '12-part2-one-contribution-1920.png', 'p2_gradient_contribution', '.parameter-learning-overlay', {
    wteBank: '[data-world-parameter="wte"]',
    owner: '[data-world-kind="tokenEmbedding"]',
  });
  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p2_gradient_contribution' });

  // Complete backward and bind explicit final-gradient ancestry.
  const beforeFinalGradient = await workerCommandCount(page);
  await advanceCurrentPart2(page, 'p2_final_gradient');
  expect(await workerCommandCount(page)).toBeGreaterThan(beforeFinalGradient);
  await expect(page.getByTestId('parameter-learning-overlay')).toBeVisible();

  const finalGradientCommands = await workerCommandCount(page);
  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p2_final_gradient', navigationMode: 'detail' });
  await expect(page.getByTestId('dock-values')).toHaveAttribute('data-public-training-depth-kind', 'final-gradient');
  await expect(page.getByTestId('dock-values')).toContainText('Backward complete: YES');
  await expect(page.getByTestId('public-final-gradient')).toBeVisible();
  await expect(page.getByTestId('retained-fanin-status')).toContainText('RETAINED SUBSET, not complete fan-in');
  expect(await workerCommandCount(page)).toBe(finalGradientCommands);

  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toHaveAttribute('data-public-training-depth-kind', 'final-gradient');
  await expect(page.getByTestId('no-retained-sum')).toContainText('not summed or presented as complete fan-in');
  const finalGradientAction = page.getByTestId('dock-math')
    .locator('button[data-source-run][data-gradient-parameter]')
    .first();
  await expect(finalGradientAction).toBeVisible();
  const finalGradientSourceRun = await finalGradientAction.getAttribute('data-source-run');
  const finalGradientParameter = await finalGradientAction.getAttribute('data-gradient-parameter');
  expect(finalGradientSourceRun).toBeTruthy();
  expect(finalGradientParameter).toMatch(/^\d+$/);
  expect(await workerCommandCount(page)).toBe(finalGradientCommands);
  await captureEvidence(page, '13-part2-final-gradient-1920.png', 'p2_final_gradient', '.parameter-learning-overlay', {
    wteBank: '[data-world-parameter="wte"]',
  });
  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p2_final_gradient' });

  // Adam consumes the same completed gradient but remains a provisional proposal.
  const beforeAdam = await workerCommandCount(page);
  await advanceCurrentPart2(page, 'p2_adam_proposal');
  expect(await workerCommandCount(page)).toBeGreaterThan(beforeAdam);
  await expect(page.getByTestId('adam-learning-overlay')).toBeVisible();
  await expect(page.getByTestId('adam-learning-overlay')).toHaveAttribute('data-provisional', 'true');
  await expect(page.getByTestId('adam-learning-overlay')).toHaveAttribute('data-status', 'ready');
  await expect(page.getByTestId('adam-learning-overlay')).toContainText('ACCEPTED MODEL UNCHANGED');

  const adamCommands = await workerCommandCount(page);
  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p2_adam_proposal', navigationMode: 'detail' });
  await expect(page.getByTestId('dock-values')).toHaveAttribute('data-public-training-depth-kind', 'adam');
  await expect(page.getByTestId('dock-values')).toContainText('PROVISIONAL');
  await expect(page.getByTestId('dock-values')).toContainText('ACCEPTED MODEL UNCHANGED');
  expect(await workerCommandCount(page)).toBe(adamCommands);

  await page.locator('button[data-dock-depth="math"]').click();
  await expect(page.getByTestId('dock-math')).toHaveAttribute('data-public-training-depth-kind', 'adam');
  const adamGradientAction = page.getByTestId('dock-math')
    .locator('button[data-source-run][data-gradient-parameter]')
    .first();
  await expect(adamGradientAction).toHaveAttribute('data-source-run', finalGradientSourceRun!);
  await expect(adamGradientAction).toHaveAttribute('data-gradient-parameter', finalGradientParameter!);
  await expect(page.getByTestId('dock-math').locator('button[data-artifact][data-element]')).toHaveCount(0);
  expect(await workerCommandCount(page)).toBe(adamCommands);
  await captureEvidence(page, '14-part2-adam-proposal-1920.png', 'p2_adam_proposal', '[data-testid="adam-learning-overlay"]', {
    wteBank: '[data-world-parameter="wte"]',
  });
  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'p2_adam_proposal' });

  // Candidate evaluation is authentic execution; acceptance state remains untouched.
  const beforeCandidate = await workerCommandCount(page);
  await advanceCurrentPart2(page, 'candidate_ready');
  expect(await workerCommandCount(page)).toBeGreaterThan(beforeCandidate);
  await expectPublicLesson(page, {
    canonicalState: 'candidate_ready',
    displayedState: 'candidate_ready',
    navigationMode: 'guided',
    outcome: '',
  });
  await expect(page.locator('.candidate-decision-pair')).toBeVisible();
  await expect(page.locator('#execution-accept')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toContainText('Discard candidate');
  await expect(page.locator('button[data-dock-depth="compare"]')).toBeVisible();
  await expect(page.locator('.decision-summary')).toHaveCount(0);
  await expect(page.locator('.learning-stations')).toHaveCount(0);
  await expect(page.locator('[data-learning-stage]')).toHaveCount(0);
  await captureEvidence(page, '15-candidate-ready-1920.png', 'candidate_ready', '[data-world-kind="probabilities"]');

  // Compare is a read-only detail detour and must not move the public camera or decision state.
  const cameraBeforeCompare = await page.evaluate(() => {
    const vb = (document.querySelector('#spatial-world') as any).viewBox.baseVal;
    return { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
  });
  const commandsBeforeCompare = await workerCommandCount(page);
  await page.locator('button[data-dock-depth="compare"]').click();
  await expectPublicLesson(page, { canonicalState: 'candidate_ready', navigationMode: 'detail', outcome: '' });
  await expect(page.getByTestId('contextual-dock')).toHaveAttribute('data-active-depth', 'compare');
  expect(await workerCommandCount(page)).toBe(commandsBeforeCompare);
  const compareContent = page.getByTestId('dock-compare');
  await expect(compareContent).toBeVisible();
  await expect(compareContent).toContainText('Current / Candidate');
  await expect(compareContent.getByTestId('before-mean')).toBeVisible();
  await expect(compareContent.getByTestId('after-mean')).toBeVisible();
  await expect(compareContent).not.toContainText('No active comparison available');

  const cameraAfterCompare = await page.evaluate(() => {
    const vb = (document.querySelector('#spatial-world') as any).viewBox.baseVal;
    return { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
  });
  expect(cameraAfterCompare.x).toBeCloseTo(cameraBeforeCompare.x, 0);
  expect(cameraAfterCompare.y).toBeCloseTo(cameraBeforeCompare.y, 0);
  expect(cameraAfterCompare.width).toBeCloseTo(cameraBeforeCompare.width, 0);
  expect(cameraAfterCompare.height).toBeCloseTo(cameraBeforeCompare.height, 0);
  await captureEvidence(page, '16-candidate-compare-1920.png', 'candidate_ready compare', '[data-world-kind="probabilities"]');

  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'candidate_ready', outcome: '' });

  // Candidate Details expose only candidate-side live scalar ancestry.
  const candidateDetailCommands = await workerCommandCount(page);
  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'candidate_ready', navigationMode: 'detail', outcome: '' });
  await expect(page.getByTestId('contextual-dock')).toHaveAttribute('data-active-depth', 'values');
  await expect(page.getByTestId('dock-values')).toHaveAttribute('data-public-training-depth-kind', 'candidate');
  await expect(page.getByTestId('dock-values')).toContainText('candidate evaluated');
  await expect(page.getByTestId('dock-values')).toContainText('candidate not accepted');
  await expect(page.getByTestId('dock-values')).toContainText('candidate not live');
  expect(await workerCommandCount(page)).toBe(candidateDetailCommands);

  await page.locator('button[data-dock-depth="source"]').click();
  const candidateSourcePane = page.getByTestId('dock-source');
  const baselineRunId = (
    await candidateSourcePane.locator('p', { hasText: 'Baseline run:' }).locator('code').textContent()
  )?.trim() ?? '';
  const candidateRunId = (
    await candidateSourcePane.locator('p', { hasText: 'Candidate run:' }).locator('code').textContent()
  )?.trim() ?? '';
  expect(baselineRunId).not.toBe('');
  expect(candidateRunId).not.toBe('');
  expect(candidateRunId).not.toBe(baselineRunId);
  expect(await workerCommandCount(page)).toBe(candidateDetailCommands);

  await page.locator('button[data-dock-depth="math"]').click();
  const candidateMath = page.getByTestId('dock-math');
  await expect(candidateMath).toHaveAttribute('data-public-training-depth-kind', 'candidate');
  const candidateScalarActions = candidateMath.locator('button[data-source-run][data-artifact][data-element]');
  await expect(candidateScalarActions).toHaveCount(1);
  await expect(candidateScalarActions.first()).toHaveAttribute('data-source-run', candidateRunId);
  await expect(candidateScalarActions.first()).toHaveAttribute('data-artifact', /.+/);
  await expect(candidateScalarActions.first()).toHaveAttribute('data-element', /^\d+$/);
  await expect(page.getByTestId('baseline-scalar-inspection-unavailable')).toBeVisible();
  expect(await workerCommandCount(page)).toBe(candidateDetailCommands);

  await page.locator('#dock-inspect').click();
  await expectPublicLesson(page, { canonicalState: 'candidate_ready', outcome: '' });
});

test('3. current Part 2 candidate discard preserves accepted authority', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await driveCurrentPart2ToCandidateReady(page);

  await expectPublicLesson(page, {
    canonicalState: 'candidate_ready',
    displayedState: 'candidate_ready',
    navigationMode: 'guided',
    outcome: '',
  });
  const beforeDiscard = await page.evaluate(() => (window as any).abq);
  const acceptedOptimizerStepBefore = beforeDiscard.lastReady?.state.optimizer.step ?? 0;

  await page.locator('#execution-cancel').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute(
    'data-public-canonical-state',
    'tour_complete',
    { timeout: 60_000 },
  );
  await expectPublicLesson(page, {
    canonicalState: 'tour_complete',
    displayedState: 'tour_complete',
    navigationMode: 'guided',
    outcome: 'discarded',
  });
  await expect(page.getByTestId('tour-completion-headline')).toHaveText('MODEL LAB COMPLETE · UPDATE DISCARDED');
  await expect(page.locator('#execution-controls')).toHaveCount(0);
  await captureEvidence(page, '18-post-discard-1920.png', 'tour_complete discarded');

  const afterDiscard = await page.evaluate(() => (window as any).abq);
  expect(afterDiscard.commands.filter((c: any) => c.command === 'acceptTraining')).toHaveLength(0);
  expect(afterDiscard.commands.some((c: any) => c.command === 'cancelForward')).toBe(true);
  expect(afterDiscard.lastReady?.state.optimizer.step ?? 0).toBe(acceptedOptimizerStepBefore);
});

test('3b. current Part 2 candidate accept commits once and public reset restores baseline', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await audit(page);
  await driveCurrentPart2ToCandidateReady(page);

  await expectPublicLesson(page, {
    canonicalState: 'candidate_ready',
    displayedState: 'candidate_ready',
    navigationMode: 'guided',
    outcome: '',
  });
  await expect(page.locator('#execution-accept')).toBeVisible();
  await expect(page.locator('#execution-accept')).toBeEnabled();

  await page.locator('#execution-accept').click();
  await expect(page.locator('.spatial-shell')).toHaveAttribute(
    'data-public-canonical-state',
    'tour_complete',
    { timeout: 60_000 },
  );
  await expectPublicLesson(page, {
    canonicalState: 'tour_complete',
    displayedState: 'tour_complete',
    navigationMode: 'guided',
    outcome: 'accepted',
  });
  await expect(page.getByTestId('tour-completion-headline')).toHaveText('MODEL LAB COMPLETE · UPDATE ACCEPTED');
  await expect(page.locator('#execution-controls')).toHaveCount(0);

  const afterAccept = await page.evaluate(() => (window as any).abq);
  expect(afterAccept.commands.filter((c: any) => c.command === 'acceptTraining')).toHaveLength(1);
  expect(afterAccept.lastResult?.trainingStep).toBe(1);
  await captureEvidence(page, '17-post-accept-1920.png', 'tour_complete accepted');

  await page.locator('#clear-session').click();
  await expect(page.locator('#exhibit-start')).toBeEnabled();
  await page.locator('#exhibit-start').click();
  await waitForCurrentPublicState(page, 'p1_prediction_preview');
  const afterReset = await page.evaluate(() => (window as any).abq);
  expect(afterReset.lastReady?.state.optimizer.step).toBe(0);
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

test('7. current Guided route fits 1280x720 and reduced motion', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await audit(page);
  await page.goto('/?presentation=spatial&kiosk=1');
  await expect(page.locator('#exhibit-start')).toBeVisible();
  await captureEvidence(page, '20-attract-1280.png', 'attract');
  await page.locator('#exhibit-start').click();
  await waitForCurrentPublicState(page, 'p1_prediction_preview');
  await expect(page.locator('#short-continue')).toBeVisible();
  await captureEvidence(page, '21-prediction-1280.png', 'prediction', '[data-world-kind="probabilities"]');
  await page.locator('#short-continue').click();
  await waitForCurrentPublicState(page, 'p1_represent');
  await expect(page.getByTestId('lesson-progress')).toContainText('MAKE A PREDICTION');
  await captureEvidence(page, '22-represent-1280.png', 'represent', '[data-world-kind="preAttentionNorm"]');
  await page.locator('#short-continue').click();
  await waitForCurrentPublicState(page, 'p1_qkv');
  for (const kind of ['q', 'k', 'v']) {
    await assertSvgElementInViewBox(page, `[data-world-kind="${kind}"][data-world-head="0"]`, {
      requireCenterInside: true, minIntersectionRatio: 0.5, description: `720p ${kind} teaching target`,
    });
  }
  await captureEvidence(page, '23-qkv-1280.png', 'qkv', '[data-world-kind="q"]');
  for (const state of ['p1_attention_compare', 'p1_attention_weights', 'p1_value_mixture', 'p1_attention_integration', 'p1_transform', 'p1_score', 'p1_probabilities', 'p1_complete']) {
    await page.locator('#short-continue').click();
    await waitForCurrentPublicState(page, state);
  }
  await expect(page.locator('#short-teach')).toBeVisible();
  await captureEvidence(page, '24-part1-complete-1280.png', 'p1_complete');
  await page.locator('#short-teach').click();
  await waitForCurrentPublicState(page, 'p2_objective');
  await expect(page.getByTestId('lesson-progress')).toContainText('LEARN FROM ERROR');
  await expect(page.locator('#reverse-continue')).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByTestId('objective-anchor')).toHaveAttribute('data-objective-availability', 'available');
  await captureEvidence(page, '25-objective-1280.png', 'p2_objective', '[data-testid="objective-anchor"]');
  for (const state of ['p2_backward_trace', 'p2_gradient_contribution', 'p2_final_gradient']) {
    await advanceCurrentPart2(page, state);
  }
  await captureEvidence(page, '26-gradient-1280.png', 'p2_final_gradient', '.parameter-learning-overlay');
  await advanceCurrentPart2(page, 'p2_adam_proposal');
  await captureEvidence(page, '27-adam-1280.png', 'p2_adam_proposal', '[data-testid="adam-learning-overlay"]');
  await advanceCurrentPart2(page, 'candidate_ready');
  await expect(page.locator('#execution-accept')).toBeVisible();
  await expect(page.locator('#execution-cancel')).toBeVisible();
  await captureEvidence(page, '28-candidate-1280.png', 'candidate_ready', '[data-world-kind="probabilities"]');
  await page.locator('#execution-cancel').click();
  await expectPublicLesson(page, { canonicalState: 'tour_complete', outcome: 'discarded' });
  await expect(page.getByTestId('tour-completion-headline')).toBeVisible();
  await captureEvidence(page, '29-complete-1280.png', 'tour_complete');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#clear-session').click();
  await page.locator('#exhibit-start').click();
  await waitForCurrentPublicState(page, 'p1_prediction_preview');
  await page.locator('#short-continue').click();
  await waitForCurrentPublicState(page, 'p1_represent');
  await assertSvgElementInViewBox(page, '[data-world-kind="preAttentionNorm"]', {
    requireCenterInside: true, minIntersectionRatio: 0.5, description: 'reduced-motion representation target',
  });
  await captureEvidence(page, '30-reduced-motion-1280.png', 'p1_represent');
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
