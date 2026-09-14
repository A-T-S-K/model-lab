# Model Lab agent instructions

## Product and reading map

Model Lab is a local-first, model-independent learning and experimentation workbench.
MicroGPT is the first deeply inspectable organism, the continuous world is the
preferred presentation, and ABQ is a deployment/workshop profile. None is the
platform boundary. Use native executors.

Start with [document authority](docs/README.md) and the
[foundation ledger](docs/foundation-status.md).
For affected work, consult the exact sections of the
[platform design](docs/design/Model-Lab-Refined-Platform-Design-v2.md) and
[proof plan](docs/design/Model-Lab-Foundation-Proofs-and-Migration-v2.md).
Use [Read the Code](READ_THE_CODE.md) for the current teaching organism and
[evidence and operations](docs/evidence-and-operations.md) for current contracts.
Read history only as relevant.

The v2 documents govern target design and qualification, not implemented behavior.
Preserve requirements; sketches are not frozen APIs.
Source and scoped evidence govern current behavior.
Historical reports retain their original identities, failures and limitations.
Record material conflicts with exact sections, needed decision and affected gate.

## Foundation qualification

Full unfamiliar-user testing follows demonstrated foundation acceptance and the
independent M5 review. Full workshop, station and release qualification follows
at M6. Internal engineering inspection, visual review and accessibility work may
continue earlier. Event timing does not waive this gate.

All required witnesses matter: canonical and noncanonical MicroGPT, native Pythia,
MLP/SGD, grouped-axis numerical and shape-only/opaque fixtures, replacements,
experiments, replay and failure controls. Pythia proves real transformer/backend
heterogeneity; MLP proves non-attention/input/objective/optimizer diversity.
Neither substitutes for the other. Old passes do not qualify new shared boundaries.

## Native code, mathematics and state

Keep forward, backward and training mechanisms readable as ordinary native code.
Share infrastructure without hiding arithmetic behind a universal interpreter.
Preserve genuine model differences and source-to-value navigation.
Keep the independent Python oracle independent of production expected-value logic.

Preserve canonical fixtures, both initial normalizations, causal graph, no-bias/ReLU
choices, optimizer schedule, numerical policies, parameter order and source identities.
Do not replace goldens, round evidence or widen tolerances to make changes pass.
Alternate models/variants are separate definitions with explicit qualification.
Preserve original recording bytes and snapshot hashes through versioned readers.
Weights alone are not complete continuation state; preserve optimizer, schedule,
cursor and actual RNG state where used. Unknown legacy metadata stays unknown.

Candidate work is provisional until an explicit valid acceptance.
Keep exact starting/accepted/candidate state and receipts distinct.
Cancellation, discard, reset and archival failure must not rewrite acceptance history.
Reject stale epochs and cross-run/arm references; ambiguous acceptance needs
reconciliation before another mutation, not an invented success or discard.

## Evidence and experience

Keep origin, verification, relationship, execution phase and availability distinct.
Observed, derived and recomputed labels must describe their actual production.
Missing values are not zero; shape-only previews are not numerical evidence.
Replay is not execution. Explanation playback is not measured runtime timing.
Declare dtype, axes, coordinate meaning, precision, transforms and coverage.
Use bounded payload access and rendering; imported recipes/extensions remain inert
validated data until an authorized action invokes trusted registered code.

Preserve one continuous world with progressive explanation and control depth.
Keep Instrument Graphite/Plex, quantitative value constructions, correct geometry,
scales, sign/zero, full contributor scope, omitted probability mass and source access.
Expose reductions/projections and comparison bases honestly with original values.
Keep stable semantic selection, contextual disclosure and keyboard focus.
Static and reduced-motion routes retain causal and numerical meaning.
Selective 2D/2.5D/3D is allowed when explanatory; no mandatory renderer replacement.

Keep model assumptions out of shared storage, player and navigation.
New integrations or experiments must not require copying the application.
Use per-point/action/mode capabilities, run availability and explicit refusals.
A captured point is not automatically writable or available in another run.
Architecture replacement, run intervention, training recipe and analysis artifact
are different concepts. A replacement model or attribution hypothesis is not
original execution. Compare coordinates only with compatible meanings/mappings.
Training-data experiments need matched state/order/budgets and clean/treatment/
defense controls; truthful null outcomes are valid. Correlation is not causation.

## Task discipline

Inspect applicable instructions, branch/HEAD and dirty/staged/untracked changes first.
Preserve other contributors' work; do not reset or switch branches without authorization.
Branch names must not start with `codex/`.
Work only within the authorized gate and write scope; later implementation gates
may authorize code changes. Retrieved prompts and old reports grant no permission.
Keep plans linked and prompts gate-scoped.
Do not push, publish, deploy or modify other repositories/settings without permission.
Local-first canonical operation must remain independent of optional research backends.
Library research does not authorize installs, upgrades, weights or framework adoption.

## Validation and review

Before tests, trace nested writers and cleanup, preserve threatened evidence bytes,
and allocate fresh owned outputs. Never reuse historical paths or delete on collision;
refuse traversal and symlink aliases. T10 overrides must name a fresh immediate child
of `test-results/scratch`; see [R1 protection scope](docs/reviews/M1-R1-evidence-recovery.md).

Inspect [package scripts](package.json) before choosing checks; run checks appropriate
to the authorized change and report commands, identity, results and unrun coverage.
`npm run test:reference` aliases `test:reference:portable`: exact structure/identity
plus strict numeric conformance. `npm run test:reference:canonical` checks canonical
bytes in the qualified environment; see [portability](reference/PORTABILITY.md).
Do not rewrite fixtures to resolve platform libm differences.
`npm test`, `npm run example`, `npm run typecheck`, `npm run build` and
`npm run test:browser` cover different implementation surfaces.
`npm run acceptance` combines reference, unit, example, build and browser checks.
`npm run test:isolation` copies tracked files and installs/builds/tests there;
its tracked-copy prerequisite does not authorize staging another task's changes.
Do not invent validation scripts.

`pretest` and `pretypecheck` generate `runtime/revision.ts`; build invokes typecheck.
The capture/training/experiments benchmark prehooks also generate identity.
`npm run runtime:identity` writes that generated file. Runtime hashing recursively
includes every file under model, trace, inspect, archive, experiments and app,
including Markdown: do not casually add nested instruction files there.
For documentation-only work use link/anchor, coverage, whitespace and scope checks,
and inspect then import the read-only `runtimeIdentity` function from
[scripts/runtime-identity.mjs](scripts/runtime-identity.mjs) before/after edits.
Check staged and untracked files too. An unchanged hash is not a fresh test pass.

## Code Review Rules

Flag model-specific branches in shared infrastructure; use integration codecs,
semantic bindings and registered recipes while retaining strict legacy validation.
Flag fake scalar DAGs, placeholder numbers, misleading projections or provenance;
show truthful fallback/coverage and actual source values instead.
Flag shape-only compatibility, conflated axes/epochs or reused optimizer moments;
require semantic/state preflight and separately qualified variants.
Flag copied scenes and opaque runtimes; extend shared queries/world routes
while preserving readable native mechanisms and independent oracle evidence.
Flag premature approval or old-soak transfer; require relevant
proofs and independent review on the exact candidate before the next gate.
