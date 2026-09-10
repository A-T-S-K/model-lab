import { test, expect } from "@playwright/test";
for (const [width, height] of [
  [1920, 1080],
  [1280, 720],
])
  test(`Attention source-bound scopes and fixed anchors at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto("/");
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    const anchors = await page.locator("[data-anchor]").evaluateAll((nodes) =>
      nodes.map((n) => ({
        x: n.getBoundingClientRect().x,
        y: n.getBoundingClientRect().y,
      })),
    );
    await page.locator("[data-open-attention]").click();
    await expect(page.getByTestId("attention-scope")).toContainText("4×4");
    expect(
      await page.locator("[data-anchor]").evaluateAll((nodes) =>
        nodes.map((n) => ({
          x: n.getBoundingClientRect().x,
          y: n.getBoundingClientRect().y,
        })),
      ),
    ).toEqual(anchors);
    const matrices = page.locator(".instrument-attention-matrix");
    await expect(matrices).toHaveCount(2);
    for (const matrix of await matrices.all()) {
      await expect(matrix.locator("tbody tr")).toHaveCount(4);
      await expect(matrix.locator("tbody td")).toHaveCount(16);
      await expect(matrix.locator(".causal-mask")).toHaveCount(6);
    }
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate5-prefix-${width}.png` });
    await page.locator("#attention-full").click();
    await expect(page.getByTestId("attention-scope")).toContainText("5×5");
    for (const matrix of await matrices.all())
      await expect(matrix.locator("tbody tr")).toHaveCount(5);
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate5-full-${width}.png` });
    await page
      .locator(
        '.instrument-attention-matrix[data-head="1"] [data-query="3"][data-key="1"]',
      )
      .click();
    await expect(
      page.locator(
        '.instrument-attention-matrix[data-head="1"] [data-query="3"][data-key="1"]',
      ),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate5-cell-${width}.png` });
    await matrices.first().locator(".causal-mask").first().focus();
    await expect(
      matrices.first().locator(".causal-mask").first(),
    ).toHaveAttribute("aria-label", /NOT APPLICABLE.*future key/);
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate5-mask-${width}.png` });
    await page.locator("#close-attention").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await page.locator("#teach").click();
    await expect(page.getByTestId("guided-completed")).toHaveText("10");
    await page.locator("[data-open-attention]").click();
    await page
      .getByText("Source controls and other evidence", { exact: true })
      .click();
    const first = await page
      .locator("#history-run option")
      .first()
      .getAttribute("value");
    await page.locator("#history-run").selectOption(first!);
    await expect(page.getByTestId("attention-explore")).toHaveAttribute(
      "data-source-run",
      first!,
    );
    await expect(page.getByTestId("source-binding")).toContainText(
      "HISTORICAL",
    );
    const selectedSnapshot = await page
      .getByTestId("attention-explore")
      .getAttribute("data-source-snapshot");
    for (const parameter of await page.locator(".parameter-register").all())
      await expect(parameter).toHaveAttribute(
        "data-snapshot",
        selectedSnapshot!,
      );
    await page.locator(".attention-controls").evaluate((el) => {
      (el as HTMLDetailsElement).open = false;
    });
    await page.evaluate(() => scrollTo(0, 0));
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate5-history-${width}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

for (const width of [1920, 1280, 390])
  test(`authentic maximum context exposes a full 8×8 scope without page overflow at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width,
      height: width === 1920 ? 1080 : width === 1280 ? 720 : 844,
    });
    await page.goto("/");
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await page.locator(".session-controls").evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });
    await page.getByTestId("document-input").fill("abcabca");
    await page.locator("#predict").click();
    await expect(page.locator("#predict")).toBeEnabled();
    await page.locator(".session-controls").evaluate((el) => {
      (el as HTMLDetailsElement).open = false;
    });
    await page.locator(".instrument-spine [data-open-attention]").click();
    await page.locator("#attention-full").click();
    await expect(page.getByTestId("attention-scope")).toContainText("8×8");
    for (const matrix of await page
      .locator(".instrument-attention-matrix")
      .all()) {
      await expect(matrix.locator("tbody tr")).toHaveCount(8);
      await expect(matrix.locator("tbody td")).toHaveCount(64);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width !== 390) {
      const input = await page.locator(".instrument-input").boundingBox(),
        next = await page.locator('[data-anchor="1"]').boundingBox();
      expect(input!.x + input!.width).toBeLessThanOrEqual(next!.x);
    }
  });
