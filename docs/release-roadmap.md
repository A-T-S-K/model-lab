# First release contract and roadmap

Model Lab is an approachable, local-first platform for learning how different
language models work, inspecting authentic computation, and experimenting with
controlled changes. This is a proposed release contract, not release acceptance.
The [foundation ledger](foundation-status.md), [document authority](README.md),
[platform design §§3, 8, 10](design/Model-Lab-Refined-Platform-Design-v2.md), and
[proof plan §§6–7](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md) govern
implementation and qualification. BSides ABQ is complete; its reports, deployment
profile, evidence identities and limitations remain historical records.
Attendee-reported confusion is field feedback, not a formal learning study.

## Learn → Explore → Lab

Learn offers an excellent guided tour of one authentic computation. Explore opens
that same continuous world with stable selection, contextual controls and deeper
inspection. Lab makes a controlled change, compares matched evidence, and returns
to the accepted baseline. Progressively deeper controls must preserve source,
coordinate, execution phase and acceptance state; camera movement must not silently
change the visitor's task. Instrument Graphite/Plex, quantitative constructions,
keyboard access and static/reduced-motion meaning remain part of the contract.

| Audience | Desired first-release outcome |
| --- | --- |
| Technical person without ML/math background | Follow a prediction and one learning update; explain how evidence supports the output and distinguish a gradient from an applied update. |
| Nontechnical newcomer | Explain that prediction uses learned numerical representations and context; distinguish a saved example, live computation and explanation playback; identify a limit of the tiny model. |
| Expert | Reach exact values, axes/dtype/coverage, mathematics, immutable source, per-action capabilities and reproducible matched experiment receipts directly. |

The first release includes complete local MicroGPT teaching, with readable native
forward/backward/training code, authentic saved examples and optional live native
execution. Canonical and noncanonical MicroGPT, native Pythia, numeric MLP/SGD,
grouped-axis numerical, shape-only/opaque fixtures, replacements, experiments,
replay and failure controls remain required heterogeneous foundation witnesses.
Pythia and MLP establish different kinds of diversity and cannot replace each other.

The public Pythia route should be polished and native, while stating its actual
selected-internal coverage, float32 precision, bounded payloads and uncached
full-prefix generation policy. It must expose unsupported actions and uncaptured
internals honestly. A saved recording is authentic historical computation, not live
execution. Optional research executors must not become a prerequisite for ordinary
browser-local MicroGPT learning. No weights, dependencies or backend adoption are
authorized by this document.

## Six proposed chapters

| Chapter | Question and concrete evidence | Check of understanding |
| --- | --- | --- |
| 1. Prediction | What could come next? Follow input/prefix → logits → full-support probabilities and known target. | Explain why a prediction is neither a guarantee nor a sampled token. |
| 2. Representation | How do tokens become numbers? Inspect an embedding row and a signed projection with original values. | Distinguish a token ID from its vector and a display projection from the source tensor. |
| 3. Context/attention | How does earlier context matter? Follow Q/K, causal scores, normalization and all admitted value contributors. | Identify the mask and explain what the weights mix, including omitted display scope. |
| 4. Output | How do these computations reach a decision? Follow residual/MLP/output operations and the distribution. | Relate the selected output to the actual denominator and explain a model limitation. |
| 5. Learning | How can one example change parameters? Follow loss, backward contribution, accumulated gradient, optimizer proposal and candidate. | Distinguish explanation playback from execution and a provisional candidate from accepted state. |
| 6. Experiment | What changed, compared with what? Run a matched recipe and inspect provenance, controls and receipts. | Name the changed variable, comparison basis, confounds and return-to-baseline action. |

Each chapter needs a small authentic example, an optional analogy with its limit,
a precise operation explanation, a misconception check and a return path. The
curriculum is a proposal; chapter order, duration and example choice require review.

A consistent inspector provides **explanation, values, math and source** for the
same selected object. Values declare axes, coordinates, dtype, precision,
transform/reduction, origin, verification, phase and availability independently.
Math uses actual bound values and full contributor scope; source opens the native
operation at its recorded identity. Missing or shape-only values never become
placeholder numerical evidence. Unsupported depth must retain an explicit reason.

## Initial Lab recipes

1. **Input changes:** compare a baseline prefix and one changed input from matched
   state; expose tokenization, context differences and output support. Repetition
   keeps separate run identities and makes no training or causality claim.
2. **Matched head ablation:** change one supported semantic head using a registered
   recipe, preserve baseline state/input/budgets, inspect downstream changes and
   receipt provenance, and return to baseline. Selected head and token coordinates
   must agree across the summary, world and inspector.
3. **One provisional training update:** start from an exact accepted state, expose
   loss/backward/proposal/candidate evidence, then explicitly accept or discard.
   Preserve optimizer, schedule, cursor and RNG state where applicable. Discard,
   cancellation and failed archival must not rewrite acceptance history.

These are bounded teaching recipes. Their results do not demonstrate generalization,
universal head causality, or security defenses. Recipe execution remains an explicit
action through trusted registered native code; imported data stays inert.

## Ordered milestones and exits

Exit criteria below are proposed requirements, not observed results. Every milestone
records its candidate/runtime, scope, commands, retained evidence, refusals and gaps.

| Order | Dependency and deliverables | Measurable exit criteria |
| --- | --- | --- |
| R0. Repeatable validation and release contract | This scoped tooling/documentation pass; fresh owned browser/HTTP outputs and writer inventory. | Synthetic collision/traversal/alias/override/retry/worker/failure tests pass; representative repeated browser and HTTP checks preserve earlier bytes; full-run failures and absent witnesses are recorded. No M5 or release claim. |
| R1. Shared selection and context correctness | R0; resolve token-position mismatch, implicit camera detour and default-entry policy. | Summary, adjacent witness, world and inspector agree on full semantic coordinates through selection/model/run changes; keyboard focus and accepted state survive; fresh desktop/compact/reduced-motion regressions pass. |
| R2. Guided tour into cohesive exploration | R1; chapter examples, inspector layers, explicit depth/return/resume behavior. | All six chapters have source-bound evidence and misconception checks; every Learn→Explore→Learn route preserves selection and numerical meaning; internal keyboard, visual and accessibility review has no unresolved blocking defect. |
| R3. Usable Lab and polished Pythia route | R1–R2; three recipes, matched receipts, capability refusals, native selected-internal and disconnected saved routes. | Each recipe has reproducible baseline/treatment and acceptance/discard evidence; supported source/math/value navigation works; unsupported/uncaptured routes refuse honestly; all required heterogeneous witnesses retain current shared-boundary coverage. |
| R4. Independent M5 foundation review | Foundation acceptance evidence, R1–R3 candidate and complete FP portfolio. | Independent reviewer audits exact-candidate mathematics/state/evidence/failure proofs and extension change surface; required witnesses all pass or the gate remains blocked. Old passes cannot qualify changed boundaries. |
| R5. M6 unfamiliar-user and release qualification | Valid independent M5 disposition first; candidate-bound coverage matrix, approved notices/licenses and modes. | Full unfamiliar-user comprehension/navigation testing, workshop/station/offline/recovery qualification, candidate-bound CI and durable artifacts complete. Learning thresholds and release blockers are agreed before testing; unresolved failures block acceptance. |

Engineering inspection, visual review and accessibility work can precede M5. Full
unfamiliar-user testing cannot. Event timing and ABQ field feedback waive no gate.

Measure learning separately from task completion and automated correctness. Before
M6, agree a scoring rubric and thresholds for chapter misconceptions, unaided causal
explanation, transfer to a new example, and saved/live/playback and candidate/accepted
state distinctions. Record navigation completion, assistance, time and recovery as
usability measures; mathematical conformance and browser assertions as engineering
measures. Neither is evidence of learning. Report recruited audiences, denominators,
protocol, build identity and limitations from actual observations only; there are no
invented participant counts, quotations, dates or study results in this roadmap.

## Decisions, limitations and follow-up defects

- Candidate summary and adjacent witness can select different token positions.
  R1 must define and prove the shared context contract before tour polish.
- Camera manipulation implicitly enters Explore; default entry is inconsistent.
  Decide intentional entry, takeover and return/resume policy in R1–R2.
- Local acceptance, CI and isolation cover different surfaces. Define the intended
  matrix and HTTP coverage in a later authorized pass; do not transfer a local pass.
- Public exact-candidate qualification excludes autoplay. Decide whether to include
  it or qualify it separately with the same candidate binding.
- Publishing remains event-specific; first-release packaging, supported operating
  profiles, release notices/licensing and approval ownership are unresolved.
- Decide chapter lengths, terminology, saved examples, Pythia default coverage,
  inspector depth defaults, live-executor setup expectations and M6 learning rubric.
- A broader heterogeneous foundation does not imply complete Pythia internals,
  cached generation, all-model training, arbitrary intervention or backend portability.
  Runtime/resource budgets and native availability constrain promised coverage.
- Historical preparation/rehearsal/soak/benchmark writers remain outside R0; the
  [validation safety review](reviews/release-validation-safety.md) records remaining
  unsafe entrypoints. Existing reports and the untracked merge plan remain intact.

Later horizons deepen model coverage (generation/cache, richer native internals,
training and alternative architectures where separately qualified), then expand
controlled security lessons: data substitution, poisoning/defense controls,
interventions and attribution hypotheses with faithful provenance and null outcomes.
These horizons require new scoped authorization, proofs and content; this pass
implements neither their UI nor production architecture cleanup.
