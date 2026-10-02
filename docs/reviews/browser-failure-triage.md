# Browser failure and prerequisite disposition

This is working-source diagnosis, not exact-candidate, foundation, M5 or release
acceptance. Browser assertions and production code were not changed. Every retained
unexpected test and prerequisite-dependent skip receives an individual disposition;
classification concerns its observed failure boundary, not its unexecuted downstream
assertions. A test stopped at Teach proves none of its later source/layout checks.

## Identity, commands and evidence ownership

Branch `pre-m5-abq-experience`, HEAD
`ffb2db9217dac8ff3195fc2943918656daa78b59`, dirty source, application runtime
`sha256:cb0ff18267668a33b2a6f97fa7ca1d96a4dc7d5103ceafeda9bf2f9d6c847c98`.
The [lifecycle report](runner-lifecycle-closure.md) records the starting snapshot,
regressions and incremental ownership. Existing evidence and dist were inventoried
before running checks. Source receipts retain actual argv, git tree/dirty status and
runtime; the committed tree is not the dirty working-source identity.

The prior [101 passed / 46 failed / 14 skipped report](../../test-results/scratch/browser-BfHAgU/report/results.json)
and [prior failure/skip index](../../test-results/scratch/release-review-5KboIi/broad-browser-failures-skips.json)
remain unchanged. Their runtime is the intermediate
`sha256:895115e323088b734ddff1f17759ab5c67012c965c1e078dd23d804349957188`;
no old pass is transferred to this source.

Before execution, the writer audit traced npm scripts/hooks, `run-browser.mjs`, both
ordinary configs, ordinary/slice/test output allocators, browser evidence/handoff
helpers, all browser/HTTP writers, installed Playwright cleanup/reporter code and
Vite outDir handling. The [current search inventory](../../test-results/scratch/lifecycle-review-qhhkhxy7/writer-audit.txt)
complements the [prior complete inventory](../../test-results/scratch/release-review-5KboIi/custom-writer-inventory.json).
The same closure remains: generated `runtime/revision.ts` only from the typecheck
prehook; fresh owned build, runner/report/cache/temp/npm directories; durable evidence
and per-attempt handoffs outside runner cleanup; old replay inputs read-only.
No default build, raw Playwright bypass, historical rehearsal, native producer,
installation or download was run. Top-level npm host diagnostics are outside project
evidence ownership. Server ports are unchanged, existing servers are not adopted.

The sandbox EPERM attempt and an intentionally interrupted pre-final-helper attempt
are retained separately. Only their owned wrapper PID was signalled using its invocation
receipt. The completed broad run uses the finalized helper. Owned builds retain the
existing Vite large-chunk advisory; it does not constitute a browser pass or failure.

## What the count failures actually establish

The [concurrent lifecycle observations](../../test-results/scratch/lifecycle-review-qhhkhxy7/concurrent-probe/observations.json)
observe commands/replies in independent browser contexts against the broad run's
owned preview. They add diagnostic browser load for this interval, which is recorded
rather than treated as an uncontaminated throughput benchmark. No production state
or failing assertion was modified. Screenshots and the observer source are retained.

- Teach at 5.132 seconds: count and live step 8, input disabled, teaching progress
  active. Later: count and live step 10, input enabled, phase TEACH COMPLETE; the
  tenth worker result and its run identity were observed. The batch continued after
  the assertion window. This is a timing/performance boundary, not demonstrated
  early termination or accepted-state loss.
- Explicit cancellation at count 2: restore request, terminal Cancelled status,
  count/live step 2 and matching completed after-run. This ordinary cancellation
  control does not prove the separate held-accepted-reply race in visual-guided.
- A 500-update request: continued past five seconds, then stopped before update 30
  at the manifest-node reservation limit (1,016,764 proposed / 1,000,000 allowed),
  with step 29, 29 summaries and an explicit retention-capacity alert. There was no
  worker request for update 30. This is resource refusal, not optimizer exhaustion,
  cancellation or erasure of earlier accepted updates. The test cannot reach 995
  under this retained-history policy.

Archive fork/measurement/admission work grows with retained evidence; source
`execute` awaits those operations between updates. The probes do not allocate all
elapsed time to one function, prove a universal performance threshold, or establish
that every visual test would pass once Teach completes. Serial/concurrent focused
reproduction and the individual records determine remaining coverage.

## Concrete defects and contract mismatches

The shared canonical inspector remains “Executing selected producer…” after 20 seconds
even without fault injection, while the canonical status says prediction complete
and the selected shared run becomes empty. See [unfaulted observations](../../test-results/scratch/lifecycle-review-qhhkhxy7/shared-normal/observations.json)
and [original fault observations](../../test-results/scratch/lifecycle-review-qhhkhxy7/shared-concurrent/observations.json).
`SharedInspector.sync` invalidates `#operation` when a published archive replaces its
EvidenceStore; pending `execute` then ignores completion and its `finally` cannot
clear busy state. The canonical binding also captured the old store before publication.
This is a production lifecycle defect. Separately, the budget fault matches a whole
JSON object containing `runs`; portable manifests use `directRuns`, so the old injection
does not produce the intended pre-execution refusal. Both need separate repairs.

Combined heads maps to `forwardSequence`, which now delegates to
`forwardSequenceForDefinition`; the displayed wrapper omits `combinedHeads.push`.
The real arithmetic still exists. This is a source-navigation production defect,
not permission to remove the readable native arithmetic assertion.

Workbench Clear Session leaves `attract=true`; a subsequent workbench Predict does
not clear it, while the research-button branch requires `!attract`. The reset/late-data
route waits on its second missing experiment button. Its snapshot shows completed
live workbench prediction. The [unfaulted reset control](../../test-results/scratch/lifecycle-review-qhhkhxy7/reset-probe.json) also shows all three research buttons present before Clear and absent after fresh Predict. Repair entry/state ownership and then prove the withheld
late-reply semantics, rather than dropping the scenario.

Legacy ABQ public entry/explanation/short-guide/step controls conflict with the
current profile-driven tour surfaces. Whole-capture contexts explicitly report a
bounded derived-cache refusal. The three-update summary changed its wording while
retaining the actual count. These are scoped test-contract mismatches with still
unverified downstream behavior, not harmless passes. Fixed geometry/overflow checks
and the accepted-after-paint cancellation race remain unresolved until their specific
invariants and receipt timelines are established.

## Missing prerequisite coverage

Four retained explicit native-input failures and the delayed-native navigation
failure have absent endpoint/recording inputs. The delayed case calls `page.route`
with an undefined pattern and holds its intercepted navigation waiting for release;
it does not demonstrate that a real native reply was mishandled. Preflight is a
harness repair scope, alongside qualified missing witnesses.

The skipped identities require, as individually listed in the machine records:
MLP/Pythia live endpoints; explicit offline phase with owned live handoff/saved-response
pairs and verified bridge shutdown; grouped/shape-only/opaque recordings; matched
MLP/Pythia cross-world replays; native generation recording; and near-limit archives.
They were not downloaded, synthesized, supplied from unrelated historical paths, or
replaced by canonical-only checks. Passing M4-E ordinary fallback routes does not
supply every absent archive/native branch or requalify the heterogeneous portfolio.

## Complete individual disposition

The [machine-readable browser dispositions](../../test-results/scratch/lifecycle-review-qhhkhxy7/browser-dispositions.json) records identity, prior/current
status and complete errors, candidate/runtime/source receipt, annotations, retained
error contexts/attachments/custom evidence, exact serial reproduction command,
intended behavior, classification, supporting source/probe evidence, prerequisites,
and next repair scope. The table below is its navigation index; full errors and
reproduction commands live in the linked record rather than being truncated into
a claim of root cause.

| ID | Test identity | Retained → current | Classification | Next scope |
| --- | --- | --- | --- | --- |
| BF-001 | `abq-overnight.spec.ts:13` — Q01/Q03 entry and source-bound chain 1280 | unexpected → unexpected | outdated test contract | public scope above / machine record |
| BF-002 | `abq-overnight.spec.ts:13` — Q01/Q03 entry and source-bound chain 1920 | unexpected → unexpected | outdated test contract | public scope above / machine record |
| BF-003 | `abq-overnight.spec.ts:26` — Q02 complete public reset across completed, forward, partial, Ready, historical and intervention | unexpected → unexpected | outdated test contract | public scope above / machine record |
| BF-004 | `abq-overnight.spec.ts:45` — Q04/Q05 short route detour, keyboard, reduced motion and source invalidation | unexpected → unexpected | outdated test contract | public scope above / machine record |
| BF-005 | `abq-overnight.spec.ts:51` — Q08 test-only serialized-estimate fixture refuses new work visibly and Clear recovers | unexpected → unexpected | outdated test contract | public scope above / machine record |
| BF-006 | `end-to-end-fixes.spec.ts:21` — five corrections: public same-session route, scalar arms, compact Ready and prediction meaning | unexpected → unexpected | unresolved | layout scope above / machine record |
| BF-007 | `exhibit-v2.spec.ts:44` — browser measures max-context live scalar rendering and worker responsiveness | unexpected → unexpected | outdated test contract | budget scope above / machine record |
| BF-008 | `exhibit-v2.spec.ts:95` — measured session budget stops new capture without deleting retained history | unexpected → unexpected | outdated test contract | budget scope above / machine record |
| BF-009 | `guided-v2.1.spec.ts:17` — fresh Guided predicts, teaches ten real updates, reveals measured change, then opens authentic depth | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-010 | `guided-v2.1.spec.ts:55` — repeat Teach uses current model; edits and reset preserve explicitly earlier comparisons | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-011 | `guided-v2.1.spec.ts:107` — Guided narrow touch lesson has no overflow and retains progressive disclosure | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-012 | `guided-v2.1.spec.ts:131` — optimizer exhaustion retains the last completed partial lesson for later comparison drilldown | unexpected → unexpected | outdated test contract | schedule scope above / machine record |
| BF-013 | `guided-v2.1.spec.ts:188` — Guided depth navigation rebinds attention arithmetic and clamps the selected key | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-014 | `guided-v2.1.spec.ts:211` — probability state stays local when inspection selects a pre-update run at 1280px | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-015 | `guided-v2.1.spec.ts:211` — probability state stays local when inspection selects a pre-update run at 1920px | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-016 | `guided-v2.1.spec.ts:211` — probability state stays local when inspection selects a pre-update run at 390px | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-017 | `m1-witnesses.spec.ts:5` — live MLP prediction and SGD, then noncanonical multilayer selection in the same inspector | unexpected → unexpected | missing prerequisite | native scope above / machine record |
| BF-018 | `m1-witnesses.spec.ts:41` — new models reopen after native shutdown without executors and refuse uncaptured actions | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-019 | `m1-witnesses.spec.ts:59` — structural and opaque imports show truthful fallback and no invented numerical display | unexpected → unexpected | missing prerequisite | native scope above / machine record |
| BF-020 | `m2-b-mlp-world.spec.ts:6` — M2-B live MLP prediction and SGD inhabit the shared continuous world without transformer state | unexpected → unexpected | missing prerequisite | native scope above / machine record |
| BF-021 | `m2-b-mlp-world.spec.ts:35` — M2-B saved MLP evidence reopens in the world with the native executor disconnected | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-022 | `m2-c-evidence-fallback.spec.ts:11` — M2-C grouped axes, shape-only and opaque evidence inhabit one truthful bounded world | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-023 | `m2-c-evidence-fallback.spec.ts:39` — M2-C saved fixture replay is executor-free and switching to MicroGPT clears fallback state | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-024 | `m2-d-pythia-world.spec.ts:12` — M2-D live native Pythia inhabits the shared world with truthful selected-layer coverage | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-025 | `m2-d-pythia-world.spec.ts:37` — M2-D saved Pythia world replays after verified bridge shutdown with zero native requests | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-026 | `m2-e-integration.spec.ts:15` — M2-E cross-world switching preserves canonical state and keeps replay inert | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-027 | `m3-d-integration.spec.ts:126` — M3-D reset cancels data work and rejects late completion without publishing a receipt | unexpected → unexpected | production defect | data scope above / machine record |
| BF-028 | `m4-a-pythia-generation.spec.ts:9` — M4-A live Predict and bounded uncached Generate retain separate native occurrences | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-029 | `m4-a-pythia-generation.spec.ts:24` — M4-A retained generation replays with zero native requests after bridge shutdown | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-030 | `m4-b1-payload.spec.ts:7` — M4-B1 retained generation uses payload-backed bounded inspection with no executor | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-031 | `m4-b2-portable-archive.spec.ts:6` — M4-B2 mixed historical archive exports, imports inertly, and survives a tampered replacement attempt | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-032 | `m4-c1-retention.spec.ts:6` — M4-C1 near-limit history stays inspectable while native work refuses before transport and Clear Session restores capacity | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-033 | `m4-c2-render-work.spec.ts:7` — M4-C2 retained navigation stays bounded and truthful without execution | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-034 | `model-lab-v2.spec.ts:92` — bounded training retains real checkpoints and complete capture displays statistics | unexpected → unexpected | outdated test contract | budget scope above / machine record |
| BF-035 | `shared-repairs.spec.ts:13` — shared canonical receipt refuses budget refusal after a successful run | unexpected → unexpected | production defect | shared scope above / machine record |
| BF-036 | `shared-slice.spec.ts:4` — two real producers share admission, inspection, sources and saved evidence | unexpected → unexpected | missing prerequisite | native scope above / machine record |
| BF-037 | `shared-slice.spec.ts:44` — saved native evidence replays after shutdown and canonical operation requires no Python endpoint | skipped → skipped | missing prerequisite | native scope above / machine record |
| BF-038 | `shared-slice.spec.ts:58` — a real native reply delayed past a model switch cannot enter retained evidence | unexpected → unexpected | missing prerequisite | native scope above / machine record |
| BF-039 | `spatial-wave1b.spec.ts:5` — B01–B09 complete source-bound forward route and contextual exploration over real HTTP | unexpected → unexpected | unresolved | layout scope above / machine record |
| BF-040 | `spatial-wave1d.spec.ts:4` — D01–D05 source-bound explanations, interruption and static arithmetic | unexpected → unexpected | unresolved | layout scope above / machine record |
| BF-041 | `state-binding.spec.ts:133` — STATE-HISTORY-001: selected source step remains separate from live model step and promotion clears inspection | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-042 | `truth-v2.1.spec.ts:38` — forward and training paths are separate and Combined heads and gradients expose real source | unexpected → unexpected | production defect | source scope above / machine record |
| BF-043 | `visual-attention.spec.ts:7` — Attention source-bound scopes and fixed anchors at 1280 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-044 | `visual-attention.spec.ts:7` — Attention source-bound scopes and fixed anchors at 1920 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-045 | `visual-exhibit.spec.ts:27` — idle warning uses real timer state and resets to retained replay at 1280 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-046 | `visual-exhibit.spec.ts:27` — idle warning uses real timer state and resets to retained replay at 1920 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-047 | `visual-exhibit.spec.ts:27` — idle warning uses real timer state and resets to retained replay at 390 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-048 | `visual-guided.spec.ts:7` — Guided replay, activation, ten accepted updates and Reset at 1280 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-049 | `visual-guided.spec.ts:7` — Guided replay, activation, ten accepted updates and Reset at 1920 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-050 | `visual-guided.spec.ts:256` — tenth accepted update publishes its count, source and endpoint atomically during archive admission | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-051 | `visual-guided.spec.ts:339` — cancellation retains a result accepted after the last painted count but before client restoration | unexpected → unexpected | unresolved | cancel scope above / machine record |
| BF-052 | `visual-history.spec.ts:4` — history, comparison and intervention retain one instrument at 1280 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-053 | `visual-history.spec.ts:4` — history, comparison and intervention retain one instrument at 1920 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-054 | `visual-learning.spec.ts:121` — historical A6 graph verification and A7 optimizer binding at 1280 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-055 | `visual-learning.spec.ts:121` — historical A6 graph verification and A7 optimizer binding at 1920 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-056 | `visual-microscope.spec.ts:69` — A5 historical scalar verification remains separate from its observed source matrix at 1280 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-057 | `visual-microscope.spec.ts:69` — A5 historical scalar verification remains separate from its observed source matrix at 1920 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-058 | `visual-regression.spec.ts:15` — semantic visual regression and release frames at 1280 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-059 | `visual-regression.spec.ts:15` — semantic visual regression and release frames at 1920 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |
| BF-060 | `visual-regression.spec.ts:15` — semantic visual regression and release frames at 390 | unexpected → unexpected | timing/performance issue | timing scope above / machine record |

| CG-01 | `m4-e-integrated-browser.spec.ts:94` — Route B retained Pythia archive | Conditional branch not executed | missing prerequisite | Qualified mixed archive input; distinct from the parent test pass. |
| CG-02 | `m4-e-integrated-browser.spec.ts:134` — Route C near-limit pretransport refusal | Conditional branch not executed | missing prerequisite | Qualified near-limit archive input; distinct from the parent test pass. |


## Executed results and serial/concurrent comparison

| Check | Result / retained evidence |
| --- | --- |
| `npm run test:browser -- --workers=2` | **101 passed, 46 failed, 14 skipped**, zero flaky, 161 selected, 19.8 minutes. [Report](../../test-results/scratch/browser-UGVMjn/report/results.json), [source/argv](../../test-results/scratch/browser-UGVMjn/source.json), [failure/cleanup receipt](../../test-results/scratch/browser-UGVMjn/failure.json), [console](../../test-results/scratch/lifecycle-review-qhhkhxy7/broad-final-console.log). |
| `npm run test:browser -- <focused files and grep> --workers=1` | **4 passed, 12 failed**, no skips/flaky, 16 selected, 116.3 seconds. [Report](../../test-results/scratch/browser-NOOJ7s/report/results.json), [exact source/argv](../../test-results/scratch/browser-NOOJ7s/source.json), [console](../../test-results/scratch/lifecycle-review-qhhkhxy7/focused-serial-console.log). |
| Identical focused selection with `--workers=2` | **4 passed, 12 failed**, no skips/flaky, same 16 identities, 74.6 seconds. [Report](../../test-results/scratch/browser-8xpvxT/report/results.json), [exact source/argv](../../test-results/scratch/browser-8xpvxT/source.json), [console](../../test-results/scratch/lifecycle-review-qhhkhxy7/focused-concurrent-console.log). |
| `npm run test:http` on final helper | **1/1 passed**, no skips/failures. [Report](../../test-results/scratch/http-CIqjeu/report/results.json), [source/argv](../../test-results/scratch/http-CIqjeu/source.json), [console](../../test-results/scratch/lifecycle-review-qhhkhxy7/http-final-console.log). |
| Focused tooling safety and direct typecheck | **24/24 passed** and `tsc --noEmit` passed; see [lifecycle closure](runner-lifecycle-closure.md). Both npm profiles' typecheck/owned build stages also passed. |

The [focused selection](../../test-results/scratch/lifecycle-review-qhhkhxy7/focused-plan.json)
includes early Teach/held admission, the held-reply cancellation race, native-input
preflight, shared canonical receipt, source navigation, summary wording, whole capture,
legacy entry and geometry/overflow, alongside two authentic arithmetic/mobile and
two intervention controls. These are 16 distinct cases repeated twice, not 32 distinct
proofs. The [per-test comparison](../../test-results/scratch/lifecycle-review-qhhkhxy7/focused-comparison.json)
contains exact errors and zero outcome differences. Serial Teach still sees count 7
at its five-second assertion. Two workers reduce aggregate wall time but do not remove
these failures; concurrency alone does not explain the baseline. Neither focused run
had the additional progress probes running alongside it. This is a bounded diagnostic
comparison, not a general throughput/performance qualification.

Among the **46 unexpected tests**, the observed-boundary dispositions are: 25
timing/performance (19 explicit ten-count assertions plus six early enabled/held-count
boundaries), 9 outdated contracts, 5 missing prerequisites including the undefined-route
harness case, 3 production defects, and 4 unresolved geometry/cancellation cases.
The 14 reported skips are separate missing prerequisite/phase coverage. CG-01/02
are additional silently unexecuted branches, not extra tests or reported skips.
Representative timing evidence is not a root-cause proof for every unexecuted downstream
assertion. These categories are repair scopes, never retrospective passes.

[Validation summary](../../test-results/scratch/lifecycle-review-qhhkhxy7/validation.json),
[environment/prerequisite coverage](../../test-results/scratch/lifecycle-review-qhhkhxy7/environment-coverage.json),
and [final preservation](../../test-results/scratch/lifecycle-review-qhhkhxy7/preservation-final.json)
retain checks, absent coverage and source/output ownership. All 7,642 prior protected
files remain byte-identical; the runtime hash remains unchanged and staging is empty.

## Qualification limits and next scope

All failures block a full-suite pass; none was converted to a skip or suppressed.
No blanket timeout increase or production repair is included. Reference, aggregate
unit/example/acceptance, isolation/install, native live/offline witness matrix,
Windows/process-tree portability, clean exact-candidate, independent M5, unfamiliar
users, workshop/station and release qualification are unrun. Appropriate tooling
safety/type checks, owned builds, HTTP, broad diagnosis and focused reproduction
are engineering evidence only. Stop after this bounded tooling/triage delivery.

## Addendum: bounded Guided lifecycle repair

The original diagnostic identity, commands, 46 failures/14 skips and individual
classifications above are preserved. The subsequent
[Guided lifecycle repair](guided-training-lifecycle-repair.md) records incremental
starting source, root causes, new controls, final runtime
`sha256:7ee8d4cbfb9513e1da264d4185643d4a2fc6f354724eecd1d03762f8601c7db6`,
exact commands, timings, failures and preservation. This adds current dispositions;
it does not retroactively pass the old reports or grant M5/release acceptance.

| Original identity | New bounded disposition |
| --- | --- |
| BF-009–BF-011, BF-013–BF-016 | Current Guided cases pass on final runtime, including fresh/repeated teaching, compact viewport, depth and local probability state. Count failures were slow completion dominated by repeatedly validating retained immutable history during archive fork. New admissions and hard budgets remain validated and unchanged. |
| BF-012 | Current exhaustion regression passes from an authentic native-produced complete step-995 snapshot restored after initial Attract. Original retain-995 browser setup would hit legitimate capacity first and remains an outdated-contract diagnosis. All original five-update terminal/exhaustion/numerical/history assertions remain. |
| BF-041 | Current state/history regression passes; source step stays separate from accepted live step and promotion clears inspection. |
| BF-048–BF-050 | Both desktop ten-count routes and held tenth-admission atomic publication pass in final serial and two-worker focused checks. Held digest still intercepts actual new-record admission after the tenth acknowledged result. |
| BF-051 | Original test withheld the third result **before** acknowledgement. Correct outcome is restoration to step two and old-epoch reply rejection. The current control delays the actual restore acknowledgement rather than relying on a digest absent for an already-retained snapshot; it passes serially and concurrently with exact step-two values/source. A separate authentic handler-then-synchronous-Cancel control reproduced and repaired the real acknowledged-step-three/displayed-step-two defect. Additional controls cover cancellation after repeated teaching and accepted cancellation with archive failure. |
| Other BF identities and CG-01/CG-02 | No disposition transferred. Full broad suite and unavailable native/mixed-archive branches remain unrun in this repair; unrelated confirmed defects remain outside its authorization. |

The broader final engineering selection retains **35 passed / 1 failed**: its stale
restoration digest predicate is explicitly retained as a failed test-instrumentation
attempt. The corrected identical focused ten-case selection passes **10/10** with
one worker and **10/10** with two. Core checks pass **145**, with **5** missing-input
skips; independent portable Python reference passes; final HTTP passes **1/1**.
See the repair report for actual coverage and limits, including M4-E's unexecuted
optional B/C branches. No failure was suppressed or converted to a skip.

Fresh ten-update button-to-terminal observation changes from about 6.92 to 2.25
seconds; raw phase/timing precision lives in the linked artifacts. Legitimate actual
history capacity stops the repeated Guided lesson at step 26 in both final concurrency
conditions, preserving six accepted updates from its step-20 baseline and refusing
transport for update 27. Original step-29 refusal observations retain their different
source/setup identity; neither count is a universal capacity threshold. No resource
limit, numerical policy, accepted update history or independent oracle was weakened.

## 2026-10-02 canonical workflow correctness disposition

This dated disposition follows the separate [canonical workflow repair](canonical-workflow-correctness.md).
It preserves every preceding report identity, failure, count and limitation. Branch
`pre-m5-abq-experience`, HEAD `ffb2db9217dac8ff3195fc2943918656daa78b59`, final
dirty-source runtime
`sha256:896bbf46b599076733dc2f6d7092805e7a318b9c29d909b9a8492b0d537c2ed0`.
Starting runtime was `sha256:7ee8d4cbfb9513e1da264d4185643d4a2fc6f354724eecd1d03762f8601c7db6`.
The [fresh starting reproduction](../../test-results/scratch/browser-jQhecU/report/results.json)
confirms all three original failure boundaries on that starting source. The
[final focused report](../../test-results/scratch/browser-psywJ7/report/results.json)
passes 22/22 with no skips/flaky, including the original BF-027/BF-035/BF-042 identities
and separate unfaulted/regression controls.

| ID | New scoped disposition |
| --- | --- |
| BF-027 | Repaired workbench activity ownership: Clear keeps the opening recorded state, successful fresh workbench Predict restores capability-permitted experiment controls. Original M3-D withheld/late-completion test now reaches both experiment requests, rejects the actual injected old-generation reply, publishes neither receipt, and verifies exact accepted snapshot, optimizer/source/runtime identity. Visitor/facilitator restrictions and experiment-family return-to-baseline pass. |
| BF-035 | Repaired shared request publication ownership and exact receipt lookup from authoritative published evidence. Unfaulted completion settles busy and selects its exact new run. Budget injection now demonstrably reaches the portable manifest boundary after an earlier success; one boundary hit, zero new prediction transport, unchanged history/selection and no success status. Invalid input/worker failure, cancelled request, Clear, saved import, run selection and producer change also settle without stale receipt selection. |
| BF-042 | Combined heads and neighboring native forward mappings open the executed `forwardSequenceForDefinition` arithmetic, with the canonical wrapper relationship disclosed. The original `combinedHeads.push(...headOutput)` and backward `parent.grad +=` assertions pass unchanged. Bundled offline/current source and genuine historical replay preserve source revision; unavailable historical bodies explicitly refuse current-code substitution. |

The identical latest Guided ten-case selection passes **10/10 serially** and
**10/10 with two workers** on this final runtime. Core selection passes **149** with
**5 existing missing-input skips**; portable reference conformance, runner/output
regressions and HTTP pass. These selections are not a full-suite pass. Installed
Playwright 1.63.0 expects absent Chromium 1243; actual checks explicitly use existing
headless shell 1234 / Chrome for Testing 151.0.7922.34 through the scratch-only adapter,
without downloads or settings changes. See the repair report for commands, environment,
original failed attempts, preservation and qualification limitations.

The new broad invocation ran **once**, `npm run test:browser -- --workers=2`, on
this final runtime: **147 passed / 16 failed / 14 skipped**, zero flaky, **177 selected**,
18.2 minutes. [Report](../../test-results/scratch/browser-3xM7ar/report/results.json),
[source/argv](../../test-results/scratch/browser-3xM7ar/source.json),
[console](../../test-results/scratch/browser-3xM7ar/playwright.log),
[failure/cleanup receipt](../../test-results/scratch/browser-3xM7ar/failure.json), and
[complete machine baseline](../../test-results/scratch/canonical-workflow-sNLxrP/browser-baseline.json)
retain every current result, full error, source and attachment. The unsuccessful exit
is preserved; cleanup errors are empty. This is not a full-suite pass.

All remaining failures/skips below retain their earlier observed assertion/control
boundary and classification. **No newly failing previously passing identity or
previously hidden downstream failure was observed.** Unexecuted assertions beyond
remaining failures are still unrun. The complete machine baseline also lists the
now-passing earlier identities; their outcome includes the incoming Guided repairs,
which are not credited to this three-defect pass. BF-051's corrected held-reply title
is explicitly related to its original retained title rather than silently replacing it.
BF-027/BF-035/BF-042 and the new controls pass in the broad run as well as focused checks.
No previous counts/passes are transferred, no new skips added and no failure suppressed.

| ID | Current full test identity | Current result | Retained scope / classification |
| --- | --- | --- | --- |
| BF-001 | `abq-overnight.spec.ts:13` — Q01/Q03 entry and source-bound chain 1280 | FAILED | outdated test contract |
| BF-002 | `abq-overnight.spec.ts:13` — Q01/Q03 entry and source-bound chain 1920 | FAILED | outdated test contract |
| BF-003 | `abq-overnight.spec.ts:26` — Q02 complete public reset across completed, forward, partial, Ready, historical and intervention | FAILED | outdated test contract |
| BF-004 | `abq-overnight.spec.ts:45` — Q04/Q05 short route detour, keyboard, reduced motion and source invalidation | FAILED | outdated test contract |
| BF-005 | `abq-overnight.spec.ts:51` — Q08 test-only serialized-estimate fixture refuses new work visibly and Clear recovers | FAILED | outdated test contract |
| BF-006 | `end-to-end-fixes.spec.ts:21` — five corrections: public same-session route, scalar arms, compact Ready and prediction meaning | FAILED | unresolved |
| BF-007 | `exhibit-v2.spec.ts:44` — browser measures max-context live scalar rendering and worker responsiveness | FAILED | outdated test contract |
| BF-008 | `exhibit-v2.spec.ts:95` — measured session budget stops new capture without deleting retained history | FAILED | outdated test contract |
| BF-017 | `m1-witnesses.spec.ts:5` — live MLP prediction and SGD, then noncanonical multilayer selection in the same inspector | FAILED | missing prerequisite |
| BF-018 | `m1-witnesses.spec.ts:41` — new models reopen after native shutdown without executors and refuse uncaptured actions | SKIPPED | missing prerequisite |
| BF-019 | `m1-witnesses.spec.ts:59` — structural and opaque imports show truthful fallback and no invented numerical display | FAILED | missing prerequisite |
| BF-020 | `m2-b-mlp-world.spec.ts:6` — M2-B live MLP prediction and SGD inhabit the shared continuous world without transformer state | FAILED | missing prerequisite |
| BF-021 | `m2-b-mlp-world.spec.ts:35` — M2-B saved MLP evidence reopens in the world with the native executor disconnected | SKIPPED | missing prerequisite |
| BF-022 | `m2-c-evidence-fallback.spec.ts:11` — M2-C grouped axes, shape-only and opaque evidence inhabit one truthful bounded world | SKIPPED | missing prerequisite |
| BF-023 | `m2-c-evidence-fallback.spec.ts:39` — M2-C saved fixture replay is executor-free and switching to MicroGPT clears fallback state | SKIPPED | missing prerequisite |
| BF-024 | `m2-d-pythia-world.spec.ts:12` — M2-D live native Pythia inhabits the shared world with truthful selected-layer coverage | SKIPPED | missing prerequisite |
| BF-025 | `m2-d-pythia-world.spec.ts:37` — M2-D saved Pythia world replays after verified bridge shutdown with zero native requests | SKIPPED | missing prerequisite |
| BF-026 | `m2-e-integration.spec.ts:15` — M2-E cross-world switching preserves canonical state and keeps replay inert | SKIPPED | missing prerequisite |
| BF-028 | `m4-a-pythia-generation.spec.ts:9` — M4-A live Predict and bounded uncached Generate retain separate native occurrences | SKIPPED | missing prerequisite |
| BF-029 | `m4-a-pythia-generation.spec.ts:24` — M4-A retained generation replays with zero native requests after bridge shutdown | SKIPPED | missing prerequisite |
| BF-030 | `m4-b1-payload.spec.ts:7` — M4-B1 retained generation uses payload-backed bounded inspection with no executor | SKIPPED | missing prerequisite |
| BF-031 | `m4-b2-portable-archive.spec.ts:6` — M4-B2 mixed historical archive exports, imports inertly, and survives a tampered replacement attempt | SKIPPED | missing prerequisite |
| BF-032 | `m4-c1-retention.spec.ts:6` — M4-C1 near-limit history stays inspectable while native work refuses before transport and Clear Session restores capacity | SKIPPED | missing prerequisite |
| BF-033 | `m4-c2-render-work.spec.ts:7` — M4-C2 retained navigation stays bounded and truthful without execution | SKIPPED | missing prerequisite |
| BF-034 | `model-lab-v2.spec.ts:92` — bounded training retains real checkpoints and complete capture displays statistics | FAILED | outdated test contract |
| BF-036 | `shared-slice.spec.ts:4` — two real producers share admission, inspection, sources and saved evidence | FAILED | missing prerequisite |
| BF-037 | `shared-slice.spec.ts:44` — saved native evidence replays after shutdown and canonical operation requires no Python endpoint | SKIPPED | missing prerequisite |
| BF-038 | `shared-slice.spec.ts:58` — a real native reply delayed past a model switch cannot enter retained evidence | FAILED | missing prerequisite |
| BF-039 | `spatial-wave1b.spec.ts:5` — B01–B09 complete source-bound forward route and contextual exploration over real HTTP | FAILED | unresolved |
| BF-040 | `spatial-wave1d.spec.ts:4` — D01–D05 source-bound explanations, interruption and static arithmetic | FAILED | unresolved |

BF-006 still stops at the fixed-width assertion (>400 versus observed
302.1175231933594); BF-039/BF-040 at viewport/overflow checks. BF-007/BF-008 remain
bounded whole-capture contract mismatches, and BF-034 remains summary wording.
Native-input failures retain the concrete undefined endpoint/recording/route errors;
they prove no faulty real native execution. Full machine errors, including secondary
errors and stopping sites, remain available rather than collapsed into a pass.

CG-01/CG-02 remain **NOT_RUN** optional M4-E Pythia/near-limit branches, despite the
parent test passing. Missing actual MLP/SGD, Pythia/generation, grouped-axis numerical,
shape-only/opaque and near-limit heterogeneous witnesses still prevent qualification
of the optimized shared archive boundary. Genuine historical canonical replay is a
focused witness; the broad source-availability control is synthetic and explicitly
labeled. No M5, unfamiliar-user, foundation or release acceptance is granted.



## 2026-10-02 shared context and intentional navigation disposition

Bounded selection/comparison and camera/activity repair; no foundation, M5, learning,
full-suite or release acceptance. [Repair review](shared-context-navigation-repair.md)
records starting/final source, scopes, commands, screenshots and preservation limits.
Final runtime `sha256:6127850b0ef530f1207814d182a364a6ed4614859c307109ecf4c56971659923`.

The completed final broad run selected **181**: **151 passed / 16 failed / 14 skipped**,
zero flaky, 18.7 minutes. [Report](../../test-results/scratch/browser-gsVmSD/report/results.json),
[source/argv](../../test-results/scratch/browser-gsVmSD/source.json), and
[complete prior/current record](../../test-results/scratch/shared-context-zdumue64/browser-baseline.json).
All 177 prior identities retain their outcome; four new navigation/camera identities
pass, no prior identity is missing, and no previously passing identity newly fails.
The actual tool pairing remains Playwright 1.63.0 with existing headless shell 1234 /
Chrome for Testing 151.0.7922.34 through the documented scratch-only adapter.

**Changed boundary:** BF-040 now stops at `spatial-wave1d.spec.ts:17`'s old expectation
that an ArrowRight camera action sets “Explore.” The repaired action preserves activity
and pauses explanation. Its old line-20 overflow failure and later learning controls
are NOT_RUN here; they are not resolved, suppressed or implicitly passed. The new
workbench case checks paused activity through rerender with unchanged selection and
worker commands. BF-006 still observes exactly 302.1175231933594 versus >400; BF-039
retains its viewport visibility stop. All fixed-width/overflow assertions remain intact.

| Original ID | Current identity | Actual result | Current disposition |
| --- | --- | --- | --- |
| BF-001 | `abq-overnight.spec.ts:13` — Q01/Q03 entry and source-bound chain 1280 | FAILED | outdated test contract |
| BF-002 | `abq-overnight.spec.ts:13` — Q01/Q03 entry and source-bound chain 1920 | FAILED | outdated test contract |
| BF-003 | `abq-overnight.spec.ts:26` — Q02 complete public reset across completed, forward, partial, Ready, historical and intervention | FAILED | outdated test contract |
| BF-004 | `abq-overnight.spec.ts:45` — Q04/Q05 short route detour, keyboard, reduced motion and source invalidation | FAILED | outdated test contract |
| BF-005 | `abq-overnight.spec.ts:51` — Q08 test-only serialized-estimate fixture refuses new work visibly and Clear recovers | FAILED | outdated test contract |
| BF-006 | `end-to-end-fixes.spec.ts:21` — five corrections: public same-session route, scalar arms, compact Ready and prediction meaning | FAILED | unresolved |
| BF-007 | `exhibit-v2.spec.ts:44` — browser measures max-context live scalar rendering and worker responsiveness | FAILED | outdated test contract |
| BF-008 | `exhibit-v2.spec.ts:95` — measured session budget stops new capture without deleting retained history | FAILED | outdated test contract |
| BF-017 | `m1-witnesses.spec.ts:5` — live MLP prediction and SGD, then noncanonical multilayer selection in the same inspector | FAILED | missing prerequisite |
| BF-018 | `m1-witnesses.spec.ts:41` — new models reopen after native shutdown without executors and refuse uncaptured actions | SKIPPED | missing prerequisite |
| BF-019 | `m1-witnesses.spec.ts:59` — structural and opaque imports show truthful fallback and no invented numerical display | FAILED | missing prerequisite |
| BF-020 | `m2-b-mlp-world.spec.ts:6` — M2-B live MLP prediction and SGD inhabit the shared continuous world without transformer state | FAILED | missing prerequisite |
| BF-021 | `m2-b-mlp-world.spec.ts:35` — M2-B saved MLP evidence reopens in the world with the native executor disconnected | SKIPPED | missing prerequisite |
| BF-022 | `m2-c-evidence-fallback.spec.ts:11` — M2-C grouped axes, shape-only and opaque evidence inhabit one truthful bounded world | SKIPPED | missing prerequisite |
| BF-023 | `m2-c-evidence-fallback.spec.ts:39` — M2-C saved fixture replay is executor-free and switching to MicroGPT clears fallback state | SKIPPED | missing prerequisite |
| BF-024 | `m2-d-pythia-world.spec.ts:12` — M2-D live native Pythia inhabits the shared world with truthful selected-layer coverage | SKIPPED | missing prerequisite |
| BF-025 | `m2-d-pythia-world.spec.ts:37` — M2-D saved Pythia world replays after verified bridge shutdown with zero native requests | SKIPPED | missing prerequisite |
| BF-026 | `m2-e-integration.spec.ts:15` — M2-E cross-world switching preserves canonical state and keeps replay inert | SKIPPED | missing prerequisite |
| BF-028 | `m4-a-pythia-generation.spec.ts:9` — M4-A live Predict and bounded uncached Generate retain separate native occurrences | SKIPPED | missing prerequisite |
| BF-029 | `m4-a-pythia-generation.spec.ts:24` — M4-A retained generation replays with zero native requests after bridge shutdown | SKIPPED | missing prerequisite |
| BF-030 | `m4-b1-payload.spec.ts:7` — M4-B1 retained generation uses payload-backed bounded inspection with no executor | SKIPPED | missing prerequisite |
| BF-031 | `m4-b2-portable-archive.spec.ts:6` — M4-B2 mixed historical archive exports, imports inertly, and survives a tampered replacement attempt | SKIPPED | missing prerequisite |
| BF-032 | `m4-c1-retention.spec.ts:6` — M4-C1 near-limit history stays inspectable while native work refuses before transport and Clear Session restores capacity | SKIPPED | missing prerequisite |
| BF-033 | `m4-c2-render-work.spec.ts:7` — M4-C2 retained navigation stays bounded and truthful without execution | SKIPPED | missing prerequisite |
| BF-034 | `model-lab-v2.spec.ts:92` — bounded training retains real checkpoints and complete capture displays statistics | FAILED | outdated test contract |
| BF-036 | `shared-slice.spec.ts:4` — two real producers share admission, inspection, sources and saved evidence | FAILED | missing prerequisite |
| BF-037 | `shared-slice.spec.ts:44` — saved native evidence replays after shutdown and canonical operation requires no Python endpoint | SKIPPED | missing prerequisite |
| BF-038 | `shared-slice.spec.ts:58` — a real native reply delayed past a model switch cannot enter retained evidence | FAILED | missing prerequisite |
| BF-039 | `spatial-wave1b.spec.ts:5` — B01–B09 complete source-bound forward route and contextual exploration over real HTTP | FAILED | unresolved |
| BF-040 | `spatial-wave1d.spec.ts:4` — D01–D05 source-bound explanations, interruption and static arithmetic | FAILED | outdated camera assertion; original overflow boundary NOT_RUN in this invocation |

All missing heterogeneous/native prerequisites and M4-E optional branches retain their
original qualification limits. Broad source availability uses a synthetic unsupported-
revision control; the genuine historical canonical archive was supplied only to the
earlier focused selection at its own source identity. The initial broad attempt was
interrupted for the final explanation-clock audit fix and retains its separate partial
report; it is not included in these completed counts. All failures and later unreached
assertions remain explicit.
