# Wave 1D review

Implemented in `/Users/joshuahansen/dev/model-lab` on existing `wave-1a-spatial`. Starting tree was clean at `7bd88dcbb9d0497dd37cd38e25424889e0396372`. Implementation checkpoints: `605afd5`, `6dcd3e8`, `9e3edc1`, `ffd271b`, `2520470`. No branch/worktree/clone, support-worktree edits, merges, pushes, PRs, deployments, workshops or subsequent-wave work. The C report's location and uncommitted status remain historical.

## Review

```sh
cd /Users/joshuahansen/dev/model-lab
npm run dev -- --port 4173 --strictPort
```

Open http://127.0.0.1:4173/?presentation=spatial. Classic remains available and the default.

Predict `abca`, choose **Forward**, then Play. Pause, Previous, Next and Restart explanation affect only the explanation. Camera follow can be disabled. Pan/zoom, Home/Back, semantic selection or dependency exploration interrupts guidance; **Resume explanation** returns to the saved source/selection and cursor. Play resumes timed advancement. Each operation has actual input/calculation/result text, exact values, upstream/downstream choices, and expandable source details.

Use **Learn · one update** explicitly, choose **Learning**, then Play. The route follows the all-position objective, selected-parameter contributions, recorded Adam, resulting checkpoint and fresh after-run comparison. At Contributions, **Inspect / verify parameter contributions** requests read-only observed or verified historical detail. Its visible/hidden accounting and child operands remain inspectable while paused. Learning playback itself never requests a model update. Select an older transition to review it while the live model remains at its newer step.

## Implementation and preservation

- `app/spatial/playback.ts`: single bounded clock; 21 Forward stops and five Learning stops. Three 2.2-second explanatory emphasis phases per timed stop, independent of processor timing. Phase updates only change a transient attribute; semantic steps render actual calculations. No invented activation values, new model session, execution scheduler or evidence cache.
- Presenter/main integration: frozen run or experiment identity plus selection/pin; existing camera owner; interruption/resume; invalidation on manual source changes, Predict/Learn/Reset/Clear, input edits and presentation switch. Hidden tabs pause without accumulated-time catch-up. Inspection responses check guide generation as well as existing operation/source bindings.
- Inspectors: original Q/K geometry plus complete component products, reduction/scaling and causal row; actual ReLU pair/derivative and full 32-vector; existing learning arithmetic and shared comparison domains. Adam distinguishes this update's gradient from persistent parameter/moment state.
- Visual polish: consolidated waypoint/explanation controls, compact learning-stage selection indicator, selected-operation framing, short overview labels and fit Adam endpoint text. Signed/probability and before/after encodings remain. Open paths/tethers retain `fill:none`.
- A–C source, numerical conformance, recovery repairs, single session, archive/history and explicit model commands remain intact.

## Validation

Final source implementation commit: `2520470974bb93a1afb3702011e53333e9b8ab8e`; tree `1a23913bdcb5e2aba104e934704aeffdb41772a2`.

Final runtime: `sha256:1c1ae6812a1ed23c1ceb80651c2581962910f203e40ae6a3b05c17553184e6e5` (67 runtime inputs). Starting C runtime: `sha256:8f45ff3228e8a18872659fab550c9c453c612d141f35faa6cb80afae6f452bcc`.

| Check | Result | Evidence |
| --- | --- | --- |
| D01 | PASS | Both routes, timed/manual controls, detour/resume, historical update after a newer Learn, generation/source invalidation. Audit: initialize ×1, predict ×2 (startup plus explicit Predict), train ×2 (both explicit), inspect ×2; playback adds no model commands. |
| D02 | PASS | Reduced-motion immediate framing, keyboard/non-drag camera controls, keyboard learning detour, static facts and selected-head emphasis; no activity stroke on numerical bars. |
| D03 | PASS | Production HTTP, real workers/bundled fonts; D audit has no WAN requests, asset/worker failures or page errors. |
| D04 | PASS | Full-size overview/attention/MLP/learning review at 1920×1080 and 1280×720, plus arithmetic/endpoint captures and an 81.24-second paced route. |
| D05 | PASS | 17 reference tests and exact conformance; 76 unit/integration tests; example/typecheck/build; all 85 browser tests on 4173 and all 13 spatial tests on 4174; bounded resource sample. |

```sh
# Entire existing acceptance pipeline, with bounded browser concurrency; HTTP 4173.
npm run build
npm run test:reference && npm test && npm run example && npm run test:browser -- --workers=2 --output=test-results/wave1d-acceptance

# Every spatial suite, including prior paced routes and recovery; HTTP 4174.
SPATIAL_EVIDENCE_DIR=/tmp/model-lab-wave1d-final npx playwright test --config playwright.spatial.config.ts tests/browser/spatial-*.spec.ts tests/browser/wave1c-early-stop.spec.ts --workers=1 --output=test-results/wave1d-spatial
```

Final acceptance passed 17 reference tests, exact portable conformance (zero differing floats), 76 unit/integration tests, example/build and 85 browser tests. D includes timed Learning, exact model-command counts, selected-head emphasis, keyboard learning detours and quantitative-mark preservation. No existing tests, tolerances, provenance, recovery, history or origin assertions were weakened.

Focused probes found and repaired stale keyboard-pan status, missing comparison framing, accidentally canceled manual framing detached DOM retention, head-1 emphasis, keyboard learning-stage interruption and activity strokes on numerical marks. Stable callbacks outside `render()` remove retained render frames. The new clock test uses a deterministic mock clock; an initial short wall-clock wait was unreliable under concurrent tests. Initial sandbox localhost EPERM and an existing checkout preview on 4173 were resolved before HTTP tests; the verified old preview was stopped, not reused by weakening configuration.

## Resource evidence and limits

Chromium 153.0.8010.12, Darwin arm64, Node v24.20.0. Ten warmup play/pause/inspect/resume cycles, then two batches of ten, with full GC before DOM/heap samples. The final run held 4,682 nodes and 182 listeners at all three samples; twenty measured cycles took 8.566 s, including Playwright overhead. JS used heap was 3,234,936 → 3,263,432 → 3,299,400 bytes. Final samples are retained in `resources.json`. This is page/DOM measurement, not worker-heap or target-hardware certification. Existing evidence admission remains 64 MiB; camera history is capped at 40 entries, and playback has at most one timer.

Learning decomposition remains an explicit read-only inspection when not already cached; missing decomposition is not zero. One parameter is an inspectable slice, not the entire backward graph or a one-weight explanation of changed output. Dense complete values and formulas scroll locally, especially at 1280×720. Emphasis is explanatory, not quantitative magnitude or measured execution. No comprehension study, target-hardware acceptance, cold offline startup, prolonged soak, live operator stepping or event readiness is claimed. Stop after D for human review.


## Review artifacts

All artifacts are in ignored `test-results/wave1d-review/`. [Source/runtime and run identities](wave-1d-source-identity.json) are committed separately from generated media. The complete worker audit, recording manifests, supplemental capture identity, resource samples and exact logs are in that artifact directory. Review servers from test configs were stopped by Playwright; a production preview was then left on 4173 for human review.

[81.24-second 1920×1080 MP4 route](../test-results/wave1d-review/wave-1d-route.mp4) · [original WebM](../test-results/wave1d-review/wave-1d-route.webm). The route shows Forward playback, Q/K geometry/products, an MLP detour/resume, one explicit Learn, Learning playback with actual contributions and Adam, then the fresh after-run. Recording frames were reviewed at full resolution; keyboard/lifecycle/resource evidence is separate.

| State | 1920×1080 | 1280×720 |
| --- | --- | --- |
| Overview | [Capture](../test-results/wave1d-review/overview-1920x1080.png) | [Capture](../test-results/wave1d-review/overview-1280x720.png) |
| Attention | [Capture](../test-results/wave1d-review/attention-1920x1080.png) | [Complete geometry](../test-results/wave1d-review/attention-geometry-1280x720.png) |
| Q/K products | [Capture](../test-results/wave1d-review/attention-products-1920x1080.png) | [Capture](../test-results/wave1d-review/attention-products-1280x720.png) |
| MLP / ReLU | [Capture](../test-results/wave1d-review/mlp-1920x1080.png) | [Capture](../test-results/wave1d-review/mlp-1280x720.png) |
| Learning / Adam | [Capture](../test-results/wave1d-review/learning-1920x1080.png) | [Capture](../test-results/wave1d-review/learning-1280x720.png) |
| Stored endpoint | [Capture](../test-results/wave1d-review/learning-endpoint-1920x1080.png) | [Capture](../test-results/wave1d-review/learning-endpoint-1280x720.png) |
