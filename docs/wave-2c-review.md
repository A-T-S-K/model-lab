# Wave 2C review

Implemented only in `/Users/joshuahansen/dev/model-lab`, on existing `wave-1a-spatial`, origin `git@github.com:A-T-S-K/model-lab.git`. Starting clean HEAD `0949a8209854cba216874e9b725ed3a23a2ba454`, tree `bcb48ce6e72c1f73758284bc0455efd746d31433`. No new branch, worktree, clone, support edits, remote synchronization or publication. The supplied brief defined this batch; repository implementation and tests supplied its numerical contracts.

Ready now exposes the already validated baseline and candidate endpoints through the active transaction's immutable progress view. They remain provisional, outside completed history. A compact Current / Candidate table shows complete selected-position distributions, target END, raw signed differences, accepted/proposed steps and the pinned parameter's old/proposed values. Both input means are explicitly derived from complete probabilities and matching targets. The observed training objective retains its separate label. Zero target probability yields Infinity; missing probabilities yield pending/unavailable. No acceptance recommendation is inferred from loss.

Inspect current/candidate and paired-map switches change only the selected read model. The map uses original components and a common domain for each pair; probability bars remain 0–1. No independently fitted Q/K or mixture displacement overlay is introduced. The existing receipt barrier, private candidate, one accepted session, immutable archive, 64 MiB limit and eight recent contribution occurrences remain. No numerical kernel changed.

During live contribution/Adam inspection, the lens has a persistent parameter-bank → forward-operation breadcrumb with the accepted checkpoint. Current phase and inspected source are independent from the retained forward selection. Unit/permit counts are available under Execution diagnostics. Fixed ±1 contribution marks still declare clipping and retain exact values.

Selecting a head output exposes Test without this head. The action uses the existing inspector-worker `runHeadAblation`, from the selected completed source's full starting snapshot/input/targets. Both disposable arms share runtime, configuration and numeric policy. In the selected head, the genuine kernel computes weighted values, records the pre-replacement output, then inserts constant zero immediately before concatenation at every position. The accepted model, moments, step, cursor and RNG are untouched. Active transactions block this action without accepting or discarding. Cancellation uses the existing disposable inspector-worker cancellation; failure preserves the selected accepted evidence.

The same map shows Baseline / Head output zeroed pairs. The selected arm owns scalar requests; historical reconstruction verifies the declared intervention and exact runtime. The zeroed head's inspector explicitly distinguishes the computed weighted sum from the replacement constant. Q/K/V, scores, attention weights and the other head are unchanged in this single-layer model. Dependencies retain the head → concat → WO → residual → MLP → logits → probabilities route. Exact equality has no tolerance; full numeric deltas distinguish nonzero values hidden by display rounding. A zero head and cancelled downstream effects are valid outcomes. Experiments have no Accept action or promotable checkpoint.

## Verification and review route

Implementation HEAD `86a35794ba868319cbbdac950cc18c11bed7154b`, tree `73d9553ddf8092875aa0867efc5304fea7f47b15`. Runtime `sha256:314f2e9f144e4ea72bf98aa7e9d57d8ea17c2cc58a61ba0cecd8676f2517680e` (71 source inputs). Checkpoints: `48558a3` prepared output read model / owner; `9712d6a` spatial integration; `86a3579` provenance, cancellation, tests and compact review fixes. Final documentation HEAD/tree and media hashes are recorded in ignored `test-results/wave2c-review/identity.json`.

| Check | Evidence |
| --- | --- |
| U01 | Worker test proves Ready endpoints are exactly the subsequently accepted immutable runs, with unchanged full accepted snapshot before acceptance. HTTP audit checks derived means against actual worker endpoints, preserves selected final position, and records no commands during current/candidate/pair toggles. Existing single acceptance, duplicate rejection, discard and archive recovery tests remain. |
| U02 | Existing exact two-update test and historical Update 1 at live step 2 routes remain. New read-model test supplies an explicitly synthetic worsening probability distribution, incomplete output and true zero; these are test fixtures, never live results. Corresponding map components share domains. |
| U03 | Full-size owner, proposal and Ready captures at 1920×1080 and 1280×720. Existing keyboard, explore/resume, manual backward, pin stop, hidden-tab and reduced-motion routes retained. |
| U04 | Both heads at one and eight positions: same snapshot/input/targets/configuration/runtime/numeric policy; exact selected outputs zeroed by the genuine intervention path. Reference numerical suite unchanged. |
| U05 | Exact upstream and unselected-head equality; selected zero channels, concat channel identity and direct WO reduction checked. Existing model test verifies pre-ablation aggregation observations. Added an all-zero V no-change case and intervention-aware historical scalar verification. |
| U06 | HTTP navigation through upstream, concat and downstream pairs; scalar inspection belongs to the selected arm. Arm switches, a new experiment and a fresh input clear earlier scalar/comparison evidence. Existing late-reply and exact-runtime tests retained. |
| U07 | Full accepted snapshot equality after cancelled/failed/successful experiments and fresh Predict, including nonzero optimizer state. Active candidate action is disabled. Existing C recovery, 2A and 2B fault/cancellation suites retained. |
| U08 | Normal production HTTP boundaries on 4173 and 4174, with existing environment/output conventions. Full-size captures and a paced uncut review recording; no hardware or usability certification is implied. |

```sh
cd /Users/joshuahansen/dev/model-lab
npm run dev -- --port 4173 --strictPort
```

Open [Spatial review](http://127.0.0.1:4173/?presentation=spatial). Step through learning → Continue to backward → pause at the pinned contribution → proposal → Continue to Ready → inspect Current/Candidate → explicitly Accept → select Weighted values/head → Test without this head → compare upstream and follow downstream dependencies → Return to current model. Discard is checked on a separate second candidate.

## Limits

Transactions remain in-memory, with no crash/reload durability and at most eight recent live contribution occurrences. Baseline semantic endpoints are retained at Ready, but the discarded baseline scalar graph is not reconstructed there; its scalar inspection reports not captured. Training/candidate scalar graphs retain their existing live support. Completed intervention scalars use the existing verified historical path. Neither experiment stepping nor training under intervention is added. Captures may require scrolling for all scalar/identity detail at 1280; controls and primary comparisons stay available.

The experiment action requires a compatible completed source runtime. Cancellation terminates disposable inspector work and does not reset the accepted model. No new durable source store, scheduler, renderer, model, general experiment editor or subsequent-wave work. Cold disconnected startup, event hardware, prolonged soak and unfamiliar-user comprehension still require a later release check.

## Reproduce verification

Stop only the verified project preview before these configurations, which own their respective ports. Restore the preview afterward with the startup command above.

```sh
npm run test:reference
npm test
npm run example
npm run build
WAVE2_EVIDENCE_DIR=/tmp/model-lab-wave2c-final-main WAVE2B_EVIDENCE_DIR=test-results/wave2c-review/2b-main WAVE2C_RECORD=1 npm run test:browser -- --workers=2 --output=test-results/wave2c-browser-delivery
WAVE2_EVIDENCE_DIR=/tmp/model-lab-wave2c-final-spatial SPATIAL_EVIDENCE_DIR=/tmp/model-lab-wave2c-final-preservation WAVE2B_EVIDENCE_DIR=test-results/wave2c-review/2b-spatial WAVE2C_EVIDENCE_DIR=test-results/wave2c-review/spatial npx playwright test --config playwright.spatial.config.ts tests/browser/spatial-*.spec.ts tests/browser/wave1c-early-stop.spec.ts --workers=2 --output=test-results/wave2c-spatial-delivery
```

The focused route can be rerun with `WAVE2C_RECORD=1 npx playwright test tests/browser/spatial-wave2c.spec.ts --workers=1`. Recording adds real reading pauses; no numerical execution is simulated or retimed. The main route performs one controlled acceptance and a later separate discard. The other focused route holds or fails the disposable request to verify cancellation/failure, then performs genuine successful experiments and compares the entire accepted snapshot after a fresh Predict.

Capture review repaired the inherited compact-lens rule that hid the head action, the inherited absolutely positioned intervention banner, and the narrow layout's header/summary spacing. The additional initial fault-test setup was corrected to perform Predict before Learn; disabled controls were not bypassed. No existing numerical tolerance or acceptance assertion was relaxed.

## Recorded evidence

[117.24-second uncut MP4](../test-results/wave2c-review/wave-2c-route.mp4) · [original WebM](../test-results/wave2c-review/wave-2c-route.webm) · [HTTP audit](../test-results/wave2c-review/http-audit.json) · [run/checkpoint/numeric summary](../test-results/wave2c-review/route-summary.json). The recording is 1920×1080, 25 fps, 2,931 frames; live switches to a 1280×720 viewport appear within that canvas. PNGs preserve sharp original-size text. Conversion changes codec only, with no cut or retiming. Full-size PNGs and selected encoded frames were inspected.

The actual controlled update changes this input's derived mean from `1.2158285451638384` to `1.0850956462725034`, before explicit acceptance. The subsequent head-1 experiment uses the accepted `sha256:0a43d3e90da2adb442be0d8fbdc18984c11414f72d43e7bc4ccb3d5ae1565712` snapshot in both arms. Its mean changes from `1.0850956462725034` to `1.0907998396726164`; no lower-loss or changed-top-token condition is required. Upstream and other-head values are exactly equal. The first actual difference in this recorded example is head 1's output at position 0; that coincidence with the intervention site is not a universal assumption. Full identities, input/targets, raw values and differences are in the summary/audit.

The audit has two controlled transactions, 926 advancement permits, one explicit acceptance, one discard, one matched ablation and no ordinary Train command. Maximum outstanding training permit/accept request is one. The selected position remains 4 at Ready, where target ID 3 is labeled END. Toggling Current/Candidate/paired inspection adds no worker command. The accepted step remains 1 after return and the separate discard check.

| View | 1920×1080 | 1280×720 |
| --- | --- | --- |
| Pinned owner / partial contribution | [Owner](../test-results/wave2c-review/owner-1920.png) | [Owner](../test-results/wave2c-review/owner-1280.png) |
| Proposed Adam | [Proposal](../test-results/wave2c-review/proposal-1920.png) | [Proposal](../test-results/wave2c-review/proposal-1280.png) |
| Candidate decision | [Ready](../test-results/wave2c-review/ready-1920.png) | [Ready](../test-results/wave2c-review/ready-1280.png) |
| Declared head intervention | [Head](../test-results/wave2c-review/head-1920.png) | [Head](../test-results/wave2c-review/head-1280.png) |
| Preserved attention weights | [Upstream](../test-results/wave2c-review/upstream-1920.png) | [Upstream](../test-results/wave2c-review/upstream-1280.png) |
| Preserved / zeroed concat channels | [Concat](../test-results/wave2c-review/concat-1920.png) | [Concat](../test-results/wave2c-review/concat-1280.png) |
| WO projection | [WO](../test-results/wave2c-review/attentionProjection-1920.png) | [WO](../test-results/wave2c-review/attentionProjection-1280.png) |
| MLP residual | [Residual](../test-results/wave2c-review/mlpResidual-1920.png) | [Residual](../test-results/wave2c-review/mlpResidual-1280.png) |
| Output comparison | [Probabilities](../test-results/wave2c-review/probabilities-1920.png) | [Probabilities](../test-results/wave2c-review/probabilities-1280.png) |
| Return to accepted model | [Returned](../test-results/wave2c-review/returned-1920.png) | [Returned](../test-results/wave2c-review/returned-1280.png) |

## Final results

On implementation `86a3579` / runtime `sha256:314f2e9f144e4ea72bf98aa7e9d57d8ea17c2cc58a61ba0cecd8676f2517680e`: **17 reference tests with zero differing floats, 112 unit/integration tests, example, typecheck/build, 95 browser tests on 4173 and 23 spatial tests on 4174 passed.** `git diff --check` passed. Both HTTP configurations include both new Wave 2C routes and the retained acceptance/recovery tests. The normal-checkout review preview was restored after verification.

[Reference](../test-results/wave2c-review/reference.log) · [unit/integration](../test-results/wave2c-review/tests.log) · [example](../test-results/wave2c-review/example.log) · [build](../test-results/wave2c-review/build.log) · [4173](../test-results/wave2c-review/browser.log) · [4174](../test-results/wave2c-review/spatial.log) · [final source/runtime/media identities](../test-results/wave2c-review/identity.json).

No merge, push, PR, deployment, workshop change or subsequent-wave work. Stop here for human review.
