import { stat, writeFile } from "node:fs/promises";
import { expect, test } from "../support/browser-evidence.js";

const nearArchive = process.env.M4_C1_NEAR_ARCHIVE;
const recordings = process.env.WITNESS_RECORDING_DIR;

test("M4-C2 retained navigation stays bounded and truthful without execution", { tag: "@m4-c2" }, async ({ page, evidenceDir: directory }) => {
  test.skip(!nearArchive || !recordings, "near-limit archive and witness recordings required");
  test.setTimeout(300_000);
  let nativeRequests = 0;
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith("/execute")) nativeRequests++; });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/?presentation=spatial");
  await page.getByTestId("portable-archive-controls").getByText("Portable historical archive").click();
  await page.locator("#import-archive").setInputFiles(nearArchive!);
  await expect(page.getByTestId("imported-archive-status")).toContainText("live accepted model unchanged");
  await page.locator("#open-shared-inspector").click();
  await page.locator("#shared-run-id").fill("qualification:qualification-generate");
  await page.locator("#shared-run-open").click();
  const selectedRun = await page.locator("#shared-run").inputValue();
  expect(await page.locator("#shared-run option").count()).toBeLessThanOrEqual(33);
  await expect(page.getByTestId("shared-run-window")).toContainText("retained");
  const runPage = await page.locator("#shared-run-next").isEnabled() ? page.locator("#shared-run-next") : page.locator("#shared-run-prev");
  await expect(runPage).toBeEnabled();
  await runPage.click();
  await expect(page.locator("#shared-run")).toHaveValue(selectedRun);
  expect(await page.locator("#shared-run option").count()).toBeLessThanOrEqual(33);
  expect(await page.locator("[data-point]").count()).toBeLessThanOrEqual(24);
  const selectedPoint = await page.locator("[data-point][aria-pressed=true]").getAttribute("data-point");
  await page.locator("#shared-point-next").click();
  await expect(page.locator(`[data-point="${selectedPoint}"]`)).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("[data-point]").count()).toBeLessThanOrEqual(24);
  await page.locator("#shared-world").click();
  await page.locator("#pythia-invocation").selectOption("generation:2");
  await page.locator("#pythia-operation").selectOption("generation:2/logits");
  await page.locator('[data-pythia-coordinate="output_index"]').fill("50303");
  await page.locator('[data-pythia-coordinate="output_index"]').dispatchEvent("change");
  await expect(page.getByTestId("pythia-selected-output")).toContainText("-3.8919265270233154");
  await page.screenshot({ path: `${directory}/m4-c2-bounded-retained-pythia-1920.png` });

  await page.goto("/?presentation=spatial");
  await page.locator("#open-shared-inspector").click();
  await page.locator("#shared-import").setInputFiles(`${recordings}/shape.json`);
  await page.locator("#shared-world").click();
  await expect(page.getByTestId("fallback-availability")).toHaveText("SHAPE ONLY");
  await expect(page.locator("[data-numerical-glyph]")).toHaveCount(0);
  await page.locator("#return-canonical-world").click();
  await page.locator("#open-shared-inspector").click();
  await page.locator("#shared-import").setInputFiles(`${recordings}/opaque.json`);
  await page.locator("#shared-world").click();
  await page.locator("#fallback-operation").selectOption("opaque.norm");
  await expect(page.getByTestId("fallback-availability")).toHaveText("OPAQUE");
  await expect(page.getByTestId("fallback-selected-value")).toContainText("no zero or placeholder");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({ path: `${directory}/m4-c2-opaque-reduced-1280.png` });

  expect(nativeRequests).toBe(0);
  expect(errors).toEqual([]);
  await writeFile(`${directory}/m4-c2-browser.json`, JSON.stringify({
    archiveBytes: (await stat(nearArchive!)).size,
    sharedRunOptionLimitIncludingPlaceholder: 33,
    sharedPointLimit: 24,
    exactOutputIndex: 50303,
    nativeRequests,
    shapeOnlyNumericalGlyphs: 0,
    opaque: true,
    reducedMotion: true,
  }, null, 2), { flag: "wx" });
});
