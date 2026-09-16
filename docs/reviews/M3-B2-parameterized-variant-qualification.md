# M3-B2 parameterized-variant qualification

**Date:** September 16, 2026

**Starting source:** `baa2c48271e13fa872bca5306c5064a892160922` on `wave-1a-spatial`

**Qualified application runtime:** `sha256:64213684aa0176ddd8dfdca3c3e25ababcd068a9a322170921a7318fe1c18e33` (114 runtime inputs)

**Disposition:** M3-B2 QUALIFIED within its bounded engineering scope. Together with qualified M3-B1, this completes the executable implementation proof required by FP-06. M3 remains IN PROGRESS pending M3-C and integrated M3 qualification; M5 and foundation acceptance remain pending.

## Registered definition and readable execution

The reviewed build-time registry now contains canonical MicroGPT, the retained B1
Leaky ReLU variant and `microgpt.composite-mlp@1`. The new definition is based directly
on canonical `microgpt@14fb038816c7aae0bb9342c2dbf1a51dd134a5ff`; it retains
canonical ReLU and replaces only `mlpDown` with native readable arithmetic:

```text
base = W x
ax = A x
bax = B ax
adapter = 0.5 * bax
composite = base + adapter
```

The definition fixes bottleneck width 2 and scale `s = 0.5`. Neither was tuned to an
outcome. `forwardSequenceForDefinition` still contains ordinary linear, scaling and
addition code. No graph interpreter, arbitrary scheduler or executable imported state
was added.

## Parameter schema, initialization and policy

The definition declares these binary64 parameters and coordinate bases:

| Name | Owner | Shape | Input basis | Output basis | Policy | Initialization |
| --- | --- | --- | --- | --- | --- | --- |
| `layer0.mlp_adapter_a` | `mlpAdapterA` | `[2,32]` | `microgpt.mlp-activation.feature.v1` | `microgpt.adapter-bottleneck.feature.v1` | trainable / Adam member | `A[r,c] = ((((r+1)*(c+1)) mod 7)-3)/64` |
| `layer0.mlp_adapter_b` | `mlpAdapterB` | `[8,2]` | `microgpt.adapter-bottleneck.feature.v1` | `microgpt.embedding.feature.v1` | trainable / Adam member | exact zero |

All inherited canonical parameters, including `layer0.mlp_fc2` (`W`), are frozen and
not optimizer members. Scale is an immutable definition constant, not a parameter.
Initialization mapping
`microgpt.canonical-plus-deterministic-composite-branch@1` produced receipt
`sha256:7a939260f81171f01522c95301d99a4b9852a02316679ffe4e97b8f5c4132ab2`
and initial variant state
`sha256:5c2763d49e6a387fe7d08adff7fb5ba44335336ab143ce4a8985974e3008eb0d`.

At initialization every B value, `B(Ax)` value and scaled adapter value was exactly
zero. Every composite component equaled the inherited `W x` component exactly, and
MLP residuals, logits and probabilities equaled canonical evidence exactly.

## Definition-aware state and optimizer

`microgpt.composite-variant-state@1` is a separate inert-data codec. It binds the
variant definition/version, immutable canonical base checkpoint, initialization
receipt, exact parameter schema and bases, A/B values, frozen/trainable policy,
binary64 numeric policy, Adam configuration/dynamics and continuation cursor/RNG
state. The state hash covers the complete validated record. Restore requires the exact
base snapshot and selects reviewed build-time code by definition identity.

The canonical snapshot validator in `archive/snapshot.ts` is unchanged. It still
requires the exact canonical parameter names/count and canonical moment lengths, and
refuses variant-shaped state.

The variant Adam group order is exactly
`[layer0.mlp_adapter_a, layer0.mlp_adapter_b]` (80 scalars). Configuration-only values
copied from the source snapshot are learning rate `0.01`, beta1 `0.85`, beta2 `0.99`,
epsilon `1e-8` and schedule length `1000`. A/B moments start as new zeros. Canonical
moments are neither copied nor appended. Dataset cursor and unused RNG state are also
newly initialized to zero/null for the fixed variant sequence rather than copied.
Canonical-to-variant initialization is not described as an exact training continuation.

## Backward, update and exact-resume witnesses

The deterministic `abca` witness used token 0, layer 0. Loss reached composite output
component 0 with adjoint `-0.016438555708163355`.

- First step: A gradients were exactly zero as required by zero B. B parameter
  `[0,0]` had gradient `9.366387711925626e-7` and changed from `0` by
  `-0.00989436308437481`.
- Second step: after B became nonzero, A parameter `[0,0]` had gradient
  `-0.000007180760470444682` and changed from `-0.03125` by
  `0.007602701781575794` to `-0.023647298218424206`.
- No inherited parameter changed across initialization, forward, backward, both
  optimizer steps, save or restore.

The saved step-1 state was
`sha256:a361e83e346100799c028ac0a91fee6fadf94a8d52638f64b4fe861a7d726045`.
Uninterrupted step 2 and decode/validate/restore plus step 2 both produced exact state
`sha256:1a9ae9fe138f79f21d2344a45044c5eecef30262cf37f8c42fedcdbff14a4ebc`.
A values, B values, both moment arrays, optimizer step 2, dataset cursor 2 and the
fixed-input prediction were exactly equal; no tolerance was used.

## Exact arithmetic witness

For token 0, layer 0, bottleneck component 0 and output component 0, retained trained
operands establish:

```text
A_row · x                  = 0.02873449610095671
B_row · Ax                 = 0.00028221062261916366
0.5 * B_row · Ax           = 0.00014110531130958183
-0.0016265472965288595
  + 0.00014110531130958183  = -0.0014854419852192778
```

The evidence record retains all 32 A dot-product terms, both B dot-product terms, the
actual parameter rows and activation vector. These values come from executed artifacts
and the bound variant checkpoint, not UI literals. After training, the adapter branch,
composite output and downstream distribution all changed authentically; no benefit or
harm is inferred.

## Semantics, source, ownership and comparison

The continuous world exposes distinct `mlpBaseDown`, `mlpAdapterA`, `mlpAdapterB`,
`fixedAdapterScale`, `mlpAdapterScaled`, `mlpCompositeDown` and downstream residual
nodes in a split/merge layout. The inspector binds W to the frozen base branch, A/B to
their trainable projections, and scale to a fixed non-optimizer declaration. It shows
definition, state identity, exact matrix value, shape, axes, coordinate bases and
optimizer membership.

A and B projections bind to executed `linear`; scaling binds to
`scaleCompositeAdapter`; merge binds to `addCompositeBranches`. The UI derives dot
products only from retained parameters and observed activations and labels the
calculation accordingly.

Strict `compareRuns` remains unchanged and refuses the definition difference with
`model differs`. Registered `matched-variant@1` maps unchanged upstream points,
`mlpDown/output` to `mlpCompositeDown/output`, and compatible downstream residual,
logit and probability points. Base, A, B and scaled-adapter artifacts are reported as
variant-only, with no fabricated canonical counterpart.

## Refusal and preservation controls

Focused tests refuse unknown target definitions; wrong base definition/checkpoint;
float32 substitution; missing A or B; wrong A/B shape; same-size renamed parameter;
same-shape wrong coordinate basis; reordered schema; invalid rank/scale; nonfinite
parameter data; wrong optimizer family/order/moment length; frozen W in the optimizer;
another model definition; another base checkpoint; tampered initialization/state hash;
variant state through the canonical codec; and canonical moments as B2 continuation.
Definitions and saved state contain bounded plain data only—no closure, module path,
command or source-text execution surface.

The immutable canonical source remained
`sha256:d1a46ae0fe2830a2bbcdc118913c5d974ef82e6acc2ef1004b5f8d0dae5b3ca1`
before and after the full witness. Returning from the browser route restored the live
accepted canonical run, and another Predict returned the byte-identical snapshot.

## Qualification commands and results

- Focused B1/B2 integration during implementation: 18/18 passed; final full suite
  includes 10 focused B2 cases and all retained B1 cases.
- `npm test` with loopback permission: 191 cases, 186 passed, five optional native
  fixture skips, zero failed. The first sandboxed pass had only the two expected
  loopback `EPERM` failures; the authorized rerun passed.
- `npm run test:reference`: 17 portable reference tests and strict numerical
  conformance passed; zero differing floats.
- `npm run test:reference:canonical`: byte-exact canonical regeneration passed.
- `npm run typecheck`: passed at the qualified runtime.
- `npm run example`: passed with canonical probability/loss/update output and 896
  updated canonical parameters.
- `npm run build -- --outDir test-results/scratch/m3-b2-candidate-20260916-n/build`:
  fresh protected candidate build passed. Original `dist` and the ABQ kit were not
  used or changed.
- Exact-candidate Playwright under
  `test-results/scratch/m3-b2-browser-20260916-o`: 12/12 passed—the focused B2 route
  at 1920×1080 and 1280×720/reduced motion, both retained M3-A routes, M3-B1, Wave
  1A/B, all three Wave 1C cases, spatial learning, paced Wave 1B and paced Wave 1D.
  An earlier run exposed a stale Wave 1B locator that omitted its existing explicit
  `L0` label; the layer-aware locator is part of this exact passing candidate and the
  failed intermediate output remains preserved.

## Visual evidence

Final focused evidence is under
`test-results/scratch/m3-b2-browser-20260916-o/evidence/test-CFtBCA/`.
The 1920×1080 image shows the retained state/arithmetic receipt, canonical-vs-composite
distribution comparison, real split/merge world and frozen W ownership together. The
1280×720 reduced-motion image verifies compact receipt, comparison and interaction
controls. The stronger split/merge visual is the 1920×1080 view; no separate app,
dashboard, graph editor or copied scene was introduced.

## Unrun scope and next dependency

Per the task boundary, no Pythia native rerun, broad CI, benchmark, soak, installation
isolation, aggregate acceptance, unfamiliar-user test, deployment or release exercise
was run. No M3-C data/security recipe, correlation fixture, M4, M5 or M6 work was
started.

Next dependency: M3-C data/security experiment recipes and then integrated M3
qualification. M3 remains IN PROGRESS.
