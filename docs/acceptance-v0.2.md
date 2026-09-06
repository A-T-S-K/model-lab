# Model Lab v0.2 acceptance

Local implementation on the existing `model-lab` branch, starting at `6278f89`. All changes stay inside `docs/**` and `model-lab/**`. No push, remote modification, infrastructure change, license decision, or outstanding-PR surface change. The [active execution plan](../../docs/exec-plans/active/2026-09-05-model-lab-premerge.md) owns final gate status; the v0.1 acceptance and its execution record are preserved.

## Required behavior

- Guided, Explore and Microscope project the same execution evidence. Every semantic element has a scalar root, and operands/consumers recursively expose real arithmetic and explicit constants/parameters/structural inputs. Source panels bundle actual source with symbol and SHA-256 revision.
- Current Predict retains all scalar evidence privately. Learn freezes forward values, actual adjoints, local derivatives, repeated operand contributions and gradient anchors before Adam mutates state. All 896 inspected parameter gradients equal the gradients consumed by Adam.
- LearningExperiment links exact before snapshot/run, observed training run, actual optimizer update and exact after snapshot/run. UI exposes these three executions directly. Moment/bias/schedule equations distinguish mathematical update from actual representable delta.
- Canonical binary64 SHA-256 identity includes configuration, parameter order, every value, moments, schedule, cursor and current RNG state. Archive validates immutable plain data, referential integrity and exact optimizer transitions.
- Old requested scalar detail stays observed. Whole captured graphs retain semantic-root identity. Missing old detail runs in a separate disposable inspector worker; every available semantic anchor is verified and backward detail additionally requires observed gradient anchors. Opaque artifact IDs resolve through verified semantic correspondence. Nonfinite or mismatched evidence produces no explanatory graph.
- Deterministic multi-step training retains every observed loss summary, full first/final checkpoints and loss-halving checkpoints. Comparisons use exact compatible runs; missing/incompatible evidence produces no invented delta.
- Only head ablation is promoted: same starting snapshot/input, one selected head output zeroed before concatenation, immutable baseline/intervention runs and downstream comparison. Historical ablation detail verifies the exact declared intervention. Matched training-data substitution remains documented research; no backdoor claim.
- Reset model preserves history; cancel restores the last completed state; Clear session clears both execution boundaries and session evidence. Opt-in Exhibit mode clears after five inactive minutes, including foreground return. A measured 64 MiB estimate stops new capture with one operation of headroom, preserving retained history.

## Numerical and integration validation

`npm run test:reference`: all 9 Python tests pass and the canonical fixture regenerates byte-for-byte.

`npm test`: all 46 TypeScript tests pass, covering v0.1 numerical conformance, connected causal K/V, tracing invariance, exact continuation, every semantic scalar root, all parameter gradients/contributions/Adam inputs, immutable state and repeated edges, historical verification and deliberate mismatch, archive integrity, comparisons and controlled experiments. Strict typecheck and production build pass.

Production Chromium acceptance covers 10 tests: original Predict/Learn arithmetic, mobile/rapid reset, arbitrary forward/backward recursion, source offline, cached observed and historical verified evidence, stale result rejection, exact selected-state restoration, bounded multi-step checkpoints, whole graph capture, public ablation and its historical detail, 105 model resets without history loss/worker growth, 8 rapid cancellations, refresh/focus/reduced motion, touch, kiosk inactivity, and actual session-budget exhaustion followed by archive-preserving reset and Clear session. WAN interception and page-error checks pass. Desktop 1920×1080 and 390 px screenshots were visually inspected; no horizontal page overflow.

## Benchmarks and limits

[Capture benchmark](capture-benchmark.md) measures lengths 1, 4, 8 in forward and forward+backward modes, including nodes, edges, derivatives, JSON bytes, Node retained heap, capture, serialization and selected-slice latency. The final length 8 backward graph has 17,812 nodes and 31,139 operand edges, about 6.52 MB JSON including semantic roots. No scalar graph limit is imposed.

[Training benchmark](training-benchmark.md) measures 1, 10, 50, 100, 500 actual updates. Retaining all 500 full experiments took about 34.3 s and 376 MB JSON in the recorded Node trial, motivating the measured checkpoint policy rather than loss of live scalar detail. [Experiment evidence](experiments-v0.2.md) records exact repeatable ablation and matched-substitution results and the promotion decision.

The final isolated production-browser max-context sample measured 182 ms for Learn, 91 ms for gradient click-to-render and 151 ms for whole statistics, with maximum timer gap 87.3 ms and two long tasks of 77/61 ms. These include Playwright action/wait overhead and are descriptive local samples, not portable latency guarantees. Whole capture rendered 1,468 DOM elements instead of drawing 17,000+ scalar nodes. Chromium page-heap reports varied with GC; browser worker heap is not asserted. Worker ownership/count, termination and session evidence-budget behavior are tested directly; retained worker-equivalent heap is measured in Node.

## Independent review

The independent reviewer found an opaque artifact-ID mismatch bug and nonfinite-source verification hole; both were repaired with targeted regressions. A second pass found stale selected inspection and a historical live-evidence badge; both were repaired with browser coverage. Final independent review found no blockers in scalar/backward evidence, snapshot identity, live-state isolation, declared ablation, archival comparison or historical intervention replay. The reviewer ran focused tests and independent mismatch/state-equality probes.

## Isolation and container

`npm run test:isolation` copies only staged/tracked Model Lab sources into a fresh temporary directory, runs `npm ci`, Python/reference tests, all TypeScript tests, strict build and production Chromium checks. Final exact-source acceptance passed at `/var/folders/2g/6n8r5w2n7z54m4y1m8vj9cjh0000gn/T/model-lab-isolation-oqptknb0`: 9 Python tests, exact fixture regeneration, 46 TypeScript tests, strict production build, and all 10 Chromium tests (12.5 seconds).

`docker build -f model-lab/Dockerfile -t model-lab:v0.2-acceptance model-lab` passed using only the subtree. Temporary container served localhost 4188. `node --import tsx scripts/smoke-container.ts` passed Chromium Predict, Learn, observed gradient, ablation and verified historical inspection, with zero page errors and WAN requests. Temporary container was stopped/removed. Image remains local for review.

Dependencies remain private to Model Lab. No browser-side model download or API is required; dependency/container-image installation can require network. No larger organism, remote inference, database or universal framework was added.
