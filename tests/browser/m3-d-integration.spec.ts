import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '../support/browser-evidence.js';

interface AuditResponse {
  status?: string;
  result?: { snapshots: unknown[] };
  experiment?: { id?: string; receiptId?: string; identity?: { id: string }; recipe?: { id: string } };
}

async function installAudit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const scope = window as unknown as { m3d: { commands: unknown[]; responses: unknown[]; holdPatch: boolean; dataFault?: 'hold'|'late' } };
    scope.m3d = { commands: [], responses: [], holdPatch: false };
    const send = Worker.prototype.postMessage, seen = new WeakSet<Worker>();
    Worker.prototype.postMessage = function(message: unknown, ...rest: unknown[]) {
      const tagged = message as { command?: string };
      scope.m3d.commands.push(structuredClone(message));
      if (!seen.has(this)) { seen.add(this); this.addEventListener('message', event => scope.m3d.responses.push(structuredClone(event.data))); }
      if (tagged.command === 'activationPatch' && scope.m3d.holdPatch) return;
      if (tagged.command === 'dataExperiment' && scope.m3d.dataFault === 'hold') return;
      if (tagged.command === 'dataExperiment' && scope.m3d.dataFault === 'late') {
        const request = message as { sessionId: string; generationId: number; runId: string };
        setTimeout(() => this.dispatchEvent(new MessageEvent('message', { data: {
          ...request, status: 'dataExperiment', experiment: {}, snapshots: [], runs: [], learningExperiments: [],
        } })), 250);
        return;
      }
      return Reflect.apply(send, this, [message, ...rest]);
    };
  });
}

test('M3-D crosses every experiment family, cancels stale work, and returns to one accepted canonical state', async ({ page, evidenceDir: directory }) => {
  test.setTimeout(180_000);
  await installAudit(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?presentation=spatial');
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  const accepted = await page.evaluate(() => (window as unknown as { m3d: { responses: AuditResponse[] } }).m3d.responses
    .filter(response => response.status === 'result').at(-1)!.result!.snapshots[0]);

  // A cancelled intervention publishes no family receipt and restores a keyboard destination.
  await page.locator('#spatial-operation').selectOption('headOutput');
  await page.evaluate(() => { (window as unknown as { m3d: { holdPatch: boolean } }).m3d.holdPatch = true; });
  await page.locator('#spatial-patch').click(); await expect(page.locator('#cancel-ablation')).toBeVisible();
  await page.locator('#cancel-ablation').click(); await expect(page.getByTestId('status')).toContainText('Intervention cancelled');
  await expect(page.getByTestId('spatial-intervention')).toHaveCount(0); await expect(page.locator('#predict')).toBeFocused();
  await page.evaluate(() => { (window as unknown as { m3d: { holdPatch: boolean } }).m3d.holdPatch = false; });

  await page.locator('#spatial-head').selectOption('0'); await page.locator('#spatial-ablate').click();
  await expect(page.getByTestId('status')).toContainText('Observed ablation complete');
  await expect(page.getByTestId('spatial-intervention')).toContainText('Head output zeroed');
  await page.screenshot({ path: `${directory}/m3-d-head-ablation-1920.png` });
  await page.locator('#spatial-current').click(); await expect(page.getByTestId('spatial-intervention')).toHaveCount(0);
  await expect(page.locator('#predict')).toBeFocused();

  await page.locator('#spatial-query').selectOption('3'); await page.locator('#spatial-head').selectOption('1');
  await page.locator('#spatial-operation').selectOption('headOutput'); await page.locator('#spatial-patch').click();
  await expect(page.getByTestId('status')).toContainText('Observed donor patch complete');
  await expect(page.getByTestId('spatial-intervention')).toContainText('target p3/L0/h1 ← donor p0/L0/h0');
  await page.screenshot({ path: `${directory}/m3-d-donor-patch-1920.png` });
  await page.locator('#spatial-current').click(); await expect(page.getByTestId('spatial-intervention')).toHaveCount(0);
  await expect(page.locator('#predict')).toBeFocused();

  await page.locator('#open-activation-variant').press('Enter');
  await expect(page.getByTestId('status')).toContainText('Leaky ReLU model variant complete');
  await expect(page.getByTestId('variant-receipt')).toContainText('matched-variant@1');
  await expect(page.getByTestId('data-experiment-receipt')).toHaveCount(0);
  await page.screenshot({ path: `${directory}/m3-d-leaky-variant-1920.png` });
  await page.locator('#variant-current').press('Enter'); await expect(page.getByTestId('variant-receipt')).toHaveCount(0);
  await expect(page.locator('#predict')).toBeFocused(); await expect(page.locator('#spatial-operation')).toHaveValue('mlpRelu');

  await page.locator('#open-composite-variant').click();
  await expect(page.getByTestId('status')).toContainText('Composite A/B variant trained');
  await expect(page.getByTestId('composite-variant-receipt')).toContainText('exact save/resume PASS');
  await page.locator('[data-world-parameter="layer0.mlp_adapter_a"]').dispatchEvent('click');
  await expect(page.getByTestId('parameter-ownership')).toContainText('trainable · optimizer member');
  await expect(page.getByTestId('variant-receipt')).toHaveCount(0);
  await page.screenshot({ path: `${directory}/m3-d-composite-variant-1920.png` });
  await page.locator('#composite-current').click(); await expect(page.getByTestId('composite-variant-receipt')).toHaveCount(0);
  await expect(page.locator('#predict')).toBeFocused(); await expect(page.getByTestId('parameter-ownership')).toHaveCount(0);

  await page.locator('#open-data-experiment').click();
  await expect.poll(async () => page.getByTestId('status').textContent()).not.toContain('Running clean');
  await expect(page.getByTestId('status')).toContainText('Matched data experiment complete');
  await expect(page.getByTestId('data-experiment-receipt')).toContainText('matched-training-arms@1 PASS');
  await expect(page.getByTestId('external-policy-context')).toContainText('correlation is not causation');
  await expect(page.getByTestId('composite-variant-receipt')).toHaveCount(0);
  await page.screenshot({ path: `${directory}/m3-d-data-experiment-1920.png` });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByTestId('data-experiment-receipt').screenshot({ path: `${directory}/m3-d-data-experiment-1280-reduced.png` });
  await page.locator('#data-current').click(); await expect(page.getByTestId('data-experiment-receipt')).toHaveCount(0);
  await expect(page.locator('#predict')).toBeFocused();

  await page.locator('#predict').press('Enter'); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  const after = await page.evaluate(() => (window as unknown as { m3d: { responses: AuditResponse[] } }).m3d.responses
    .filter(response => response.status === 'result').at(-1)!.result!.snapshots[0]);
  expect(after).toEqual(accepted);
  await page.screenshot({ path: `${directory}/m3-d-canonical-return-1280-reduced.png` });

  const audit = await page.evaluate(() => {
    const state = (window as unknown as { m3d: { commands: Array<{ command?: string }>; responses: AuditResponse[] } }).m3d;
    return {
      commands: state.commands.map(command => command.command),
      completedFamilies: state.responses.filter(response => ['ablation','activationPatch','activationVariant','compositeVariant','dataExperiment'].includes(response.status ?? ''))
        .map(response => response.status),
    };
  });
  expect(audit.completedFamilies).toEqual(['ablation','activationPatch','activationVariant','compositeVariant','dataExperiment']);
  expect(errors).toEqual([]);

  await page.locator('#clear-session').click(); await expect(page.locator('#predict')).toBeEnabled();
  await expect(page.getByTestId('status')).toContainText('Recorded real run');
  await expect(page.getByTestId('spatial-intervention')).toHaveCount(0);
  await expect(page.getByTestId('variant-receipt')).toHaveCount(0);
  await expect(page.getByTestId('composite-variant-receipt')).toHaveCount(0);
  await expect(page.getByTestId('data-experiment-receipt')).toHaveCount(0);
  await page.goto('/?presentation=spatial&kiosk=1'); await expect(page.locator('#exhibit-start')).toBeEnabled();
  const attractCommands = await page.evaluate(() => (window as unknown as { m3d: { commands: Array<{ command?: string }> } }).m3d.commands
    .filter(command => ['ablation','activationPatch','activationVariant','compositeVariant','dataExperiment'].includes(command.command ?? '')));
  expect(attractCommands).toEqual([]);
  await writeFile(`${directory}/m3-d-browser-evidence.json`, JSON.stringify({ acceptedSnapshot: accepted, afterSnapshot: after, audit, errors }, null, 2));
});

test('M3-D reset cancels data work and rejects late completion without publishing a receipt', async ({ page }) => {
  test.setTimeout(90_000); await installAudit(page);
  await page.goto('/?presentation=spatial'); await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');

  await page.evaluate(() => { (window as unknown as { m3d: { dataFault: 'hold' } }).m3d.dataFault = 'hold'; });
  await page.locator('#open-data-experiment').click(); await expect(page.locator('#cancel-ablation')).toBeVisible();
  await page.locator('#clear-session').click(); await expect(page.locator('#predict')).toBeEnabled();
  await expect(page.getByTestId('data-experiment-receipt')).toHaveCount(0);

  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.evaluate(() => { (window as unknown as { m3d: { dataFault: 'late' } }).m3d.dataFault = 'late'; });
  await page.locator('#open-data-experiment').click(); await expect(page.locator('#cancel-ablation')).toBeVisible();
  await page.locator('#clear-session').click(); await page.waitForTimeout(350);
  await expect(page.getByTestId('data-experiment-receipt')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
});

test('M3-D developer experiments do not enter the canonical Guided lesson or attract reset', async ({ page }) => {
  await installAudit(page); await page.goto('/');
  await page.locator('#activate-attract').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await expect(page.getByTestId('guided-lesson')).toBeVisible();
  await expect(page.getByTestId('guided-target')).toHaveText('a');
  await expect(page.getByTestId('variant-receipt')).toHaveCount(0);
  await expect(page.getByTestId('composite-variant-receipt')).toHaveCount(0);
  await expect(page.getByTestId('data-experiment-receipt')).toHaveCount(0);
  const experimentCommands = await page.evaluate(() => (window as unknown as { m3d: { commands: Array<{ command?: string }> } }).m3d.commands
    .filter(command => ['ablation','activationPatch','activationVariant','compositeVariant','dataExperiment'].includes(command.command ?? '')));
  expect(experimentCommands).toEqual([]);
  await page.locator('#clear-session').click(); await expect(page.locator('#activate-attract')).toBeEnabled();
});
