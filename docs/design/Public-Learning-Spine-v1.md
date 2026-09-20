# Public Learning Spine v1

## 1. Scope, authority, and boundaries

### Purpose

This document is the durable public-learning and presentation contract for Model Lab's first Guided curriculum. It freezes what the public experience must teach, what truth distinctions it must preserve, what may be grouped, and how Guided relates to deeper inspection and research.

It does not define application source, controller ownership, PublicTourState, CSS, animation timings, final hardware tuning, or a required click count. OC1, LS1, LS2, and LS3 must implement this contract without treating the current state machine as the curriculum ontology.

LS0 found no source-truth contradiction requiring alteration of the accepted 17-beat instructional decomposition.

The governing principle is:

> **COMPRESS EXPLANATION, NOT COMPUTATION.**

And, equally:

> **NOT EVERY NATIVE OPERATION REQUIRES ITS OWN CLICK OR SOURCE IDENTIFIER IN GUIDED.**

The required distinction is:

    instructional beat
    != UI screen
    != PublicTourState
    != required button press
    != runtime phase

Implementation should use the minimum learner-controlled boundaries that preserve comprehension, readability, and causal continuity.

### Authority and relation to source

This contract is grounded in the live canonical implementation and evidence contracts at branch pre-m5-abq-experience, commit ef9222304c67ed1a28dca5c2b2f107b564485878.

Current source and appropriately scoped evidence remain authoritative for implemented behavior and numerical truth. This document governs the intended public teaching architecture. If future source intentionally changes the organism or evidence contract, this document must be revised rather than silently teaching stale behavior.

Primary source anchors for this contract are:

- model/microgpt.ts
- model/autograd.ts
- model/training.ts
- model/observation.ts
- trace/types.ts
- app/spatial/microgpt-topology.ts
- app/spatial/forward.ts
- app/spatial/learning.ts
- app/presentation/backward-read-model.ts
- app/presentation/adam-read-model.ts
- docs/evidence-and-operations.md
- READ_THE_CODE.md
- fixtures/canonical.initial.json

M5 and M6 remain NOT_RUN. This document grants no later-stage acceptance.

### Three boundaries

| Boundary | Frozen meaning | Examples |
| --- | --- | --- |
| Universal learning/product principles | Model-independent requirements for truthful learning over real computation | authentic evidence; progressive disclosure; stable spatial identity; learner-controlled segmentation; explanation timing distinct from execution timing; required mechanism before optional arithmetic; no fake computation; no magic gaps |
| Canonical MicroGPT curriculum | The first deeply inspectable teaching organism and its exact architecture/training witness | character input; one layer; embedding width 8; two attention heads; context 8; both RMSNorm locations; Q/K/V; causal attention; ReLU MLP 8 -> 32 -> 8; exact residual topology; logits; output softmax; cross-entropy objective; reverse-mode accumulation; Adam |
| ABQ deployment/presentation profile | Event-specific presentation and hardware requirements | Visitor kiosk; Facilitator profile; MacBook Neo stations; 1080p TV; attract/reset behavior; measured typography, viewport, timing, and display tuning |

MicroGPT is not the platform boundary. ABQ is not the platform boundary. A deployment/profile constraint must not become a universal Model Lab invariant merely because the first public lesson needs it.

### Canonical MicroGPT facts for this curriculum

The canonical teaching organism is the current committed fixture: character vocabulary a/b/c plus BOS, one transformer layer, embedding width 8, two attention heads, context 8, no biases, ReLU, RMSNorm at embeddingNorm, preAttentionNorm, and preMlpNorm, and no final normalization before the vocabulary projection.

The forward residual topology is:

    token/position representation
    -> embedding RMSNorm
       | saved attention residual
    -> pre-attention RMSNorm
    -> Q/K/V attention
    -> head concat
    -> output projection
    + saved attention residual
    -> pre-MLP RMSNorm
       | saved MLP residual
    -> 8 -> 32 -> ReLU -> 8
    + saved MLP residual
    -> logits
    -> probabilities

These are canonical MicroGPT-specific facts, not claims about all Transformers.

---

## 2. Learning outcomes

After Guided, an unfamiliar learner should be able to explain, in causally coherent terms:

- why a character and its position must become numerical features before the model can calculate;
- how Q, K, and V have different operational roles without treating them as literal human-language questions, labels, or meanings;
- how a Query is compared only with causally available Keys to produce scores;
- why a score is not yet a mixing weight;
- how softmax turns attention scores into normalized mixing coefficients;
- what those weights multiply: Value vectors;
- how weighted Values become a head output;
- how two head outputs are concatenated, projected, and added to a saved residual;
- what the MLP operationally does, including normalization, expansion, ReLU, contraction, and residual add;
- why logits are raw vocabulary scores rather than probabilities;
- how output softmax produces the prediction distribution;
- that the same model uses all teacher-forced target positions to construct the training objective;
- that backward explanation follows dependency/sensitivity through the same computation rather than replaying runtime in reverse;
- how one gradient contribution is produced and added to an accumulator;
- why one contribution is not the final parameter gradient;
- why a final gradient is not an optimizer update;
- how Adam combines that gradient with persistent optimizer state to create a provisional proposal;
- why a candidate is not yet the accepted model;
- what changed on this one training example and what cannot be concluded generally.

Learners do not need to memorize source identifiers such as preAttentionNorm, attentionProjection, or mlpDown. They do need to understand the mechanisms those operations implement. Exact operation identity remains available in deeper inspection.

A Guided statement such as "the representation is rescaled before attention" may truthfully cover preAttentionNorm without forcing source-name memorization.

---

## 3. Chapter model

The opening phenomenon is deliberately experienced before its mechanism is explained.

    OPENING PHENOMENON
    Encounter the prediction

    PART 1 · MAKE A PREDICTION

    REPRESENT
    -> ATTEND
    -> TRANSFORM
    -> OUTPUT

    PART 2 · LEARN FROM ERROR

    MEASURE
    -> TRACE
    -> ACCUMULATE
    -> PROPOSE
    -> DECIDE

Detailed mapping:

| Beat | Required concept | Chapter mechanism |
| ---: | --- | --- |
| 1 | Encounter the prediction | Opening phenomenon |
| 2 | Representation | Part 1 · REPRESENT |
| 3 | Construct Q / K / V | Part 1 · ATTEND |
| 4 | Compare available positions | Part 1 · ATTEND |
| 5 | Convert scores into attention weights | Part 1 · ATTEND |
| 6 | Mix the Values | Part 1 · ATTEND |
| 7 | Combine heads, project, preserve residual | Part 1 · ATTEND |
| 8 | Transform through the MLP | Part 1 · TRANSFORM |
| 9 | Produce vocabulary logits | Part 1 · OUTPUT |
| 10 | Convert logits to probabilities and reconnect to prediction | Part 1 · OUTPUT |
| 11 | Integrate the complete forward path | Part 1 · whole-path integration |
| 12 | Define the training objective / loss | Part 2 · MEASURE |
| 13 | Trace backward sensitivity | Part 2 · TRACE |
| 14 | Inspect one real gradient contribution | Part 2 · TRACE |
| 15 | Complete accumulated parameter gradient | Part 2 · ACCUMULATE |
| 16 | Adam proposes a provisional candidate | Part 2 · PROPOSE |
| 17 | Rerun, compare, Accept or Discard | Part 2 · DECIDE |

The conceptual group is the visitor's primary orientation. A later implementation may use local progress such as "Part 1 · Attend · 3 of 5", but a long global state counter must not become the dominant mental model.

The word **Accumulate** is required because the lesson must teach:

    one gradient contribution
    != final parameter gradient

---

## 4. Required instructional beats

### Evidence vocabulary used below

The current trace contract persists numeric provenance as:

- **OBSERVED**: persisted provenance "observed"; captured during the run.
- **DERIVED**: persisted provenance "derived"; calculated from existing evidence.
- **RECOMPUTED**: persisted provenance "recomputed"; produced by separate reexecution.

The current persisted availability states are:

- **AVAILABLE**
- **NOT_CAPTURED**
- **NOT_APPLICABLE**
- **UNSUPPORTED**
- **BUDGET_EXCEEDED**

Two additional teaching classifications are necessary but are not new trace Provenance values:

- **STRUCTURAL**: topology, dependency, lookup, slicing, causal-selection, concatenation, target, or other explicit structural observation. Structural evidence must not be presented as a numerical observation.
- **INTERPRETED**: pedagogical explanation, analogy, wording, or mental model. Interpretation is not evidence provenance.

**PENDING** is an execution/controller condition before evidence is available, not a persisted Artifact availability value. Pending must never be converted into a numerical zero.

For every beat, the default Guided surface must preserve source truth, numerical evidence, derived calculation, structural relation, and pedagogical interpretation as distinct things.

### Beat 1. Encounter the prediction

**Identity:** Opening phenomenon · before Part 1 chapter mechanics.

**Learner question:** What is this tiny model doing?

**Why here:** A real outcome gives the rest of the lesson a phenomenon to explain before terminology accumulates.

**Required terminology:** prediction; next token/character; probability distribution.

**Learning outcome:** The learner recognizes that the model maps the current prefix to a distribution over possible next characters.

**Object transformation:**

    input prefix
    -> authentic current-model forward computation
    -> next-token probability distribution and visible prediction

**Computation coverage:** The selected output occurrence at probabilities. The graph may orient the visitor to major model regions, but this beat does not teach the softmax mechanism yet.

**Required evidence before claim:** An AVAILABLE probability artifact from the authentic run/state being shown. If the opening surface is replay, it must say replay. Starting a fresh lesson must not silently treat replay as new execution.

**Minimum Guided evidence:** The authentic predicted distribution or selected top token plus enough probability evidence to establish that the result came from the current run. Default result origin is OBSERVED. Graph location is STRUCTURAL. Introductory prose is INTERPRETED.

**Availability behavior:** If probabilities are pending, show truthful working status while retaining the previous authentic world when available. If unavailable, do not invent a prediction.

**Misconception guardrail:** Seeing the prediction first does not mean probability/softmax has already been taught, and a high probability is not proof of understanding.

**Progressive depth:** Guided shows the phenomenon. Details may show the full distribution. Math may expose output-softmax arithmetic after the learner chooses depth. Microscope may bind the selected output scalar. Source/Provenance exposes run, checkpoint, operation, artifact provenance, and availability.

**Signaling:** teaching focus at the output; authentic execution frontier only where execution actually is; completion/readiness when the authentic result exists. No backward channel.

**Interaction boundary:** Required obvious Start boundary, then a likely learner-controlled "trace how it got there" boundary. Instructional focus returns to the input side without implying runtime execution reversed.

---

### Beat 2. Representation

**Identity:** Part 1 · REPRESENT.

**Learner question:** How can the model calculate with a character and its position?

**Why here:** The model cannot perform the later vector operations directly on the character symbol. It needs learned numerical features for token identity and position, then a numerically conditioned representation.

**Required terminology:** token; position; embedding/representation; normalization only as rescaling at Guided depth.

**Learning outcome:** The learner can explain token numbers + position numbers -> working representation, and that the representation is normalized before attention.

**Object transformation:**

    token identity + position
    -> tokenEmbedding + positionEmbedding
    -> embeddingSum
    -> embeddingNorm
    -> preAttentionNorm
    -> attention-ready representation

**Computation coverage:** tokenEmbedding, positionEmbedding, embeddingSum, embeddingNorm, preAttentionNorm. The saved residual branches from the normalized representation before preAttentionNorm and must be visibly established because it will rejoin after attention.

**Required visible internals:** two lookup vectors, their addition, both normalization roles, and the beginning of the attention residual/bypass. Exact RMS arithmetic is optional depth.

**Graph focus:** selected token/position through representation into preAttentionNorm, with the saved residual branch visible.

**Required evidence before claim:** AVAILABLE captured vectors for the selected occurrence where numerical values are shown. Lookup and dependency relationships may be STRUCTURAL. If one vector was not captured, Guided may still show the structural mechanism but must not show fabricated values or claim the missing numerical result.

**Minimum Guided evidence:** authentic token/position representations and authentic working representation for one occurrence, plus visible before-attention rescaling and residual branch. Default numerical origin is OBSERVED; topology/lookup is STRUCTURAL.

**Availability behavior:** If any required numerical representation is unavailable, keep the truthful structural path and label the exact availability; do not substitute zeros or inferred vectors. Pending execution may show working state but cannot claim the missing result.

**Misconception guardrail:** Embedding numbers are learned features used by this model, not human-readable meanings, and normalization does not create a new token.

**Progressive depth:** Details shows full vectors/shapes. Math shows RMSNorm formula with authentic values. Microscope shows selected scalar ancestry. Source/Provenance exposes wte/wpe lookup identity and both normalization operations.

**Signaling:** teaching focus on the active representation span; execution frontier independently where real execution is active; completion when the selected authentic representation evidence exists.

**Interaction boundary:** Likely learner-controlled boundary. Do not split each lookup/norm into separate mandatory clicks.

---

### Beat 3. Construct Q / K / V

**Identity:** Part 1 · ATTEND.

**Learner question:** Why create three different vectors from the same representation?

**Why here:** Attention needs separate numerical roles for comparing the current position with available positions and for carrying information that may be mixed.

**Required terminology:** Query, Key, Value; Q/K/V.

**Learning outcome:** The learner can state the operational roles without anthropomorphizing them.

**Object transformation:**

    attention-ready representation
    -> three learned linear projections
    -> Query, Key, and Value vectors

**Computation coverage:** q, k, v and their parameter projections. Head slicing may be introduced structurally as needed for the selected head.

**Required visible internals:** three branches from the same normalized input. Guided role language must remain: Query numbers are used on one side of a comparison; Key numbers on the other; Value numbers carry information that may be mixed.

**Graph focus:** preAttentionNorm -> q/k/v, retaining the connection back to the same representation.

**Required evidence before claim:** AVAILABLE q/k/v vectors for the selected occurrence if numerical examples are shown. Parameter lookup and head-slice relationships are STRUCTURAL. Arithmetic reconstruction of a linear projection is DERIVED unless it was captured as scalar execution.

**Minimum Guided evidence:** authentic q/k/v outputs for one selected occurrence or a truthful values-available indicator, with all three graph branches visibly exposed. Default numeric origin is OBSERVED.

**Availability behavior:** If any Q/K/V output is unavailable, show the three-branch structural mechanism and mark the missing branch honestly; do not claim a complete numerical Q/K/V example or synthesize the missing vector.

**Misconception guardrail:** Q/K/V are not literal questions, labels, semantic categories, or stored human meanings. A mnemonic may be used only when explicitly framed as intuition.

**Progressive depth:** Details shows full vectors and projection shapes. Math shows one authentic linear projection. Microscope shows scalar products/sums for a selected output. Source/Provenance exposes q/k/v operation and matrix identities.

**Signaling:** teaching focus spans Q/K/V together; execution frontier remains independent; readiness when the selected three outputs are available.

**Interaction boundary:** Likely learner-controlled conceptual boundary. Q, K, and V are one grouped mechanism, not three mandatory steps.

---

### Beat 4. Compare available positions

**Identity:** Part 1 · ATTEND.

**Learner question:** Which earlier/current positions can this position compare against, and what does the comparison produce?

**Why here:** The model needs a numerical compatibility score for each causally available key before it can decide how to mix Values.

**Required terminology:** attention score; causal availability; scaled dot product.

**Learning outcome:** The learner can explain that a selected Query is compared with allowed Keys to produce scores, and that future positions are absent rather than assigned zero importance.

**Object transformation:**

    selected Query + causally available Keys
    -> dot products / sqrt(head width)
    -> attention scores

**Computation coverage:** head slice, causal selection, attentionLogits.

**Required visible internals:** selected Query, all allowed Key positions for the chosen row, causal boundary, and the resulting score row. A grouped visual may summarize dot-product arithmetic, but it may not jump directly from q/k nodes to weights.

**Graph focus:** q and allowed k occurrences -> attentionLogits for one head/query position.

**Required evidence before claim:** AVAILABLE observed attentionLogits for the chosen row. Q/K values may be OBSERVED. Head slicing and causal selection are STRUCTURAL. Explicit multiplication/sum/scale arithmetic may be DERIVED from captured Q/K and the observed score.

**Minimum Guided evidence:** the allowed-position set and authentic score row. Default result origin is OBSERVED plus STRUCTURAL causal availability.

**Availability behavior:** a future position is NOT_APPLICABLE for this causal computation, not an AVAILABLE zero score.

**Misconception guardrail:** score != weight. Future positions are unavailable, not considered and given zero importance.

**Progressive depth:** Details shows Q and allowed K operands. Math shows populated scaled-dot-product arithmetic. Microscope shows scalar ancestry if available. Source/Provenance exposes the selected run/head/query/key coordinates.

**Signaling:** teaching focus on comparison span; execution frontier independent; no backward channel.

**Interaction boundary:** Likely learner-controlled boundary. May only group with adjacent attention beats if score production remains visibly distinct.

---

### Beat 5. Convert scores into attention weights

**Identity:** Part 1 · ATTEND.

**Learner question:** How do raw comparison scores become usable mixing coefficients?

**Why here:** The Value mixture needs normalized coefficients over the allowed contributors.

**Required terminology:** softmax; attention weight; normalized mixing coefficient.

**Learning outcome:** The learner can distinguish raw scores from normalized weights.

**Object transformation:**

    attention scores
    -> softmax over allowed key positions
    -> normalized attention weights

**Computation coverage:** attentionLogits -> attentionProbabilities, including stable-softmax maximum as deeper structural/math evidence.

**Required visible internals:** score row and resulting weight row over the same causal support.

**Graph focus:** attentionLogits -> attentionProbabilities.

**Required evidence before claim:** AVAILABLE observed score and probability/weight vectors. Stable-softmax maximum is STRUCTURAL unless numerical detail is exposed. Reconstructed exponentials/denominator are DERIVED unless captured by scalar inspection.

**Minimum Guided evidence:** authentic score-to-weight transformation and normalized distribution over allowed positions. Default result origin is OBSERVED.

**Availability behavior:** If the score or weight vector is unavailable, retain the structural score-to-softmax relationship and label the missing evidence. Do not manufacture weights from incomplete support; any valid reconstruction from complete captured inputs remains DERIVED.

**Misconception guardrail:** an attention weight is a mixing coefficient. It is not automatically importance, explanation, causal attribution, or proof of what the model "cared about."

**Progressive depth:** Details shows complete score/weight vectors. Math shows authentic softmax inputs, maximum shift, exponentials, denominator. Microscope shows selected scalar ancestry. Source/Provenance exposes operation/run/head/query identity.

**Signaling:** teaching focus on score -> weights; execution frontier independent.

**Interaction boundary:** Likely learner-controlled boundary. May be grouped only if the score/weight distinction remains explicit.

---

### Beat 6. Mix the Values

**Identity:** Part 1 · ATTEND.

**Learner question:** What do the attention weights actually do?

**Why here:** Weights become useful only when they multiply the corresponding Value vectors and those contributions are summed.

**Required terminology:** Value vector; weighted sum; head output.

**Learning outcome:** The learner can explain weights x Values -> weighted Value sum -> head output.

**Object transformation:**

    attention weights + causally available Value vectors
    -> weighted Value contributions
    -> weighted sum
    -> head output

**Computation coverage:** attentionProbabilities, v, headOutput.

**Required visible internals:** the same weight row, the corresponding Value contributors, and the resulting head vector. The mechanism must not be represented only by an endpoint highlight.

**Graph focus:** attentionProbabilities + relevant v occurrences -> headOutput for one head.

**Required evidence before claim:** AVAILABLE observed weights, Value vectors, and headOutput. Contributor scope is STRUCTURAL. A reconstructed affine mixture is DERIVED and may be verified against the observed head output.

**Minimum Guided evidence:** authentic weights, visible Value contributors, and authentic head output. Default result origin is OBSERVED; multiplication/mixture explanation may be DERIVED.

**Availability behavior:** If weights, Value contributors, or head output are unavailable, mark the missing evidence and keep only the structural mixture relation. A DERIVED mixture requires the complete authentic contributor set for the selected support.

**Misconception guardrail:** weights do not directly mix Keys or logits here. They mix Values. A large weight does not, by itself, establish global causal importance.

**Progressive depth:** Details shows all Value vectors and weights. Math shows weighted terms and sum. Microscope shows scalar contribution ancestry. Source/Provenance binds head, positions, run, and artifact origins.

**Signaling:** teaching focus on weights and Value contributors; execution frontier independent.

**Interaction boundary:** Likely learner-controlled boundary. This mechanism must never disappear behind generic "attention combines context" prose.

---

### Beat 7. Combine heads, project, and preserve the residual

**Identity:** Part 1 · ATTEND.

**Learner question:** How do the separate head results return to one model representation without losing the earlier stream?

**Why here:** Multiple heads occupy channel slices that must be joined, projected back into the embedding basis, and combined with the saved residual.

**Required terminology:** head; concatenate; projection; residual/bypass.

**Learning outcome:** The learner can distinguish concatenation from addition and explain the preserved residual path.

**Object transformation:**

    head outputs
    -> concatenate channels
    -> attentionOutput
    -> output projection
    -> attentionProjection
    + saved pre-attention residual
    -> attentionResidual

**Computation coverage:** headOutput from both canonical heads, attentionOutput, attentionProjection, attentionResidual, and the residual branch established in Beat 2.

**Required visible internals:** both head outputs, concatenation, projection, saved bypass, and addition. No endpoint-only shortcut.

**Graph focus:** both headOutput nodes -> attentionOutput -> attentionProjection plus saved residual -> attentionResidual.

**Required evidence before claim:** AVAILABLE observed head outputs, concatenated output, projected output, and residual result where numerical values are shown. Concatenation and saved-residual dependency are STRUCTURAL. Projection/add arithmetic may be DERIVED in deeper views.

**Minimum Guided evidence:** visually distinct join versus residual add, authentic projected/result vectors, and visible bypass identity. Default numeric origin is OBSERVED.

**Availability behavior:** If an internal grouped result is unavailable, keep concatenation, projection, bypass, and add structurally distinct and label the unavailable numerical stage. Do not infer an unseen intermediate from the endpoint or vice versa.

**Misconception guardrail:** concatenation is not addition. The residual path preserves a prior representation and is not a second attention head.

**Progressive depth:** Details shows full head/projection/residual vectors. Math shows projection and selected residual sum. Microscope shows selected scalar ancestry across both branches. Source/Provenance exposes attentionOutput, attentionProjection, attentionResidual and parameter identity.

**Signaling:** teaching focus spans join/project/residual; execution frontier independent.

**Interaction boundary:** One grouped mechanism is preferred. Split only if testing shows persistent confusion, not for implementation convenience.

---

### Beat 8. Transform through the MLP

**Identity:** Part 1 · TRANSFORM.

**Learner question:** What happens after attention has mixed context?

**Why here:** The model applies a separate per-position nonlinear transformation before output scoring.

**Required terminology:** MLP/feed-forward; expand; ReLU; contract; residual.

**Learning outcome:** The learner can describe the complete transform and identify the nonlinearity.

**Object transformation:**

    attentionResidual
    -> preMlpNorm
    -> 8 -> 32 linear expansion
    -> ReLU
    -> 32 -> 8 linear contraction
    + saved attentionResidual
    -> mlpResidual

**Computation coverage:** preMlpNorm, mlpUp, mlpRelu, mlpDown, mlpResidual and the saved MLP residual.

**Required visible internals:** normalization, 8 -> 32 expansion, ReLU gate, 32 -> 8 contraction, residual add. Guided may group these into one beat only if every stage is visibly exposed.

**Graph focus:** attentionResidual -> preMlpNorm -> mlpUp -> mlpRelu -> mlpDown plus saved residual -> mlpResidual.

**Required evidence before claim:** AVAILABLE observed stage vectors for the selected occurrence if numerical results are shown. Dependency/residual topology is STRUCTURAL. Exact normalization/linear/ReLU arithmetic may be DERIVED or scalar-observed in deeper inspection.

**Minimum Guided evidence:** authentic before/after vectors with all required stage transitions visible. Default numerical origin is OBSERVED.

**Availability behavior:** If any MLP stage is unavailable numerically, keep the full stage topology visible and mark that stage unavailable. Do not interpolate or fabricate hidden activation/projection values to preserve the animation.

**Misconception guardrail:** this organism uses ReLU, not GELU; it has no final normalization after the block; the MLP is not another attention operation.

**Progressive depth:** Details shows full stage vectors/shapes. Math shows selected normalization, projection, ReLU, and contraction arithmetic. Microscope shows scalar ancestry. Source/Provenance exposes exact operation and matrix identities.

**Signaling:** teaching focus spans the whole MLP mechanism; execution frontier independent.

**Interaction boundary:** Current accepted hypothesis is one learner-controlled beat. Predefined fallback after human evidence is:

    Expand + ReLU
    -> Contract + Residual

Do not split during LS0/implementation merely to simplify code.

---

### Beat 9. Produce vocabulary logits

**Identity:** Part 1 · OUTPUT.

**Learner question:** How does the final representation become scores for possible next characters?

**Why here:** The model needs one raw score for every output vocabulary entry before normalization.

**Required terminology:** logit; vocabulary score.

**Learning outcome:** The learner can identify logits as raw, unnormalized scores and accept negative logits as valid.

**Object transformation:**

    mlpResidual
    -> lm_head linear projection
    -> vocabulary logits

**Computation coverage:** logits and lm_head parameter lookup.

**Required visible internals:** final representation entering the vocabulary projection and the resulting score vector.

**Graph focus:** mlpResidual -> logits.

**Required evidence before claim:** AVAILABLE observed logit vector. Parameter lookup is STRUCTURAL. Exact projection arithmetic may be DERIVED in Math or scalar-inspected.

**Minimum Guided evidence:** authentic raw score vector for the selected position. Default result origin is OBSERVED.

**Availability behavior:** If logits are unavailable, show only the structural vocabulary-projection relationship and its availability. Do not infer raw scores from displayed probabilities.

**Misconception guardrail:** a logit is not a probability. Negative logits are valid. The largest logit is only largest before softmax, not a percentage.

**Progressive depth:** Details shows all vocabulary logits. Math shows selected projection arithmetic. Microscope shows scalar ancestry. Source/Provenance exposes lm_head and selected coordinate.

**Signaling:** teaching focus on scoring; execution frontier independent.

**Interaction boundary:** Likely learner-controlled boundary because logit/probability distinction is a core misconception boundary.

---

### Beat 10. Convert logits to probabilities and reconnect to the opening prediction

**Identity:** Part 1 · OUTPUT.

**Learner question:** How do raw vocabulary scores become the prediction seen at the start?

**Why here:** The model needs a normalized distribution over vocabulary candidates.

**Required terminology:** output softmax; probability distribution.

**Learning outcome:** The learner can explain logits -> output softmax -> probabilities and reconnect the mechanism to the opening authentic prediction.

**Object transformation:**

    vocabulary logits
    -> output softmax
    -> vocabulary probabilities
    -> opening prediction result

**Computation coverage:** logits -> probabilities. Output softmax and attention softmax must be described as the same mathematical family applied to different objects for different purposes.

**Required visible internals:** the selected logit vector, resulting probability vector, and the same prediction identity first encountered when semantically possible.

**Graph focus:** logits -> probabilities.

**Required evidence before claim:** AVAILABLE observed logits and probabilities from the bound run. Stable-softmax structure is STRUCTURAL. Exponentials/denominator may be DERIVED.

**Minimum Guided evidence:** authentic normalized distribution and visible reconnection to the opening result. Default result origin is OBSERVED.

**Availability behavior:** If probabilities are unavailable, do not claim the opening prediction has been reproduced for that run. Keep the logits-to-softmax mechanism structural until authentic or validly derived detail is available; pending remains pending.

**Misconception guardrail:** output softmax normalizes vocabulary scores; attention softmax normalizes causal comparison scores. Probability is not a universal confidence guarantee.

**Progressive depth:** Details shows complete distribution and support. Math shows populated softmax arithmetic. Microscope shows selected scalar ancestry. Source/Provenance exposes run/position/operation identity.

**Signaling:** teaching focus at output; execution frontier independent; completion/readiness for Part 1 when the authentic output exists.

**Interaction boundary:** Likely learner-controlled boundary.

---

### Beat 11. Integrate the complete forward path and transition to learning

**Identity:** Part 1 · whole-path integration.

**Learner question:** What reusable mental model explains the complete prediction path?

**Why here:** Local mechanisms need to be compressed into a stable whole-model model before adding learning.

**Required terminology:** REPRESENT, ATTEND, TRANSFORM, OUTPUT.

**Learning outcome:** The learner can narrate the forward path at mechanism level and knows that prediction used parameters but did not update them.

**Object transformation:**

    token + position
    -> REPRESENT
    -> ATTEND
    -> TRANSFORM
    -> OUTPUT
    -> prediction distribution

**Computation coverage:** all forward operations already taught. This beat introduces no new numerical computation.

**Required visible internals:** connected whole-path span and residual topology, not a disconnected completion card.

**Graph focus:** whole forward route with chapter groups legible.

**Required evidence before claim:** the route must remain bound to the same model/run/evidence world. Integration may use OBSERVED artifacts already shown plus STRUCTURAL topology. It must not trigger fake execution merely to animate completion.

**Minimum Guided evidence:** the complete connected route and explicit message:

    Part 1 of 2 complete.
    Learning still ahead.
    Prediction used parameters; it did not update them.

**Availability behavior:** Forward integration may summarize only mechanisms/evidence already established for the bound identity. Missing evidence remains visibly unavailable; do not trigger or imply fresh execution solely to make the integration view look complete.

**Misconception guardrail:** completing the prediction explanation is not completing the lesson, and no training update has occurred merely because probabilities were produced.

**Progressive depth:** Details reopens any mechanism while preserving identity. Math/Microscope/Source deepen the selected mechanism, not the completion banner.

**Signaling:** teaching focus may summarize the whole route; execution frontier remains wherever authentic execution actually is; completion channel marks Part 1 readiness only.

**Interaction boundary:** Required learner-controlled transition into Part 2.

---

### Beat 12. Define the training objective / loss

**Identity:** Part 2 · MEASURE.

**Learner question:** How does the model know what error to learn from?

**Why here:** Backward needs a scalar objective tied to known targets.

**Required terminology:** target; loss; cross-entropy/negative log probability at optional terminology depth; mean training loss/objective.

**Learning outcome:** The learner can explain that the canonical training example uses known targets across all teacher-forced positions, not just the single previewed output.

**Object transformation:**

    predicted probabilities at every training position + known target at each position
    -> per-position target negative-log loss
    -> mean training objective

**Computation coverage:** structural target selection, loss artifacts, meanLoss, and the actual objective reduction scope.

**Required visible internals:** multiple positions/targets and their contribution to the mean objective. The previewed public next-token position may be highlighted but must not masquerade as the whole objective.

**Graph focus:** output probabilities/targets -> objective root.

**Required evidence before claim:** Prefer AVAILABLE OBSERVED loss and meanLoss from the training run. If loss must be reconstructed from AVAILABLE observed target probabilities, it is DERIVED and must stay labeled DERIVED. Target binding is STRUCTURAL.

**Minimum Guided evidence:** authentic target relationship and authentic/derived-labeled mean objective covering the real positions. Default Guided origin is OBSERVED when captured; DERIVED fallback is allowed only with explicit origin.

**Availability behavior:** If OBSERVED loss is absent but the complete required target probabilities are AVAILABLE, a loss/mean may be shown as DERIVED. If neither source is sufficient, the objective result is unavailable; pending or missing values never become zero.

**Misconception guardrail:** the objective is not just "was the top prediction correct?" and is not restricted to the one opening preview position.

**Progressive depth:** Details shows per-position target probabilities/losses. Math shows -log(p_target) and mean reduction with authentic values. Microscope shows objective ancestry. Source/Provenance exposes training run, targets, loss/meanLoss origin and availability.

**Signaling:** teaching focus at objective; authentic execution frontier may be in training forward/loss and remains a separate channel; backward relation begins only after objective exists.

**Interaction boundary:** Likely learner-controlled boundary before backward tracing.

---

### Beat 13. Trace backward sensitivity through the same computation

**Identity:** Part 2 · TRACE.

**Learner question:** How can changing an earlier value or parameter affect the loss?

**Why here:** Before showing a scalar contribution, the learner needs the causal/dependency idea of reverse-mode sensitivity over the same computation.

**Required terminology:** sensitivity; backward; dependency. "Adjoint" may appear in Details/Math rather than being mandatory Guided vocabulary.

**Learning outcome:** The learner can follow:

    loss
    <- output probabilities
    <- logits
    <- MLP
    <- attention
    <- representation
    <- parameter uses

and understands this as dependency/sensitivity explanation rather than runtime replay timing.

**Object transformation:**

    loss sensitivity at the objective
    -> reverse dependency propagation through the existing computation
    -> sensitivities arriving at earlier values and parameter uses

**Computation coverage:** actual reverse-mode dependency traversal over the canonical computation.

**Required visible internals:** reverse relationship through the same forward-world objects. No detached second "backward world."

**Graph focus:** objective root back through the same output/MLP/attention/representation topology toward parameter uses.

**Required evidence before claim:** An OBSERVED backward/scalar graph may be used directly. A RECOMPUTED inspection may be used only when its verification contract succeeds against the recorded training run/gradient anchors. STRUCTURAL dependency topology may orient the route but must not be presented as a captured numerical derivative.

**Minimum Guided evidence:** the authentic/verified dependency route and a truthful current backward relation. Numeric adjoints are optional at this beat.

**Availability behavior:** If neither an OBSERVED backward graph nor a VERIFIED RECOMPUTED graph is available, Guided may show only the STRUCTURAL dependency route and must label numerical sensitivities unavailable. Do not infer adjoints from topology alone.

**Misconception guardrail:** backward visual direction is not runtime execution reversing in time. Explanation playback, runtime execution, and measured timing are distinct.

**Progressive depth:** Details may show selected adjoints and path identity. Math introduces chain-rule notation. Microscope shows exact scalar ancestry and edge values. Source/Provenance exposes graph origin OBSERVED or RECOMPUTED and verification status.

**Signaling:** purple backward/dependency channel is primary; gold teaching focus remains independent; cyan execution frontier appears only where the runtime is actually working.

**Interaction boundary:** Likely learner-controlled conceptual boundary. Do not merge away the distinction between route-level sensitivity and a specific gradient contribution.

---

### Beat 14. Inspect one real gradient contribution

**Identity:** Part 2 · TRACE.

**Learner question:** What does one backward occurrence contribute to one parameter's gradient?

**Why here:** A concrete scalar contribution makes reverse-mode accumulation mechanistic without turning the lesson into a calculus course.

**Required terminology:** incoming sensitivity; local derivative; contribution; accumulator.

**Learning outcome:** The learner can explain:

    incoming sensitivity x local derivative
    -> one gradient contribution

then:

    accumulator before + contribution
    -> accumulator after

**Object transformation:**

    child adjoint/incoming sensitivity + local derivative + accumulator before
    -> contribution
    -> accumulator after

**Computation coverage:** one actual GradientWrite/scalar edge for a pinned parameter occurrence and the accumulator transition.

**Required visible internals:** matching child sensitivity, local derivative, contribution, before, after, and the selected parameter identity.

**Graph focus:** one real backward edge into the pinned parameter/leaf while retaining its connection to the larger dependency path.

**Required evidence before claim:** scalar contribution fields must come from OBSERVED retained backward evidence or a VERIFIED RECOMPUTED graph bound to the same training run and parameter. A structural edge alone is insufficient for a numeric contribution claim.

**Minimum Guided evidence:** one authentic contribution and before/after accumulator values when available. Default origin is OBSERVED when retained; VERIFIED RECOMPUTED is permitted with explicit label.

**Availability behavior:** if fan-in/contribution evidence is unavailable, say why and do not manufacture a representative number.

**Misconception guardrail:** one contribution is not the final parameter gradient, and the local derivative is not the optimizer update.

**Progressive depth:** Details shows parameter/edge identities and nearby contributions. Math shows the one multiplication/addition. Microscope shows exact scalar ancestry and repeated-operand edges. Source/Provenance exposes run, parameter index, graph origin, verification, and availability.

**Signaling:** gold focus on the selected contribution; purple relationship on its backward edge; cyan execution frontier remains independent; completion only marks that this contribution is authentic, not that backward is complete.

**Interaction boundary:** Likely learner-controlled boundary before completing accumulation.

---

### Beat 15. Complete the accumulated parameter gradient

**Identity:** Part 2 · ACCUMULATE.

**Learner question:** When do all of those contributions become the gradient Adam will receive?

**Why here:** Shared parameters can participate through multiple occurrences and paths. The optimizer requires the completed accumulated gradient, not one illustrative contribution.

**Required terminology:** accumulated gradient; final gradient.

**Learning outcome:** The learner can state:

    one contribution
    != final gradient

and explain that the final gradient is the completed loss sensitivity for this parameter under the current objective.

**Object transformation:**

    all contributions to the selected parameter
    -> accumulation across occurrences/paths
    -> final parameter gradient

**Computation coverage:** complete parameter fan-in/accumulation plus the recorded gradient anchor used by the optimizer.

**Required visible internals:** transition from one highlighted contribution to "all contributing paths/occurrences" and then the final gradient. The graph need not display every scalar simultaneously, but completeness must be truthful.

**Graph focus:** selected parameter with contributor fan-in and final gradient identity.

**Required evidence before claim:** the canonical learning experiment records an OBSERVED gradient artifact matching the Adam update gradient. If complete scalar fan-in is available, its sum may be shown and checked against the gradient. If fan-in is incomplete, show the OBSERVED final gradient without pretending the visible subset is complete.

**Minimum Guided evidence:** final authentic gradient plus explicit distinction from the previously inspected contribution. Default result origin is OBSERVED.

**Availability behavior:** The final-gradient claim is unavailable until the completed gradient for the selected parameter is authentic. A partial visible fan-in or one contribution cannot substitute for the final gradient, and progression to Adam must not imply otherwise.

**Misconception guardrail:** gradient != optimizer update. The gradient describes sensitivity for this objective; it is not the new parameter value or delta.

**Progressive depth:** Details shows contributor counts/subtotals where authentic. Math sums the complete available fan-in. Microscope exposes exact edges. Source/Provenance binds training run, parameter, gradient artifact, graph origin/verification, and completeness.

**Signaling:** gold focus on selected parameter/final gradient; purple fan-in relation; cyan execution frontier only if backward is still genuinely executing; readiness marks accumulation complete for the required proposal boundary.

**Interaction boundary:** Likely learner-controlled boundary before Adam.

---

### Beat 16. Adam proposes a provisional candidate

**Identity:** Part 2 · PROPOSE.

**Learner question:** How does the optimizer turn the final gradient into a possible new parameter value?

**Why here:** Adam is a stateful policy that combines the gradient with persistent optimizer state and schedule information. It must not be conflated with backpropagation.

**Required terminology:** Adam; optimizer state; proposal; provisional candidate.

**Learning outcome:** The learner can explain:

    final gradient
    + persistent optimizer state
    + step-size policy
    -> provisional parameter proposal

**Object transformation:**

    selected parameter before + final gradient + m/v + optimizer hyperparameters/schedule
    -> Adam proposal
    -> provisional parameter after/delta inside private candidate transaction

**Computation coverage:** adamProposals/AdamUpdate for the selected parameter, including persistent first/second moments and effective learning rate at deeper levels.

**Required visible internals:** final gradient entering Adam, persistent optimizer state concept, proposal output, and explicit "not accepted" state. The full Adam equation is not required in Guided.

**Graph focus:** selected parameter/gradient -> optimizer proposal -> private candidate parameter, without replacing accepted-state identity.

**Required evidence before claim:** the proposal must come from the validated LearningExperiment/AdamUpdate and bound starting snapshot. This is recorded transition evidence rather than an Artifact provenance value. Any equation substitution or derived q/update breakdown is DERIVED from the recorded update and exact snapshot hyperparameters.

**Minimum Guided evidence:** authentic selected gradient and recorded provisional before/delta/after proposal with "accepted model unchanged." Formula internals are optional.

**Availability behavior:** The proposal is unavailable until a complete validated update is bound to the correct starting snapshot and optimizer state. A gradient alone is insufficient to reconstruct Adam truthfully; missing moments/schedule state stay unavailable.

**Misconception guardrail:** Adam is not backward; gradient is not delta; proposal is not acceptance; the representable stored delta may differ from a purely symbolic mathematical delta because floating-point storage is real.

**Progressive depth:** Details shows m, v, before/after, effective rate, step. Math shows bias correction, epsilon, schedule, exact authentic substitutions. Microscope may bind gradient ancestry and proposal fields without inventing optimizer scalar DAGs. Source/Provenance exposes snapshot/experiment/update identity.

**Signaling:** gold focus on selected parameter proposal; cyan frontier only where optimizer execution actually is; completion/readiness means proposal exists, not that model state changed.

**Interaction boundary:** Likely learner-controlled boundary before candidate comparison.

---

### Beat 17. Rerun, compare, and explicitly Accept or Discard

**Identity:** Part 2 · DECIDE.

**Learner question:** What happened on the same training example, and should this provisional candidate become the accepted model?

**Why here:** A proposal must be evaluated as a separate candidate before an explicit state decision.

**Required terminology:** provisional candidate; accepted model; baseline; Accept; Discard.

**Learning outcome:** The learner can distinguish candidate from accepted state, compare the named example truthfully, and understand that either decision is valid.

**Object transformation:**

    provisional candidate state
    -> authentic candidate forward on the same relevant example/evidence basis
    -> before/candidate comparison
    -> explicit Accept or Discard
    -> new accepted state OR preserved prior accepted state

**Computation coverage:** private candidate application, candidate forward, before/after prediction evidence, same-example objective comparison, explicit acceptance/discard transaction.

**Required visible internals:** "PROVISIONAL CANDIDATE", evaluated/not accepted/not live; comparable baseline and candidate; peer decision controls; resulting accepted/discarded state only after the action completes.

**Graph focus:** same forward world bound first to accepted baseline and then candidate comparison identity without implying the candidate replaced baseline prematurely.

**Required evidence before claim:** candidate forward must be authentic and bound to the candidate state. Comparison must use compatible input/targets. In the current learning read model, candidate loss may be DERIVED from OBSERVED candidate probabilities; if so it remains DERIVED. Before loss may be OBSERVED or DERIVED depending on captured artifacts. The decision receipt/state establishes acceptance or discard.

**Minimum Guided evidence:** a named comparison such as "Mean loss on this training example changed from X to Y", with evidence origins preserved, plus explicit candidate status and peer choices.

**Availability behavior:** Comparison is unavailable until authentic candidate-forward evidence is bound to the provisional candidate and compatible baseline evidence. Accept/Discard must not be presented as an actionable Candidate Ready decision before that state exists; unavailable comparison values remain unavailable.

**Misconception guardrail:** Do not say "the model improved", "training succeeded", or "this is the better model" from one example. Accept and Discard are peer choices, not quiz answers.

**Progressive depth:** Details shows full before/candidate distributions and per-position objective. Math shows any DERIVED candidate loss calculation. Microscope preserves run/state identities for inspected mechanisms. Source/Provenance exposes starting/resulting snapshot, before/training/after runs, comparison origins, and decision receipt.

**Signaling:** gold teaching focus on comparison/decision; cyan execution frontier only during candidate forward or transaction work; completion/readiness channel marks Candidate Ready; accepted/discarded completion appears only after explicit decision.

**Interaction boundary:** Required decision boundary with peer Accept/Discard actions. Tour Complete follows either outcome.

---

## 5. Operation coverage matrix

Classification meanings:

- **REQUIRED EXPLICIT BEAT**: the operation/concept is the core transformation named by a required beat.
- **GROUPED INSIDE REQUIRED MECHANISM**: it must be visibly exposed inside a required beat but does not require its own beat/click.
- **OPTIONAL DEPTH**: exact formulas, arrays, source identifiers, scalar ancestry, or provenance detail may move deeper while the mechanism remains visible in Guided.
- **INTENTIONALLY OMITTED FROM PUBLIC GUIDED**: only permitted for material that is not needed for the public mechanism. None of the canonical mechanisms listed below is omitted from Guided.

### Forward operations

| Canonical operation | Classification | Beat / role | Source name required in Guided? | Minimum visible Guided treatment | Evidence available | Deeper inspection |
| --- | --- | --- | --- | --- | --- | --- |
| tokenEmbedding | GROUPED INSIDE REQUIRED MECHANISM | 2 · learned token features | No | token representation lookup/source visibly contributes | OBSERVED vector + STRUCTURAL lookup | values, lookup row, scalar/source |
| positionEmbedding | GROUPED INSIDE REQUIRED MECHANISM | 2 · learned position features | No | position representation visibly contributes | OBSERVED vector + STRUCTURAL lookup | values, lookup row, scalar/source |
| embeddingSum | GROUPED INSIDE REQUIRED MECHANISM | 2 · combine token + position | No | visible addition into working representation | OBSERVED vector + STRUCTURAL dependency | component math/source |
| embeddingNorm | GROUPED INSIDE REQUIRED MECHANISM | 2 · normalize working representation | No | visible rescaling before layer work | OBSERVED vector | RMS math/scalar/source |
| preAttentionNorm | GROUPED INSIDE REQUIRED MECHANISM | 2 · prepare attention input | No | visible second rescaling and saved residual branch | OBSERVED vector + STRUCTURAL saved-residual relation | RMS math/scalar/source |
| q | GROUPED INSIDE REQUIRED MECHANISM | 3 · comparison-side Query projection | Q/Query term yes; source identifier no | one of three explicit projection branches | OBSERVED vector + STRUCTURAL parameter/head slice | matrix math/scalar/source |
| k | GROUPED INSIDE REQUIRED MECHANISM | 3 · comparison-side Key projection | K/Key term yes; source identifier no | one of three explicit projection branches | OBSERVED vector + STRUCTURAL parameter role | matrix math/scalar/source |
| v | GROUPED INSIDE REQUIRED MECHANISM | 3 · carried Value projection | V/Value term yes; source identifier no | one of three explicit projection branches | OBSERVED vector + STRUCTURAL parameter role | matrix math/scalar/source |
| attentionLogits | REQUIRED EXPLICIT BEAT | 4 · causal comparison scores | No | Query, allowed Keys, resulting scores and causal boundary | OBSERVED scores + STRUCTURAL selection; DERIVED arithmetic | complete Q/K math, scalar/source |
| attentionProbabilities | REQUIRED EXPLICIT BEAT | 5 · normalized mixing coefficients | No | scores -> softmax -> weight row | OBSERVED weights; DERIVED softmax arithmetic | complete values/math/scalar/source |
| headOutput | REQUIRED EXPLICIT BEAT | 6 · weighted Value sum | No | weights + Values -> head vector | OBSERVED output; DERIVED mixture; STRUCTURAL contributor scope | terms/scalar/source |
| attentionOutput | GROUPED INSIDE REQUIRED MECHANISM | 7 · concatenate heads | No | both head outputs visibly join by concatenation | OBSERVED vector + STRUCTURAL concatenation | channels/source |
| attentionProjection | GROUPED INSIDE REQUIRED MECHANISM | 7 · project joined heads | No | joined vector -> projected vector | OBSERVED vector; DERIVED linear math | matrix/scalar/source |
| attentionResidual | GROUPED INSIDE REQUIRED MECHANISM | 7 · residual add | No | projected result + saved bypass visibly add | OBSERVED vector + STRUCTURAL saved residual | component add/scalar/source |
| preMlpNorm | GROUPED INSIDE REQUIRED MECHANISM | 8 · prepare MLP input | No | visible normalization before expansion | OBSERVED vector | RMS math/scalar/source |
| mlpUp | GROUPED INSIDE REQUIRED MECHANISM | 8 · 8 -> 32 expansion | No | width expansion visibly represented | OBSERVED vector | matrix/math/scalar/source |
| mlpRelu | GROUPED INSIDE REQUIRED MECHANISM | 8 · nonlinearity | ReLU term yes; source identifier no | negative pre-activations gate to zero | OBSERVED vector | element math/scalar/source |
| mlpDown | GROUPED INSIDE REQUIRED MECHANISM | 8 · 32 -> 8 contraction | No | contraction visibly represented | OBSERVED vector | matrix/math/scalar/source |
| mlpResidual | GROUPED INSIDE REQUIRED MECHANISM | 8 · residual add | No | contracted result + saved stream visibly add | OBSERVED vector + STRUCTURAL saved residual | component add/scalar/source |
| logits | REQUIRED EXPLICIT BEAT | 9 · raw vocabulary scores | Learner-facing term "logits" yes | raw signed score vector | OBSERVED vector + STRUCTURAL lm_head | values/matrix/scalar/source |
| probabilities | REQUIRED EXPLICIT BEAT | 10 · output distribution | Learner-facing term "probabilities" yes | logits -> output softmax -> full support/distribution | OBSERVED vector; DERIVED softmax arithmetic | values/math/scalar/source |

### Learning operations and state concepts

| Learning concept | Classification | Beat / role | Exact source name required in Guided? | Minimum visible Guided treatment | Evidence available | Deeper inspection |
| --- | --- | --- | --- | --- | --- | --- |
| target binding | GROUPED INSIDE REQUIRED MECHANISM | 12 · known answer per position | No | target relationship across real training positions | STRUCTURAL target observation | token IDs/source |
| per-position loss | GROUPED INSIDE REQUIRED MECHANISM | 12 · target error contribution | No | multiple positions contribute | OBSERVED when captured; otherwise DERIVED from observed p(target) | complete values/math/scalar/source |
| meanLoss / objective | REQUIRED EXPLICIT BEAT | 12 · scalar training objective | No | authentic mean objective and reduction scope | OBSERVED preferred; DERIVED fallback labeled | positions/math/scalar/source |
| backward dependency traversal | REQUIRED EXPLICIT BEAT | 13 · reverse sensitivity route | No | same computation traversed in reverse dependency sense | OBSERVED graph or VERIFIED RECOMPUTED graph; STRUCTURAL topology | adjoints/scalar/source |
| gradient contribution | REQUIRED EXPLICIT BEAT | 14 · one incoming edge contribution | No | child sensitivity x local derivative, before/contribution/after | OBSERVED or VERIFIED RECOMPUTED scalar edge | full ancestry/source |
| gradient accumulator | GROUPED INSIDE REQUIRED MECHANISM | 14-15 · running sum | No | contribution changes accumulator; partial versus final explicit | OBSERVED/verified scalar evidence when available | all edges/subtotals/source |
| final parameter gradient | REQUIRED EXPLICIT BEAT | 15 · completed sensitivity | No | final gradient distinct from one contribution | OBSERVED gradient artifact; optional verified fan-in sum | all contributors/source |
| Adam persistent state | GROUPED INSIDE REQUIRED MECHANISM | 16 · m/v/schedule context | Adam term yes; field names optional | optimizer has memory/state beyond gradient | validated snapshot/update record | m/v/bias correction/math/source |
| Adam proposal | REQUIRED EXPLICIT BEAT | 16 · provisional parameter proposal | Adam term yes | gradient + optimizer state -> proposed before/delta/after, not accepted | validated LearningExperiment/AdamUpdate record; formula expansions DERIVED | full update math/source |
| candidate application | GROUPED INSIDE REQUIRED MECHANISM | 17 · private candidate state | No | explicit private/provisional state | transaction/runtime state | receipt/source |
| candidate forward | GROUPED INSIDE REQUIRED MECHANISM | 17 · rerun same example | No | authentic forward on candidate state | OBSERVED candidate probabilities/run evidence | full forward/depth |
| candidate comparison | REQUIRED EXPLICIT BEAT | 17 · named same-example comparison | No | baseline versus candidate with origin labels | OBSERVED probabilities; loss may be DERIVED | per-position/math/source |
| Accept | REQUIRED EXPLICIT BEAT | 17 · adopt candidate | Learner-facing action yes | peer decision; changes accepted state only after valid completion | decision/accepted-state receipt | lifecycle/provenance |
| Discard | REQUIRED EXPLICIT BEAT | 17 · preserve accepted baseline | Learner-facing action yes | peer decision; candidate does not rewrite accepted baseline | decision/state evidence | lifecycle/provenance |

No canonical forward mechanism in this matrix is intentionally omitted from public Guided. Exact formulas, complete arrays, operation source names, scalar ancestry, and provenance records may be optional depth. Guided must still expose the mechanism itself.

A grouped mechanism containing several operations must expose those operations visually either simultaneously or sequentially inside the mechanism. It may not highlight only the final endpoint while prose lists unseen intermediate computation.

---

## 6. Progressive disclosure

Changing depth must stay anchored, where semantically possible, to the same:

- model definition;
- accepted/candidate state;
- run/checkpoint;
- invocation/phase;
- selected occurrence;
- graph node/port/coordinates;
- evidence identity/provenance.

Depth is not a switch to a disconnected mini-application.

### Guided

Answers:

- What is happening?
- Why is this mechanism needed?
- What object became what other object?
- What authentic result demonstrates it?

Guided retains every required mechanism. It uses only the terminology needed to build the causal mental model.

### Details / Values

Adds:

- complete relevant vectors/matrices/distributions;
- shapes and axes;
- selected operands;
- comparison contributors;
- complete support or declared omitted mass.

### Math

Adds:

- actual formula;
- populated authentic values;
- relevant intermediate arithmetic;
- explicit reduction/scaling/normalization semantics.

Derived arithmetic remains DERIVED even when it numerically matches an observed result.

### Microscope

Adds:

- scalar computation;
- autograd ancestry;
- exact dependency path;
- contribution-level detail;
- repeated operand occurrences;
- observed or verified recomputed graph origin.

Microscope must not substitute a toy arithmetic example, fake scalar ancestry, or a different run.

### Source / Provenance

Adds:

- source binding and exact operation identity;
- run/checkpoint/snapshot/experiment identity;
- evidence origin and availability;
- runtime/source revision;
- coordinate and parameter identity;
- verification status where recomputation is involved.

Deeper levels add completeness and precision. They do not repair a missing Guided mechanism.

---

## 7. Presentation semantics

### Graph

The graph answers:

- Where is this mechanism?
- What is connected?
- What span/path matters?
- Where is authentic execution active?
- What backward/dependency relation is being explained?

It is the continuous computation world, not a presentation card deck.

### Screen-space teaching locator

The locator answers:

> What should I look at?

Requirements:

- readable at screen-space scale;
- spatially anchored to the selected graph mechanism;
- short mechanism name;
- optional selected occurrence/head when needed;
- no paragraph explanation;
- no arithmetic;
- no result card;
- no controls;
- must not obscure the mechanism it identifies.

### Dock

The dock answers:

- What does this mean?
- Why does it matter?
- What happened?
- What misconception should I avoid?
- What do I do next?

### Details

Details answers:

- What are the complete values?
- What is the math?
- What is the scalar computation?
- What is the provenance/source?

Do not reintroduce graph teaching cards that duplicate Dock content.

### Signaling channels

Semantic channels are independent of animation style.

| Channel | Meaning | Initial visual language |
| --- | --- | --- |
| Teaching focus | What are we learning about? | gold + persistent reticle/bracket or equivalent geometry |
| Authentic execution | Where is the model actually working? | cyan + distinct frontier/status geometry |
| Backward/dependency | What reverse causal relationship are we explaining? | purple + directional/patterned relationship |
| Neutral | Same model, not current focus | visually subordinate but still legible |
| Completion/readiness | Is required evidence/state ready for the next concept/action? | explicit state/readiness treatment, not inferred from motion |

No semantic distinction may rely on color alone. If teaching focus and authentic execution coincide on one object, both channels remain distinguishable.

Motion must have an instructional purpose. Do not require pulsing everything, decorative traveling energy, camera movement, or fake execution pacing. Reduced-motion mode must preserve state, relationship, focus, order, and readiness without relying on animation.

Animation duration values are not frozen here.

### Compression priority rule

When interaction length, screen height, or cognitive load must be reduced, make changes in this order:

1. remove decorative or redundant presentation;
2. remove duplicated explanatory wording;
3. collapse low-priority metadata;
4. move complete values/math/provenance into optional depth;
5. reduce unnecessary learner decisions;
6. combine adjacent instructional beats only when every required operation remains visibly exposed and the conceptual transformation remains understandable;
7. shorten wording while preserving meaning and guardrails.

Do not solve density by:

- removing a required mechanism;
- hiding an intermediate transformation behind endpoint prose;
- shrinking essential teaching text into microtext;
- replacing authentic evidence with summaries;
- conflating conceptually distinct objects;
- collapsing evidence distinctions;
- making execution timing carry the lesson;
- adding camera movement.

### Typography and responsive priority

Do not freeze final CSS pixel values here.

Priority under constrained space:

1. learner question / teaching title;
2. required mechanism explanation;
3. authentic observed/result concept;
4. primary action;
5. chapter/progress orientation;
6. misconception guardrail where needed;
7. optional depth controls;
8. secondary metadata;
9. provenance summaries.

Before shrinking required teaching text:

- reduce redundant headers;
- shorten copy;
- collapse secondary metadata;
- stack controls;
- reduce padding;
- move depth content behind optional disclosure.

Use proportional Sans for teaching prose; Mono where it materially helps numerical/math/source material; mixed case for normal teaching language; uppercase sparingly for compact state/evidence labels.

---

## 8. Entry, progress, decision, and completion

### First 30 seconds

Freeze the opening sequence:

    What is this tiny model doing?
            |
         obvious Start
            |
    one authentic next-token prediction
            |
    "let's trace how it got there"
            |
    return instructional focus to the input side

The prediction preview is the phenomenon being explained. It is not proof that probability/softmax has already been taught.

Explanation focus may move back to the input side. Runtime execution does not reverse. Replay, explanation navigation, and runtime execution remain distinct.

Do not require an architecture lecture before the prediction. The persistent world may orient the major regions briefly.

### Progress

Primary progress is chapter/mechanism orientation, not a global state counter.

Part 1:

    REPRESENT -> ATTEND -> TRANSFORM -> OUTPUT

Part 2:

    MEASURE -> TRACE -> ACCUMULATE -> PROPOSE -> DECIDE

Part 1 integration must communicate:

    Part 1 of 2 complete
    learning still ahead

Prediction used parameters. It did not update them.

### Candidate Ready

Candidate Ready must make all of the following unmistakable:

    PROVISIONAL CANDIDATE

    evaluated
    not accepted
    not yet the live model

Allowed claim:

> Mean loss on this training example changed from X to Y.

The evidence origin of X and Y must remain visible/reachable, including DERIVED candidate loss when that is how it is produced.

Do not make an unqualified "the model improved", "training succeeded", or "this is the better model" claim.

Accept and Discard are peer choices.

### Tour Complete

Tour Complete follows either decision.

Completion may offer:

- Explore the model;
- Try an intervention;
- Start over.

Guided completion must not imply that Guided exhausts Model Lab.

A post-tour head-ablation experiment is a suitable optional ABQ bridge:

    learn mechanism
    -> intervene on one declared head output
    -> compare authentic evidence

It is not part of the required Guided route.

---

## 9. Facilitator contract

Facilitator is not a second curriculum.

Visitor and Facilitator share:

- one lesson definition;
- the same 17 instructional concepts;
- chapter semantics;
- evidence requirements;
- graph selections/spans;
- misconception/truth guardrails;
- accepted versus candidate semantics.

Facilitator may add bounded navigation and operator controls. At minimum it may:

- navigate to an instructional beat whose required evidence already exists;
- return to the canonical current lesson position;
- expose facilitator/operator functions needed for a shared display;
- identify unavailable evidence honestly.

Facilitator must not:

- retain the retired seven-step reverse curriculum as a competing public lesson;
- silently manufacture a different learning state;
- jump into a runtime-dependent state with no evidence producer;
- trigger hidden execution merely because a teacher clicked a later conceptual landmark;
- describe unavailable evidence as if it existed;
- create a second state model that can disagree with Visitor.

For runtime-dependent Part 2 states, navigation to a later beat should be disabled or clearly unavailable until authentic evidence exists, unless the normal shared lesson transition itself explicitly requests the required execution.

The detailed control implementation belongs to OC1/LS2. LS0 freezes only same-spine semantics.

---

## 10. Guided / Explore / Microscope / Research continuity

Guided, Explore, Microscope, and Research are disclosure/control modes over related authentic computation identities. They are not separate conceptual worlds.

### Guided -> Explore

Leaving the prescribed route preserves, where semantically possible:

- model identity;
- run/checkpoint identity;
- selected occurrence;
- current accepted state;
- evidence provenance;
- graph topology.

Explore removes prescribed ordering. It does not replace the computation.

Returning to Guided restores the lesson's canonical focus without fabricating new execution.

### Guided / Explore -> Microscope

Microscope deepens the currently selected authentic mechanism/evidence.

It must not:

- substitute a toy arithmetic example;
- reconstruct fake scalar ancestry;
- silently switch runs;
- silently change coordinates.

If old scalar evidence is unavailable, verified recomputation may be used only under the current inspection verification contract and must remain RECOMPUTED.

### Guided / Explore / Microscope -> Research / Experiment

Research may introduce:

- interventions;
- model/technique variants;
- comparisons;
- candidate states;
- retained evidence;
- analysis artifacts.

Those create explicit new identities and relationships where required.

They must not rewrite the accepted baseline or masquerade as the original computation. An intervention result is evidence about that intervention. A replacement/analysis graph is not original execution.

---

## 11. Human validation and repair triggers

### Bounded cold-user validation

The first implementation should be tested with:

- 2 to 3 unfamiliar learners on a real Neo;
- no initial coaching;
- one TV/Facilitator rehearsal;
- neutral teach-back.

Observe:

- can they start?
- do they understand the prediction task?
- does attention follow the intended mechanism?
- do they understand Details is optional?
- do they know where they are in the lesson?
- do they understand Part 1 is not the end?
- can they distinguish reading time from execution waiting?
- does backward direction make sense?
- do they understand Candidate Ready?
- do they understand Accept/Discard?
- do they recognize Tour Complete?
- do they experience visual/motion discomfort?

Teach-back should probe:

- why numerical representations are needed;
- Q/K/V operational roles;
- score versus weight;
- weight x Value mixing;
- causal unavailability;
- residual preservation;
- what the MLP operationally does;
- logits versus probabilities;
- what loss measures;
- backward sensitivity;
- contribution versus final gradient;
- gradient versus Adam;
- provisional candidate versus accepted model;
- what changed on this example and what cannot be concluded generally.

Additional required probe:

> "What did the model learn from this example, and what can you not conclude from that?"

Terminology-perfect recall is not required. A causally coherent mental model is.

### Repair-trigger classes

| Class | Trigger examples | Bounded repair scope |
| --- | --- | --- |
| A · Entry / discoverability | Start is not obvious; Details appears mandatory; visitor cannot tell what the exhibit asks | opening hierarchy; CTA prominence; optionality labeling; immediate orientation |
| B · Route / progress / completion | Part 1 appears final; learner loses location; Candidate Ready appears final; Tour Complete is missed | chapter/progress model; bridge copy; state hierarchy; completion affordance |
| C · Mechanism / magic gap | "attention just chooses"; cannot explain what weights multiply; Transform is opaque; graph skips a mechanism | affected beat; operation visibility; grouping boundary; object transformation; focus span |
| D · Terminology / misconception | weight = causal importance; literalized Q/K/V; logit = probability; gradient = update | local wording; guardrail; example; terminology timing |
| E · Spatial mapping / guidance | dock is understood but mechanism cannot be found; locator unclear; signaling roles confused | focus geometry; locator; spatial span; signaling distinction |
| F · Readability / physical presentation | squinting; leaning close; TV teaching text unreadable; dock overflows required explanation | deployment typography; density; locator; layout; physical configuration |
| G · Execution / lesson-state ambiguity | visitor cannot tell if model is working; runtime churn replaces lesson meaning; frontier conflicts with focus | execution status; signaling; controller/view-state boundary |
| H · Pacing / wait | execution wait causes abandonment; automatic transitions outrun reading; pause looks frozen | learner pacing; truthful working status; measured runtime bottleneck only if demonstrated |
| I · Progressive-depth confusion | Details seems mandatory; depth loses Guided route; returning changes conceptual state | depth affordance; return/resume behavior; continuity semantics |
| J · Evidence / candidate truth | provisional looks accepted; one-example change becomes general improvement; DERIVED looks OBSERVED | evidence labeling; candidate hierarchy; comparison wording; provenance disclosure |

Repair escalation rule:

- one severe truth error, impossible progression, or accessibility/readability failure is sufficient for targeted repair;
- repeated confusion around the same concept across more than one unfamiliar participant is strong evidence for a bounded beat/presentation repair;
- an individual aesthetic preference is not by itself evidence for redesign;
- do not reopen the whole learning architecture because one participant hesitates;
- broader redesign requires evidence of a shared root cause affecting multiple mechanisms or multiple independent learners.

Do not launch general performance optimization from pacing anecdotes without measurement.

---

## 12. Deployment measurements not yet frozen

LS0 intentionally does not freeze:

- actual Neo CSS viewport;
- macOS display setting;
- final teaching type sizes;
- final dock dimensions;
- TV viewing distance;
- TV typography;
- Pi performance;
- exact route completion time;
- animation timing;
- final controller state count;
- final click count.

These are deployment measurements or implementation outcomes, not curriculum truth.

ABQ-specific Visitor/Facilitator behavior, attract/reset policy, Neo tuning, and 1080p TV presentation remain deployment/profile concerns unless a later source-backed decision explicitly generalizes them.

---

## Contract summary

Implementation must preserve all of the following distinctions:

    prediction phenomenon != probability mechanism
    attention score != attention weight
    attention weight != automatic importance
    unavailable future position != zero score
    concatenation != residual addition
    logit != probability
    explanation direction != runtime timing
    one gradient contribution != final gradient
    final gradient != Adam proposal
    Adam proposal != accepted model
    candidate loss change on one example != general model improvement
    replay != execution
    structural evidence != numerical observation
    derived arithmetic != observed evidence
    verified recomputation != original observation

The public learning architecture is therefore:

    authentic native computation + truthful evidence
                    |
          continuous computation world
                    |
        Guided -> Explore -> Microscope
                    |
                 Research

Guided is a route over that real world. It must make the required mechanisms understandable without replacing the model/evidence ontology, hiding computational gaps, or promoting MicroGPT/ABQ-specific constraints into platform invariants.
