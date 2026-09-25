# Evidence and operations

This guide describes the current MicroGPT implementation and the identified shared
evidence and archive boundaries. Guarantees remain scoped to their qualified profiles.
The [target contracts](design/Model-Lab-Refined-Platform-Design-v2.md#5-execution-and-evidence-contracts)
and [migration plan](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#6-migration-stages-and-ownership)
are not themselves implementation status; consult [authority](README.md) and
[status](foundation-status.md). Versioned codecs, typed payload diversity, per-point
capabilities, portable archives and failure boundaries have scoped engineering
qualification recorded in that ledger. Independent M5 acceptance is pending.

Model Lab keeps execution, saved evidence, and explanation separate. The source contracts live in [trace/types.ts](../trace/types.ts); the mathematical runtime lives in [model/](../model/).

| Operation | What happens | What state it needs |
| --- | --- | --- |
| Replay | `TracePlayer` reads saved immutable artifacts. | A `RecordedRun`; no model runtime. |
| Reexecute | `predict`/`forward` performs fresh model computation. | Parameters, configuration, and input. |
| Derive arithmetic | `attentionDetail` multiplies saved Q/K entries and sums/scales the results. | Captured Q/K, selected layer/head/positions, and architecture. |
| Continue training | `trainStep` computes gradients and updates the live model. | Complete continuation state, including Adam moments and schedule position. |
| Intervene | Head ablation zeros one declared head output before concatenation in a disposable matched arm. | A specified control/treatment and appropriate starting state; the core Predict/Learn UI is not an intervention framework. |

`observed` means captured during the run. `derived` means calculated from existing evidence. `recomputed` means produced by a separate reexecution. The attention inspector's products are **derived**, while its `observedLogit` and `probability` come from the saved run. Merely displaying the multiplication does not mean every scalar operation was recorded originally. Detail includes `sourceRunId` to identify its source.

Availability is independent of provenance:

| Availability | Meaning |
| --- | --- |
| `available` | Authentic numeric evidence is present. A numerical zero is valid here. |
| `not_captured` | The required evidence was not saved. |
| `not_applicable` | The requested computation does not exist here, such as attention to a future position. |
| `unsupported` | The producer cannot supply this evidence. |
| `budget_exceeded` | The capture limits prevented retaining it. |

Unavailable artifacts store `values: null`. The recorder separately tracks stored numeric values, dropped artifact count, and budget exhaustion. UI consumers must preserve those distinctions instead of filling gaps with zeros or reconstructing invented observations.

At the shared `EvidenceStore` boundary, registered codecs first validate the original
producer envelope. Admission then keeps available payloads of at most 256 values inline
and converts larger available payloads to immutable content-addressed bytes. Retained
payload descriptors declare format, content ID, dtype, element encoding, little-endian
byte order, row-major layout, element count and byte length. The byte store supports
IEEE-754 binary64, IEEE-754 binary32 and signed int32; `slice()` returns at most 256
decoded values. A payload-backed available `EvidencePoint` therefore has `values: null`
and a `payload` descriptor; unavailable points have neither numerical values nor a
payload. Availability plus the payload descriptor, not `values: null` alone, distinguishes
these states.

The original evidence content ID remains the hash of the admitted envelope. Payload IDs
identify storage bytes plus decoding metadata and do not replace run, request or evidence
identity. Large admitted envelopes are not retained as hidden duplicate number arrays;
only bounded registered codec metadata remains. The historical `model-lab-json-v1`
serializer/parser still operates on original envelopes. Portable export of payload-backed
retained sessions uses a separate deterministic binary container with fixed magic/version,
a bounded canonical manifest and sorted length-delimited raw payload entries.

Portable archive v1 retains snapshots, legacy runs, registered experiment receipts and
standalone shared evidence while excluding worker, UI and pending-operation state.
Payload-backed entries carry separate original-envelope, portable-entry, payload and
whole-archive identities. Import loads bytes into isolated payload storage, reconstructs
a fresh `SessionArchive` through build-time integration/recipe/model registries, checks
complete references, and only then returns it for historical-view replacement. The
retained validator requires exactly one numerical storage path for every available point;
registered codecs can validate large evidence through bounded slices. Import never
executes source references, restores the live worker, contacts a native endpoint or
adopts a snapshot as accepted state.

A first-class `LearningExperiment` links exact starting/resulting snapshots, separate before/training/after semantic runs, observed gradient anchors, and the actual Adam update. The current `run` is the **after** prediction for display compatibility. Backward inspection explicitly targets the training run, whose scalar values and adjoints were frozen before Adam mutation. Both snapshots and all three runs remain independently inspectable.

The runtime's `TrainingSnapshot` in [model/state.ts](../model/state.ts) serializes the concrete model and optimizer for continuation. The trace contract's `TrainingStateRecord` in [trace/types.ts](../trace/types.ts) describes immutable evidence about a checkpoint and continuation state. This provisional record has no production consumer in the inspected checkout (its constructor is exercised in trace tests); the active snapshot/archive/worker boundary uses `TrainingSnapshot`. The record is an immutable checkpoint-oriented evidence contract; it is not the concrete resumable runtime state. Do not cast one into the other. A weights-only checkpoint cannot reproduce the next Adam update without moments and schedule state. A seed cannot stand in for a current RNG state when randomness is consumed.

See [trace tests](../tests/trace/evidence.test.ts) for immutable replay and missing-evidence properties, and [model tests](../tests/model/conformance.test.ts) for observer invariance and continuation checks.

The live worker privately retains complete scalar evidence for its current run and latest training backward context. Main-thread/archive objects contain immutable plain numbers only. Requested old scalar slices retain observed provenance. Whole captures retain semantic-to-scalar identity so new old-run requests can use saved observed evidence. The separate inspector worker is used only when this live/retained evidence is unavailable. It verifies the content-addressed complete snapshot, runtime/model/input/intervention semantics, every available semantic anchor, and actual gradient anchors for backward detail. Opaque source artifact IDs are resolved through their verified semantic correspondence. Mismatches return no explanatory graph.

Structural inputs such as embedding/parameter lookup, head slicing, causal selection, concatenation, stable-softmax maximum, target lookup and the backward seed are explicit immutable events. They remain outside the autodiff DAG. The maximum links to its actual input logits; parameters have matrix/row/column/index identities. Adam numeric substitutions derive from observed update records and exact snapshot hyperparameters; mathematical update and representable delta are distinct.

Reset model restores selected/canonical state while preserving history. Cancel returns to the last completed live state and preserves history. Clear session terminates both execution boundaries and clears archive/comparisons/experiments/inspection caches. Opt-in Exhibit mode invokes this full clear after five minutes without input, also checking on foreground return.

## Exact implementation identity

Each run manifest includes `runtimeRevision`, a SHA-256 over deterministically ordered production source paths and their exact bytes, plus fixture and build inputs. [The generator](../scripts/runtime-identity.mjs) lists the scope and encoding. It runs before tests and typechecking/builds; `npm run dev` builds and serves immutable output, and source edits require a restart/rebuild to prevent stale identities or mixed worker implementations; neither runtime nor isolated Docker builds require `.git`. Explore and Microscope disclose the recorded revision offline.

Snapshot identity identifies complete state; runtime revision identifies the implementation interpreting it. Historical reconstruction and numerical comparison refuse differing runtime revisions rather than assuming equal version labels imply compatibility. Scalar node numbers are private graph addresses within one execution and exact runtime revision; they are not portable public identities. Recursive historical operand navigation is tested against the original observed graph.

All browser SHA-256 identities pass through one implementation boundary. Secure and
potentially trustworthy origins use native `SubtleCrypto`; ordinary HTTP hostname/IP
origins use the bundled standards-compatible SHA-256 path because browsers omit
`SubtleCrypto` there. Both paths are checked for byte-identical lowercase identities.
A present native digest that rejects is not silently retried through the portable path,
so hashing failures continue to exercise the documented rollback and admission controls.
