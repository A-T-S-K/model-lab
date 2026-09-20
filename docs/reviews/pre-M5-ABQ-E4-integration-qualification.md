# Pre-M5 ABQ P0-E4 Integrated Candidate Qualification and Evidence Reconciliation Review

**Date:** September 19, 2026  
**Target Branch:** `pre-m5-abq-experience`  
**Foundation Authority:** `foundation-v2` (`e2bf601fc65fbfb284ff18750628bc28504602a0`, ahead 15, behind 0 prior to qualification documentation commits)  
**Implementation Candidate HEAD:** `5d4bd623be2ae3e62245057e4c4251538c7749e3`  
**Implementation Candidate Tree:** `52b55f9b2e4dca83362239d5cdf24f66815b3c8a`  
**Application Runtime Hash:** `sha256:90c1951ab839ba7772219c6c8e47527fe5df6bfa1cea984363306c0bf6f5535d` (130 source files)  
**Native Pythia Runtime Hash:** `sha256:1e6828657d55bb74295bfc95bd2e7af64d0e7c5516ace241207a7244ff3d012a`  

---

## Executive Summary & Campaign Gate Disposition

```text
P0-E1 = SEMANTIC PASS
P0-E2 = VISUAL / IA PASS
P0-E3 = LEARNING / SPATIAL PASS
P0-E4 = BLOCKED — required qualification evidence unavailable
P0 FINAL DISPOSITION = PENDING (Candidate Frozen)
M5 = NOT_RUN
M6 = NOT_RUN
```

### Disposition Details (Per Section 33 Authority)
Candidate `5d4bd623be2ae3e62245057e4c4251538c7749e3` has successfully passed **100% of all executable functional, numerical, reference, example, build, browser, and native qualification suites**. Zero application bugs, zero numerical drift, and zero regressions against frozen M4 foundation behavior were observed across 255 Node unit/contract tests, 26 browser integration tests, and 70 native Python comparisons. A complete 29-state candidate-bound visual evidence package was captured and verified across 1920×1080 and 1280×720 viewports.

However, per **Section 33** instructions:
> *"If a required witness is unavailable: Do not write COMPLETE. Write: `P0-E4 = BLOCKED — required qualification evidence unavailable`. Identify exactly: missing witness, expected identity, searches performed, routes/tests prevented, whether a new current-candidate witness could cover some but not all of the historical compatibility requirement. Do not silently defer a known E4 blocker into M5."*

The historical **M4-C1 near-limit archive witness** (`15,246,474` bytes, SHA-256 `97cc5303b66d50130a8862b9e72f2b4428ce21b75c2e356eb2ffc247a2940cf8`) generated during the M4-C1 milestone was not preserved in local persistent storage or git history. While a deterministic candidate witness was generated from the historical M4-B2 archive plus 40 predictions (matching the exact manifest data node count of `751,779`), its SHA-256 is `3950504e41db3ae3ac76ae05b663a4b7f4b4d01a95441e032d9cf92a7135e098` because the candidate application runtime hash is embedded in generated run manifests. This candidate witness proves full functional conformance for M4-C1, M4-C2, and M4-E Route C on the candidate code, but cannot prove byte-for-byte read compatibility against the missing historical archive file `97cc5303...`.

Per platform instructions, E4 is strictly an engineering qualification and evidence reconciliation gate. E4 does NOT self-grant final P0 product acceptance, does NOT merge to `foundation-v2`, does NOT tag or deploy, and does NOT initiate M5 or M6. The candidate implementation is frozen at `5d4bd623be2ae3e62245057e4c4251538c7749e3` for independent foundation review.

---

## 1. Candidate Identity & Live Authority

| Dimension | Exact Value |
|---|---|
| **Repository** | `A-T-S-K/model-lab` |
| **Branch** | `pre-m5-abq-experience` |
| **Foundation Authority Commit** | `e2bf601fc65fbfb284ff18750628bc28504602a0` (`foundation-v2`, M4 qualified) |
| **Pre-E4 Commit Relation** | `foundation-v2..pre-m5-abq-experience` ahead 15, behind 0 |
| **Implementation Candidate Commit** | `5d4bd623be2ae3e62245057e4c4251538c7749e3` |
| **Implementation Candidate Tree** | `52b55f9b2e4dca83362239d5cdf24f66815b3c8a` |
| **Application Runtime Revision** | `sha256:90c1951ab839ba7772219c6c8e47527fe5df6bfa1cea984363306c0bf6f5535d` (130 source files) |
| **Native Pythia Runtime Revision** | `sha256:1e6828657d55bb74295bfc95bd2e7af64d0e7c5516ace241207a7244ff3d012a` |

---

## 2. Change-Surface Audit vs Frozen Foundation (`foundation-v2`)

A full recursive diff between `foundation-v2` (`e2bf601fc65fbfb284ff18750628bc28504602a0`) and the implementation candidate (`5d4bd623be2ae3e62245057e4c4251538c7749e3`) confirms that changes are strictly isolated to **11 presentation files** under `app/`:

```text
 app/main.ts                                |  61 +++++++---
 app/presentation/experience-profile.ts     | 134 ++++++++++++++++++++++
 app/spatial/construction.ts                |  47 +++++---
 app/spatial/contextual-dock.ts             | 177 ++++++++++++++++++++++++++++-
 app/spatial/inspector.ts                   | 214 ++++++++++++++++++++++++++++------
 app/spatial/learning.ts                    | 240 ++++++++++++++++++++++++++++++---------
 app/spatial/presenter.ts                   | 152 ++++++++++++++++++++-----
 app/spatial/public-learning.ts             | 189 +++++++++++++++++++++++++++++++
 app/spatial/scene.ts                       |  98 +++++++++++++---
 app/spatial/style.css                      | 350 +++++++++++++++++++++++++++++++++++++++++++++++++++++++--
 app/views/shared-inspector.ts              |  14 ++-
 11 files changed, 1445 insertions(+), 231 deletions(-)
```

### Invariant Checks
1. **Model Mathematics & Codecs Unchanged:** Zero modifications under `model/`, `trace/`, `archive/`, `inspect/`, `experiments/`, `research/`, `reference/`, `fixtures/`.
2. **Canonical Fixtures & Oracle Preserved:** All canonical reference tensors, float32 tolerances, golden bytes, and Python oracle scripts remain byte-for-byte identical to frozen M4.
3. **Storage & Durable Contract Invariants:** Archive codec v1, manifest schema, payload chunking, backpressure calculations, and retained evidence boundaries are untouched.
4. **Presentation/Profile Isolation:** All ABQ visitor kiosk and facilitator behaviors are gated on `experienceCapabilities(profile, exploringFreely)` without leaking model assumptions into generic store or player infrastructure.
5. **Workbench Preservation:** Expert workbench controls (`#open-shared-inspector`, `#presentation-toggle`, `#portable-archive-host`, `#spatial-patch`, `.learning-toolbar`, full execution diagnostics) remain fully accessible when requested (`?presentation=spatial` without kiosk flag).

---

## 3. Comprehensive Test Accounting

All tests were executed on the exact implementation candidate `5d4bd623be2ae3e62245057e4c4251538c7749e3`.

| Suite / Command | Passed | Skipped | Failed | Total | Duration | Status | Notes |
|---|---|---|---|---|---|---|---|
| `npm run runtime:identity` | 130 files | 0 | 0 | 130 | 0.2s | **PASS** | Hash: `sha256:90c1951ab839...` |
| `npm run typecheck` | 0 errors | 0 | 0 | 0 errors | 4.8s | **PASS** | Strict TypeScript compilation |
| `npm run test:reference` | 17 | 0 | 0 | 17 | 2.1s | **PASS** | Diff floats = 0, max abs error = 0.0 |
| `npm run test:reference:canonical` | 1 | 0 | 0 | 1 | 0.9s | **PASS** | Byte-for-byte golden regeneration |
| `npm run example` | 1 | 0 | 0 | 1 | 1.8s | **PASS** | 896 parameters updated, clean exit 0 |
| `npm run build` | 1 | 0 | 0 | 1 | 3.2s | **PASS** | Built to scratch build root |
| `npm test` (default environment) | **243** | **12** | **0** | **255** | 6.5s | **PASS** | 12 expected witness skips inventoried |
| `npm test` (witness-backed environment) | **255** | **0** | **0** | **255** | 7.8s | **PASS** | Zero skips with supplied witness inputs |
| Native Python `research/pythia/qualify.py` | 1 | 0 | 0 | 1 | 0.57s | **PASS** | maxAbsolute=0.0, maxRelative=0.0 |
| Native Python `research/witnesses/qualify.py` | 70 | 0 | 0 | 70 | 0.82s | **PASS** | 70 tensor checks, maxAbs=0.0, 9 refusals |
| M3-D Browser `tests/browser/m3-d-integration.spec.ts` | 3 | 0 | 0 | 3 | 15.3s | **PASS** | Experiment families, cancellation |
| M4-C1 Browser `tests/browser/m4-c1-retention.spec.ts` | 1 | 0 | 0 | 1 | 12.1s | **PASS** | Near-limit inspectable, native refused |
| M4-C2 Browser `tests/browser/m4-c2-render-work.spec.ts` | 1 | 0 | 0 | 1 | 14.8s | **PASS** | Bounded work, 50303, opaque/shape fallback |
| M4-E Browser `tests/browser/m4-e-integrated-browser.spec.ts` | 4 | 0 | 0 | 4 | 22.4s | **PASS** | Routes A, B, C, D all executed |
| P0 Browser `tests/browser/pre-m5-abq-experience.spec.ts` | 11 | 0 | 0 | 11 | 4.8m | **PASS** | 11 specs, 29 visual captures |
| Overnight Browser `tests/browser/abq-overnight.spec.ts` | 7 | 0 | 0 | 7 | 1.5m | **PASS** | Soak, stability, idle reset |

---

## 4. Skip Inventory & Witness Reconciliation

In the unseeded/default test environment, `npm test` reports **243 passed, 12 skipped, 0 failed (255 total)**. Every skip is an explicit, documented witness condition requiring recorded native Pythia or archive fixtures:

| File | Test Description | Skip Condition | Required Witness / Environment | Status in Witness Run |
|---|---|---|---|---|
| `tests/archive/portable-archive.test.ts` | `re-exports byte-exact M4-B2 mixed archive when qualified fixture is present` | `M4_B2_MIXED_ARCHIVE` unset | `M4_B2_MIXED_ARCHIVE` | **PASSED** (byte-for-byte exact) |
| `tests/inspect/player.test.ts` | `replays native Pythia generation run from qualified witness recording` | `NATIVE_GENERATION_RECORDING` unset | `NATIVE_GENERATION_RECORDING` | **PASSED** (output matched) |
| `tests/model/pythia-adapter.test.ts` | `replays native Pythia prompt and first generated token from recorded fixture` | `WITNESS_RECORDING_DIR` or `NATIVE_RECORDING` unset | `WITNESS_RECORDING_DIR` & `NATIVE_RECORDING` | **PASSED** |
| `tests/model/pythia-adapter.test.ts` | `preserves native Pythia layer and head structure on replay` | `WITNESS_RECORDING_DIR` or `NATIVE_RECORDING` unset | `WITNESS_RECORDING_DIR` & `NATIVE_RECORDING` | **PASSED** |
| `tests/model/pythia-adapter.test.ts` | `verifies native Pythia MLP intermediate projection dimensions` | `WITNESS_RECORDING_DIR` or `NATIVE_RECORDING` unset | `WITNESS_RECORDING_DIR` & `NATIVE_RECORDING` | **PASSED** |
| `tests/model/pythia-adapter.test.ts` | `verifies native Pythia causal attention mask and rotary embedding properties` | `WITNESS_RECORDING_DIR` or `NATIVE_RECORDING` unset | `WITNESS_RECORDING_DIR` & `NATIVE_RECORDING` | **PASSED** |
| `tests/model/pythia-adapter.test.ts` | `verifies native Pythia token embedding and unembedding weight tying` | `WITNESS_RECORDING_DIR` or `NATIVE_RECORDING` unset | `WITNESS_RECORDING_DIR` & `NATIVE_RECORDING` | **PASSED** |
| `tests/model/pythia-adapter.test.ts` | `verifies native Pythia residual stream dimension consistency` | `WITNESS_RECORDING_DIR` or `NATIVE_RECORDING` unset | `WITNESS_RECORDING_DIR` & `NATIVE_RECORDING` | **PASSED** |
| `tests/model/pythia-adapter.test.ts` | `verifies native Pythia layernorm epsilon and normalization statistics` | `WITNESS_RECORDING_DIR` or `NATIVE_RECORDING` unset | `WITNESS_RECORDING_DIR` & `NATIVE_RECORDING` | **PASSED** |
| `tests/model/pythia-adapter.test.ts` | `verifies native Pythia generation stop condition and maximum tokens` | `WITNESS_RECORDING_DIR` or `NATIVE_RECORDING` unset | `WITNESS_RECORDING_DIR` & `NATIVE_RECORDING` | **PASSED** |
| `tests/model/pythia-adapter.test.ts` | `verifies native Pythia temperature and top-k/top-p sampling refusal` | `WITNESS_RECORDING_DIR` or `NATIVE_RECORDING` unset | `WITNESS_RECORDING_DIR` & `NATIVE_RECORDING` | **PASSED** |
| `tests/model/pythia-adapter.test.ts` | `verifies native Pythia detached execution mode without autograd graph` | `WITNESS_RECORDING_DIR` or `NATIVE_RECORDING` unset | `WITNESS_RECORDING_DIR` & `NATIVE_RECORDING` | **PASSED** |

### Supplied Witness Inputs
When provided with the verified witness paths:
```bash
WITNESS_RECORDING_DIR=/Users/joshuahansen/dev/model-lab/test-results/scratch/native-mswcb_ze
NATIVE_GENERATION_RECORDING=/Users/joshuahansen/dev/model-lab/test-results/scratch/p0-r1-pythia-witness-20260917-01/native-generation-recording.json
NATIVE_RECORDING=/Users/joshuahansen/dev/model-lab/test-results/scratch/p0-r1-pythia-witness-20260917-01/native-recording.json
M4_B2_MIXED_ARCHIVE=/Users/joshuahansen/dev/model-lab/test-results/scratch/m4b2-browser-20260916-06/evidence/test-YflzuZ/m4-b2-mixed.mlarchive
```

- Witness Input Hashes:
  - `native-generation-recording.json`: `sha256:e4e388e070020eac77dcbfa35baffa3524b8c64c296d267dd810b29278751a50`
  - `native-recording.json`: `sha256:2d94831f87fd1f08c1f232b598610b121177feeaf397e973a32b7b41c213ea8b`
  - `m4-b2-mixed.mlarchive`: `13,285,363` bytes, `sha256:7cef8902cfd6489fe482ee314d8251de4e6eb263e5506df001a76ab20a7d7373`

The witness-backed run executed **255 passed, 0 skipped, 0 failed, 255 total**.

---

## 5. Archive Witness Reconciliation: Historical vs. Candidate

### Historical M4-B2 Mixed Archive
- **Status:** **VERIFIED & PRESENT**
- **File Location:** `test-results/scratch/m4b2-browser-20260916-06/evidence/test-YflzuZ/m4-b2-mixed.mlarchive`
- **File Size:** `13,285,363` bytes
- **SHA-256:** `7cef8902cfd6489fe482ee314d8251de4e6eb263e5506df001a76ab20a7d7373`
- **Verification:** Tested via `tests/archive/portable-archive.test.ts` and M4-E Route B. In Route B, importing the archive into Model Lab, verifying disconnected Pythia inspection at index `50303` (logit `-3.8919265270233154`), and exporting back to disk yielded an **exact byte-for-byte re-export match** (`13,285,363` bytes, SHA-256 `7cef8902...`).

### Historical M4-C1 Near-Limit Archive (Witness Blocker)
- **Required Identity:**
  - File Size: `15,246,474` bytes
  - Manifest Bytes: `14,808,112` bytes
  - Manifest Nodes: `751,779` nodes
  - SHA-256: `97cc5303b66d50130a8862b9e72f2b4428ce21b75c2e356eb2ffc247a2940cf8`
- **Searches Performed:**
  - Searched all directories under `test-results/scratch/`, prior task outputs, `/tmp/`, and conversation brain logs.
  - While M4-C1 test runner reports (`results.json`) referencing the file exist, the `.mlarchive` file itself was not preserved on local disk.
- **Deterministic Candidate Regeneration:**
  - Generated via documented procedure: importing the historical M4-B2 archive (`13,285,363` bytes) and executing exactly 40 canonical predictions to reach the near-limit threshold.
  - Manifest data node count matched exactly: `751,779` nodes.
  - File Size: `15,207,674` bytes (manifest bytes `14,769,312`).
  - SHA-256: `3950504e41db3ae3ac76ae05b663a4b7f4b4d01a95441e032d9cf92a7135e098`.
  - The byte difference stems from the application runtime hash: generated runs embed the current runtime revision (`sha256:90c1951ab839...`) into the run metadata rather than the frozen M4 runtime revision (`sha256:459dc2d1...`).
- **Saved Candidate Witness:**
  - Preserved at: `test-results/scratch/p0-e4-candidate-witness-20260919-01/candidate-c1-near-limit.mlarchive`
- **Functional Conformance:**
  - When exercised in `m4-c1-retention.spec.ts`, `m4-c2-render-work.spec.ts`, and M4-E Route C, the candidate near-limit archive passes **100% functionally**:
    1. Retained Pythia evidence is inspectable disconnected (logit `-3.8919265270233154` at index 50303).
    2. Native `Generate` is refused before network transport due to retention preflight check.
    3. Zero native `/execute` network requests are made.
    4. `Clear Session` restores retention capacity and re-enables canonical `Predict`.
- **E4 Gate Impact:**
  - Per Section 33, while functional qualification of the candidate code is complete, exact byte-level backward compatibility against the missing historical file `97cc5303...` cannot be proven. Thus, E4 must be reported as `BLOCKED — required qualification evidence unavailable`.

---

## 6. Integrated Browser & Native Regressions

### 1. M4-E Integrated Browser Routes A–D
- Command: `npx playwright test tests/browser/m4-e-integrated-browser.spec.ts` (using project-specific preview server).
- Result: **4 passed (22.4s)**. All four routes explicitly executed:
  - **Route A (MicroGPT Causal/Attention Regression):** Oblique projection wording, display transform disclosures, pre-ablation provenance, OBSERVED vs DERIVED distinction, zero replacement result verified. No regression on MLR-01 or MLR-02.
  - **Route B (M4-B2 Portable Archive & Byte-Exact Export):** Imported `m4-b2-mixed.mlarchive`, verified live model untouched, inspected disconnected Pythia generation `generation:2` at index `50303` (logit `-3.8919265270233154`), re-exported to disk with byte match = `true` (`13,285,363` bytes, SHA-256 `7cef8902...`).
  - **Route C (Retention Backpressure & Clear Session):** Imported candidate near-limit archive (`3950504e...`). Native generation refused before transport with `nativeRequests: 0`. Public Clear Session restored canonical Predict successfully.
  - **Route D (Stepped Candidate Lifecycle):** Stepped candidate proposals remained provisional/private; Discard restored previous accepted state without contaminating accepted parameters.

### 2. M4-C1 Retention Specification
- Command: `M4_C1_NEAR_ARCHIVE=<candidate> npx playwright test tests/browser/m4-c1-retention.spec.ts`
- Result: **1 passed (12.1s)**. Pythia generation inspectable, native work refused before transport, zero network requests, Clear Session restored full capacity.

### 3. M4-C2 Render Work Specification
- Command: `M4_C1_NEAR_ARCHIVE=<candidate> WITNESS_RECORDING_DIR=<witness_dir> npx playwright test tests/browser/m4-c2-render-work.spec.ts`
- Result: **1 passed (14.8s)**. Retained run window bounded, point window bounded, exact Pythia output reachable, shape-only and opaque fallback verified truthful and non-numerical, reduced-motion 1280×720 validated.

### 4. M3-D Integration Regression
- Command: `npx playwright test tests/browser/m3-d-integration.spec.ts`
- Result: **3 passed (15.3s)**. Verified experiment families, cancellation of stale work, return to canonical state, and zero profile leakage.

### 5. Native Python Qualification
- Commands:
  - `research/pythia/.venv/bin/python research/pythia/qualify.py`
  - `research/pythia/.venv/bin/python research/witnesses/qualify.py`
- Results:
  - `qualify.py`: **PASS** (maxAbsolute: `0.0`, maxRelativeWith1e-12Floor: `0.0`, duration `0.568s`).
  - `qualify.py` (witnesses): **PASS** (70 comparisons passed, maxAbs: `0.0`, 9 expected contract refusals verified).

### 6. P0 ABQ Experience & Overnight Suites
- Commands:
  - `npx playwright test tests/browser/pre-m5-abq-experience.spec.ts`
  - `npx playwright test tests/browser/abq-overnight.spec.ts`
- Results:
  - `pre-m5-abq-experience.spec.ts`: **11 passed (4.8m)**. Verified all E1, E2, E3 behavior and captured all 29 visual package states.
  - `abq-overnight.spec.ts`: **7 passed (1.5m)**. Full visitor walkthrough, operator/facilitator controls, touch targets, idle reset opt-out, and continuous spatial rendering passed cleanly.

---

## 7. Full 29-State Visual Evidence Package

A candidate-bound visual evidence package consisting of **29 high-fidelity PNG screenshots** was captured directly from the implementation candidate `5d4bd623be2ae3e62245057e4c4251538c7749e3`.

- **Evidence Directory:** `test-results/scratch/p0-e4-final-evidence-20260919-01/`
- **Brain Artifact Directory:** `/Users/joshuahansen/.gemini/antigravity/brain/3a325773-362b-41b7-8686-9d9806a443f8/`
- **Manifest:** `manifest.json` (`generatedFromExactCandidate: true`)
- **Qualification Summary:** `qualification-summary.json`

### Visual Integrity Audit
All 29 screenshots were directly inspected:
- Dimensions strictly match viewports (20 files at 1920×1080, 9 files at 1280×720).
- File sizes range from 66 KB to 310 KB; zero blank, corrupt, or zero-byte captures.
- No viewport clipping or UI overlap; bottom contextual dock stays within $\le 40\text{vh}$ bound.
- Camera framing maintains active operation visible with `centerInside: true`.

### Complete 29-State Capture Manifest

| # | Filename | Viewport | Actual State Description | SHA-256 Hash |
|---|---|---|---|---|
| 1 | `01-attract-1920.png` | 1920×1080 | Attract state: initial walk-up view with 5-stop guide | `c12574e92eb0949704eefce451458933b93475f3a0937a4e61ea76a8b7dd5d7b` |
| 2 | `02-prediction-payoff-1920.png` | 1920×1080 | Stop 1: Prediction payoff (probs vs target) | `48ce30e527d1ae3ef439b168670df8ec0b57e93bc39833ee7ecf77ddc1aeb6c4` |
| 3 | `03-represent-1920.png` | 1920×1080 | Stop 2: REPRESENT (token + position embedding) | `eb06f8515c13f6ebec15d8f6cc0cb4eefcba250bf58ee691924618e47fe8fa5e` |
| 4 | `04-mix-context-1920.png` | 1920×1080 | Stop 3: MIX CONTEXT (multi-head attention mixing) | `8f58c74070a7dfce92c6e61be9da262b9a79774659b0270a4a6b297bdf721200` |
| 5 | `05-attention-drilldown-1920.png` | 1920×1080 | Stop 3 drilldown: Q/K scores and Softmax | `4ef9a1a7c36a4ef30e599981aa7a01d6706059c25bb7694f5fb2b339fe515908` |
| 6 | `06-transform-1920.png` | 1920×1080 | Stop 4: TRANSFORM (MLP projection & activation) | `26673ea2f654b0c793ffce0c8227b4097f480be63fc5f8e5b4f88c7fb4594bb5` |
| 7 | `07-score-1920.png` | 1920×1080 | Stop 5: SCORE (unembedding logits) | `0e38692736b4477c772c674251ba6d7950c0516644f8092495d0fb02f8fc7ef0` |
| 8 | `08-predict-1920.png` | 1920×1080 | PREDICT: final route stop before Teach transition | `a01ec34c1b9b9426f43e5c70757a62ce9d0ba0dfcf0c2e3528b7fe63df0c0cfb` |
| 9 | `09-free-explore-resume-1920.png` | 1920×1080 | Free exploration detour with Resume affordance | `c76e10037a9fc7ae07f59d4c7bca1be92d53c3d5178619623e192ff62dbe7640` |
| 10 | `10-learning-objective-1920.png` | 1920×1080 | Live learning entry: objective & bridge sequence | `ee30f0f4da047970d4c1d68a964929a60731057db344400cfd3d63bdf3dd0c55` |
| 11 | `11-reverse-path-1920.png` | 1920×1080 | Reverse backprop path in spatial model world | `20d52efd2c0b05b4b73b5f6a96eecde39d3ecdfbbce9ca0d5ba8903c734da250` |
| 12 | `12-live-backward-contribution-explain-1920.png` | 1920×1080 | Live backward contribution: Explain depth | `30a7d5eb4566f10ce09055465bbdff5457ef0c476059d61394c8e7cf0c8cf862` |
| 13 | `13-live-backward-contribution-math-1920.png` | 1920×1080 | Live backward contribution: Math depth | `4e43cc60b6ae20ea3f8c853fa7c64cfb6da3fa5549079549fe52c7104ae05d3b` |
| 14 | `14-adam-pending-1920.png` | 1920×1080 | Backward complete: Adam step pending | `f6ffc6b5bbfcb58ec2d8f93dbd2664d5093f1d46be64b26916a49dbcc6c6bf31` |
| 15 | `15-candidate-ready-1920.png` | 1920×1080 | Candidate ready: provisional update unaccepted | `51f1ea20901e1fb586a113d077dffad83f80c651f5ba8a8342468ee695b28d71` |
| 16 | `16-candidate-compare-1920.png` | 1920×1080 | Candidate compare: dock-only loss & token comparison | `c9ca3306db764ec558b3c959736cbb8e4695eb13ae8b90740a167098e6e58dbf` |
| 17 | `17-post-accept-1920.png` | 1920×1080 | Post-Accept: live model weights updated | `21a6e9a7e6b01ec25ff86df5b9276d420f1cead5b42d5598642938f328f53348` |
| 18 | `18-post-discard-1920.png` | 1920×1080 | Post-Discard: provisional candidate cancelled | `bcf8a221f7e02e1cffdb01cfd5db65ec1dbe7ea63c7bf365778848fc7ae56910` |
| 19 | `19-facilitator-1920.png` | 1920×1080 | Facilitator profile: operator controls visible | `9154f2cfab10e9fcb9dfb27150a0a5aa878ea6a964aee2e7cfaea4d495708892` |
| 20 | `20-workbench-1920.png` | 1920×1080 | Workbench profile: expert diagnostic controls active | `1b356fcfab0e3952f46be220f862660d5b51a0295eb1ba19e48710dd9bc0c5be` |
| 21 | `21-prediction-1280.png` | 1280×720 | 1280×720: Stop 1 prediction view | `971f11e99ea0712798606c4b2239454157d62057d36378c3b7722709219b1652` |
| 22 | `22-forward-route-1280.png` | 1280×720 | 1280×720: Forward route view | `d0fb3e9505470d046f4ebcb75369c76e2759e66cb17fcdd9f1b0a827e7f6fbf4` |
| 23 | `23-deep-math-1280.png` | 1280×720 | 1280×720: Unified contextual dock Math depth | `35582fefc2b53c7c25c34ae4cead6b3ef9a764d0bb0e14a72d31215b49704e6c` |
| 24 | `24-source-1280.png` | 1280×720 | 1280×720: Unified contextual dock Source depth | `3fb0a9969ec0697ce7b4db1cefe699dffbaaa4f509e5b61b7fcf7c79e67a0491` |
| 25 | `25-live-backward-1280.png` | 1280×720 | 1280×720: Live backward learning in model world | `232b7245dd9c1ecfcfcead7bf3a566580f4969bb5a1147a46c24599a07153b8b` |
| 26 | `26-candidate-ready-1280.png` | 1280×720 | 1280×720: Candidate ready proposal state | `47c6a96dd5f3fdfd47781b0be99fe1e55047cc0b9dbd637cff9d71c778fa360c` |
| 27 | `27-candidate-compare-1280.png` | 1280×720 | 1280×720: Candidate compare state | `48f8bc992be7f54cff8e1a1202e08cc175e116e25f187a41aa2d3855a0b83e4c` |
| 28 | `28-facilitator-1280.png` | 1280×720 | 1280×720: Facilitator live learning | `ee0e94bb50be91db028ab6ec0409a80e4cbbf71c50b7f6311654d0089f21f579` |
| 29 | `29-reduced-motion-1280.png` | 1280×720 | 1280×720: Reduced-motion live learning | `20d2c0bbf5b5cfa99d520379965d1d86d67cfca220f862800d9bc7bf08e08d66` |

---

## 8. Preserved Historical Reports & Unrun Gate Scope

- **Historical Reports Preserved:**
  - `docs/reviews/pre-M5-ABQ-experience-qualification.md` (P0-R3 report) remains unchanged with its original identity, commit references, and findings.
  - `docs/reviews/M4-B2-portable-archive-qualification.md`, `M4-C1-retention-qualification.md`, `M4-C2-render-work-qualification.md`, and `M4-integration-qualification.md` remain strictly intact.
- **Unrun Future Gate Scope:**
  - **M5 Independent Foundation Review:** **NOT_RUN**. E4 provides exact engineering candidate qualification; independent foundation review has not been initiated.
  - **M6 Workshop, Station & Release Qualification:** **NOT_RUN**. Full unfamiliar-user evaluation, timed workshop rehearsal, and station qualification remain ungranted.
  - **Promotion to `foundation-v2`:** **NOT_MERGED**. `foundation-v2` remains pinned at `e2bf601fc65fbfb284ff18750628bc28504602a0`.

---

## 9. Next Dependency & Conclusion

The candidate implementation at `5d4bd623be2ae3e62245057e4c4251538c7749e3` is **frozen**. All executable checks pass without flaw.

Next dependency per platform governance:
> **Fresh final read-only P0 product disposition on the exact qualified candidate, followed by a separate independent promotion/diff review before any write to `foundation-v2`.**
