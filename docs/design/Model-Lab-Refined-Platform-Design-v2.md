# Model Lab: researched platform design, revision 2

**Date:** September 13, 2026  
**Status:** Proposed design and acceptance requirements. Not an implemented feature list, adapter benchmark, or release certification.  
**Checked source:** `A-T-S-K/model-lab`, `wave-1a-spatial`, HEAD `f6a4b51326032fef41b8b0d8ca6539ae77366173`, tree `b6d06fe2f81d12518291aa67cad6ef833eeef1da`. [S1]  
**Companion:** [Model-Lab-Foundation-Proofs-and-Migration-v2.md](Model-Lab-Foundation-Proofs-and-Migration-v2.md).

## 1. Product definition and authority

Model Lab is a readable, extensible workbench for understanding real model computation, following learning, changing model techniques, and performing controlled model/security experiments. MicroGPT is its first deeply inspectable model. The preferred continuous-world interface is its first polished presentation. BSides Albuquerque is its first deployment profile. None defines the limits of the foundation.

The first foundation release must support adding models, operators, backend bindings, visual/explanation extensions, and experiment recipes without replacing the evidence store/player, session lifecycle, generic inspector, or navigation. Full unfamiliar-user testing follows executable foundation qualification. Expert visual checks and accessibility engineering continue during development.

### 1.1 What this revision changes

This revision replaces the prior event-first recommendation and refines the subsequent foundation-first outline. It makes the original Pythia proof explicit, restores training-data experimentation, protects readable teaching code from over-abstraction, separates per-point capabilities, and introduces explicit boundaries for research-analysis artifacts and representation transforms.

This is not a new renderer project, a universal ML compiler, a generic workflow editor, or a merger of all AI Village experiences. It does not reopen the current standalone repository decision. Historical acceptance reports remain evidence for their exact implementations and artifacts, not evidence that these proposed foundations already exist.

### 1.2 Recovered requirements and interpretation

The historical materials include both user-authored task briefs and assistant-authored research/planning syntheses. They are not all verbatim user requests. The current user messages control the product ambition; later explicit visual direction controls presentation. Repository source controls claims about implemented behavior.

| Requirement | Recovered basis | Design consequence |
| --- | --- | --- |
| Real execution, learning, experiments, and continued growth | Early September 5 architecture and later original-conversation context. [H1, H2] | A model workbench rather than a MicroGPT-specific exhibit. |
| Framework-independent evidence/player | Early runtime, trace-player, adapter allocation. [H1] | Native backends produce typed evidence; viewers do not read mutable model objects. |
| A meaningful second transformer | Original Agent J specifically requested minimal Pythia validation. [H1] | Native Pythia is a required foundation witness, not substituted by a small MLP alone. |
| Readable and hackable mechanisms | Readable by Design guidance and overnight principles. [H3, H4] | Keep ordinary forward/backward/training code; do not replace it with opaque interpreter dispatch. |
| Predict, Learn, Break It | Early experiment plans and matched poisoning guidance. [H2, H5] | Input/generation, objectives, data recipes, and training lineage belong in the foundation. |
| One navigable value-geometry world | September 11 continuous-world correction. [H6] | Stable semantic objects and local transformations, not a gallery of disconnected stages. |
| Graphite/Plex, selective depth and motion | September 12 accepted integration brief. [H7] | Preserve the current direction; no obsolete blanket ban on spatial presentation. |
| Runtime and deployment independence | Original deployment and post-merge boundaries. [H1, H5] | Browser-local basics; optional research execution; no compulsory cluster or shared chat API. |
| Distinct neighboring products | Prior Model Lab/Behavior Studio/Tabular distinctions. [H2, H5] | Correlate evidence when justified, rather than merging runtimes or forcing one UI. |

An overnight pass's exclusions were limits on that pass. A visual-redesign instruction not to change the engine was a safety boundary for visual work. Neither permanently excluded adapters or architectural improvements from Model Lab.

## 2. Research decisions

### 2.1 Own the learning and evidence contract, not every model implementation

TransformerLens's current migration documentation favors TransformerBridge around native Hugging Face implementations over reimplementing each architecture inside one unified model. Its compatibility modes can also change weight processing and representations. [R1]

**Decision:** keep native execution where available. Model Lab owns semantic references, evidence identity, experiment meaning, teaching, and visualization. External hooks and tools are replaceable backend bindings, not the public Model Lab ontology.

Keep the existing scalar MicroGPT implementation as the readable teaching organism and numerical reference target. Do not convert it into a universal runtime simply to share orchestration with a Python model.

### 2.2 Capabilities are local and multidimensional

The rechecked interp-engine supported-points document has the same blob as the earlier research: `a88ef2947f5a425bc724b34c117cce544d560b12`. It distinguishes captured from recomputed points, capture from steering, unreachable from unimplemented points, and restrictions under tensor parallelism. [R2]

**Decision:** capability negotiation is per semantic point, operation, execution mode, and requested action. One `supportsAttention: true` or `supportsInterventions: true` flag is insufficient. A source can provide a tensor yet prohibit changing it.

NNsight scan exposes shapes and dtypes through fake tensors without numerical data. [R3] Consequently, architecture preview and actual numerical evidence are distinct states. A shape preview must never gain a quantitative heatmap through plausible placeholders.

### 2.3 Do not mistake an analysis graph for original execution

The circuit-tracing methods paper uses replacement models and discusses reconstruction and mechanistic-faithfulness limitations. [R4]

**Decision:** sparse features, attribution graphs, circuit hypotheses, and learned projections are versioned analysis artifacts linked to runs. They never replace the identity of the actual computation graph. An observation of a replacement model is an observation of that replacement model, not of the original.

### 2.4 Reuse educational methods, not unsupported example claims

Transformer Explainer connects overview, on-demand detail, and experimentation; its paper reports a 90-participant study. [R5] 3Blue1Brown's attention lesson explicitly uses imagined head behavior to motivate geometry. [R6]

**Decision:** preserve overview-to-detail continuity and actionable experiments. Analogies and imagined semantic behavior must be labeled as explanatory devices. Do not claim an untrained character model has learned noun/adjective or factual-retrieval circuits merely because an analogy illustrates them.

### 2.5 Existing intervention libraries are adapters, not architecture mandates

The pyvene paper describes configurable interventions, including trainable interventions. [R7]

**Decision:** the Model Lab recipe must be executable through different backends. Reusing a library's intervention implementation is possible, but importing its entire configuration format as Model Lab's canonical evidence contract is not required. No new external library is approved or pinned by this document alone.

## 3. Architecture: a small modular application with explicit extension boundaries

Use logical modules inside the current repository. Do not require a package-publishing system, microservices, or a build-framework migration.

### 3.1 The three representations

**Execution representation:** actual operation occurrences and available observations for a run. Records may be complete, scoped, or opaque. Repeated calls, token steps, branches, and stateful operations have separate occurrence identities.

**Semantic representation:** model/module hierarchy, operation semantics, typed ports, parameter/state ownership, and dependencies. It may describe a composite operation even when a backend executes it as a fused primitive. A mapping must explain which parts are observed, derived, reconstructed, or unknown.

**Teaching representation:** local scenes, level-of-detail choices, equations, guided landmarks, analogies, and layout hints anchored to semantic references. It neither owns model state nor invents execution events.

These are different views of related identities, not three independently authored numerical traces. The semantic representation is descriptive, not a mandatory executable compiler IR.

### 3.2 Logical module responsibilities

| Module | Owns | Does not own |
| --- | --- | --- |
| Contracts and codecs | Versioned definitions, evidence/recipe schemas, validators, compatibility readers | A specific engine's live objects or optimizer implementation |
| Model integrations | Model/config/input semantics, native runtime bindings, state codecs, source mappings | Global navigation and visitor state |
| Runtime coordination | Requests, capabilities, budgets, cancellation, candidate transactions, receipts | Model arithmetic reproduced in the browser UI |
| Evidence storage/query/player | Immutable admission, indexes, slices, replay, verified derivations, archives | Execution merely because a file or selection is opened |
| Experiments and comparisons | Arm construction, interventions, metrics, matching policy, outcome lineage | Universal tensor subtraction for unrelated representations |
| Presentation and content | Continuous world, generic inspector, specialized visualizers, explanations, lessons | Direct reads from mutable runtime internals |
| Deployment profiles | Initial model/lesson, allowed capabilities, kiosk policy, local/optional endpoint configuration | Different numerical semantics for the event |

### 3.3 The contribution unit: a model integration

A model integration contributes a manifest referencing trusted registered implementation code and data:

- definition/configuration/input/tokenizer/objective schemas;
- native executor and evidence bindings;
- checkpoint/training-state codecs and capabilities;
- semantic structure and optional layout hints;
- source references, explanation entries, and specialized visualizers;
- conformance, invariance, capability-refusal, and fixture tests;
- license/provenance metadata for distributed code, weights, tokenizer, and fixtures.

This is a logical contribution unit, not a required ZIP format or an instruction to dynamically execute imported code. Reviewed build-time registrations are sufficient initially.

### 3.4 Readable model code is a release invariant

The mechanism should remain recognizable as ordinary code such as:

```text
scores = scaled_dot_product(q, k)
observe(scores_point, scores)
weights = softmax(scores)
output = weighted_values(weights, v)
```

This sketch illustrates separation; it is not new production code. Registration selects an implementation, binds evidence, and supplies metadata. It should not force a learner to understand an interpreter, scheduler, or generic operation registry before finding the real forward pass.

DRY the shared infrastructure, repeated presentation semantics, source bindings, and validation paths. Do not DRY the independently authored reference oracle into the production model or erase a model's genuine architectural differences.

## 4. Semantic identity and model structure

### 4.1 Address values independently of screen placement

Use a versioned model-definition identity, a stable module/node ID, a port ID, and typed coordinate roles. A specific observation also requires the run/arm and invocation or step identity.

Illustrative relationship:

```text
model definition / node / port
    + run / invocation / phase
    + axis coordinates
    -> artifact or bounded slice
    -> declared display transform
```

Display labels, positions, list offsets, and scalar node numbers alone are not universal identities. Scalar node IDs stay local to their actual run/runtime. The current `generationId` cancellation epoch must not become the generated-token-step index.

Axes need names and roles: batch/example, input position, query position, key position, query head, KV head, feature, vocabulary entry, expert, modality, or registered extensions. Axis names are not themselves proof of compatible coordinates: coordinate-space identity and transforms matter.

### 4.2 Topology and ports must express real differences

Define data dependencies separately from control/state edges, saved-residual edges, and parameter references. Represent repeated modules, parallel branches, concatenation, shared weights, recurrence, conditional routing, and optional state ports. Do not flatten every model into the canonical six-stage narrative.

Parameter aliases identify shared/tied storage, so their gradient contributions and updates remain attributable to one parameter. Ports can require normalized/nonnegative weights, a mask convention, a coordinate-space identity, a dtype family, or an axis relationship. Shape-only validation is not enough.

The generic descriptor is extensible, but the initial built-in operator family remains compact: lookup/input transform, affine map, reductions, normalization, pointwise activation, dot/weighted sum, concat/split/reshape, residual addition, distributions/sampling, objectives, gradients, and updates. New techniques add precise operator definitions and composite structure.

### 4.3 Evidence coverage is explicit

A static model descriptor declares expected structure. It must be checked against runtime observations or a pinned source mapping. An introspection/shape scan provides structural evidence, not numerical execution.

A graph may contain an opaque region. Show known inputs, outputs, state, source, and the missing internal coverage. Do not silently relabel an unfamiliar region as MLP/attention merely to obtain a familiar drawing. A generic fallback is essential infrastructure, but is not a claim that a polished explanation exists for that operator.

## 5. Execution and evidence contracts

### 5.1 Requests and controls

Use versioned execution intents rather than MicroGPT's return types as the cross-backend API. A plan names model/state, input and target artifacts, objective or generation recipe, capture policy, optional experiment arm/interventions, and budgets. Results are receipts plus evidence references.

Maintain separate controls for execution and explanation playback. Actual stepping declares its granularity: scalar operation, semantic boundary, layer, generation step, or unsupported. Cancellation similarly declares whether it can stop admitted work, stop before the next boundary, or terminate a worker and restore supported state.

Every accepted action is tied to an epoch and expected state. Delayed replies cannot resurrect discarded work. Multi-step or remote execution must account for backpressure and bounded outstanding requests. Retried mutation requests require idempotency or an explicit reconciliation path.

For an ambiguous remote acceptance outcome, report an indeterminate state and reconcile the authoritative receipt/state before another mutation. A lost network reply must not be displayed as successful discard or definite acceptance. This failure contract can be exercised with a fault-injecting transport without making remote infrastructure mandatory.

### 5.2 Per-point capability contract

For each point/action, report support, prerequisites, coverage, execution modes, restrictions, refusal reason, and available provenance. Independently assess:

- structural inspection;
- observed capture;
- mathematical derivation from existing values;
- reexecution-based detail;
- in-run intervention;
- architecture/subgraph replacement;
- backward/VJP evidence and optimizer evidence;
- stepping and cancellation;
- checkpoint export, compatible-state resume, or replay only.

Keep backend capability separate from a specific run's availability. A backend can support a tensor that was not captured in this run. A captured tensor can be historical or belong to a different arm. A current capability snapshot is tied to model, adapter version, execution mode, device/parallelism policy, and capture settings.

### 5.3 Numeric and payload contract

Generalize actual evidence dtype and payload codecs beyond float64. Initially prove float64, float32, and integer/token metadata. Preserve original storage dtype, effective compute/accumulation precision when known, layout/endianness, concrete shape, axes, and numerical policy. Do not infer precision solely from JavaScript's number type or the model's saved configuration default.

Allow small inline values and bounded binary-backed tensor slices. Payload identity includes the decoding metadata needed to interpret the bytes. Summaries specify their operation and scope; clipped, sampled, top-k, projected, or aggregated data is never described as a complete original tensor.

Unavailable data is not zero. Structural masks and absent coordinates remain distinct from observed numerical zeros. Preserve backend-native finite mask values or negative infinities in a deliberately supported representation rather than claiming the canonical model materialized them. Numeric failure must be explicit; unsupported nonfinite payloads fail admission or become typed diagnostic evidence, not silently sanitized values.

### 5.4 Identity and portable state

Separate model definition, weight/buffer checkpoint, training continuation state, input/tokenizer identity, dataset/order identity, runtime profile, execution attempt, artifact, recipe, and analysis identity.

A portable checkpoint does not automatically include optimizer state. A published Pythia checkpoint must not be labeled an exact training-resume point unless required state is actually available and tested. Record optimizer family/configuration, scheduler, parameter groups/aliases, train/eval mode, RNG states where used, and data cursor/order for supported continuation.

Hashes identify bytes and declarations; they are not authentication or mathematical proof. Reproducibility claims specify their level: immutable recorded replay, supported deterministic resume, tolerance-bound reexecution, or statistical replication. PyTorch's documentation cautions against universal cross-release/platform reproducibility claims. [R9]

### 5.5 Versioning and historical compatibility

Evolve the existing contracts with explicit compatibility readers. Preserve original format-1 recordings and snapshot hashes byte-for-byte. An adapted view can refer back to a legacy source identity; it must not pretend unknown new metadata was originally captured. Separate schema, operator, integration, model, application, and runtime versions.

Unknown extensions are validated as bounded data and shown through safe fallback metadata where possible. They are not executed during import. Portable archive export/import is required; a specific container format, cloud object store, and automatic crash-resume service are not required initially.

## 6. Input, generation, and training are first-class

### 6.1 Input and vocabulary semantics

A tokenizer/input transform is versioned independently from the neural architecture. Record requested and effective input, transformation rules, token IDs, offset mapping when available, special-token roles, masks, and truncation. Do not silently edit input or vocabulary.

Distinguish tokenizer vocabulary, model output index space, and display labels. A padded or unmapped output index remains identifiable rather than being invented as a real token. Do not remove it from the probability normalization silently.

Teacher-forced targets and generated output tokens are distinct records. Preserve the current `abca` lesson as one recipe with its genuine q3/q4 semantics; do not turn a lesson's preferred token index into global selection policy.

### 6.2 Generation

Record the model logits/distribution separately from temperature, filtering, sampling, RNG use, and the chosen token. A top-k chart retains the omitted mass and search/slice access; it does not renormalize the shown bars without an explicit conditional-distribution label.

Represent prompt processing, subsequent invocations, generated positions, stop conditions, and optional KV/state reuse. A backend without a cache can reexecute prefixes and declare that implementation. A cache-enabled path must expose/invalidate its dependency on checkpoint, prefix, positions, precision, and interventions. Cache correctness requires comparison against an appropriate uncached path.

### 6.3 Training and data experiments

Objectives have definitions, reduction scope, targets, masks, and evaluation semantics. Optimizer families supply their real state/update explanations rather than forcing all training into Adam panels. Loss, adjoint/VJP, contribution, accumulated gradient, clipping/scaling when present, proposal, and applied delta remain distinct.

Data recipes identify examples, dataset versions, order, budgets, and held-out evaluation. A checkpoint timeline uses actual saved states. Loading a later checkpoint is not live training. An actual local training step remains essential for the introductory teaching organism.

Training-data substitution is required as a foundation experiment. Matched clean/treatment arms start from the same complete state with controlled budgets/order. Evaluate clean, triggered, and untriggered cases as appropriate. Do not require the experiment to demonstrate a generalizing backdoor to pass the infrastructure gate; require honest measurement and correct controls. [H5]

## 7. Technique variants, interventions, and comparisons

### 7.1 Different operations need different contracts

| Change class | Required declaration |
| --- | --- |
| Alternative implementation of the same math | Equivalence scope, runtime/precision profile, conformance tests, any missing intermediates |
| Representation-preserving/reparameterizing transformation | Mapping/processing identity, parameters affected, what outputs or analyses remain comparable |
| Architecture/module replacement | New definition, typed interfaces, parameters/state, gradient semantics, initialization/migration |
| Run intervention | Exact boundary, coordinate scope, replacement/donor, gradient policy, order, application receipt |
| Training/generation recipe change | Data/objective/sampling/budget differences and evaluation policy |
| Analysis method | Subject runs/models, method/dictionary versions, assumptions, fidelity/uncertainty, validation |

### 7.2 Replacement workflow

Select a semantic region; show registered compatible alternatives and refusal reasons; preview structural changes; choose initialization/state treatment; execute a separate variant; inspect actual evidence; compare under the chosen policy; explicitly select or adopt the variant when supported.

Compatibility must check semantics and axes as well as shape, state, dtype, resource limits, and gradient behavior. A replacement adding parameters cannot silently reuse unrelated optimizer moments. A composite alternative may require new basic operation instances but should reuse the shared graph/inspector.

Qualification includes an actual activation substitution and an additive low-rank branch such as `W x + s B(Ax)`, with explicit base/trainable parameter ownership. These are witness choices, not a mandatory public editor or a promise of performance improvement.

### 7.3 Intervention workflow

Keep head ablation's existing precise meaning as a registered recipe. Activation patching identifies donor and target artifacts, boundary, coordinate mapping, run scope, and whether the replacement is detached or differentiable. The recipe records requested changes; the receipt records what actually applied. A no-op intervention is a required control.

Architecture replacement support, arbitrary activation replacement, and observation support are separate capabilities. A capture-only hook cannot be treated as a writable location because its tensor is visible.

### 7.4 Comparison policies

Preserve the current strict comparison semantics as one policy. Add explicit policies for same-model training changes, matched interventions, backend conformance, architecture variants at compatible boundaries, and input/tokenizer variants with declared alignment.

Direct coordinate deltas require compatible representation meanings and transformations. Equal tensor shape or similar node names are insufficient. Cross-model output comparisons may require text-level or task-level metrics rather than subtraction of vocabulary vectors. Different vocabulary distributions are not automatically alignable.

For visual comparison, use common scales and declared common projection/basis where meaningful. A basis independently fitted to each source cannot be used to depict literal feature movement across runs without qualification.

## 8. The visual and interaction design

### 8.1 One instrument, multiple levels of detail

Preserve Instrument Graphite, IBM Plex, neutral quantitative surfaces, external selection emphasis, and the preferred continuous-world experience. [H6, H7]

At whole-model level, group repeated blocks and show the structural path, parameters, and learning relation. At block/operator level, reveal actual tensors and local dependencies. At component/arithmetic level, bind the selected calculation to operands, equations, source, and exact values. Guided, Explore, and Microscope are navigation/disclosure behaviors over this same world.

Architecture descriptors supply structural information and optional stable layout hints. A generic hierarchical layout handles additions and repeated structure, while the canonical MicroGPT layout remains a curated preset. Adding Pythia must not require copying the scene component or manually embedding six extra block layouts in global code.

Do not make 3D a mandatory encoding for every operation. Preserve connected spatial identity and use 2D, 2.5D, or local 3D where it explains actual values. Replacing the renderer is not required to establish these boundaries.

### 8.2 Quantitative construction contract

Each construction names its source/slice, operation, transform/basis, scale and sign/zero rules, dimensional reduction, aggregation/clipping, comparison policy, and invariants. Metadata can be disclosed progressively, but distinctions that change interpretation remain accessible without hover.

| Construction | Essential contract |
| --- | --- |
| Vector/matrix | Actual components, declared scale, zero/sign, axes and selected coordinates |
| Dot product | Complete chosen vector slices, signed products/reduction, scaling, vector norms where explained |
| Normalization | Exact variant, axes, epsilon, learned gain/bias if present, actual inputs/output |
| Mixture | Weight semantics and complete contributor scope; convex/simplex language only when justified |
| Residual/concat | Addition versus channel joining remain visibly different; saved operand identity persists |
| Projection/embedding view | Basis, fitted source, preserved/distorted relationships, original-value access |
| Gradient/update | Edge contribution versus accumulated gradient versus optimizer proposal/applied delta |
| Distribution | Actual denominator/support, target/predicted/sample distinction, omitted mass |

A future technique can reuse a construction only if its semantic requirements hold. A signed weighted sum cannot inherit the convex-mixture story; GELU cannot inherit ReLU's hard zero gate.

### 8.3 Motion has three distinct meanings

Execution progress is backend-acknowledged work. Explanation playback is a teaching sequence over evidence. Measured runtime timing is optional profiling evidence. Never substitute one for another.

Keep stable selected object identities, anchored camera movement, visible source/phase context, interruptible guidance, and explicit resume. Static/reduced-motion views retain causal and numeric meaning. An interpolated visual transition is not an observed intermediate tensor unless such evidence actually exists.

### 8.4 Contextual controls

Visibility derives from current task, semantic selection, capabilities, source availability, transaction state, and user depth preference. It must not reset hidden choices or mutate the model. Keyboard focus must survive rerenders predictably.

Prediction exposes input/prefix and named outputs first. Attention reveals relevant query/KV/head controls. Parameter detail reveals ownership and gradients where supported. Candidate-ready exposes actual comparison and decision actions. Experiments show the controlled variable and return-to-baseline path. Raw IDs, capture budgets, and operator diagnostics remain reachable but subordinate.

Changing models resolves the selected concept through an explicit mapping or reports it unavailable. It must not silently move a pinned parameter or intervention to a different object with a similar label.

### 8.5 Explanation modules

Every supported operation has a short purpose, an optional intuitive analogy with limitation, equation/semantics, actual bound example, next consumer, source reference, and misconception checks. Content is versioned against operation semantics, not a whole-app wave number.

For example, a weighted-value mixture can be compared to an audio mixer, while explaining that each channel carries a vector and all admitted contributors matter. Gradients describe local sensitivity, not the optimizer's final step. Tiny-model fitting demonstrates mechanics, not language understanding or generalization.

Keep concept-to-source navigation on actual immutable revision/symbol references. Source/tests/fixtures remain educational artifacts. Do not use copied illustrative semantic stories as evidence about the current model.

## 9. Security and research growth without absorbing other products

Separate three evidence domains:

1. **Model mathematics:** tensors, objectives, gradients, state, interventions.
2. **Runtime systems:** framework operations, kernels, memory, scheduling, measured timing.
3. **Application/trust:** context assembly, retrieval, tools, policy decisions, external effects.

Use explicit correlation links and typed relationships. Correlation alone does not establish causation. Original runtime-profiling ambitions and future Agent Range integration both fit without overloading one ambiguous system trace.

A cross-product “inspect this invocation” action requires the actual captured invocation. Otherwise call it a related explanatory example. Model Lab does not become Behavior Studio or Agent Range, and those products do not need its scalar/optimizer schema. [H2, H5]

Security recipes declare threat assumptions, attack/perturbation, defense, clean utility, efficacy metric, false-positive/negative definition, budgets, and evaluation data. Initial foundation proofs include both runtime intervention and training-data substitution. A bounded clean/perturbed × defended/undefended scenario validates the general lifecycle without declaring production security effectiveness.

Research overlays such as sparse features and attribution graphs reference their source run, model, learned dictionary/replacement model, method revision, assumptions, and fidelity/validation artifacts. Labels and hypotheses are annotations, not observed semantic truths. This separation is required now; a full SAE training/circuit-tracing platform is not.

## 10. Resource bounds, safe imports, and deployment

Large-model support depends on hierarchy, capture planning, lazy payload access, bounded slices, bounded scene objects, and backpressure. It must not require materializing every scalar of a full run on the main thread. Capture levels are requests with measured costs and explicit coverage, not promises that summary capture makes training tape memory disappear.

Reject malformed schemas, coordinate ranges, oversized/decompression-expanded payloads, invalid refs, unauthorized endpoints, executable imports, unsafe markup, and unsupported codecs. Recipes import as inert data; executing one requires an explicit authorized action through registered code. Backend faults cannot turn into silent model/provider fallback.

Retain the browser-local deployment with prepared assets and no required WAN/GPU. A separately installed optional Python research profile may execute the native Pythia and small PyTorch witnesses. It is not a dependency of the ABQ canonical kiosk. Each production configuration is qualified separately.

No database, Kubernetes refactor, public arbitrary-code plugin loading, universal chat transport, or mandatory MCAP/Protobuf/OpenTelemetry stack is required to implement these contracts. Future tools map to them through adapters. Avoid pinning architecture to a mutable external conventions page or untested claim of universal coverage.

## 11. Current-source migration anchors

| Current source | Verified constraint | Destination |
| --- | --- | --- |
| `trace/types.ts` | Numeric records restrict dtype to float64; provisional training record restricts optimizer to Adam. [S2] | Versioned typed records and registered state/optimizer codecs |
| `archive/snapshot.ts` | Active validator requires character vocabulary, BOS at vocabulary end, fixed MicroGPT parameter names and 4× MLP shapes, Adam fields. [S3] | Preserve as MicroGPT legacy/state codec; generic archive dispatches codec validation |
| `app/spatial/forward.ts` | Address omits layer; source/dependency mapping and selection hardcode layer0. [S4] | Semantic graph queries and integration-specific mapping outside generic presentation |
| Existing source/worker/archive/compare paths | Prior audited coupling and safeguards remain relevant. [S5] | Narrow extraction, preserving strict legacy behavior and adding explicit policies |

Do not replace the strict snapshot validator with a permissive universal one. Move its authority into the appropriate codec and test that generic admission calls it. This preserves the guardrail while removing accidental platform-wide specialization.

Foundation completion requires the companion proof matrix, including a real native Pythia integration. This design is not accepted merely because its interfaces compile.

## 12. Source register and limits

Historical sources were recovered through conversation context and uploaded-file excerpts. This synthesis did not obtain or re-review every full-size prototype image or rerun the existing app. External adapter candidates were researched, not installed or benchmarked. All implementation witnesses are proposed work.

### Historical records

- **H1:** `Pasted markdown.md`, uploaded September 5, 2026 at 05:30:11Z, file `file_000000009a988230a68c54ad510ffcee`. Early architecture, sections 32–36, Agent C/F/G/H/J and platform diagram. Explicit minimal Pythia proof.
- **H2:** `Pasted markdown.md`, uploaded September 5 at 11:30:49Z, file `file_0000000066988230be4a50ed3cfba449`. Deeper architecture/reuse analysis, semantic ownership, white-box versus chat transport, neighboring product boundaries, Predict/Learn/Break It.
- **H3:** Readable by Design guidance, `Pasted markdown.md`, file `file_00000000f3f08230a3d6c12fa05fc0c7`. Teaching core, mechanism visibility, source mappings, abstraction limits.
- **H4:** `AI_Village_ABQ_Overnight_Execution_Plan.md`, September 5, file `file_000000005ad8823095e3d7965b7f8565`. Principles and explicitly bounded overnight scope.
- **H5:** `AI_Village_Post_Merge_and_Model_Lab_Plan_v2.md`, September 5, file `file_0000000095448230ba545974c3f3171d`. M00–M07, poisoning controls, integration/isolation and evidence authority.
- **H6:** `Continuous-World-Design-Brief.md`, file `file_000000004d3c8230bf4ffe98b1fb1c8f`, plus the September 12 00:08:42Z uploaded continuous-world prompt, file `file_0000000017b08230b4a9ceaa887fe5ba`.
- **H7:** `Model-Lab-V2.1-Design-Language-Integration.md`, September 12, file `file_00000000803c8230b38ed1f6eebe9507`. Latest visual authority and explicit supersession rules.

### Current source

- **S1:** [Branch read](https://api.github.com/repos/A-T-S-K/model-lab/branches/wave-1a-spatial), mutable endpoint; immutable audit identity is recorded at the top.
- **S2:** [trace/types.ts at checked commit](https://github.com/A-T-S-K/model-lab/blob/f6a4b51326032fef41b8b0d8ca6539ae77366173/trace/types.ts).
- **S3:** [archive/snapshot.ts at checked commit](https://github.com/A-T-S-K/model-lab/blob/f6a4b51326032fef41b8b0d8ca6539ae77366173/archive/snapshot.ts).
- **S4:** [app/spatial/forward.ts at checked commit](https://github.com/A-T-S-K/model-lab/blob/f6a4b51326032fef41b8b0d8ca6539ae77366173/app/spatial/forward.ts).
- **S5:** Prior local audit and review reconciliation dated September 13. Findings are historical source/review evidence; their event-first planning recommendations are superseded here.

### Primary research checked for this response

- **R1:** [TransformerLens 3 migration and native TransformerBridge](https://transformerlensorg.github.io/TransformerLens/content/migrating_to_v3.html). Documentation claim, not an executed integration result.
- **R2:** [interp-engine supported points](https://github.com/decoderesearch/interp-engine/blob/main/docs/SUPPORTED_POINTS.md), fetched file blob `a88ef2947f5a425bc724b34c117cce544d560b12`.
- **R3:** [NNsight scan documentation](https://nnsight.net/features/14_scan/).
- **R4:** [Circuit Tracing methods and limitations](https://transformer-circuits.pub/2025/attribution-graphs/methods.html).
- **R5:** [Transformer Explainer paper, version 2](https://arxiv.org/html/2408.04619v2).
- **R6:** [3Blue1Brown attention lesson](https://www.3blue1brown.com/lessons/attention/).
- **R7:** [pyvene authors' paper](https://arxiv.org/abs/2403.07809).
- **R8:** [EleutherAI Pythia-14M card](https://huggingface.co/EleutherAI/pythia-14m) and [current configuration](https://huggingface.co/EleutherAI/pythia-14m/blob/main/config.json). Record immutable revisions at implementation; do not treat model name as immutable provenance.
- **R9:** [PyTorch reproducibility guidance](https://docs.pytorch.org/docs/stable/notes/randomness.html).
