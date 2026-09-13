# Wave 1A review

Implemented locally on `wave-1a-spatial`; stopped at A. No commits, pushes, PRs or deployments.

## Checkout and authority

- Original standalone checkout: `/Users/joshuahansen/dev/model-lab`, clean `main`.
- Isolated Git worktree: `/Users/joshuahansen/dev/model-lab-support/wave-1a`.
- Starting and final HEAD: `5217cd11157368807a9159f87fbc87e175bc850b` (uncommitted changes).
- Origin: `git@github.com:A-T-S-K/model-lab.git`; no network/remote writes or reset to a planning pin.
- User instruction: no `codex/` branch prefix. No additional AGENTS.md files found in the repository or applicable parent directories.
- Followed packet 03, architecture/boundaries in 01, relevant review findings in 02 and A01–A06 in 05. Did not execute B–D handoffs. Inspected full-size overview, attention and Q/K prototype captures; did not import its numeric data or font server.

## Start and review

```sh
cd /Users/joshuahansen/dev/model-lab-support/wave-1a
npm run dev -- --port 4173 --strictPort
```

Open http://127.0.0.1:4173/?presentation=spatial. Local dependencies are installed in the worktree. For another machine, run `npm ci` first.

Enter `abca` and Predict. Home shows both heads; click a head in the SVG or use Focus attention. Select query/key/head and Q output feature. Q/K lens scrolls to the exact geometric construction and complete Q parameter row. Inspect Q output, follow the multiply operand, then `layer0.attn_wq[0,7]` to inspect the actual parameter scalar/source. Enter `abcb` and Predict; values and evidence addresses rebind. A future key shows NA. An out-of-range position after a shorter input stays explicitly unavailable until changed. Classic presentation and Spatial presentation switch in place using the same session.

## Integration and changed files

- `app/main.ts`: narrow feature-flag render/bind boundary; retains its existing ModelWorkerClient, InspectorWorkerClient, SessionArchive, execution and scalar-inspection paths.
- `app/spatial/bindings.ts`: typed ephemeral adapter over existing run artifacts and checkpoint-bound Q projection rows; semantic indices separate from evidence addresses.
- `app/spatial/geometry.ts`: complete-vector exact span, shared uniform scale, zero/collinear handling and bounded roundoff clamp.
- `app/spatial/view.ts`: connected SVG topology and anchored HTML inspection, source evidence, real selection controls, signed vector strips and causal weights.
- `app/spatial/style.css`: scoped Instrument Graphite presentation using the existing bundled Plex/PlexMono fonts.
- `tests/app/spatial.test.ts`: source/geometry/absence/row-orientation checks.
- `tests/browser/spatial-wave1a.spec.ts`: normal production HTTP route driven by user-facing controls; read-only worker traffic audit.
- `docs/wave-1a-review.md`, `docs/wave-1a-acceptance.yaml`: review record.

## Verification

Bounded baseline before edits: typecheck and 5 focused attention/microscope/binding tests passed. Baseline runtime: `sha256:4a27fa67dbf2ebdab6c3324883454b303467782435f3aa0b4b30d10c50af772a`.

- `npm test`: 65/65 passed, including runtime-identity HTTP integration.
- `npm run test:reference:portable`: 17/17 passed; strict portable conformance passed with zero differing floats.
- Build/typecheck: passed, including final source and tests.
- Affected built-app browser regression set: 23/23 passed (spatial route, state-binding, truth-v2.1, guided-v2.1 including optimizer exhaustion, cancellation and history).
- Final scene interaction/capture route: 1/1 passed after final spatial-only changes. Final focused unit checks: 4/4 passed.
- `git diff --check`: passed.
- No page/console/request errors or runtime WAN requests on the spatial route. Actual built assets and model worker loaded via ordinary HTTP. Exactly one initialize command and one Predict session identity; presentation switches sent no worker commands.

The initial sandbox attempts could not bind localhost (`listen EPERM`). Reran with authorized local execution; HTTP tests then passed. No assertions or numerical tolerances were weakened. Full visual-regression suite and human/hardware acceptance were not claimed or run for batch A.

## Captured source identity

- Final runtime: `sha256:ad383558673ddcd942cce5d2b869f6cdfe2c27312098601b026c7f75e67e4291`.
- `abca` run: `a6e6c5ad-cbe5-4ecb-823f-e3c5e0e19171:0:3`.
- `abcb` run: `a6e6c5ad-cbe5-4ecb-823f-e3c5e0e19171:0:8`.
- Both starting snapshots: `sha256:d1a46ae0fe2830a2bbcdc118913c5d974ef82e6acc2ef1004b5f8d0dae5b3ca1` (Predict does not mutate parameters).
- The browser route also tested an intermediate shorter input to prove explicit invalidation, before ending on `abcb`.
- For query 4, head 0, feature 0: Q changes from 0.441144899… to 0.255407547…; key-0 score changes from −0.0325562740… to −0.0242945677…. Exact values and artifact IDs are checked against worker responses, not these rounded review captions.

Full run manifests, worker command identities, captures and logs are saved outside production/runtime source at `/Users/joshuahansen/dev/model-lab-support/wave-1a-evidence`. `source-identity.json` contains the starting/final manifests. Captures include overview and attention at 1920×1080, overview at 1280×720, a full-page attention capture at the 1280 viewport, both Q/K lens viewport captures and the parameter scalar capture.

## Remaining Wave 1A limitations

Input lookup/add, V mixture/WO/residual, MLP/output and the training/Adam return are explicitly schematic. No numerical placeholders stand in for unimplemented regions. The quantitative strips show selected vectors/rows, not complete activation matrices. K is the selected run's key-position projection; Q and K are separate operands of the score. Printed strip domains are local; the exact Q/K lens uses one shared scale.

Navigation in A is Home, selected-head focus, lens scroll and semantic selectors, with instant camera changes. Full free pan/zoom, lesson playback, learning presentation and remaining forward coverage belong to later batches. Overview metadata is intentionally small; focused detail and HTML values provide readable exact inspection at 1280×720. Detail can require vertical scrolling. No live operator stepping, second model, renderer migration, scheduler rewrite or evidence-format change.
