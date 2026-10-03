import { evidenceDirectory } from '../support/browser-evidence.js';
import { writeFile } from 'node:fs/promises';
import { test, expect } from '../support/browser-evidence.js';

test('exhibit survives 105 resets, rapid cancellation, refresh, touch and inactivity without WAN', async ({ page, context }) => {
  test.setTimeout(120000);
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (!route.request().url().startsWith('http://127.0.0.1:4173/')) { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled(); await page.locator('details.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const initialHistory = await page.getByTestId('history-count').textContent();
  for (let index = 0; index < 105; index++) {
    await page.locator('#reset').click();
    await expect(page.getByTestId('status')).toContainText('Model reset');
  }
  await expect(page.getByTestId('history-count')).toHaveText(initialHistory!);
  expect(page.workers()).toHaveLength(1);
  for (let index = 0; index < 8; index++) {
    await page.evaluate(() => {
      (document.querySelector('#train') as HTMLButtonElement).click();
      (document.querySelector('#cancel') as HTMLButtonElement).click();
    });
    await expect(page.getByTestId('status')).toContainText('Cancelled');
    await expect(page.getByTestId('training-step')).toHaveText('0');
  }
  await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  const other = await context.newPage(); await other.goto('about:blank'); await page.bringToFront(); await other.close();
  await page.locator('#kiosk-mode').check();
  await page.clock.fastForward(5 * 60 * 1000 + 16000);
  await expect(page.locator('button[data-mode="guided"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#activate-attract')).toBeEnabled();
  await page.reload(); await expect(page.locator('#activate-attract')).toBeEnabled();
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

async function captureAudit(page: import('../support/browser-evidence.js').Page) {
  await page.addInitScript(()=>{const w=window as any;w.captureAudit={commands:[],results:[],inspections:[]};const post=Worker.prototype.postMessage,seen=new WeakSet();Worker.prototype.postMessage=function(m:any,...rest:any[]){w.captureAudit.commands.push(m.command);if(!seen.has(this)){seen.add(this);this.addEventListener('message',e=>{const r=e.data;if(r.status==='result')w.captureAudit.results.push(r.result);if(r.status==='inspection')w.captureAudit.inspections.push({source:r.inspection.sourceRunId,target:r.inspection.target,graphNodes:r.inspection.graph?.nodes.length,graphEdges:r.inspection.graph?.edges.length});});}return Reflect.apply(post,this,[m,...rest]);};});
}
test('browser measures max-context live scalar rendering and worker responsiveness', async ({ page }, info) => {
  await captureAudit(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled(); await page.locator('details.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; }); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.evaluate(() => {
    const state = { gaps: [] as number[], longTasks: [] as number[], previous: performance.now() };
    (window as unknown as { measurements: typeof state }).measurements = state;
    setInterval(() => { const now = performance.now(); state.gaps.push(now - state.previous); state.previous = now; }, 16);
    new PerformanceObserver(entries => { state.longTasks.push(...entries.getEntries().map(entry => entry.duration)); }).observe({ type: 'longtask', buffered: false });
  });
  await page.getByTestId('document-input').fill('abcabca');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const trainStart = Date.now(); await page.locator('#train').click();
  await expect(page.getByTestId('status')).toContainText('Live update complete');
  const trainMs = Date.now() - trainStart;
  const native = await page.evaluate(()=>(window as any).captureAudit.results.at(-1));
  expect(native.run.manifest.input).toHaveLength(8);expect(native.trainingStep).toBe(1);
  const originalValues=native.probabilities[7];
  await page.locator('[data-token="7"]').click();
  expect(await page.getByTestId('probabilities').locator('code').evaluateAll(els=>els.map(e=>Number(e.getAttribute('title'))))).toEqual(originalValues);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const inspectStart = Date.now(); await page.locator('#inspect-gradient').click();
  await expect(page.getByTestId('inspection-provenance')).toHaveText('OBSERVED SCALAR');
  const inspectMs = Date.now() - inspectStart;
  await page.getByText('Bounded learning and complete capture', { exact: true }).click();
  const wholeStart = Date.now(); await page.locator('#whole-capture').click();
  await expect(page.getByRole('alert').last()).toContainText('Derived inspection exceeds its bounded cache reservation');
  await expect(page.getByTestId('whole-stats')).toHaveCount(0);
  const wholeMs = Date.now() - wholeStart;
  const refused = await page.evaluate(()=>(window as any).captureAudit);
  expect(refused.inspections.at(-1).graphNodes).toBeGreaterThan(0);
  expect(refused.commands.filter((c:string)=>c==='train')).toHaveLength(1);
  const measurement = await page.evaluate(() => {
    const state = (window as unknown as { measurements: { gaps: number[]; longTasks: number[] } }).measurements;
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return { maximumTimerGapMs: Math.max(...state.gaps), longTasksMs: state.longTasks,
      pageHeapBytes: memory?.usedJSHeapSize ?? null, renderedElements: document.querySelectorAll('*').length,
      wholeCaptureStats: document.querySelector('[data-testid="whole-stats"]')?.textContent };
  });
  const report = { trainMs, gradientClickToRenderMs: inspectMs, wholeClickToRenderMs: wholeMs, ...measurement,
    note: 'Single Chromium production run, includes Playwright action/wait overhead. Page heap is Chromium-reported, not worker heap; no worker heap is asserted.' };
  await info.attach('browser-capture-measurement.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
  console.log('BROWSER_CAPTURE', JSON.stringify(report));
  const retained = await page.getByTestId('history-count').textContent();
  const original = await page.locator('#history-run').inputValue();
  await page.locator('#reset').click();await expect(page.getByTestId('history-count')).toHaveText(retained!);
  await page.locator('#history-run').selectOption(original);
  await page.locator('[data-stage="embeddingSum"]').click();
  await page.getByTestId('vector-evidence').locator('[data-element="0"]').click();
  await expect(page.getByTestId('inspection-provenance')).toHaveText('VERIFIED RECOMPUTATION');
  await expect(page.getByTestId('verification')).toContainText('max absolute error 0');
  const selectedPosition=Number(await page.locator('[data-token][aria-pressed="true"]').getAttribute('data-token'));
  const sourceRun=native.runs.find((r:any)=>r.manifest.runId===original);
  const sourceValue=sourceRun.artifacts.find((a:any)=>a.kind==='embeddingSum'&&a.concept.token===selectedPosition).values[0];
  expect(Number(await page.getByTestId('scalar-equation').locator('strong').getAttribute('title'))).toBe(sourceValue);
  await page.getByTestId('document-input').fill('a');await page.locator('#predict').click();
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');await page.locator('#whole-capture').click();
  await expect(page.getByTestId('whole-stats')).toContainText('scalar nodes');
  const detail = await page.evaluate(()=>(window as any).captureAudit.inspections.at(-1));
  await expect(page.getByTestId('whole-stats')).toContainText(`${detail.graphNodes.toLocaleString()} scalar nodes`);
  await expect(page.getByTestId('whole-stats')).toContainText(`${detail.graphEdges.toLocaleString()} operand edges`);
  expect(await page.evaluate(()=>document.querySelectorAll('*').length)).toBeLessThan(3000);
  await page.screenshot({ path: `${await evidenceDirectory(test.info())}/model-lab-v2-microscope-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `${await evidenceDirectory(test.info())}/model-lab-v2-microscope-mobile.png`, fullPage: true });
  expect(measurement.renderedElements).toBeLessThan(3000);
});

test('touch input activates the same observed evidence in narrow view', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); await page.goto('http://127.0.0.1:4173/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled(); await page.locator('details.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.locator('#why-prediction').tap();
  await page.getByTestId('vector-evidence').locator('[data-element="0"]').tap();
  await expect(page.getByTestId('inspection-provenance')).toHaveText('OBSERVED SCALAR');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});

test('measured session budget stops new capture without deleting retained history', async ({ page }) => {
  test.setTimeout(60000);
  await captureAudit(page);
  await page.goto('/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled(); await page.locator('details.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; }); await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByTestId('document-input').fill('abcabca');
  await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  await page.getByText('Bounded learning and complete capture', { exact: true }).click();
  const cacheHistory=await page.getByTestId('history-count').textContent();
  await page.locator('#whole-capture').click();
  await expect(page.getByRole('alert').last()).toContainText('Derived inspection exceeds its bounded cache reservation');
  await expect(page.getByTestId('history-count')).toHaveText(cacheHistory!);
  await expect(page.getByTestId('whole-stats')).toHaveCount(0);
  // Exercise durable capacity independently: whole-detail refusal is not a
  // durable history budget, and repeated predictions must still be admitted.
  for(let trial=0;trial<24;trial++){
    await page.locator('#predict').click();await expect(page.getByTestId('status')).toContainText('Live prediction complete');
  }
  // Complete update evidence also includes checkpoints and matched before/after
  // runs. Explicit real updates reach the conservative durable reservation
  // boundary within the bounded scenario; the cache is never counted as history.
  let exhausted = false;
  for (let trial = 0; trial < 64; trial++) {
    const before=await page.evaluate(()=>(window as any).captureAudit.commands.length);
    const historyBefore=await page.getByTestId('history-count').textContent();
    const resultsBefore=await page.evaluate(()=>(window as any).captureAudit.results.length);
    await page.locator('#train').click();
    await expect.poll(async()=>{const status=await page.getByTestId('status').textContent();return status?.toLowerCase().includes('retention capacity')||status?.includes('Live update complete')&&await page.evaluate((before)=>(window as any).captureAudit.results.length>before,resultsBefore);}).toBe(true);
    if ((await page.getByTestId('status').textContent())?.toLowerCase().includes('retention capacity')) {
      expect(await page.evaluate(()=>(window as any).captureAudit.commands.length)).toBe(before);
      await expect(page.getByTestId('history-count')).toHaveText(historyBefore!);exhausted = true;break;
    }
    await expect(page.getByTestId('status')).toContainText('Live update complete');
  }
  expect(exhausted).toBe(true);
  await expect(page.getByRole('alert').last()).toContainText('Retention capacity');
  const history = await page.getByTestId('history-count').textContent();
  await page.locator('#reset').click(); await expect(page.getByTestId('status')).toContainText('Model reset');
  await expect(page.getByTestId('history-count')).toHaveText(history!);
  await page.locator('#clear-session').click(); await expect(page.locator('#activate-attract')).toBeEnabled(); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled(); await page.locator('details.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByTestId('history-count')).toContainText('1 runs · 1 snapshots');
  expect(page.workers()).toHaveLength(1);
  await writeFile(`${await evidenceDirectory(test.info())}/retention-control.json`,JSON.stringify({historyBeforeClear:history,audit:await page.evaluate(()=>(window as any).captureAudit)},null,2),{flag:'wx'});
});
