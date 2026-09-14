# M0 / first M1 two-producer slice

**M0 preparation complete. M1 functional slice implemented and exercised; delivery
qualification BLOCKED by one unrecovered historical-artifact overwrite. Full M1,
FP-01, FP-03, FP-10, M5 and foundation/release acceptance remain ungranted.**
No M2 or deferred proof implementation was undertaken.

## Baseline and scope

Work used `/Users/joshuahansen/dev/model-lab`, origin
`git@github.com:A-T-S-K/model-lab.git`, branch `wave-1a-spatial`, HEAD
`f6a4b51326032fef41b8b0d8ca6539ae77366173`, committed tree
`b6d06fe2f81d12518291aa67cad6ef833eeef1da`. No branch switch/reset, staging,
commit, push, PR, publication, deployment, global setting or other-repository edit.
The starting seven tracked D0 edits, adopted untracked instructions/design/status/
review documents, and pre-existing `docs/abq-product-review.md` were inventoried.
Only the foundation ledger is intentionally updated within D0's document set.
The attached brief was read as a scoped specification under the actual user request;
its future-gate language did not authorize further implementation.

Read applicable root/ancestor guidance, documentation authority and ledger, D0,
both complete v2 documents, current teaching/evidence guides, active source paths,
package scripts and runtime hashing. Baseline application runtime:
`sha256:c1ed7bf5d6de9e302668cf8f79a3d8d5539f56d07010cd5dbc471a9c69bc0891`
over 72 paths. This identifies runtime source, not the uncommitted D0 patch.

All new measurements, commands/logs, captures, saved recordings and inventories are
under `test-results/m0-m1-first-slice/`. The baseline inventory hashes 3,655 files,
including ignored historical outputs, and saves the pre-task tracked diff and status.
The prepared ABQ kit and original `dist/` were not rebuilt or served by this task.

## M0 migration / dependency map

| Current owner and production callers | First extraction in this slice | Invariants / compatibility | Affected checks | Later boundary |
| --- | --- | --- | --- | --- |
| `model/state.ts` `TrainingSnapshot`; controller, training executor, archive and inspector | Snapshot authority remains `archive/snapshot.ts`; `archive/legacy-run.ts` reuses it through the registered legacy codec | Exact binary64 canonical encoding, character/BOS schema, parameter order/shapes, Adam moments/schedule/cursor/RNG; no permissive replacement validator | Snapshot/archive, history, candidate and negative-zero replay tests | Other state codecs and optimizer families remain later M1/M3 witnesses |
| `app/worker/protocol.ts` `WorkerRequest` / `RunResult`; client/controller, ForwardDriver, main UI | Versioned execution intents validated at the real client/controller path; trusted executor registrations; legacy result becomes validated shared evidence during real archive admission | Existing request epochs, native arithmetic and result/acceptance semantics retained; invocation is not cancellation epoch | Worker/client/forward/training tests and visible Predict/Learn routes | Broader coordination and failure portfolio remain M4/FP-11 |
| `archive/session.ts` addRun; all retained prediction/training/ablation runs | Shared `EvidenceStore`, registered versioned codecs, immutable content identity, typed payload/slice API; existing run maps remain the typed format-1 compatibility view | Original run/snapshot IDs and records stay in the envelope; unknown historical request/occurrence metadata is labeled compatibility metadata; empty legacy recordings remain valid | Archive, malformed payload/ref/dtype/slice, conflicting identity, saved replay | Full export/version/retention campaign remains M4/FP-10 |
| `trace/player.ts`, source catalog, main's inspector and spatial read models | Same shared `EvidencePlayer` and inspector for both producers, with reusable bundled source access; canonical world continues its existing typed format-1 presentation after shared admission | Preferred continuous world, canonical numerical read models, source identities, original scalar inspection; no copied Pythia scene | Canonical/native full-size screenshots, retained spatial/scalar routes, disconnected replay | General semantic world/topology/layout remains M2; current canonical layout is still curated |
| `trace/compare.ts`, experiment/history comparisons | Registered legacy policy delegates unchanged strict comparison; shared cross-definition/representation comparison refuses explicitly | No silent vocabulary alignment, shape-only compatibility or tolerance changes | Existing comparison tests plus actual cross-producer refusal | Additional purpose-specific policies remain M3/M4 |
| Native backend was absent; provisional `TrainingStateRecord` had only constructor/tests | Actual pinned GPTNeoX CPU hooks and optional loopback bridge; bounded selected evidence challenges dtype/tokenizer/layer/source assumptions now | No universal interpreter, remote code, weight processing fallback, training-state claim or mandatory Python | Independent native comparison, real HTTP/browser request, two heads, schema/origin/epoch failures | MLP/SGD, grouped axes, opaque fixtures, generation/cache and remaining FP proofs remain unimplemented |

The active snapshot/worker/archive path was changed; provisional training declarations
were not refactored to simulate production integration. No file under `model/`,
`inspect/`, `fixtures/` or `reference/` changed.

## Selected optional profile and source identities

Before installation, the chosen local environment, direct packages, immutable model
revision, inert loading and expected resource footprint were stated. The existing
`/opt/homebrew/bin/python3` (3.14.7) created `research/pythia/.venv/`. No interpreter,
CUDA, driver or application dependency was installed/upgraded globally. The canonical
package files and lock remain byte-identical.

- PyTorch **2.14.0**, Transformers **5.17.0**, tokenizers **0.23.2**, safetensors
  **0.8.0**, huggingface-hub **1.31.0**; 34 resolved distributions total.
  `research/pythia/requirements.lock` pins all selected wheel hashes;
  `dependencies.json` records exact versions, direct/transitive requirements,
  published licenses and public distribution provenance. Startup checks installed
  versions and the declared Python/macOS-arm64 profile, refusing drift.
- `EleutherAI/pythia-14m` model/tokenizer revision:
  **`cf967c0a9a04383db6f7b1108d86b2962634b4ac`**.
  Only config, tokenizer, tokenizer config, special-token map and one safetensors
  weight file were downloaded. `model-lock.json` binds each file's size and SHA-256.
  No training data, alternate models, pickle weights or repository history.
- Safetensors checkpoint:
  **`sha256:116a02532db461f91386a5b20f942ff2c8d4de7341e21b55caafc3d7b25f49a1`**.
  Actual stored weight tensors are **F16**, explicitly converted to **float32** parameters
  and execution. CPU, one thread, eval, eager attention, no cache, no sampling.
- Native binding runtime:
  **`sha256:ea128d6858613534387d0089163786eb34b4c3f5d494e2d10cc4b36c0c21c69d`**.
  This binds adapter/server source, dependency provenance/lock and model lock.
  The application additionally hashes profile and source-view assets. Its final runtime is
  `sha256:463eb264f3fec36aa5bce6abf04839126c7149e333a9120cadd20ac274387ddd`
  over 87 paths. The native
  profile identifies the full Transformers source file, config and input transform.
- Tokenizer file:
  `sha256:870f4e2baa6b683221fa52004d5d6f40ab8c9d31961617304b78c910c2c3caf2`.
  Complete input-transform identity (all tokenizer files, library versions, explicit
  no-special-token/padding/truncation and bounded ASCII policy):
  `sha256:851d74e9e330ac8c4412feb921ec691a41c29fc22e2997121f48b2708e54fa2a`.
  Tokenizer has **50,277** entries; model output has **50,304**. The display retains
  all output indices and does not invent labels for padded/unmapped entries.
- Native implementation source:
  `sha256:c8684ddf23ca40c8151459902f89b19b13372aeb766cc21afc8a5323ac55f538`.
  The same inspector bundles the actual source as inert, escaped text for offline
  access; its Apache-2.0 attribution is retained.

The public model card declares Apache-2.0. Primary sources inspected:
[model card](https://huggingface.co/EleutherAI/pythia-14m),
[immutable model tree](https://huggingface.co/EleutherAI/pythia-14m/tree/cf967c0a9a04383db6f7b1108d86b2962634b4ac),
[TransformerLens migration guidance](https://transformerlensorg.github.io/TransformerLens/content/migrating_to_v3.html),
and actual **TransformerLens 3.9.0** wheel, SHA-256
`94739f9c54f53239c61f01e1953b8ed89cd3338c385a974ab38d1b45187f151e`.
Its NeoX adapter supports Pythia/parallel blocks but splits fused QKV into new linear
modules and brings a broader dependency stack. The explicit selected binding is
**narrow native PyTorch read-only hooks**, preserving the original native forward
path. TransformerLens was inspected without installation and was not numerically
qualified; no unsupported claim of absent NeoX support or failed invariance is made.
No runtime fallback between bindings/providers exists.

Loading verifies local file digests and uses `use_safetensors=True`,
`trust_remote_code=False`, `local_files_only=True`, offline and telemetry-disabled
process settings. The local environment measured 921 MiB, cache 29 MiB. The final
qualification's peak RSS was **562,675,712 bytes**; two fresh model loads and the
comparison took **0.2930 s**, excluding Python imports/process startup. These are
local scoped measurements, not a latency or cross-platform reproducibility promise.

## Actual vertical paths and numerical evidence

Canonical visible Predict, Learn, stepping and retained results keep the native
worker. New client intents are validated before its commands execute. Real
`SessionArchive.addRun` uses the shared registered legacy codec and store, preserving
the unchanged strict snapshot/hash policy. The same app-shell **Models & saved
evidence** inspector can select and replay those admitted float64 artifacts.
The original spatial presentation and scalar/learning controls remain usable.

Pythia is requested from that inspector through a trusted registered executor and
actual browser POST to the explicit loopback bridge. It uses prompt **`The cat sat`**,
IDs **`[510, 5798, 2206]`**, offsets **`[[0,3],[3,7],[7,11]]`**. Captures include:
integer token metadata (validated int32 JSON transport of native int64 IDs),
embeddings, layer **1** residual input, both LayerNorm boundaries,
fused pre-RoPE QKV, all **four** native attention probability heads, projected
attention output, GELU MLP output, residual output and final-position logits.
Native layer dependencies are `(MLP + attention) + residual input`; both norms consume
the same residual input. Uncaptured layers are not falsely connected as direct edges.
Pre-RoPE Q/K are explicitly not presented as rotated attention-score operands.

The reference is a separately loaded direct Hugging Face model with the same pinned
files and settings. Its plain logits pass has **no hooks**. Selected internal reference
values use separate minimal read-only native hooks; they are not mislabeled wholly
uninstrumented and do not call the adapter under test. The predeclared policy was
`abs(error) <= 1e-6 + 1e-6 * abs(reference)`, with reported relative error using a
`1e-12` denominator floor. No tolerance was changed after comparison.

Every comparison in `native-observation.json` passed with **maximum absolute error
0 and maximum relative error 0**: plain/reference-hook logits, plain/adapter logits,
embeddings, residual input, both norms, fused QKV, attention output/weights, MLP output,
residual output and the parallel-residual identity. Logits cover **50,304** entries;
attention covers **36** entries for four heads and three prompt positions. This is
same-profile conformance, not full FP-03 or a universal numerical equivalence claim.

Actual browser evidence records the native HTTP request/response and run/runtime IDs.
The browser inspected head 0 and head 1 slices, a nonzero-layer normalization boundary,
bound source, full-support derived softmax and exact output index **50,303**. Top-five
probabilities retain omitted mass; no top-k renormalization or vocabulary denominator
substitution. Opening saved evidence does not import or run native Python code.

The real native response was also delayed past a model switch and refused admission.
The native request path did not send canonical worker commands. A subsequent canonical
prediction retained the same full snapshot and logits. After terminating the final
bridge PID **72286** and verifying port **4319** closed, a fresh browser loaded the
saved native recording, recovered exact attention values and explicitly refused
uncaptured scalar detail with the executor disconnected. Canonical Predict then ran
with **zero native endpoint requests**.

## Commands, checks and limits

Executed from the checkout; logs and captures below are relative to the common
`test-results/m0-m1-first-slice/` directory.

| Command / check | Observed result | Evidence |
| --- | --- | --- |
| `npm run test:reference` | 17 Python tests; exact structure/identity; differing floats 0, max absolute/relative error 0 under portable policy | `reference.log` |
| `npm run test:reference:canonical` | 1 canonical test and byte-exact fixture regeneration passed with the existing Apple Python | `reference-canonical.log` |
| `npm test` | 131 tests: 130 passed, 1 optional native-recording test skipped in canonical-only invocation | `unit-final.log` |
| `NATIVE_RECORDING=test-results/m0-m1-first-slice/native-recording.json node --import tsx --test tests/integration/shared-evidence.test.ts` | 4 passed, no skips; real native fixture from this task, strict legacy replay, negative zero, malformed dtype/shape/ref/slice, semantic/source identities, stale admission, unsupported action and cross-producer comparison refusal | `shared-tests-final.log` |
| `npm run typecheck` | Passed; regenerated exact application runtime | `typecheck-final.log` |
| `npm run example` | Passed, ordinary observer-free canonical Predict/Learn example | `example.log` |
| `npm run build -- --outDir test-results/m0-m1-first-slice/dist` | Passed; original served `dist/` untouched; no Python process required by build | `build.log` |
| `research/pythia/.venv/bin/python research/pythia/qualify.py` | Passed independent numerical comparison; measurements above | `native-qualification-final.log`, `native-observation.json`, `native-recording.json` |
| `research/pythia/.venv/bin/python research/pythia/test_bridge.py` | 10 transport checks passed: actual native execution, Origin/Host, unsupported action, extra field, byte/token budgets, negative/stale epoch and duplicate request | `transport.json` |
| `npx playwright test --config playwright.slice.config.ts tests/browser/shared-slice.spec.ts` | 2 live tests passed; offline test intentionally reserved for backend shutdown | `browser-live-final.log`, `browser-live-evidence.json`, `browser-stale-evidence.json` |
| `SLICE_PHASE=offline npx playwright test --config playwright.slice.config.ts tests/browser/shared-slice.spec.ts` | Offline test passed after actual backend shutdown; 2 live tests intentionally excluded | `browser-offline.log`, `backend-shutdown.json`, `browser-offline-evidence.json` |
| Retained canonical browser command below | 14 passed in 7.2 minutes; Predict, scalar/history, Learn, candidate accept/discard, intervention return and async failure controls | `browser-retained.log` |
| `TRAINING_EVIDENCE_DIR=test-results/m0-m1-first-slice/training node --import tsx --test tests/integration/training-execution.test.ts` | 26 passed; unchanged assertions after redirecting the hardcoded historical output path | `training-output-fix.log` |

Retained browser command uses existing tests and explicit task-owned destinations:

```sh
SPATIAL_EVIDENCE_DIR=test-results/m0-m1-first-slice/retained-spatial \
WAVE2_EVIDENCE_DIR=test-results/m0-m1-first-slice/retained-forward \
WAVE2C_EVIDENCE_DIR=test-results/m0-m1-first-slice/retained-candidates \
STOP_EVIDENCE_DIR=test-results/m0-m1-first-slice/retained-stop \
npx playwright test --config playwright.slice.config.ts \
  tests/browser/spatial-wave1a.spec.ts tests/browser/spatial-wave1c.spec.ts \
  tests/browser/spatial-wave2a.spec.ts tests/browser/spatial-wave2c.spec.ts \
  tests/browser/learning-stop.spec.ts
```

The slice config owns free preview port 4318, isolated build output and Playwright
results. The native bridge owned port 4319. Existing previews/processes were not
stopped. Test-owned previews shut down after each run; native bridge was stopped
before offline proof. `npm test` also passed its Git-free source-copy build/serve
identity test without the optional environment/cache being copied.

Initial failures were retained, not hidden: sandbox loopback `EPERM` required an
authorized rerun; new shared admission initially rejected valid empty legacy runs;
legacy conflict validation order initially changed a tested refusal message; the
inspector initially rerendered reentrantly during change/blur. Those implementation
regressions were fixed and the relevant suites rerun without weakening assertions.
The historical-output incident below remains a real failed protection check.

`npm run acceptance`, the entire browser portfolio, tracked-copy `test:isolation`,
new soak, independent M5 review, full unfamiliar-user/workshop/station/release tests
were **not run**. The existing scoped suites above actually ran; this is not an
undifferentiated NOT_RUN report or a full acceptance pass.

## Visual and replay review

Full-size images were opened and inspected, including canonical world and canonical
shared inspector, native heads, logits and disconnected replay. The same inspector
has explicit source/provenance, typed axes, bounded row-major slices, playback versus
execution, and capability refusals. Graphite/Plex styling was corrected after the
first native capture inherited classic controls. This is engineering visual review,
not independent or unfamiliar-user acceptance.

Key files: `canonical-world-1920.png`, `canonical-shared-1920.png`,
`native-head0-1920.png`, `native-head1-1920.png`, `native-logits-1920.png`,
`native-disconnected-1920.png`, `native-disconnected-1280.png`,
`canonical-saved.json`, `browser-saved-native.json`, `browser-native-response.json`.
Additional retained-route captures are in the four `retained-*` subdirectories.

## Protection failure and exact recovery requirement

**FAILED / UNRECOVERED:** the pre-existing test
`tests/integration/training-execution.test.ts` T10 wrote its performance sample to
`test-results/wave2b-review/worker-performance.json` during `npm test`. Task preflight
inspected package scripts but missed this nested test-owned write. The required
before/after hash audit detected it. The original bytes were not backed up, only hashed.

Original SHA-256:
**`7b5883ef34a101b49e981ecdd168c39988ec95704cb71f2732d4ea46b7695f97`**,
also independently present in the prior D0 inventory. The overwritten file must not
be treated as original Wave 2B performance evidence. Current task measurements were
copied to `worker-performance-current.json`; the incident/current hash is recorded in
`historical-artifact-incident.json`. The test now accepts `TRAINING_EVIDENCE_DIR` and
uses a current-test default, preventing future writes into the historical wave path.
No numerical/semantic assertion was changed.

Scoped recovery checks found earlier timing samples in prior same-project task
outputs, but none matched the original hash. Relevant temp copies and downloaded
Model Lab zip inventories also provided no matching copy. No reconstructed numbers,
rounded report values, substituted earlier sample or invented restoration was used.
A byte-identical backup is required to repair this delivery's preservation failure.

All other original protected files, including the prepared ABQ kit, original dist,
fixtures, independent oracle, D0 reports/design/instructions/guides and product review,
remain checked against the baseline. The updated foundation ledger is the authorized
D0-file exception. See `protection-check.json` and final incremental inventory.

## Incremental patch and remaining work

The starting D0 tracked diff is saved in `baseline.patch`; `baseline-status.txt` and
`baseline-files.json` include untracked and ignored starting state. The final inventory
separates this task's changed/new source from D0 and records exact source-file hashes.
Incremental scope is **10 existing source/document paths modified and 24 new paths**,
separate from the preserved D0 patch. The exact path lists are in
[`incremental-scope.json`](../../test-results/m0-m1-first-slice/incremental-scope.json),
with byte hashes in
[`source-file-hashes.json`](../../test-results/m0-m1-first-slice/source-file-hashes.json).
Existing edits: `.gitignore`, `app/main.ts`, `app/source/catalog.ts`,
`app/worker/client.ts`, `app/worker/controller.ts`, `app/worker/protocol.ts`,
`archive/session.ts`, `scripts/runtime-identity.mjs`,
`tests/integration/training-execution.test.ts`, and `docs/foundation-status.md`.
The report itself and optional profile files are included in the new-file list.
Final protection check: **3,465 original protected files checked; one failed**,
the timing artifact identified above. All **17 prepared-kit files** and the D0
preservation set match their baseline hashes. Ports 4318 and 4319 have no remaining
task-owned listener. Git staged diff is empty; branch and HEAD are unchanged.
Tracked and new-file whitespace checks and local document links passed.

Generated `runtime/revision.ts` is task-owned and changed normally. Environments,
weights, font binaries and test/build artifacts are ignored, not staged in the patch.

Source additions comprise the shared contracts/store/player and registrations;
strict legacy admission extraction; native browser client and trusted executor
bindings; one shared app inspector/CSS; optional native adapter/server, pinned profile,
source, dependency provenance and qualification scripts; scoped integration/browser
tests and their isolated Playwright config. Existing edits are narrow client/controller
intent validation, archive admission, main-shell mounting, reusable source catalog,
runtime identity inputs, optional ignore rules, and the T10 output-path correction.
No original model arithmetic, canonical fixture, oracle, strict comparison or candidate
implementation was replaced.

Remaining qualification includes recovery of the overwritten historical artifact,
full M1's noncanonical/MLP/SGD/grouped-axis/opaque witnesses, general world integration
at M2, generation/cache and invocation proofs, state/recipe/replacement/experiment
extensions, full import/version/retention/transport failure portfolio, known projection
wording and pre-ablation provenance corrections, and independent exact-candidate M5
review before M6 users/workshop/release. The known findings remain open.

This slice's native profile intentionally supports only bounded ASCII inference,
selected layer-1 captures and final-position logits. It provides no Python training,
mutation, scalar stepping, generation/cache, exact resume, automatic model downloads,
arbitrary source execution or cross-model coordinate comparison. Capture availability
and executor availability are distinct. One local save slot and JSON export/import
prove bounded replay, not complete durable-storage/retention qualification.

Next bounded recommendation: recover the original timing artifact by matching its
recorded SHA-256, review this uncommitted slice and its scoped evidence, then separately
authorize the remaining M1 witnesses. **STOP here; no automatic M2 or deferred proof
portfolio continuation.**
