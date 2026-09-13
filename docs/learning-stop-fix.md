# Prospective learning stop

2026-09-13. One targeted correction on `wave-1a-spatial`, repository `A-T-S-K/model-lab`, solely in `/Users/joshuahansen/dev/model-lab`. The clean starting HEAD was `78cc63fa057fc2f3be8276c4bc1d8d69b1d7141d`, matching the supplied reference. No branch, checkout, worktree, clone, support-tree edit, kernel change, merge, push, PR, deployment or workshop change.

## Visitor route

Open the Spatial presentation. With the default `abca` and pinned `wte[0,0]`, click **Step through learning**, then **Run to next gradient contribution** while still in baseline forward. Wait for the actual partial gradient. This takes **two user actions from the Spatial entry**, or **one after the paused transaction exists**, independently of input length. No phase-timed Pause and no repeated Next clicks are needed. The old 247-click prerequisite is resolved by this prospective action; the manual route remains a retained regression.

The same action requests the next supported matching backward boundary. **Continue** reaches **Candidate ready — not accepted**. **Accept update** and **Discard candidate** remain explicit decisions. The action does not restrict the objective to the pin or selected token.

## Implementation and boundaries

The existing `ForwardDriver` owns one intent bound to its lifecycle epoch (session/generation replacement), execution ID, pinned parameter and armed sequence. It uses the existing scheduler and ordinary work budgets. Prerequisite permits carry out the real baseline, training forward, loss and backward setup. Only backward permits receive the existing worker `stop` flag. The worker stops after the first atomic node with a matching operand occurrence, or at backward completion before any optimizer proposal. Its traversal, contributions, eight-occurrence retention, source IDs, accumulation and optimizer arithmetic are unchanged.

There is one advancement loop and at most one permit in flight. No precomputed replay, second training run, extra baseline or replacement candidate is involved. Ordinary Continue and manual Next clear the intent. Pause, exploration, pin replacement, cancellation, input/presentation changes, hidden-tab handling, failures and reset/discard invalidate it. An admitted unit can finish while Pausing. If a pin changes during an acknowledgement, the driver refreshes read-only pin evidence before publishing that acknowledgement under the new selection; this grants no work and preserves the admitted artifact delta and source header. A delayed phase-transition regression checks that preservation. Old epochs cannot resume execution.

Repeated operands within one backward node finish together; the retained occurrence list shows their individual writes. Zero-valued contributions still match. If no match remains, the UI reports backward completion and no remaining contributions, with a known final gradient (including zero), before the first proposal. Later phases explain that no future backward contribution exists in this transaction. They never restart or reconstruct missed arrival history. The existing pinned-proposal action is retained separately by its label and phase.

The five corrections in [end-to-end-fixes.md](end-to-end-fixes.md) remain: scalar contrast, public presentation entry, compact calculations/Ready controls, prediction labels and learning guidance. The obsolete timing guidance is replaced with the new route. Ready retains its compact control layout. SVG/HTML, Graphite/Plex, owner context, accepted snapshot/optimizer/cursor/RNG isolation, explicit candidate decisions, receipt/archive recovery and intervention isolation remain in place.

## Verification

The new `tests/app/learning-stop.test.ts` uses real sessions and the driver scheduler. It checks exact complete update/snapshot equality with ordinary training for `abca`, `a` and maximum-context `abcabca`, across two consecutive updates; the second uses a non-embedding parameter and nonzero prior optimizer state. It checks stable suspension, another contribution, candidate isolation, discard, no-match completion and delayed acknowledgement cancellation. Existing training tests additionally exercise synthetic repeated-operand and genuine-zero objectives through the unchanged worker stop. Synthetic objectives exist only in tests.

`tests/browser/learning-stop.spec.ts` uses built HTTP app controls, with passive worker auditing. Its main paced recording goes initial request → partial gradient → next contribution → Ready → Accept, then a separate candidate cancellation. Numerical reference comparisons use a separate browser test session explicitly clicking ordinary Learn; the exhibit never launches that reference run. Other HTTP cases cover an unused embedding row, short/maximum inputs, prior moments/non-embedding pins, untimed Pause/exploration, pin re-arming, input/presentation/cancel/clear and simulated hidden-tab notifications with delayed acknowledgements. No focused route polls for backward to click Pause or invokes driver methods.

The default first match observed in focused HTTP evidence is occurrence 3930, child 8904, operand 0: `0 + 0.07143111717333846 = 0.07143111717333846`. This is evidence from this fixture, not an index used by the implementation or test control flow. The full envelope records its execution/source identity and actual accumulator.

Implementation checkpoints: `9d9fa4bbf090e593228f1ff54e2ae666e7369a66` and final source checkpoint `abb28f89aa91348bbbd70e58789cfa799d90ba70` (tree `45e67398901f7e4898b99557b379e3ac1888251a`). Runtime: `sha256:43e1d620725ca915106b6eb61f8f5e561a1580f2949f85eb130ecc435dccffbc`, from 71 production inputs. Delivery commit/tree and bundle hashes are in [identity.json](../test-results/learning-stop-fix/identity.json).

| Final check | Result | Evidence |
| --- | --- | --- |
| Focused driver/transaction checks | 42 pass | [log](../test-results/learning-stop-fix/focused-unit-final.log) |
| Reference | 17 pass; zero differing floats | [log](../test-results/learning-stop-fix/reference.log) |
| Unit/integration | 126 pass | [log](../test-results/learning-stop-fix/unit.log) |
| Example, typecheck/build | Pass | [example](../test-results/learning-stop-fix/example.log), [build](../test-results/learning-stop-fix/build.log) |
| HTTP 4173, four workers, no retries | 103/103 pass (5.7 min) | [log](../test-results/learning-stop-fix/http-4173.log) |
| HTTP 4174, four workers, no retries | 31/31 pass (4.9 min) | [log](../test-results/learning-stop-fix/http-4174.log) |

 Intermediate failures are diagnostic evidence, not passes: a test initially exceeded the seven-character input limit, a parameter selector was incorrectly sought in the operation dropdown before Predict, and a browser test read its start identity before the paused acknowledgement. The cancellation harness also needed to delay the client’s actual `onmessage` delivery, settle navigation before changing the pin, and retire cancelled/terminated permits from its active-work count. These harness issues were corrected without relaxing numerical tolerances. Review additionally caught a pin-refresh path dropping an admitted source header; the implementation and a phase-transition regression were corrected before final acceptance.

## Media and action count

[Paced actual HTTP recording](../test-results/learning-stop-fix/paced-route.webm): 69.72 seconds, 1920×1080 video containing both viewport sizes, with reading pauses at initial, partial, next and Ready states. [Route audit](../test-results/learning-stop-fix/main-stop/route.json) records **2 user actions / 264 automatic permits** to the first partial gradient, the same transaction, another matching boundary, and Continue to Ready. The counts are measured evidence, never execution indices. [Cancellation audit](../test-results/learning-stop-fix/main-stop/cancellation.json) includes the delayed transport cases.

| State | 1920×1080 | 1280×720 |
| --- | --- | --- |
| Initial paused request | [image](../test-results/learning-stop-fix/main-stop/initial-1920.png) | [image](../test-results/learning-stop-fix/main-stop/initial-1280.png) |
| Actual partial gradient | [image](../test-results/learning-stop-fix/main-stop/partial-1920.png) | [image](../test-results/learning-stop-fix/main-stop/partial-1280.png) |
| Next contribution | [image](../test-results/learning-stop-fix/main-stop/next-1920.png) | [image](../test-results/learning-stop-fix/main-stop/next-1280.png) |
| Ready, still provisional | [image](../test-results/learning-stop-fix/main-stop/ready-1920.png) | [image](../test-results/learning-stop-fix/main-stop/ready-1280.png) |

Full-size screenshots were visually inspected; the partial accumulator and parameter owner remain visible together, and Ready preserves the compact decision/calculation layout. Video frames were also sampled at full resolution. The 4174 suite records its own route and captures under `spatial-stop/`.

## Repeat and startup

From the normal checkout, with dependencies installed:

```sh
npm run test:reference
npm test
npm run example
npm run build
```

Both final HTTP runs used the same runtime above; no final check remains failing. `git diff --check` passed.

Both browser configurations own their server. Free only verified project previews before running them; use the evidence environment variables and output paths in the [command record](../test-results/learning-stop-fix/commands.sh). The 4174 boundary includes the new `tests/browser/learning-stop.spec.ts` alongside every documented spatial, early-stop and end-to-end-fixes test.

The normal-checkout preview was restored on 4173 (PID 54353); [process identity](../test-results/learning-stop-fix/preview-process.json) and [fresh-page startup check](../test-results/learning-stop-fix/startup.json) confirm the current runtime, local worker startup, loaded fonts and enabled learning control with no page errors.

For normal startup: `npm run preview -- --port 4173 --strictPort`, then open `http://127.0.0.1:4173/` (TOUCH TO START → Why this prediction? · Explore → Spatial presentation · controlled learning), or `http://127.0.0.1:4173/?presentation=spatial`. Rebuild after source changes. Reloading starts a new in-memory session.

These checks establish untimed operation and state/numerical preservation, not unfamiliar-user comprehension or target hardware/DPI/touch suitability. Those broader experience tests remain necessary. Work stops here for review.
