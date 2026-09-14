# M1 shared contracts and heterogeneous witness qualification

Implementation checkpoint: **`04c9e13`**. Qualification record for the authorized continuation from repaired commit
`9cca17d6c57e3206ce90ce1025fadceb6c1ec127`, on `wave-1a-spatial`.
**M1 PASSED / COMPLETE within its stage scope.** No remaining M1 blocker was observed.
This is engineering qualification of M1, not independent M5 acceptance.

## Implementation and scope

The existing shared execution requests, integration registry, evidence store/query,
inspector and player now support the remaining M1 witnesses. No scene copy,
universal interpreter, dependency upgrade, remote write or M2 world refactor was
introduced. The unrelated `docs/abq-product-review.md` remains untracked.

- Version-1 text requests and strict canonical legacy admission remain. Version 2
  adds typed float32 numeric batches/targets and an explicit supplied-state field.
  Structural preview is distinct from numerical execution; shape-only and opaque
  availability have null values. Numerical slice capabilities check actual availability.
- The MLP is actual PyTorch float32 affine → ReLU → affine, MSE over all batch/output
  elements, backward and explicit SGD. Input/output, reduction, gradients, before/
  after parameters, representable deltas and resulting prediction are observed.
  Its registered codec validates exact source/semantic/axis coverage, input binding,
  supported state and the recorded SGD transition. Starting/resulting states retain
  separate derived identities. Runs are disposable; no accepted server state exists.
- The noncanonical fixture executes the unchanged readable MicroGPT forward in a
  browser worker: two layers, three heads, width six (head width two), context six,
  five distinct vocabulary characters plus BOS. Every layer/head/position is bound
  in the same inspector, with full causal K/V dependency references. The codec pins
  the separate fixture and rejects wrong state, identity, axes or coverage. Complete
  inference state is retained; optimizer continuation is explicitly unsupported.
- The numerical grouped fixture has four query heads, two KV heads and mapping
  `[0,0,1,1]`. Roles and coordinate spaces are explicit; invalid mappings/role changes
  fail. The opaque fixture actually computes `torch.linalg.vector_norm([3,4]) == 5`
  while withholding internal values. Structural preview and unsupported explanation
  records render truthful fallback, without scalar graphs or placeholder values.
- Producer input/action and source bindings are registered. The generic inspector
  has no new model-ID branches. Native transport accepts bounded explicit requests;
  cancellation prevents admission, and MLP work never mutates persistent server state.
  Original envelopes retain original recording identities. The previous qualified
  Pythia profile is retained as a strict compatibility reader alongside the new
  bridge identity, rather than relabeling old evidence.

The source guide is [research/witnesses](../../research/witnesses/README.md).
Shared changes are in `trace/evidence.ts`, integration codecs, executor registration,
`native-client.ts`, registered source lookup and `shared-inspector.ts`. Native and
browser integrations own their mathematics and semantic mappings.

## Identity and output protection

Application runtime: **`sha256:eff73b8404e28cf895afa733b24eff4ee53af62c78f0b543361d19802d67b8d5`**,
98 production inputs. MLP/fixture binding:
**`sha256:3c46331962a9d82220938e272fd7af50a7e547edbb4b450dac7a5985a7f99dd5`**.
Pythia bridge runtime:
**`sha256:290becead8351ebb54ab765c1f49091e3837209fb183909e457f6240687cd298`**.
Native weights, tokenizer, dependencies and model forward source remain pinned and
unchanged; the Pythia runtime changes because its bridge registers another producer.

The task allocated [qualification output](../../test-results/scratch/training-tcGlEh)
using `allocateTestOutput` before running writers. It recorded starting hashes and
backed up the incoming generated revision. Unit nested writers use owned temporary
or fresh scratch directories; browser runner/report/evidence cleanup stays within
its fresh allocation. The production build went to that task's `build` child,
never original `dist` or the prepared ABQ kit. Native qualification allocates before
native imports/loading. Bytecode writes were disabled for Python checks. Old output
paths were never adopted, and failed/setup runs remain retained.

## Executed checks

| Check | Observed result |
| --- | --- |
| Pinned Python `research/witnesses/qualify.py` | **70 tensor comparisons passed**, prediction/train/resume, max absolute difference **0** under `atol=1e-7, rtol=1e-6`. Independent `torch.nn`/`torch.optim.SGD` path bypasses adapter and production MLP. State JSON continuation exact; nine malformed input/state/mapping refusals. Grouped outputs independently checked with scalar dot/softmax/weighted-sum arithmetic (`<1e-6`). [Log](../../test-results/scratch/training-tcGlEh/witness-qualification.log), [raw results](../../test-results/scratch/native-t72a77ni/results.json). |
| `WITNESS_RECORDING_DIR=test-results/scratch/native-t72a77ni NATIVE_RECORDING=test-results/scratch/native-uhwcln8v/native-recording.json npm test` | **146/146 passed, no skips**, including the new witnesses, repaired receipts/import identity, state/candidate controls, canonical arithmetic, and shared replay. [Log](../../test-results/scratch/training-tcGlEh/unit.log). |
| Existing earlier native recording through `tests/integration/shared-evidence.test.ts` | **4/4 passed**, preserving prior Pythia runtime and evidence identities. This is compatibility coverage, not a new execution of that old runtime. [Log](../../test-results/scratch/training-tcGlEh/legacy-native-replay.log). |
| `npm run test:reference`; `npm run test:reference:canonical` | **17 reference tests + one canonical test passed**; zero differing floats and byte-exact canonical fixture regeneration. [Portable](../../test-results/scratch/training-tcGlEh/reference-portable.log), [canonical](../../test-results/scratch/training-tcGlEh/reference-canonical.log). |
| `npm run typecheck`; `vite build --outDir test-results/scratch/training-tcGlEh/build`; `npm run example` | **Passed**. Example changed all 896 parameters; target probability 0.3591443770854818 → 0.4070454916035887. [Typecheck](../../test-results/scratch/training-tcGlEh/typecheck-final.log), [build](../../test-results/scratch/training-tcGlEh/build-first.log), [example](../../test-results/scratch/training-tcGlEh/example.log). |
| Pinned Python `research/pythia/qualify.py` | **12 native comparisons passed**, max absolute/relative difference **0**, unchanged `1e-6 + 1e-6 * abs(reference)` policy. [Log](../../test-results/scratch/training-tcGlEh/native-qualification.log), [raw recording](../../test-results/scratch/native-uhwcln8v/native-recording.json). |
| Existing `research/pythia/test_bridge.py`; scoped MLP HTTP checks | **10 Pythia + eight MLP checks passed**: real prediction/training, explicit state resume, duplicate/stale/malformed refusals and no persistent mutation. [Pythia](../../test-results/scratch/training-tcGlEh/transport.log), [MLP](../../test-results/scratch/training-tcGlEh/mlp-transport.log). |
| Python native-output protection | **2/2 passed**. Node output guards also passed within the full unit suite. [Log](../../test-results/scratch/training-tcGlEh/native-output.log). |
| New live/structural browser routes + repaired routes | **Seven cases passed**: MLP predict/train and noncanonical worker in one inspector; shape/opaque fallback; five repaired canonical receipt/reopening cases. [Log](../../test-results/scratch/training-tcGlEh/browser-live.log), [MLP and multilayer captures](../../test-results/scratch/training-RUIYK2/evidence/test-v8AIpP), [fallback captures](../../test-results/scratch/training-RUIYK2/evidence/test-oyVIaX). |
| Pythia shared live and stale-switch browser routes | **2/2 passed on unchanged rerun**, fresh native response, both heads, source, distribution and stale admission. [Log](../../test-results/scratch/training-tcGlEh/browser-native-repeat.log), [saved native evidence](../../test-results/scratch/training-PV9P43/evidence/test-z6gazL). |

Browser commands use `playwright test --config playwright.slice.config.ts` with
`SLICE_BUILD_DIR=test-results/scratch/training-tcGlEh/build`, `SLICE_PORT=58925`,
`SLICE_NATIVE_ENDPOINT=http://127.0.0.1:58926/execute` and fresh output allocations.
New fixture tests additionally use `WITNESS_RECORDING_DIR=test-results/scratch/native-t72a77ni`.
The native bridge was explicitly launched on port 58926 for origin 58925.

Observed setup/failures: sandbox initially denied loopback listeners; the already
authorized processes were relaunched with the required local execution permission.
One existing Pythia browser check encountered Playwright's `Network.getResponseBody`
“No data found” after a successful HTTP status. Both Pythia cases passed unchanged
in a fresh isolated rerun; no assertion, timeout, numerical tolerance or fixture was
weakened. Initial typechecking also caught two union/source typing errors, repaired
before the qualified build. All corresponding logs remain retained.

The MLP training, nonzero layer/head/position and shape fallback captures were
visually inspected. This is internal engineering inspection, not unfamiliar-user
or independent visual acceptance.

## Shutdown and executor-free replay

The bridge process was verified as PID 35254 with the exact task port/origin,
terminated, and connection refusal confirmed before offline tests.
[Shutdown receipt](../../test-results/scratch/training-tcGlEh/bridge-shutdown.json).
The offline preview used separate port 58927. Saved MLP gradients and the
noncanonical layer-1/head-2/position-5 values reopened exactly with **zero new
executor workers and zero native requests**. Pythia's saved attention values also
reopened exactly; uncaptured scalar detail was refused. Canonical Predict succeeded
with **zero native requests** after bridge shutdown.

The two distinct disconnected cases passed; the structural/opaque browser case
passed again (not counted as a new distinct case). Phase-specific live cases were
intentionally excluded. [Offline log](../../test-results/scratch/training-tcGlEh/browser-offline.log).
The saved inputs stay outside all later runner-cleanup roots, and their original
bytes are retained. [Exact candidate source hashes](../../test-results/scratch/training-tcGlEh/candidate-identity.json)
record the production source identity independently of Git metadata.

## Stage disposition and remaining scope

All **14 retained canonical browser cases passed** (7.4 minutes), covering ordinary
prediction/geometry/source routes, actual learning, accepted/candidate state,
archival failures, delayed replies, execution frontiers, intervention return paths
and cancellation. [Retained browser log](../../test-results/scratch/training-tcGlEh/browser-retained.log).
Together with shared/new-model and disconnected checks, this is **25 distinct passing
browser cases**, excluding phase skips and duplicate runs.

The final [preservation audit](../../test-results/scratch/training-tcGlEh/protection-final.json)
checks all 4,357 starting files. Only enumerated authorized source/ledger/generated
changes differ; unexpected changes are zero. Original dist, prepared kit, canonical
fixtures/oracle, model arithmetic, locks/dependencies/weights, old reports/evidence,
quarantined replacement and unrelated product review remain byte-identical.
The bridge and task preview ports are closed. No remote writes occurred.

**M1 is complete; there is no remaining blocker in this stage.** The proof plan's
M1 native-input → shared evidence → inspector → saved replay path and its numeric/
state/shape/opaque challenges are demonstrated by working committed implementation.
This does not mark the entire FP portfolio complete.
M2 topology/world composition, broader generation/cache, variants/experiments,
M4 failure/retention/representation coverage, M5 independent foundation review and
M6 user/workshop/release qualification remain pending. Full FP-01–FP-12 acceptance
is not inferred from completion of their M1 portions.

The retired historical worker sample remains absent and **LOST / RETIRED BY OWNER**;
its expected original hash and the original FAILED preservation record are unchanged.
No recovery or replacement of historical measurements occurred.

Unrun coverage: full aggregate browser portfolio, aggregate acceptance wrapper,
installing source-copy isolation command, benchmarks/soaks, M2 world restructuring,
full generation/cache/replacement/experiment proofs, adversarial M4 portfolio and
independent M5 review. The unit suite's own temporary subtree build/server checks
ran; they do not substitute for the separately unrun installation/isolation command.
