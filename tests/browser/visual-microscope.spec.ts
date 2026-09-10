import { test, expect } from "@playwright/test";
for (const [width, height] of [
  [1920, 1080],
  [1280, 720],
])
  test(`A5 derived lens, authentic scalar source and eight-term bridge at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto("/");
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await page.locator("[data-open-attention]").click();
    const source = await page
      .getByTestId("attention-explore")
      .getAttribute("data-source-run");
    await page.locator("#open-attention-lens").click();
    await expect(page.getByTestId("attention-lens")).toBeVisible();
    await expect(page.locator(".qk-products")).toContainText("Q · OBSERVED");
    await expect(page.locator(".qk-products")).toContainText(
      "Product · DERIVED",
    );
    await expect(page.getByTestId("lens-source")).toHaveAttribute(
      "data-root",
      `${source}/L0/H0/q3/k0`,
    );
    await expect(
      page.locator('.instrument-attention-matrix [aria-pressed="true"]'),
    ).toHaveCount(1);
    expect(
      await page
        .locator(".attention-page > footer")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate6-lens-${width}.png` });
    await page.locator('[data-product-feature="2"]').click();
    await expect(page.locator('[data-product-feature="2"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.screenshot({ path: `test-results/gate6-product-${width}.png` });
    await page.locator("#follow-q").click();
    await expect(page.getByTestId("inspection-state")).toContainText(
      "ORIGIN OBSERVED",
    );
    await page.getByTestId("scalar-operation").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/gate6-follow-q-${width}.png` });
    await page.locator("#open-q-projection").click();
    await expect(page.locator("[data-projection-term]")).toHaveCount(8);
    await page.locator('[data-contributing-parameter="147"]').click();
    await expect(page.getByTestId("contributing-parameter")).toContainText(
      "[2,3] · #147",
    );
    await page.locator("#follow-contributing-parameter").click();
    await page.screenshot({ path: `test-results/gate6-bridge-${width}.png` });
    await page.locator("#close-q-projection").click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.screenshot({ path: `test-results/gate6-reduced-${width}.png` });
    // Switching the semantic root clears the old lens before rendering another matrix selection.
    await page
      .locator('.instrument-attention-matrix [data-query="2"][data-key="1"]')
      .click();
    await expect(page.getByTestId("attention-lens")).toHaveCount(0);
    await expect(page.getByTestId("scalar-operation")).toHaveCount(0);
  });

for (const width of [1920, 1280])
  test(`A5 historical scalar verification remains separate from its observed source matrix at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 720 });
    await page.goto("/");
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await page.locator("[data-open-attention]").click();
    const original = await page
      .getByTestId("attention-explore")
      .getAttribute("data-source-run");
    await page.locator("#close-attention").click();
    await page.locator("#teach").click();
    await expect(page.getByTestId("guided-completed")).toHaveText("10");
    await page.locator("[data-open-attention]").click();
    await page
      .getByText("Source controls and other evidence", { exact: true })
      .click();
    await page.locator("#history-run").selectOption(original!);
    await page.locator(".attention-controls").evaluate((el) => {
      (el as HTMLDetailsElement).open = false;
    });
    await page.locator("#open-attention-lens").click();
    await page.locator("#follow-k").click();
    await expect(page.getByTestId("inspection-state")).toContainText(
      "ORIGIN RECOMPUTED",
    );
    await expect(page.getByTestId("inspection-state")).toContainText(
      "VERIFICATION VERIFIED",
    );
    await expect(page.getByTestId("inspection-state")).toContainText(
      "RELATIONSHIP HISTORICAL",
    );
    await expect(page.getByTestId("source-binding")).toContainText(
      "ORIGIN OBSERVED",
    );
    await page.getByTestId("scalar-operation").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/gate6-history-${width}.png` });
  });

for (const width of [1920, 1280])
  test(`A5 unavailable target clears prior scalar at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 720 });
    await page.addInitScript(() => {
      const state = window as unknown as { rejectInspection: boolean };
      state.rejectInspection = false;
      const descriptor = Object.getOwnPropertyDescriptor(
        Worker.prototype,
        "onmessage",
      )!;
      Object.defineProperty(Worker.prototype, "onmessage", {
        configurable: true,
        get: descriptor.get,
        set(handler: (event: MessageEvent) => void) {
          descriptor.set!.call(this, (event: MessageEvent) => {
            if (state.rejectInspection && event.data.status === "inspection")
              handler(
                new MessageEvent("message", {
                  data: {
                    ...event.data,
                    inspection: {
                      sourceRunId: event.data.inspection.sourceRunId,
                      provenance: "observed",
                      availability: "unsupported",
                      graph: null,
                      reason:
                        "Injected unsupported-target response for regression",
                    },
                  },
                }),
              );
            else handler(event);
          });
        },
      });
    });
    await page.goto("/");
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await page.locator("[data-open-attention]").click();
    await page.locator("#open-attention-lens").click();
    await page.locator("#follow-q").click();
    await expect(page.getByTestId("scalar-operation")).toBeVisible();
    await page.locator('[data-product-feature="1"]').click();
    await page.evaluate(() => {
      (window as unknown as { rejectInspection: boolean }).rejectInspection =
        true;
    });
    await page.locator("#follow-q").click();
    await expect(page.getByTestId("scalar-operation")).toHaveCount(0);
    await expect(page.getByTestId("microscope-evidence")).toContainText(
      "unsupported",
    );
    await expect(page.getByTestId("lens-source")).toContainText("OBSERVED");
    await page.screenshot({
      path: `test-results/gate6-unavailable-${width}.png`,
    });
  });

test("lens has an explicit source connector and prefix scope clears an excluded full-run root", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#activate-attract").click();
  await expect(page.locator("#teach")).toBeEnabled();
  await page.locator(".instrument-spine [data-open-attention]").click();
  await page.locator("#attention-full").click();
  await page
    .locator(
      '.instrument-attention-matrix[data-head="0"] [data-query="4"][data-key="4"]',
    )
    .click();
  await page.locator("#open-attention-lens").click();
  await expect(page.getByTestId("lens-source")).toHaveAttribute(
    "data-root",
    /\/q4\/k4$/,
  );
  await expect(page.locator("[data-source-tether] polyline")).toHaveCount(1);
  await page.locator("#attention-prefix").click();
  await expect(page.getByTestId("attention-scope")).toContainText("4×4");
  await expect(page.getByTestId("attention-lens")).toHaveCount(0);
  await expect(page.locator("[data-source-tether]")).toHaveCount(0);
  await expect(
    page.locator(
      '.instrument-attention-matrix[data-head="0"] [data-query="3"][data-key="3"]',
    ),
  ).toHaveAttribute("aria-pressed", "true");
});
