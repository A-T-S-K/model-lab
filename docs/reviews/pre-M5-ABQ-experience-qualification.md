# Pre-M5 ABQ Visitor Experience Stabilization Qualification Review

**Date:** September 17, 2026

**Target Branch:** `pre-m5-abq-experience`

**Starting Source:** `3ac091d02b396e22712a4d02d78368d8c7467879` (tree: `b673f3a43d1093ac542f61e99cfde897e0b83d14`)

**Qualified Implementation Commit:** `9fdf7ffbbb0ee7cacf88463083be3ec8d975f5bf`

**Frozen M4 Authority Baseline:**
- **Tag:** `foundation-v2-m4-qualified`
- **Peeled Commit:** `e2bf601fc65fbfb284ff18750628bc28504602a0`
- **Starting Tree:** `26271ba025bb85c4c8547448e4186780a04bc478`
- **M4 Application Runtime:** `sha256:459dc2d17c226045e20ff00d963f0ddc0f87b0bb73fc8713d4accb6e6d85d702`
- **Native Pythia Runtime:** `sha256:1e6828657d55bb74295bfc95bd2e7af64d0e7c5516ace241207a7244ff3d012a`
- **Qualified M4-B2 Archive:** `13,285,363` bytes (`sha256:7cef8902cfd6489fe482ee314d8251de4e6eb263e5506df001a76ab20a7d7373`)

**Stabilized Application Runtime:**
- **Runtime Hash:** `sha256:1c10060fa68c3ec3ec4c8553a902754420e59d61dedac9c38bf2f164afdd5ab7` (128 runtime source files)

**Disposition:**
`Pre-M5 ABQ Visitor Experience Stabilization = ENGINEERING-QUALIFIED`. This gate qualifies bounded presentation and kiosk walk-up stabilization on `pre-m5-abq-experience`. It establishes progressive disclosure, 3 distinct experience profiles (`visitor`, `facilitator`, `workbench`), persistent profile DOM identification, clean DOM control omissions in visitor mode, a 5-stop sequential short route with detour resumption, paced stepped training with explicit accept/discard choices, authoritative durable retention capacity wording, persistent facilitator idle reset opt-out across Public Reset, responsive 720p layout constraints, and 44px minimum touch targets across viewports. No model mathematics, autograd, optimizer schedules, evidence schemas, archive formats, or durability semantics were modified. Representative workbench regressions (`m3-d-integration.spec.ts`, `m4-b2-portable-archive.spec.ts`, `m4-e-integrated-browser.spec.ts`) pass without regression. Independent M5 foundation review, M6 workshop/release readiness, and full unfamiliar-user testing remain ungranted and NOT_RUN.

---

## 1. Experience Profiles and Authoritative Capability Matrix

To reconcile walk-up kiosk simplicity with deep engineering inspection without code divergence or monolithic branching, `app/presentation/experience-profile.ts` defines three structured profiles and an authoritative capability matrix via `experienceCapabilities(profile, exploringFreely)`:

| Capability | Visitor (`visitor`) | Facilitator (`facilitator`) | Workbench (`workbench`) |
|---|---|---|---|
| **Query Parameter** | `?presentation=spatial&kiosk=1` | `?presentation=spatial&kiosk=1` + `#operator-controls` | `?presentation=spatial` |
| `eventSafety` | `true` | `true` | `false` |
| `researchVariants` | `false` | `false` | `true` |
| `portableArchive` | `false` | `false` | `true` |
| `sharedInspector` | `false` | `false` | `true` |
| `classicToggle` | `false` | `false` | `true` |
| `executionDiagnostics` | `false` | `false` | `true` |
| `defaultSemanticSelectors` | `false` (`true` when `exploringFreely`) | `true` | `true` |
| `teachingSelectors` | `false` (always) | `true` | `true` |
| `headAblation` | `true` | `true` | `true` |
| `donorPatch` | `false` | `false` | `true` |
| `configurableIdleReset` | `false` | `true` | `true` |

### Architectural Invariants
1. **Persistent Profile DOM Identity:** `.spatial-shell` consistently carries `data-experience-profile="visitor"|"facilitator"|"workbench"`.
2. **Teaching Selectors Invariant:** In `visitor` profile, `teachingSelectors` is strictly `false` at all times, including during free exploration (`exploringFreely = true`); only `defaultSemanticSelectors` toggles to `true`.
3. **Execution Diagnostics Invariant:** Debugger stepping controls (`#execution-next`, `#execution-pause`, `#execution-follow`, and execution diagnostics `details`) are gated on `capabilities.executionDiagnostics` and are completely omitted from both `visitor` and `facilitator` modes.

Unit tests in `tests/app/experience-profile.test.ts` verify profile resolution, kiosk defaults, facilitator toggle transitions, workbench preservation, and capability completeness across 5 dedicated tests.

---

## 2. Progressive Disclosure and Visitor DOM Omissions

In visitor mode (`?kiosk=1`), Model Lab preserves the single continuous spatial world while completely omitting unneeded workbench controls from the DOM rather than merely hiding them behind CSS:

- **Shared Inspector:** `#open-shared-inspector` is omitted via `allowOpen=false` passed to `SharedInspector.sync()`.
- **Presentation Toggle:** `#presentation-toggle` is omitted from the spatial header.
- **Portable Archive Controls:** `#portable-archive-host`, `#import-archive`, and `#export-archive` are omitted.
- **Research Variants:** Variant selectors and experimental model branches are omitted.
- **Toolbar & Interventions:** `.learning-toolbar` and `#spatial-patch` are omitted.
- **Raw Execution Stepping:** `#step-prediction`, `#step-learning`, and `#spatial-learn` are omitted from the header.
- **Diagnostic Stepping:** Stepping controls `#execution-next`, `#execution-pause`, and `#execution-follow` are omitted from active execution panels.
- **Visitor Header:** Contains only the single authoritative visitor action: **Public Reset** (`#clear-session`).

Visual verification screenshot: `01-visitor-dom-omissions.png`.

---

## 3. 5-Stop Short Route, Detour Navigation, and Free Exploration

Walk-up visitors are guided through a structured 5-stop route through the live forward computation:

1. **Stop 0 · Prediction:** Chosen position, known target, top predicted token, and full probability distribution. (Screenshot: `02-stop1-prediction.png`)
2. **Stop 1 · Q/K scores:** Query and key dot product projections and scaling. (Screenshot: `03-stop2-scores.png`)
3. **Stop 2 · Softmax:** Causal attention softmax normalization and attention distribution. (Screenshot: `04-stop3-softmax.png`)
4. **Stop 3 · Value mixture:** Attention-weighted value vector mixture $\Sigma \alpha V$. (Screenshot: `05-stop4-mixture.png`)
5. **Stop 4 · Residual:** Concatenation, WO output projection, and residual stream summation. (Screenshot: `06-stop5-residual.png`)

### Navigation Mechanics
- **Sequential Progression:** The primary action button advances sequentially: **Continue: [Next Landmark]** (`#short-continue`) for stops 0–3, transitioning to **Teach: step through learning** (`#short-teach`) at stop 4.
- **Free Exploration:** Visitors may click **Explore freely** (`#visitor-explore-toggle`) to reveal full operation selection.
- **Detour Navigation:** If an off-route operation is selected, the guide clearly indicates `"Exploring a detour"` and presents **Resume short route** (`#short-resume`). Clicking resume restores the active route stop and camera focus while preserving the live execution run ID. (Screenshot: `07-detour-exploration.png`)

---

## 4. Paced Stepped Training and Explicit Candidate Decisions

Stepped training provides walk-up visitors with a calm, paced learning experience without exposing diagnostic debugger controls:

- **Launch:** Activated via **Teach: step through learning** (`#short-teach`) or facilitator stepping.
- **Paced Stepping:**
  - **Run to next gradient contribution** (`#execution-pin`) advances execution to the next matching backward node for the pinned parameter.
  - **Continue** (`#execution-continue`) executes through remaining forward/backward nodes to the candidate completion phase.
  - Diagnostic controls (`#execution-next`, `#execution-pause`, `#execution-follow`) are completely absent from the DOM in visitor mode.
- **Explicit Candidate Decision:**
  - When the proposal reaches **Candidate ready — not accepted**, two unambiguous choices are presented:
    - **Accept update** (`#execution-accept`): Commits the candidate weights into the live accepted model.
    - **Discard candidate** (`#execution-cancel`): Dispatches a cancel command to the worker. The provisional candidate is discarded without updating the accepted model, restoring the prior execution view cleanly.
  - Screenshots: `08-stepped-training-ready.png` (Candidate ready), `09-candidate-discarded.png` (Candidate discarded).

---

## 5. Authoritative Retention Display and Capacity Reporting

To eliminate user confusion regarding page memory vs. durable evidence limits, the facilitator panel renders the exact authoritative retention string:

$$\text{\${runs} retained runs · \${retainedMiB} MiB retained of \${hardLimitMiB} MiB durable archive limit; this is durable retained evidence capacity, not total page/process memory.}$$

### Verification and Hard Retention Boundaries
- **Durable Portable Archive v1 Limits:**
  - **32 MiB** outer archive byte limit
  - **24 MiB** manifest byte limit (25,165,824 bytes)
  - **16 MiB** unique payload byte limit (16,777,216 bytes)
  - **2 MiB** individual payload limit (2,097,152 bytes)
  - **1,000,000** manifest data node limit
- **Admission Backpressure:** Preflight reservation cleanly refuses new executions with `"Retention capacity exceeded"` before any executor contact when capacity is exhausted.
- **Q08 Manifest Length Override Rationale:** In `tests/browser/abq-overnight.spec.ts` (test Q08), a test-only monkeypatch on `TextEncoder.prototype.encode` defines `byteLength` as 24 MiB (`24 * 1024 * 1024` bytes). This simulates manifest capacity exhaustion at the production 24 MiB limit to verify that main-thread preflight capacity refusal and recovery via Public Reset function correctly without generating 24 MiB of live test evidence in memory.
- History is never silently evicted. Discard, cancel, and Public Reset remain fully operational.

---

## 6. Event Safety and Persistent Facilitator Opt-Out

Walk-up kiosk safety requires strict inactivity resets, while live facilitator presentations require uninterrupted sessions:

- **State Separation:** Exhibit mode / event safety (`exhibitEntry`) is decoupled from the idle reset timer (`idleResetEnabled`).
- **Facilitator Opt-Out:** Clicking **Disable idle reset · facilitated session** (`#exhibit-opt-out`) suspends the 300-second inactivity timer while keeping the kiosk safety boundary active (preventing link navigation and file drop).
- **Persistence Across Public Reset:** When **Public Reset** (`#clear-session`) is invoked by a visitor, the session resets to the canonical baseline model and clears visitor history, **while preserving the facilitator's idle reset opt-out configuration**. The button remains in the opt-out state (`"Enable idle reset · 300 seconds"`) until explicitly toggled by an operator.
- Verified in `abq-overnight.spec.ts` (`Q02 facilitated opt-out`) and `pre-m5-abq-experience.spec.ts` (Test 4).

---

## 7. Responsive 720p Layout, Touch Targets, and Accessibility

The stabilized experience was qualified across 1920x1080 and 1280x720 viewports:

- **1280x720 Constraints:**
  - In 1280x720 with operator controls active, `.spatial-world` flex is bounded to 14% (minimum height 45px).
  - `.scene-construction` maintains a minimum height of 155px (exceeding the 150px floor) and strictly satisfies `y + height <= 720px` without vertical viewport overflow.
- **Measured 44px Minimum Touch Targets:**
  - Verified across 1920x1080 and 1280x720 viewports in both visitor and facilitator modes.
  - All primary interactive elements (`#short-continue`, `#short-teach`, `#visitor-explore-toggle`, `#clear-session`, `#execution-pin`, `#execution-continue`, `#execution-cancel`, `#execution-accept`, `.facilitator-landmarks button`, `#operator-controls`, `#exhibit-opt-out`) satisfy `boundingBox.height >= 44px`.
- **Keyboard & Motion Conformance:**
  - Full keyboard accessibility via `Tab` and `Enter` verified. (Screenshot: `12-keyboard-accessible.png`)
  - Reduced motion (`prefers-reduced-motion: reduce`) verified without animation stalls or camera jump artifacts. (Screenshots: `13-entry-1280.png`, `14-route-1280-reduced-motion.png`)
- **Visual Review Disposition (`ENGINEERING VISUAL PASS`):**
  - Engineering visual inspection confirms layout integrity, typography (Instrument Graphite / Plex), contrast, and 720p bounds without clipping. Full unfamiliar-user testing and human visual sign-off remain scheduled for M6 following M5 foundation acceptance.

---

## 8. Verification Results and Automated Conformance

| Test Suite | Command | Result | Conformance Details |
|---|---|---|---|
| **Portable Reference** | `npm run test:reference` | **PASS (17/17)** | Strict float64 numerical conformance; differing floats = 0, max error = 0.0 |
| **Canonical Reference** | `npm run test:reference:canonical` | **PASS (1/1)** | Byte-exact canonical regeneration against golden reference |
| **TypeScript Typecheck** | `npm run typecheck` | **PASS (0 errors)** | Full compilation clean; revision hash generated |
| **Unit & Integration Suite** | `npm test` | **PASS (247/247)** | 247 passed, 0 skipped, 0 failures (with required witnesses and loopback permissions; 245 pass, 2 fail under standard sandbox due to loopback connect EPERM in `abq-launcher.test.mjs` and `runtime-identity.test.mjs`) |
| **Reference Example** | `npm run example` | **PASS (exit 0)** | MicroGPT forward pass, loss, and 896 parameter updates exact |
| **Production Build** | `npm run build` | **PASS (exit 0)** | Vite production bundle built in 166ms |
| **ABQ Overnight Spec** | `playwright test tests/browser/abq-overnight.spec.ts` | **PASS (7/7)** | 7/7 tests passing in 1.6m covering Q01–Q08 overnight matrix, budget fixtures, and opt-out persistence |
| **Pre-M5 Qualification Spec** | `playwright test tests/browser/pre-m5-abq-experience.spec.ts` | **PASS (8/8)** | 8/8 qualification tests passing in 1.8m covering DOM omissions, free explore, 5 stops, detour, Visitor Discard, Visitor Accept, facilitator opt-out, 44px touch targets, and 720p constraints |
| **M3-D Integration Regression** | `playwright.slice.config.ts tests/browser/m3-d-integration.spec.ts` | **PASS (3/3)** | 3/3 tests passing in 15.5s verifying workbench experiment families, stale work cancellation, and canonical state return |
| **M4-B2 Portable Archive Regression** | `playwright.slice.config.ts tests/browser/m4-b2-portable-archive.spec.ts` | **PASS (1/1)** | 1/1 test passing in 18.1s verifying mixed historical archive export, inert import, and tamper refusal |
| **M4-E Integrated Browser Regression** | `playwright.slice.config.ts tests/browser/m4-e-integrated-browser.spec.ts` | **PASS (1/1)** | 1/1 test passing in 44.5s across Routes A, B, and D verifying canonical predictions, oblique projections, head ablation provenance, Pythia inspection, and stepped learning |

---

## 9. Visual Evidence and Artifact Inventory

All visual screenshots and machine-readable summaries were captured during the qualification run and archived under `test-results/scratch/pre-m5-evidence-20260917-08/`:

| Artifact | Dimensions | Verification Scope |
|---|---|---|
| `01-visitor-dom-omissions.png` | 1920x1080 | Complete absence of shared inspector, archive, variant, and toolbar controls |
| `02-stop1-prediction.png` | 1920x1080 | Stop 0 (Prediction): probability distribution and top token |
| `03-stop2-scores.png` | 1920x1080 | Stop 1 (Q/K scores): query/key scores and projection arithmetic |
| `04-stop3-softmax.png` | 1920x1080 | Stop 2 (Softmax): causal attention normalization and probabilities |
| `05-stop4-mixture.png` | 1920x1080 | Stop 3 (Value mixture): attention-weighted value combination $\Sigma \alpha V$ |
| `06-stop5-residual.png` | 1920x1080 | Stop 4 (Residual): output projection and residual addition with `#short-teach` |
| `07-detour-exploration.png` | 1920x1080 | Detour detection and `#short-resume` button |
| `08-stepped-training-ready.png` | 1920x1080 | Stepped learning candidate ready with Accept/Discard buttons |
| `09-candidate-discarded.png` | 1920x1080 | Post-discard state restoring prior execution without updating accepted weights |
| `10-facilitator-panel.png` | 1920x1080 | Facilitator panel with authoritative retention string and landmark buttons |
| `11-workbench-preserved.png` | 1920x1080 | Workbench profile at `/?presentation=spatial` with all controls intact |
| `12-keyboard-accessible.png` | 1920x1080 | Keyboard focus ring and activation on `#short-continue` |
| `13-entry-1280.png` | 1280x720 | 720p entry layout with 44px touch targets |
| `14-route-1280-reduced-motion.png` | 1280x720 | 720p 5-stop route under `prefers-reduced-motion: reduce` |
| `qualification-summary.json` | JSON | Machine-readable qualification descriptor and verified property list |

---

## 10. Summary and Gate Closure Recommendation

Pre-M5 ABQ Visitor Experience Stabilization achieves full stabilization of the walk-up visitor experience without altering Model Lab's foundational architecture, model math, or durability guarantees. All qualification criteria have been verified with zero regressions across the entire test suite.

The branch `pre-m5-abq-experience` is fully qualified and ready for integration. M5 independent foundation review and M6 release readiness remain the governing future milestones.
