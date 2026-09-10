import { test, expect, type Page } from "@playwright/test";
import approved from "../../design-prototypes/guided/checks.json" with { type: "json" };
async function anchors(page: Page) {
  return page.locator("[data-anchor]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.getAttribute("data-anchor"),
      x: node.getBoundingClientRect().x,
      y: node.getBoundingClientRect().y + scrollY,
      viewportY: node.getBoundingClientRect().y,
    })),
  );
}
for (const width of [1920, 1280, 390])
  test(`semantic visual regression and release frames at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width,
      height: width === 1920 ? 1080 : width === 1280 ? 720 : 844,
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.locator("#activate-attract")).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    const save = async (name: string) => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/release-${name}-${width}.png`,
        fullPage: width === 390,
      });
    };
    await save("A1");
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    const baseline = await anchors(page);
    if (width !== 390) {
      const prototype = approved.find(
        (frame) => frame.frame === "A2" && frame.width === width,
      )!;
      baseline.forEach((point, i) => {
        expect(Math.abs(point.x - prototype.anchors[i]!.x)).toBeLessThanOrEqual(
          1,
        );
        expect(Math.abs(point.y - prototype.anchors[i]!.y)).toBeLessThanOrEqual(
          3,
        );
      });
    }
    const constant = async () => {
      const current = await anchors(page);
      expect(current.map((p) => p.id)).toEqual(["0", "1", "2", "3", "4", "5"]);
      current.forEach((point, i) => {
        expect(Math.abs(point.x - baseline[i]!.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(point.y - baseline[i]!.y)).toBeLessThanOrEqual(1);
        if (width !== 390)
          expect(
            Math.abs(point.viewportY - baseline[i]!.viewportY),
          ).toBeLessThanOrEqual(1);
      });
    };
    await save("A2");
    await page.locator("#teach").click();
    await expect(page.getByTestId("guided-completed")).toHaveText("10");
    await constant();
    await save("A3");
    await page.locator(".instrument-spine [data-open-attention]").click();
    await constant();
    await save("A4");
    // Data colors use the complete sequential ramp, and the ink stays readable.
    await expect(
      page.locator(
        '.instrument-attention-matrix[data-head="0"] [data-query="0"][data-key="0"]',
      ),
    ).toHaveCSS("background-color", "rgb(254, 232, 56)");
    const contrasts = await page
      .locator(".instrument-attention-matrix button")
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const luminance = (color: string) => {
            const values = color
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map((x) => {
                const c = x / 255;
                return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
              });
            return (
              0.2126 * values[0]! + 0.7152 * values[1]! + 0.0722 * values[2]!
            );
          };
          const style = getComputedStyle(node),
            a = luminance(style.color),
            b = luminance(style.backgroundColor);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        }),
      );
    expect(contrasts.every((ratio) => ratio >= 4.5)).toBe(true);
    await page.locator("#open-attention-lens").click();
    await constant();
    await save("A5");
    await page.locator("#open-q-projection").click();
    await page.locator('[data-contributing-parameter="128"]').click();
    await page.locator("#follow-contributing-parameter").click();
    await expect(page.getByTestId("fan-sum")).toBeVisible();
    await constant();
    await save("A6");
    await page.locator("#show-adam").click();
    await constant();
    await save("A7");
    expect(await page.locator(".instrument-spine").count()).toBe(1);
    expect(await page.locator(".panel").count()).toBe(0);
    expect(
      await page
        .locator("[data-value],.bar,.current-mark,.signed-value")
        .evaluateAll((nodes) =>
          nodes.every((node) => {
            const style = getComputedStyle(node);
            return (
              style.animationName === "none" &&
              style.transitionDuration
                .split(",")
                .every((value) => parseFloat(value) === 0)
            );
          }),
        ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
