import { test, expect } from '../support/browser-evidence.js';
import { readFile, writeFile } from 'node:fs/promises';

test('shared canonical completion selects the exact newly published receipt and settles', async ({ page, evidenceDir }) => {
  await page.addInitScript(() => {
    const scope = window as any; scope.canonicalWorkflow = { requests: [], results: [] };
    const send = Worker.prototype.postMessage, seen = new WeakSet<Worker>();
    Worker.prototype.postMessage = function(message: any, ...rest: any[]) {
      scope.canonicalWorkflow.requests.push(structuredClone(message));
      if (!seen.has(this)) {
        seen.add(this); this.addEventListener('message', event => {
          if (event.data.status === 'result') scope.canonicalWorkflow.results.push(event.data.result.run.manifest.runId);
        });
      }
      return Reflect.apply(send, this, [message, ...rest]);
    };
  });
  await page.goto('/?presentation=spatial');
  await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#open-shared-inspector').click();
  const before = await page.locator('#shared-run').inputValue();
  await page.locator('#shared-execute').click();
  try {
    await expect(page.getByTestId('shared-status')).toContainText('Execution receipt validated');
    await expect(page.locator('#shared-execute')).toBeEnabled();
    await expect(page.locator('#shared-cancel')).toBeDisabled();
    const audit = await page.evaluate(() => (window as any).canonicalWorkflow);
    const exact = audit.results.at(-1);
    expect(exact).not.toBe(before);
    await expect(page.locator('#shared-run')).toHaveValue(exact);
    await expect(page.getByTestId('shared-provenance')).toContainText('RETAINED EVIDENCE');
  } finally {
    await writeFile(`${evidenceDir}/completion.json`, JSON.stringify({
      before, selected: await page.locator('#shared-run').inputValue(),
      status: await page.getByTestId('shared-status').textContent(),
      busy: await page.locator('#shared-execute').isDisabled(),
      audit: await page.evaluate(() => (window as any).canonicalWorkflow),
    }, null, 2), { flag: 'wx' });
  }
});

for (const action of ['cancel', 'clear', 'saved import', 'run selection', 'producer change']) {
test(`shared request invalidation by ${action} rejects its late selection and settles`, async ({ page, evidenceDir }) => {
  await page.addInitScript(() => {
    const scope = window as any; scope.workflowHold = { armed: false, replies: 0 };
    const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage')!;
    Object.defineProperty(Worker.prototype, 'onmessage', { configurable: true, get: descriptor.get,
      set(handler: (event: MessageEvent) => void) {
        descriptor.set!.call(this, (event: MessageEvent) => {
          if (scope.workflowHold.armed && (event.data.status === 'result' || event.data.envelope)) {
            scope.workflowHold.replies++;
            scope.workflowHold.run = event.data.result?.run.manifest.runId ?? event.data.envelope?.record.run.id;
            scope.workflowHold.release = () => handler(event);
            return;
          }
          handler(event);
        });
      },
    });
  });
  await page.goto('/?presentation=spatial'); await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#open-shared-inspector').click();
  const original = await page.locator('#shared-run').inputValue();
  await page.locator('#shared-save').click();
  if (action === 'producer change') await page.locator('#shared-model').selectOption('microgpt-multilayer-v1');
  await page.evaluate(() => (window as any).workflowHold.armed = true);
  await page.locator('#shared-execute').click();
  await expect.poll(() => page.evaluate(() => (window as any).workflowHold.replies)).toBe(1);
  if (action === 'cancel') await page.locator('#shared-cancel').click();
  if (action === 'clear') {
    // Clear is a world action; close the modal before invoking the real reset.
    await page.locator('#close-shared').click(); await page.locator('#clear-session').click();
    await expect(page.getByTestId('status')).toContainText('Recorded real run');
  }
  if (action === 'saved import') {
    await page.locator('#shared-load').click();
    await expect(page.getByTestId('shared-provenance')).toContainText('SAVED REPLAY');
  }
  if (action === 'run selection') {
    await page.locator('#shared-run-id').fill(original); await page.locator('#shared-run-open').click();
  }
  if (action === 'producer change') await page.locator('#shared-model').selectOption('microgpt-legacy-v1');
  await page.evaluate(() => { (window as any).workflowHold.armed = false; (window as any).workflowHold.release(); });
  if (action === 'clear') {
    await expect(page.getByTestId('status')).toContainText('Recorded real run');
    await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
    await page.locator('#open-shared-inspector').click();
  }
  if (['cancel', 'run selection'].includes(action)) await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  if (action === 'saved import') await expect(page.getByTestId('status')).toContainText('retention failed');
  await expect(page.getByTestId('shared-status')).not.toContainText('Execution receipt validated');
  await expect(page.locator('#shared-cancel')).toBeDisabled();
  await expect(page.locator('#shared-execute')).toBeEnabled();
  if (action === 'clear') {
    const held = await page.evaluate(() => (window as any).workflowHold.run);
    expect(await page.locator('#shared-run option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value))).not.toContain(held);
  }
  if (action === 'producer change') await expect(page.locator('#shared-model')).toHaveValue('microgpt-legacy-v1');
  await writeFile(`${evidenceDir}/invalidation.json`, JSON.stringify({ action, original,
    selected: await page.locator('#shared-run').inputValue(), status: await page.getByTestId('shared-status').textContent(),
  }, null, 2), { flag: 'wx' });
});
}

test('offline source lookup keeps declared revision and explicitly refuses unbundled bodies', async ({ page, evidenceDir }) => {
  const external: string[] = [];
  await page.route('**/*', route => {
    if (!route.request().url().startsWith('http://127.0.0.1:4173/')) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await page.goto('/?presentation=spatial'); await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#open-shared-inspector').click();
  await page.locator('[data-point]').filter({ hasText: 'attentionOutput' }).first().click();
  await page.locator('summary').filter({ hasText: 'Read bound source' }).click();
  await expect(page.locator('.shared-source')).toContainText('combinedHeads.push(...headOutput)');
  await page.locator('#shared-save').click();
  const original = await page.evaluate(() => localStorage.getItem('model-lab-evidence-v1')!);
  // Optional genuine historical bytes are read-only input for focused review.
  // Otherwise exercise an explicitly synthetic unsupported-revision declaration.
  const historical = process.env.WORKFLOW_HISTORICAL_CANONICAL;
  const control = JSON.parse(original);
  control.envelope.record.run.manifest.runId += ':unbundled-source-control';
  control.envelope.record.run.manifest.runtimeRevision = `sha256:${'0'.repeat(64)}`;
  const input = historical ? await readFile(historical, 'utf8') : JSON.stringify(control);
  const declared = JSON.parse(input).envelope.record.run.manifest;
  await page.locator('#shared-import').setInputFiles({ name: 'recording.json', mimeType: 'application/json', buffer: Buffer.from(input) });
  await expect(page.getByTestId('shared-status')).toContainText('Saved replay loaded');
  await expect(page.locator('#shared-run')).toHaveValue(declared.runId);
  await page.locator('[data-point]').filter({ hasText: 'attentionOutput' }).first().click();
  await page.locator('summary').filter({ hasText: 'Read bound source' }).click();
  await expect(page.locator('#shared-inspector')).toContainText(declared.runtimeRevision);
  await expect(page.locator('#shared-inspector')).toContainText('Source body not bundled for this historical revision');
  await expect(page.locator('.shared-source')).toHaveCount(0);
  await expect(page.getByTestId('shared-values')).not.toHaveText('[]');
  await page.locator('#shared-save').click();
  expect(await page.evaluate(() => localStorage.getItem('model-lab-evidence-v1'))).toBe(input);
  expect(external).toEqual([]);
  await writeFile(`${evidenceDir}/source-availability.json`, JSON.stringify({ input: historical ?? 'synthetic unbundled-source control', declared, external }, null, 2), { flag: 'wx' });
});

test('workbench Clear retains opening replay until fresh Predict restores experiment capabilities', async ({ page }) => {
  await page.goto('/?presentation=spatial'); await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  for (const id of ['activation-variant','composite-variant','data-experiment']) await expect(page.locator(`#open-${id}`)).toBeVisible();
  await page.locator('#clear-session').click();
  await expect(page.getByTestId('status')).toContainText('Recorded real run');
  for (const id of ['activation-variant','composite-variant','data-experiment']) await expect(page.locator(`#open-${id}`)).toHaveCount(0);
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  for (const id of ['activation-variant','composite-variant','data-experiment']) await expect(page.locator(`#open-${id}`)).toBeVisible();
});

for (const profile of ['visitor', 'facilitator']) {
test(`${profile} reset and fresh activity preserve experiment restrictions`, async ({ page }) => {
  await page.goto(`/?presentation=spatial&kiosk=1${profile === 'facilitator' ? '&facilitator=1' : ''}`);
  await expect(page.locator('#exhibit-start')).toBeEnabled(); await page.locator('#exhibit-start').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  for (const id of ['activation-variant','composite-variant','data-experiment']) await expect(page.locator(`#open-${id}`)).toHaveCount(0);
  await page.locator('#clear-session').click(); await expect(page.locator('#exhibit-start')).toBeEnabled();
  await page.locator('#exhibit-start').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  for (const id of ['activation-variant','composite-variant','data-experiment']) await expect(page.locator(`#open-${id}`)).toHaveCount(0);
});
}
