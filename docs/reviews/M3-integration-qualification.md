# M3 integrated variant and experiment qualification

**Date:** September 16, 2026

**Starting source:** `d0f52d1604996b2edcb526ed2475b9c40aec69ee` on `wave-1a-spatial`, equal to the live local `origin/wave-1a-spatial` tracking ref before work

**Qualified application source:** `f460c4fc8b096e1e5920a24fe3771a9268cdcbaf`

**Qualified application runtime:** `sha256:fcb5284439b830cab7a1091f451e346f85c4f5084cbd19dd4613d13356075d8f` (118 runtime inputs)

**Disposition:** `M3 = COMPLETE — scoped engineering qualification`. This closes only the M3 engineering gate for registered interventions, actual model-definition replacements, definition-aware variant state, matched data/security experiments, correlation, and their integrated lifecycle/change surface. M4, independent M5/foundation acceptance, M6, release readiness and full unfamiliar-user testing remain ungranted.

## Qualified portfolio and inherited identities

This review freshly integrated, rather than repeated in full, the bounded qualified increments:

- M3-A at report source `9f30b50171497bf5bf4c15f700747098e1096973`, runtime `sha256:ff03c8ff2a3120468a5e33da5a5ef0bae58f4ac48f48a810d5ee4bca58dedbb0`: registered head ablation and donor activation patch through `matched-intervention@1`.
- M3-B1 at application source `baa2c48271e13fa872bca5306c5064a892160922`, runtime `sha256:0de2c0c15e5e6e88aea80aaeb0a857c3e7c9b69a763da4c8ac919803bbcaa9ce`: registered Leaky ReLU definition, explicit initialization and `matched-variant@1`.
- M3-B2 at application source `eb0d9292b0f9571ff5683a5bb4155c5c3966970a`, runtime `sha256:64213684aa0176ddd8dfdca3c3e25ababcd068a9a322170921a7318fe1c18e33`: composite `W x + 0.5 B(Ax)`, A/B ownership, separate state and exact same-variant resume.
- M3-C at application source `b7676e60cd1c5540f2b451f148b8babcd2d0c658`, report/ledger source `d0f52d1604996b2edcb526ed2475b9c40aec69ee`, runtime `sha256:6b079bc9d22cc1b1607cdc821d8783a764551dbc8a6d6d611827598f951ed4a4`: registered matched data substitution, `matched-training-arms@1`, deterministic allowlist context and explicit correlation.

The canonical accepted snapshot throughout the integrated witness was `sha256:d1a46ae0fe2830a2bbcdc118913c5d974ef82e6acc2ef1004b5f8d0dae5b3ca1`.

## Fresh archive and change-surface finding

The required attack found a real M3 extension-boundary defect. `SessionArchive` imported both concrete variant receipt types, retained activation and composite variants in separate maps, and exposed `addModelVariantExperiment()` plus `addCompositeVariantExperiment()`. A third model-definition replacement would therefore have required another shared archive collection, imported concrete type and admission method.

The bounded repair adds one stable `ModelVariantExperiment` archive envelope and a reviewed build-time `ModelVariantExperimentRegistry`. The two real receipt families register their target definition, validator and retained variant-run projection. `SessionArchive` now owns one `modelVariantExperiments` map and one `addModelVariantExperiment()` method. Common admission validates identity, registered target definition, source snapshot, canonical baseline, duplicate experiment/run identities and target-definition run identity before committing any run or receipt. Activation-specific declaration/lifecycle rules remain in the B1 validator; composite parameter/state/optimizer/resume rules remain in the B2 validator. No sparse union of optional receipt fields was introduced.

A future model variant now changes its concrete definition/executor/receipt validator, optional state codec and comparison mapping, tests, optional presentation and one build-time registration. It does not require a new archive map, method or generic session branch. Runtime interventions and data experiments correctly remain separate registered families because their arm/lifecycle and lineage contracts differ.

The concrete identifier audit found the six requested IDs only in definition/recipe registrations and their owned implementations. Generic archive, evidence store, player and comparison dispatch do not branch on them. Presentation still distinguishes the two existing variant receipt shapes through explicit type guards; that is bounded optional presentation, not archive admission. Imported records can select only already registered trusted contributions and remain unable to register code.

## Integrated lifecycle and isolation

The focused integration test executed head ablation, donor patch, activation variant, composite variant and matched data work from the same immutable canonical source and admitted all four experiment families into one archive. After every family, the complete source serialization, snapshot hash and fresh canonical prediction remained exact. Final archive counts were two intervention receipts, two model-variant receipts and one data receipt, with independent retrievability and no insertion-order dependency.

The browser route repeated the user-visible sequence, returned to accepted state after each family and ended with another canonical Predict. The before/after accepted snapshots were byte-identical. No intervention arm, variant checkpoint/state or clean/treatment/defended final snapshot became accepted application state. Family-specific receipts, adapter selection and external policy context disappeared at incompatible return boundaries.

A cross-family model-variant ID collision was refused before either composite variant run was published. Unknown imported variant families were refused while the retained activation receipt remained available. Existing failed/cancelled intervention and incomplete/tampered data/variant controls remained green. The fresh browser controls additionally held and cancelled an intervention, reset a held data worker, and injected a late data completion after worker/generation invalidation; no successful receipt or alert was published and canonical Predict remained available.

The M3 return/cancel audit found one accessibility/state defect: a focused family-specific return button disappeared after rerender without a meaningful focus destination. All M3 return/cancel paths now restore focus to canonical Predict. The integrated route exercises mouse and keyboard activation and asserts this focus restoration.

## Comparison, identity, state and provenance

Purpose-specific policies remain separate:

- `compareRuns` is unchanged and strict for definition/input/target/numeric/runtime compatibility;
- `matched-intervention@1` applies only to controlled runtime intervention arms;
- `matched-variant@1` requires a registered definition relationship and explicit checkpoint/semantic mapping;
- `matched-training-arms@1` remains experiment-level training lineage integrity.

Applying `matched-variant@1` to clean-versus-treatment data-evaluation runs refuses because the target is not a registered model variant. No smart comparison dispatcher was added.

Runtime intervention identity still names the exact writable occurrence. Variant identity includes definition plus mapped initialization/state. Data identity includes arm, step and learning/run/snapshot lineage. External policy records remain independently hashed application/trust context outside neural semantic addresses. Screen labels, shape, parameter count, timestamps and array position are not admitted as identity.

Source/provenance remained family-specific: ablation names the zeroed head-output boundary; donor patch retains donor and target occurrences and the pre-patch value; Leaky ReLU binds to executed `Value.leakyRelu`; composite evidence distinguishes W, A, B, fixed scaling and merge; data model runs bind to ordinary model/training source while allowlist records remain external context. The presentation keeps the M3-C measurements neutral and continues to state that correlation is not causation and that no categorical efficacy threshold is declared.

B1 remains initialization-only and cannot claim exact canonical-to-variant continuation. B2 remains initialization-only from canonical but exact for same-definition saved-state continuation. Composite state is refused by the unchanged canonical format-1 validator; the integrated test again passes composite state to that validator and receives an explicit refusal. No shared helper broadened codec compatibility or reused canonical optimizer moments.

## Capability, historical inspection and public isolation

Only the registered head-output intervention boundary is writable; observed evidence does not create a generic write surface. Model variants execute as separate definitions, not mutation of accepted canonical state. External policy records cannot mutate model evidence. No Pythia/fallback or import path gained write capability.

Completed M3 receipts remain inspectable from retained session evidence without automatic rerun. This is session-local retention only. Durable cross-session export/import of the full M3 portfolio remains M4 work and is not claimed here.

The final browser matrix cleared the developer session and verified no stale intervention, variant, adapter or data receipt survived. A kiosk/attract reload issued no M3 command. A separate Guided route retained the canonical target/lesson and issued no M3 command or receipt. Reduced motion changed no semantic state.

## Readable-code review

Canonical MicroGPT remains ordinary TypeScript. The activation replacement still calls the explicit scalar Leaky ReLU operation. The composite path still executes readable `W x`, `A x`, `B(Ax)`, scaling and addition. Interventions remain narrow registered boundaries, and the data experiment still invokes ordinary training and prediction code. Registries select reviewed implementations; there is no universal graph or experiment interpreter.

## Commands and results

- Focused M3 archive/variant/intervention/data matrix: 33/33 passed before the final refinement; the exact final full suite includes the same coverage. A final direct B1/B2/M3-D retest passed 20/20 after replacing the temporary concrete union with the stable common envelope.
- `npm test`: 198 cases, 193 passed, five optional native-profile skips, zero failed.
- `npm run test:reference`: 17 portable tests and strict conformance passed; zero differing floats.
- `npm run test:reference:canonical`: byte-exact canonical regeneration passed.
- `npm run typecheck`: passed, including as the protected build prehook.
- `npm run example`: passed with canonical probability/loss/update output and 896 updated parameters.
- `npm run build -- --outDir test-results/scratch/m3-d-build-20260916-b/build`: fresh protected exact-runtime build passed. The non-failing chunk-size advisory remains. Original `dist` was not used or changed.
- Final Playwright under `test-results/scratch/m3-d-browser-20260916-h`: 9/9 passed—representative M2-A canonical/multilayer state isolation, both M3-A routes, M3-B1, M3-B2, M3-C, the integrated M3-D lifecycle route, fresh data cancel/late-result control, and Guided/attract isolation.

The first sandboxed browser attempt at `m3-d-browser-20260916-a` stopped at the expected loopback `EPERM`. The first permitted integrated run at `m3-d-browser-20260916-b` completed all M3 work and failed only because the test expected the kiosk-only `#exhibit-start` after a non-kiosk reset. That output was preserved; the assertion was corrected to the actual non-kiosk reset contract and an explicit kiosk reload/no-M3-command assertion was added. Subsequent focused and final matrices passed. No failed result was rewritten as success.

## Visual and accessibility inspection

Exact final M3-D captures are under `test-results/scratch/m3-d-browser-20260916-h/evidence/test-CzkDQ5/`. Review covered head ablation, donor patch, Leaky ReLU, composite split/merge and ownership, the three-arm model/context layout, and final canonical return. At 1920×1080 critical controls, source/provenance distinctions, comparison bases and frozen/trainable ownership were readable without clipping. At 1280×720/reduced motion the bounded data receipt retained clean/treatment/defended meaning and model-versus-external-context separation; canonical return remained usable.

Scoped accessibility checks covered keyboard activation, meaningful action labels, selected-state removal, focus restoration after every family return/cancel, visible focus, and reduced-motion semantic equivalence. This was not a full WCAG or screen-reader audit.

## Preservation, unrun scope and next dependency

The pre-existing untracked `docs/abq-product-review.md` remained untouched at SHA-256 `3b3ce80ff120ff1ac8cdde48f231742b1c555b9d97dab6126a30d65645ef9966`. Original `dist/index.html` remained `03eb88584f2ec4dab934917bad6ffe16d6abac6c22a474613e5b5e62bd17cf8e`; canonical fixture and independent Python oracle remained `09670a2658a3bca2f7204927cdd41f8559fdd360d180533698a9857a4863b056` and `4fd8aa885b41c246fab03cda248b52bfcfdb42d8979156239f388e464fa445e2`. Fresh task-owned build/browser roots were used; historical evidence, prepared ABQ material and Pythia cache/locks were not modified.

Per scope, no Pythia native qualification, broad CI, benchmark, soak, installation isolation, aggregate acceptance, unfamiliar-user study, full WCAG/screen-reader audit, deployment, release, PR, merge, M4 fault-injection/payload redesign, M5 or M6 work was run. Full durable cross-session M3 archive/import reopening was not implemented or claimed.

The next dependency is M4 durable payloads and failure boundaries. This task did not begin it.
