# Wave 1C review

Completed locally in `/Users/joshuahansen/dev/model-lab-support/wave-1a` on `wave-1a-spatial`. A+B were preserved, including their untracked source. Starting/final HEAD is `5217cd11157368807a9159f87fbc87e175bc850b`; all implementation changes remain uncommitted. Original `main` is clean. No commits, merges, pushes, PRs, deployments, remote writes or workshops changes.

## Start / review

```sh
cd /Users/joshuahansen/dev/model-lab-support/wave-1a
npm run dev -- --port 4173 --strictPort
```

Open http://127.0.0.1:4173/?presentation=spatial. Use `npm ci` first on a machine without the locked dependencies.

Predict `abca`, select a parameter bank (start with `wte`, row 0 / column 0), and click **Learn · one update**. The existing worker executes the complete update. The map now connects all-position target/loss/mean objective, selected parameter contributions, Adam, and the resulting checkpoint back to the pinned parameter's forward owner.

Use **Contributions → Inspect / verify parameter contributions**, then **Adam**. Expand the bounded occurrence list, or follow a child to its actual scalar operands. **Before / Training / After** selects explicit source runs. After rebinds every forward station and parameter bank. **Compare** shows matched original components with shared scales across the map, including paired parameter fields; it does not overlay independently fitted Q/K or mixture planes.

Return to the current model before another Learn, select `layer0.attn_wq[0,0]` through its bank, and Learn again without reset. Select Update 1 to inspect its older gradient/configuration while the live model stays at step 2. Uncached older gradients use the existing verified historical inspector. Learn is disabled for historical/stale sources; **Return to current model** performs a read-only selection, not a restore. A fresh Predict clears the prior comparison selection while retaining its archived transition.

The duplicate selection card collapses to a compact location indicator while a full lens is open. Arithmetic tables scroll locally, with the model and owner still visible.

## Sources / preservation

Incoming B runtime: `sha256:370384135376da45a1a61d287e7cdb88e3acce9d00c9d37bbb4ef3424e2fbee0`. Final C runtime: `sha256:8f45ff3228e8a18872659fab550c9c453c612d141f35faa6cb80afae6f452bcc`.

The original plan, Batch C handoff and C01–C10 were applied with the C addendum. A/B's connected SVG/HTML, Graphite/Plex styling, parameter ownership, geometry, dependencies and camera remain. The supplied v2.1 training capture was used as a presentation reference, not numeric authority. No additional AGENTS.md files were found; the user-provided no-`codex/` branch instruction remains respected.

The incoming tracked diff, A+B files and runtime are in `wave-1c-evidence/incoming/`. The final combined diff and complete changed/untracked source archive are in the evidence directory; HEAD alone does not contain A+B+C.

| Update | Before run | Training run | After run |
| --- | --- | --- | --- |
| 1 | `169476b7-e926-4ff5-8761-359bc8dfd9e3:0:4:before` | `169476b7-e926-4ff5-8761-359bc8dfd9e3:0:4:training` | `169476b7-e926-4ff5-8761-359bc8dfd9e3:0:4` |
| 2 | `169476b7-e926-4ff5-8761-359bc8dfd9e3:0:6:before` | `169476b7-e926-4ff5-8761-359bc8dfd9e3:0:6:training` | `169476b7-e926-4ff5-8761-359bc8dfd9e3:0:6` |

Starting snapshot: `sha256:d1a46ae0fe2830a2bbcdc118913c5d974ef82e6acc2ef1004b5f8d0dae5b3ca1`. Update 1 ends at `sha256:0a43d3e90da2adb442be0d8fbdc18984c11414f72d43e7bc4ccb3d5ae1565712`, which is update 2's starting snapshot. Update 2 ends at `sha256:d8b0756a9529257c8f88cd25fec71d0e4cf613067e0ac5a7455f7183e999b5bf`.

`wave-1c-source-identity.json` also records the fresh `abcb` prediction and the recording's separate browser-session identities. Full manifests and recorded update fields are in `learning-identities.json` outside production source.

## Reproduced defects and narrow repairs

1. **Teach baseline provenance (C08).** A targeted test showed baseline probability values paired with the intermediate accepted after-run ID. The ephemeral GuidedBatch now retains the baseline snapshot ID, and the source strip uses the baseline run, checkpoint and step while those values are displayed. Before/after batch comparison and the last individual update remain distinct.
2. **Worker assembly/publication failure (C10).** An injected resulting-snapshot hash failure returned an error but left optimizer step 1. The worker now restores the starting training snapshot if training/trace assembly or synchronous result publication fails. Production structured-clone publication is inside that protection. Contexts are replaced only after successful publication; request/response formats and serial command scheduling are unchanged.
3. **Accepted update / archive admission (C10).** A real-browser fault showed step 1 paired with “Run failed” and missing retained transition records. Matching result receipt remains the client acceptance boundary. A later local archive failure is labeled as an accepted update, and the existing complete result is retained through one retry without executing another Learn. Last accepted endpoints are retained on early stop as well. Persistent retention failure remains an explicit error; it does not silently roll back or replay an accepted model update.
4. **Fresh Predict after comparison.** A targeted browser probe showed an old transition staying selected after a different input was predicted. New predictions now clear that comparison selection while preserving history. Presentation switching follows the actual selected result's experiment association.

Original failing probe logs are retained alongside passing reruns. No numerical tolerance or origin assertion was weakened.

## Coverage / results

| Check | Result | Evidence |
| --- | --- | --- |
| A01–A06 | PASS | Retained real-HTTP source/geometry/parameter/single-owner route. |
| B01–B09 | PASS | Retained forward, dependency, geometry, navigation and invalidation route. |
| C01 | PASS | Real Learn with before/training/after ID assertions and source switching. |
| C02 | PASS | `wte[0,0]` and non-embedding `layer0.attn_wq[0,0]`; indices resolved from parameter order, not literals. |
| C03 | PASS | Real occurrence counts, bounded 3-of-5 Q-weight list, hidden subtotal and full expansion; repeated edges retained. |
| C04 | PASS | Two consecutive real updates; actual prior moments, corrections, effective rate and stored endpoints match recorded fields. |
| C05 | PASS | Fresh after-run activations, MLP, probabilities and parameter source; map comparison pairs use shared domains. |
| C06 | PASS | Observed training losses/mean; before/after Predict loss derived from matched target probabilities without clipping or a decrease requirement. |
| C07 | PASS | Earlier transition inspection after update 2, with verified reconstruction and unchanged live step. |
| C08 | PASS | Reproduced/fixed baseline source mismatch; existing Teach regressions pass. |
| C09 | PASS | Real-worker three-update schedule early stop retains Update 3; existing 1,000-step exhaustion and cancellation tests also pass. |
| C10 | PASS | Pre/post-mutation trace failures, snapshot assembly failure, result publication failure, app archive failure, late reply rejection, and existing Cancel/Reset/Clear tests. |

- `npm test`: **75/75 passed**.
- Portable reference: **17/17 passed**, strict conformance with zero differing floats.
- Original Classic browser regressions: **22/22 passed** on their required port **4173**.
- Final spatial A/B/C, early-stop/recovery and paced recording: **7/7 passed** on normal built HTTP **4174**. Supplemental dense-arithmetic capture route also passed.
- Typecheck/production build and `git diff --check`: passed.
- Incoming bounded baseline: typecheck plus six focused A/B/learning read-model tests passed.

```sh
npm test
npm run test:reference:portable
npm run build
npx playwright test tests/browser/guided-v2.1.spec.ts tests/browser/state-binding.spec.ts tests/browser/truth-v2.1.spec.ts --workers=2
SPATIAL_EVIDENCE_DIR=/tmp/model-lab-wave1c-review npx playwright test --config playwright.spatial.config.ts tests/browser/spatial-wave1a.spec.ts tests/browser/spatial-wave1b.spec.ts tests/browser/spatial-wave1c.spec.ts tests/browser/wave1c-early-stop.spec.ts tests/browser/spatial-learning-route.spec.ts --workers=1
```

Stop any existing port-4173 review server before the original Playwright config starts its own server. The dedicated spatial config uses 4174. All routes load actual built workers and bundled assets; no in-memory page harness substitutes for acceptance.

## Changed files relative to incoming A+B

- `app/main.ts`: existing-owner integration, source/transition review, guarded Learn, gradient inspection reuse, accepted-result retention repair.
- `app/presentation/guided-read-model.ts`: baseline identity repair.
- `app/worker/controller.ts`, `app/worker/worker.ts`: rollback around failed training assembly/publication.
- New `app/spatial/learning.ts`: validated experiment/checkpoint/run bundle, actual parameter resolution, reused backward/Adam helpers, source-bound target losses.
- New `app/spatial/learning-view.ts`: connected learning region and local objective/contribution/Adam/checkpoint/comparison calculations.
- `app/spatial/presenter.ts`, `scene.ts`, `camera.ts`, `style.css`: learning controls, owner return, comparison pairs, expanded world bounds and collapsed duplicate card.
- New tests: `spatial-learning.test.ts`, `wave1c-recovery.test.ts`, `spatial-wave1c.spec.ts`, `wave1c-early-stop.spec.ts`, `spatial-learning-route.spec.ts`.
- C review, acceptance and source-identity records under `docs/`.

## Artifacts / remaining limits

Evidence is saved at `/Users/joshuahansen/dev/model-lab-support/wave-1c-evidence/`: 1920×1080 learning map, gradient, first/second Adam and comparison captures; 1280×720 Adam/comparison captures with supplemental endpoint/loss stills; a **73-second 1920×1080 `learning-route.mp4`** and original WebM; source identities and actual test/probe logs.

No second mutable live model, evidence format, renderer/framework, scheduler or optimizer was introduced. All explicit single updates retain complete transitions. Classic batches still retain their documented sparse checkpoints plus the last accepted endpoint; not every intermediate batch update is promised as full history. Historical inspection requires a compatible runtime and a complete retained source bundle. Missing decomposition is not presented as zero.

Comparison is on shared original-component axes; independently fitted exact Q/K/mixture views remain single-source explanations, not displacement comparisons. Numeric endpoint connections are not measured trajectories. Inspecting one parameter does not imply only it was trained or caused the whole output change.

Timed explanation playback, general D polish, human comprehension/hardware acceptance and live operator stepping are **not implemented or claimed**. Stop after C for review.
