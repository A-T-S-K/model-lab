# Release-learning forward tour — 2026-10-02

Implemented opt-in `/?experience=learn` chapters 3–4: context/attention and output,
continuing the same canonical abca/p3 prediction from the opening and chapters 1–2.
The existing learning workflow has an explicit computation/proposal handoff. Redesigned
chapters 5–6 remain deferred. This is working-source engineering evidence, not learning
research, full-suite success, foundation, independent M5 or release acceptance.

## Authority and starting bytes

Branch `pre-m5-abq-experience`, HEAD
`ffb2db9217dac8ff3195fc2943918656daa78b59`; starting and delivery staging empty.
Starting read-only runtime matches the planning baseline:
`sha256:16b013519441271105843cbec11b6055d565a09aad07425a6e889645c20cc9dd`.
Read applicable root instructions, documentation authority, foundation ledger,
roadmap, journey, validation-safety, runner-lifecycle, canonical-workflow,
Guided-lifecycle, shared-navigation and introductory reviews, Read the Code and
current evidence contracts. Design §§3–6/8, proof-plan FP portfolio/M5/M6 and R1
output protection govern this slice. No applicable nested instructions or material
design conflict requiring a gate decision were found.

[Starting manifest](../../test-results/scratch/release-forward-6i25ccmq/starting.json)
records 407 source/generated files, with regular byte copies in `starting/`, including
ignored `runtime/revision.ts`, incoming tracked/untracked work, `.DS_Store`, merge
plan and previous reports. [Protected inventory](../../test-results/scratch/release-forward-6i25ccmq/protected.json)
records 43,817 pre-existing evidence/dist files before generation hooks. The
incremental patch compares with these contemporaneous bytes, rather than attributing
the combined dirty HEAD diff to this task.

Delivery runtime, 142 ordered production inputs:
`sha256:8e67767e6d3bdc345263d54c51c4c41c3076fa1a0f8dbc9a45b060e37c12e949`.
[Read-only delivery identity](../../test-results/scratch/release-forward-6i25ccmq/handoff-delivery-runtime.json).

## Implementation and numerical contract

Changes are confined to release-learning presentation/view, the explicit handoff guard in main, minimal presenter/dock
labels, opt-in styles, focused tests, journey coverage, additive roadmap/triage and
this review. PublicLessonSession still owns lesson/navigation state. The retained
canonical computation binding still owns the run. The new bounded teaching query
reads the existing spatial Q/K lens and ForwardModel operation explanations. No
independent execution trace, session machine, scene or forward arithmetic engine.

Chapter 3 uses five existing public states. Query/Key/Value have operational roles,
distinct native projection identities and complete head0 slices. The full request is
abca; current p3/c sees START → abc. START/p0 and p1–p3 are eligible; p4/a is future
and has no score coordinate. No future zero or unmaterialized mask is invented.
Head0/key0 displays all four captured Q/K operands, signed derived products and sum,
actual width-four scaling and captured score separately. The complete eligible
score/weight row normalizes over positions. Component-zero Value mixing retains
every eligible contributor and the complete derived reduction beside observed output.

Head vectors use their actual distinct projected channels. Concatenation joins those
channels in head order; the attention output projection transforms the joined vector;
residual addition uses saved embeddingNorm, before preAttentionNorm. They are visibly
different operations with real operands. Weights alone establish neither causal word
importance nor learned specialization. No dimension receives an invented semantic meaning.

Chapter 4 follows actual preMlpNorm → 8-to-32 expansion → componentwise ReLU →
32-to-8 contraction → addition to saved attentionResidual → no-bias lm_head logits →
vocabulary softmax. Canonical RMSNorm/epsilon/ReLU/residual assumptions are explicitly
local to this model. Each operation has its own purpose/example; expandable complete
projection operands and all ReLU components supply depth. Optional Math/Source retain
native mechanisms and normalization boundaries.

Every actual output index has a raw signed score. All four original probabilities,
full stable denominator, original-value access and omitted mass zero remain. The shared
marker is START as input at p0 and END as possible output. A comparison table separates
attention's eligible-position support from output's next-token support. Recap returns
to the original chapter 1 distribution: known target a, highest-probability ranking,
no sampling, no rerun or training improvement. The explicitly labeled **Start learning
computation · propose one update** begins the existing paced learning workflow;
candidate acceptance/discard remains a separate explicit decision. Edited input or a retained prediction from a different current accepted state disables the handoff with an explicit refusal; the controller also rejects an attempted stale handoff before any runtime effect. Restore the recorded input or explicitly Predict to establish current evidence.

Optional checks give explanatory feedback about eligibility, mixing, importance,
normalization and sampling; clicks establish no comprehension. Values/Math/Source,
Explore/Resume and workbench/Classic return preserve run/occurrence. Temporary detail
selection remains render-only. Camera activity and initiating focus are preserved.
Active computation and unresolved candidate controls refuse activity switching.

## Validation ownership and environment

[Writer audit](../../test-results/scratch/release-forward-6i25ccmq/writer-audit.md)
and [core writer inventory](../../test-results/scratch/release-forward-6i25ccmq/core-writers.txt)
record hooks, nested test writers, fresh T10 allocation, ordinary runner/log/child
cleanup, browser reporters/custom evidence and Vite outDir handling. Browser/HTTP
use repaired npm entrypoints with fresh owned scratch builds and `--emptyOutDir false`.
Existing dist and historical evidence are never build/cleanup targets.

[Refreshed environment](../../test-results/scratch/release-forward-6i25ccmq/environment-final.json):
Node v24.21.0, TypeScript 7.0.2, Vite 8.2.2, Playwright 1.63.0, darwin-arm64.
Expected Chromium 1243 remains absent. The documented scratch-only
[launch adapter](../../test-results/scratch/release-forward-6i25ccmq/installed-browser.mjs)
was byte-copied from the introduction method, using installed headless shell 1234 /
Chrome for Testing 151.0.7922.34. This actual pairing limits qualification. No
installation, download, revision alias or setting change. Permitted localhost runs
use the same audited commands/output protection.

## Executed checks

| Command / scope | Result / evidence |
| --- | --- |
| `TSX_DISABLE_CACHE=1 node --import tsx --test tests/app/release-learning.test.ts` | 3/3 authentic-run cases passed before layout iterations. Full delivery core reruns include these cases. |
| `TSX_DISABLE_CACHE=1 node --import tsx --test tests/app/release-learning.test.ts tests/app/public-lesson-controller.test.ts tests/app/public-guided-computation.test.ts tests/app/public-depth.test.ts tests/app/public-tour.test.ts tests/app/public-training-depth.test.ts tests/integration/canonical-receipt.test.ts` | 86/86 passed; [log](../../test-results/scratch/release-forward-6i25ccmq/focused-core.log). This preceded final CSS-only refinements; delivery core re-exercises the same cases. |
| `TSX_DISABLE_CACHE=1 PYTHONDONTWRITEBYTECODE=1 npm test` | Before final handoff guard: 376 passed / 12 prerequisite skips, 388 selected, zero failures; [log](../../test-results/scratch/release-forward-6i25ccmq/core-delivery.log). Initial sandbox run stopped three local-server checks with EPERM; [original log](../../test-results/scratch/release-forward-6i25ccmq/core.log) is retained. Permitted runs use the same checks. Skips are missing native/generation/fixture/train-many inputs, not passes. |
| `PYTHONDONTWRITEBYTECODE=1 npm run test:reference` | 17 Python tests passed; exact structure/identity and strict portable numerical conformance, zero differing floats; [log](../../test-results/scratch/release-forward-6i25ccmq/reference.log). Oracle/fixtures/mechanism bytes unchanged. Canonical-environment byte regeneration NOT_RUN. |
| `TSX_DISABLE_CACHE=1 npm run example` | Delivery source passed; [log](../../test-results/scratch/release-forward-6i25ccmq/example-delivery.log). Authentic p3 target probability 0.3591443770854818 → 0.4070454916035887 after one explicit update, 896 parameters. This command is an example, not explanation navigation. |
| `./node_modules/.bin/tsc --noEmit`; npm typecheck/prehook and owned Vite builds | Passed; browser/HTTP allocations retain typecheck/build logs. Existing large-chunk advisory remains. No build targeted checkout dist. |
| `npm run test:browser -- tests/browser/release-learning-forward.spec.ts tests/browser/release-learning.spec.ts tests/browser/shared-context-navigation.spec.ts tests/browser/canonical-workflow.spec.ts tests/browser/guided-lifecycle-repair.spec.ts --workers=2`, scratch adapter | 31/31 passed on runtime 9573362d… before final CSS-only reservation/label refinement; [report](../../test-results/scratch/browser-c3uPp1/report/results.json). Delivery broad run re-exercises these controls. |
| `npm run test:browser -- tests/browser/release-learning-forward.spec.ts tests/browser/release-learning.spec.ts --workers=2`, scratch adapter | Before final handoff guard: 11/11 passed, zero skips/flaky; [report](../../test-results/scratch/browser-DHZjcK/report/results.json), [source/argv](../../test-results/scratch/browser-DHZjcK/source.json), [log](../../test-results/scratch/browser-DHZjcK/playwright.log). Covers all chapter states, feedback, depth, Explore/Resume, Classic return, no extra navigation execution, active-work/candidate refusals and explicit discard. |
| `npm run test:http`, scratch adapter | Before final handoff guard: 1/1 passed; [report](../../test-results/scratch/http-OTYggA/report/results.json), [source/argv](../../test-results/scratch/http-OTYggA/source.json). Actual insecure non-loopback HTTP workflow; no throughput claim. |

Intermediate browser records remain: browser-X2HkLP caught the overflowing mobile
action and a wrong Part 2 test button; browser-k1HuHv caught test waits targeting
paced training states with an explanation-only budget. Its failure context was
written while the new test was being split, so its displayed source lines are not
a stable delivery test snapshot. Neither intermediate run is qualification. The
final route retains 30-second explanation limits; a separate new native-paced
candidate control has a scoped 90-second budget and waits on acknowledged semantic
states. No existing timeout, skip, numerical assertion or geometry invariant changed.

## Rendered and interaction evidence

Final captures and direct image inspection at **1920×1080 normal motion**,
**1280×720 reduced motion**, and **390×844 reduced motion** cover Q/K/V, eligible
positions, all Q/K products/scaling, attention weights, weighted Values, head joining
and saved residual, MLP/residual, logits, output probabilities and recap. Long content
scrolls within the dock. Mobile arithmetic tables expose every column through labeled
keyboard-accessible horizontal scrolling; all terms and complete reductions remain.
No entire architecture-fit requirement is imposed on phones.

| Size / final capture directory | Inspected states / representative artifacts |
| --- | --- |
| [Desktop](../../test-results/scratch/browser-DHZjcK/evidence/test-63uqEZ/) | [Q/K/V](../../test-results/scratch/browser-DHZjcK/evidence/test-63uqEZ/qkv.png), [causal dot/scaling](../../test-results/scratch/browser-DHZjcK/evidence/test-63uqEZ/score-complete.png), [position weights](../../test-results/scratch/browser-DHZjcK/evidence/test-63uqEZ/attention-weights-numbers.png), [all Value contributors](../../test-results/scratch/browser-DHZjcK/evidence/test-63uqEZ/weighted-values-numbers.png), [head/residual source](../../test-results/scratch/browser-DHZjcK/evidence/test-63uqEZ/residual-source.png), [MLP residual](../../test-results/scratch/browser-DHZjcK/evidence/test-63uqEZ/mlp-residual.png), logits, output and endpoint. |
| [Compact / reduced motion](../../test-results/scratch/browser-DHZjcK/evidence/test-PFjU9V/) | Same nine forward states directly inspected, including [weights](../../test-results/scratch/browser-DHZjcK/evidence/test-PFjU9V/attention-weights-numbers.png), [logits](../../test-results/scratch/browser-DHZjcK/evidence/test-PFjU9V/logits-numbers.png), [output](../../test-results/scratch/browser-DHZjcK/evidence/test-PFjU9V/output-numbers.png) and endpoint/handoff. Reserved evidence-button area remains below the dock. |
| [Mobile / reduced motion](../../test-results/scratch/browser-DHZjcK/evidence/test-teCoAX/) | Separate complete [Query](../../test-results/scratch/browser-DHZjcK/evidence/test-teCoAX/qkv-q.png), Key and Value cards; causal comparison and [horizontal products](../../test-results/scratch/browser-DHZjcK/evidence/test-teCoAX/score-products-horizontal.png); weight/Value tables, residual sources, [MLP](../../test-results/scratch/browser-DHZjcK/evidence/test-teCoAX/mlp-residual.png), [all logits](../../test-results/scratch/browser-DHZjcK/evidence/test-teCoAX/logits-numbers.png), output and handoff. Viewport captures show scrolling windows, not omitted evidence or a renormalized subset. |

Each directory also retains Values/Math/Source, Explore and audit JSON captures.
Initial visual inspection found inherited flex compression of tables, mobile action
overflow, letter-stacked table labels and compact evidence-button overlay. Final
styles use normal-flow lesson content, wrapped mobile actions, unbroken table labels
and a reserved bottom region. Regression assertions check every pinned action's
viewport bounds and 44px height, dock/evidence separation, unchanged original output
values, focus returns and identical Worker command arrays through navigation.
Original geometry/source/visibility assertions remain. This is engineering/visual
inspection, not an accessibility certification or comprehension study.

The first broad attempt on runtime 997630c4… was deliberately interrupted when
source inspection found that an edited input could silently change the learning
handoff example. [Partial report](../../test-results/scratch/browser-E4cAMQ/report/results.json)
and [interruption receipt](../../test-results/scratch/browser-E4cAMQ/interruption.json)
retain 59 passes, 11 failures, two interrupted tests, 13 skips and 107 NOT_RUN.
It is not a complete baseline; the interrupted forward/cancel and touch-target
cases are not product failures or passes. The audited wrapper recorded SIGINT and
zero cleanup errors. The final baseline uses the corrected source.

## Corrected delivery-source checks

The final handoff fix was verified by `TSX_DISABLE_CACHE=1 node --import tsx --test
tests/app/release-learning.test.ts` (3/3) and `./node_modules/.bin/tsc --noEmit`.
`TSX_DISABLE_CACHE=1 PYTHONDONTWRITEBYTECODE=1 npm test` passed **376 / 12 prerequisite
skips**, 388 selected, zero failures, on runtime 8e67767e…;
[final log](../../test-results/scratch/release-forward-6i25ccmq/core-handoff-final.log).
The full focused npm browser command listed above passed **31/31**, zero skips/flaky,
on the same source; [final report](../../test-results/scratch/browser-G4MbdX/report/results.json),
[source/argv](../../test-results/scratch/browser-G4MbdX/source.json),
[log](../../test-results/scratch/browser-G4MbdX/playwright.log). These final tests
assert both the disabled stale action and controller refusal, unchanged command
arrays, restoration by returning to abca, and explicit provisional-candidate discard.

The final-source [desktop](../../test-results/scratch/browser-G4MbdX/evidence/test-AxVz0u/),
[compact](../../test-results/scratch/browser-G4MbdX/evidence/test-6uP8qC/) and
[mobile](../../test-results/scratch/browser-G4MbdX/evidence/test-hR9O7a/) capture sets
retain the same states and sizes. The earlier final-layout captures in the visual
matrix remain separately identified on runtime 997630c4…; their numerical/layout
source bytes did not change with the handoff guard, but they are not relabeled as
new-runtime evidence. Corrected-source 390×844 score/scaling, output table, recap and Source-header captures were also inspected; the final browser assertions recheck all states at all three sizes.

Corrected-source `npm run test:http` with the same scratch adapter passed **1/1**,
zero skips/flaky; [final HTTP report](../../test-results/scratch/http-NywmEP/report/results.json),
[source/argv](../../test-results/scratch/http-NywmEP/source.json),
[log](../../test-results/scratch/http-NywmEP/playwright.log). Its typecheck and owned
Vite build also passed on the delivery runtime.

## Complete final browser baseline

`NODE_OPTIONS="--import=<owned scratch>/installed-browser.mjs" npm run test:browser
-- --workers=2` completed on delivery runtime 8e67767e…: **162 passed / 16 failed /
14 skipped**, zero flaky, **192 selected**, **1,170.391776 seconds** (19.5 minutes).
[Full report](../../test-results/scratch/browser-TLU09e/report/results.json),
[source/argv](../../test-results/scratch/browser-TLU09e/source.json),
[stage log](../../test-results/scratch/browser-TLU09e/playwright.log),
[failure receipt](../../test-results/scratch/browser-TLU09e/failure.json). The unsuccessful
suite exit and zero cleanup errors are retained; this is not full-suite success.

[Exact identity comparison](../../test-results/scratch/release-forward-6i25ccmq/browser-baseline-comparison.json)
compares every prior identity with the 158/16/14, 188-selected introduction baseline.
**No missing prior identity, no outcome change, no error-stack stopping-boundary
change.** All four new identities pass. There are no newly reached downstream
failures; assertions after each retained failure stop remain NOT_RUN. The
[additive triage](browser-failure-triage.md#2026-10-02-release-learning-forward-tour-disposition)
retains all 16 failures and 14 skips individually with exact test and boundary.

BF-006 still fails >400 versus 302.1175231933594 at end-to-end-fixes:41:122. BF-039
retains spatial-wave1b:60:137's visibility/overflow stop, and BF-040 retains
spatial-wave1d:20:916's overflow stop; its later learning checks remain unrun. The
other 13 failures retain their exact boundaries, including missing native/fixture
inputs. Passing M4-E's parent does not exercise its unavailable optional native and
near-limit branches. The final baseline freshly re-executes preserved default,
Classic, spatial, kiosk/facilitator, autoplay, source, state, canonical and learning
controls; historical passes are not transferred to this candidate.

## Final incremental preservation

[Incremental manifest](../../test-results/scratch/release-forward-6i25ccmq/incremental-changes.json)
and [patch](../../test-results/scratch/release-forward-6i25ccmq/incremental.patch) compare
with captured starting working bytes. [Final preservation receipt](../../test-results/scratch/release-forward-6i25ccmq/preservation-final.json)
checks all 43,817 starting evidence/dist files, incoming source outside the authorized
slice, native/oracle/fixture/dependency bytes, generated identity, branch/HEAD/staging
and additive roadmap/triage prefixes. All protected output bytes match. `.DS_Store`,
merge plan, previous reports and unowned source remain exact. The generated revision
contains the delivery runtime; its incoming bytes remain in the starting copy.
[Link/anchor and whitespace checks](../../test-results/scratch/release-forward-6i25ccmq/document-checks.json)
cover changed/new documents and the complete incremental scope, including untracked
files. Hash equality is preservation/source identity, not an extra test pass.

## Qualification and stop boundary

Missing native Pythia/MLP, grouped-axis numerical, shape-only/opaque, generation,
offline/shutdown, supplied train-many and heterogeneous near-limit witnesses remain
separate qualification gaps. Canonical and noncanonical local controls do not replace
them. Canonical-environment byte regeneration, aggregate acceptance, isolation install,
independent M5, unfamiliar-user comprehension testing, workshop/station and release
qualification are NOT_RUN. No learning gains are claimed.

Native arithmetic, independent oracle, fixtures/goldens, tolerances, optimizer policy,
recording format, archive policy, dependencies, backends/models, experiments, remaining
curriculum, default routes and release packaging are unchanged. No staging/commits,
branch switch/reset, install/download, other-repository/settings changes, push,
publication or deployment. Stop after the implemented forward-tour slice and its
verification package.
