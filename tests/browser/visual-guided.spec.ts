import { test, expect } from "@playwright/test";
for (const [width, height] of [
  [1920, 1080],
  [1280, 720],
])
  test(`Guided replay, activation, ten accepted updates and Reset at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: width!, height: height! });
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
    await page.goto("/");
    await expect(page.locator("#activate-attract")).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByTestId("source-binding")).toContainText("REPLAY");
    await expect(page.locator("body")).not.toContainText(
      /91\.4|55\.5|10 REAL UPDATES|VERIFIED REPLAY/,
    );
    const replay = await page
      .getByTestId("source-binding")
      .getAttribute("data-source-run");
    expect(
      await page.evaluate(
        () =>
          document
            .querySelector(".instrument-invitation")!
            .getBoundingClientRect().bottom <=
          document.querySelector(".instrument-footer")!.getBoundingClientRect()
            .top,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate4-A1-${width}.png` });
    const anchors = await page.locator("[data-anchor]").evaluateAll((nodes) =>
      nodes.map((n) => ({
        x: n.getBoundingClientRect().x,
        y: n.getBoundingClientRect().y,
      })),
    );
    await page.locator('[data-map="2"]').click();
    await expect(page.getByTestId("source-binding")).toContainText("LIVE");
    await expect(page.locator('[data-map="5"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      await page.getByTestId("source-binding").getAttribute("data-source-run"),
    ).not.toBe(replay);
    expect(
      await page.locator("[data-anchor]").evaluateAll((nodes) =>
        nodes.map((n) => ({
          x: n.getBoundingClientRect().x,
          y: n.getBoundingClientRect().y,
        })),
      ),
    ).toEqual(anchors);
    expect(
      await page
        .locator(".probability-row")
        .evaluateAll((nodes) =>
          nodes.map((n) => Number((n as HTMLElement).dataset.value)),
        ),
    ).toEqual([
      0.3591443770854818, 0.2294413153498612, 0.22375484996708614,
      0.18765945759757102,
    ]);
    expect(
      await page.evaluate(
        () =>
          document
            .querySelector(".instrument-invitation")!
            .getBoundingClientRect().bottom <=
          document.querySelector(".instrument-footer")!.getBoundingClientRect()
            .top,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate4-A2-${width}.png` });
    await page.locator("#teach").click();
    await expect(page.getByTestId("guided-completed")).toHaveText("10");
    await expect(page.getByTestId("guided-after")).toHaveText("91.4%");
    await expect(page.locator(".pp-change")).toHaveText("+55.5 pp");
    expect(
      await page.locator("[data-anchor]").evaluateAll((nodes) =>
        nodes.map((n) => ({
          x: n.getBoundingClientRect().x,
          y: n.getBoundingClientRect().y,
        })),
      ),
    ).toEqual(anchors);
    expect(
      await page.evaluate(
        () =>
          document
            .querySelector(".instrument-invitation")!
            .getBoundingClientRect().bottom <=
          document.querySelector(".instrument-footer")!.getBoundingClientRect()
            .top,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate4-A3-${width}.png` });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page.evaluate(
        () =>
          document
            .querySelector(".instrument-invitation")!
            .getBoundingClientRect().bottom <=
          document.querySelector(".instrument-footer")!.getBoundingClientRect()
            .top,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/gate4-A3-reduced-${width}.png`,
    });
    await page.locator("#clear-session").click();
    await expect(page.locator("#activate-attract")).toBeEnabled();
    expect(
      await page.getByTestId("source-binding").getAttribute("data-source-run"),
    ).toBe(replay);
    expect(
      await page.evaluate(
        () =>
          document
            .querySelector(".instrument-invitation")!
            .getBoundingClientRect().bottom <=
          document.querySelector(".instrument-footer")!.getBoundingClientRect()
            .top,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate4-reset-A1-${width}.png` });
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await page
      .getByRole("button", { name: "Why this prediction? · Explore" })
      .click();
    await expect(page.locator("#history-run option")).toHaveCount(1);
    await expect(
      page.locator(`#history-run option[value="${replay}"]`),
    ).toHaveCount(0);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

for (const width of [1920, 1280])
  test(`Teach counts only accepted results and cancellation restores completed boundary at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 1920 ? 1080 : 720 });
    await page.addInitScript(() => {
      const state = window as unknown as {
        pendingTrain: (() => void)[];
        hold: boolean;
      };
      state.pendingTrain = [];
      state.hold = true;
      const send = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (message, ...rest: unknown[]) {
        const dispatch = () => Reflect.apply(send, this, [message, ...rest]);
        if (message.command === "train" && state.hold) {
          state.pendingTrain.push(dispatch);
          return;
        }
        return dispatch();
      };
    });
    await page.goto("/");
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await page.locator("#teach").click();
    await expect(page.getByTestId("teach-progress")).toContainText("0 / 10");
    expect(
      await page.evaluate(
        () =>
          document
            .querySelector(".instrument-invitation")!
            .getBoundingClientRect().bottom <=
          document.querySelector(".instrument-footer")!.getBoundingClientRect()
            .top,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate4-teach0-${width}.png` });
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
    await expect(page.locator(".hero-probability")).toContainText("35.9");
    await expect(page.locator(".instrument-distribution")).toHaveCount(0);
    await expect(page.getByTestId("guided-after")).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          document
            .querySelector(".instrument-invitation")!
            .getBoundingClientRect().bottom <=
          document.querySelector(".instrument-footer")!.getBoundingClientRect()
            .top,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate4-teach4-${width}.png` });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page.evaluate(
        () =>
          document
            .querySelector(".instrument-invitation")!
            .getBoundingClientRect().bottom <=
          document.querySelector(".instrument-footer")!.getBoundingClientRect()
            .top,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/gate4-teach4-reduced-${width}.png`,
    });
    await page.locator("#cancel-teach").click();
    await expect(page.getByTestId("guided-completed")).toHaveText("4");
    await expect(page.getByTestId("training-step")).toHaveText("4");
    await expect(page.locator(".instrument-caption")).toContainText(
      "CANCELLED",
    );
    expect(
      await page.evaluate(
        () =>
          document
            .querySelector(".instrument-invitation")!
            .getBoundingClientRect().bottom <=
          document.querySelector(".instrument-footer")!.getBoundingClientRect()
            .top,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/gate4-cancel4-${width}.png` });
  });

test("tenth accepted update publishes its count, source and endpoint atomically during archive admission", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as unknown as {
      delayAdmission: boolean;
      heldAdmission: boolean;
      releaseAdmission?: () => void;
      acceptedRun?: string;
    };
    state.delayAdmission = false;
    state.heldAdmission = false;
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = (...args: Parameters<SubtleCrypto["digest"]>) => {
      const result = digest(...args);
      if (state.delayAdmission && !state.heldAdmission) {
        state.heldAdmission = true;
        return new Promise<ArrayBuffer>((resolve, reject) => {
          state.releaseAdmission = () => {
            result.then(resolve, reject);
          };
        });
      }
      return result;
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
          if (
            event.data.status === "result" &&
            event.data.result.learn &&
            event.data.result.trainingStep === 10
          ) {
            state.delayAdmission = true;
            state.acceptedRun = event.data.result.run.manifest.runId;
          }
          handler(event);
        });
      },
    });
  });
  await page.goto("/");
  await page.locator("#activate-attract").click();
  await expect(page.locator("#teach")).toBeEnabled();
  await page.locator(".session-controls").evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await page.locator("#teach").click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { heldAdmission: boolean }).heldAdmission,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.getByTestId("training-step")).toHaveText("10");
  await expect(page.getByTestId("source-step")).toHaveText("10");
  await page.getByRole("button", { name: "Guided", exact: true }).click();
  await expect(page.getByTestId("guided-completed")).toHaveText("10");
  await expect(page.getByTestId("guided-after")).toHaveText("91.4%");
  await expect(page.getByTestId("source-binding")).toContainText(
    "TEACH COMPLETE",
  );
  const accepted = await page.evaluate(
    () => (window as unknown as { acceptedRun: string }).acceptedRun,
  );
  await expect(page.getByTestId("source-binding")).toHaveAttribute(
    "data-source-run",
    accepted,
  );
  await page.evaluate(() =>
    (window as unknown as { releaseAdmission: () => void }).releaseAdmission(),
  );
  await expect(page.locator("#teach")).toBeEnabled();
});

test("cancellation retains a result accepted after the last painted count but before client restoration", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as unknown as {
      third?: () => void;
      holdArchive: boolean;
      heldArchive: boolean;
      releaseArchive?: () => void;
      after?: number;
      run?: string;
    };
    state.holdArchive = false;
    state.heldArchive = false;
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = (...args: Parameters<SubtleCrypto["digest"]>) => {
      const value = digest(...args);
      if (state.holdArchive && !state.heldArchive) {
        state.heldArchive = true;
        return new Promise<ArrayBuffer>((resolve, reject) => {
          state.releaseArchive = () => {
            value.then(resolve, reject);
          };
        });
      }
      return value;
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
          if (
            event.data.status === "result" &&
            event.data.result.learn &&
            event.data.result.trainingStep === 3
          ) {
            state.after = event.data.result.probabilities[3][0];
            state.run = event.data.result.run.manifest.runId;
            state.third = () => handler(event);
          } else handler(event);
        });
      },
    });
  });
  await page.goto("/");
  await page.locator("#activate-attract").click();
  await expect(page.locator("#teach")).toBeEnabled();
  await page.locator("#teach").click();
  await expect
    .poll(() =>
      page.evaluate(() => !!(window as unknown as { third?: unknown }).third),
    )
    .toBe(true);
  await expect(page.getByTestId("teach-progress")).toContainText("2 / 10");
  await page.evaluate(() => {
    (window as unknown as { holdArchive: boolean }).holdArchive = true;
  });
  await page.locator("#cancel-teach").click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { heldArchive: boolean }).heldArchive,
      ),
    )
    .toBe(true);
  await page.evaluate(() =>
    (window as unknown as { third: () => void }).third(),
  );
  await page.evaluate(() =>
    (window as unknown as { releaseArchive: () => void }).releaseArchive(),
  );
  await expect(page.getByTestId("training-step")).toHaveText("3");
  await expect(page.getByTestId("guided-completed")).toHaveText("3");
  const expected = await page.evaluate(() => ({
    after: (window as unknown as { after: number }).after,
    run: (window as unknown as { run: string }).run,
  }));
  await expect(page.getByTestId("guided-after")).toHaveAttribute(
    "data-value",
    String(expected.after),
  );
  await expect(page.getByTestId("source-binding")).toHaveAttribute(
    "data-source-run",
    expected.run,
  );
});

test("cancelling initialization still reaches a usable canonical Attract binding", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as unknown as { releases: (() => void)[] };
    state.releases = [];
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let calls = 0;
    crypto.subtle.digest = (...args: Parameters<SubtleCrypto["digest"]>) => {
      const result = digest(...args);
      if (++calls <= 5)
        return new Promise<ArrayBuffer>((resolve, reject) => {
          state.releases.push(() => {
            result.then(resolve, reject);
          });
        });
      return result;
    };
  });
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { releases: unknown[] }).releases.length,
      ),
    )
    .toBe(5);
  await page.locator(".session-controls").evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await page.locator("#cancel").click();
  await expect(page.locator("#activate-attract")).toBeEnabled();
  await page.evaluate(() =>
    (window as unknown as { releases: (() => void)[] }).releases.forEach(
      (release) => release(),
    ),
  );
  await page.locator("#activate-attract").click();
  await expect(page.getByTestId("source-binding")).toContainText("LIVE");
});
