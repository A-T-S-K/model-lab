import { expect, type Page } from './browser-evidence.js';
import { writeFile } from 'node:fs/promises';

/** Readability belongs to bound HTML arithmetic, not a fixed SVG camera width. */
export async function arithmeticLayout(page: Page, directory: string, tag: string, evidence: string) {
  const lens = page.locator('.lens-scroll');
  await expect(lens).toHaveAttribute('tabindex', '0');
  await expect(lens).toHaveAttribute('role', 'region');
  const arithmetic = page.getByTestId(evidence);
  await arithmetic.scrollIntoViewIfNeeded();
  await expect(arithmetic).toBeInViewport();
  expect(await arithmetic.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
  const measurement = await page.evaluate((evidence) => {
    const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().toJSON();
    const lens = document.querySelector<HTMLElement>('.lens-scroll')!;
    const svg = document.querySelector<SVGSVGElement>('#spatial-world')!;
    const construction = document.querySelector<SVGGraphicsElement>('[data-testid="live-local-construction"] > rect');
    return { viewport: [innerWidth, innerHeight], document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      shell: rect('.spatial-shell'), pane: rect('.world-pane'), lens: rect('.lens-scroll'), arithmetic: rect(`[data-testid="${evidence}"]`),
      scroll: { top: lens.scrollTop, height: lens.clientHeight, content: lens.scrollHeight },
      viewBox: svg.getAttribute('viewBox'), construction: construction?.getBoundingClientRect().toJSON(), transform: construction?.getScreenCTM(),
      texts: [...(construction?.parentElement?.querySelectorAll('text') ?? [])].map(el => ({text:el.textContent,rect:el.getBoundingClientRect().toJSON(),font:getComputedStyle(el).fontSize})) };
  }, evidence);
  expect(measurement.document[0]).toBeLessThanOrEqual(measurement.viewport[0]);
  if (measurement.viewport[0]! > 850) expect(measurement.document[1]).toBeLessThanOrEqual(measurement.viewport[1]);
  await lens.focus();await page.keyboard.press('End');
  await expect.poll(()=>lens.evaluate(el => el.scrollTop + el.clientHeight >= el.scrollHeight - 1)).toBe(true);
  await page.keyboard.press('Home');await expect.poll(()=>lens.evaluate(el => el.scrollTop)).toBe(0);
  await arithmetic.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${directory}/${tag}.png` });
  await writeFile(`${directory}/${tag}.json`, JSON.stringify(measurement, null, 2), {flag:'wx'});
}

export async function availableAction(page: Page, selector: string) {
  const action = page.locator(selector);
  await action.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await expect(action).toBeInViewport();
  expect(await action.evaluate(el => {const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));})).toBe(true);
}
