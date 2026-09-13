# ABQ overnight rehearsal

ON0–ON5 implementation and engineering rehearsal are complete, including the prepared offline launch, full retained acceptance, actual media and a **7,204.24-second (120m04s) final-build soak**. Human teaching and physical-station acceptance remain separate, unperformed gates.

Work stayed in the normal `wave-1a-spatial` checkout of `A-T-S-K/model-lab`, starting from clean `568eaaa03c2d000999a9ac46ea915a35c74787cf`. One writer made local commits. No branch/worktree/clone, support/workshops edit, remote write, merge, deployment, dependency upgrade or machine-wide setting change occurred.

## ON0–ON3 implementation

The opt-in event URL is `http://127.0.0.1:4173/?presentation=spatial&kiosk=1`. It shows the connected model with **RECORDED RUN · REPLAY / Recorded real run. Not live.** The retained idle evidence is static and compatible with this runtime. Start consumes pointer/keyboard activation and requests fresh evidence through the existing owner; it adds no hidden training or acceptance.

The thin short route offers an explicit **Sample abca · q3 / h0 / k0**, named prediction/target/distribution, Q/K, softmax, value mixture and residual landmarks. It preserves an unplanned detour and restores the saved semantic selection only on Resume. A mismatched input receives a visible hint; the sample does not overwrite user input. This remains teacher-forced next-token prediction. Learning uses all five target positions for `abca`, while q3 compares against target `a`; the last position targets END.

Public reset clears visitor history, candidate, inspection, comparisons, run/scalar selection, pin, camera Back history and guide state, restoring canonical weights and Home. The initial 300-second idle/20-second warning policy is retained. Keep this session is clickable without pointer movement dismissing its target. Wheel, pointer, keyboard and touch activity count; rendering/playback do not. Disabling idle expiry preserves the exhibit entry on manual reset, and the operator can re-enable the configured timer in place.

Scene calculations reuse the existing complete-vector Q/K span, signed component products, causal softmax, all-key affine mixture and fixed projection. Concatenation, WO projection and saved-residual addition remain distinct. Existing negative-ReLU and live contribution/Adam constructions are retained. Scene math yields to an open head-comparison inspector and returns when it closes; exact tables, operands, consumers and source remain accessible. No renderer, scheduler, model, general editor, generation feature or persistence framework was introduced.

Controlled-start and head-test admission refusals now show actionable Clear-session messages. The64 MiB threshold remains a serialized-evidence estimate with operation headroom, not a process-memory cap. The standalone README paths are corrected. `npm run prepare:abq` builds once and creates a read-only kit with local assets/fonts/workers, notices, manifest and a dependency-free Node loopback launcher. Startup requires already-installed Node 24+, without source checkout, node_modules or network installation.

## Frozen source and artifact

| Identity | Value |
| --- | --- |
| Tested source commit | `f1e673169d7f3d1979a4eb2c361a57d4a60af14c` |
| Tested source tree | `189a0303d0d0c0a48eac5b5d9a730bfea36e7ff9` |
| Runtime | `sha256:c1ed7bf5d6de9e302668cf8f79a3d8d5539f56d07010cd5dbc471a9c69bc0891` |
| Production inputs | 72 |
| Artifact manifest SHA-256 | `1a0e0401eca1617a136ab4ce0f4d2aed530ea7e22393dfbae10a5ba2d76a53c7` |
| Launcher SHA-256 | `ea65ea909468376a9b87e59f1e7c2ea5bc6adb99e5b17c1a5d4dd53dee5294a0` |
| Kit payload | 16 hashed files  / 794237 bytes, plus manifest |

The prepared payload matches `dist` byte for byte. The manifest also hashes the preparer outside the runtime closure. Documentation-only delivery commits are recorded separately in [identity.json](../test-results/abq-overnight/identity.json). The kit is [release/](../test-results/abq-overnight/release/); its [START-HERE.txt](../test-results/abq-overnight/release/START-HERE.txt) gives exact startup commands.

## ON4 acceptance

| Check | Status | Evidence and scope |
| --- | --- | --- |
| Q01 entry/first payoff | PASSED | [activation evidence](../test-results/abq-overnight/final-main-abq/), [measured payoff](../test-results/abq-overnight/first-payoff.json); pointer/keyboard, fresh evidence and preserved root/switch behavior |
| Q02 public reset/idle | PASSED | Broad six-state reset, fake-time warning/Keep/wheel and facilitated opt-out/re-enable pass; real completed/candidate idle cycles reset at 300.73/300.88 seconds, with 20.27/20.14-second warnings and no unintended acceptance |
| Q03 scene attention | PASSED | [paired captures](../test-results/abq-overnight/route/), final geometry/source tests; all causal keys, original components and declared projection retained |
| Q04 exploration/coverage | PASSED | Full retained source/history/cancellation tests; [operation coverage](../test-results/abq-overnight/operation-coverage.md) records where full inspector detail remains required |
| Q05 readability/access | PASSED | [layout measurements](../test-results/abq-overnight/layout-measurements.json), [touch route](../test-results/abq-overnight/cold/touch-route.json), keyboard/reduced-motion tests; no measured clipping in final captures |
| Q06 learning/candidate safety | PASSED | Retained learning-stop, training/recovery suites and [route audit](../test-results/abq-overnight/final-main-stop/route.json); two-action prospective stop, exact updates, explicit decisions |
| Q07 matched head experiment | PASSED | [matched arms](../test-results/abq-overnight/matched-arms.json), [complete accepted-state equality](../test-results/abq-overnight/accepted-state-equality.json), both-head probe and retained tests |
| Q08 resources/recovery | PASSED | [budget fixture](../test-results/abq-overnight/final-main-abq/budget-fixture.json), actual production-budget/recovery tests and launcher test; no silent eviction or weakened receipt semantics |
| Q09 prepared offline artifact | PASSED | [cold result](../test-results/abq-overnight/cold/cold.json), [manifest](../test-results/abq-overnight/artifact-manifest.json), [launcher test](../test-results/abq-overnight/launcher-tests.log); source/worker/font/learning/head operation with external requests denied and negative control |
| Q10 retained final suites | PASSED | Reference 17 pass/no differing floats, unit 127 pass, example/typecheck/build pass; HTTP4173 **110/110** (6.0m), HTTP4174 **38/38** (5.4m) |
| Q11 real 120-minute soak | PASSED | [Measured soak](../test-results/abq-overnight/soak/soak.json): 7,204.24 monotonic seconds, 27 mixed cycles, same artifact/browser; [resource summary](../test-results/abq-overnight/resource-summary.json) and [real idle cycles](../test-results/abq-overnight/idle-cycle-audit.json) |
| Q12 handover | PASSED | Local implementation/docs commits, prepared kit, actual media, operator/facilitator guides and human checklist delivered; final delivery/preview identities are in identity.json and preview-process.json |

[Commands](../test-results/abq-overnight/commands.sh), [test inventory](../test-results/abq-overnight/test-inventory.json), [reference](../test-results/abq-overnight/reference.log), [unit](../test-results/abq-overnight/unit.log), [build](../test-results/abq-overnight/build.log), [4173](../test-results/abq-overnight/http4173.log), [4174](../test-results/abq-overnight/http4174.log), and [HTTP runtime bindings](../test-results/abq-overnight/http-runtime-bindings.json) identify the actual checked boundaries. Existing numerical tolerances and source/candidate/history/recovery assertions were preserved.

The final isolated cold route passed in 54.46 seconds, including a separate emulated-touch context. The mixed probe passed in 72.85 seconds: 12 retained runs during the workload, then 0 runs / 1 active worker / 0 pending permits after reset, maximum outstanding permit 1. The soak ran from 2026-09-13T20:45:17.264Z to 22:45:21.465Z: **7,204.24 monotonic seconds**, one browser/page, no forced GC or test-driven browser restart. It completed 27 accepted and 27 explicitly discarded learning candidates, an additional candidate disposed by real idle expiry, 54 matched head tests, 27 cancelled controlled predictions, old-run inspection, empty/short/max input, and keyboard/reduced-motion navigation. It observed 25,465 actual training permits, maximum one outstanding. No page errors or unintended acceptance were reported. A separate real idle capture after the completed soak reset after 300.95 seconds with a 19.96-second observed warning; [warning](../test-results/abq-overnight/idle-warning.png) and [returned idle](../test-results/abq-overnight/idle-return.png) were visually inspected. That additional cycle supplied screenshots and did not contribute to the main soak duration. Final artifact hashes matched. The final reset had canonical step 0, no active execution or pending permit, and zero retained visitor runs.

## Sustained resources and scope

The 145 resource samples distinguish intentional retained history from equivalent reset states. Each mixed cycle retained 12 runs before public reset; the serialized-evidence estimate peaked at 2.34 MB. The 26 comparable samples taken 180 seconds after reset all had **0 runs / 0 estimated evidence bytes, 1 audited and Playwright worker, 5,011 DOM nodes and 212 listeners**. Created-worker count 84 reflects deliberate disposable worker lifecycles; it is not an active-worker count.

Settled page heap ranged **4.70–5.10MB**, mean 4.96 MB / standard deviation 0.11 MB. The first three settled samples averaged 4.727 MB and the last three 5.103 MB; the final three differed by only 3.4 KB. This small warm-up drift is reported rather than called zero leakage; allocation-level attribution was not measured. During active/rendering samples, page heap peaked at 33.36 MB and transient DOM/listener counts were higher before natural collection.

Aggregate process RSS ranged **443–698MiB** in comparable settled states, with early/late three-sample means about 663/661 MiB. Across all workload samples it peaked near **1.49GiB**. RSS aggregates browser/renderer/GPU/network processes and can include shared/native/worker allocations; it is not worker heap or unique physical memory. This is why the 64 MiB evidence estimate must not be treated as a process-memory cap. No accumulating active workers, retained visitor archive, DOM/listener plateau growth, stale-result resurrection or permit loop was observed. These are measured two-hour engineering results, not a proof of zero leaks or event-hardware qualification.

## ON5 media and morning review

[Actual paced video](../test-results/abq-overnight/final-media/paced-route.webm) is about 165 seconds at 1920×1080/25fps, with deliberate reading pauses. [Full-size captures](../test-results/abq-overnight/route/) cover both 1920×1080 and 1280×720. [Before/after index](../test-results/abq-overnight/before-after.md) separates current captures from baseline material. Video samples and full-size Ready/head/attention captures were inspected. Local panels scroll; 1280 captures collapse the route disclosure for calculation space, and a separate mixture-result capture shows its scrolled sum/consumer.

The final automated route measured 197 ms to fresh evidence (one action), 312 ms to the named prediction (two), and scene attention in three actions. These are single local expert automation measurements, not human-comprehension results. Scene lesson text measures 18px/16px at 1920/1280. Raw identities/geometry metadata are smaller; some retained dense operator controls are 30px at 1280 while the visitor Start/short-route targets aim for 44px. No WCAG or physical-touch certification is implied.

Use the [operator runbook](abq-operator-runbook.md), [facilitator guide](abq-facilitator-guide.md), and [six-task morning checklist](morning-checklist.md). Actual event-display/DPI/touch/reach/glare, OS sleep/reboot, real background/resume, unfamiliar-user understanding and conference approval remain **NOT_RUN**. The observed development host is Apple M1 Max / 64 GiB, macOS Darwin 25.5.0, Node 24.20.0 and Chromium 153.0.8010.12; it is not asserted to be the event station.

Earlier findings and first-pass failures are retained in [failures and repairs](../test-results/abq-overnight/failures-and-repairs.md), `pre-comparison/`, `pre-optout/` and `soak-aborted-layout/`. The interrupted earlier soak does not qualify the final runtime. Engineering rehearsal, facilitated-exhibit approval and unattended walk-up acceptance are separate gates. Generative continuation, additional models, broad experiment editing and durable recovery remain later work. Stop after this overnight scope for human review.

## Final startup and disposition

The verified prepared preview remains on **http://127.0.0.1:4173/?presentation=spatial&kiosk=1**, PID68819, command `node test-results/abq-overnight/release/serve.mjs` from the normal checkout. Port4174 is closed. Exact identities and the final documentation-only delivery commit/tree are in [identity.json](../test-results/abq-overnight/identity.json). [Evidence index](../test-results/abq-overnight/INDEX.md).

Engineering rehearsal: **PASSED**. Facilitated-exhibit and unattended-walk-up acceptance: **NOT_RUN**, pending the actual operator/display and unfamiliar-user checks. No in-scope engineering check remains blocked. No push, PR, merge or deployment was performed. Work stops here for human review.
