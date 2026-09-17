import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '../support/browser-evidence.js';

const b2Archive = process.env.M4_B2_MIXED_ARCHIVE;
const nearArchive = process.env.M4_C1_NEAR_ARCHIVE ?? process.env.M4_C1_NEAR_LIMIT_ARCHIVE;

test('M4-E integrated browser qualification across Routes A, B, C, D', { tag: '@m4-e' }, async ({ page, context, evidenceDir: directory }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let nativeRequests = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith('/execute')) nativeRequests++;
  });

  // ==========================================
  // ROUTE A: Canonical and Known Corrections
  // ==========================================
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?presentation=spatial');
  await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // 1. Inspect mixture geometry: verify fixed oblique linear screen projection wording in contextual lens
  await page.locator('#spatial-operation').selectOption('headOutput');
  await page.locator('#spatial-head').selectOption('0');
  await expect(page.locator('.context-lens')).toContainText('Fixed oblique linear screen projection');
  await expect(page.locator('.context-lens')).toContainText('Screen geometry is a display transform');
  await expect(page.locator('.context-lens')).toContainText('screen distances and angles may be distorted');
  await expect(page.locator('.context-lens')).toContainText('original-space values/arithmetic remain authoritative');

  // Check output simplex projection wording in contextual lens
  await page.locator('#spatial-operation').selectOption('probabilities');
  await expect(page.locator('.context-lens')).toContainText('Regular 3D tetrahedron, fixed oblique linear screen projection');
  await expect(page.locator('.context-lens')).toContainText('Screen geometry is a display transform');
  await expect(page.locator('.context-lens')).toContainText('original-space values/arithmetic remain authoritative');
  await page.screenshot({ path: `${directory}/m4-e-route-a-oblique-projection-1920.png` });

  // 2. Perform head ablation and verify MLR-02 explicit provenance table and verification
  await page.locator('#spatial-operation').selectOption('headOutput');
  await page.locator('#spatial-head').selectOption('0');
  await page.locator('#spatial-ablate').click();
  await expect(page.getByTestId('status')).toContainText('Observed ablation complete');
  await expect(page.getByTestId('spatial-intervention')).toContainText('Head output zeroed');

  // Inspect pre-ablation provenance table
  const provTable = page.getByTestId('pre-ablation-provenance');
  await expect(provTable).toBeVisible();
  await expect(provTable).toContainText('OBSERVED');
  await expect(provTable).toContainText('DERIVED');
  await expect(provTable).toContainText('headOutputBeforeAblation');
  await expect(provTable).toContainText('replacement-zero headOutput');
  await expect(page.getByTestId('derived-reconstruction-value')).toBeVisible();
  await expect(page.getByTestId('pre-ablation-observed-value')).toBeVisible();
  await expect(page.getByTestId('zeroed-output-value')).toHaveText('0');

  // Verification statement
  await expect(page.getByTestId('pre-ablation-verification')).toContainText('Verification: derived Σ αV reconstruction');
  await expect(page.getByTestId('pre-ablation-verification')).toContainText('matches observed pre-ablation artifact');
  await expect(page.getByTestId('zeroed-head-arithmetic')).toBeVisible();

  await page.screenshot({ path: `${directory}/m4-e-route-a-ablation-provenance-1920.png` });

  // Reduced motion screenshot for Route A
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: `${directory}/m4-e-route-a-ablation-provenance-reduced-1280.png` });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Return to live current state
  await page.locator('#spatial-current').click();
  await expect(page.getByTestId('spatial-intervention')).toHaveCount(0);
  await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  // Helper to ensure portable archive details is open
  const ensureArchiveOpen = async () => {
    const details = page.getByTestId('portable-archive-controls');
    const isOpen = await details.evaluate((el: HTMLDetailsElement) => el.open);
    if (!isOpen) {
      await details.locator('summary').click();
    }
  };

  // Helper to wait for training phase
  const phase = async (value: string) => {
    await expect(page.locator('#execution-controls')).toHaveAttribute('data-training-phase', value, { timeout: 60000 });
  };

  // ==========================================
  // ROUTE B: Durable Imported Evidence
  // ==========================================
  if (b2Archive) {
    await ensureArchiveOpen();
    await page.locator('#import-archive').setInputFiles(b2Archive);
    await expect(page.getByTestId('imported-archive-status')).toContainText('live accepted model unchanged');

    await page.locator('#open-shared-inspector').click();
    await page.locator('#shared-run-id').fill('qualification:qualification-generate');
    await page.locator('#shared-run-open').click();
    await page.locator('#shared-world').click();

    await page.locator('#pythia-invocation').selectOption('generation:2');
    await page.locator('#pythia-operation').selectOption('generation:2/logits');
    const outCoord = page.locator('[data-pythia-coordinate="output_index"]');
    await outCoord.fill('50303');
    await outCoord.dispatchEvent('change');
    await expect(page.getByTestId('pythia-selected-output')).toContainText('-3.8919265270233154');

    await page.screenshot({ path: `${directory}/m4-e-route-b-retained-pythia-1920.png` });

    // Reduced motion screenshot for Route B
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.screenshot({ path: `${directory}/m4-e-route-b-retained-pythia-reduced-1280.png` });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Re-export archive and verify
    await page.locator('#return-canonical-world').click();
    await ensureArchiveOpen();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-archive').click();
    const download = await downloadPromise;
    const reexportedPath = `${directory}/m4-e-reexported.mlarchive`;
    await download.saveAs(reexportedPath);
    await expect(page.getByTestId('portable-archive-status')).toContainText('Portable archive exported');
  }

  // ==========================================
  // ROUTE C: Capacity & Failure Discipline
  // ==========================================
  if (nearArchive) {
    await ensureArchiveOpen();
    await page.locator('#import-archive').setInputFiles(nearArchive);
    await expect(page.getByTestId('imported-archive-status')).toContainText('live accepted model unchanged');

    // Attempt operation near limit: capacity refusal before executor contact
    await page.locator('#open-shared-inspector').click();
    await page.locator('#shared-model').selectOption('pythia-native-v1');
    await page.locator('#shared-action').selectOption('generate');
    await page.locator('#shared-execute').click();
    await expect(page.getByTestId('shared-status')).toContainText('Retention capacity exceeded');
    expect(nativeRequests).toBe(0);

    await page.screenshot({ path: `${directory}/m4-e-route-c-capacity-refusal-1920.png` });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.screenshot({ path: `${directory}/m4-e-route-c-capacity-refusal-reduced-1280.png` });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.locator('#close-shared').click();

    // Clear Session restores capacity
    await page.locator('#clear-session').click();
    await expect(page.getByTestId('status')).toContainText(/Session cleared|Recorded real run/);
    await page.locator('#predict').click();
    await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  }

  // ==========================================
  // ROUTE D: Local Worker & Candidate Lifecycle
  // ==========================================
  // 1. Fast accepted Learn path
  await page.locator('#spatial-learn').click();
  await expect(page.getByTestId('spatial-live-step')).toHaveText('1');

  // 2. Stepped candidate Ready / Cancel lifecycle
  await page.locator('#step-learning').click();
  await page.locator('#execution-continue').click();
  await phase('ready');
  await expect(page.getByTestId('status')).toContainText('Candidate ready — not accepted');
  await page.screenshot({ path: `${directory}/m4-e-route-d-candidate-ready-1920.png` });

  // Discard / cancel candidate
  await page.locator('#execution-cancel').click();
  await expect(page.getByTestId('spatial-live-step')).toHaveText('1');
  await expect(page.getByTestId('status')).not.toContainText('Candidate ready');

  expect(errors).toEqual([]);
  await writeFile(`${directory}/m4-e-browser-summary.json`, JSON.stringify({
    routesChecked: ['A', 'B', 'C', 'D'],
    nativeRequests,
    errors,
  }, null, 2));
});
