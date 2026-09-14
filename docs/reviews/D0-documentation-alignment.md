# D0 documentation alignment

**D0 COMPLETE.** Local, reviewable, uncommitted documentation patch only.
Foundation implementation, proof acceptance, independent foundation review,
full-user acceptance and release approval were **not granted** by this pass.

## Checkout and inputs

Execution date: September 13, 2026, America/Phoenix (UTC September 14).
Root: `/Users/joshuahansen/dev/model-lab`.
Origin fetch/push: `git@github.com:A-T-S-K/model-lab.git`.
Branch before/after: `wave-1a-spatial`.
HEAD before/after: `f6a4b51326032fef41b8b0d8ca6539ae77366173`.
HEAD tree before/after: `b6d06fe2f81d12518291aa67cad6ef833eeef1da`.
These match the brief's baseline. No reset, branch switch or new branch occurred.
The tree identity is the committed tree, not a hash of the uncommitted patch.

Initial tracked/staged diffs were empty. Initial untracked state contained only
`docs/abq-product-review.md`; it was inspected and preserved byte-for-byte.
No overlapping edits or equivalent target documents required reconciliation.

All three attachments were read completely from `/Users/joshuahansen/Downloads`:

| Supplied input | Original SHA-256 |
| --- | --- |
| `Model-Lab-D0-Documentation-Alignment.md` | `c7f0f9d7d6610c6350b65d82d035b4d65d78871f73666100b9c0d63c18357635` |
| `Model-Lab-Refined-Platform-Design-v2.md` | `483871fdb105d54556e983105710bb862b0d37742c39c00837f6edf8cad24f61` |
| `Model-Lab-Foundation-Proofs-and-Migration-v2.md` | `3a4929927f36c81eee0f31e81c0c97a7730bcb0468488c4ee17c048bd47e8b56` |

Both v2 hashes match the brief. Adopted copies change only the companion filename
from inline code into a relative Markdown link. Reversing that normalization yields
the original text exactly, preserving requirements, source register, uncertainty,
FP/M criteria, disqualifying shortcuts and the embedded future prompt.

| Adopted copy | SHA-256 after link normalization |
| --- | --- |
| [Design](../design/Model-Lab-Refined-Platform-Design-v2.md) | `cdc91150e3b4918ba78f65af115be67b1823c7ad4f67aae67df14f7f9bd7e2b0` |
| [Proof plan](../design/Model-Lab-Foundation-Proofs-and-Migration-v2.md) | `702276beaaa4d396f1a76de91d1c8a6bdd487c9e9f843088e6bf6bab91605643` |

## Instructions and inspection

The current user request and D0 assignment controlled this task, subject to harness
instructions. The user-supplied AGENTS rule says “Don't prefix branches with codex/”;
it is retained in the new root instructions. No existing AGENTS.md or
AGENTS.override.md was found in the checkout, including untracked files; no parent
AGENTS.md existed at the checked ancestor paths. No overriding instruction blocker
was found. The initial filename inventory extended to sibling repository AGENTS
paths; no sibling instruction contents were read or changed. Subsequent inspection
stayed within the checkout, supplied inputs and ancestor guidance.

Current guides read in full: README, READ_THE_CODE, evidence-and-operations,
ABQ operator/facilitator, morning and teaching checklists. Additional full reads:
pre-existing ABQ product review, reference/PORTABILITY, ci-supply-chain and
experiments-v0.2. Targeted headings/status sections were inspected in overnight
review/progress, acceptance-v0.2.1, learning-stop-fix and end-to-end-fixes. These
additional documents are historical and needed no out-of-scope changes. Other
historical reports are indexed without a claim to have reread their full contents.

Source inspection covered package scripts, complete runtime hashing implementation,
snapshot validation, worker protocol, strict comparison, trace types and
TrainingStateRecord callers, archive admission and spatial source/dependency mapping.
See the [source-to-target map](../foundation-status.md#current-source-to-target-map).
Historical upload IDs in the v2 register are provenance, not local paths. Their
originals were not fetched or claimed as read. No library research or integration ran.

## Changes and authority

| Authorized path | Purpose |
| --- | --- |
| [AGENTS.md](../../AGENTS.md) | Standing platform/invariant/reading/validation/review guidance; later authorized code gates remain possible |
| [docs/README.md](../README.md) | Subject authority and active/current/operational/historical index |
| [Design copy](../design/Model-Lab-Refined-Platform-Design-v2.md) | Full designated target and source register |
| [Proof-plan copy](../design/Model-Lab-Foundation-Proofs-and-Migration-v2.md) | Full qualification and sequencing, preserving unrun status |
| [Foundation ledger](../foundation-status.md) | All FP/M statuses, migration anchors, retained findings and next gate |
| [This report](D0-documentation-alignment.md) | D0 identities, checks, conflicts, coverage and stop |
| [README.md](../../README.md) | Platform/current/target distinction and foundation prerequisite; quickstart retained |
| [READ_THE_CODE.md](../../READ_THE_CODE.md) | Current organism scope, native-code target and portable/canonical validation distinction |
| [Evidence guide](../evidence-and-operations.md) | Current contracts; provisional versus active state clarification |
| [Operator runbook](../abq-operator-runbook.md) | Foundation prerequisite; operations preserved |
| [Facilitator guide](../abq-facilitator-guide.md) | Foundation prerequisite; script preserved |
| [Morning checklist](../morning-checklist.md) | Foundation prerequisite and witness order; unrun results preserved |
| [Teaching check](../teaching-check.md) | Foundation prerequisite; pending human status preserved |

The [authority matrix](../README.md#authority-by-subject) distinguishes current
permissions, product/UX, target architecture, proof order, implemented behavior,
historical verification and backend choices. Design prose with user corrections
governs target semantics; sketches are not frozen APIs. Source/scoped evidence governs
current claims; old reports retain original identities and caveats. No blanket
“newest wins” or “source beats design” rule applies. No dependency approval was granted.

## Conflicts and decisions

| Exact statements / sections | Resolution and gate |
| --- | --- |
| Old README starts “This tiny GPT”; design §1 defines a model workbench | Keep the explanation under Current implementation; add target framing. User direction resolves ambition. D0 resolved. |
| Product review opening “Ready for human rehearsal” and closing “proceed with the existing morning checklist”; overnight review ON5/Final startup recommends human review; plan M5/M6 requires foundations first | Preserve historical reports; current authority/guides explicitly require M5 before full users. Event timing does not waive it. D0 resolved; M6 NOT_RUN. |
| Morning checklist closing puts generation/additional models in later work; FP-03/FP-09 and M1–M5 require bounded witnesses before M6 | Distinguish absent current exhibit capabilities from required foundation work; no general public editor required. D0 resolved. |
| READ_THE_CODE Numerical acceptance calls `test:reference` deterministic regeneration; package.json aliases portable checks | Correct portable versus separate canonical command/environment. No tests or fixture edits. D0 resolved. |
| Evidence-guide checkpoint wording versus actual TrainingSnapshot consumers | Identify TrainingStateRecord as provisional/test-only in inspected callers; active snapshot/worker boundary remains the migration target. D0 resolved. |
| Experiment evidence Promotion recommendation limits public ablation/data stories; design §6.3 and FP-08 require controlled data/defense proof | Preserve the scoped public recommendation and caveats; it does not remove foundation research witnesses. D0 resolved. |
| Prior projection wording/pre-ablation provenance findings versus product review “No observed ... blockers” | Different inspection scope does not disprove earlier findings. Brief §7 and plan M5 retain later runtime corrections. Neither reproduced nor resolved here; qualify them in the later candidate. Not a D0 blocker. |

No unresolved architectural decision blocks D0. Backend bindings, immutable model/
weight revisions and optional Python dependencies remain explicit M0/M1 decisions.
Historical wave, acceptance, benchmark, review, identity and prepared-artifact records
were not edited, reformatted or moved.

## Requirement coverage

Complete-copy comparison verifies preservation beyond this compact map.

| Group | Preserved requirement coverage | V2 sections |
| --- | --- | --- |
| Product/UX | Multi-model workbench, connected world, progressive depth, readable mechanisms | Design [§1](../design/Model-Lab-Refined-Platform-Design-v2.md#1-product-definition-and-authority), [§3.4](../design/Model-Lab-Refined-Platform-Design-v2.md#34-readable-model-code-is-a-release-invariant), [§8](../design/Model-Lab-Refined-Platform-Design-v2.md#8-the-visual-and-interaction-design) |
| Integration | Native executors, semantic bindings, codec ownership, trusted registration, source/licenses | Design [§2](../design/Model-Lab-Refined-Platform-Design-v2.md#2-research-decisions), [§3](../design/Model-Lab-Refined-Platform-Design-v2.md#3-architecture-a-small-modular-application-with-explicit-extension-boundaries) |
| Identity/topology | Layer/typed axes/node/port/invocation, state/control edges, shared parameters, opacity | Design [§4](../design/Model-Lab-Refined-Platform-Design-v2.md#4-semantic-identity-and-model-structure) |
| Runtime/evidence | Per-point capability, execution/playback/timing, epochs/cancellation, indeterminate outcomes, typed payloads | Design [§5](../design/Model-Lab-Refined-Platform-Design-v2.md#5-execution-and-evidence-contracts) |
| State/replay | Original identities, weights versus continuation, versioned readers, replay versus recomputation | Design [§5.4](../design/Model-Lab-Refined-Platform-Design-v2.md#54-identity-and-portable-state), [§5.5](../design/Model-Lab-Refined-Platform-Design-v2.md#55-versioning-and-historical-compatibility) |
| Input/learning | Tokenizer/output support, actual generation, objective/optimizer diversity, data/order/budget lineage | Design [§6](../design/Model-Lab-Refined-Platform-Design-v2.md#6-input-generation-and-training-are-first-class) |
| Swaps/experiments | Real replacement, patching/ablation, comparison policies and representation compatibility | Design [§7](../design/Model-Lab-Refined-Platform-Design-v2.md#7-technique-variants-interventions-and-comparisons) |
| Security/research | Data substitution, clean/treatment/defense controls, truthful nulls, analysis artifacts, evidence domains | Design [§6.3](../design/Model-Lab-Refined-Platform-Design-v2.md#63-training-and-data-experiments), [§9](../design/Model-Lab-Refined-Platform-Design-v2.md#9-security-and-research-growth-without-absorbing-other-products) |
| Resources/safety | Bounded slices/rendering, inert imports, optional Python, no mandatory cluster/service | Design [§10](../design/Model-Lab-Refined-Platform-Design-v2.md#10-resource-bounds-safe-imports-and-deployment) |
| Proof portfolio | Canonical, noncanonical, native Pythia, MLP/SGD, grouped axes, opaque fixtures, replacements, experiments, replay/failures | Plan [§2](../design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#2-initial-model-portfolio), [§3 FP-01–FP-12](../design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix), [§4](../design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#4-detailed-native-model-adapter-acceptance), [§5](../design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#5-replacement-and-experiment-acceptance-specifics) |
| Gate order | M0–M5 foundation then M6 full users/workshop/station/release; no old-soak transfer | Plan [§6 M0–M6](../design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#6-migration-stages-and-ownership) |

## Documentation-only checks

Inspected the hashing module before import: its CLI generator is guarded by module
path equality with process.argv[1]; runtimeIdentity only reads and hashes files.
Ran from repository root before/after edits:

```sh
node --input-type=module -e 'const { runtimeIdentity } = await import("./scripts/runtime-identity.mjs"); console.log(JSON.stringify(await runtimeIdentity(process.cwd()), null, 2));'
```

Both results: **`sha256:c1ed7bf5d6de9e302668cf8f79a3d8d5539f56d07010cd5dbc471a9c69bc0891`**,
with **72 identical ordered source paths**. Compared complete result objects.
An unchanged identity is not a fresh test pass.

A before/after SHA-256 inventory excluding `.git` and `node_modules` checked existing
repository files. All files outside the seven authorized edited guides remain
byte-identical; additions are exactly the six authorized new documents. This includes
3,455 existing files under runtime/, dist/ and test-results/, all unchanged. The local
prepared kit exists and was preserved, without rerunning manifest qualification or
its old soak. The pre-existing untracked product review remains byte-identical.

Baseline status and tracked/staged diff inspection, followed by final checks:
`git status --short`, `git diff --name-status`,
`git diff --cached --name-status`, `git ls-files --others --exclude-standard`,
`git diff --check`, `git diff --cached --check`. Final scope is seven tracked edits,
six new documents and the untouched pre-existing untracked report. Staged diff remains
empty; whitespace checks pass. No new document is ignored by Git. New untracked
content was read directly without staging.

Temporary standard-library Python checks validate relative links and heading anchors
in all 13 task files, Markdown whitespace/newlines, complete-copy normalization and
all 12 FP plus seven M rows retaining NOT_RUN. All 204 local links/anchors resolve.
References to the pre-existing untracked product review are explicitly qualified;
that document was not adopted or staged and may be absent in another checkout.
Historical ignored-media and external research/provenance links were preserved,
not fetched or requalified. All named npm scripts exist in package.json.
AGENTS is 135 lines and 8,186 bytes, below 8 KiB, with detail linked.

Numerical/reference, browser, isolation, soak, benchmark, typecheck and build suites:
**not run: documentation-only scope**. No dependency installation, generated identity
command, server operation, runtime/test/fixture edit, nested runtime instruction,
staging/commit, push, PR, merge, deploy, publish or settings change occurred.

## Agent-reading self-review and next gate

One writer reviewed root instructions → authority/index → ledger → relevant design/
proof section and current guide. The path answers all eight brief questions: platform
versus organism/profile; subject authority; M5 before full users; complementary native
Pythia/MLP witnesses; canonical/oracle/evidence/state/quantitative-world invariants;
unimplemented capabilities and next gate; no authorization from old prompts/research/
passes; generating commands versus safe read-only documentation checks.
No independent reviewer/session was used. This establishes documentation consistency,
not that a fresh session loaded the instructions or that the foundation passed.

Next recommendation: start a fresh Codex session for renewed instruction discovery,
then explicitly authorize bounded M0/M1 preparation and the vertical slice in
[plan §8](../design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#8-practical-first-implementation-handoff),
with optional Python/dependency/weight/backend decisions explicit. The embedded prompt
was not executed; no API was frozen or foundation/user/release approval granted.
**STOP after D0.**
