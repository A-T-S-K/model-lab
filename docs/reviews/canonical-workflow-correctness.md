# Canonical workflow correctness — 2026-10-02

Bounded working-source engineering repair of shared canonical completion, reset-to-
workbench activity and executed-source navigation. No M5, unfamiliar-user, foundation
or release acceptance is granted. BSides ABQ, its profile and historical evidence
retain their original scope. Runner and Guided lifecycle repairs are preserved.

## Authority, starting source and incremental ownership

Branch `pre-m5-abq-experience`, HEAD
`ffb2db9217dac8ff3195fc2943918656daa78b59`; no staged changes at entry.
The refreshed starting runtime matches the planning baseline:
`sha256:7ee8d4cbfb9513e1da264d4185643d4a2fc6f354724eecd1d03762f8601c7db6`.
The [baseline](../../test-results/scratch/canonical-workflow-sNLxrP/baseline.json)
inventories 396 starting source/generated files and 18,564 pre-existing output/dist
files. Byte copies in `starting-source/`, the [incoming patch](../../test-results/scratch/canonical-workflow-sNLxrP/incoming.patch)
and [starting status](../../test-results/scratch/canonical-workflow-sNLxrP/status.txt)
preserve incoming tracked/untracked work, `.DS_Store`, the merge-readiness plan,
reports, evidence and generated revision. Incoming changes are not attributed to
this pass by a combined HEAD-relative diff.

Read root instructions, documentation authority, foundation ledger, release roadmap,
validation safety, runner closure, browser triage, Guided repair, Read the Code and
evidence/operations. Relevant requirements: design §§5.1–5.5, 6.3, 8.1–8.5 and 10;
proof plan FP-01/FP-10/FP-11/FP-12 and §§6 M4–M6; R1 protection scope. Epoch/state
ownership, bounded pre-execution admission, immutable recording/source identities,
native readable arithmetic, contextual capability restrictions and explicit missing
coverage remain governing. No material design conflict requiring a new decision was
found. No tour, curriculum, default entry, renderer or selection/navigation redesign
is included.

## Reproductions and resolved contracts

The [starting-source reproduction](../../test-results/scratch/browser-jQhecU/report/results.json)
and [source receipt](../../test-results/scratch/browser-jQhecU/source.json) retain
three failures on the refreshed starting runtime:

1. Unfaulted shared canonical execution publishes a worker result but leaves the
   inspector saying “Executing selected producer…” with busy unresolved. `sync`
   treats its own successful archive publication as an unrelated store replacement,
   increments the inspector operation, clears selection and cancels completion.
   The binding also reads the exact receipt ID from its captured pre-publication store.
2. Original BF-027 reaches Clear, fresh completed Predict and then blocks at its
   second data-experiment button. Clear deliberately restores `attract=true`;
   workbench Predict does not claim live activity, while experiment visibility
   requires `!attract`. The missing button prevents the old late-result assertion
   from being reached.
3. Original BF-042 opens `forwardSequence`, containing only delegation. Its unchanged
   `combinedHeads.push(...headOutput)` assertion fails despite the arithmetic being
   present in `forwardSequenceForDefinition`.

The new publication callback belongs to the originating inspector request. After
successful retention commit, the shell supplies the authoritative EvidenceStore
before its next synchronization. Only the still-current request may adopt that
publication; its player is rebound over immutable retained evidence. Completion
returns the exact run ID and published evidence authority. The registered canonical
binding resolves that ID there, verifies producer identity and never chooses the
latest run or copies evidence into the old store. Refusal/failure cannot reuse a
preceding successful receipt. Normal completion clears busy once. Unrelated store
replacement clears busy with a superseded status, and reset/import, cancellation,
producer/run selection invalidate stale continuations. Cleanup cancels only the
request's own reservation; a stale catch cannot cancel a newer request's reservation.
An import rechecks ownership after asynchronous commit as well as admission.

The [retention boundary probe](../../test-results/scratch/canonical-workflow-sNLxrP/retention-boundary-confirmed.json)
first verifies the actual portable manifest encoding, then reaches the unchanged
manifest byte-budget refusal. Prediction manifests have `directRuns` and `snapshots`,
and do not contain `trainingStep`. The old `runs`/`trainingStep` predicate has zero
hits. The repaired browser injection is armed only after a successful prediction,
matches the actual portable format/record fields and asserts exactly one boundary
hit, zero new canonical prediction transport, unchanged retained history/selection,
no success status, and settled controls. The earlier incomplete probe is retained
separately in `retention-boundary.json`, with zero hits and no refusal; it proves none.

Successful, retained workbench Predict now establishes live activity in `execute`,
including the shared route, before final rendering. Clear keeps its intended recorded
opening state until an authorized fresh action. Visitor/facilitator capability
omissions remain. The original M3-D held/late scenario now reaches both experiment
requests, receives the injected old-generation late response, publishes neither
receipt, and returns to the exact initial accepted snapshot, optimizer step and
source/runtime identity. Every experiment family also completes and returns to an
unchanged canonical accepted state in the existing M3-D integration route.

Forward mappings that previously targeted the wrapper now target the executed
`forwardSequenceForDefinition`. The source view identifies the canonical wrapper's
delegation relationship and hashes the original bundled model source file. Extraction
recognizes generator declarations independently of a hardcoded symbol list. Tests
inspect the actual extracted arithmetic, wrapper delegation, all displayed neighboring
forward/training symbols, backward accumulation and explicit unmapped symbols.
No model code, arithmetic, fixtures, oracle, tolerance or numerical policy changed.
Current offline source remains bundled; saved historical evidence retains its declared
runtime and explicitly reports an unbundled body instead of substituting current code.

## Validation ownership and environment

Before checks, audited package hooks, ordinary browser/HTTP wrappers/configs,
ordinary/slice/test allocators, custom evidence/handoff writers, runner subprocess/log
cleanup, installed Playwright output cleanup/reporting and Vite outDir handling.
[Browser writer inventory](../../test-results/scratch/canonical-workflow-sNLxrP/writer-audit.txt)
and [core writer inventory](../../test-results/scratch/canonical-workflow-sNLxrP/core-writer-audit.txt)
retain searches. The same closure from the safety/runner reports applies: fresh
immediate scratch children, build/runner/report/cache/temp/npm ownership, durable
per-attempt evidence and read-only historical inputs. No existing path is adopted,
emptied or deleted. T10 uses its existing fresh allocator without an override.
Only the audited npm pretypecheck hook refreshes working `runtime/revision.ts`;
original bytes are preserved. Existing `dist` is not a build destination.

The initial [sandbox attempt](../../test-results/scratch/browser-Ii3TIZ/failure.json)
failed at local preview bind (`EPERM`), before browser execution. The next
[attempt](../../test-results/scratch/browser-NAxYyM/report/results.json) failed browser
launch: installed Playwright 1.63.0 expects Chromium 1243, which is absent. Neither
proves product behavior. All executable browser checks use the installed Chromium
headless shell 1234, **Google Chrome for Testing 151.0.7922.34**, through the
[scratch-only launch adapter](../../test-results/scratch/canonical-workflow-sNLxrP/installed-browser.mjs)
in `NODE_OPTIONS`. This explicitly selects an existing executable; no revision alias,
download, installation, dependency/settings/config change or native service launch
occurred. This tool/browser pairing is an environment qualification limitation.

The first added-control run remains [19 passed / 2 failed](../../test-results/scratch/browser-yBmbOl/report/results.json):
the new Clear control tried to open the modal through an Attract activation click,
and added M3-D step assertions addressed Guided-only DOM fields in spatial mode.
The controls now wait for the actual opening state, explicitly Predict before shared
inspection, and inspect the returned accepted snapshot/source. Original late-result
and arithmetic assertions remain. The intermediate [22/22](../../test-results/scratch/browser-u0zBrA/report/results.json)
belongs to runtime `2a1ea960…`, before the final request-owned cleanup guards; it is
not transferred to final source. A sandbox runner-regression attempt retained `EPERM`
signal cleanup failures; read-only process inspection found no remaining owned
synthetic children. Its unrestricted fresh rerun passes without modifying the helper.

## Final source and scoped results

Final working-source runtime:
`sha256:896bbf46b599076733dc2f6d7092805e7a318b9c29d909b9a8492b0d537c2ed0`
(140 ordered production inputs). [Read-only source identity](../../test-results/scratch/canonical-workflow-sNLxrP/final-runtime.json).
Branch/HEAD remain the starting branch/HEAD; this is dirty-source qualification.

Browser commands below use the explicit scratch launch adapter. The final focused
22-case command additionally sets `WORKFLOW_HISTORICAL_CANONICAL` to the preserved
read-only `browser-BfHAgU/evidence/test-XHAe1u/canonical-saved.json`. The artifact
retains its genuine original runtime, bytes and values. Without that input the new
source test exercises an explicitly synthetic unsupported-revision control, with no
new skip. A broad synthetic control does not replace the focused historical witness.

| Command / scope | Final result and artifacts |
| --- | --- |
| `npm run test:browser -- tests/browser/canonical-workflow.spec.ts tests/browser/shared-repairs.spec.ts tests/browser/m3-d-integration.spec.ts tests/browser/truth-v2.1.spec.ts tests/browser/m2-a-spatial.spec.ts --workers=1` | **22/22 passed**, no skips/flaky. [Report](../../test-results/scratch/browser-psywJ7/report/results.json), [source/argv](../../test-results/scratch/browser-psywJ7/source.json). Exact published receipt, invalid input/budget/worker failure, cancel/reset/import/run/producer changes, reset capability restoration/restrictions, M3-D, actual arithmetic, current/historical offline source, canonical/noncanonical world and saved replay. |
| `npm run test:browser -- tests/browser/guided-lifecycle-repair.spec.ts tests/browser/visual-guided.spec.ts --grep 'acknowledged update\|fresh ten\|genuine retained\|persistent archive\|tenth accepted\|withheld unacknowledged\|ten accepted updates' --workers=1` | Same latest ten identities: **10/10 passed**, no skips/flaky. [Report](../../test-results/scratch/browser-D4rdqK/report/results.json), [source/argv](../../test-results/scratch/browser-D4rdqK/source.json). |
| Identical ten-case selection, `--workers=2` | **10/10 passed**, no skips/flaky. [Report](../../test-results/scratch/browser-sc7SeQ/report/results.json), [source/argv](../../test-results/scratch/browser-sc7SeQ/source.json). Serial/concurrent counts are not 20 distinct proofs. |
| `TSX_DISABLE_CACHE=1 node --import tsx --test` with model/trace and explicit affected state/archive/experiment/source selections | **149 passed / 5 existing prerequisite skips**, zero failures, 154 selected. [Final log](../../test-results/scratch/canonical-workflow-sNLxrP/focused-core-final.log). Earlier core log is a separate intermediate attempt. [Exact command inventory](../../test-results/scratch/canonical-workflow-sNLxrP/commands.json). |
| `PYTHONDONTWRITEBYTECODE=1 npm run test:reference` | **17 Python tests passed**, strict portable exact structure/identity and numerical conformance, zero differing floats. [Log](../../test-results/scratch/canonical-workflow-sNLxrP/reference.log). |
| `TSX_DISABLE_CACHE=1 node --import tsx --test tests/integration/ordinary-runner.test.ts tests/integration/ordinary-output.test.ts` | **15/15 passed**, fresh synthetic outputs. [Final log](../../test-results/scratch/canonical-workflow-sNLxrP/runner-regressions-final.log). Intentional synthetic flaky attempt and bounded disposal failure are asserted negative controls inside passing regressions. |
| Direct installed `tsc --noEmit`; npm browser/HTTP pretypecheck and owned builds | Passed; generated identity only through audited hook, no default build/dist cleanup. Existing Vite chunk advisory retained. |
| `npm run test:http` | **1/1 passed**, no skips/flaky. [Report](../../test-results/scratch/http-T7pTKU/report/results.json), [source/argv](../../test-results/scratch/http-T7pTKU/source.json). Insecure-origin hashing, canonical training, noncanonical execution, replacement/data receipts and archive export/import. |

## Broad working-source baseline

The audited broad suite ran **once**, after scoped checks, with `npm run test:browser --
--workers=2`, matching the earlier broad concurrency setting: **147 passed / 16 failed /
14 skipped**, zero flaky, **177 selected**, 1,090.944373 seconds (18.2 minutes).
[Complete report](../../test-results/scratch/browser-3xM7ar/report/results.json),
[source/argv](../../test-results/scratch/browser-3xM7ar/source.json),
[console/stage log](../../test-results/scratch/browser-3xM7ar/playwright.log), and
[failure/cleanup receipt](../../test-results/scratch/browser-3xM7ar/failure.json)
retain the unsuccessful suite exit and zero cleanup errors. This is the new working-
source baseline, not a passing full suite.

The [complete per-test baseline](../../test-results/scratch/canonical-workflow-sNLxrP/browser-baseline.json)
records all 177 identities, current/prior outcomes, full errors, annotations,
attachments, assertion boundaries, original BF IDs and the tool/browser environment.
The [dated triage index](browser-failure-triage.md#2026-10-02-canonical-workflow-correctness-disposition)
individually lists every one of the **16 failures and 14 skips**. All 30 remaining
identities retain their previously observed boundary/classification; comparing full
records and their failing assertion/control sites found **no newly failing previously
passing identity and no newly exposed downstream failure**. Later assertions beyond
those 16 stopping boundaries remain unrun, not implicitly passed. BF-027/BF-035/BF-042,
all ten new controls and the preserved ten-case Guided selection pass in this broad
invocation too. The renamed held/unacknowledged cancellation control is identified
separately from its original BF-051 title and original failed evidence.

Remaining failure scopes: BF-001–BF-005 legacy public-entry/reset/short-guide/budget
controls; BF-006 fixed local-construction width (302.1175231933594 versus >400);
BF-007/BF-008 complete scalar capture versus explicit derived-cache refusal;
BF-034 summary wording; BF-017/BF-019/BF-020/BF-036/BF-038 missing native/fixture
inputs or their undefined-route preflight; BF-039/BF-040 viewport/overflow geometry.
These are retained contract/prerequisite/unresolved findings, not authorization to
redesign or suppress them. The skipped cases require MLP/Pythia live or verified
shutdown/offline inputs, grouped/shape-only/opaque recordings, cross-world saved
witnesses, generation captures and near-limit mixed archives. M4-E's optional Route B
Pythia and Route C near-limit branches remain **NOT_RUN** (CG-01/CG-02), despite the
parent passing. Genuine historical canonical source input was supplied only to the
focused run; the broad source-availability case uses its declared synthetic refusal
control. Neither replaces a heterogeneous witness.

This baseline includes the incoming completed runner/Guided repairs, which had only
scoped verification before this broad invocation. Improvements to their original
failures are not attributed to this incremental three-defect pass. Earlier counts
remain unchanged in their historical reports; every current result was executed.

## Preservation and qualification limits

Implementation scope is inspector/executor/publication wiring, workbench live-state
ownership, source mappings/extraction and focused tests. Documentation scope is this
report, index linkage and appended triage disposition. [Incremental manifest](../../test-results/scratch/canonical-workflow-sNLxrP/incremental-changes.json)
and [patch](../../test-results/scratch/canonical-workflow-sNLxrP/incremental.patch)
compare starting byte copies, not HEAD. The
[final preservation receipt](../../test-results/scratch/canonical-workflow-sNLxrP/preservation-final.json)
checks every incoming source outside that scope and all 18,564 protected output/dist
files: none missing or changed. Original generated revision bytes remain in the
starting snapshot; only the working generated output was refreshed.
[Mechanism preservation](../../test-results/scratch/canonical-workflow-sNLxrP/mechanism-preservation.json)
also explicitly checks 63 mathematics/fixture/oracle/backend/archive/acknowledgement
and prior runner/Guided helper/test files, all unchanged. Link/anchor, whitespace,
branch/HEAD, staging and read-only runtime checks live in the final receipt.

The optimized shared archive boundary still lacks current native Pythia live/generation
and offline recordings, actual MLP/SGD, grouped-axis numerical, shape-only/opaque and
near-limit heterogeneous archive witnesses. The five core skips identify actual
MLP recordings, grouped/shape-only/opaque fixtures, train-many supplied boundary,
payload-backed Pythia generation and optional real native replay. Canonical/noncanonical,
local experiments and a passing optional parent route do not qualify those branches.
Broad native failures/skips remain explicit above. No full heterogeneous foundation
portfolio, canonical-environment byte regeneration, aggregate acceptance, isolation
installation, independent M5, unfamiliar-user study, workshop/station or release
acceptance is performed. Stop after these repairs, scoped verification and baseline.

No staging/commit, branch switch/reset, other repository/settings mutation,
install/upgrade/download, resource-limit or timeout change, new suppression skip,
fixture/golden/tolerance rewrite, push, publication or deployment occurred.
