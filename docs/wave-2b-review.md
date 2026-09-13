# Wave 2B review

Implemented in `/Users/joshuahansen/dev/model-lab`, existing `wave-1a-spatial`, origin `git@github.com:A-T-S-K/model-lab.git`. Starting clean HEAD `e9ccf3227fc503820babe1beb7707968877f22a2`, tree `bccf9a3158d67c574bf46e810321679ee174c60d`. No reset, remote synchronization, branch, worktree, clone, support edits or publication.

The existing forward permit driver now also drives one worker-owned training transaction. It runs an explicitly identified baseline forward, training forward, ordered target losses/mean, backward seed, reverse-topological nodes, parameter-order Adam proposals, private candidate application, and a fresh captured candidate forward. Ready requires ordinary LearningExperiment validation and stops Continue. Accept publishes that prepared bundle through C's matching-receipt and archive path; Discard releases the transaction without accepted writes. Ordinary Learn drains the same objective/backward/Adam cores; controlled acceptance does not call Learn or Predict.

Manual backward units apply all operand occurrences of one node, including repeated parents. Continue admits at most 128 nodes or proposals per worker task, never across a phase barrier. Forward operators remain atomic. Setup/finalization boundaries are reported separately by phase; phase counts include a final generator completion boundary. No scalar timers or promises. Pinned stops test the actual write/proposal inside the chunk. Recent live contributions retain eight occurrences; final gradients are captured once before private writes. Pin inspection and navigation do not grant permits; replies are revision-bound. The private candidate remains separate from accepted state and completed history.

The local instrument shows signed contribution/accumulator marks on a declared fixed ±1 domain (clipped marks, exact numbers), actual multiplication/addition, old moments, proposed moments/corrections/delta/parameter, and the forward owner. Known forward shapes stay visible while pending. Partial, final, proposed and accepted states are distinct. Classic remains default.

Implementation HEAD `0be0850aad86a68b7693d99219191b0091fd0193`, tree `db1bf0f21b717659d8477b4bfb78c30449bee560`. Runtime `sha256:a1125f12566d71d06be7368644e4a9d62007bc20459b1fbeba030c26e28ac2a4` (70 source inputs). Checkpoints: `4879c4e` shared numerical cores; `de76f14` transaction; `ab06b8c` integration; `0a2b90c` inspection provenance/cancellation; `0be0850` SVG signed marks. Final documentation HEAD/tree and running process are in [delivery identity](../test-results/wave2b-review/identity.json).

```sh
cd /Users/joshuahansen/dev/model-lab
npm run dev -- --port 4173 --strictPort
```

Open [Spatial review](http://127.0.0.1:4173/?presentation=spatial), choose **Step through learning**, then Next or Continue. During backward choose **Continue to next contribution to pinned parameter**. Continue never accepts. Ready replaces advancement with **Accept update / Discard candidate**. Review server process identity is recorded alongside the delivery identities. Classic remains the default URL.

Verification logs and media are under ignored `test-results/wave2b-review/`. The full production HTTP suites also passed on the preceding two integration builds before the final SVG marks were added; final-build results are recorded below.

## Acceptance evidence

| Check | Evidence |
| --- | --- |
| T01 | Exact ordinary/controlled equality for all three semantic runs, every gradient/Adam field, snapshots/moments/step/cursor and fresh probabilities across two consecutive updates; additional empty, changed and maximum-context inputs. Reference conformance retains zero differing floats. |
| T02 | Independent gradient setters on repeated operands/shared expressions; pinned stop checks inside the chunk; inspection does not increment sequence; prior envelopes remain frozen. HTTP route observes two actual accumulator values and opens the contributing scalar. |
| T03 | Getter spy distinguishes initial finite validation from the next parameter's actual proposal read; old persistent state remains identical, including nonzero prior moments and zero gradient; malformed final proposal rejects before any write. |
| T04 | Cancellation at baseline/training forward, loss, backward, proposals, application boundary, partial candidate forward and Ready; full accepted snapshot equality and released transaction. Separate Reset/Clear generation checks and restored prior completed location. |
| T05 | Continue stops at Ready; duplicate acceptance rejects; one matching result advances one step. HTTP command audit has three identifiable forward passes per controlled update and no train/replacement-predict command. |
| T06 | Candidate hash, application, forward, assembly and publication faults; cancel-before-accept and accept-before-cancel; delayed driver receipt serialization; client recovery from matching receipt; wrong identities/generation/sequence; controlled archive-admission retry without reexecution. Existing C recovery remains. |
| T07 | Empty one-position, changed and maximum-context documents; both heads/connected K/V through exact all-field comparison and retained continuation tests; read-only non-embedding pin selection and in-order proposal stopping; keyboard, manual detour, hidden tab and input/presentation invalidation. |
| T08 | Two accepted updates, inspect Update 1 at live step 2; ordinary learning/history/playback suites retained. Candidate contribution links remain bound to the training graph when the forward source changes to the candidate. |
| T09 | Real production HTTP route, same wte[0,0] across partial/final/proposal/candidate/acceptance, second-run discard, 1920/1280 captures, negative ReLU input to zero, owner navigation and reduced motion. |
| T10 | One outstanding permit; maximum 128 node/proposal units; eight recent pinned occurrences; repeated worker accept/cancel cycles and browser DOM/listener sampling; full reference/unit/example/build and both HTTP boundaries. |

Focused tests initially exposed an incorrect test assumption about parameter ordering (`lm_head` precedes `layer0.attn_wq`); the test now resolves the actual declared order. A Clear assertion was corrected to check the genuine empty view and the reset snapshot rather than expecting a step counter belonging to a selected run. No numerical tolerance, origin assertion or retained acceptance test was relaxed.

## Limits

This is an in-memory transaction, not reload/crash-durable storage. Worker failure preserves the client's last matching accepted receipt; the existing explicit Reset/Clear restart behavior remains. No automatic resume on visibility change. Forward operators, backward setup, complete-proposal application, final capture/validation and publication are atomic boundaries; scalar kernel preemption is not provided. Counts include setup/finalization permits; there is no invented whole-update percentage.

The baseline is always one explicit new pass; compatible Predict reuse is not implemented. Controlled execution performs exactly baseline/training/candidate forwards. Ordinary Learn retains its existing execution/capture behavior. Recent live events retain only the latest eight occurrences for the currently pinned parameter; changing the pin does not reconstruct earlier arrival history. Final frozen contributions remain available through the ordinary completed inspector after acceptance. Signed local marks use a fixed ±1 clipped domain, with exact numbers alongside. Small browser/worker samples are regression evidence, not hardware, soak or comprehension certification.


## Review media and execution audit

[90.12-second MP4 route](../test-results/wave2b-review/wave-2b-route.mp4) · [original WebM](../test-results/wave2b-review/wave-2b-route.webm) · [HTTP command/response audit](../test-results/wave2b-review/http-audit.json) · [compact route identities and numbers](../test-results/wave2b-review/route-summary.json).

The recorded wte[0,0] accumulator changes from `0` to `0.07143111717333846`, then to `0.16297180652353693`; that is also its final gradient. Update 1 proposes the old and candidate parameter values shown in the proposal capture (the audit retains full precision), prepares the candidate and accepts it once. A second complete candidate is discarded at accepted step 1. The route uses three distinct passes per transaction (baseline, training, candidate), not a renamed training trace. A separate route accepts two updates and inspects Update 1 while the live model stays at step 2.

| View | 1920×1080 | 1280×720 |
| --- | --- | --- |
| Actual partial accumulator | [Partial](../test-results/wave2b-review/partial-1920.png) | [Next contribution](../test-results/wave2b-review/partial-1280.png) |
| Real parameter proposal | [Proposal](../test-results/wave2b-review/proposal-1920.png) | [Compact proposal](../test-results/wave2b-review/proposal-1280.png) |
| Candidate / acceptance | [Pending candidate](../test-results/wave2b-review/candidate-pending-1920.png), [Ready](../test-results/wave2b-review/ready-1920.png), [Accepted](../test-results/wave2b-review/accepted-1920.png) | — |
| Negative ReLU | [Negative input → zero](../test-results/wave2b-review/negative-relu-1920.png) | [Compact ReLU](../test-results/wave2b-review/negative-relu-1280.png) |
| Discard / historical read | [Discarded](../test-results/wave2b-review/discarded-1920.png) | [Update 1 at live step 2](../test-results/wave2b-review/historical-first-after-second-1280.png) |

Capture review repaired an expanded objective section that hid arithmetic at 1280, dense pending metadata, and missing local signed marks. Static captures and sampled encoded video frames were inspected at full size; the complete route retains all intervening numerical work.


## Final results

**17 reference tests (zero differing floats), 108 unit/integration tests, example, typecheck/build, 93 browser tests on 4173 and 21 spatial tests on 4174 passed on the final implementation/runtime above.** Both HTTP suites included all four new Wave 2B routes. `git diff --check` passed.

[Reference log](../test-results/wave2b-review/reference.log) · [unit/integration log](../test-results/wave2b-review/tests.log) · [build](../test-results/wave2b-review/build.log) · [4173](../test-results/wave2b-review/browser.log) · [4174](../test-results/wave2b-review/spatial.log).

```sh
npm run test:reference
npm test
npm run example
npm run build
WAVE2_EVIDENCE_DIR=/tmp/model-lab-wave2b-main-delivery WAVE2B_EVIDENCE_DIR=test-results/wave2b-review npm run test:browser -- --workers=2 --output=test-results/wave2b-acceptance-delivery
WAVE2_EVIDENCE_DIR=/tmp/model-lab-wave2b-spatial-delivery SPATIAL_EVIDENCE_DIR=/tmp/model-lab-wave2b-preservation-delivery WAVE2B_EVIDENCE_DIR=test-results/wave2b-review/spatial npx playwright test --config playwright.spatial.config.ts tests/browser/spatial-*.spec.ts tests/browser/wave1c-early-stop.spec.ts --workers=2 --output=test-results/wave2b-spatial-delivery
```

Stop only the verified project review preview before running these configurations, which own their respective ports. The preview was restarted after acceptance.

[Worker sample](../test-results/wave2b-review/worker-performance.json): 12 alternating one-position cancel/accept cycles, 1,074 permits, at most two retained completed capture contexts and no remaining transaction after each terminal action. Maximum worker permit 6.833 ms, mean 0.197 ms; maximum promotion call 0.026 ms excluding structured-clone transport. Ten ordinary `abca` Learn requests after two warmups averaged 55.438 ms (range 46.215–62.673 ms), including numerical execution, capture and assembly but excluding HTTP/UI. These ran alongside browser tests, with uncontrolled desktop load; no before/after latency improvement is claimed.

The final HTTP route admitted 927 training permits across two transactions, one acceptance and one discard; maximum outstanding = 1. Maximum permit request-to-response 111.5 ms; acceptance receipt 208.8 ms, including worker transport. Largest sampled transient JSON envelope 64,471 bytes, including the checkpoint-bearing phase start; no full scalar graph is transported per permit. [Browser resource sample](../test-results/wave2b-review/training-resources.json): three batches of four start/operator/cancel cycles with GC at the completed-view boundary held DOM nodes at 4,208 and listeners at 189; heap samples are recorded without a worker-heap or soak claim.

No merge, push, PR, deployment, workshop edit or subsequent-wave work. Stop after Wave 2B for review.
