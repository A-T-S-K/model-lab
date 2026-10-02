import { test, expect, evidenceDirectory } from '../support/browser-evidence.js';
import { writeFile } from 'node:fs/promises';

// Call the real client handler, then cancel synchronously before its resolved
// Promise can publish in execute(). This is acknowledgement, not a held reply.
for (const { failAdmission, targetStep } of [{ failAdmission: false, targetStep: 3 }, { failAdmission: true, targetStep: 3 }, { failAdmission: false, targetStep: 11 }]) {
test(`acknowledged update ${targetStep} survives cancellation before application publication${failAdmission ? ' with archive failure' : ''}`, async ({ page }) => {
  await page.addInitScript(({ failAdmission, targetStep }) => {
    const state = window as unknown as { accepted?: { run: string; after: number; before: number; painted: string | null }; cancelled?: boolean };
    const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage')!;
    Object.defineProperty(Worker.prototype, 'onmessage', { configurable: true, get: descriptor.get,
      set(handler: (event: MessageEvent) => void) {
        descriptor.set!.call(this, (event: MessageEvent) => {
          handler(event);
          if (event.data.status === 'result' && event.data.result.learn && event.data.result.trainingStep === targetStep) {
            state.accepted = { run: event.data.result.run.manifest.runId, after: event.data.result.probabilities[3][0], before: event.data.result.learn.before.probabilities[3][0], painted: document.querySelector('[data-testid="guided-completed"]')?.textContent ?? null };
            if (failAdmission) crypto.subtle.digest = () => Promise.reject(new Error('Controlled cancellation admission failure'));
            (document.querySelector('#cancel-teach') as HTMLButtonElement).click();
            state.cancelled = true;
          }
        });
      },
    });
  }, { failAdmission, targetStep });
  await page.goto('/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled();
  if (targetStep === 11) {
    await page.locator('#teach').click(); await expect(page.getByTestId('document-input')).toBeEnabled({ timeout: 15000 });
    await page.locator('.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; });
  }
  await page.locator('#teach').click();
  await expect.poll(() => page.evaluate(() => (window as any).cancelled)).toBe(true);
  await expect(page.getByTestId('document-input')).toBeEnabled({ timeout: 15000 });
  const accepted = await page.evaluate(() => (window as any).accepted);
  await writeFile(`${await evidenceDirectory(test.info())}/acknowledged-boundary.json`, JSON.stringify(accepted, null, 2), { flag: 'wx' });
  expect(accepted.painted).toBe(targetStep === 3 ? '2' : '0');
  await expect(page.getByTestId('training-step')).toHaveText(String(targetStep));
  await expect(page.getByTestId('guided-completed')).toHaveText(targetStep === 3 ? '3' : '1');
  await expect(page.getByTestId('guided-after')).toHaveAttribute('data-value', String(accepted.after));
  if (targetStep === 11) await expect(page.getByTestId('guided-before')).toHaveAttribute('data-value', String(accepted.before));
  await expect(page.getByTestId('source-binding')).toHaveAttribute('data-source-run', accepted.run);
  await expect(page.getByTestId('source-binding')).toContainText('CANCELLED');
  if (failAdmission) await expect(page.getByRole('alert')).toContainText('Controlled cancellation admission failure');
});

}

test('fresh ten updates reach a semantic terminal state with measured worker and publication timing', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as any; state.timings = { requests: [], replies: [], paints: [], serializations: [], domRendering: [] };
    const html = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!;
    Object.defineProperty(Element.prototype, 'innerHTML', { configurable: true, get: html.get, set(value: string) {
      const start = performance.now(); html.set!.call(this, value); state.timings.domRendering.push({ start, ms: performance.now() - start });
    } });
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message: any, ...rest: any[]) {
      state.timings.requests.push({ command: message.command, runId: message.runId, time: performance.now() });
      return (post as any).call(this, message, ...rest);
    };
    const stringify = JSON.stringify;
    JSON.stringify = function(...args: any[]) { const start = performance.now(); const value = (stringify as any)(...args); state.timings.serializations.push({ start, ms: performance.now() - start, bytes: value?.length }); return value; };
    const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage')!;
    Object.defineProperty(Worker.prototype, 'onmessage', { configurable: true, get: descriptor.get,
      set(handler: (event: MessageEvent) => void) { descriptor.set!.call(this, (event: MessageEvent) => {
        state.timings.replies.push({ status: event.data.status, runId: event.data.runId, step: event.data.result?.trainingStep, time: performance.now(), after: event.data.result?.probabilities[3]?.[0], source: event.data.result?.run.manifest.runId }); handler(event);
      }); },
    });
    document.addEventListener('DOMContentLoaded', () => {
      let previous = '';
      new MutationObserver(() => {
        const count = document.querySelector('[data-testid="guided-completed"]')?.textContent;
        const phase = document.querySelector('[data-testid="source-binding"]')?.textContent;
        const enabled = !(document.querySelector('#document') as HTMLInputElement)?.disabled;
        const key = `${count}:${phase}:${enabled}`;
        if (key !== previous) { previous = key; state.timings.paints.push({ count, phase, enabled, time: performance.now() }); }
      }).observe(document.querySelector('#app')!, { childList: true, subtree: true });
    });
  });
  await page.goto('/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled();
  const start = await page.evaluate(() => performance.now());
  await page.locator('#teach').click();
  await expect(page.getByTestId('document-input')).toBeEnabled({ timeout: 15000 });
  await expect(page.getByTestId('source-binding')).toContainText('TEACH COMPLETE');
  await expect(page.getByTestId('guided-completed')).toHaveText('10');
  await expect(page.getByTestId('training-step')).toHaveText('10');
  const timing = await page.evaluate(() => (window as any).timings);
  await writeFile(`${await evidenceDirectory(test.info())}/timings.json`, JSON.stringify({ start, terminal: await page.evaluate(() => performance.now()), timing }, null, 2), { flag: 'wx' });
  const tenth = timing.replies.find((reply: any) => reply.step === 10);
  await expect(page.getByTestId('source-binding')).toHaveAttribute('data-source-run', tenth.source);
  await expect(page.getByTestId('guided-after')).toHaveAttribute('data-value', String(tenth.after));
});

test('genuine retained-history capacity stops a partial third lesson before further worker execution', async ({ page }) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    const state = window as any; state.trainingRequests = []; state.accepted = [];
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message: any, ...rest: any[]) {
      if (message.command === 'train') state.trainingRequests.push(message.runId);
      return (post as any).call(this, message, ...rest);
    };
    const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage')!;
    Object.defineProperty(Worker.prototype, 'onmessage', { configurable: true, get: descriptor.get,
      set(handler: (event: MessageEvent) => void) { descriptor.set!.call(this, (event: MessageEvent) => {
        if (event.data.status === 'result' && event.data.result.learn) state.accepted.push({ step: event.data.result.trainingStep, run: event.data.result.run.manifest.runId, after: event.data.result.probabilities[3][0] });
        handler(event);
      }); },
    });
  });
  await page.goto('/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled();
  await page.locator('.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; });
  for (const step of [10, 20]) {
    await page.locator('#teach').click(); await expect(page.getByTestId('document-input')).toBeEnabled({ timeout: 15000 });
    await expect(page.getByTestId('training-step')).toHaveText(String(step));
  }
  await page.locator('#teach').click(); await expect(page.getByTestId('document-input')).toBeEnabled({ timeout: 15000 });
  await expect(page.getByRole('alert')).toContainText('manifest data nodes');
  await expect(page.getByTestId('source-binding')).toContainText('STOPPED');
  const state = await page.evaluate(() => ({ requests: (window as any).trainingRequests, accepted: (window as any).accepted }));
  const last = state.accepted.at(-1)!;
  expect(last.step).toBeGreaterThan(20); expect(last.step).toBeLessThan(30);
  expect(state.requests.length).toBe(last.step); expect(state.accepted.length).toBe(last.step);
  await expect(page.getByTestId('guided-before')).toHaveAttribute('data-value', String(state.accepted.find((item: any) => item.step === 20).after));
  await expect(page.getByTestId('training-step')).toHaveText(String(last.step));
  await expect(page.getByTestId('guided-completed')).toHaveText(String(last.step - 20));
  await expect(page.getByTestId('guided-after')).toHaveAttribute('data-value', String(last.after));
  await expect(page.getByTestId('source-binding')).toHaveAttribute('data-source-run', last.run);
  await page.locator('.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await expect(page.getByTestId('status')).toContainText('completed updates retained');
  await page.locator('#teach').click(); await expect(page.getByTestId('document-input')).toBeEnabled();
  expect(await page.evaluate(() => (window as any).trainingRequests.length)).toBe(last.step);
  await expect(page.getByTestId('guided-completed')).toHaveText(String(last.step - 20));
  await expect(page.getByTestId('guided-after')).toHaveAttribute('data-value', String(last.after));
  await expect(page.getByTestId('source-binding')).toHaveAttribute('data-source-run', last.run);
  await writeFile(`${await evidenceDirectory(test.info())}/capacity.json`, JSON.stringify(state, null, 2), { flag: 'wx' });
});

test('persistent archive failure after acknowledgement preserves accepted evidence and refuses another mutation', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as any; state.failArchive = false; state.trainingRequests = 0; state.digestFailures = 0;
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = (...args: Parameters<SubtleCrypto['digest']>) => {
      if (state.failArchive) { state.digestFailures++; return Promise.reject(new Error('Controlled immutable admission failure')); }
      return digest(...args);
    };
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function(message: any, ...rest: any[]) {
      if (message.command === 'train') state.trainingRequests++;
      return (post as any).call(this, message, ...rest);
    };
    const descriptor = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage')!;
    Object.defineProperty(Worker.prototype, 'onmessage', { configurable: true, get: descriptor.get,
      set(handler: (event: MessageEvent) => void) { descriptor.set!.call(this, (event: MessageEvent) => {
        handler(event);
        if (event.data.status === 'result' && event.data.result.learn && event.data.result.trainingStep === 3) {
          state.accepted = { run: event.data.result.run.manifest.runId, after: event.data.result.probabilities[3][0] };
          state.failArchive = true;
        }
      }); },
    });
  });
  await page.goto('/'); await page.locator('#activate-attract').click(); await expect(page.locator('#teach')).toBeEnabled();
  await page.locator('#teach').click(); await expect(page.getByTestId('document-input')).toBeEnabled({ timeout: 15000 });
  await expect(page.getByRole('alert')).toContainText('Controlled immutable admission failure');
  await expect(page.getByTestId('guided-completed')).toHaveText('3');
  await expect(page.getByTestId('training-step')).toHaveText('3');
  const state = await page.evaluate(() => ({ accepted: (window as any).accepted, requests: (window as any).trainingRequests, digestFailures: (window as any).digestFailures }));
  expect(state.digestFailures).toBeGreaterThanOrEqual(2); expect(state.requests).toBe(3);
  await expect(page.getByTestId('guided-after')).toHaveAttribute('data-value', String(state.accepted.after));
  await expect(page.getByTestId('source-binding')).toHaveAttribute('data-source-run', state.accepted.run);
  await expect(page.getByTestId('source-binding')).toContainText('STOPPED');
  await page.locator('.session-controls').evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await page.locator('#predict').click();
  await expect(page.getByRole('alert')).toContainText('Accepted update evidence is not retained');
  expect(await page.evaluate(() => (window as any).trainingRequests)).toBe(3);
  await writeFile(`${await evidenceDirectory(test.info())}/admission-failure.json`, JSON.stringify(state, null, 2), { flag: 'wx' });
});
