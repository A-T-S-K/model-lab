# Release preparation: browser/HTTP output ownership

This is scoped working-source tooling verification and a release-contract proposal.
It grants no M5, unfamiliar-user learning validation, M6 or release acceptance.
Production computation, native bindings, canonical fixtures, oracle, numerical
policies, historical reports, release workflows and dependency versions are unchanged.
The next product pass is shared selection/context correctness, followed by the guided
tour into cohesive exploration; see the [roadmap](../release-roadmap.md).

## Source identity and scope

Starting state matched the supplied baseline: branch `pre-m5-abq-experience`, HEAD
`ffb2db9217dac8ff3195fc2943918656daa78b59`, runtime
`sha256:50cde244e714b305a53f6be6963f862375c28cf66a52e522265dce897342b099`.
There were no staged or tracked changes; `.DS_Store` and
`docs/merge-readiness-plan.md` were pre-existing untracked work and remain preserved.
The merge plan was read as context, never as authorization.

Final HEAD and branch remain the same. This is a dirty, unstaged working checkout,
not an exact candidate. Final runtime is
`sha256:cb0ff18267668a33b2a6f97fa7ca1d96a4dc7d5103ceafeda9bf2f9d6c847c98`.
Only the two package script strings changed among runtime inputs; package.json is
hashed, so the prior runtime's passes do not transfer. The audited pretypecheck hook
regenerated ignored `runtime/revision.ts`; its original bytes were saved first.
No branch switch/reset, staging, commit, installation, weight download, publication,
remote write, other-repository edit or exact-candidate qualification was performed.

Changes are the two default Playwright configs, `scripts/run-browser.mjs`, ordinary
output/stage helpers and regression tests, browser evidence helper/override guards,
26 browser/HTTP test files' output plumbing, and the roadmap/index/this report.
[Assertion preservation](../../test-results/scratch/release-review-5KboIi/assertion-preservation.json)
compares 1,351 extracted assertion, skip, timeout and video/configuration calls across
the 26 changed test files with HEAD: all unchanged. Test titles, selection,
mathematics, tolerances, meaningful screenshot subjects and existing optional-witness
prerequisites were retained. No failing assertion became a skip.

## Audited command closure and writers

Before running either entrypoint, read root instructions, document authority and
foundation ledger, design §§3/8/10, proof plan §§6/7, R1 recovery, package scripts,
all browser/HTTP custom writers, existing ownership helpers, default/slice/qualification
configs, and installed Playwright/Vite cleanup code. Recorded hashes of 4,943 existing
output/dist/generated/prior-work files before edits. No existing historical output or
dist was passed to cleanup. The old unsafe browser commands were not executed.

[Complete custom writer inventory](../../test-results/scratch/release-review-5KboIi/custom-writer-inventory.json)
records before/after source locations for all 46 browser/HTTP writer files, including
unchanged fixture users. The original search and final search are retained alongside
it. The closure below includes framework writers and subprocesses as well as tests.

| Reachable writer | Previous destination / cleanup | Current owned destination / cleanup |
| --- | --- | --- |
| npm browser/HTTP hooks | No prebrowser/prehttp hooks; raw Playwright directly | Wrapper allocates before any hook or child. Both supported npm entrypoints remain. |
| Typecheck prehook | `runtime/revision.ts`, truncating generator; not runner output | Same explicit generated identity write, audited and original bytes preserved. `tsc --noEmit` writes no compiled output. |
| Vite verification build | Defaults consumed existing `dist`; ordinary external build could empty it | Fresh allocation `build/`; `vite build --outDir <owned> --emptyOutDir false`. No cleanup of pre-existing dist; source workers/assets built there. |
| Vite preview / config loader | Preview read `dist`; HTTP bundled config wrote/unlinked timestamp files in `node_modules/.vite-temp` | Preview reads only current `build/`; HTTP uses native config loader, eliminating that temp-file writer. Existing server reuse remains false. |
| Playwright output, `.last-run.json`, attachments, failure context, traces and fixture videos | Fixed `scratch/playwright-artifacts` / `scratch/playwright-http-artifacts`; recursive runner and per-test cleanup | `runner/playwright/`, unique invocation. Runner may clean this disposable subtree only; failed artifacts stay in that invocation. |
| Reporters | Default console; CLI/environment could redirect JSON/HTML/blob/JUnit or custom reporters; HTML/blob may recursively clean | Explicit list plus `report/results.json`; reporter/output/add-reporter/last-run overrides refused before allocation. Durable reports are siblings of runner. |
| Playwright transform cache, browser profiles/temp downloads | Shared OS temp/cache, env-selectable | `cache/` via PWTEST_CACHE_DIR and `temporary/` via TMPDIR/TMP/TEMP. Child overrides are owned; external cache/source-transform overrides refused. TSX disk cache disabled before registering loader. Framework may clean its own temporary files. |
| Historical fixed screenshots | `test-results/model-lab-*`, `gate4-*`, `gate5-*`, `gate6-*`, `gate7-*`, `gate8*`, `release-*`, guided/exhibit images; overwriting writes | Fresh `evidence/test-*/<original meaningful filename>`; no custom evidence cleanup. Includes model-lab, exhibit-v2, guided-v2.1 and all visual specs in inventory. |
| Spatial paced/learning/Wave 1B/1D/2A/2B JSON, screenshots and route videos | Fixed `/tmp/model-lab-wave*` or `test-results/wave2*-review`; recursive mkdir and truncating writers; env overrides | Per-test/per-attempt evidence child. Wave 2B manual recordVideo is there; fixture videos stage under runner and explicit saveAs persists route media in evidence. |
| ABQ overnight and end-to-end-fixes browser specs | `test-results/abq-overnight/focused`, `test-results/end-to-end-fixes/focused`, ABQ/FIXES env overrides; shared across parallel tests | Per-test/per-attempt evidence, including each viewport and reset matrix. Historical standalone rehearsal tools remain separate/out of scope. |
| Existing M1–M4/shared/spatial/learning-stop evidence fixture writers | Required slice metadata; ordinary default runs could not allocate custom evidence | Same slice allocator plus ordinary metadata, unique evidence children; screenshots, JSON and manual recordVideo all contained. |
| Pre-M5 ordinary screenshots | `testInfo.outputPath`, inside runner cleanup | Durable per-test evidence. Exact-candidate capture/manifest/runtime paths stay governed by unchanged qualification context. |
| M2-B/M2-D/M4-A live handoff mkdir/JSON | Any old allocated scratch root supplied by HANDOFF env; one shared `live/` destination could collide | Ordinary `handoff/test-*/live/`, fresh per test/attempt, separate from runner/evidence/report. Slice handoff contract remains; offline HANDOFF env is read-only input, never adopted as output. |
| Saved archives / download.saveAs | HTTP archive in runner; M4 archive roundtrip files in slice evidence | HTTP archive in durable per-test evidence; M4 export/tamper/re-export files continue in fresh evidence fixture dirs. Browser temporary download staging is disposable owned temp. |
| Replay/fixture inputs | M1 saved dirs, native response pairs, WITNESS recordings, M2E replays, NATIVE_GENERATION_RECORDING and M4 historical archives | Read-only external inputs; not copied into cleanup roots. Shared replay pair checks use current config metadata and refuse inputs inside current output. Optional producers are not launched/downloaded by these entrypoints. |
| Nested npm diagnostics/cache | Child npm run hooks used host npm cache/log settings | Child npm cache/logs redirected to `npm-cache/` and `npm-logs/`; no install commands. Top-level npm’s own host diagnostics precede the script and are outside project evidence ownership. |
| Wrapper stage logs and lifecycle receipts | Absent | Exclusive allocation/invocation/source/completion/failure/interruption receipts and typecheck/build/playwright logs at allocation root; no deletion. |
| T10, separately checked | Existing R1 fresh scratch allocator, exclusive performance/receipt writes | Unchanged; default fresh `training-*`. No T10 override or historical fallback used. |

Each invocation owns a new immediate child of `test-results/scratch`. Explicit
`BROWSER_EVIDENCE_DIR` must be a fresh child (relative or absolute). Existing paths
fail with EEXIST: no delete/retry or adoption. Ancestors, receipt aliases and child
paths are checked; traversal, symlinks and unowned roots refuse. Private fresh dirs
and exclusive writes protect ordinary runs, not an adversarial process swapping
ancestors between syscalls. Allocation has no cleanup API.

Configs never allocate. The wrapper gives config loaders/workers the current token,
profile and live owner; directory inode/device, markers and completion state are
checked. External internal-token exports are refused before allocation, and finished
or dead-owner contexts cannot be reused. Custom evidence caches a single fresh child
per TestInfo and records test ID, title, project, retry/repetition and worker metadata.
Fresh attempts and parallel tests cannot overwrite each other's original filenames.

SIGINT/SIGTERM forward to the active POSIX child process group; logs drain and an
interruption receipt remains. A kill that cannot be handled (SIGKILL, power loss)
can leave allocation/partial files without a final receipt: absence is not success.
Windows process-tree interruption was not qualified. Both profiles keep their original
ports; simultaneous same-profile runs can refuse a port collision while retaining
separate output allocations. Output repeatability is not automatic port arbitration.

Use `npm run test:browser -- <test filters/worker/retry options>` or
`npm run test:http`. For an explicit output, set
`BROWSER_EVIDENCE_DIR=test-results/scratch/<new-name>`; never reuse it. Output,
reporter, add-reporter, config, last-run-file, snapshot-update, UI and external test-list
CLI overrides are refused. Legacy writable evidence envs, reporter/last-run/cache envs,
source-transform injection and inherited ordinary/qualification context are refused.
Offline handoff variables remain read-only inputs. Default configs require the wrapper;
raw Playwright is not a supported bypass. Slice/exact-candidate entrypoints retain their
separate ownership and clean-candidate prerequisites.

## Verification record

Final focused checks and browser/HTTP results are recorded below. Invocation directories
contain exact argv, HEAD/tree, dirty status and runtime source identity plus stage logs.

| Check | Result and retained output |
| --- | --- |
| `TSX_DISABLE_CACHE=1 node --import tsx --test tests/integration/test-output.test.ts tests/integration/slice-output.test.ts tests/integration/ordinary-output.test.ts` | Final 17/17 passed, zero skips/failures. Synthetic trees only for refusal/cleanup; actual stage failure and signal tests retain bytes/receipts; actual Playwright workers plus one deliberately flaky synthetic test retain three attempts and reuse one allocation. [Log](../../test-results/scratch/release-review-5KboIi/model-lab-helper-tests-release.log). |
| `env -u TRAINING_EVIDENCE_DIR TSX_DISABLE_CACHE=1 node --import tsx --test tests/integration/training-execution.test.ts` | 26/26 passed, no skips/failures; fresh [T10 allocation](../../test-results/scratch/training-MWJLLi/allocation.json). Mathematics and output lifecycle unchanged. [Log](../../test-results/scratch/release-review-5KboIi/model-lab-t10.log). |
| `./node_modules/.bin/tsc --noEmit`; `npm run typecheck` | Passed, including final helper/runner/test/config types. npm generation hook writes the actual final runtime revision. [npm log](../../test-results/scratch/release-review-5KboIi/model-lab-typecheck.log). |
| Owned build equivalent within both npm entrypoints | `npm run typecheck`, then installed `vite build --outDir <fresh allocation>/build --emptyOutDir false` passed. Existing dist untouched. Vite reports the existing large-chunk advisory; it is not a failed check. |
| Initial repaired browser attempt | Fresh [browser-r9cL0D](../../test-results/scratch/browser-r9cL0D/failure.json): build passed, sandbox EPERM prevented local server listen. Repeated with reviewed local-execution escalation; no evidence cleanup or collision reuse. |
| Next repaired browser attempt | Fresh [browser-Fixf4q](../../test-results/scratch/browser-Fixf4q/failure.json): collection failed on JSON import attributes with the unregistered loader. Wrapper now starts Playwright with the installed tsx loader; no dependency change. |
| Earlier HTTP attempts | Four completed checks, each 1/1 passed, no skips; separate `http-reYtZt`, `http-MvFt5K`, `http-Tvcfif`, `http-vaK4q0` allocations. Intermediate tooling identities are not final-candidate qualification. |
| HTTP repeat preservation | [Before manifest](../../test-results/scratch/release-review-5KboIi/http-repeat-before.json) hashes 213 files in `http-Tvcfif`; repeated HTTP check in a fresh allocation passed 1/1; [comparison](../../test-results/scratch/release-review-5KboIi/http-repeat-preservation.json) has zero differences. |
| Final HTTP plumbing | `npm run test:http`: 1/1 passed, no skips; [http-PCIFH0 report](../../test-results/scratch/http-PCIFH0/report/results.json). Final native config loader, owned temporary/transform/nested npm outputs and durable archive exercised. |
| Broad browser inspection | `npm run test:browser -- --workers=2`: **101 passed, 46 failed, 14 skipped**, zero flaky, 161 selected. [Full report](../../test-results/scratch/browser-BfHAgU/report/results.json), [failure receipt](../../test-results/scratch/browser-BfHAgU/failure.json), [failure/skip index](../../test-results/scratch/release-review-5KboIi/broad-browser-failures-skips.json). This ran during tooling refinement, served intermediate runtime `sha256:895115e323088b734ddff1f17759ab5c67012c965c1e078dd23d804349957188`, and is diagnostic coverage, not a final-tooling/full-candidate pass. |
| Final representative browser repeat | Twice: `npm run test:browser -- model-lab.spec.ts m3-a-interventions.spec.ts --workers=2`. Each **4/4 passed**, no skips/failures, with final runtime and dirty-source receipts: [first report](../../test-results/scratch/browser-iXwJNW/report/results.json), [second report](../../test-results/scratch/browser-H2tJyr/report/results.json). Desktop/mobile authentic arithmetic and matched intervention screenshots/JSON retained. [Before manifest](../../test-results/scratch/release-review-5KboIi/browser-repeat-before.json) hashes 526 first-run files; [comparison](../../test-results/scratch/release-review-5KboIi/browser-repeat-preservation.json) has zero differences after the second run. |
| Scope, documentation and whitespace | Changed scope reviewed, roadmap/review local links resolved, README's new links resolved, `git diff --check` passed. These are documentation checks, not another numerical or user-study pass. |

Installed toolchain: Node v24.21.0, TypeScript 7.0.2, Vite 8.2.2, Playwright
1.63.0 on darwin-arm64; existing Chromium was available. No packages/browsers/weights
were installed or upgraded. Synthetic tests intentionally inject a failing stage,
interruption and a flaky retry: those expected controls pass their assertions and
are distinct from the 46 unexpected broad-browser failures.

The broad failures include current Guided count/depth/budget expectations, entry/reset
and layout assertions, timeout/resource routes, and missing native endpoint/recording
inputs. The full machine index records exact errors and all 14 skips; no wholesale
claim that these are harmless or that final tests passed is made. They require a
separate diagnosis on the repaired path. The entire broad suite was not rerun after
final tooling refinements; the final working-source qualification here is the focused
safety suite, T10, typecheck/owned builds, HTTP and four representative browser tests.

## Preservation and qualification limits

[Final preservation](../../test-results/scratch/release-review-5KboIi/preservation-final.json)
checks all 4,943 baseline files: the only authorized difference is generated
`runtime/revision.ts`. All 4,942 historical/output/dist/prior-work files remain
byte-identical, including `.DS_Store` and the untracked merge-readiness plan. There
were no existing output symlinks in the inspected trees. The original revision bytes
and baseline hashes remain in the owned review allocation. Old and new evidence were
never merged or used to replace missing historical witnesses.

The [final source snapshot](../../test-results/scratch/release-review-5KboIi/source-files.json),
[tracked patch](../../test-results/scratch/release-review-5KboIi/working.patch) and
[changed scope](../../test-results/scratch/release-review-5KboIi/changed-scope.json)
identify this unstaged working result, including new files separately from HEAD.
[Runtime input comparison](../../test-results/scratch/release-review-5KboIi/runtime-input-diff.json)
records the actual runtime-input delta. Lifecycle receipts are working-source records,
not clean-candidate receipts; exact-candidate qualification was not invoked.

Unrun: full final-state default browser suite; reference portable/canonical, aggregate
unit/example/acceptance, isolation/CI, optional live native Pythia/MLP and witness/archive
matrix, clean exact-candidate/public qualification, real SIGKILL/power-loss/Windows
process-tree recovery, unfamiliar-user comprehension, workshop/station and release
qualification. Existing absent witnesses were neither downloaded nor synthesized.
The successful HTTP/full-build checks do not fill those gaps. Autoplay's inclusion in
ordinary selection does not broaden the separate public qualification manifest.

## Remaining unsafe or unqualified entrypoints

- `prepare:abq` / `scripts/prepare-abq.mjs`: fixed event release destination and a
  separate fixed artifact-manifest writer. Its release-directory collision refusal
  does not protect every output; not repaired or run here.
- `scripts/rehearse-abq.mjs`: reused mode/global media directories, truncating
  screenshots/JSON and appended samples. `scripts/summarize-abq-soak.mjs` overwrites
  a fixed resource summary. Both remain unsafe to repeat without a separate repair.
- Raw `playwright.spatial.config.ts` still uses default runner cleanup ownership.
  Do not use it to infer the two repaired npm profiles are repository-wide protection.
  Slice/qualification configs remain separate explicitly owned workflows.
- Default `npm run build`, `build:container`, `dev`, `dev:network` and the build stage
  of `acceptance` can empty existing dist. Their ordinary defaults are not made safe
  by the owned build inside the repaired browser/HTTP wrappers.
- Benchmark/guided-measurement commands and historical/native/container producers
  were not ownership-qualified by this pass. Benchmark stdout must be redirected to
  a fresh caller-owned file, never an old evidence path. Their generation hooks are
  also distinct from retained historical evidence.
- `test:isolation` was not run: its tracked-copy/install behavior and CI coverage
  require separate authorization/qualification; other work was not staged to enable it.

Priorities for the next authorized pass: fix full semantic selection/context agreement
(including candidate summary versus adjacent witness token positions), intentional
camera/depth transitions and a consistent entry/return policy; diagnose the retained
browser failures without weakening assertions; then improve the guided tour into
Explore and Lab. Later work must reconcile local/CI/isolation coverage, autoplay public
qualification, event-specific packaging and release notices/licensing. Full unfamiliar
users remain after valid independent M5; workshop/station/release remain M6.
