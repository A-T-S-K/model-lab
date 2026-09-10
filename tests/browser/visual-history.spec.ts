import { test, expect } from "@playwright/test";
for (const width of [1920, 1280])
  test(`history, comparison and intervention retain one instrument at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 720 });
    await page.goto("/");
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await page.locator("#teach").click();
    await expect(page.getByTestId("guided-completed")).toHaveText("10");
    await page.locator("#guided-explore").click();
    await expect(page.locator(".instrument-spine")).toHaveCount(1);
    await expect(page.locator(".panel")).toHaveCount(0);
    await page
      .getByText("Source controls and other evidence", { exact: true })
      .click();
    const current = await page.locator("#history-run").inputValue();
    const initial = await page
      .locator("#history-run option")
      .first()
      .getAttribute("value");
    await page.locator("#compare-run").selectOption(initial!);
    await expect(page.getByTestId("run-comparison")).toHaveAttribute(
      "data-selected-run",
      current,
    );
    await expect(page.getByTestId("run-comparison")).toHaveAttribute(
      "data-comparison-run",
      initial!,
    );
    await expect(page.getByTestId("run-comparison")).toContainText(
      "Selected run minus comparison run",
    );
    await expect(page.locator(".comparison-track").first()).toHaveAttribute(
      "data-domain",
      "0,1",
    );
    await page.getByTestId("run-comparison").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/gate8a-comparison-${width}.png`,
    });
    await page.locator("#history-run").selectOption(initial!);
    await expect(page.getByTestId("training-step")).toHaveText("10");
    await expect(page.getByTestId("source-step")).toHaveText("0");
    await expect(page.getByTestId("source-binding")).toContainText(
      "HISTORICAL",
    );
    await page.getByText("Experiment · head ablation", { exact: true }).click();
    await page.locator("#ablate-head").click();
    await expect(page.getByTestId("status")).toContainText(
      "Observed ablation complete",
    );
    await expect(page.getByTestId("intervention-declaration")).toContainText(
      "Declared intervention",
    );
    await expect(page.getByTestId("training-step")).toHaveText("10");
    await page.locator(".attention-controls").evaluate((el) => {
      (el as HTMLDetailsElement).open = false;
    });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `test-results/gate8a-intervention-${width}.png`,
    });
    await expect(page.locator(".panel")).toHaveCount(0);
    await expect(page.locator(".instrument-spine")).toHaveCount(1);
  });
