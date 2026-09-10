import { test, expect } from "@playwright/test";
import {
  exhibitTiming,
  exhibitState,
} from "../../app/presentation/exhibit-state.js";

test("bounded field timing distinguishes inactive, warning and actual deadline", () => {
  const timing = exhibitTiming(
    new URLSearchParams("idleSeconds=30&warningSeconds=10"),
  );
  expect(exhibitState(true, false, 0, 19_000, timing).phase).toBe("ACTIVE");
  expect(exhibitState(true, false, 0, 20_000, timing)).toEqual({
    phase: "WARNING",
    remainingMs: 10_000,
  });
  expect(exhibitState(true, false, 0, 30_000, timing).phase).toBe("RESET");
  expect(exhibitState(true, true, 0, 90_000, timing).phase).toBe("ATTRACT");
  expect(
    exhibitTiming(new URLSearchParams("idleSeconds=-1&warningSeconds=999")),
  ).toEqual({ resetAfterMs: 30_000, warningMs: 25_000 });
  expect(
    exhibitTiming(new URLSearchParams("idleSeconds=NaN")).resetAfterMs,
  ).toBe(300_000);
});
for (const width of [1920, 1280, 390])
  test(`idle warning uses real timer state and resets to retained replay at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width,
      height: width === 1920 ? 1080 : width === 1280 ? 720 : 844,
    });
    await page.clock.install();
    await page.goto("/?kiosk=1&idleSeconds=30&warningSeconds=10");
    await expect(page.locator("#activate-attract")).toBeEnabled();
    const replay = await page
      .getByTestId("source-binding")
      .getAttribute("data-source-run");
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await page.locator("#teach").click();
    await expect(page.getByTestId("guided-completed")).toHaveText("10");
    await page.clock.fastForward(21_000);
    await expect(page.locator("#exhibit-warning")).toBeVisible();
    const remaining = Number(
      await page.getByTestId("idle-countdown").textContent(),
    );
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(10);
    await page.screenshot({
      path: `test-results/gate8c-warning-${width}.png`,
      fullPage: width === 390,
    });
    await page.keyboard.press("Shift");
    await expect(page.locator("#exhibit-warning")).toHaveCount(0);
    await expect(page.getByTestId("guided-completed")).toHaveText("10");
    await page.clock.fastForward(31_000);
    await expect(page.locator("#activate-attract")).toBeEnabled();
    expect(
      await page.getByTestId("source-binding").getAttribute("data-source-run"),
    ).toBe(replay);
    await expect(page.getByTestId("training-step")).toHaveText("0");
    await expect(page.getByTestId("guided-completed")).toHaveCount(0);
    await expect(page.locator("#exhibit-warning")).toHaveCount(0);
    await page.screenshot({ path: `test-results/gate8c-reset-${width}.png` });
    await page.reload();
    await expect(page.locator("#activate-attract")).toBeEnabled();
    expect(
      await page.getByTestId("source-binding").getAttribute("data-source-run"),
    ).not.toBe(replay);
    expect(page.url()).toContain("idleSeconds=30");
  });

test("timeout outranks a late accepted-looking worker reply; resize and local-only execution retain identity", async ({
  page,
}) => {
  const external: string[] = [],
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    if (!route.request().url().startsWith("http://127.0.0.1:4173/")) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    const state = window as unknown as {
      holdResult: boolean;
      lateReplies: (() => void)[];
    };
    state.holdResult = false;
    state.lateReplies = [];
    const descriptor = Object.getOwnPropertyDescriptor(
      Worker.prototype,
      "onmessage",
    )!;
    Object.defineProperty(Worker.prototype, "onmessage", {
      configurable: true,
      get: descriptor.get,
      set(handler: (event: MessageEvent) => void) {
        descriptor.set!.call(this, (event: MessageEvent) => {
          if (
            state.holdResult &&
            event.data.status === "result" &&
            event.data.result.learn
          )
            state.lateReplies.push(() => handler(event));
          else handler(event);
        });
      },
    });
  });
  await page.clock.install();
  await page.goto("/?kiosk=1&idleSeconds=30&warningSeconds=10");
  await page.locator("#activate-attract").click();
  await expect(page.locator("#teach")).toBeEnabled();
  const live = await page
    .getByTestId("source-binding")
    .getAttribute("data-source-run");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.getByTestId("source-binding").getAttribute("data-source-run"),
  ).toBe(live);
  await page.evaluate(() => {
    (window as unknown as { holdResult: boolean }).holdResult = true;
  });
  await page.locator("#teach").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { lateReplies: unknown[] }).lateReplies.length,
      ),
    )
    .toBe(1);
  await page.clock.fastForward(31_000);
  await expect(page.locator("#activate-attract")).toBeEnabled();
  await page.evaluate(() => {
    const state = window as unknown as {
      holdResult: boolean;
      lateReplies: (() => void)[];
    };
    state.holdResult = false;
    state.lateReplies.forEach((reply) => reply());
  });
  await expect(page.getByTestId("training-step")).toHaveText("0");
  await expect(page.getByTestId("source-binding")).toContainText("REPLAY");
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("field controls persist bounded timing in URL and kiosk blocks outbound navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#activate-attract").click();
  await expect(page.locator("#teach")).toBeEnabled();
  await page.locator("#why-prediction").click();
  await page
    .getByText("Source controls and other evidence", { exact: true })
    .click();
  await page.locator("#kiosk-mode").check();
  await page.locator("#idle-seconds").fill("45");
  await page.locator("#idle-seconds").press("Tab");
  await page.locator("#warning-seconds").fill("10");
  await page.locator("#warning-seconds").press("Tab");
  expect(page.url()).toContain("idleSeconds=45");
  expect(page.url()).toContain("warningSeconds=10");
  const url = page.url();
  await page.locator(".source-attribution a").first().click();
  expect(page.url()).toBe(url);
  await expect(page.getByTestId("status")).toContainText(
    "Exhibit mode keeps this instrument open",
  );
});

test("narrow idle warning leaves Public Reset visible and actionable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto("/?kiosk=1&idleSeconds=30&warningSeconds=10");
  await page.locator("#activate-attract").click();
  await expect(page.locator("#teach")).toBeEnabled();
  await page.clock.fastForward(21_000);
  await expect(page.locator("#exhibit-warning")).toBeVisible();
  const warning = await page.locator("#exhibit-warning").boundingBox(),
    reset = await page.locator("#clear-session").boundingBox();
  expect(reset!.y).toBeGreaterThanOrEqual(warning!.y + warning!.height);
  await page.locator("#clear-session").click();
  await expect(page.locator("#activate-attract")).toBeEnabled();
});
