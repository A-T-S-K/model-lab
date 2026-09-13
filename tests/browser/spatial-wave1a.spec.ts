import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { RunResult } from "../../app/worker/protocol.js";

test("Wave 1A · real HTTP build, Predict controls, both heads, geometry, row/scalar sources and one owner", async ({ page }) => {
  const errors: string[] = [], remote: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", request => errors.push(request.url()));
  page.on("request", request => { if (!request.url().startsWith("http://127.0.0.1:") && !request.url().startsWith("data:")) remote.push(request.url()); });
  // Observe real worker traffic only. All commands and selections below use visible controls.
  await page.addInitScript(() => {
    const state = window as any;
    state.spatialAudit = { commands: [], results: [] };
    const send = Worker.prototype.postMessage;
    const seen = new WeakSet<Worker>();
    Worker.prototype.postMessage = function(message: any, ...rest: any[]) {
      state.spatialAudit.commands.push({command: message.command, sessionId: message.sessionId});
      if (!seen.has(this)) {
        seen.add(this);
        this.addEventListener("message", event => {
          if (event.data.status === "result") state.spatialAudit.results.push(event.data.result);
        });
      }
      return Reflect.apply(send, this, [message, ...rest]);
    };
  });
  const evidenceDir = process.env.SPATIAL_EVIDENCE_DIR ?? "/tmp/model-lab-wave1-browser";
  await mkdir(evidenceDir, {recursive: true});
  await page.setViewportSize({width: 1920, height: 1080});
  await page.goto("/?presentation=spatial");
  await expect(page.locator("#predict")).toBeEnabled();
  await page.locator("#document").fill("abca");
  await page.locator("#predict").click();
  await expect(page.getByTestId("status")).toContainText("Live prediction complete");
  const latest = () => page.evaluate(() => (window as any).spatialAudit.results.at(-1)) as Promise<RunResult>;
  await page.locator("#spatial-lens").click();
  const first = await latest();
  await expect(page.getByTestId("spatial-run")).toHaveText(first.run.manifest.runId);
  await page.screenshot({path: `${evidenceDir}/overview-1920x1080.png`});
  async function assertSelected(query: number, key: number, head: number) {
    await page.locator("#spatial-query").selectOption(String(query));
    await page.locator("#spatial-head").selectOption(String(head));
    await page.locator("#spatial-key").selectOption(String(key));
    const r = await latest();
    const artifact = (kind: string, token: number, h?: number) => r.run.artifacts.find(a => a.kind === kind && a.concept.token === token && (h === undefined || a.concept.head === h))!;
    const q = artifact("q", query), k = artifact("k", key), score = artifact("attentionLogits", query, head), weight = artifact("attentionProbabilities", query, head);
    const scalar = await page.getByTestId("spatial-q-output").getAttribute("data-value");
    expect(Number(scalar)).toBe(q.values![head * 4]);
    if (key > query) { await expect(page.getByTestId("spatial-unavailable")).toContainText("Future key"); await expect(page.getByTestId("spatial-score")).toHaveCount(0); return; }
    expect(Number(await page.getByTestId("spatial-score").getAttribute("data-value"))).toBe(score.values![key]);
    expect(Number(await page.getByTestId("spatial-weight").getAttribute("data-value"))).toBe(weight.values![key]);
    const qh = q.values!.slice(head * 4, head * 4 + 4), kh = k.values!.slice(head * 4, head * 4 + 4);
    const paths = await page.locator('[data-testid="q-shaft"],[data-testid="k-shaft"]').evaluateAll(els => els.map(el => el.getAttribute("d")!.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number)));
    const [qp, kp] = paths.map(p => [p[2] - p[0], p[3] - p[1]]);
    expect(Math.hypot(...qp) / Math.hypot(...kp)).toBeCloseTo(Math.hypot(...qh) / Math.hypot(...kh), 12);
    expect((qp[0]*kp[0]+qp[1]*kp[1])/Math.hypot(...qp)/Math.hypot(...kp)).toBeCloseTo(qh.reduce((s,v,i)=>s+v*kh[i],0)/Math.hypot(...qh)/Math.hypot(...kh), 12);
    await page.getByText("Complete vector values and artifact sources", {exact:true}).click();
    await expect(page.getByTestId("spatial-q-artifact")).toHaveText(q.id);
    await expect(page.getByTestId("spatial-score-artifact")).toHaveText(score.id);
    await page.getByText("Complete vector values and artifact sources", {exact:true}).click();
    const terms = await page.getByTestId("spatial-contributors").locator("tbody tr").evaluateAll(rows => rows.map(row => [...row.querySelectorAll("[data-value]")].map(el => Number(el.getAttribute("data-value")))));
    expect(terms).toHaveLength(8);
    const snapshot = r.snapshots.find(s => s.id === r.run.manifest.startingSnapshotId)!;
    terms.forEach((t, i) => { expect(t[0]).toBe(snapshot.state.parameters["layer0.attn_wq"][head*4][i]); expect(t[1]).toBe(t[0] * artifact("preAttentionNorm", query).values![i]); });
  }
  for (const h of [0,1]) for (const [q,k] of [[4,0],[3,2]]) await assertSelected(q,k,h);
  await assertSelected(2,4,1);
  await assertSelected(4,0,0);
  await page.locator("#spatial-focus").click();
  await page.screenshot({path:`${evidenceDir}/attention-1920x1080.png`});
  await page.locator("#spatial-lens").click();
  await page.screenshot({path:`${evidenceDir}/qk-lens-1920x1080.png`});
  await page.getByRole("button", {name:"Inspect Q output scalar", exact:true}).click();
  await expect(page.getByTestId("scalar-operation")).toBeVisible();
  // Follow the actual reduction's last product, then its parameter operand.
  await page.locator(".spatial-scalar .operand-list").first().getByRole("button", {name:/multiply/}).click();
  await page.locator(".spatial-scalar .operand-list").first().getByRole("button", {name:/layer0.attn_wq/}).click();
  await expect(page.getByTestId("scalar-operation")).toContainText("layer0.attn_wq[0,7]");
  await expect(page.getByTestId("inspection-state")).toContainText("ORIGIN OBSERVED");
  await page.screenshot({path:`${evidenceDir}/parameter-scalar.png`, fullPage:true});
  // A shorter run must visibly invalidate the old semantic position.
  await page.locator("#document").fill("a");
  await page.locator("#predict").click();
  await expect(page.getByTestId("status")).toContainText("Live prediction complete");
  await expect(page.getByRole("alert")).toContainText("Selection unavailable");
  await expect(page.getByTestId("spatial-score")).toHaveCount(0);
  await page.locator("#spatial-query").selectOption("1");
  await expect(page.getByTestId("spatial-score")).toBeVisible();
  await page.locator("#spatial-query").selectOption("0");
  await page.locator("#document").fill("abcb");
  await expect(page.getByTestId("spatial-relationship")).toContainText("STALE");
  await page.locator("#predict").click();
  await expect(page.getByTestId("status")).toContainText("Live prediction complete");
  const second = await latest();
  expect(second.run.manifest.runId).not.toBe(first.run.manifest.runId);
  await expect(page.getByTestId("spatial-run")).toHaveText(second.run.manifest.runId);
  await expect(page.getByTestId("scalar-operation")).toHaveCount(0);
  expect(second.run.artifacts.find(a=>a.kind==="q" && a.concept.token===4)!.values).not.toEqual(first.run.artifacts.find(a=>a.kind==="q" && a.concept.token===4)!.values);
  await assertSelected(4,0,0);
  await page.locator("#spatial-feature").selectOption("2");
  expect(Number(await page.getByTestId("spatial-q-output").getAttribute("data-value"))).toBe(second.run.artifacts.find(a => a.kind === "q" && a.concept.token === 4)!.values![2]);
  await page.locator("#spatial-feature").selectOption("0");
  await page.locator("#spatial-home").click();
  await page.getByRole("button", {name:"Scores head 1",exact:true}).click();
  await expect(page.locator("#spatial-head")).toHaveValue("1");
  await page.locator("#spatial-head").selectOption("0");
  const before = await page.evaluate(() => (window as any).spatialAudit.commands.length);
  await page.locator("#presentation-toggle").click();
  await page.locator("#presentation-toggle").click();
  expect(await page.evaluate(() => (window as any).spatialAudit.commands.length)).toBe(before);
  await expect(page.getByTestId("spatial-run")).toHaveText(second.run.manifest.runId);
  await page.setViewportSize({width:1280,height:720});
  await page.locator("#spatial-home").click();
  await page.screenshot({path:`${evidenceDir}/overview-1280x720.png`});
  await page.locator("#spatial-focus").click();
  await page.screenshot({path:`${evidenceDir}/attention-1280x720.png`,fullPage:true});
  await page.locator("#spatial-lens").click();
  await page.screenshot({path:`${evidenceDir}/qk-lens-1280x720.png`});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const audit = await page.evaluate(() => (window as any).spatialAudit);
  expect(audit.commands.filter((c:any) => c.command==="initialize")).toHaveLength(1);
  expect(new Set(audit.commands.filter((c:any) => c.command==="predict").map((c:any)=>c.sessionId)).size).toBe(1);
  expect(errors).toEqual([]); expect(remote).toEqual([]);
  await writeFile(`${evidenceDir}/source-identity.json`, JSON.stringify({startingRun:first.run.manifest, finalRun:second.run.manifest, commands:audit.commands, errors, remote},null,2));
});
