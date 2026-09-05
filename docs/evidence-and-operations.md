# Evidence and operations

Model Lab keeps execution, saved evidence, and explanation separate. The source contracts live in [trace/types.ts](../trace/types.ts); the mathematical runtime lives in [model/](../model/).

| Operation | What happens | What state it needs |
| --- | --- | --- |
| Replay | `TracePlayer` reads saved immutable artifacts. | A `RecordedRun`; no model runtime. |
| Reexecute | `predict`/`forward` performs fresh model computation. | Parameters, configuration, and input. |
| Derive arithmetic | `attentionDetail` multiplies saved Q/K entries and sums/scales the results. | Captured Q/K, selected layer/head/positions, and architecture. |
| Continue training | `trainStep` computes gradients and updates the live model. | Complete continuation state, including Adam moments and schedule position. |
| Intervene | A treatment would modify a declared mechanism/state and reexecute. | A specified control/treatment and appropriate starting state; the core Predict/Learn UI is not an intervention framework. |

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

The worker's training result has two related parts. `learn` contains the genuine pre-update prediction, optimizer update, and fixed-input post-update prediction. The accompanying semantic `run` is a fresh recorded prediction from the **post-update** model. Its checkpoint step therefore describes the state that produced its vectors.

The runtime's `TrainingSnapshot` in [model/state.ts](../model/state.ts) serializes the concrete model and optimizer for continuation. The trace contract's similarly named object in [trace/types.ts](../trace/types.ts) describes immutable evidence about a checkpoint and continuation state. They are provisional, distinct shapes; do not cast one into the other. A weights-only checkpoint cannot reproduce the next Adam update without moments and schedule state. A seed cannot stand in for a current RNG state when randomness is consumed.

See [trace tests](../tests/trace/evidence.test.ts) for immutable replay and missing-evidence properties, and [model tests](../tests/model/conformance.test.ts) for observer invariance and continuation checks.
