# Release implementation checkpoints — 2026-10-02

Reviewed local checkpointing of accumulated completed agent work. The user explicitly
authorized staging and ordinary local commits for this task. This record grants no
foundation, independent M5, unfamiliar-user, M6 or release acceptance. No product
repair, installation/download, service launch, push, publication, deployment, branch
switch/reset, stash, amend/rebase, history rewrite or remote/settings change occurred.

## Actual starting state and preservation

- Branch: `pre-m5-abq-experience`.
- HEAD: `ffb2db9217dac8ff3195fc2943918656daa78b59`.
- HEAD tree: `59ed4861a52b0b50b4919880115deaa6321923f4`.
- Dirty-source runtime: `sha256:8e67767e6d3bdc345263d54c51c4c41c3076fa1a0f8dbc9a45b060e37c12e949`, 142 ordered production inputs.
- Index empty; 79 owned modified/new paths plus the two unrelated untracked files below.

Root AGENTS.md (no applicable nested/ancestor file found), document authority,
foundation ledger, release roadmap/journey, all eight named pass reports, package
scripts and the runtime identity implementation were inspected. Historical gate
statements remain historical; this checkpoint authorization supersedes earlier
no-staging/commit restrictions only for the verified work.

Fresh owned allocation: `test-results/scratch/implementation-checkpoints-pzkquedd/`. It was allocated as a new
immediate child without cleanup or adoption; ancestors and source files were checked
for symlink aliases. Before hooks/checks/index writes, it captured incoming status,
HEAD/tree, complete tracked binary diff and index diff, 409 regular source/generated
byte copies and SHA-256 hashes, including ignored `runtime/revision.ts` and the two
excluded files. It separately hashed 50,916 existing evidence/dist/Playwright,
fixture and reference files; no symlinks were present in that protected inventory.

[Incoming status](../../test-results/scratch/implementation-checkpoints-pzkquedd/status.txt), [incoming patch](../../test-results/scratch/implementation-checkpoints-pzkquedd/incoming.patch),
[source hashes](../../test-results/scratch/implementation-checkpoints-pzkquedd/source.json), [protected hashes](../../test-results/scratch/implementation-checkpoints-pzkquedd/protected.json) and
[read-only incoming runtime](../../test-results/scratch/implementation-checkpoints-pzkquedd/runtime-before.json) retain this actual starting
state. The runtime-before receipt recomputes the identity from those preserved
incoming bytes using the inspected read-only `runtimeIdentity` function; the live
read-only identity at entry also matched the supplied planning baseline.

`core.hooksPath` has no configured override. The resolved `.git/hooks` contains
only `.sample` files and no active hook files. [Hook audit](../../test-results/scratch/implementation-checkpoints-pzkquedd/hooks.json).
Normal `git commit` was used without hook bypass or configuration changes. The
sandbox makes `.git` read-only, so Git object/index/commit writes used the authorized
execution escalation. No automatic approval rejection or blocking hook occurred.

## Ownership reconstruction and review

Ownership comes from report-linked manifests, retained patches, regular incoming
source copies, original preservation receipts and final hashes. It was not assigned
from filenames, timestamps, commit messages or earlier summaries.

For each incremental path, the recorded before hash was matched against both the
preceding reconstructed bytes and that pass's saved starting copy. Its after hash
was matched to a later pass's contemporaneous starting copy or the incoming final
copy. The first pass's `source-files.json` plus `changed-scope.json` identifies its
tracked changes and separately inventoried new files. Its `working.patch` contains
tracked deltas only; new-file contents are verified by the source manifest and the
next pass's copies. The subsequent six incremental patches account for every
added/deleted line of their byte-derived changes. Original preservation receipts
were inspected and remain unchanged, including the shared-context report's explicit
recovered-generated-backup limitation.

All 79 incoming owned paths are accounted for, with no unresolved ownership or
extra unowned implementation. The complete [path/hunk inventory](../../test-results/scratch/implementation-checkpoints-pzkquedd/ownership.json)
records per-pass before/after SHA-256, byte-copy authority and unified hunk ranges.
[Group targets](../../test-results/scratch/implementation-checkpoints-pzkquedd/groups.json) records exact staged source targets and their
snapshot authority. `group-1.patch` through `group-7.patch` in this allocation are
review deltas derived from actual retained bytes, not new execution evidence.

Actual implementation, tests, helpers and documents were reviewed for scope,
dependencies, state/epoch ownership, original values, provenance, numerical/source
preservation and accidental artifacts. No credential/private-key/token pattern was
found in the verified source; no secret or unrelated artifact was identified for
inclusion. Local relative imports/types were checked against each staged tree,
with the existing ignored generated revision treated as an excluded prerequisite.
Canonical arithmetic, fixtures, independent Python oracle, backend/dependency
versions and historical evidence were not repaired or rewritten.

Seven genuine pass boundaries were possible without fabricating source states.
For overlapping files, verified snapshot blobs were written directly to the index
using explicit per-path `hash-object`/`update-index` operations. Final working files
were never replaced with old snapshots. Each commit includes its pass's tests and
documentation; later additive report content remains in its owning later commit.

Before each commit the complete staged diff, new files, exact path scope, modes,
full blob bytes, dependency closure and whitespace were inspected and recorded.
Staged blobs equal the reviewed snapshots; Git/difflib may align repeated unchanged
lines differently, so the added/deleted net line content and full before/after bytes
were checked independently. The staged runtime was recomputed from the index using
the same ordered path/byte algorithm and matches the original report's final runtime
for every pass. This is source identity/coherence evidence, not a test execution on
an intermediate index tree. `staged-1.patch`–`staged-7.patch` and
`precommit-1.json`–`precommit-7.json` retain these audits.

One whitespace finding was preserved: commit 4's historical triage snapshot has
`docs/reviews/browser-failure-triage.md:373: new blank line at EOF` (`git diff --cached
--check` exit 2). Removing it would rewrite the recorded snapshot. It was reviewed
as documentation whitespace and committed unchanged; later additive triage text
naturally makes that line internal. All other implementation staged checks and the
complete baseline-to-final implementation `git diff --check` passed. No source fix
or hook bypass was used. The original reports' whitespace statements remain their
own scoped historical claims, not a claim that this intermediate staged check passed.

## Ordered implementation commits

| Pass | Local commit | Scope and original authority |
| --- | --- | --- |
| 1 | `c82dfc31397026d18829369c171396818f428867` — Own browser and HTTP validation outputs | Fresh browser/HTTP allocation and override refusal, durable per-attempt evidence/handoffs, wrapper/config/scripts/helpers/regressions, release contract and safety report. [Original report](release-validation-safety.md); [retained root](../../test-results/scratch/release-review-5KboIi/). |
| 2 | `dfbf564f97347761513c41fa2387fd9ce3ccf952` — Bound runner failure cleanup and retain browser triage | Bounded owned child/group and log settlement on failures/signals, lifecycle regressions, original browser failure/prerequisite triage. [Original report](runner-lifecycle-closure.md); [retained root](../../test-results/scratch/lifecycle-review-qhhkhxy7/). |
| 3 | `a17606151d4d761c1a916d9b911c99b09a726b4b` — Preserve acknowledged Guided updates through cancellation | Immutable validated archive/evidence membership forks; synchronous acknowledged result; Guided cancellation/publication, retention failure refusal, and complete-state controls. [Original report](guided-training-lifecycle-repair.md); [retained root](../../test-results/scratch/guided-repair-0V133g/). |
| 4 | `887a1ff31499def0b1a7992408728161d0a3ec37` — Bind canonical completion to its published receipt and source | Request-owned authoritative canonical publication/receipt, reset-to-live workbench activity, executed generator source mapping/extraction, stale-request and offline-source controls. [Original report](canonical-workflow-correctness.md); [retained root](../../test-results/scratch/canonical-workflow-sNLxrP/). |
| 5 | `93851ffd6f254cd6e37989bbf47c145d3c987215` — Keep comparison context stable through intentional navigation | One typed matched comparison context, p3 lesson versus temporary detail, intentional Explore/resume, camera activity and focus controls. [Original report](shared-context-navigation-repair.md); [retained root](../../test-results/scratch/shared-context-zdumue64/). |
| 6 | `6169e37a67c58be564aa74e9c445a82f7566866f` — Add an opt-in prediction and representation introduction | Opt-in opening/prediction/representation, same-world overview, native-value read model/view, workbench/Classic/multilayer return, journey and camera-contract tests. [Original report](release-learning-introduction.md); [retained root](../../test-results/scratch/release-learning-t9kgdbln/). |
| 7 | `701b10a332dfd4c5b656063cbf29de4daa3ab619` — Teach attention and output from the retained prediction | Context/attention and output chapters, full contributors and normalization support, saved residual lineage, current-input/accepted-state learning handoff refusal and focused controls. [Original report](release-learning-forward-tour.md); [retained root](../../test-results/scratch/release-forward-6i25ccmq/). |

The original [browser failure triage](browser-failure-triage.md) is first introduced
in pass 2 and retains later dated additive dispositions through pass 7. Previous
reports retain their original HEAD/runtime/results, including failures, not-run
branches and environment qualifications. Commits do not retroactively make those
working-source records committed-candidate acceptance.

## Path ownership index

Pass numbers refer to the ordered commits above. Repeated numbers across files are
actual overlapping deltas, with exact hunk ranges and hashes in the linked inventory.

| Path | Owning passes |
| --- | --- |
| `app/main.ts` | 3, 4, 5, 6, 7 |
| `app/presentation/release-learning.ts` | 6, 7 |
| `app/source/catalog.ts` | 4 |
| `app/source/extraction.ts` | 4 |
| `app/source/mappings.ts` | 4 |
| `app/spatial/camera.ts` | 5, 6 |
| `app/spatial/contextual-dock.ts` | 5, 6, 7 |
| `app/spatial/presenter.ts` | 5, 6, 7 |
| `app/spatial/public-training-depth.ts` | 5 |
| `app/spatial/scene.ts` | 6 |
| `app/spatial/style.css` | 6, 7 |
| `app/views/release-learning.ts` | 6, 7 |
| `app/views/shared-inspector.ts` | 4 |
| `app/worker/client.ts` | 3 |
| `app/worker/executors.ts` | 4 |
| `archive/session.ts` | 3 |
| `docs/README.md` | 1, 2, 4, 5, 6, 7 |
| `docs/design/release-learning-journey.md` | 6, 7 |
| `docs/release-roadmap.md` | 1, 6, 7 |
| `docs/reviews/browser-failure-triage.md` | 2, 3, 4, 5, 6, 7 |
| `docs/reviews/canonical-workflow-correctness.md` | 4 |
| `docs/reviews/guided-training-lifecycle-repair.md` | 3 |
| `docs/reviews/release-learning-forward-tour.md` | 7 |
| `docs/reviews/release-learning-introduction.md` | 6 |
| `docs/reviews/release-validation-safety.md` | 1 |
| `docs/reviews/runner-lifecycle-closure.md` | 2 |
| `docs/reviews/shared-context-navigation-repair.md` | 5 |
| `package.json` | 1 |
| `playwright.config.ts` | 1 |
| `playwright.http.config.ts` | 1 |
| `scripts/run-browser.mjs` | 1 |
| `tests/app/public-training-depth.test.ts` | 5 |
| `tests/app/release-learning.test.ts` | 6, 7 |
| `tests/app/stages-source.test.ts` | 4 |
| `tests/browser/abq-overnight.spec.ts` | 1 |
| `tests/browser/canonical-workflow.spec.ts` | 4 |
| `tests/browser/end-to-end-fixes.spec.ts` | 1 |
| `tests/browser/exhibit-v2.spec.ts` | 1 |
| `tests/browser/guided-lifecycle-repair.spec.ts` | 3 |
| `tests/browser/guided-v2.1.spec.ts` | 1, 3 |
| `tests/browser/m2-b-mlp-world.spec.ts` | 1 |
| `tests/browser/m2-d-pythia-world.spec.ts` | 1 |
| `tests/browser/m3-d-integration.spec.ts` | 4 |
| `tests/browser/m4-a-pythia-generation.spec.ts` | 1 |
| `tests/browser/model-lab.spec.ts` | 1 |
| `tests/browser/pre-m5-abq-experience.spec.ts` | 1, 5 |
| `tests/browser/release-learning-forward.spec.ts` | 7 |
| `tests/browser/release-learning.spec.ts` | 6 |
| `tests/browser/shared-context-navigation.spec.ts` | 5 |
| `tests/browser/shared-repairs.spec.ts` | 4 |
| `tests/browser/shared-slice.spec.ts` | 1 |
| `tests/browser/spatial-learning-route.spec.ts` | 1 |
| `tests/browser/spatial-paced-route.spec.ts` | 1 |
| `tests/browser/spatial-wave1b.spec.ts` | 1 |
| `tests/browser/spatial-wave1d-route.spec.ts` | 1 |
| `tests/browser/spatial-wave1d.spec.ts` | 1, 6 |
| `tests/browser/spatial-wave2a-route.spec.ts` | 1 |
| `tests/browser/spatial-wave2b.spec.ts` | 1 |
| `tests/browser/visual-attention.spec.ts` | 1 |
| `tests/browser/visual-exhibit.spec.ts` | 1 |
| `tests/browser/visual-guided.spec.ts` | 1, 3 |
| `tests/browser/visual-history.spec.ts` | 1 |
| `tests/browser/visual-learning.spec.ts` | 1 |
| `tests/browser/visual-microscope.spec.ts` | 1 |
| `tests/browser/visual-regression.spec.ts` | 1 |
| `tests/browser/visual-responsive.spec.ts` | 1 |
| `tests/http-browser/http-host.spec.ts` | 1 |
| `tests/integration/canonical-receipt.test.ts` | 4 |
| `tests/integration/client.test.ts` | 3 |
| `tests/integration/m1-witnesses.test.ts` | 3 |
| `tests/integration/m4-cross-boundary.test.ts` | 3 |
| `tests/integration/ordinary-output.test.ts` | 1 |
| `tests/integration/ordinary-runner.test.ts` | 2 |
| `tests/integration/portable-archive.test.ts` | 3 |
| `tests/support/browser-evidence.ts` | 1 |
| `tests/support/ordinary-output.ts` | 1 |
| `tests/support/ordinary-runner.ts` | 1, 2 |
| `tests/support/slice-output.ts` | 1 |
| `trace/evidence.ts` | 3 |

## Checkpoint preservation and checks performed now

Implementation HEAD: `701b10a332dfd4c5b656063cbf29de4daa3ab619`.
Implementation tree: `5a9e06e039fe94e8896c1e00eb590e0a7fb03f42`.

[Implementation preservation](../../test-results/scratch/implementation-checkpoints-pzkquedd/implementation-preservation.json) verifies:

- All 409 incoming source/generated files match the final working bytes: zero differences.
- All 79 owned changed/new files, and all other incoming tracked sources, match the implementation commit: zero differences.
- Every implementation commit tree equals its precommit audited tree, and every per-pass staged path equals its intended snapshot bytes.
- All 50,916 protected files match incoming hashes, including canonical fixtures, independent reference/oracle files, historical artifacts and checkout dist.
- Ignored generated `runtime/revision.ts` remains byte-identical, SHA-256 `c49cc75cc9b3fce19a348b997bbecc169b3b71c42913377d985f1b638925923a`.
- No staged or unstaged change remains after implementation commits; only the two excluded untracked files remain.

Read-only live runtime after implementation is
`sha256:8e67767e6d3bdc345263d54c51c4c41c3076fa1a0f8dbc9a45b060e37c12e949`.
[Receipt](../../test-results/scratch/implementation-checkpoints-pzkquedd/runtime-after-implementation.json). It equals the incoming runtime
and the recomputed final staged runtime; commit/tree identity changed without
implementation-byte changes. Hash equality is preservation, not a fresh suite pass.

The direct installed `./node_modules/.bin/tsc --noEmit` passed (exit 0, empty
[log](../../test-results/scratch/implementation-checkpoints-pzkquedd/typecheck.log)) against the final incoming working directory. Its
`tsconfig.json` has noEmit and no incremental output, and this direct invocation
avoids npm's generation prehook. No npm/browser/build/reference suite was rerun for
checkpointing. No tests are represented as having read the staged intermediate tree.
Final checks include explicit staged scope/dependencies, SHA-256 byte equality,
read-only runtime imports, local document links/anchors and whitespace. No default
build or historical writer was invoked.

The only intentional source-document change made by this task after implementation
checkpointing is this new record and one link in `docs/README.md`. They do not enter
runtime hashing. The record commit may reference the seven preceding commits; its
own SHA and final HEAD/tree are reported to the user separately. Final verification
is retained in `final-verification.json` in the owned allocation.

## Retained historical validation, verified against artifacts

All figures below are retained engineering runs, not freshly executed by this
checkpoint task. Final browser/HTTP source receipts identify starting HEAD
`ffb2db9217dac8ff3195fc2943918656daa78b59`, tree
`59ed4861a52b0b50b4919880115deaa6321923f4`, dirty checkout and runtime `8e67767e…`.
The original sources/commands and report statistics were read directly and recorded
in [validation retrieval](../../test-results/scratch/implementation-checkpoints-pzkquedd/historical-validation.json).

| Actual historical command / source scope | Verified result and retained source |
| --- | --- |
| `TSX_DISABLE_CACHE=1 PYTHONDONTWRITEBYTECODE=1 npm test`, corrected final handoff source | 388 selected, **376 passed / 12 prerequisite skips / 0 failures**. Final log identifies runtime `8e67767e…` and npm's audited generation hook. [Log](../../test-results/scratch/release-forward-6i25ccmq/core-handoff-final.log), [12 exact omissions](../../test-results/scratch/release-forward-6i25ccmq/core-skips.json). |
| Focused `npm run test:browser -- tests/browser/release-learning-forward.spec.ts tests/browser/release-learning.spec.ts tests/browser/shared-context-navigation.spec.ts tests/browser/canonical-workflow.spec.ts tests/browser/guided-lifecycle-repair.spec.ts --workers=2`, scratch launch adapter | **31/31**, zero skips/flaky/failures, 150.008501 seconds. [Report](../../test-results/scratch/browser-G4MbdX/report/results.json), [source/argv](../../test-results/scratch/browser-G4MbdX/source.json). |
| `PYTHONDONTWRITEBYTECODE=1 npm run test:reference` (portable alias), forward-tour pass before the final handoff guard | **17 Python tests passed**, strict exact structure/identity and `1e-30 + 1e-12 × abs(canonical)` numerical conformance; zero differing floats. [Log](../../test-results/scratch/release-forward-6i25ccmq/reference.log). Oracle/fixture/mechanism bytes remained unchanged; this is not canonical-environment byte regeneration or a newly run final-commit check. |
| Corrected-source `npm run test:http`, scratch adapter | **1/1**, zero skips/flaky/failures, 12.633813 seconds. [Report](../../test-results/scratch/http-NywmEP/report/results.json), [source/argv](../../test-results/scratch/http-NywmEP/source.json). |
| Complete `npm run test:browser -- --workers=2`, scratch adapter, corrected source | 192 selected, **162 passed / 16 failed / 14 skipped**, zero flaky, 1,170.391776 seconds. [Report](../../test-results/scratch/browser-TLU09e/report/results.json), [source/argv](../../test-results/scratch/browser-TLU09e/source.json), [failure receipt](../../test-results/scratch/browser-TLU09e/failure.json). The broad suite is not green. |

Historical environment: Node v24.21.0, TypeScript 7.0.2, Vite 8.2.2,
Playwright 1.63.0 and tsx 4.23.13 on Darwin arm64.
[Environment receipt](../../test-results/scratch/release-forward-6i25ccmq/environment-final.json).
Expected Playwright Chromium 1243 is absent. Browser/HTTP runs explicitly used the
already installed headless shell 1234 / Google Chrome for Testing 151.0.7922.34
through the retained scratch-only NODE_OPTIONS adapter. This alternate pairing
remains a qualification limit, not a standard tool/browser qualification.

The [forward-tour review](release-learning-forward-tour.md), [introduction review](release-learning-introduction.md)
and [dated triage](browser-failure-triage.md#2026-10-02-release-learning-forward-tour-disposition)
retain intermediate failures and distinguish them from corrected-source checks.
The broad comparison found all 188 prior identities retained with the same outcomes
and stopping boundaries, plus four new passing identities; assertions beyond each
failure stop remain NOT_RUN.

## Failures, exclusions and qualification limits

Sixteen broad failures remain: legacy public-entry/reset/guide/budget expectations
(BF-001–005), fixed width BF-006 (>400 versus 302.1175231933594), complete scalar
capture/derived-cache expectations BF-007/008, missing native/fixture/preflight inputs
BF-017/019/020/036/038, summary wording BF-034 and geometry BF-039/040. The 14 broad
skips and 12 core skips remain prerequisite omissions, never passes. M4-E optional
Pythia Route B and near-limit Route C remain NOT_RUN despite a passing parent test.

Current native Pythia live/generation/disconnected witnesses, actual MLP/SGD,
grouped-axis numerical, shape-only/opaque, supplied train-many boundary and mixed
heterogeneous near-limit archives remain unqualified for changed shared boundaries.
Canonical/noncanonical local evidence and synthetic refusal controls do not replace
that portfolio. Canonical-environment byte regeneration, aggregate acceptance,
isolation/install, clean-candidate qualification, independent M5, full unfamiliar-user
study, workshop/station and release acceptance were not run or granted here.

No unresolved path/hunk ownership, missing staged dependency or hook blocker was
found. The implementation retains known product/test failures; this checkpointing
task does not authorize repairing them. Original reports and their qualifications
remain unchanged.

Excluded throughout, preserved exactly and still untracked:

- `.DS_Store`: 14340 bytes, SHA-256 `400a9732a7b64189570d09ad65b0ab92727c53dcb20e9a7ca5487a0c50d0ea5b`.
- `docs/merge-readiness-plan.md`: 11930 bytes, SHA-256 `41c9fb827ffef52a7e93d712f7b715177b19e90e021ad7a6cce2de122468ee7a`.

Generated revision, dist, test-results, Playwright reports, scratch/temporary files,
node_modules/caches/environments, research/backend files, weights and credentials
were not staged. No .gitignore concealment or unrelated cleanup occurred. New owned
scratch evidence remains ignored and retained locally; it is not committed source.
After the documentation checkpoint, the expected remaining Git status is exactly
`?? .DS_Store` and `?? docs/merge-readiness-plan.md`, with an empty index and no
tracked unstaged change. No push occurred.
