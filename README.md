# Model Lab

An isolated, browser-local scalar GPT teaching experience. Predict exposes the actual forward pass and causal attention arithmetic. Learn applies one real backward/Adam update and reruns the same fixed input. The tiny initial model is untrained; changed probabilities alone are not an improvement claim.

## Run locally

Requires Node 24+, npm, and Python 3.9+ for reference validation.

```bash
cd model-lab
npm ci
npm run dev
```

Open the localhost URL printed by Vite. Enter up to seven characters from `a`, `b`, and `c`. BOS is added automatically. Select a token, model stage, attention head, and causal cell to inspect evidence. Learn trains on the displayed document with shifted character targets and terminal BOS. Reset and Cancel & reset restore the committed initial state; cancellation discards the worker's current session.

All model arithmetic runs in a Web Worker. Core runtime assets are bundled locally: no model API, remote font, dataset download, or WAN access is required after installing/building. Development dependency installation may require Internet access.

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

Optional ablation and poisoning experiments are deferred. This slice makes no attack-success or security-effectiveness claims.
