# Model Lab

An isolated, browser-local scalar GPT teaching experience. Guided introduces the actual prediction. Explore selects semantic values and historical checkpoints. Microscope recursively exposes primitive operations, structural inputs, and actual backward contributions. Learn records an explicit before-state → observed training execution → after-state experiment. The tiny initial model is untrained; changed probabilities alone are not an improvement claim.

## Run locally

Requires Node 24+, npm, and Python 3.9+ for reference validation.

```bash
cd model-lab
npm ci
npm run dev
```

Open the localhost URL printed by Vite. Enter up to seven characters from `a`, `b`, and `c`. BOS is added automatically. Select a token, model stage, attention head, and causal cell to inspect evidence. Learn trains on the displayed document with shifted character targets and terminal BOS. Reset model restores the selected or canonical snapshot and preserves the archive. Cancel terminates current work and restores the last completed live snapshot. Clear session clears both workers, runs, experiments and comparisons; kiosk inactivity invokes Clear session.

Live model arithmetic runs in its owning Web Worker. A separate inspector worker reconstructs old runs and verifies all available semantic anchors before returning recomputed detail. No live `Value` object leaves its owner. Core runtime assets are bundled locally: no model API, remote font, dataset download, or WAN access is required after installing/building. Development dependency installation may require Internet access.

## Validation

```bash
npm run test:reference   # Python properties and exact fixture regeneration
npm test                # scalar conformance, trace, worker/session properties
npm run build           # strict TypeScript and production assets
npx playwright install chromium
npm run test:browser     # real browser Predict, arithmetic, Learn, reset
```

Or run `npm run acceptance` after installing Chromium. Browser tests use the production build on port 4173. Full-precision fixture values are compared using `abs(error) <= 1e-10 + 1e-9 * abs(expected)`; UI decimal formatting does not change canonical evidence. See [fixtures](fixtures/README.md), [provenance](reference/PROVENANCE.md), and [Read the Code](READ_THE_CODE.md).

## Isolation and container

From repository root, stage intended Model Lab sources before the tracked-copy check:

```bash
git add model-lab
cd model-lab
npm run test:isolation
```

This copies only tracked subtree files to a fresh temporary directory, runs `npm ci`, Python/reference and TypeScript tests, production build, and browser tests without sibling source. It leaves the temporary copy path in the log for inspection.

From repository root:

```bash
docker build -f model-lab/Dockerfile -t model-lab:acceptance model-lab
docker run --rm -p 127.0.0.1:8080:80 model-lab:acceptance
```

The container serves static assets only. The browser executes the scalar model. No root workshop configuration, catalog, launcher, licensing, or sibling code is changed by this subtree.

## Scope

This fixture uses one layer, eight embedding features, two heads, eight context positions, three characters plus BOS, and **896 parameters**. Parameter count follows configuration. Model source remains independent of tracing and UI. The evidence player supports immutable replay and explicit missing values; attention arithmetic detail is **derived from observed live Q/K**, not a newly executed model run. Next-token selection uses the highest probability at the final input position, with no sampling claim.

The upstream gist is pinned by revision and SHA-256. The committed Python oracle is independently authored and checked against the original downloaded reference; upstream source is not vendored because its license status is unresolved. No license decision is made. See the provenance document for the exact validation command and evidence.

Controlled ablation and matched training-data substitution research are documented in [experiment evidence](docs/experiments-v0.2.md). This slice makes no attack-success or security-effectiveness claims.

## v0.2 evidence and retention

Current Predict retains full private scalar evidence. Learn snapshots actual gradients and every operand contribution before Adam changes parameters or clears gradients. The gradient in the microscope equals the observed gradient consumed by Adam; the optimizer panel expands moments, bias correction, mathematical update and actual representable delta. An advanced whole-run capture exposes measured graph statistics without a graph hairball.

History uses SHA-256 over a canonical binary64 encoding of complete state, including parameter order, moments, schedule, cursor and RNG continuation. The main-thread archive accepts only immutable plain data and validated references. Cached observed detail remains observed; uncaptured historical detail is labelled VERIFIED RECOMPUTATION only after verification passes. A mismatch produces no explanatory graph.

Multi-step training retains every observed loss summary and full experiments at the first step, each loss halving, and final step. Checkpoint comparison uses exact archived runs with compatible model, input, objective, precision, shape and axes. Session capture stops at a conservative 64 MiB evidence estimate (plus one operation of headroom) and asks for Clear session instead of silently deleting history. See [capture benchmark](docs/capture-benchmark.md), [training benchmark](docs/training-benchmark.md), and [v0.2 acceptance](docs/acceptance-v0.2.md).
