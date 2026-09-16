import { writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '../support/browser-evidence.js';

interface DataExperimentResponse {
  status?: string;
  result?: { snapshots: unknown[] };
  experiment?: {
    id: string; receiptId: string;
    recipe: { id: string; version: number };
    source: { snapshotId: string };
    design: { defensePolicy: { id: string; version: number }; cleanSchedule: string[]; controlPrefixes: string[]; cleanDocuments: string[] };
    arms: Record<'clean'|'treatment'|'defended', { finalSnapshotId: string; steps: Array<{
      proposedDocument: string; expectedDocument: string; effectiveDocument: string; decision: string;
      policyRecordId: string; learningExperimentId: string; trainingRunId: string;
    }> }>;
    policyRecords: Array<{ id: string; arm: string; step: number; trainingRunId: string; learningExperimentId: string }>;
    matching: { compatible: boolean; policy: { id: string; version: number }; reasons: string[] };
    evaluations: { triggered: { arms: Record<'clean'|'treatment'|'defended', { probability: number }> };
      controls: Array<{ input: string }>; clean: Array<{ input: string }> };
    metrics: { observed: { cleanTaskMeanLoss: Record<'clean'|'treatment'|'defended', number> };
      derived: { triggeredTreatmentMinusClean: number; triggeredDefendedMinusClean: number } };
  };
}

async function audit(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const scope = window as unknown as { m3c: { commands: unknown[]; responses: unknown[] } };
    scope.m3c = { commands: [], responses: [] };
    const send = Worker.prototype.postMessage, seen = new WeakSet<Worker>();
    Worker.prototype.postMessage = function(message: unknown, ...rest: unknown[]) {
      scope.m3c.commands.push(structuredClone(message));
      if (!seen.has(this)) { seen.add(this); this.addEventListener('message', event => scope.m3c.responses.push(structuredClone(event.data))); }
      return Reflect.apply(send, this, [message, ...rest]);
    };
  });
}

test('M3-C registered three-arm data experiment correlates external policy to retained model evidence and preserves accepted state', async ({ page, evidenceDir: directory }) => {
  test.setTimeout(120_000); await audit(page);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 }); await page.goto('/?presentation=spatial');
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  const accepted = await page.evaluate(() => (window as unknown as { m3c:{responses:DataExperimentResponse[]} }).m3c.responses.filter(response => response.status === 'result').at(-1)!.result!.snapshots[0]);

  await expect(page.locator('#open-data-experiment')).toBeVisible(); await page.locator('#open-data-experiment').click();
  await expect.poll(async () => page.getByTestId('status').textContent()).not.toContain('Running clean');
  if ((await page.getByTestId('status').textContent())?.includes('failed')) {
    const detail = await page.getByRole('alert').textContent();
    const responses = await page.evaluate(() => (window as unknown as { m3c:{responses:DataExperimentResponse[]} }).m3c.responses.map(item => ({ status: item.status })));
    throw new Error(`Data experiment failed: ${detail}; worker responses ${JSON.stringify(responses)}`);
  }
  await expect(page.getByTestId('status')).toContainText('Matched data experiment complete');
  const receipt = page.getByTestId('data-experiment-receipt');
  await expect(receipt).toContainText('microgpt.matched-data-substitution@1');
  await expect(receipt).toContainText('4 ordered updates per arm'); await expect(receipt).toContainText('matched-training-arms@1 PASS');
  await expect(page.getByTestId('data-step-clean')).toContainText('proposed abca');
  await expect(page.getByTestId('data-step-clean')).toContainText('effective abca');
  await expect(page.getByTestId('data-step-treatment')).toContainText('proposed abcc');
  await expect(page.getByTestId('data-step-treatment')).toContainText('effective abcc');
  await expect(page.getByTestId('data-step-defended')).toContainText('proposed abcc');
  await expect(page.getByTestId('data-step-defended')).toContainText('allowlist expected abca');
  await expect(page.getByTestId('data-step-defended')).toContainText('effective abca · normalized');
  await expect(page.getByTestId('external-policy-context')).toContainText('schedule-integrity-allowlist@1');
  await expect(page.getByTestId('external-policy-context')).toContainText('correlation is not causation');
  await expect(receipt).toContainText('Triggered · abc'); await expect(receipt).toContainText('Control · bca'); await expect(receipt).toContainText('Control · cab');

  const experiment = await page.evaluate(() => (window as unknown as { m3c:{responses:DataExperimentResponse[]} }).m3c.responses.find(response => response.status === 'dataExperiment')!.experiment!);
  expect(experiment.recipe).toEqual({ id: 'microgpt.matched-data-substitution', version: 1 });
  expect(experiment.matching).toMatchObject({ compatible: true, policy: { id: 'matched-training-arms', version: 1 }, reasons: [] });
  expect(experiment.arms.clean.steps).toHaveLength(4); expect(experiment.arms.treatment.steps).toHaveLength(4); expect(experiment.arms.defended.steps).toHaveLength(4);
  expect(experiment.arms.defended.finalSnapshotId).toBe(experiment.arms.clean.finalSnapshotId);
  expect(experiment.arms.treatment.finalSnapshotId).not.toBe(experiment.arms.clean.finalSnapshotId);
  const clean = experiment.arms.clean.steps[0]!, treatment = experiment.arms.treatment.steps[0]!, defended = experiment.arms.defended.steps[0]!;
  expect(clean).toMatchObject({ proposedDocument: 'abca', effectiveDocument: 'abca', decision: 'accepted' });
  expect(treatment).toMatchObject({ proposedDocument: 'abcc', effectiveDocument: 'abcc', decision: 'substituted' });
  expect(defended).toMatchObject({ proposedDocument: 'abcc', expectedDocument: 'abca', effectiveDocument: 'abca', decision: 'normalized' });
  for (const step of [clean, treatment, defended]) {
    expect(experiment.policyRecords.find(record => record.id === step.policyRecordId)).toMatchObject({
      trainingRunId: step.trainingRunId, learningExperimentId: step.learningExperimentId,
    });
  }
  expect(experiment.evaluations.controls.map(item => item.input)).toEqual(['bca','cab']);
  expect(experiment.evaluations.clean.map(item => item.input)).toEqual(['abca','bcab','cabc','abab']);
  expect(experiment.metrics.derived.triggeredDefendedMinusClean).toBe(0);
  await receipt.screenshot({ path: `${directory}/m3-c-data-experiment-1920.png` });

  await page.getByTestId('data-lineage').click();
  await page.locator(`[data-data-model-run="${treatment.trainingRunId}"]`).click();
  await expect(page.getByTestId('status')).toContainText('retained model evidence correlated from an external policy record');
  await expect(receipt).toContainText(treatment.trainingRunId);

  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 1280, height: 720 });
  await receipt.evaluate(element => element.scrollTo({ top: 0 }));
  await receipt.screenshot({ path: `${directory}/m3-c-data-experiment-1280-reduced.png` });

  await page.locator('#data-current').click(); await expect(receipt).toHaveCount(0);
  await page.locator('#predict').click(); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  const after = await page.evaluate(() => (window as unknown as { m3c:{responses:DataExperimentResponse[]} }).m3c.responses.filter(response => response.status === 'result').at(-1)!.result!.snapshots[0]);
  expect(after).toEqual(accepted); expect(errors).toEqual([]);
  await writeFile(`${directory}/m3-c-browser-evidence.json`, JSON.stringify({ acceptedSnapshot: accepted, afterSnapshot: after, experiment, errors }, null, 2));
});
