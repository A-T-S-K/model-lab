# Model Lab

This tiny GPT sees characters and predicts what comes next. Start with `abca`: after seeing `abc`, how likely does it think `a` is? Predict, teach it with real updates, then compare the probability before and after.

Characters become **tokens**: numbered entries in a small vocabulary. Each token ID and its position select vectors of numbers. Attention mixes information from the current and earlier positions; an MLP (a small feed-forward network) transforms those features. The model turns the resulting scores into **probabilities**—shares of the next-token distribution that sum to one.

A **parameter** is an adjustable number used in those calculations. The known next character supplies a target. **Loss** measures how poorly the model predicts the targets; lower loss on this example means it assigned them more probability overall. A **gradient** says how a small parameter change would affect that loss. Training uses the gradients to change parameters, then predicts the same input again.

The model starts untrained and uses only `a`, `b`, `c`, and a shared start/end marker. Fitting this one example demonstrates learning mechanics, not useful language understanding.

## Run locally

Requires Node 24+, npm, and Python 3.9+ for reference validation.

```bash
# From the standalone repository root:
npm ci
npm run dev
```

Open the localhost URL printed by Vite. `npm run dev` builds and serves fixed local assets. After editing source, stop and restart it to rebuild; automatic source hot-reloading is disabled so running workers and their recorded runtime revision stay aligned. Guided follows **Predict → Teach → See What Changed**. Its canonical example follows the prefix `abc` and target `a`, using 10 real updates selected from a [fixed deterministic measurement](docs/guided-measurement.md). The numbers shown come from your actual run.

Enter up to seven characters from `a`, `b`, and `c`. The START / END marker is added automatically; the same marker is called BOS in the technical views. Edited input makes old evidence visibly stale until Predict runs again. Explore opens positions, stages, attention, one-step Learn, and history. Microscope follows individual arithmetic operations, gradients, and Adam (the optimizer that calculates parameter updates).

Reset model restores the selected or canonical state and preserves history. Cancel restores the last completed live state. Clear session clears both workers and the session history; opt-in Exhibit mode does this after five minutes without activity.

Live model arithmetic runs in its owning Web Worker. A separate inspector worker reconstructs old runs and verifies all available semantic anchors before returning recomputed detail. No live `Value` object leaves its owner. Core runtime assets are bundled locally: no model API, remote font, dataset download, or WAN access is required after installing/building. Development dependency installation may require Internet access.

## Prepared exhibit

From this repository root, `npm run prepare:abq` builds once and creates a read-only kit in `test-results/abq-overnight/release/`. With Node 24+ already installed, run `node serve.mjs` inside the kit and open `http://127.0.0.1:4173/?presentation=spatial&kiosk=1`. No source checkout, node_modules or network install is needed at startup. The ordinary `/` and `/?presentation=spatial` entries remain available.

Start makes a fresh prediction. The short route offers an explicit `abca` q3/head0/key0 selection and Q/K → softmax → mixture → residual explanations. This is teacher-forced next-token prediction, not generative continuation. Public Reset restores the canonical visitor baseline, history and navigation. The initial idle policy is 300 seconds with a 20-second warning; **Show operator controls → Disable idle reset · facilitated session** opts out. See the [operator runbook](docs/abq-operator-runbook.md) for preparation, recovery and qualification limits.

## Validation

```bash
npm run test:reference   # portable: exact structure/identity + strict numeric conformance
npm test                # scalar conformance, trace, worker/session properties
npm run example         # model-only predict, teach, predict
npm run build           # strict TypeScript and production assets
npx playwright install chromium
npm run test:browser     # real browser Predict, arithmetic, Learn, reset
```

Or run `npm run acceptance` after installing Chromium. Browser tests use the production build on port 4173. `test:reference` always means portable Python validation (`1e-30 + 1e-12 * abs(canonical)`); `npm run test:reference:canonical` is a separate byte-verification command tied to the [documented environment](reference/PROVENANCE.md#canonical-byte-exact-regeneration). TypeScript full-precision fixture values are compared using `abs(error) <= 1e-10 + 1e-9 * abs(expected)`; UI decimal formatting does not change canonical evidence. See [fixtures](fixtures/README.md), [provenance](reference/PROVENANCE.md), and [Read the Code](READ_THE_CODE.md).

## Isolation and container

From repository root, stage intended Model Lab sources before the tracked-copy check:

```bash
npm run test:isolation
```

This optional check copies tracked repository files to a fresh temporary directory, runs `npm ci`, portable Python/reference and TypeScript tests, model-only example, production build, and browser tests without sibling source. It leaves the temporary copy path in the log for inspection.

From repository root:

```bash
docker build -f Dockerfile -t model-lab:acceptance .
docker run --rm -p 127.0.0.1:8080:80 model-lab:acceptance
```

The container serves static assets only. The browser executes the scalar model. The repository is standalone; no sibling workshop source is required.

## Scope

This fixture uses one layer, eight embedding features, two heads, eight context positions, three characters plus BOS, and **896 parameters**. Parameter count follows configuration. Model source remains independent of tracing and UI. The evidence player supports immutable replay and explicit missing values; attention arithmetic detail is **derived from observed live Q/K**, not a newly executed model run. Next-token selection uses the highest probability at the selected input position, with no random sampling.

The upstream gist is pinned by revision and SHA-256. The committed Python oracle is independently authored and checked against the original downloaded reference; upstream source is not vendored. The pinned file has no license header; Karpathy later explicitly stated that microgpt is MIT licensed. This pass makes no repository-level licensing decision. See the provenance document for the exact validation command and evidence.

Controlled ablation and matched training-data substitution research are documented in [experiment evidence](docs/experiments-v0.2.md). This slice makes no attack-success or security-effectiveness claims.

## v0.2 evidence and retention

Current Predict retains full private scalar evidence. Learn snapshots actual gradients and every operand contribution before Adam changes parameters or clears gradients. The gradient in the microscope equals the observed gradient consumed by Adam; the optimizer panel expands moments, bias correction, mathematical update and actual representable delta. An advanced whole-run capture exposes measured graph statistics without a graph hairball.

History uses SHA-256 over a canonical binary64 encoding of complete state, including parameter order, moments, schedule, cursor and RNG continuation. The main-thread archive accepts only immutable plain data and validated references. Cached observed detail remains observed; uncaptured historical detail is labelled VERIFIED RECOMPUTATION only after verification passes. A mismatch produces no explanatory graph.

Multi-step training retains every observed loss summary and full experiments at the first step, each loss halving, and final step. Checkpoint comparison uses exact archived runs with compatible model, input, objective, precision, shape and axes. Session capture stops at a conservative 64 MiB evidence estimate (plus one operation of headroom) and asks for Clear session instead of silently deleting history. See [capture benchmark](docs/capture-benchmark.md), [training benchmark](docs/training-benchmark.md), and [v0.2 acceptance](docs/acceptance-v0.2.md).

## Find your starting point

- Run the math without the browser: `npm run example` → [predict, one update, predict](examples/predict-teach.ts).
- Understand the implementation: [Read the Code](READ_THE_CODE.md), beginning with TypeScript `Value` and `backward`.
- Understand evidence, state, and runtime identity: [evidence and operations](docs/evidence-and-operations.md).
- Review current engineering acceptance: [v0.2.1 acceptance](docs/acceptance-v0.2.1.md). [v0.2](docs/acceptance-v0.2.md) and [v0.1](docs/acceptance.md) remain historical records.
- Review measurements: [Guided selection](docs/guided-measurement.md), [capture](docs/capture-benchmark.md), [training](docs/training-benchmark.md).
- Follow the current exhibit rehearsal: [operator runbook](docs/abq-operator-runbook.md) and [overnight review](docs/abq-overnight-review.md). Historical reports retain their original scope and paths.

**HUMAN TEACHING VALIDATION: PENDING.** Automated acceptance tests verify implementation behavior. Actual unfamiliar-user testing follows the [short facilitator checklist](docs/teaching-check.md).
