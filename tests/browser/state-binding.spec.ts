import { test, expect } from "@playwright/test";

for (const hold of ["source", "archive"] as const)
  test(`STATE-RESET-001 ${hold}: obsolete initializer cannot dispatch or publish`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ hold }) => {
        const state = window as unknown as {
          releases: (() => void)[];
          commands: { command: string; generationId: number }[];
        };
        state.releases = [];
        state.commands = [];
        const digest = crypto.subtle.digest.bind(crypto.subtle);
        let count = 0;
        crypto.subtle.digest = (
          ...args: Parameters<SubtleCrypto["digest"]>
        ) => {
          count++;
          const pending = digest(...args);
          if (hold === "source" ? count <= 5 : count === 6)
            return new Promise<ArrayBuffer>((resolve, reject) => {
              state.releases.push(() => {
                pending.then(resolve, reject);
              });
            });
          return pending;
        };
        const send = Worker.prototype.postMessage;
        Worker.prototype.postMessage = function (message, ...rest: unknown[]) {
          state.commands.push({
            command: message.command,
            generationId: message.generationId,
          });
          return Reflect.apply(send, this, [message, ...rest]);
        };
      },
      { hold },
    );
    await page.goto("/");
    await page.locator("details.session-controls").evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { releases: unknown[] }).releases.length,
        ),
      )
      .toBe(hold === "source" ? 5 : 1);
    await page.locator("#clear-session").click();
    await page.locator("#activate-attract").click();
    await expect(page.getByTestId("status")).toContainText(
      "Live prediction complete",
    );
    const before = await page.evaluate(
      () => (window as unknown as { commands: unknown[] }).commands.length,
    );
    await page.evaluate(() =>
      (window as unknown as { releases: (() => void)[] }).releases.forEach(
        (release) => release(),
      ),
    );
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(
        () => (window as unknown as { commands: unknown[] }).commands.length,
      ),
    ).toBe(before);
    await expect(page.getByTestId("training-step")).toHaveText("0");
    await expect(page.locator("#predict")).toBeEnabled();
  });

test("STATE-SELECT-001 / STATE-INSPECT-001: parameter dependencies invalidate; irrelevant heads preserve objective gradient", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#activate-attract").click();
  await expect(page.locator("#teach")).toBeEnabled();
  await page.locator("details.session-controls").evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await expect(page.locator("#predict")).toBeEnabled();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.locator("#train").click();
  await expect(page.locator("#train")).toBeEnabled();
  await page.locator("#parameter-select").selectOption("128");
  await page.locator("#inspect-gradient").click();
  await expect(page.getByTestId("scalar-operation")).toContainText(
    "layer0.attn_wq[0,0]",
  );
  await page.locator("#head").selectOption("1");
  await expect(page.getByTestId("scalar-operation")).toContainText(
    "layer0.attn_wq[0,0]",
  );
  await page.locator("#parameter-select").selectOption("129");
  await expect(page.getByTestId("scalar-operation")).toHaveCount(0);
  await page.locator("#inspect-gradient").click();
  await expect(page.getByTestId("scalar-operation")).toContainText(
    "layer0.attn_wq[0,1]",
  );
  await expect(page.getByTestId("inspection-state")).toContainText(
    "ORIGIN OBSERVED",
  );
  await expect(page.getByTestId("inspection-state")).toContainText(
    "RELATIONSHIP HISTORICAL",
  );
});

test("STATE-INSPECT-002: head, query and key changes clear semantic scalar detail before rendering new context", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#activate-attract").click();
  await expect(page.locator("#teach")).toBeEnabled();
  await page.locator("details.session-controls").evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await expect(page.locator("#predict")).toBeEnabled();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.locator('[data-stage="q"]').click();
  await page.locator("[data-artifact]").first().click();
  await expect(page.getByTestId("scalar-operation")).toBeVisible();
  await page.locator("#head").selectOption("1");
  await expect(page.getByTestId("scalar-operation")).toHaveCount(0);
  await page.locator("[data-artifact]").first().click();
  await expect(page.getByTestId("scalar-operation")).toBeVisible();
  await page.locator('[data-query="2"][data-key="1"]').click();
  await expect(page.getByTestId("scalar-operation")).toHaveCount(0);
});

test("STATE-HISTORY-001: selected source step remains separate from live model step and promotion clears inspection", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#activate-attract").click();
  await expect(page.locator("#teach")).toBeEnabled();
  await page.locator("details.session-controls").evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await expect(page.locator("#predict")).toBeEnabled();
  await page.locator("#teach").click();
  await expect(page.locator("#teach")).toBeEnabled();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.locator("[data-experiment-run]").first().click();
  await expect(page.getByTestId("training-step")).toHaveText("10");
  await expect(page.getByTestId("source-step")).toHaveText("9");
  await page.locator("#inspect-gradient").click();
  await expect(page.getByTestId("scalar-operation")).toBeVisible();
  await page.locator("#predict").click();
  await expect(page.locator("#predict")).toBeEnabled();
  await expect(page.getByTestId("scalar-operation")).toHaveCount(0);
});

for (const command of ["train", "ablate"] as const)
  test(`STATE-INSPECT-002 ${command}: busy inspection rejection and frozen experiment selectors`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ command }) => {
        const state = window as unknown as {
          holdCommands: boolean;
          releaseCommands: (() => void)[];
          inspectRequests: number;
        };
        state.holdCommands = false;
        state.releaseCommands = [];
        state.inspectRequests = 0;
        const send = Worker.prototype.postMessage;
        Worker.prototype.postMessage = function (message, ...rest: unknown[]) {
          if (message.command === "inspect") state.inspectRequests++;
          const dispatch = () => Reflect.apply(send, this, [message, ...rest]);
          if (message.command === command && state.holdCommands) {
            state.releaseCommands.push(dispatch);
            return;
          }
          return dispatch();
        };
      },
      { command },
    );
    await page.goto("/");
    await page.locator("#activate-attract").click();
    await expect(page.locator("#teach")).toBeEnabled();
    await page.locator("details.session-controls").evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });
    await expect(page.locator("#predict")).toBeEnabled();
    await page.getByRole("button", { name: "Explore", exact: true }).click();
    await page.locator("#train").click();
    await expect(page.locator("#train")).toBeEnabled();
    await page.evaluate(() => {
      (window as unknown as { holdCommands: boolean }).holdCommands = true;
    });
    if (command === "train") {
      await page.locator("#train").click();
      const count = await page.evaluate(
        () =>
          (window as unknown as { inspectRequests: number }).inspectRequests,
      );
      await expect(page.locator("#inspect-gradient")).toBeDisabled();
      await page
        .locator("#inspect-gradient")
        .evaluate((button) => (button as HTMLButtonElement).click());
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { inspectRequests: number }).inspectRequests,
        ),
      ).toBe(count);
      await expect(page.getByTestId("scalar-operation")).toHaveCount(0);
    } else {
      await page
        .getByText("Experiment · head ablation", { exact: true })
        .click();
      await page.locator("#ablate-head").click();
      await page.locator("#head").selectOption("1");
    }
    await page.evaluate(() => {
      const state = window as unknown as {
        holdCommands: boolean;
        releaseCommands: (() => void)[];
      };
      state.holdCommands = false;
      state.releaseCommands.forEach((release) => release());
    });
    await expect(page.locator("#train")).toBeEnabled();
    if (command === "ablate")
      await expect(page.getByTestId("status")).toContainText("layer 0, head 0");
    await expect(page.getByTestId("scalar-operation")).toHaveCount(0);
  });

test("STATE-PROVENANCE-001: unavailable newly requested target clears old numeric evidence", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#activate-attract").click();
  await expect(page.locator("#teach")).toBeEnabled();
  await page.locator("details.session-controls").evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await expect(page.locator("#predict")).toBeEnabled();
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.locator("[data-artifact]").first().click();
  await expect(page.getByTestId("scalar-operation")).toBeVisible();
  // Inject a missing semantic ID at the existing request boundary, not fabricated scalar data.
  await page
    .locator("[data-artifact]")
    .first()
    .evaluate((button) => {
      (button as HTMLElement).dataset.artifact =
        "deliberately-unavailable-artifact";
    });
  await page.locator("[data-artifact]").first().click();
  await expect(page.getByTestId("scalar-operation")).toHaveCount(0);
  await expect(page.getByTestId("microscope-evidence")).toContainText(
    /not captured|unsupported/i,
  );
});
