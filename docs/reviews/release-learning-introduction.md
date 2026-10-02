# Introductory release learning slice — 2026-10-02

Implemented opt-in `/?experience=learn`: opening, prediction and representation,
with render-only depth, explicit Explore/Resume and same-session workbench access.
The [journey contract](../design/release-learning-journey.md) maps all six chapters;
only the opening and first two chapters were redesigned. Existing attention and
later learning capabilities retain their scope. This engineering review does not
grant comprehension, foundation, independent M5, full-suite or release acceptance.

## Starting identity, authority and preservation

Branch `pre-m5-abq-experience`, HEAD
`ffb2db9217dac8ff3195fc2943918656daa78b59`, with no staged changes. Read-only starting
runtime matched the supplied baseline:
`sha256:6127850b0ef530f1207814d182a364a6ed4614859c307109ecf4c56971659923`.
[Baseline](../../test-results/scratch/release-learning-t9kgdbln/baseline.json),
[starting Git status](../../test-results/scratch/release-learning-t9kgdbln/status.txt)
and [incoming patch](../../test-results/scratch/release-learning-t9kgdbln/incoming.patch)
retain the actual incoming work. Regular byte copies in `starting-source/` include
all 401 starting source/generated files, the ignored `runtime/revision.ts`, `.DS_Store`,
merge-readiness plan, roadmap, prior reports and earlier dirty implementation.
The baseline hashes 33,697 pre-existing evidence/dist files before any test hook.
Generated revision entry bytes were captured contemporaneously, not recovered later.

Root instructions, documentation authority, foundation ledger, roadmap, validation
safety, runner lifecycle closure, Guided lifecycle, canonical workflow and shared
context/navigation reviews govern this change. Design §§3–5/8, proof-plan §§1–3/M5/M6
and R1 evidence protection remain applicable. No requirement is waived; no material
conflict requiring a new gate decision was found. Current user authorization covers
this provisional introductory implementation, not subsequent release chapter rewrites.

## Incremental implementation

Learning is separate from deployment capabilities: explicit classic, kiosk and demo
routes win when combined with the opt-in parameter; otherwise this activity uses
workbench capabilities without event idle reset. Default and existing spatial entries
remain. Activity plumbing invokes the existing lesson controller and canonical driver;
there is no copied model/session, arithmetic, scene implementation or evidence stream.
The existing bootstrap records an authentic initial run. Opening displays that replay
with captured-on-opening provenance; the primary action makes a distinct fresh run.
Explanation navigation never requests prediction/training.

The introductory recipe binds p3 explicitly. `abca` remains the complete example,
`abc` the effective prefix, `a` the known target; p4/END is identified separately.
The full four-output distribution uses original observed values, 0–100% bars, full
support and omitted mass zero. Greedy rank is derived from those values, never substituted
for a sample or empirical accuracy. Optional feedback names this actual run's highest
output and target. Short/no-capture/edited/unsupported states refuse or identify retained
context rather than selecting another row or fabricating zeros.

Representation follows actual p3 c → ID 2 → token embedding and position p3 lookup →
addition → embedding RMSNorm → layer0 pre-attention RMSNorm. Component-zero arithmetic
and original source-bound observations remain available. Vectors, sign and scale are
introduced before their numbers; no quality/semantic meaning is assigned to dimensions.
Both initial normalizations, epsilon, feature reduction and saved residual identity
remain in the existing Math/Source bindings. The Continue action enters existing Q/K/V
attention in the same run; it does not claim later curriculum redesign.

The shared scene collapses its operation group into semantic overview cards; expanding
reveals the same operation nodes. Cards declare structural overview and encode no
invented numerical quantities. Values/Math/Source keep run and occurrence; temporary
member selection is visibly local/render-only. Return restores lesson context/focus.
Camera gestures preserve activity. Explicit Explore/Resume and Open workbench/Return to
lesson, including Classic presentation and the existing multilayer world, preserve the retained lesson computation and accepted state. Active work blocks
activity changes; the release header offers explicit Cancel active work or Discard
candidate. The existing controller continues to own later training actions/receipts.

Only BF-040's line-17 camera expectation was reconciled from “Explore” to “Camera
adjusted · explanation paused”. The later viewport/overflow, arithmetic, learning and
interaction assertions are unchanged. Their current reached/unrun boundary is recorded
with the complete broad results below; no geometry assertion or timeout was weakened.

## Validation ownership and environment

[Writer audit](../../test-results/scratch/release-learning-t9kgdbln/writer-audit.md)
and [core writer inventory](../../test-results/scratch/release-learning-t9kgdbln/core-writer-audit.txt)
cover package hooks, ordinary/slice/test allocators, runner stage/log/child cleanup,
Playwright outputs, custom evidence and isolated test copies. Browser/HTTP use fresh
immediate scratch children and owned builds with `--emptyOutDir false`. Historical
outputs and checkout `dist` are never cleanup/build destinations. Core tests use
fresh synthetic roots or T10's fresh allocator; no historical path overrides.

[Actual environment](../../test-results/scratch/release-learning-t9kgdbln/environment.json):
Node v24.21.0, TypeScript 7.0.2, Vite 8.2.2, Playwright 1.63.0, darwin-arm64.
Expected Chromium 1243 remains absent. The
[scratch-only launch adapter](../../test-results/scratch/release-learning-t9kgdbln/installed-browser.mjs)
was copied byte-for-byte from the prior documented method and uses existing headless
shell 1234 / Google Chrome for Testing 151.0.7922.34. This pairing limits qualification.
No install, download, revision alias, setting change or output-protection bypass.
The initial sandbox browser attempt stopped at localhost preview EPERM before product
execution; permitted reruns used the same audited entrypoint with fresh allocations.

Final working-source runtime:
`sha256:16b013519441271105843cbec11b6055d565a09aad07425a6e889645c20cc9dd`
(142 ordered production inputs). [Read-only identity](../../test-results/scratch/release-learning-t9kgdbln/delivery-return-identity.json).

| Command / actual scope | Result and evidence |
| --- | --- |
| `TSX_DISABLE_CACHE=1 PYTHONDONTWRITEBYTECODE=1 npm test` | Delivery runtime: **375 passed / 12 prerequisite skips**, 387 selected, no failures. [Final log](../../test-results/scratch/release-learning-t9kgdbln/core-return-final.log). Includes two new authentic-run introductory cases. Missing native/generation/fixture inputs are skips, not passes; the [12 identities](../../test-results/scratch/release-learning-t9kgdbln/core-skips.json) retain exact omissions. |
| `PYTHONDONTWRITEBYTECODE=1 npm run test:reference` | **17 Python tests passed**, strict portable structure/identity/numerical conformance, zero differing floats. [Log](../../test-results/scratch/release-learning-t9kgdbln/reference.log). Arithmetic/fixtures unchanged throughout. Canonical environment byte regeneration not run. |
| `TSX_DISABLE_CACHE=1 npm run example` | Passed; authentic abca p3 target probability 0.3591443770854818 → 0.4070454916035887 after one update, 896 parameters, step 1. [Log](../../test-results/scratch/release-learning-t9kgdbln/example.log). This example preceded final presentation-only edits; mechanism bytes are unchanged, not a final-runtime browser claim. |
| `npm run test:browser -- tests/browser/release-learning.spec.ts --workers=2` with scratch adapter | Final **7/7 passed**, no skips/flaky. [Report](../../test-results/scratch/browser-MmR8g4/report/results.json), [source/argv](../../test-results/scratch/browser-MmR8g4/source.json), [log](../../test-results/scratch/browser-MmR8g4/playwright.log). Covers desktop, compact/reduced motion, mobile/reduced motion, legacy entry compatibility, active work/cancel and existing attention handoff, Classic return and existing multilayer world return. |
| `./node_modules/.bin/tsc --noEmit`; npm pretypecheck and owned Vite builds | Passed. Final focused/broad/HTTP allocations retain npm typecheck and build logs. Existing chunk-size advisory remains. No build targeted checkout dist. |
| `npm run test:http` with scratch adapter | Final **1/1 passed**, no skips/flaky. [Report](../../test-results/scratch/http-Vgc113/report/results.json), [source/argv](../../test-results/scratch/http-Vgc113/source.json). Functional HTTP coverage overlapped the broad run; no throughput claim. |

Intermediate records remain separate. `browser-WtDuqj` stopped on the initial replay
label binding; `browser-CUxPku` reached all visual/navigation states and stopped on a
missing custom dock test ID. Those defects were fixed. `browser-KEBu7v` and
`browser-5lojUo` each passed the earlier three-case set; `browser-dSKmbQ` passed its
five-case set. `browser-f3aRsd` passed 25 introductory/preserved controls on runtime
c120fe4f… before the final activity/cancel refinement. `browser-tmJwSK` passed 22 and
failed four: three newly added strict member locators matched both member navigation
and component buttons, and the later handoff test sought an absent execution-cancel
control. The locator is now precise and the visible explicit cancel action implemented;
the later six-case run verified both; the final seven-case run additionally verifies Classic and multilayer-world return. These intermediate results are retained, never
transferred as final-source qualification. Earlier core runs remain separate in the
owned output. No blanket timeout/budget/tolerance change was used.

## Rendered inspection

Final source-bound captures, all inspected in this pass:

| State | Desktop 1920×1080 | Compact 1280×720, reduced motion |
| --- | --- | --- |
| Opening | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-34vIwS/opening.png) | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-rQZ1Sf/opening.png) |
| Prediction | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-34vIwS/prediction.png) | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-rQZ1Sf/prediction-table.png) |
| Representation | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-34vIwS/representation.png) | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-rQZ1Sf/representation-values.png) |
| Values | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-34vIwS/values.png) | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-rQZ1Sf/values.png) |
| Math | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-34vIwS/math.png) | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-rQZ1Sf/math.png) |
| Source | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-34vIwS/source.png) | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-rQZ1Sf/source.png) |
| Explore | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-34vIwS/explore.png) | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-rQZ1Sf/explore.png) |
| Resume | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-34vIwS/resumed.png) | [Screenshot](../../test-results/scratch/browser-MmR8g4/evidence/test-rQZ1Sf/resumed.png) |

Additional mobile 390×844 [opening](../../test-results/scratch/browser-MmR8g4/evidence/test-xCqm3w/opening.png)
and [all-output table](../../test-results/scratch/browser-MmR8g4/evidence/test-xCqm3w/prediction-table.png)
were inspected. Header actions wrap, primary actions remain visible, route buttons
meet the new 44px/viewport checks and the document has no horizontal overflow.
Compact/mobile explanation bodies scroll intentionally; the pinned action bar keeps
Continue/detail/Explore reachable. The existing floating Models & saved evidence
control remains at the lower right; users scroll longer explanatory content. World
Explore is a pannable viewport and can crop neighboring stations; the selected run,
occurrence and resume actions stay visible. No entire-world-fit claim is made.

Visual iteration replaced tiny SVG overview labels with responsive structural cards
and changed Values columns to fit original components. The
[read-only bar geometry probe](../../test-results/scratch/release-learning-t9kgdbln/bar-geometry-return.json)
confirms each bar uses its original probability on a common 223.1875px 0–1 track,
subject only to browser pixel quantization. [Probe source](../../test-results/scratch/release-learning-t9kgdbln/bound-return-probe.mjs).
Exact probabilities, artifact IDs and navigation command lists are retained in
[desktop audit](../../test-results/scratch/browser-MmR8g4/evidence/test-34vIwS/audit.json)
and the corresponding compact/mobile audit files. These checks establish implemented
behavior and rendered readability, not unfamiliar-user comprehension.

Additional advanced-world probes tried canonical evidence's **Open in continuous
world**. That action is explicitly unsupported by its registered world availability;
both attempts stopped on the disabled button before opening any world. The
[refusal receipt](../../test-results/scratch/release-learning-t9kgdbln/additional-world-refusal-return.json)
retains the available control and explains the stopping boundary. This is not a
passing cross-model return test. Return from a newly selected native or shape-only/opaque registered
world remains outside the demonstrated native/opaque coverage; no new model/fixture was synthesized.

## Broad baseline and remaining coverage

The first broad attempt, [browser-T6aoyt](../../test-results/scratch/browser-T6aoyt/report/results.json),
was intentionally interrupted for a final code-audit repair. Its JSON statistics are
152 expected / 16 unexpected / 19 skipped in 1,018.779288 seconds; the reporter
separates 14 actual skips, two interrupted cases and three not-run cases. These are
**partial results, not a baseline**. [Interruption receipt](../../test-results/scratch/browser-T6aoyt/interruption.json)
records SIGINT and zero cleanup errors. The initial sandbox signal attempt was refused;
the owned runner was then stopped using its permitted audited cleanup before source edits.

The audit found that workbench Classic could implicitly cancel active work and hid the
new lesson return control. The return action now binds across spatial, Classic and
registered world headers, refuses active work, clears only presentation overrides and
restores the retained lesson binding. Classic switches on this opt-in route likewise
refuse active work; other entries keep their prior behavior. Returning resets the lesson
presentation cache, not runtime state. A new existing-multilayer witness explicitly
executes that producer, opens its world, returns with zero new Worker commands, then
explicitly predicts canonically and verifies unchanged complete snapshots/probabilities.
[Earlier six-case return repair](../../test-results/scratch/browser-lyspiw/report/results.json)
passed before that seventh witness was added. The final seven-case run passes on the
corrected runtime. This completes the requested handoff rather than retaining a known
Classic return gap as an untested limitation.

`npm run test:browser -- --workers=2` completed once on the final corrected runtime:
**158 passed / 16 failed / 14 skipped**, zero flaky, 188 selected, 1,132.627391 seconds
(18.9 minutes). [Complete report](../../test-results/scratch/browser-uUZ8F4/report/results.json),
[source/argv](../../test-results/scratch/browser-uUZ8F4/source.json),
[stage log](../../test-results/scratch/browser-uUZ8F4/playwright.log) and
[failure receipt](../../test-results/scratch/browser-uUZ8F4/failure.json) preserve the
unsuccessful suite exit and zero cleanup errors. No retries, suppression or timeout
changes were introduced.

[Exact identity comparison](../../test-results/scratch/release-learning-t9kgdbln/browser-baseline-comparison.json)
compares all 181 prior records with 188 current records: no missing prior identity,
no outcome change, and all seven new identities pass. All current canonical/shared
navigation, public candidate/accept/discard and preserved Guided lifecycle identities
pass on final source. Native/fixture prerequisites remain missing and do not become
passing coverage. The passing M4-E parent still does not execute its missing optional
native and near-limit branches.

The **only changed failure stopping boundary** is BF-040: previous line 17:140's
obsolete camera→Explore assertion now passes; current execution reaches unchanged
line 20:916's viewport/overflow check and fails with expected true / received false.
Later learning and geometry checks in that case remain NOT_RUN after that stop.
BF-006 retains >400 versus 302.1175231933594 at line 41:122. BF-039 retains line
60:137's viewport visibility/overflow stop. The other 15 failure identities retain
the same exact source stopping locations. Full errors, annotations, attachments and
skip declarations are in the comparison and original reports; old results are not
rewritten. The [additive triage](browser-failure-triage.md#2026-10-02-release-learning-introduction-disposition)
retains all 16 failures and 14 skips individually.

## Qualification and stop boundary

Missing real native Pythia/MLP, grouped-axis numerical, shape-only/opaque,
generation, offline/shutdown, supplied train-many boundary and heterogeneous
near-limit witnesses remain distinct qualification gaps. Passing canonical,
noncanonical, matched local experiments and refusal controls do not replace them.
Canonical-environment byte regeneration, aggregate acceptance, isolation installation,
independent M5, full unfamiliar-user comprehension testing, workshop/station and
release qualification are NOT_RUN. Internal engineering, rendered and accessibility
inspection here is not a learning study. An optional check click proves no learning gain.

No native arithmetic, independent oracle, fixtures/goldens, numerical tolerance,
optimizer schedule/budget, recording format, archive policy, backend/model integration,
dependency or remaining chapter rewrite was changed. No staging/commit, branch switch/
reset, other-repository/settings change, download/install, push, publication or deployment.
The requested stop boundary is this implemented introduction and its review package.


## Final incremental preservation

The [incremental manifest](../../test-results/scratch/release-learning-t9kgdbln/incremental-changes.json)
and [patch](../../test-results/scratch/release-learning-t9kgdbln/incremental.patch)
compare against contemporaneous starting bytes, including ignored generated revision;
they do not attribute earlier contributors' combined HEAD diff to this task.
[Final preservation receipt](../../test-results/scratch/release-learning-t9kgdbln/preservation-final.json)
checks all 33,697 pre-existing evidence/dist files, incoming source outside this slice,
mechanism files, exact generated identity, branch/HEAD/staging and new document links,
anchors and whitespace. All protected outputs and unowned source bytes match. The
triage is an additive suffix over its original bytes; previous reports and identities
remain unchanged. No new qualification follows from an unchanged mechanism hash;
executed checks and their source scopes are recorded separately above.
