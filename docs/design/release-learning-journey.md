# Release learning journey

Status: implemented opening and forward-prediction engineering slice, provisional pending the
[forward-tour review](../reviews/release-learning-forward-tour.md). Foundation acceptance,
independent M5 and unfamiliar-user learning evidence remain ungranted. See
[authority](../README.md), [foundation ledger](../foundation-status.md),
[release roadmap](../release-roadmap.md) and design §§3–5/8 in the
[platform design](Model-Lab-Refined-Platform-Design-v2.md).

## Entry and instructional contract

Opt in at `/?experience=learn`. The default `/` is unchanged. Explicit classic,
kiosk and demo entries take precedence if combined with `experience=learn`.
Learning is an activity over the existing workbench capabilities, not a deployment
profile. It has no event idle reset. The opening reuses the existing authentic
bootstrap capture as recorded replay; only **Run a fresh prediction** or explicit
**Predict** requests another execution. No explanation transition trains.

Technical newcomers first see a concrete question and result. Nontechnical readers
can identify the request, visible prefix, known answer and model output without an
architecture prerequisite. Experts can enter Explore or Open workbench immediately;
Values / Math / Source remain visible at every introductory step. The opening
collapses the same scene to semantic groups; expanding restores its operation
objects. Representation expands those same operations. No separate model, scene
implementation, archive, execution engine or numerical trace is created.

Chapter sequencing is staged instruction. Values / Math / Source are optional
progressive disclosure, not prerequisites or a second sequence. Deferring an
operation in the simple path does not delete its mathematical coverage. The full
arithmetic, native source, axes, source identities and experiment contracts remain.

## Six-chapter map

| Chapter | Learner question / prerequisites | Authentic computation and semantic anchors | Takeaway / misconception | Optional Values, Math, Source | Action, feedback and transition | Implementation / qualification |
| --- | --- | --- | --- | --- | --- | --- |
| Prediction | What is the model predicting at this position? No ML knowledge; introduce example, prefix and next character. | Canonical abca, p3: START + abc → target a; separate p4 target END. `model.probabilities`, complete vocabulary support, recorded run/position. | Current parameters assign next-token probabilities. Top rank is neither guaranteed answer, sampled output nor empirical accuracy; prediction does not train. | Original full-support values, logits/softmax, native forward source, immutable run and snapshot identity. | Explicit fresh Predict. Optional three-choice check explains assigned probabilities, guarantee and training using this run's highest output/known target. Continue to representation or Explore. | Opening and chapter implemented in this pass; engineering controls and visual evidence in review. No measured learning gains. |
| Representation | How can the model calculate with a character and its position? Know that a vocabulary lists possible tokens; introduce ID, lookup, component and vector. | Selected p3 c → ID 2 → `tokenEmbedding`/wte row, `positionEmbedding`/wpe p3 → `embeddingSum` → `embeddingNorm` → layer0 `preAttentionNorm`. | Tables turn character/position into numerical lists; add corresponding components and rescale. Signs are not quality judgments; dimensions have no established human meanings; initial weights are not trained semantics. | All original components, actual component-zero addition; both RMS norms, full feature reductions, epsilon 1e-5, source-bound artifacts, saved embeddingNorm residual identity. | Read one worked numeric example; open component details. Continue explicitly into the context/attention chapter, or Explore/return. | Implemented introductory chapter; native mathematics preserved. Forward attention sequence uses the same public lesson states. |
| Context / attention | How does earlier context affect this position? Vectors and current versus earlier positions. | Existing Q/K/V, causal scores, attention weights, full weighted-value contributors, head concatenation, projection and saved residual. | Causality restricts future keys; attention weights mix vectors. They are not proof of semantic circuits or causal explanations of learned behavior. | Actual dot products, head/key coordinates, scaling, softmax support, signed weighted sums, residual source and native code. | Five implemented beats: Q/K/V, causal comparison, position weights, Value mixture, head integration. Optional causal/importance check gives explanatory feedback. | Implemented release chapter; complete p3/head0/key0 comparison, causal row and full contributors, source-bound projections and residual. Engineering evidence in the forward-tour review. |
| Output | How do numbers become possible outputs? Representation and context. | Existing MLP/ReLU, logits/unembedding and complete output softmax; distinguish known target, greedy rank and sampling. | Raw scores differ from probabilities; support and denominator matter. No sampled text or language-performance claim from a single distribution. | Native activation differences, all logits, softmax denominator, exact probabilities. | Implemented transform → logits → output probabilities → original prediction recap. Optional normalization check; explicit Start learning computation · propose one update hands off to the existing workflow. | Implemented release chapter; canonical ReLU/no-bias/RMSNorm, both saved residual sources, all output indices and denominator retained. |
| Learning | How could this example change a later prediction? Prediction, target and error. | Existing whole-example mean loss, backward contributions/accumulation, Adam moments/schedule, provisional candidate and explicit acceptance/discard. | Sensitivity is not the applied update; candidate is not accepted state; one example improvement is not generalization. | Numerical adjoints where available, complete state/receipt lineage, optimizer arithmetic/source. | Existing bounded proposal/decision workflow. Future chapter should compare matched before/after at the same occurrence. | Existing lifecycle/comparison controls retained. New introductory learning chapter not implemented. |
| Experiment | What changes when we change one thing? Baseline, controlled variable and outcome. | Registered matched interventions/replacements/data experiments, compatible run/arm/state meanings, clean/treatment/defense controls where qualified. | Correlation is not causation; a null result is valid; replacement is not original execution. | Matched state/order/budgets, numerical declarations, receipt/source and explicit missing coverage. | Open existing workbench without finishing lesson. Future release experiment lesson and approachable lab recipes remain proposed. | Existing capabilities reachable; no new recipe/backend or qualification claimed. |

## Continuity and refusals

The existing PublicLessonSession owns canonical state and Guided/Detail/Explore
navigation. The introductory read model reads immutable ForwardModel artifacts.
The recipe binds p3 explicitly; short inputs do not adopt a final END row. Missing
capture remains unavailable. Edited input is shown separately from the retained
example until explicit Predict. Unsupported vocabulary is refused by the existing
executor. The same run and semantic occurrence feed summary, detail and world.

Values / Math / Source keep render-only temporary member choices local. Return
restores the lesson binding and initiating control focus. Camera gestures pause
explanation motion while preserving activity. Explore is explicit; Resume restores
the retained lesson computation without another prediction. Open workbench changes
presentation in the same session; Return to lesson remains available in Classic
and existing alternate worlds and restores the retained canonical run. During
active work those activity switches refuse/disable until the user explicitly finishes,
cancels or resolves a candidate. Navigation never resolves a candidate implicitly.

## Research inputs and limits

- [IES practice guide, recommendations 2–4](https://ies.ed.gov/ncee/wwc/PracticeGuide/1):
  supports pairing worked examples with exercises, graphics with explanations, and
  concrete with abstract representations. Application here: abca/p3 and an optional
  explanatory check, labeled probability bars, then ID/lookup/addition. This general
  instructional evidence does not validate this product, audience or chapter ordering.
- [NN/G progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/):
  distinguishes optional advanced access from a required staged sequence and stresses
  visible, meaningful access labels. Application here: chapter Continue versus always
  discoverable Values / Math / Source and Explore. This is UX guidance, not a Model Lab
  learning experiment or a guarantee that this split is optimal.
- [Transformer Explainer authors' paper](https://arxiv.org/abs/2408.04619):
  integrates overview and expansion across abstraction levels. Application here:
  collapse/expand the same semantic world and retain computation context in detail.
  Its GPT-2 implementation, audience and reported findings cannot qualify MicroGPT,
  Model Lab's state/experiment boundaries or this new interface.

Sources inspected 2026-10-02. No comprehension gain, foundation acceptance, full user
study, workshop/station qualification or release readiness follows from clicks,
research citations or the engineering checks. Those boundaries remain governed by
[proof plan M5/M6](Model-Lab-Foundation-Proofs-and-Migration-v2.md#m5-independent-foundation-review).

## Implemented chapter 3–4 contract

Chapter 3 asks “How does earlier context affect this position?” Chapter 4 asks
“How do those numbers become probabilities for possible outputs?” Both bind the
canonical abca p3 occurrence retained by PublicLessonSession. The bounded read model
uses the existing spatial Query/Key lens and ForwardModel explanations; it creates
no execution trace, numerical engine or independent lesson state.

At p3, START/p0 and p1–p3 are eligible. p4 remains visible as future/excluded with
no score coordinate, rather than zero or a fabricated mask. Head0/key0 shows every
Query/Key component, derived signed products/sum and width scaling beside captured
score. The complete score/weight row normalizes over positions. Every eligible
weight and Value component contributes to the selected head-output sum. Distinct
head vectors join channels; the output projection transforms them; addition uses
the saved embeddingNorm, preceding preAttentionNorm.

Chapter 4 exposes preMlpNorm, expansion, componentwise ReLU, contraction and
addition to saved attentionResidual, then lm_head logits and vocabulary softmax.
Each operation has a focused purpose and bound example; optional full projection
operands, all ReLU components, stable softmax denominator, Math and Source supply
depth. These architecture declarations apply to canonical MicroGPT only.

The recap is the unchanged chapter 1 distribution, with known target, top rank and
absence of sampling explicit. Start learning computation · propose one update
begins the existing learning workflow; candidate decisions remain explicit and
unresolved work blocks activity switching. Redesigned chapters 5–6 remain proposed.
Optional check clicks grant no comprehension evidence.

The learning handoff requires complete compatible chapter evidence and a prediction
matching the current input/accepted state. Edited input or a retained historical
prediction disables it with an explicit refusal. The controller rejects a stale
handoff before any runtime effect; explanation navigation remains available.
