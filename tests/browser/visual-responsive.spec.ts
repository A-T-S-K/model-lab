import { test, expect, type Page } from "@playwright/test";
async function tabTo(page: Page, selector: string, reverse = false) {
  for (let n = 0; n < 120; n++) {
    if (
      await page
        .locator(selector)
        .evaluateAll((nodes) =>
          nodes.some((node) => node === document.activeElement),
        )
    )
      return;
    await page.keyboard.press(reverse ? "Shift+Tab" : "Tab");
  }
  throw new Error(`Keyboard did not reach ${selector}`);
}
async function reducedFrame(page: Page, name: string, width: number) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const text = await page.locator("body").innerText();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator("body").innerText()).toBe(text);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/gate8b-${name}-${width}.png`,
    fullPage: width === 390,
  });
}

for (const width of [1920, 1280, 390])
  test(`reduced-motion A1–A7, historical, stale and unavailable at ${width}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({
      width,
      height: width === 1920 ? 1080 : width === 1280 ? 720 : 844,
    });
    await page.addInitScript(() => {
      const state = window as unknown as {
        holdTrain: boolean;
        pendingTrain: (() => void)[];
        rejectInspection: boolean;
      };
      state.holdTrain = true;
      state.pendingTrain = [];
      state.rejectInspection = false;
      const send = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (message, ...rest: unknown[]) {
        const dispatch = () => Reflect.apply(send, this, [message, ...rest]);
        if (state.holdTrain && message.command === "train") {
          state.pendingTrain.push(dispatch);
          return;
        }
        return dispatch();
      };
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
                        "Injected unsupported target for responsive regression",
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
    await expect(page.locator("#activate-attract")).toBeEnabled();
    await reducedFrame(page, "A1", width);
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await reducedFrame(page, "A2", width);
    expect(
      await page
        .locator("[data-anchor]")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute("data-anchor")),
        ),
    ).toEqual(["0", "1", "2", "3", "4", "5"]);
    await page.locator("#teach").click();
    for (let n = 1; n <= 4; n++) {
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as { pendingTrain: unknown[] }).pendingTrain
                .length,
          ),
        )
        .toBeGreaterThan(0);
      await page.evaluate(() =>
        (
          window as unknown as { pendingTrain: (() => void)[] }
        ).pendingTrain.shift()!(),
      );
      await expect(page.getByTestId("teach-progress")).toContainText(
        `${n} / 10`,
      );
    }
    await reducedFrame(page, "Teach4", width);
    await page.evaluate(() => {
      const state = window as unknown as {
        holdTrain: boolean;
        pendingTrain: (() => void)[];
      };
      state.holdTrain = false;
      state.pendingTrain.splice(0).forEach((send) => send());
    });
    await expect(page.getByTestId("guided-completed")).toHaveText("10");
    await reducedFrame(page, "A3", width);
    await page.locator(".instrument-spine [data-open-attention]").click();
    await reducedFrame(page, "A4", width);
    if (width === 390)
      expect(
        await page.evaluate(
          () =>
            !!(
              document
                .querySelector('[data-testid="source-binding"]')!
                .compareDocumentPosition(
                  document.querySelector(".attention-expansion")!,
                ) & Node.DOCUMENT_POSITION_FOLLOWING
            ),
        ),
      ).toBe(true);
    await page.locator("#open-attention-lens").click();
    await page.locator('[data-product-feature="1"]').click();
    await reducedFrame(page, "A5", width);
    await page.locator("#open-q-projection").click();
    await page.locator('[data-contributing-parameter="136"]').click();
    await page.locator("#follow-contributing-parameter").click();
    await expect(page.getByTestId("fan-sum")).toBeVisible();
    await reducedFrame(page, "A6", width);
    await page.locator("#show-adam").click();
    await reducedFrame(page, "A7", width);
    await page
      .getByText("Source controls and other evidence", { exact: true })
      .click();
    const original = await page
      .locator("#history-run option")
      .first()
      .getAttribute("value");
    await page.locator("#history-run").selectOption(original!);
    await page.locator(".attention-controls").evaluate((el) => {
      (el as HTMLDetailsElement).open = false;
    });
    await page.locator("#open-attention-lens").click();
    await page.locator("#follow-q").click();
    await expect(page.getByTestId("inspection-state")).toContainText(
      "VERIFICATION VERIFIED",
    );
    await reducedFrame(page, "historical", width);
    await page
      .getByText("Source controls and other evidence", { exact: true })
      .click();
    await page.getByTestId("document-input").fill("cccc");
    await page.locator(".attention-controls").evaluate((el) => {
      (el as HTMLDetailsElement).open = false;
    });
    await expect(page.getByTestId("source-binding")).toContainText("STALE");
    await reducedFrame(page, "stale", width);
    await page.locator('[data-product-feature="2"]').click();
    await page.evaluate(() => {
      (window as unknown as { rejectInspection: boolean }).rejectInspection =
        true;
    });
    await page.locator("#follow-q").click();
    await expect(page.getByTestId("microscope-evidence")).toContainText(
      "UNSUPPORTED",
    );
    await expect(page.getByTestId("scalar-operation")).toHaveCount(0);
    await reducedFrame(page, "unavailable", width);
  });

test("keyboard alone activates, opens Attention, follows Q and reaches a completed parameter update", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.locator("#activate-attract")).toBeEnabled();
  await tabTo(page, "#activate-attract");
  await page.keyboard.press("Enter");
  await expect(page.locator("#teach")).toBeEnabled();
  await tabTo(page, ".instrument-spine [data-open-attention]");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("attention-explore")).toBeVisible();
  expect(
    await page.evaluate(() =>
      document.activeElement?.hasAttribute("data-open-attention"),
    ),
  ).toBe(true);
  await tabTo(page, "#open-attention-lens");
  await page.keyboard.press("Enter");
  await tabTo(page, "#follow-q");
  expect(
    await page
      .locator("#follow-q")
      .evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("scalar-operation")).toBeFocused();
  await tabTo(page, "#open-q-projection", true);
  await page.keyboard.press("Enter");
  await tabTo(page, '[data-contributing-parameter="128"]');
  await page.keyboard.press("Enter");
  await tabTo(page, "#follow-contributing-parameter");
  await page.keyboard.press("Enter");
  await tabTo(page, "#teach-for-parameter");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("fan-sum")).toBeVisible();
  await tabTo(page, "#show-adam", true);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("learning-inspection")).toHaveAttribute(
    "data-learning-mode",
    "adam",
  );
});

test("hidden[32] remains a 4×8 row-major wrap; real zero has no fabricated bar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#activate-attract").click();
  await expect(page.locator("#teach")).toBeEnabled();
  await page
    .getByRole("button", { name: "Why this prediction? · Explore" })
    .click();
  await page
    .getByText("Source controls and other evidence", { exact: true })
    .click();
  await page.locator('[data-stage="mlpRelu"]').click();
  const vector = page.locator('[data-display-wrap="4x8"]');
  await expect(vector.locator("button")).toHaveCount(32);
  const positions = await vector
    .locator("button")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        x: n.getBoundingClientRect().x,
        y: n.getBoundingClientRect().y,
        index: Number((n as HTMLElement).dataset.element),
        value: Number(n.getAttribute("title")!.split(":").at(-1)),
        bar: getComputedStyle(n.querySelector(".signed-value")!).width,
      })),
    );
  expect(new Set(positions.map((p) => p.x)).size).toBe(8);
  expect(new Set(positions.map((p) => p.y)).size).toBe(4);
  expect(positions.map((p) => p.index)).toEqual(
    Array.from({ length: 32 }, (_, i) => i),
  );
  expect(positions.some((p) => p.value === 0)).toBe(true);
  for (const p of positions.filter((p) => p.value === 0))
    expect(p.bar).toBe("0px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
