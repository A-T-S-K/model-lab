# Read the Model Lab code

This walkthrough describes the current MicroGPT teaching organism. Its character
input, scalar arithmetic and Adam choices are not platform-wide restrictions.
The [target design](docs/design/Model-Lab-Refined-Platform-Design-v2.md#34-readable-model-code-is-a-release-invariant)
preserves readable native code and the independent oracle while extending shared
infrastructure; see [authority and status](docs/README.md).

Model Lab runs a real, very small scalar transformer. Start with the numbers and the model; the browser and trace code can wait. The initial fixture is untrained, uses the characters `a`, `b`, `c` plus BOS, and has **896 parameters**. That count belongs to this configuration: one layer, embedding width 8, two heads, and context 8. It is not a constant for microgpt or transformers generally.

Run the smallest example first:

```sh
npm run example
```

[examples/predict-teach.ts](examples/predict-teach.ts) loads the fixture, predicts, calls one real `trainStep`, and predicts the same input again. It uses no observer, worker, trace, archive, inspector, or UI.

Follow the TypeScript teaching path:

1. `Value` in [model/value.ts](model/value.ts): a number, its operands, and local derivatives.
2. `backward` in [model/autograd.ts](model/autograd.ts): accumulate the chain-rule contributions.
3. `linear`, `rmsNorm`, `softmax`, and `forward` in [model/microgpt.ts](model/microgpt.ts): embeddings → normalization → Q/K/V → causal attention → combined heads → projection/residual → MLP → logits → probabilities.
4. `loss` in that same file: select each known target's probability, take its negative log, and average.
5. `adamStep` and `trainStep` in [model/training.ts](model/training.ts): the actual gradient, moments, corrections, and stored parameter change.

On a first pass, skip `observe`, `observeVector`, `observeScalar`, and `structure.*` calls. They only describe and copy evidence from calculations you can already see. [model/observation.ts](model/observation.ts) contains their metadata and descriptions; it never executes a model operation. In `trainStep`, keep the visible `backward` → `captureBackward` → `adamStep` boundary in mind: evidence is copied before parameters change.

Then read the supporting layers: [trace recorder/player](trace/) → [live scalar capture](inspect/capture.ts) → [complete state](model/state.ts) and [session archive](archive/session.ts) → [historical reconstruction](app/worker/inspector.ts) → [worker controller](app/worker/controller.ts) and [UI](app/main.ts). Read the [independent Python oracle](reference/microgpt_reference.py) and [upstream provenance](reference/PROVENANCE.md) when comparing implementations.

The model imports neither the trace implementation nor the application. Understanding those systems is unnecessary to follow or execute its mathematics.

## 1. Establish what the numbers mean

Open [canonical.initial.json](fixtures/canonical.initial.json) beside the [fixture format guide](fixtures/README.md). `parameterOrder` defines how matrix entries map to optimizer arrays. Each matrix is stored as output rows by input columns. The input for `abca` is `[BOS, a, b, c, a]`; its targets are `[a, b, c, a, BOS]`. Each prediction is conditioned on the prefix available at that position.

**Real:** committed initialized matrices are actual model parameters. [generate_fixture.py](reference/generate_fixture.py) independently computes the expected forward values, gradients, Adam update, and fixed-input output after that update. It consumes the committed numbers, with no TypeScript dependency or RNG call.

**Simplified:** the dataset is one short canonical example. The fixture captures teacher forcing, so it needs no random sampling state. Its `rngState: null` is not a seed or a promise that stochastic sampling can resume.

**Generalizes:** a checkpoint and a reproducible input make numerical comparisons meaningful. **Does not directly generalize:** this vocabulary and untrained state cannot demonstrate a useful language model or the capabilities of a large pretrained model.

**Try:** inspect `wte[3]`, the BOS embedding, and compare it with the first position's `tokenEmbedding` in [canonical.expected.json](fixtures/canonical.expected.json). Do not manually adjust expected output to fit a changed runtime.

**Tests worth reading:** `test_initial_numeric_state_is_bound_to_expected_evidence`, `test_bos_and_targets_are_authentic_shifted_document`, and `test_fixture_regenerates_byte_for_byte` in [the Python tests](tests/reference/test_reference.py).

The upstream reference is Andrej Karpathy's gist revision `14fb038816c7aae0bb9342c2dbf1a51dd134a5ff`. This repository's Python oracle is independently authored. It was checked against the exact original source using [compare_upstream.py](reference/compare_upstream.py): 3,676 compared values had maximum absolute difference 0.0. The original source is not vendored; [provenance](reference/PROVENANCE.md) preserves attribution, content hash, license-evidence observations, and intentional differences without making a license decision.

## 2. Follow a scalar and its gradient

In `Value.mul`, read `data`, `parents`, and `localDerivatives` together. Multiplication stores its forward result and the local derivatives needed later. `backward` visits graph nodes in reverse topological order and adds each contribution into the parent gradient. A shared node is visited once, but every incoming contribution matters.

**Real:** this is reverse-mode automatic differentiation through the actual forward graph. **Simplified:** each scalar is an individual JavaScript object, and gradients use explicit graph traversal.

**Generalizes:** the chain rule, gradient accumulation, and separating forward computation from backward propagation. **Does not directly generalize:** object-per-scalar execution is not how production GPU tensor libraries achieve throughput.

**Try:** trace `x * x + x * x + x` at `x = 3`. Its value is 21 and its derivative is 13. Removing one repeated derivative edge changes the answer even when the shared node itself remains present.

**Tests worth reading:** “shared autograd paths accumulate repeated edges and shared subexpressions” and “backward handles deep graphs without depending on the JavaScript call stack” in [model conformance tests](tests/model/conformance.test.ts).

## 3. Follow embeddings into causal attention

Read `forward` from its token loop. It selects the token and position embeddings, adds them, and applies embedding RMSNorm. Inside the layer it saves that result as a residual, applies pre-attention RMSNorm, and projects Q, K, and V. **Both normalizations are part of the pinned algorithm.** The saved residual branches before the second normalization, so deleting the first normalization changes the graph and model.

For each head and past/current key position, the attention score is:

```text
score(query, key) = sum_j(Q[j] * K[j]) / sqrt(head width)
weights = softmax(scores over available key positions)
head output[j] = sum_key(weights[key] * V[key][j])
```

Keys and values from earlier positions remain `Value` objects attached to the graph. Later-position loss can therefore update earlier embeddings through K/V. These arrays are not a detached inference cache. Future positions have no entries: an unavailable attention cell is not an observed score of zero.

**Real:** learned embedding matrices, normalization, Q/K/V projections, causal softmax, and weighted values. **Simplified:** one layer and two small heads, scalar arithmetic, and short explicit sequential execution.

**Generalizes:** prefix conditioning and the mechanics of scaled dot-product attention. **Does not directly generalize:** this exact normalization placement, character tokenizer, and learned position table are not universal transformer design choices.

**Try:** select the last query and an earlier key in the inspector. Multiply each Q/K pair, sum the products, apply the scale, and compare with the captured logit. Then select a future key and look for an unavailable state.

**Tests worth reading:** “forward matches every Python semantic vector,” “attention probabilities sum to one; future positions are absent,” and “last-position loss reaches earlier token embeddings through causal K/V” in [model tests](tests/model/conformance.test.ts).

## 4. Follow the residual stream to a probability

After concatenating heads, `forward` applies the attention output matrix and adds the residual. It normalizes the new stream before the MLP, projects up to four times the embedding width, applies ReLU, projects down, and adds the next residual. The output matrix produces logits directly. **There is no final RMSNorm in this organism.** `softmax` subtracts the largest score for numerical stability. Subtracting a common offset leaves probabilities unchanged; derivative contributions through that common offset cancel, so the maximum is detached from autograd. `softmax` turns those logits into a distribution, and `loss` uses the negative log probability of each target, averaged over positions.

**Real:** matrix products, nonlinear activation, residual connections, a normalized probability distribution, and target cross-entropy. **Simplified:** no biases, dropout, or learned normalization gains; ReLU is the chosen activation.

**Generalizes:** logits, conditional distributions, residual paths, and cross-entropy. **Does not directly generalize:** the largest probability is not evidence that an untrained model understands the input, and probability mass is not a general confidence guarantee.

**Try:** compare `mlpUp` with `mlpRelu` for one position and locate the negative entries that become zero. Follow `mlpResidual` through `lm_head` to the final logits.

**Tests worth reading:** the forward, loss, and gradient comparisons in [model tests](tests/model/conformance.test.ts); `test_captured_loss_uses_target_probability` in [Python tests](tests/reference/test_reference.py).

## 5. Make one actual optimizer update

`trainStep` clears parameter gradients, calculates the real mean loss, calls `backward`, and passes those gradients to `adamStep`. The optimizer records the first and second moments before/after, bias-corrected moments, effective learning rate, parameter values, and actual stored delta. The displayed delta is `after - before`, including floating-point rounding. A fresh `predict` then runs the same fixed input using the updated parameters.

**Real:** genuine one-step optimization, with the gradient and moments actually used by Adam. **Simplified:** one document per update and a short linear learning-rate schedule.

**Generalizes:** gradients inform optimizer updates, and Adam continuation needs moment buffers and step/schedule state. **Does not directly generalize:** a changed distribution, changed top token, or a sampled string is not a blanket improvement claim. A claim about improvement needs a named metric and evaluation data. A changed top token is not required for a valid update.

**Try:** inspect one parameter before/after and verify `before + delta = after`. Reset to the initial state and compare the same fixed input again. Read `snapshotTraining` before trying continuation: parameters alone omit Adam moments, schedule position, dataset cursor, and any current RNG state in use.

**Tests worth reading:** “Adam moments, corrected moments, actual deltas, parameters and post-update forward match Python,” “Learn displays the optimizer gradient and applied delta,” and “serialized complete snapshot resumes the same second Adam update and schedule” in [model tests](tests/model/conformance.test.ts).

## 6. Distinguish execution from evidence

The semantic observer receives numeric copies after operations have run. The optional worker-private microscope callback additionally receives actual scalar roots; only immutable numeric graph slices cross the worker boundary. `TraceRecorder` copies and freezes that evidence, bounds values and artifact metadata, and labels unavailable capture explicitly. `TracePlayer` can replay saved JSON without importing the model. See [evidence and operations](docs/evidence-and-operations.md) for the precise vocabulary.

**Real:** the displayed semantic vectors originate in model execution. **Simplified:** the semantic recorder captures useful boundaries while the private capture context retains complete scalar evidence for the current tiny run.

**Generalizes:** immutable evidence, explicit provenance, and bounded capture. **Does not directly generalize:** these provisional concept names are not a universal ontology for every neural network.

**Try:** compare semantic and summary capture. A missing Q vector should become `not_captured`, never `[0, 0, ...]`. Replay a JSON recording after changing live parameters and verify that its old values remain unchanged.

**Tests worth reading:** observer invariance in [model tests](tests/model/conformance.test.ts); immutable recordings, missing evidence, runtime-independent replay, and the test-only logistic producer in [trace tests](tests/trace/evidence.test.ts).

## 7. Cross the worker boundary last

`ModelSession` owns the live model/optimizer and records predictions. `attentionDetail` derives multiplication terms from captured Q/K arrays and reports the separately observed logit and probability. `ModelWorkerClient` sends tagged commands to the worker, rejects responses from old sessions/generations, and terminates/restarts the worker on reset. Cancellation uses that same termination path and restores the last completed snapshot; it does not retain partially completed training. Reset can restore a selected archived snapshot. Clear session also clears the separate inspector and main-thread history.

**Real:** browser-local model execution occurs in a worker, with batched result objects sent to the page. **Simplified:** work inside one model command is synchronous; cancellation terminates the worker rather than interrupting its scalar loop cooperatively.

**Generalizes:** separating UI responsiveness from computation and rejecting stale responses. **Does not directly generalize:** this small command protocol is not a distributed training service.

**Try:** follow a `predict` request through [client.ts](app/worker/client.ts), [protocol.ts](app/worker/protocol.ts), [worker.ts](app/worker/worker.ts), and `ModelSession.handle`. For a `train` request, follow the first-class LearningExperiment: beforeRun, observed trainingRun with loss and gradient anchors, exact resultingSnapshot, and afterRun. The current prediction shows afterRun; its gradient action refers back to the actual trainingRun.

**Tests worth reading:** start with the fixed-input update and snapshot tests above, then follow the worker/browser checks listed by [package.json](package.json) as integration evolves.

## Numerical acceptance

JavaScript `number` and Python `float` use binary64 in the validated environments. TypeScript-to-Python fixture checks require:

```text
abs(actual - expected) <= 1e-10 + 1e-9 * abs(expected)
```

No canonical numbers are rounded for display. This tolerance allows last-bit differences in ordered reductions and transcendental functions; it is not permission to fabricate unavailable values. Finite-difference gradient checks have their own documented tolerances. Python fixture regeneration separately checks exact serialized bytes in the validated environment.

From the Model Lab directory, `npm run test:reference` runs portable offline oracle and numeric conformance checks; `npm run test:reference:canonical` separately checks byte-exact regeneration in the qualified environment. `npm test` runs the configured TypeScript suites. [package.json](package.json) lists build and browser acceptance commands. `npm test` and `npm run typecheck` have hooks that write runtime identity; build invokes typecheck. For documentation-only checks use the read-only procedure in [AGENTS.md](AGENTS.md#validation-and-review). Those commands exercise implementation evidence; this guide itself is not an acceptance log.

## 8. Use the microscope without hiding the model

Read [inspect/capture.ts](inspect/capture.ts) after the math. `CaptureContext` maintains private root identities and snapshots scalar nodes and operand-occurrence edges. `trainStep` invokes `captureBackward` between `backward` and `adamStep`. The callback copies child adjoints, local derivatives, contributions, and parameter gradients before mutation. A repeated operand is two edges. The numerical model still executes directly when no observer is present.

Read [archive/snapshot.ts](archive/snapshot.ts) for canonical binary64 identity, [archive/experiment.ts](archive/experiment.ts) for exact transition validation, and [app/worker/inspector.ts](app/worker/inspector.ts) for disposable historical reconstruction. Historical verification compares every available semantic anchor and requires recorded gradients for backward explanations. Source panels bundle these actual source files with SHA-256 identities and curated symbols, so no network or fixed line numbers are needed.
