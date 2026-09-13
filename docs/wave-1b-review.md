# Wave 1B review

Wave 1B continues the uncommitted A implementation in `/Users/joshuahansen/dev/model-lab-support/wave-1a`, on `wave-1a-spatial`. Starting and final Git HEAD remain `5217cd11157368807a9159f87fbc87e175bc850b`. No commits, merges, pushes, PRs, deployments or remote writes were made. The original main checkout is unchanged.

## Review and startup

```sh
cd /Users/joshuahansen/dev/model-lab-support/wave-1a
npm run dev -- --port 4173 --strictPort
```

Open http://127.0.0.1:4173/?presentation=spatial. The existing classic presentation is available with the in-place switch; it retains the same owning session. On another machine, install the locked dependencies with `npm ci` first.

Enter `abca`, Predict, then select position 3 / head 0 / key 0 for comparison with v2.1. Home displays the full forward composition and its parameter banks. Click a world object or use the Operation selector to focus it and open its contextual lens. The lens keeps a source tether, location card, minimap and Home/Back controls visible. Exact values, arithmetic tables and source code scroll locally inside the lens; desktop use does not scroll the whole model away.

Use the upstream/downstream buttons to choose an actual dependency. For example, Attention scores offers Q and each earlier K; Attention softmax consumes the complete score row; Weighted values offers all weights and earlier V positions. Explore ReLU for all 32 components and a selected component's before/after and local derivative. Inspect selected scalar, then follow its real operands. Click a parameter bank, choose a row/column, and follow its output to inspect actual multiplication/parameter operands.

Drag the map to pan, use the wheel or zoom buttons, or focus the canvas and use arrow keys / + / −. Home reframes without changing selection. Back restores the prior exploration location. Manual waypoints can be interrupted for a detour and explicitly resumed. These controls review completed evidence; they do not execute model stages.

Run a seven-character input such as `abcabca` to inspect eight positions. The first query has one causal key; future keys are NA and have no selected K/V edge into scores/mixtures. Shortening an input leaves an impossible semantic index explicitly unavailable until selected again. Predict on `abcb` rebinds the entire forward view and clears old scalar inspection.

## Authority and preservation

Read the original architecture plan, Batch B handoff, B01–B09 and the supplied Wave-1B-Review-Addendum. Inspected full-size v2.1 overview, attention, Q/K, mixture and MLP captures before changes. v2.1 supplied organization, palette and interaction direction, not runtime values or hand-positioned mathematical endpoints.

The incoming A runtime was `sha256:ad383558673ddcd942cce5d2b869f6cdfe2c27312098601b026c7f75e67e4291`. Its tracked diff, source/test/doc files and runtime identity are preserved in `/Users/joshuahansen/dev/model-lab-support/wave-1b-evidence/incoming/`. A's bounded baseline passed typecheck and three focused tests. No new worktree or clean-main reset was used.

The model, worker/session ownership, archive, trace/evidence formats and recursive scalar/verified-historical-inspection machinery are unchanged. The presentation adapter remains ephemeral. All parameter matrices come from the run's matching starting snapshot. Semantic selection and camera/history locations contain no reusable scalar IDs.

## Coverage

| Check | Result | Evidence |
| --- | --- | --- |
| A01–A06 | PASS | Retained HTTP route: abca/abcb, both heads, Q-row contributors, observed scalar parameter, complete-vector shared-scale geometry, one model owner. Interaction selectors adapted to the contextual lens; numerical assertions retained. |
| B01 | PASS | All 21 forward artifact kinds, both head instances and all 9 parameter owners. Browser compares every displayed component for each kind to the actual worker artifact. |
| B02 | PASS | Query 0 and eight-position run. All causal contributors retained; future keys are explicit NA with no selected K/V causal link. |
| B03 | PASS | A shorter input during deep scalar inspection invalidates the old position and removes its scalar evidence. |
| B04 | PASS | All 32 ReLU components, actual pre-activation, local derivative and observed recursive scalar/source path. |
| B05 | PASS | Directed operand/consumer choices; earlier-position K/V addresses; complete stable-softmax score row, maximum, exponentials and denominator. |
| B06 | PASS | Object/selector focus, pointer drag, wheel/button/keyboard pan/zoom, interrupted transition, reduced-motion immediate framing, selection-preserving Home/Back and waypoint detour/resume. Navigation does not execute model commands. |
| B07 | PASS | Unit affine ranks 0–4; exact low-rank coordinates and distances, one-point degeneration, all original contributors and weighted sums. Browser exercises four-key rank 3 and eight-key higher-rank projection. |
| B08 | PASS | Regular tetrahedron barycenter calculated from actual probabilities; unit distributions and browser original-space point assertions, with matching output component values. |
| B09 | PASS | Zero magnitude, signed strips, unavailable-vs-zero distinction, finite/domain checks, continuous cividis-derived probability colors, external amber reticles. |

Forward coverage: token/position IDs and lookup → addition → embedding RMSNorm → saved residual / pre-attention RMSNorm → Q/K/V projections and head slices → causal score rows → stable softmax → weighted values → concatenation → WO → residual → pre-MLP RMSNorm → 8→32 projection → ReLU → 32→8 projection → second residual → vocabulary logits → probabilities. No final normalization was added.

## Geometry and display contracts

- A's complete-vector Q/K span and shared screen scale are retained. Zero vectors have no invented angle; collinear cases are tested.
- Mixtures compute their affine rank from every original V vector using reorthogonalization. Ranks up to three use an exact local affine basis. Higher ranks use an explicitly labeled fixed original-coordinate projection; no key is dropped. The original components and exact weighted arithmetic remain accessible.
- Mixture bases are source-specific and explicitly unsuitable for silently comparing displacements across runs. The screen view is a declared fixed orthographic projection, with possible foreshortening.
- Output probability points are barycenters of a regular underlying 3D tetrahedron. Vertex labels and probability values agree.
- Probability colors use the supplied five-stop cividis-derived 0–1 ramp. Component strips use explicitly independent symmetric scales, with full domains in tooltips; the Q/K lens uses one shared scale. No minimum nonzero bar height is imposed. Out-of-domain probabilities do not receive plausible in-domain marks.
- Parameter frames stay neutral; their matrix marks derive from actual checkpoint values. Selection uses external corners/tethers without replacing quantitative fills. Numeric text uses Plex Sans tabular numerals; source code and addresses use Plex Mono.
- Home uses readable region labels and compact operation symbols (RN = RMSNorm, TE/PE = token/position embedding, s = score row, α = weights, ∥ = concatenation; S = START in compact token labels). Full operation names, shapes, components and purpose appear on focus and in the selector/lens.

## Changed files relative to incoming A

- `app/main.ts`: passes the existing source/session/scalar state to the presenter and synchronizes semantic selection; no ownership or scheduler refactor.
- `app/spatial/bindings.ts`: attaches the forward adapter while retaining A's bindings.
- `app/spatial/geometry.ts`: adds affine mixture, tetrahedron and probability ramp helpers; keeps A's Q/K construction.
- `app/spatial/view.ts`: retains A's Q/K and Q-row inspector helpers; removes the temporary attention-only scene/page scaffolding.
- `app/spatial/style.css`: connected world, contextual lens, external selection, readable overview/detail levels, existing Plex fonts.
- New `app/spatial/forward.ts`: operation families, source-checkpoint access, typed directed dependencies and derived arithmetic.
- New `app/spatial/scene.ts`: full SVG composition, residual bypasses, both heads and shared parameter ownership.
- New `app/spatial/camera.ts`: single cancellable camera controller and non-drag alternatives.
- New `app/spatial/inspector.ts`: complete component, contributor, softmax, ReLU, geometry, parameter and dependency views.
- New `app/spatial/presenter.ts`: semantic selection, bounded navigation history, manual waypoints and view integration.
- `tests/browser/spatial-wave1a.spec.ts`: retained A assertions with updated UI navigation.
- New `tests/app/spatial-forward.test.ts`, `tests/browser/spatial-wave1b.spec.ts`, `tests/browser/spatial-paced-route.spec.ts`, and `playwright.spatial.config.ts`.
- This report, `docs/wave-1b-acceptance.yaml`, and `docs/wave-1b-source-identity.json`.

## Reproduce the checks

```sh
npm test
npm run test:reference:portable
npm run build
npx playwright test --config playwright.spatial.config.ts tests/browser/spatial-wave1a.spec.ts tests/browser/spatial-wave1b.spec.ts --workers=1
SPATIAL_EVIDENCE_DIR=/tmp/model-lab-wave1b-review npx playwright test --config playwright.spatial.config.ts tests/browser/spatial-paced-route.spec.ts --workers=1
```

The dedicated spatial config serves the normal built assets on port 4174, avoiding an active review server. The original offline regression tests explicitly require port 4173; use their original config unchanged.

## Results and evidence

- `npm test`: 68/68 passed, including numerical/evidence, archive, worker and runtime identity checks.
- Portable reference: 17/17 passed; strict conformance passed with zero differing floats.
- Focused A/B unit checks: 5/5 passed.
- Typecheck/production build and whitespace check: passed.
- Combined A/B and affected classic browser regressions: 22/24 passed on 4174; the two origin-restricted tests were rerun unchanged on their required port 4173 and passed (24/24 across the required ports). The original failing attempt and successful rerun logs are retained; this was a test-origin mismatch, not a relaxed assertion.
- Final A route, B route and paced recording: 3/3 passed against the final build. Results are recorded in `final-browser.log` in the evidence directory.

Evidence directory: `/Users/joshuahansen/dev/model-lab-support/wave-1b-evidence/`. It contains the overview, attention, mixture, ReLU/scalar, output and 1280×720 captures, the 73.28-second 1920×1080 `forward-route.mp4` (and original WebM), complete starting/final manifests, recording run identities and test logs. See `docs/wave-1b-source-identity.json` for the final runtime and exact run addresses. Captures and video remain outside the production/runtime source tree.

## Remaining limits / stop boundary

Training, backward and Adam are clearly labeled unimplemented in the spatial map. C–D have not been implemented. Classic learning remains available through the same session. There is no live stepping or timed explanation playback.

The model architecture remains the existing single-layer organism. The map provides selected-position strips, not all-position tensor matrices at once; every valid position/component is selectable. Higher-rank mixtures are declared projections, not exact 3D embeddings. Unused embedding rows have checkpoint values but no scalar execution occurrence in a run that did not read them. Long contributor/source tables scroll locally. Narrow layouts retain an explicit world/lens stack.

Human comprehension, touch hardware, glare, long-duration performance and whole-Wave D acceptance are NOT RUN. Browser screenshots and mathematical tests do not establish those outcomes.

Stop after B for review.

## Final source identity

Final runtime: `sha256:370384135376da45a1a61d287e7cdb88e3acce9d00c9d37bbb4ef3424e2fbee0`.

Acceptance `abca` run: `37735826-6cfe-4c9d-8c9a-dc427672e791:0:3`. Final `abcb` run: `37735826-6cfe-4c9d-8c9a-dc427672e791:0:8`. Both use starting snapshot `sha256:d1a46ae0fe2830a2bbcdc118913c5d974ef82e6acc2ef1004b5f8d0dae5b3ca1`; Predict does not mutate it. Recording run IDs are recorded separately in `wave-1b-source-identity.json` because the recording uses its own browser session.
