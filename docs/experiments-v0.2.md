# Controlled experiment evidence — September 5, 2026

These bounded trials use the pinned canonical microgpt fixture and actual scalar execution. They make new observed runs from disposable copies of an exact archived `TrainingSnapshot`; they do not label experiment outputs as evidence from a historical source run. No external model, dataset, or service is used.

Reproduce from `model-lab/`:

```sh
node --import tsx --test tests/integration/experiments.test.ts
node --import tsx scripts/benchmark-experiments.ts
```

The benchmark executes each complete experiment twice and asserts deep equality of its evidence. The measured run used Node `v24.20.0`. Timings below are one local Node observation, not browser responsiveness guarantees. Numeric values below are the actual JavaScript binary64 output, without conversion to success percentages.

Starting state:

```text
sha256:d1a46ae0fe2830a2bbcdc118913c5d974ef82e6acc2ef1004b5f8d0dae5b3ca1
```

## Head ablation

Both arms start from the identical complete training state and use the canonical `abca` teacher-forced input and targets. The intervention replaces layer 0, head 0's aggregate output with explicit numerical zeros immediately before head concatenation. Q/K/V and attention probabilities are computed normally. The trace separately retains `headOutputBeforeAblation` and the actual zeroed `headOutput`. No parameter, optimizer moment, cursor, or RNG state changes.

The baseline and intervention have separate manifests. Only the intervention manifest declares `head_ablation`, the selected layer/head, the exact boundary, and zero replacement. `compareRuns` compares their semantic artifacts. The additional raw-head artifact is explicitly unmatched rather than assigned a fabricated delta.

| Measurement across all input positions | Observed maximum absolute change |
| --- | ---: |
| Logit | 0.014438034814141715 |
| Probability | 0.002362080285839563 |
| Attention residual | 0.09539333700357455 |

One complete paired trial, including source hashing, archival validation, and comparison, took 45.27683300000001 ms. Repetition produced exactly equal complete results. Tests verify unchanged Q/K/V and attention probabilities, zero selected-head output, changed residual/logits, source-state identity, and immutable result data.

Reusable worker API:

```ts
runHeadAblation(snapshot, inputIds, targetIds, { layer, head }, tag?)
```

It returns an immutable `HeadAblationExperiment` containing the starting snapshot ID, selected boundary/head, `provenance: 'observed'`, two fresh `RecordedRun`s, and their comparison. The optional tag supplies `sessionId`, `generationId`, and a unique experiment `runId`; generated run IDs append `:baseline` and `:intervention`. The Explore UI archives both returned runs against the supplied source snapshot and identifies them as a new experiment. These executions run in the disposable inspector worker.

## Training-data substitution research

The two training arms start from the same exact snapshot, use the same parameter order, optimizer hyperparameters, learning-rate schedule, and 50 updates. Their ordered clean schedule repeats:

```text
abca, bcab, cabc, abab
```

The intervention changes only steps 0, 4, 8, …, 48 from `abca` to `abcc`: 13 explicitly enumerated substitutions among 50 training documents. Both variants have the same token count. Evaluation executions do not update either model. Every update is archived as a validated `LearningExperiment`, with separate before/training/after runs and observed loss and gradients. The trial retains 101 unique snapshots, 314 runs, and 100 learning experiments.

The selected evaluation asks for the probability of next token `c` after prefix `abc`. This prefix already occurs in the training documents; it is an operational “triggered” evaluation, not evidence for an unseen trigger or hidden behavior. Controls use prefixes `bca` and `cab` and measure that same token probability.

| Next-token evaluation | Clean arm P(c) | Substituted arm P(c) | Substituted − clean |
| --- | ---: | ---: | ---: |
| Prefix `abc` | 0.013560834607233637 | 0.9112749273470381 | 0.8977140927398044 |
| Control `bca` | 0.0013678017492024192 | 0.001418475893022895 | 0.00005067414382047583 |
| Control `cab` | 0.8968518626647205 | 0.9356794275909015 | 0.038827564926181 |

Clean-task evaluation uses `abca`, `bcab`, `cabc`, and `abab`, unchanged in both arms. These are the clean training documents, so this measures retention of that task rather than held-out generalization. Each document's scalar mean loss is observed through a fresh teacher-forced evaluation. The reported clean-task mean is the equal-weight arithmetic mean of those four observed document means.

| Clean-task mean loss | Value |
| --- | ---: |
| Clean arm | 0.29243729289747566 |
| Substituted arm | 0.4511056505276815 |
| Substituted − clean | 0.15866835763020581 |

Final clean snapshot:

```text
sha256:9fb72b14c66697ea52c9131c1cba2e3abf9f311b073b270f2211c34f4a89e96e
```

Final substituted snapshot:

```text
sha256:fe68bbee760915b206f557ec67f25fb40d3e12e9d62adfd1e0f3f0ef2dfcfd2c
```

One complete two-arm trial, including all archive validation and evaluations, took 6583.303625 ms. Repetition produced exactly equal full reports and final state identities. This is deterministic repetition of one configuration, not a multi-seed robustness study. The increased desired continuation probability accompanies clean-task degradation and a measurable change in one control. These results support a narrowly stated training-data substitution effect; they do not establish a backdoor or generalized attack success.

`runPoisoningTrial(snapshot, options)` returns the immutable numeric report and its `SessionArchive`. Its options explicitly enumerate the training schedule, substitutions, desired token, selected prefix, controls, and clean documents. Invalid declarations are rejected before either arm trains. This remains a bounded research utility, without a generic experiment framework or public poisoning interface.

## Promotion recommendation

Promote **head ablation only**. It isolates one precisely located intervention, repeats exactly, retains unchanged upstream evidence, and shows immediate downstream arithmetic consequences. Its probability changes are small at the canonical initial state, so the UI should show actual values and deltas rather than imply that the predicted character must change.

Keep training-data substitution in research documentation. Its effect is clear for this trained prefix, but clean-task degradation and control changes make a public “backdoor” story unjustified. Any later expansion needs its own declared design and measured evidence.
