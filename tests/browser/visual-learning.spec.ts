import { test, expect } from "@playwright/test";
for (const [width, height] of [
  [1920, 1080],
  [1280, 720],
])
  test(`A6/A7 same completed transition and persistent parameter at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto("/");
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await page.locator("[data-open-attention]").click();
    await page.locator("#open-attention-lens").click();
    await page.locator("#open-q-projection").click();
    await page.locator('[data-contributing-parameter="128"]').click();
    const anchor = await page.getByTestId("parameter-anchor").boundingBox();
    await page.locator("#follow-contributing-parameter").click();
    await page.locator("#teach-for-parameter").click();
    await expect(page.getByTestId("learning-inspection")).toHaveAttribute(
      "data-learning-mode",
      "backward",
    );
    await expect(page.getByTestId("fan-sum")).toContainText(
      "Σ 5 captured contributions",
    );
    await expect(page.locator("[data-position-loss]")).toHaveCount(5);
    await expect(page.getByTestId("learning-inspection")).toContainText(
      "1 OF 5 TRAINING POSITIONS",
    );
    await expect(page.getByTestId("learning-inspection")).not.toContainText(
      /BACKWARD RUNNING|first contribution|next contribution|1\/N/,
    );
    const experiment = await page
      .getByTestId("learning-inspection")
      .getAttribute("data-experiment");
    expect((await page.getByTestId("parameter-anchor").boundingBox())!.x).toBe(
      anchor!.x,
    );
    expect((await page.getByTestId("parameter-anchor").boundingBox())!.y).toBe(
      anchor!.y,
    );
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate7-backward-${width}.png` });
    await page.locator("[data-backward-edge]").last().click();
    await expect(page.getByTestId("selected-contribution")).toContainText(
      "Incoming adjoint",
    );
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate7-edge-${width}.png` });
    await page.locator("#toggle-fan-in").click();
    await expect(page.getByTestId("hidden-subtotal")).toContainText(
      "2 additional contributions",
    );
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/gate7-collapsed-${width}.png`,
    });
    await page.locator("#show-adam").click();
    await expect(page.getByTestId("learning-inspection")).toHaveAttribute(
      "data-experiment",
      experiment!,
    );
    await expect(page.getByTestId("learning-inspection")).toHaveAttribute(
      "data-parameter",
      "128",
    );
    await expect(page.getByTestId("one-step-result")).toContainText(
      "35.914% → 40.705%",
    );
    const q = Number(
        await page.getByTestId("adam-q").getAttribute("data-value"),
      ),
      delta = Number(
        await page.getByTestId("adam-delta").getAttribute("data-value"),
      );
    expect(q).not.toBe(delta);
    expect(Math.abs(q + delta)).toBeLessThan(1e-16);
    expect((await page.getByTestId("parameter-anchor").boundingBox())!.x).toBe(
      anchor!.x,
    );
    expect((await page.getByTestId("parameter-anchor").boundingBox())!.y).toBe(
      anchor!.y,
    );
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate7-adam-${width}.png` });
    await page.getByTestId("adam-delta").scrollIntoViewIfNeeded();
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate7-q-delta-${width}.png` });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate7-reduced-${width}.png` });
  });

for (const width of [1920, 1280])
  test(`historical A6 graph verification and A7 optimizer binding at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 720 });
    await page.goto("/");
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await page.locator("#teach").click();
    await expect(page.getByTestId("guided-completed")).toHaveText("10");
    await page.locator("[data-open-attention]").click();
    await page
      .getByText("Source controls and other evidence", { exact: true })
      .click();
    const firstTraining = await page
      .locator("#history-run option")
      .evaluateAll(
        (options) =>
          options
            .map((o) => (o as HTMLOptionElement).value)
            .find((value) => value.endsWith(":training"))!,
      );
    await page.locator("#history-run").selectOption(firstTraining!);
    await page.locator(".attention-controls").evaluate((el) => {
      (el as HTMLDetailsElement).open = false;
    });
    await page.locator("#open-attention-lens").click();
    await page.locator("#open-q-projection").click();
    await page.locator('[data-contributing-parameter="128"]').click();
    await page.locator("#follow-contributing-parameter").click();
    await page.evaluate(() => scrollTo(0, 0));
    await expect(page.getByTestId("backward-graph-state")).toContainText(
      "ORIGIN RECOMPUTED",
    );
    await expect(page.getByTestId("backward-graph-state")).toContainText(
      "VERIFICATION VERIFIED",
    );
    await expect(page.getByTestId("completed-gradient")).toBeVisible();
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/gate7-historical-backward-${width}.png`,
    });
    await page.locator("#show-adam").click();
    await expect(page.getByTestId("one-step-result")).toContainText(
      "35.914% → 40.705%",
    );
    await expect(page.locator(".guided-context")).toContainText(
      "35.9% → 91.4% over 10 real updates",
    );
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/gate7-historical-adam-${width}.png`,
    });
  });
