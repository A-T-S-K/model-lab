# M3-B1 activation-variant qualification

**Date:** September 16, 2026
**Starting source:** `9f30b50171497bf5bf4c15f700747098e1096973` on `wave-1a-spatial`
**Qualified application runtime:** `sha256:0de2c0c15e5e6e88aea80aaeb0a857c3e7c9b69a763da4c8ac919803bbcaa9ce` (112 runtime inputs)
**Disposition:** M3-B1 QUALIFIED within its bounded engineering scope. The simple activation-replacement portion of FP-06 is qualified; FP-06 and M3 remain IN PROGRESS pending M3-B2's composite parameterized branch.

## Registered definition and execution boundary

`ModelDefinitionRegistry` owns reviewed build-time registrations for canonical
`microgpt@14fb038816c7aae0bb9342c2dbf1a51dd134a5ff` and variant
`microgpt.leaky-relu@1`. The definition contribution declares only the exercised
activation binding, replacement, capabilities, initialization policy and comparison
correspondence. The readable native forward remains explicit linear → selected
activation → linear code; there is no graph interpreter or imported executable code.

The model-only package remains independently executable. Definition metadata and the
native scalar binding stay under `model/`; definition-aware checkpoint initialization
and cross-definition comparison live under `experiments/`. The full suite's Git-free
model-only and source-isolation tests caught and enforced this boundary during
implementation.

Canonical execution still calls `Value.relu()` and records `mlpRelu`. Variant execution
calls `Value.leakyRelu(0.01)` and records `mlpLeakyRelu`. Canonical fixtures, oracle,
goldens and `archive/snapshot.ts` were not changed.

## Activation and derivative declaration

The immutable variant definition declares exact binary64 `negativeSlope = 0.01` and:

```text
f(x) = x       when x > 0
       0.01*x  otherwise
```

The local derivative is `1` when `x > 0` and `0.01` otherwise. Therefore the explicit
zero convention is `f'(0) = 0.01`; it is not inherited from a framework. Focused scalar
tests execute positive, negative and zero inputs through the real `Value` operation and
reverse-mode autodiff. Nonfinite, zero, negative and ≥1 slopes are refused.

## Checkpoint and state compatibility

The canonical accepted snapshot is
`sha256:d1a46ae0fe2830a2bbcdc118913c5d974ef82e6acc2ef1004b5f8d0dae5b3ca1`.
The registered mapping
`microgpt.canonical-parameters-to-leaky-relu@1` validates that exact source hash,
canonical definition, numeric policy, every required parameter, exact shape, and exact
ordered source/target name mapping. It produces distinct variant initialization
checkpoint `sha256:ea92e5d325ce1561965bdcfa65581268a047a6e6e699342a8a68259578daf268`.

The mapping policy is `parameter-initialization-only`; `exactTrainingResume` is false.
Variant backward evidence is disposable. Canonical optimizer moments, schedule, cursor,
RNG state, accepted history and snapshot remain unchanged. The separate variant
admission path does not use or weaken the legacy run/snapshot codec.

## Numerical and backward witness

The deterministic canonical `abca` teacher-forced input contains both signs at token 0,
layer 0. The complete `mlpUp` vector matches exactly across definitions. Selected exact
elements are:

- positive index 0: input `0.4053719943322193`; canonical and variant output
  `0.4053719943322193`; local derivative `1`;
- negative index 1: input `-0.09757900640020112`; canonical ReLU output `0`; variant
  output `-0.0009757900640020112`; local derivative `0.01`;
- the real model loss gives that negative Leaky ReLU occurrence child adjoint
  `-0.003480925659825189` and backward contribution
  `-0.00003480925659825189`.

Authentic downstream values at the same occurrence changed:

- `mlpDown` canonical
  `[-0.0016265472965288595, -0.04223528509491428, -0.03801647134007404, -0.054709309714069156, 0.061687892669258046, -0.07523647982886439, 0.00890119128860142, 0.07042532738160001]`;
- `mlpDown` variant
  `[-0.0016934327658595758, -0.04144642776954529, -0.038108510178778074, -0.05388076329721796, 0.061194941596092636, -0.07393258406561756, 0.010261239859041291, 0.07049932473579448]`;
- probability index 0 changed from `0.2704975187813897` to
  `0.2704389828864514`; the residual, all four logits and probability vector also
  differ in retained observed evidence. No direction, quality or improvement claim is
  made.

## Semantics, source and comparison

The variant reuses the canonical continuous-world layout while contributing a distinct
`mlpLeakyRelu` semantic node and downstream dependency. The world contains no
`mlpRelu` node for the variant. It renders actual observed negative activation values,
the distinct model-definition identity and mapped source checkpoint.

`mlpLeakyRelu` binds to `model/value.ts · Value.leakyRelu`; the source excerpt,
definition declaration, runtime operation name, semantic descriptor, derivative
evidence and comparison mapping all name the same Leaky ReLU operation.

`compareRuns` is unchanged and refuses the definition difference with `model differs`.
The purpose-specific `matched-variant@1` policy requires the exact registered source
and target definitions, source checkpoint/snapshot mapping, mapped variant checkpoint,
input, targets, numeric policy, runtime and explicit semantic point correspondence. It
records unchanged upstream points, the sole
`mlpRelu/output ↔ mlpLeakyRelu/output` replacement and downstream comparable points;
the qualified run contains 120 mapped occurrences.

## Refusal controls and preservation

Focused tests refuse unknown target definitions, wrong base definition, wrong source
checkpoint, unregistered mappings, missing parameters, altered shapes, same-size but
renamed/reordered mappings, incompatible numeric policy, invalid/NaN/infinite slopes,
an undeclared replacement node, missing/tampered initialization provenance and any
attempt to claim exact cross-definition training resume.

The canonical snapshot content hash was checked before and after disposable variant
forward/backward and archive admission. A fresh canonical prediction after returning
from the browser variant used the byte-identical accepted snapshot. Canonical Predict,
learning, backward, Adam, candidate lifecycle, source, replay, M3-A interventions and
continuous-world navigation passed their retained tests.

## Commands and results

- Focused model/variant/M3-A/autograd/spatial tests: 40/40 passed before integration;
  model-only/trace/variant boundary retest: 18/18 passed.
- `npm test` with required loopback permission: 181 cases, 176 passed, five optional
  native-fixture skips, zero failures. The initial sandboxed run had two expected
  loopback `EPERM` failures and exposed model-only/trace dependency violations; those
  architectural violations were corrected before this passing rerun.
- `npm run test:reference`: 17 portable reference tests and strict numerical
  conformance passed; zero differing floats.
- `npm run test:reference:canonical`: byte-exact canonical regeneration passed.
- `npm run typecheck`: passed.
- `npm run example`: passed with canonical probability/loss/update values and 896
  updated parameters.
- `npm run build -- --outDir test-results/scratch/m3-b1-qualification-20260916-d/build`:
  fresh protected exact-candidate build passed. Original `dist` was not used or changed.
- Exact-candidate Playwright under
  `test-results/scratch/m3-b1-browser-20260916-j`: 11/11 passed—the M3-B1 route, both
  retained M3-A routes, four canonical spatial explanation/navigation routes and four
  controlled-learning routes.

## Visual evidence

The final 1920×1080 evidence is under
`test-results/scratch/m3-b1-browser-20260916-j/evidence/test-PPsPa8/`:

- `m3-b1-leaky-source-1920.png` shows the variant definition/checkpoint/comparison
  receipt, the Leaky ReLU world node, real negative activation bars and mapped output
  comparison;
- `m3-b1-leaky-relu-1920.png` shows an authentic downstream probability delta and
  matched canonical/variant output readout;
- `m3-b1-browser-evidence.json` retains the exact source/target identities, mapping,
  witness and immutable before/after canonical snapshots.

The route also asserts the bundled `Value.leakyRelu` source text directly. No new
small-screen interaction was introduced; a separate reduced-motion visual pass was not
needed for this bounded developer action.

## Unrun scope and next dependency

Per the task boundary, no Pythia native rerun, broad CI, benchmark, soak, installation
isolation, aggregate acceptance, unfamiliar-user test, deployment or release exercise
was run. No adapter matrices, new persistent optimizer/state format, parameter groups,
free-form graph editor, data/security recipe, correlation fixture, M4, M5 or M6 work
was started.

Next dependency: M3-B2 must use this definition boundary to qualify the composite
parameterized branch `W x + s B(Ax)`, including new parameter ownership,
initialization and variant-specific optimizer/state codec. M3 and FP-06 remain open.
