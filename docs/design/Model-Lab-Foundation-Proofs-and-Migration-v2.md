# Model Lab: foundation proofs and migration, revision 2

**Date:** September 13, 2026  
**Status:** Required implementation/qualification plan. All new proofs below are NOT RUN in this research response.  
**Authority:** [Model-Lab-Refined-Platform-Design-v2.md](Model-Lab-Refined-Platform-Design-v2.md) and the latest user instruction: complete the durable foundation before full user testing.  
**Baseline:** `A-T-S-K/model-lab`, `wave-1a-spatial`, `f6a4b51326032fef41b8b0d8ca6539ae77366173`.

## 1. What constitutes a foundation pass

The final shared architecture must preserve the current canonical behavior and demonstrate meaningful heterogeneity, actual technique replacement, general experiments, and durable truthful evidence. An interface definition, alternate screenshot, synthetic trace, second instance of the same runtime, or a test count alone is not this proof.

Every proof records: source/runtime/model/tokenizer/fixture identities; requested/effective execution/capture settings; commands; actual evidence and failures; numeric comparison policy; support/refusal coverage; affected shared modules; and reviewer disposition.

New foundation work is not already accepted because older browser or soak reports passed. Preserve the old prepared artifact and qualify a new artifact after migration. Historical records retain their actual identity and scope.

## 2. Initial model portfolio

### A. Existing canonical MicroGPT

Preserve the tiny scalar model and independent Python oracle. It remains the deepest arithmetic/training teaching organism and the default ABQ lesson. Its existing two initial normalizations, causal graph, no-bias/ReLU choices, optimizer schedule, fixtures, candidate semantics, and historical evidence must not be changed merely to look like another model.

A separate noncanonical fixture exercises at least two layers, a different head count/width, context, and vocabulary. Do not edit canonical fixtures to create it.

### B. Native Pythia-14M qualification integration

Restore the original Pythia proof rather than replacing it with only a toy MLP. The currently inspected configuration declares six layers, width 128, four heads, a 50,304-entry output index space, GELU, rotary position configuration, attention bias, and parallel residual branches. Those differences make it useful for exposing single-fixture assumptions. [R8 in the design]

This is a proposed qualification model, not a claim of an implemented/benchmarked adapter. Pin immutable model and tokenizer revisions and prepared weights before running. The model card explicitly notes that the meaning of the model name previously changed between standard and deduplicated training data, reinforcing why a name or moving `main` is insufficient provenance.

Use a native Hugging Face/PyTorch execution as the comparison authority for the selected profile. Evaluate a TransformerBridge binding first, against the original pass-through baseline, without making it the platform ABI. Avoid automatic compatibility-mode weight transformations. If the candidate cannot meet the required observations and invariance, use a narrow native hook binding and record the missing external-tool capability. This is an adapter choice, not permission to rewrite the model's forward pass.

Declare the effective dtype explicitly. Loading published weights into float32 is a conversion, not evidence that original storage was float32. Use bounded prompts and selected captures; do not export every parameter/activation on every interaction.

The integration must execute through the shared request/evidence path, not just import a file. Its saved runs must also replay without Python. It can remain developer-facing and must not become a mandatory dependency of the canonical browser kiosk.

### C. Small PyTorch non-attention fixture

Use a readable numeric-input MLP, a non-cross-entropy objective such as mean squared error, float32, and SGD. Its purpose is to expose assumptions about tokenization, attention, loss, optimizer, and source semantics. It complements Pythia; it does not replace the real-transformer proof.

No polished MLP public lesson is required for foundation signoff. The generic world/inspector and honest capability behavior are required.

## 3. Required proof matrix

| ID | Actual exercise | Must establish | Disqualifying shortcut |
| --- | --- | --- | --- |
| FP-01 | Canonical MicroGPT through the new contracts | Reference agreement, observed semantic/scalar/backward evidence, real optimizer updates, controlled decisions, source and replay invariants remain intact | Replacing goldens, widening tolerances to pass, or keeping a separate legacy-only UI |
| FP-02 | Noncanonical multi-layer tiny transformer | Every selected value/dependency is correctly layer/head/position bound; world structure follows its descriptor | Adding global `if model == ...` branches or copying the scene |
| FP-03 | Native Pythia real execution, generation, selected internals, and replay | Shared UI handles actual tokenizer/output space, topology, scale, selected tensor access, and limited capture depth | File import alone; fake scalar DAG; calling a processed model identical to the native reference |
| FP-04 | Non-attention MLP plus grouped query/KV-axis numerical fixture | Numeric input, different objective/optimizer/dtype, and non-interchangeable axis roles are supported | Returning MicroGPT's RunResult under a new model name; merely renaming head labels |
| FP-05 | Shape-only/unknown/opaque operation states | Structural preview has no fake values; opaque region has useful truthful fallback; unsupported operations fail clearly | Placeholder heatmap or treating unavailable as zero |
| FP-06 | Activation replacement plus a composite additive branch with real parameters | New model definition, graph/ports, source, ownership, initialization, gradient policy, explanation and comparison | Visual-only swap; parameter-size equality used as state compatibility |
| FP-07 | Existing head ablation and donor activation patch | Common recipe/receipt/lifecycle; exact target/donor mapping; no-op and invalid-target controls; accepted state unchanged | Generic archive hardcodes another experiment or uses stale/cross-run donor values |
| FP-08 | Matched clean/treatment training-data substitution and defense control | Data/order/budget/state lineage, clean/triggered/untriggered evaluation as applicable, honest null outcomes | Extra training versus no training; fabricating a desired backdoor effect |
| FP-09 | Repeated invocations and bounded generation; cached/uncached where supported | Invocation/position/step/epoch identities differ; logits versus sampling transforms are separate; state/cache invalidation is correct | Animation poses as generation; discarded KV data used after a model/intervention change |
| FP-10 | Old-format replay, new export/import, and representation-aware comparison | Original identities preserved; no fabricated missing metadata; purpose-specific comparison/mappings and refusals | Globally disabling existing strict compatibility checks |
| FP-11 | Adversarial async/retention/transport/import tests | No late resurrection, double acceptance, cross-arm contamination, unbounded payload fetch, or executable import; ambiguous commit outcome handled | Happy-path-only transport tests; accepting invalid payloads with `any` |
| FP-12 | Shared visual/explanation routes and extension change-surface review | New operations render through fallback/specialization; correct semantics/contextual controls, stable focus, bounded rendering and source access | A separate application for each model or an opaque generic interpreter hiding the teaching code |

Group the grouped-head fixture into the existing Python qualification environment. It may be a tiny actual computation rather than another pretrained model. Its numbers must be executed and labeled as fixture evidence, not invented to satisfy a schema.

## 4. Detailed native-model adapter acceptance

For FP-03, run the same prepared model/input/profile with and without instrumentation. Compare token IDs and selected boundaries as well as final logits. Record tolerances from a declared dtype/backend policy and measure differences; do not use a large blanket tolerance merely to obtain a pass.

At minimum expose input/token mapping, embeddings, one actual normalization boundary, an identified attention path, MLP output, residual output, and final logits/distribution. Intermediate attention products may be observed, derived, or recomputed only under their true classification. A pass requires enough actual internal evidence to demonstrate useful inspection, not only architecture metadata and final text.

Inspect a nonzero layer and at least two heads. Verify parallel residual structure instead of applying the MicroGPT serial residual template. Check target/prefix selection and distribution support. Large-vocabulary display must preserve omitted probability mass and allow exact selected-entry retrieval. A four-class tetrahedron is not an acceptable fallback for that distribution.

Run bounded multi-step generation with explicit chosen-token evidence. Test any advertised cache path against a compatible uncached execution and verify invalidation on model-state or intervention changes. Backend features not exercised are marked unsupported/unqualified rather than advertised as working.

Save a real run and open it in the shared browser player with the native executor unavailable. Then request uncaptured detail: the UI must distinguish saved values from a new recomputation request and refuse capabilities that the disconnected backend cannot provide.

Pin and record model/tokenizer source revisions, configuration digest, weight identity, effective dtype, native library/tool binding versions, mode, source transformations, capture policy, and actual package licenses. Do not include credentials or local secrets in the manifest.

## 5. Replacement and experiment acceptance specifics

### FP-06: actual replacement

First replace a simple activation on a variant, with explicit semantics and derivative behavior. Then replace a linear region with a composite branch such as `W x + s B(Ax)` in the readable test runtime. Declare which parameters are frozen/trainable and how new parameters initialize.

Confirm the new branch appears through semantic structure, its exact operands/source are available, new parameter ownership and optimizer state are valid, and the original checkpoint/run remain unchanged. Source declaration and actual executed operations must agree. Deliberately invalid axis/state/precision substitutions must fail preflight.

A full graph editor, downloadable plugins, and optimal training behavior are not requirements for this proof. Correct registered variants are.

### FP-07: runtime intervention

Retain head ablation at its exact current boundary. Add one donor-to-target activation patch. Test no-op replacement, wrong layer, wrong invocation, mismatched coordinate basis, invalid scope, unsupported writable point, cancellation, failed arm, and explicit return to accepted state.

The receipt must name the applied intervention and affected source occurrence. An observable-but-read-only point must not be writable through a fallback code path.

### FP-08: data and security

Both training arms start from identical complete supported state with matched budgets and ordering. Record each substituted example and all evaluation inputs. Keep the vocabulary/input transformation policy fixed where that is a controlled variable. Use disjoint evaluation where the claim requires it.

A bounded defended/undefended extension records both clean utility and treatment effects. A null result, unchanged prediction, or degraded benign task is valid evidence. The gate requires measurement integrity, not a predetermined successful attack or defense.

Use a tiny deterministic wrapper to validate correlation between model records and external context/policy records. This is a contract fixture, not a rebuilt Agent Range or evidence of production application security.

## 6. Migration stages and ownership

### M0: freeze invariants and the migration map, not untested APIs

Record the actual checkout/runtime. Convert the design into a concise contract map, legacy-to-new mapping, and proof ownership. Identify production users of each type; do not refactor unused provisional declarations while leaving the active snapshot/worker boundary unchanged.

Inspect current source once as part of implementation preparation. Do not rerun a broad art-direction or architecture literature campaign. Output exact first changes and test commands.

### M1: contracts, codecs, and dual producers early

Introduce versioned contracts/readers and adapter-facing requests. Preserve MicroGPT legacy snapshot validation as a registered codec. Keep old hashes/fixtures. Put the canonical producer behind the interface and introduce the native Pythia producer early, before freezing the shape of the API.

Build vertical proof: native input → selected evidence → same store/query → generic inspector → saved replay. Avoid implementing every field speculatively before a second real producer exercises it. Readable MLP/SGD and shape-only fixtures then challenge hidden language/Adam assumptions.

### M2: topology, world, and interaction separation

Move layer/head/dimension assumptions into the canonical descriptor and its curated layout hints. Shared world composition reads hierarchy/ports; source/read-model queries resolve full semantic identities. Refactor session actions, selection/navigation, and exhibit/lesson state at the boundaries needed for this work.

Retain the preferred composition and golden example routes. Validate full-size canonical captures after each affected structural change. Add Pythia collapsed-block/selected-layer views and capability-driven controls. Do not duplicate the app shell.

### M3: variants and experiments

Generalize head-ablation admission via registered recipe validation; implement alternative comparison policies alongside the strict existing one. Add actual replacements, patching, training-data substitution, and the correlation fixture. Exercise invalid configurations and loss of backend capabilities.

### M4: durable payloads and failure boundaries

Complete export/import, bounded slices, capture/renderer work limits, old evidence compatibility, pending/opaque states, transport idempotency and reconciliation tests. The payload access interface exists from M1 so this stage replaces bounded in-memory implementations rather than changing every consumer.

No new database or remote service is required. Test using in-memory/byte-backed stores and fault-injecting local transports. A simulated transport may prove failure handling but cannot satisfy FP-03's real independent runtime requirement.

### M5: independent foundation review

Run all FP proofs on the exact candidate, retained mathematical/evidence/state suites, source-isolation/import-boundary tests, and reviewed visual routes. Audit the change surface: new integration should change integration-specific code and registration, not add model-specific conditionals to generic player/archive/inspection/session code.

A reviewer checks whether the proofs really demonstrate the intended separation and whether readable teaching code survived. No unrun architecture placeholder counts as complete. Include the known narrow projection/provenance corrections in this qualified candidate.

### M6: full user testing, workshop, station, release

Only after M5, perform full unfamiliar-user comprehension/navigation testing, timed workshop rehearsal, actual-station qualification, and final release checks. Engineering visual/accessibility checks may occur earlier but do not substitute for these tests.

Maintain exact candidate identity, approved license/notices, versioned artifacts, successful candidate-bound CI, durable evidence, offline launch, operator recovery, and approved modes. Do not transfer an old soak's claim to a modified runtime.

## 7. Expected extension change surface

| Addition | Appropriate changes | Architectural failure signal |
| --- | --- | --- |
| New model | Integration descriptor, executor/binding, state/input codecs, tests, optional content/layout hints, registration | A copied scene/inspector or model-specific branch in generic archive/coordinator |
| New operation | Precise operator schema, actual runtime implementation/binding, tests, optional visualization/explanation | Global hardcoded teaching/equation changes by model ID |
| New intervention | Typed recipe schema/validator, backend implementation, receipts, tests | Another dedicated experiment collection and validation branch in shared storage |
| New numerical format | Validated payload codec, metadata, tests, supported render decoding | Pretending decoded JavaScript numbers were originally float64 |
| New analysis method | Analysis artifact schema/binding, fidelity metadata, overlay, tests | Presenting an attribution/replacement graph as literal original computation |
| New event/workshop | Profile, lesson/content, approved artifacts/settings | Forking model execution or core UI for the event |

The table is an architectural review rule, not a ban on all future core improvements. During qualification, a discovered generic contract deficiency can be corrected centrally and all witnesses rerun. Versioned evolution is compatible with avoiding a rewrite.

## 8. Practical first implementation handoff

Attach the design and this proof plan separately. The following is a proposed future implementation prompt, not permission granted by this research response:

```text
Work in the existing Model Lab checkout. Read the attached design and proof
plan. Execute M0 and the bounded M1 vertical slice only: validated shared
contracts/legacy codec, canonical producer through that boundary, and native
Pythia input → selected internals → the same inspector/player → saved replay.

Verify current identities first. Preserve canonical math/fixtures and their
independent oracle, source provenance, candidate safety, readable model code,
and the preferred continuous-world direction. Exercise the second producer
early; do not create a universal model interpreter or a second application.

No silent backend/weight-processing fallback. Record actual vs derived or
recomputed values and unsupported capabilities. Keep unrelated work intact.
Deliver exact changes, executed tests, real evidence/captures, and remaining
proofs. Keep work local; no push, PR, merge, publication, deployment, or
unapproved dependency upgrades. Stop at this slice.
```

The optional Python environment and its dependency changes need explicit approval in that implementation task. The basic kiosk must continue building/running without those optional dependencies. The next handoff should not merely ask for another unbounded audit or the entire platform in one run.

## 9. Completion record template

For every FP proof retain: `status`, source commit/tree/runtime identity, integration/model/tokenizer revisions, requested/effective configuration, executed commands, results/artifact IDs, numeric policy and actual errors, unsupported capabilities, failure controls, reviewed captures, shared-code changes, and reviewer decision.

Use PASSED, FAILED, BLOCKED, or NOT_RUN with actual evidence. DISTILLED/SYNTHETIC/SHAPE_ONLY fixture origin stays explicit. A successful import or screenshot does not prove live execution; a passing live run does not prove historical replay or state isolation.

Source definitions and research provenance are in the companion design. All FP and M-stage work remains proposed until implementation and measurement establish it.
