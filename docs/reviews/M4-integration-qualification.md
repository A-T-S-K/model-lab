# M4 integrated durable evidence and qualification review

**Date:** September 17, 2026

**Starting source:** `20c21599b880560de59f2f757c3e3edffce14389` on `m4-durable-evidence`

**Qualified application source:** `b7bddeb` on `m4-durable-evidence`

**Frozen M3 milestone:** `foundation-v2-m3-qualified`

**Candidate application runtime:** `sha256:459dc2d17c226045e20ff00d963f0ddc0f87b0bb73fc8713d4accb6e6d85d702` (127 runtime inputs)

**Qualified native profile:** `pythia-14m-cpu-f32-eager-uncached-generation-v2`

**Qualified native runtime:** `sha256:1e6828657d55bb74295bfc95bd2e7af64d0e7c5516ace241207a7244ff3d012a`

**Qualified M4-B2 archive:**
- bytes: `13,285,363`
- ID: `sha256:7cef8902cfd6489fe482ee314d8251de4e6eb263e5506df001a76ab20a7d7373`

**Qualified M4-C1 near-limit archive:**
- bytes: `15,246,474`
- ID: `sha256:97cc5303b66d50130a8862b9e72f2b4428ce21b75c2e356eb2ffc247a2940cf8`

**Disposition:** `M4 = COMPLETE — scoped engineering qualification`. This closes the M4 engineering gate across durable byte-backed numerical payloads, portable whole-session archive export/import, retained footprint accounting and backpressure, bounded presentation and work limits, mutation reconciliation with ambiguous acknowledgment handling, candidate defect repairs MLR-01 and MLR-02, and cross-slice witness sequences A–I. M5 independent foundation review, M6 workshop/release readiness, and full unfamiliar-user testing remain ungranted and NOT_RUN.

---

## 1. Candidate Repairs: MLR-01 and MLR-02

### MLR-01: Projection Terminology and Geometric Disclosures
- **Defect:** Prior documentation and scene math labelled the 3D-to-2D projection in `project3` and `simplexGlyph` as "orthographic", which is mathematically inaccurate because the projection uses fixed oblique linear cabinet/cavalier axes ($x' = x + z \cos \theta$, $y' = y + z \sin \theta$) rather than orthogonal projection onto a principal plane.
- **Repair:**
  - `app/spatial/geometry.ts`: Updated `project3` docstrings to explicitly state "Fixed oblique linear screen projection" and disclose that screen geometry is a display transform where screen distances and angles may be distorted, while original-space values and arithmetic remain authoritative.
  - `app/spatial/scene.ts`: Updated `simplexGlyph` docstrings and aria/rendered notes to state "Regular 3D tetrahedron, fixed oblique linear screen projection" along with the geometric transform disclosures.
  - `app/spatial/inspector.ts`: Updated `mixture()` and tetrahedron presentation text to describe the oblique projection and display disclosures.
  - `tests/app/projection-wording.test.ts`: Added narrow regression tests verifying `geometry.ts` mathematical behavior and docstring claims, ensuring the rendered output and transform definitions use exact projection terminology without globally banning the word "orthographic" from unrelated contexts.

### MLR-02: Pre-Ablation Provenance and Verification
- **Defect:** In head ablation inspections, pre-ablation arithmetic conflated derived linear reconstructions ($\Sigma \alpha V$) with observed pre-ablation tensor artifacts, and lacked an explicit provenance breakdown.
- **Repair:**
  - `app/spatial/forward.ts`: `explain()` now resolves both the pre-ablation observed tensor artifact (`headOutputBeforeAblation`) from the baseline run and the derived reconstruction ($\Sigma \alpha V$). Provenance for $\Sigma \alpha V$ is explicitly declared as `DERIVED`, even when numerically verified against observed values. Verification uses the live canonical float64 policy:
    $$\Delta = |\text{reconstruction} - \text{observed}| \le 10^{-30} + 10^{-12} \times |\text{observed}|$$
    If the pre-ablation artifact is absent (e.g. historical partial recording), provenance gracefully reports `UNAVAILABLE` and indicates that pre-ablation observation is unavailable while derived reconstruction remains available as DERIVED evidence.
  - `app/spatial/inspector.ts`: Renders an explicit provenance table (`data-testid="pre-ablation-provenance"`) separating Attention probabilities (OBSERVED), V head vectors (OBSERVED), Derived $\Sigma \alpha V$ reconstruction (DERIVED), `headOutputBeforeAblation` (OBSERVED), and replacement-zero `headOutput` (OBSERVED treatment result), accompanied by the canonical verification note (`data-testid="pre-ablation-verification"`).
  - `tests/app/ablation-provenance.test.ts`: Regression suite verifying baseline preservation, ablated zero treatment, derived reconstruction provenance, canonical float64 verification, out-of-bounds handling, historical absence fallback, and corruption detection.

---

## 2. Integrated Cross-Slice Qualification (Sequences A–I)

The candidate was qualified across cross-slice sequences without duplicating monolithic harnesses, reusing existing slice witnesses and adding cross-boundary integration regressions in `tests/integration/m4-cross-boundary.test.ts`:

- **Sequence A (Canonical Baseline & Progression):** Validated exact MicroGPT forward pass, loss calculation, backward gradients, and Adam update progression.
- **Sequence B (Native Pythia & Generation):** Verified uncached FP-09 generation on `pythia-14m-cpu-f32-eager-uncached-generation-v2`, full-prefix execution (`use_cache=False`), full-support argmax, and arbitrary token coordinate extraction (e.g. token coordinate 50303 yielding logit `-3.8919265270233154`).
- **Sequence C (Bounded Byte-Backed Numerical Payloads):** Verified validated byte-backed payload storage, chunked retrieval, bounded tensor slice access, and out-of-bounds query refusals.
- **Sequence D (Portable Whole-Session Archives):** Exported and imported portable archive format v1 (`MLARCHV1`), verifying byte-exact preservation and deterministic re-export (M4-B2 archive `sha256:7cef8902...` exported identically).
- **Sequence E (Retained Accounting & Backpressure):** Verified byte-exact retention accounting, pre-execution capacity refusal at limit before executor invocation (zero executor calls made), and full restoration upon `clearSession()`.
- **Sequence F (Reservation Invalidation across Stale Retention):** Verified in `m4-cross-boundary.test.ts` that if an archive is replaced or session state mutated while a retention reservation is pending, the reservation is invalidated, commit attempts fail with `/Stale retention reservation/`, and the replacement archive remains uncorrupted.
- **Sequence G (Cross-Boundary M3 Experiment Receipts):** Verified portable archive roundtrip for all M3 experiment receipt types (head ablation, donor activation patch, Leaky ReLU activation variant, composite parameterized variant, and matched data experiment), preserving comparison policies (`matched-intervention@1`, `matched-variant@1`, `matched-training-arms@1`) and refusing invalid cross-family comparisons.
- **Sequence H (Availability State Integrity):** Verified truthful handling across all 10 availability states (`available` inline, `available` payload, `not_captured`, `not_applicable`, `unsupported`, `budget_exceeded`, `shape_only`, `opaque`, `pending`, `verification_failed`), ensuring no fake zeros or silent scalar substitutions occur.
- **Sequence I (Mutation Idempotency & Reconciliation):** Verified idempotent mutation coordination, duplicate suppression, safe same-ID retry, and recovery from indeterminate states via authoritative reconciliation.

---

## 3. Automated Test Suite and Conformance

| Test Suite | Command | Result | Details |
|---|---|---|---|
| **Portable Reference** | `npm run test:reference` | **PASS (17/17)** | Strict numerical conformance, differing floats = 0, max abs/rel error = 0.0 |
| **Canonical Reference** | `npm run test:reference:canonical` | **PASS (1/1)** | Byte-exact canonical regeneration against golden reference |
| **Native Pythia Qualify** | `python3 native/pythia/qualify.py` | **PASS (1/1)** | Max error 0.0 against qualified Pythia-14M native weights |
| **TypeScript Typecheck** | `npm run typecheck` | **PASS (0 errors)** | Pretypecheck generates revision matching candidate hash |
| **Example Run** | `npm run example` | **PASS** | Canonical predictions, loss, and 896 parameter updates |
| **Unit & Integration Suite** | `npm test` | **PASS (242/242)** | 0 failures, 0 skipped. Meets and exceeds candidate floor (236 candidate + 6 new tests) |
| **Integrated Browser Spec** | `playwright test` (slice config) | **PASS (1/1)** | Duration: 41.4s. Covers Routes A, B, C, D in `test-results/scratch/m4e-browser-20260917-05` |

*Note on sandboxed test runs:* Standard sandboxed execution passes 240/242 tests with exactly the 2 expected loopback `EPERM` failures (`abq-launcher` and `runtime-identity` network checks). Permitted execution passes all 242/242 tests.

---

## 4. Integrated Browser Qualification (Routes A–D)

Browser qualification was executed using `playwright.slice.config.ts` targeting scratch build `test-results/scratch/m4e-build-20260917-01/build` (original `dist/` untouched) and evidence directory `test-results/scratch/m4e-browser-20260917-05`:

- **Route A (Canonical & Repairs):**
  - Inspected mixture and output simplex geometry; verified "Fixed oblique linear screen projection" and display transform disclosures in `.context-lens`.
  - Executed head ablation; verified `pre-ablation-provenance` table, explicit OBSERVED and DERIVED tags, canonical float64 verification statement, and replacement zero output.
  - Returned to canonical world; verified live prediction complete and live accepted model intact.
  - Screenshots: `m4-e-route-a-oblique-projection-1920.png`, `m4-e-route-a-ablation-provenance-1920.png`, `m4-e-route-a-ablation-provenance-reduced-1280.png`.
- **Route B (Durable Imported Evidence):**
  - Imported qualified M4-B2 archive (`13,285,363` bytes, `sha256:7cef8902...`); verified accepted model unchanged.
  - Navigated Pythia world to invocation `generation:2`, output index `50303`; verified retained logit `-3.8919265270233154` and omitted probability mass `0.3307867347192953`.
  - Re-exported archive and verified byte-exact identity (`sha256:7cef8902...`).
  - Screenshots: `m4-e-route-b-retained-pythia-1920.png`, `m4-e-route-b-retained-pythia-reduced-1280.png`.
- **Route C (Capacity Refusal & Failure Discipline):**
  - Imported near-limit archive (`15,246,474` bytes, `sha256:97cc5303...`).
  - Attempted Pythia generate; verified retention capacity refusal before executor contact (`nativeRequests = 0`).
  - Executed `clearSession()`; restored capacity and verified live canonical prediction.
  - Screenshots: `m4-e-route-c-capacity-refusal-1920.png`, `m4-e-route-c-capacity-refusal-reduced-1280.png`.
- **Route D (Worker & Candidate Lifecycle):**
  - Verified fast accepted Learn path (`spatial-learn`) advances step to 1.
  - Stepped candidate lifecycle (`step-learning` $\rightarrow$ continue $\rightarrow$ phase `ready`); verified "Candidate ready — not accepted" state.
  - Discarded candidate (`execution-cancel`); verified step remains 1 and provisional update is cleanly rolled back without contaminating accepted state.
  - Screenshot: `m4-e-route-d-candidate-ready-1920.png`.

---

## 5. Visual and Accessibility Inspection

- **High-Resolution (1920×1080):** Verified that all provenance tables, mathematical formulas, projection disclosures, Pythia distribution cards, and candidate readiness banners render clearly without clipping, overlap, or layout thrashing.
- **Reduced Motion (1280×720):** Verified that with `prefers-reduced-motion: reduce`, all animations and transitions are suppressed while full numerical, geometric, and semantic meaning is preserved.
- **Keyboard & Focus States:** Confirmed accessible navigation across inspector tabs, details toggles, coordinate inputs, and action buttons, with focus correctly restored after dismiss and cancel operations.

---

## 6. Preservation, Boundaries and Unrun Scope

- **Preservation:**
  - Original `dist/` was not modified.
  - Canonical fixtures (`09670a2658a3bca2...`) and Python oracle (`4fd8aa885b41c...`) remain byte-identical.
  - Historical test results in `test-results/scratch/` were preserved without overwrite or collision.
- **Scope Limits:**
  - M4 qualification is strictly an engineering qualification of durable payloads, archives, retention, and failure handling.
  - No M5 independent foundation review was performed.
  - No M6 unfamiliar-user testing, timed workshop trials, or release packaging was undertaken.
  - M5 and M6 remain **NOT_RUN**.
