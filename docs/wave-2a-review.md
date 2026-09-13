# Wave 2A review

Implemented only in `/Users/joshuahansen/dev/model-lab`, existing `wave-1a-spatial`, origin `git@github.com:A-T-S-K/model-lab.git`. Starting clean HEAD `d2587733ae5ed56b15f87317dae33822531a5a99`, tree `1e48ceeabea3ec9c32ed92db948145a5e0efa129`. Its parent is D's implementation `2520470974bb93a1afb3702011e53333e9b8ab8e`; the inspected diff changes only the review and identity documents. No reset or newer-work replacement. Local checkpoints: `00e8ffa`, `89a9839`, `c244cae`.

Implementation HEAD `c244cae84c49afe149320fa06539acf0a6a1f30d`, tree `fa8316848aee3f304471a51e00af2556e704ff23`. Runtime `sha256:3f75378e08746d1b7ba4b83a7ff5432075362d3ee2cf4c4023c3ba41483b083a` (68 source inputs). Starting built D runtime was verified as `sha256:1c1ae6812a1ed23c1ceb80651c2581962910f203e40ae6a3b05c17553184e6e5`. Final documentation HEAD/tree and captured run identities are recorded in [delivery identity](../test-results/wave2a-review/identity.json).

```sh
cd /Users/joshuahansen/dev/model-lab
npm run dev -- --port 4173 --strictPort
```

Open [Spatial](http://127.0.0.1:4173/?presentation=spatial). Classic remains the default. Choose **Step through prediction**, then **Next operator** or **Continue**. **Pause** stops admitting permits; an in-flight operation shows Pausing until acknowledged. **Cancel execution** restores the prior completed selection, including an empty selection. Input edits and presentation switches cancel before rebinding. Hidden tabs pause without auto-resume. Reset/Clear invalidate the generation. A worker failure releases the partial view and requires an explicit reset/clear to restart.

The single worker owns one forward generator and CaptureContext. Fast Predict, Learn and stepped Predict drain the same numerical path. Traversal remains position → layer → head: 24 boundaries per position, 120 for `abca`, 192 at maximum context. Lookups, addition and both early normalizations are distinct; Q yields before K/V, and each head has separate score/softmax/weighted-output boundaries. Query slice and causal selection belong to the score operation; head-channel accumulation is structural, with an explicit concatenation boundary. Final resume only assembles the already-computed return value.

Each permit has session/generation/execution identity and a monotonic sequence. Duplicate/out-of-order/stale permits never advance. One UI driver permits at most one unacknowledged operator and schedules its successor through a browser task after 220 ms of intentional pacing. The explanation clock is suspended. The same camera follows acknowledged boundaries immediately; manual exploration disables follow and requests pause during Continue. Navigation never grants permits.

Partial numeric artifacts use the existing immutable vocabulary in one transient accumulator; only deltas cross the worker boundary. They never enter archive/history. Checkpoint matrices stay available; future outputs are empty and pending, causal future keys are NA, and capture-budget states stay distinct. Partial scalar inspection reads produced roots directly, bypasses historical reconstruction, and is not cached across the growing graph. Completion publishes exactly once through the existing accepted-result/archive path with the original execution ID, without another Predict. Q and ReLU have local observed-result annotations; the ReLU index guide links the selected input/output marks without changing their scales or colors.

| Proof | Evidence |
| --- | --- |
| E01 | Independent Value.mul receiver, exp and relu spies: no math at start, Q weight used at pause while K/V weights and later primitives remain unused. HTTP audit sees sequence 0 with no artifacts and six permits to Q; K has no marks. |
| E02 | Driver tests hold a delayed acknowledgement, show Pausing, reject double issuance, remain paused over repeated opportunities, and preserve accepted completion before cancellation. Worker tests reject duplicate, out-of-order, wrong-execution, stale-generation and wrong-session permits. HTTP maximum outstanding permits = 1. |
| E03 | Active-run artifact/scalar identity and known parameter roots; future scalar absent; no old-run fill. UI shows pending operations and future causal NA. |
| E04 | Same execution ID completes once after 120 permits with no extra Predict. All semantic vectors, logits and probabilities equal fast execution exactly; snapshot identity unchanged. |
| E05 | Empty document (one BOS position), `abca`, `abcb`, maximum `abcabca`, both heads, declared sequential boundaries and earlier-position K/V. Existing strict reference and connected-gradient tests retained. |
| E06 | Start/cancel/completion snapshot equality; two ordinary Learn updates retain exact gradients, moments, deltas and continuation. |
| E07 | Cancel paused/continuing, reset/clear, input/switch, hidden tab, late replies, paused-worker failure/restart, prior completed evidence and C/D recovery. Thirty worker cycles release every cursor and retain at most one completed prediction context. Browser cycles retain bounded DOM/listeners. |
| E08 | Production HTTP, 1920/1280, Q scalar, ReLU component 7, keyboard and reduced motion, pause/explore/resume, completion and read-only explanation. Direct in-app browser operation and full-size capture review supplement tests. |

Final acceptance: **17 reference tests and zero differing floats; 82 unit/integration tests; example, typecheck and build; 89 browser tests on 4173; all 17 spatial tests on 4174**. Both HTTP suites passed on the final `c244cae` source/runtime. Stop any manual preview before these commands; the test configurations own their required HTTP servers.

```sh
npm run test:reference
npm test
npm run example
npm run build
WAVE2_EVIDENCE_DIR=/tmp/model-lab-wave2a-main-final npm run test:browser -- --workers=2 --output=test-results/wave2a-acceptance-final
WAVE2_EVIDENCE_DIR=/tmp/model-lab-wave2a-spatial-final SPATIAL_EVIDENCE_DIR=/tmp/model-lab-wave2a-preservation-final npx playwright test --config playwright.spatial.config.ts tests/browser/spatial-*.spec.ts tests/browser/wave1c-early-stop.spec.ts --workers=2 --output=test-results/wave2a-spatial-final
```

[Reference log](../test-results/wave2a-review/wave2-reference.log) · [82 tests](../test-results/wave2a-review/wave2-tests.log) · [build](../test-results/wave2a-review/wave2-build.log) · [89 browser tests](../test-results/wave2a-review/wave2-browser-final.log) · [17 spatial tests](../test-results/wave2a-review/wave2-spatial-final.log).

[72.92-second paced recording, 1920×1080 MP4](../test-results/wave2a-review/wave-2a-route.mp4) · [original WebM](../test-results/wave2a-review/wave-2a-route.webm) · [recording traffic/identities](../test-results/wave2a-review/recording-audit.json) · [HTTP proof audit](../test-results/wave2a-review/http-audit.json). Full-size frames were inspected at the Q pause, pending K, selected ReLU, exploration and completion; the recording ends with ordinary explanation controls. Final frame review also corrected Q's annotation tether for components belonging to head 1.

| Capture | 1920×1080 | 1280×720 |
| --- | --- | --- |
| Start before work | [Empty activation map](../test-results/wave2a-review/pending-1920x1080.png) | — |
| Q before K/V | [Exact Q calculation](../test-results/wave2a-review/q-paused-1920x1080.png) | — |
| Selected ReLU component 7 | [Input/output guide](../test-results/wave2a-review/relu-1920x1080.png) | [Compact view](../test-results/wave2a-review/relu-1280x720.png) |
| Paused exploration | [Recording frame](../test-results/wave2a-review/recording-frame-32.png) | [Keyboard detour](../test-results/wave2a-review/explore-paused-1280x720.png) |

[Resource sample](../test-results/wave2a-review/execution-resources.json): Chromium 153.0.8010.12, macOS arm64, Node v24.20.0. Six warmup cycles, then two batches of six; each advances six operators, every third completes, others cancel. After GC, all three endpoints have 4,685 DOM nodes and 182 listeners. JS heap: 3,552,252 → 3,667,812 → 3,816,964 bytes, with completed history intentionally retained. Twelve measured cycles took 30.856 s including Playwright and intentional pacing. Separate worker tests ran 30 cycles, releasing every cursor and retaining at most one completed prediction context. Worker heap itself was not measured.

[Fast-path latency sample](../test-results/wave2a-review/latency-summary.json): 20 measured `abca` predictions after startup and five warmups. Mean request-to-result time increased from 110.155 ms at D to 117.345 ms at the final runtime (+6.5%, about 7.2 ms); medians were 109.55 and 117.65 ms. This includes capture and worker transport, with uncontrolled desktop background load. It establishes a small observed regression for this workload, not zero overhead or a processor benchmark. Raw samples and the measurement script are alongside the summary.

The first full regression exposed a listener-retention regression from controls bound inside `render()`. Moving those callbacks outside its closure repaired the existing D resource test without weakening it. Visual review also repaired interrupted execution-follow framing and the historical label on a transient run. Source-symbol checks now recognize the actual generator function; numerical tolerances and origin assertions are unchanged.

Operator internals are atomic, with no scalar-level preemption. The 220 ms pacing is display/control time, not measured processor time. Detailed arithmetic still uses the inspector; no learning-geometry redesign, live backward/Adam stepping, reverse execution, general scheduler or renderer migration was added. Resource measurements are a bounded desktop regression sample, not a soak, hardware, offline-startup or comprehension certification. Existing exact-runtime compatibility checks remain: D scalar node IDs are not reused in this revision. No branch/worktree/clone, support-worktree edits, merges, pushes, PRs, deployment or workshops changes. Stop after Wave 2A for review.
