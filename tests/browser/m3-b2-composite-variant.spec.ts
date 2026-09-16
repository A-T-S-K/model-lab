import { expect, test, type Page } from '../support/browser-evidence.js';
import { writeFile } from 'node:fs/promises';

interface CompositeResponse {
  status?: string;
  result?: { snapshots: unknown[] };
  experiment?: {
    targetDefinition: { id: string; version: string };
    declaration: { bottleneckWidth: number; scale: number; inheritedParameters: string; trainableParameterOrder: string[] };
    initialization: { id: string; sourceCheckpointId: string; exactTrainingResume: boolean };
    initialState: { id: string };
    trainedState: { id: string; state: { optimizer: { step: number; parameterOrder: string[] }; continuation: { datasetCursor: number } } };
    trainedComparison: { compatible: boolean; policy: { id: string; version: number }; variantOnly: Array<{ mapping: { targetKind: string } }> };
    witness: {
      token: number; layer: number; output: number; bottleneck: number;
      initialization: { adapterExactlyZero: boolean; compositeExactlyBase: boolean; downstreamExactlyCanonical: boolean };
      arithmetic: { base: number; scale: number; bax: number; scaledAdapter: number; composite: number };
      backward: { compositeOutputAdjoint: number; firstStepAGradientExactlyZero: boolean;
        bUpdate: { name: string; gradient: number; delta: number }; aUpdate: { name: string; gradient: number; delta: number } };
      resume: { uninterruptedStateId: string; resumedStateId: string; exactStateEquality: boolean; exactPredictionEquality: boolean };
      canonicalPreservation: { before: string; after: string; byteIdentical: boolean };
    };
  };
}

async function audit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const scope = window as unknown as { m3b2: { commands: unknown[]; responses: unknown[] } };
    scope.m3b2 = { commands: [], responses: [] };
    const send = Worker.prototype.postMessage, seen = new WeakSet<Worker>();
    Worker.prototype.postMessage = function(message: unknown, ...rest: unknown[]) {
      scope.m3b2.commands.push(structuredClone(message));
      if (!seen.has(this)) { seen.add(this); this.addEventListener('message', event => scope.m3b2.responses.push(structuredClone(event.data))); }
      return Reflect.apply(send, this, [message, ...rest]);
    };
  });
}

test('M3-B2 composite parameterized variant trains A/B, inspects split/merge arithmetic, resumes exactly, and returns canonical', async ({ page, evidenceDir: directory }) => {
  test.setTimeout(120_000); await audit(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?presentation=spatial');
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  const accepted = await page.evaluate(() => (window as unknown as { m3b2:{responses:CompositeResponse[]} }).m3b2.responses.filter(response => response.status === 'result').at(-1)!.result!.snapshots[0]);

  await expect(page.locator('#open-composite-variant')).toBeVisible(); await page.locator('#open-composite-variant').click();
  await expect(page.getByTestId('status')).toContainText('Composite A/B variant trained');
  const receipt = page.getByTestId('composite-variant-receipt');
  await expect(receipt).toContainText('microgpt.composite-mlp@1');
  await expect(receipt).toContainText('rank 2'); await expect(receipt).toContainText('fixed s 0.5');
  await expect(receipt).toContainText('only layer0.mlp_adapter_a, layer0.mlp_adapter_b are optimizer members');
  await expect(receipt).toContainText('exact save/resume PASS'); await expect(receipt).toContainText('matched-variant@1');
  const experiment = await page.evaluate(() => (window as unknown as { m3b2:{responses:CompositeResponse[]} }).m3b2.responses.find(response => response.status === 'compositeVariant')!.experiment!);
  expect(experiment.targetDefinition).toEqual({ id: 'microgpt.composite-mlp', version: '1' });
  expect(experiment.declaration).toMatchObject({ bottleneckWidth: 2, scale: 0.5, inheritedParameters: 'frozen',
    trainableParameterOrder: ['layer0.mlp_adapter_a','layer0.mlp_adapter_b'] });
  expect(experiment.initialization.exactTrainingResume).toBe(false);
  expect(experiment.trainedState.state.optimizer).toMatchObject({ step: 2, parameterOrder: ['layer0.mlp_adapter_a','layer0.mlp_adapter_b'] });
  expect(experiment.witness.initialization).toEqual({ adapterExactlyZero: true, compositeExactlyBase: true, downstreamExactlyCanonical: true });
  expect(experiment.witness.backward.firstStepAGradientExactlyZero).toBe(true);
  expect(experiment.witness.backward.bUpdate.gradient).not.toBe(0); expect(experiment.witness.backward.bUpdate.delta).not.toBe(0);
  expect(experiment.witness.backward.aUpdate.gradient).not.toBe(0); expect(experiment.witness.backward.aUpdate.delta).not.toBe(0);
  expect(experiment.witness.resume.uninterruptedStateId).toBe(experiment.witness.resume.resumedStateId);
  expect(experiment.witness.resume).toMatchObject({ exactStateEquality: true, exactPredictionEquality: true });
  expect(experiment.witness.arithmetic.scale * experiment.witness.arithmetic.bax).toBe(experiment.witness.arithmetic.scaledAdapter);
  expect(experiment.witness.arithmetic.base + experiment.witness.arithmetic.scaledAdapter).toBe(experiment.witness.arithmetic.composite);
  expect(experiment.trainedComparison.compatible).toBe(true);
  expect(experiment.trainedComparison.variantOnly.map(item => item.mapping.targetKind)).toEqual(['mlpBaseDown','mlpAdapterA','mlpAdapterB','mlpAdapterScaled']);
  expect(experiment.witness.canonicalPreservation).toMatchObject({ byteIdentical: true });

  for (const kind of ['mlpBaseDown','mlpAdapterA','mlpAdapterB','fixedAdapterScale','mlpAdapterScaled','mlpCompositeDown'])
    await expect(page.locator(`[data-world-kind="${kind}"]`)).toBeVisible();
  await page.locator('#spatial-operation').selectOption('mlpAdapterA');
  await expect(page.getByTestId('linear-terms')).toBeVisible();
  await page.locator('.source').evaluate(element => { (element as HTMLDetailsElement).open = true; });
  await expect(page.locator('.source')).toContainText('Trainable adapter A projection');
  await expect(page.locator('.source')).toContainText('model/microgpt.ts · linear');
  await page.locator('#spatial-operation').selectOption('mlpCompositeDown');
  await expect(page.getByTestId('teaching-step')).toContainText('Base W x + scaled adapter branch');
  await expect(page.getByTestId('composite-arithmetic')).toContainText(`${experiment.witness.arithmetic.base} + 0.5 × ${experiment.witness.arithmetic.bax} = ${experiment.witness.arithmetic.composite}`);

  await page.locator('[data-world-parameter="layer0.mlp_adapter_a"]').dispatchEvent('click');
  await expect(page.getByTestId('parameter-ownership')).toContainText('owner mlpAdapterA');
  await expect(page.getByTestId('parameter-ownership')).toContainText('trainable · optimizer member');
  await expect(page.getByTestId('parameter-ownership')).toContainText('microgpt.mlp-activation.feature.v1');
  await page.locator('[data-world-parameter="layer0.mlp_adapter_b"]').dispatchEvent('click');
  await expect(page.getByTestId('parameter-ownership')).toContainText('owner mlpAdapterB');
  await expect(page.getByTestId('parameter-ownership')).toContainText('microgpt.adapter-bottleneck.feature.v1');
  await page.locator('[data-world-parameter="layer0.mlp_fc2"]').dispatchEvent('click');
  await expect(page.getByTestId('parameter-ownership')).toContainText('owner mlpBaseDown');
  await expect(page.getByTestId('parameter-ownership')).toContainText('frozen · optimizer not a member');
  await page.screenshot({ path: `${directory}/m3-b2-composite-1920.png` });

  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator('#spatial-operation').selectOption('mlpCompositeDown');
  await expect(page.locator('[data-world-kind="mlpCompositeDown"]')).toBeVisible();
  await page.locator('#close-spatial-lens').click();
  await page.locator('#spatial-world').evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${directory}/m3-b2-composite-1280-reduced.png` });

  await page.locator('#composite-current').click(); await expect(receipt).toHaveCount(0);
  await expect(page.locator('#spatial-operation')).toHaveValue('mlpRelu');
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  const after = await page.evaluate(() => (window as unknown as { m3b2:{responses:CompositeResponse[]} }).m3b2.responses.filter(response => response.status === 'result').at(-1)!.result!.snapshots[0]);
  expect(after).toEqual(accepted); expect(errors).toEqual([]);
  await writeFile(`${directory}/m3-b2-browser-evidence.json`, JSON.stringify({ acceptedSnapshot: accepted, afterSnapshot: after, experiment, errors }, null, 2));
});
