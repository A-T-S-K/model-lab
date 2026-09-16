# M3-A registered intervention qualification

**Date:** September 16, 2026
**Starting source:** `56ed885db7176f589fa20be7c670003bada5634f` on `wave-1a-spatial`
**Qualified application runtime:** `sha256:ff03c8ff2a3120468a5e33da5a5ef0bae58f4ac48f48a810d5ee4bca58dedbb0`
**Disposition:** M3-A QUALIFIED within its bounded engineering scope. M3 remains IN PROGRESS; this is not full FP-07 or foundation acceptance.

## Change surface and archive migration

Reviewed build-time registrations now contribute `microgpt.head-ablation@1` and
`microgpt.donor-activation-patch@1`. Each contribution owns its identity, matched
comparison selection, writable boundary, executor binding, receipt validator and
presentation metadata. Imported records remain inert data and cannot register code.

`SessionArchive` now owns one `Map<string, InterventionExperiment>`. Common admission
validates immutable source/checkpoint, model, session/generation, arm/run, input/target,
lifecycle, declaration and comparison identities, then dispatches recipe-specific
receipt validation through the registry. The archive no longer imports or validates
`HeadAblationExperiment`, layer/head selection, zero replacement or donor semantics.
Unknown recipes, conflicting IDs, missing/rebound runs, failed/cancelled arms and
invalid matched-policy receipts are refused.

The common immutable experiment envelope distinguishes experiment and recipe identity,
source model/checkpoint/snapshot, donor/baseline/intervention arms, input/target identity,
declaration, applied receipt, comparison policy and lifecycle status. The existing
embedded baseline/intervention run fields remain as an explicit worker/API compatibility
path for head ablation.

## Comparison behavior

`compareRuns` is unchanged: model, input, targets, numeric policy, runtime version and
runtime revision remain strict compatibility requirements before occurrence-matched
artifact comparison. `matched-intervention@1` composes that strict comparison and adds
exact starting checkpoint/snapshot, an intervention-free baseline and exact declared
intervention identity. Its compatibility basis names the controlled difference as the
declared intervention only. A test demonstrates that a changed checkpoint remains
permitted by the existing fixed-input comparison but is refused by the matched-arm
policy.

## Head-ablation compatibility

Head ablation executes through the registered recipe and common archive lifecycle while
retaining its previous public fields and exact runtime boundary. Both heads, short and
maximum contexts, upstream Q/K/V/scores/weights, zeroed output, concat/projection,
no-change zero-head control and historical scalar binding remain covered. The retained
spatial and Guided browser routes pass, including the original `Experiment · head
ablation` disclosure and zeroed-head arithmetic.

## Donor activation witness

The deterministic witness uses accepted snapshot
`sha256:d1a46ae0fe2830a2bbcdc118913c5d974ef82e6acc2ef1004b5f8d0dae5b3ca1`,
canonical MicroGPT definition `14fb038816c7aae0bb9342c2dbf1a51dd134a5ff`, invocation
`0`, float64, coordinate space `microgpt.head-output.feature.v1`, axis `feature`, shape
`[4]`, and the boundary `head output immediately before concatenation`.

- Donor: donor run, token 0, layer 0, head 0.
- Target: intervention run, token 3, layer 0, head 1.
- Donor vector: `[0.254543150231965, 0.06938134691508649, 0.0008683820250374175, -0.0889923044886595]`.
- Unpatched target: `[0.08283650223773828, 0.23173317601487442, 0.2986313518985583, -0.38412493616646776]`.
- Patched target: exactly the donor vector; `headOutputBeforePatch` exactly equals the unpatched target.

The patched concatenation preserved head 0 and replaced only head 1. Its last four
coordinates are exactly the donor vector. Attention projection changed from
`[0.02175594910099697, 0.11664193966037961, -0.014576239495369077, -0.026607219090321738, 0.016052073278834615, -0.02258714671265517, 0.01969200776810929, -0.08204807136708397]`
to
`[0.11526950083789508, 0.05789005920507827, -0.015985566507019586, -0.057946237519036756, 0.025038115571022486, -0.009174525060804344, 0.05073107614371948, -0.04204633687223878]`.
The residual and logits changed, and target-position probabilities changed from
`[0.3591443770854818, 0.2294413153498612, 0.22375484996708614, 0.18765945759757102]`
to
`[0.36043041991102864, 0.2266674616450876, 0.22241610748713272, 0.190486010956751]`.
No benefit or harm is inferred.

The runtime remains ordinary native code: it computes the weighted head output, records
the pre-intervention value, applies one validated replacement at that boundary, records
the resulting observed `headOutput`, and continues through the existing concat and
projection. The donor vector is resolved from retained donor-run evidence; it is not a
recipe literal or stale mutable runtime value.

## Controls, lifecycle and state isolation

Focused tests passed a donor=target no-op with identical downstream numbers; wrong
run, invocation, checkpoint, token, layer and head; same-shape wrong coordinate basis;
observable-but-read-only boundary; unknown recipe; duplicate experiment ID; missing or
rebound immutable source; and failed/cancelled arm admission. Shape equality alone is
insufficient. The runtime also requires exactly one application.

The browser route passed explicit cancellation, injected execution failure and a late
stale completion after Public Reset. None admitted an intervention. The existing
worker generation and operation epoch remain the cancellation authority. After both
recipes, Return to current model restored the accepted run, and another canonical
Predict used the identical accepted snapshot. Unit evidence also rehashed and replayed
the untouched source after disposable work.

## Qualification commands and results

- `npm test`: 173 cases, 168 passed, 5 optional native-fixture skips, 0 failed. The
  sandboxed attempt first produced only two loopback-bind `EPERM` failures; the approved
  loopback rerun passed.
- `npm run test:reference`: 17 portable reference tests plus strict conformance passed;
  zero differing floats.
- `npm run test:reference:canonical`: byte-exact canonical regeneration passed.
- `npm run typecheck`: passed.
- `npm run example`: passed; canonical probability/loss/update output retained.
- `npm run build -- --outDir test-results/scratch/m3-a-qualification-20260916-f/build`:
  fresh protected Vite build passed at the qualified runtime identity.
- Focused intervention/archive/compare tests: 26 passed during implementation; the
  final full suite includes the same eight new M3-A cases.
- Exact-candidate Playwright in `test-results/scratch/m3-a-browser-20260916-i`: five
  cases passed: two M3-A routes, two retained spatial head-intervention/lifecycle
  routes and the retained Guided head-ablation history route.

The first browser pass exposed a hidden donor button while the lens was open; the
bounded CSS repair made both registered actions reachable. Retained-route review then
exposed the need to carry the legacy ablation declaration into the spatial explanation
and preserve the existing disclosure label; both were repaired and the retained routes
passed on the exact final build.

## Visual review

The exact-candidate screenshots are under
`test-results/scratch/m3-a-browser-20260916-i/evidence/`: the 1920×1080 view shows the
donor/target identities, exact vectors, effective replacement, policy, baseline/patched
probability deltas and continuous downstream world together. The 1280×720 reduced-motion
view keeps the receipt and comparison readable with the existing compact world/lens
layout. No new dashboard or copied scene was introduced.

## Unrun scope and next dependency

Per the task boundary, no Pythia native rerun, broad CI, benchmark, soak, installation
isolation, aggregate acceptance, unfamiliar-user test, deployment or release exercise
was run. No model replacement, composite branch, data/security recipe, correlation,
generation/cache, M4, M5 or M6 work was started. The next concrete M3 dependency is
M3-B: actual qualified model variants/replacements under their own comparison policy;
M3-C remains responsible for data/security recipes.
