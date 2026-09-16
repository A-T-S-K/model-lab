import { test, expect, type Page } from '../support/browser-evidence.js';
import { writeFile } from 'node:fs/promises';

async function audit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const scope = window as unknown as { m3a: { commands: unknown[]; responses: unknown[] } };
    scope.m3a = { commands: [], responses: [] };
    const send = Worker.prototype.postMessage, seen = new WeakSet<Worker>();
    Worker.prototype.postMessage = function(message: unknown, ...rest: unknown[]) {
      scope.m3a.commands.push(structuredClone(message));
      if (!seen.has(this)) { seen.add(this); this.addEventListener('message', event => scope.m3a.responses.push(structuredClone(event.data))); }
      return Reflect.apply(send, this, [message, ...rest]);
    };
  });
}

test('M3-A registered ablation and donor patch remain matched, inspectable, and return to accepted state', async ({ page, evidenceDir: directory }) => {
  test.setTimeout(120_000); await audit(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?presentation=spatial');
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  const accepted = await page.evaluate(() => (window as unknown as { m3a: { responses: Array<{status?:string;result?:{snapshots:unknown[]}}> } }).m3a.responses.filter(item => item.status === 'result').at(-1)!.result!.snapshots[0]);

  await page.locator('#spatial-operation').selectOption('headOutput');
  await page.locator('#spatial-head').selectOption('0');
  await page.locator('#spatial-ablate').click();
  await expect(page.getByTestId('status')).toContainText('Observed ablation complete');
  await expect(page.getByTestId('spatial-intervention')).toContainText('Head output zeroed');
  const ablation = await page.evaluate(() => (window as unknown as { m3a: { responses: Array<{status?:string;experiment?:{recipe:{id:string};comparison:{policy:{id:string}}}}> } }).m3a.responses.find(item => item.status === 'ablation')!.experiment!);
  expect(ablation.recipe.id).toBe('microgpt.head-ablation'); expect(ablation.comparison.policy.id).toBe('matched-intervention');
  await page.locator('#spatial-current').click(); await expect(page.getByTestId('spatial-intervention')).toHaveCount(0);

  await page.locator('#spatial-query').selectOption('3'); await page.locator('#spatial-head').selectOption('1');
  await page.locator('#spatial-operation').selectOption('headOutput'); await page.locator('#spatial-patch').click();
  await expect(page.getByTestId('status')).toContainText('Observed donor patch complete');
  await expect(page.getByTestId('spatial-intervention')).toContainText('target p3/L0/h1 ← donor p0/L0/h0');
  await page.getByTestId('intervention-receipt').click();
  await expect(page.getByTestId('intervention-receipt')).toContainText('matched-intervention@1');
  const patch = await page.evaluate(() => (window as unknown as { m3a: { responses: Array<{status?:string;experiment?:{
    recipe:{id:string};comparison:{policy:{id:string}};receipt:{donorVector:number[];originalTargetVector:number[];effectiveReplacement:number[];noOp:boolean};
    declaration:{donor:{runId:string;token:number};target:{runId:string;token:number}};
  }}> } }).m3a.responses.find(item => item.status === 'activationPatch')!.experiment!);
  expect(patch.recipe.id).toBe('microgpt.donor-activation-patch'); expect(patch.comparison.policy.id).toBe('matched-intervention');
  expect(patch.receipt.donorVector).not.toEqual(patch.receipt.originalTargetVector);
  expect(patch.receipt.effectiveReplacement).toEqual(patch.receipt.donorVector); expect(patch.receipt.noOp).toBe(false);
  expect(patch.declaration.donor.runId).toContain(':donor'); expect(patch.declaration.target.runId).toContain(':intervention');

  await page.locator('#spatial-operation').selectOption('attentionOutput'); await expect(page.getByTestId('paired-components')).toBeVisible();
  await page.locator('#spatial-operation').selectOption('attentionProjection'); await expect(page.getByTestId('paired-components')).toContainText('attentionProjection');
  await page.locator('#spatial-operation').selectOption('probabilities'); await expect(page.getByTestId('paired-components')).toContainText('probabilities');
  await page.screenshot({ path: `${directory}/m3-a-donor-patch-1920.png` });
  await page.setViewportSize({ width: 1280, height: 720 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: `${directory}/m3-a-donor-patch-reduced-1280.png` });

  await page.locator('#spatial-current').click(); await expect(page.getByTestId('spatial-intervention')).toHaveCount(0);
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  const after = await page.evaluate(() => (window as unknown as { m3a: { responses: Array<{status?:string;result?:{snapshots:unknown[]}}> } }).m3a.responses.filter(item => item.status === 'result').at(-1)!.result!.snapshots[0]);
  expect(after).toEqual(accepted); expect(errors).toEqual([]);
  await writeFile(`${directory}/m3-a-browser-evidence.json`, JSON.stringify({ acceptedSnapshot: accepted, patch, ablation, errors }, null, 2));
});

test('M3-A cancellation, failure, and late stale completion never admit a patch', async ({ page }) => {
  test.setTimeout(90_000); await audit(page);
  await page.addInitScript(() => {
    const scope = window as unknown as { patchFault?: string };
    const send = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message: unknown, ...rest: unknown[]) {
      const tagged = message as { command?: string; sessionId?: string; generationId?: number; runId?: string };
      if (tagged.command === 'activationPatch' && scope.patchFault === 'hold') return;
      if (tagged.command === 'activationPatch' && scope.patchFault === 'fail') {
        setTimeout(() => this.dispatchEvent(new MessageEvent('message', { data: { ...tagged, status: 'error', error: 'injected patch arm failure' } })), 20); return;
      }
      if (tagged.command === 'activationPatch' && scope.patchFault === 'late') {
        setTimeout(() => this.dispatchEvent(new MessageEvent('message', { data: { ...tagged, status: 'activationPatch', experiment: {} } })), 250); return;
      }
      return Reflect.apply(send, this, [message, ...rest]);
    };
  });
  await page.goto('/?presentation=spatial'); await page.locator('#predict').click();
  await page.locator('#spatial-operation').selectOption('headOutput');

  await page.evaluate(() => { (window as unknown as { patchFault:string }).patchFault = 'hold'; });
  await page.locator('#spatial-patch').click(); await expect(page.locator('#cancel-ablation')).toBeVisible();
  await page.locator('#cancel-ablation').click(); await expect(page.getByTestId('status')).toContainText('Intervention cancelled');
  await expect(page.getByTestId('spatial-intervention')).toHaveCount(0);

  await page.evaluate(() => { (window as unknown as { patchFault:string }).patchFault = 'fail'; });
  await page.locator('#spatial-patch').click(); await expect(page.getByTestId('status')).toContainText('Activation patch failed');
  await expect(page.getByRole('alert')).toContainText('injected patch arm failure'); await expect(page.getByTestId('spatial-intervention')).toHaveCount(0);

  await page.evaluate(() => { (window as unknown as { patchFault:string }).patchFault = 'late'; });
  await page.locator('#spatial-patch').click(); await expect(page.locator('#cancel-ablation')).toBeVisible();
  await page.locator('#clear-session').click(); await expect(page.locator('#predict')).toBeEnabled(); await expect(page.getByTestId('status')).toContainText('Recorded real run');
  await page.waitForTimeout(350); await expect(page.getByTestId('spatial-intervention')).toHaveCount(0); await expect(page.getByRole('alert')).toHaveCount(0);
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
});
