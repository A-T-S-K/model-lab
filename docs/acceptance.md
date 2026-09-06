# Pre-merge acceptance — September 5, 2026

> Historical v0.1 record. Instructions and measurements below describe that completed pass; current work follows the v0.2.1 execution plan.

All required completion gates 0–6 pass, including one real Learn update. Optional second-producer coverage (M11) also passes. Ablation and poisoning spikes (M12) are deferred; no public security or model-quality claim is made.

## Local boundary

- Branch: `model-lab` (existing branch preserved; no `codex/` prefix).
- Starting SHA: `cad66ada012d464f090a66da5f9bfcebc1a31f47`.
- Final local HEAD: the local acceptance commit containing this report; inspect with `git rev-parse HEAD`.
- Pushed: **no**. GitHub remotes unchanged.
- Changed paths confined to `AGENTS.md`, `docs/**`, and `model-lab/**`.
- PRs #1, #7, and #8 were verified open during preflight. No outstanding-PR surfaces, infrastructure repositories, or licensing files were modified.

## Reference and numerical acceptance

Reference revision `14fb038816c7aae0bb9342c2dbf1a51dd134a5ff`; SHA-256 `d47d88c2fd432c8ebdc1048beab7f7eb64ea7e0e664e11b812d72a6d95ebccee`. Independent Python oracle agrees with the hash-verified original across 3,676 numerical values with maximum absolute difference **0.0**. See [provenance](../reference/PROVENANCE.md) for the non-vendoring decision and reproducible comparison command.

The committed 896-parameter canonical state regenerates expected evidence byte-for-byte. TypeScript conforms for every captured forward vector, losses, all gradients, Adam moments/bias corrections/deltas, updated parameters, and post-update logits/probabilities. Tolerance: absolute `1e-10` plus relative `1e-9`. Tests also cover connected causal K/V, shared/deep autograd graphs, exact observational invariance, immutable capture/replay, unavailable evidence, bounds, and continued training from complete serialized state.

## Checks actually run

| Check | Result |
|---|---|
| `python3 reference/compare_upstream.py /tmp/model-lab-microgpt.pinned.py` | 3,676 scalar comparisons; max error 0.0 |
| `npm run test:reference` | 9 Python tests; exact regeneration |
| `npm test` | 29 TypeScript tests across model, trace, worker/client, and rendering |
| `npm run build` | strict typecheck and Vite production bundle |
| `npm run test:browser` | 2 Chromium scenarios: authentic Predict/Learn and desktop/mobile/reset/cancel |
| `npm run test:isolation` | fresh tracked-source copy; npm ci, reference/tests/build/browser all pass |
| `docker build -f model-lab/Dockerfile -t model-lab:acceptance model-lab` | isolated image builds |
| Container on localhost:4180, Chromium Predict + Learn | real worker run/update pass; zero page errors and WAN requests |
| `git diff --check` and staged equivalent | clean after normalizing attached plan's trailing whitespace |

Browser tests compare full-precision probability values with the Python fixture, reconstruct Q×K products and scaled logit, verify masked future cells, verify actual displayed optimizer evidence and applied delta, and confirm the same input uses post-update state. Reset restores fixture predictions; immediate cancellation cannot render stale results. Mobile coverage includes the maximum eight-position context. Core browser requests are local; the production application needs no WAN model service or runtime downloads. The acceptance container was stopped and removed after validation.

## Independent review and repairs

- R1 numerical: no blockers; independently reran original-source comparator and reference/model tests.
- R2 evidence/worker: three confirmed issues repaired and regression-tested: checkpoint identity collisions across histories, stale reset acceptance, and stale worker errors rejecting current-generation work.
- R3 readability: no blockers; mathematical source has only model-local imports and direct curriculum vocabulary. The source tour matches implementation.
- R4 build/boundary: no further actionable findings; subtree context and reset/cancel isolation reviewed.
- Browser validation found mobile attention overflow. A bounded horizontally scrollable table fixes maximum-context rendering without representing masked cells as zero.

## Handoff

No numerical, Learn, isolation, or container blocker remains. The upstream license status is unresolved, so upstream text is not distributed; its exact algorithm was validated through the pinned original and independently authored oracle without making a license decision. Stochastic sampling is outside this slice; deterministic teacher forcing has no active RNG state. The fixture tests one layer and two heads, not arbitrary production-scale model configurations.

After PR approvals and merges, a separate pass should reconcile contributor changes and integrate the catalog/launcher, then address existing-workshop hardening described in the execution plan. Keep this pre-merge deliverable isolated until then.
