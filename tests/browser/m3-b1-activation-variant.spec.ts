import { expect, test, type Page } from '../support/browser-evidence.js';
import { writeFile } from 'node:fs/promises';

interface VariantResponse {
  status?: string;
  experiment?: {
    targetDefinition: { id: string; version: string };
    initialization: { id: string; sourceCheckpointId: string; exactTrainingResume: boolean };
    declaration: { negativeSlope: number; zeroDerivative: number };
    comparison: { policy: { id: string; version: number }; compatible: boolean };
    witness: { token: number; layer: number; positive: { index: number; input: number; variant: number };
      negative: { index: number; input: number; canonical: number; variant: number; localDerivative: number; contribution: number } };
  };
}

async function audit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const scope = window as unknown as { m3b1: { commands: unknown[]; responses: unknown[] } };
    scope.m3b1 = { commands: [], responses: [] };
    const send = Worker.prototype.postMessage, seen = new WeakSet<Worker>();
    Worker.prototype.postMessage = function(message: unknown, ...rest: unknown[]) {
      scope.m3b1.commands.push(structuredClone(message));
      if (!seen.has(this)) { seen.add(this); this.addEventListener('message', event => scope.m3b1.responses.push(structuredClone(event.data))); }
      return Reflect.apply(send, this, [message, ...rest]);
    };
  });
}

test('M3-B1 registered Leaky ReLU definition executes, compares, inspects source, and returns to immutable canonical state', async ({ page, evidenceDir: directory }) => {
  test.setTimeout(120_000); await audit(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?presentation=spatial');
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  const accepted = await page.evaluate(() => (window as unknown as { m3b1:{responses:Array<{status?:string;result?:{snapshots:unknown[]}}>}}).m3b1.responses.filter(response => response.status === 'result').at(-1)!.result!.snapshots[0]);

  await expect(page.locator('#open-activation-variant')).toBeVisible(); await page.locator('#open-activation-variant').click();
  await expect(page.getByTestId('status')).toContainText('Leaky ReLU model variant complete');
  await expect(page.getByTestId('variant-receipt')).toContainText('microgpt.leaky-relu@1');
  await expect(page.getByTestId('variant-receipt')).toContainText('matched-variant@1');
  await expect(page.getByTestId('variant-receipt')).toContainText('no exact training-resume claim');
  const experiment = await page.evaluate(() => (window as unknown as { m3b1:{responses:VariantResponse[]} }).m3b1.responses.find(response => response.status === 'activationVariant')!.experiment!);
  expect(experiment.targetDefinition).toEqual({ id: 'microgpt.leaky-relu', version: '1' });
  expect(experiment.initialization.sourceCheckpointId).not.toBe(experiment.initialization.id);
  expect(experiment.initialization.exactTrainingResume).toBe(false);
  expect(experiment.declaration).toMatchObject({ negativeSlope: 0.01, zeroDerivative: 0.01 });
  expect(experiment.comparison).toMatchObject({ policy: { id: 'matched-variant', version: 1 }, compatible: true });
  expect(experiment.witness.positive.variant).toBe(experiment.witness.positive.input);
  expect(experiment.witness.negative.canonical).toBe(0);
  expect(experiment.witness.negative.variant).toBe(0.01 * experiment.witness.negative.input);
  expect(experiment.witness.negative.localDerivative).toBe(0.01); expect(experiment.witness.negative.contribution).not.toBe(0);

  await page.locator('#spatial-query').selectOption(String(experiment.witness.token));
  await page.locator('#spatial-operation').selectOption('mlpLeakyRelu');
  await page.getByTestId('forward-elements').locator('button').nth(experiment.witness.negative.index).click();
  await expect(page.getByTestId('leaky-relu-calculation')).toContainText('otherwise 0.01 × x');
  await expect(page.getByTestId('leaky-relu-calculation')).toContainText('zero convention is 0.01');
  await page.locator('.source').evaluate(element => { (element as HTMLDetailsElement).open = true; });
  await expect(page.locator('.source')).toContainText('model/value.ts · Value.leakyRelu');
  await expect(page.locator('[data-world-kind="mlpLeakyRelu"]')).toBeVisible();
  await expect(page.locator('[data-world-kind="mlpRelu"]')).toHaveCount(0);
  await page.locator('.source').evaluate(element => { const scroll=element.closest('.lens-scroll'); if(scroll)scroll.scrollTop=(element as HTMLElement).offsetTop-24; });
  await page.screenshot({ path: `${directory}/m3-b1-leaky-source-1920.png` });
  await page.locator('#spatial-operation').selectOption('probabilities');
  await expect(page.getByTestId('paired-components')).toContainText('probabilities');
  await page.screenshot({ path: `${directory}/m3-b1-leaky-relu-1920.png` });

  await page.locator('#variant-current').click(); await expect(page.getByTestId('variant-receipt')).toHaveCount(0);
  await expect(page.locator('#spatial-operation')).toHaveValue('mlpRelu');
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  const after = await page.evaluate(() => (window as unknown as { m3b1:{responses:Array<{status?:string;result?:{snapshots:unknown[]}}>}}).m3b1.responses.filter(response => response.status === 'result').at(-1)!.result!.snapshots[0]);
  expect(after).toEqual(accepted); expect(errors).toEqual([]);
  await writeFile(`${directory}/m3-b1-browser-evidence.json`, JSON.stringify({ acceptedSnapshot: accepted, afterSnapshot: after, experiment, errors }, null, 2));
});
