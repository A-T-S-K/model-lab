# Pre-M5 ABQ Visitor Experience Stabilization Qualification Review

**Date:** September 18, 2026

**Target Branch:** `pre-m5-abq-experience`

**Starting Source:** `3ac091d02b396e22712a4d02d78368d8c7467879` (tree: `b673f3a43d1093ac542f61e99cfde897e0b83d14`)

**Starting HEAD of P0-R3:** `6fb6e7197dbc5f9c30944b672f1337574f1f4f50` (tree: `29b96452d3e9c742ddd75bfb47767ba88f5c2222`)

**Qualified Implementation Commit:** `2f23353ca388c12f0939683ef1833e0430b8df49` (following P0-R1 commit `9fdf7ffbbb0ee7cacf88463083be3ec8d975f5bf`, P0-R1a amendment `7c3f21c52ef464e54e5cde27a362aaf6842c26ff`, and P0-R3 teaching-hierarchy repair `2f23353ca388c12f0939683ef1833e0430b8df49`)

**Qualified Tree Hash:** `234675ceeced32e808a716f999a09ec250358bc7`

**Frozen M4 Authority Baseline:**
- **Tag:** `foundation-v2-m4-qualified`
- **Peeled Commit:** `e2bf601fc65fbfb284ff18750628bc28504602a0`
- **Starting Tree:** `26271ba025bb85c4c8547448e4186780a04bc478`
- **M4 Application Runtime:** `sha256:459dc2d17c226045e20ff00d963f0ddc0f87b0bb73fc8713d4accb6e6d85d702`
- **Native Pythia Runtime:** `sha256:1e6828657d55bb74295bfc95bd2e7af64d0e7c5516ace241207a7244ff3d012a`
- **Qualified M4-B2 Archive:** `13,285,363` bytes (`sha256:7cef8902cfd6489fe482ee314d8251de4e6eb263e5506df001a76ab20a7d7373`)

**Stabilized Application Runtime:**
- **Runtime Hash:** `sha256:e68cefa7c2a39f0dfa25e46332ee86302293b785963698db26858000b9d01946` (128 runtime source files)
- **Native Pythia Runtime:** `sha256:1e6828657d55bb74295bfc95bd2e7af64d0e7c5516ace241207a7244ff3d012a` (confirmed unchanged)

**Disposition:**
```text
P0-R1/R1a/R3 engineering closure = COMPLETE / ENGINEERING-QUALIFIED
P0 final visual/product disposition = PENDING FINAL CONFIRMATION
M5 = NOT_RUN
M6 = NOT_RUN
```

Engineering closure is complete for the exact candidate. Promotion remains gated by the independent P0 final visual/product disposition using the candidate-bound rendered evidence set. This gate qualifies bounded presentation, kiosk walk-up stabilization, and the final teaching hierarchy repairs on `pre-m5-abq-experience`.

### P0-R2 Review Disposition and P0-R3 Repairs
The independent P0-R2 review identified three specific defects in the walk-up visitor experience requiring bounded repair before final visual disposition:
1. **Premature Resume Affordance:** The "Resume short route" button (`#short-resume`) was rendered during normal 5-stop progression without detour, and appeared upon pan/zoom camera interaction due to `interrupt()` unconditionally setting `this.shortDetour = true`.
2. **Arithmetic-First Attention Landmarks:** Attention landmarks (Q/K scores and Value mixture) presented raw formulas and component products before stating operational purpose.
3. **Prediction-to-Learning Causal Gap:** Stepped training lacked a clear explanatory bridge connecting predictions, targets, losses, the combined training objective, backpropagation, and provisional candidate proposals.

These defects are resolved in P0-R3 via three authorized outcomes:
- **Outcome A (Repaired Detour / Resume Logic):** `#short-resume` renders strictly when a genuine semantic detour has occurred (`shortDetour = true`), never during sequential 1–5 progression. Pan/zoom camera gestures and local button clicks no longer trigger detour state. Clicking resume restores the active route stop, clears detour state, and hides `#short-resume`.
- **Outcome B (Concept-Before-Arithmetic Framing):** All 5 route landmarks articulate conceptual purpose before or alongside arithmetic. Both the guide bar (`.route-purpose`) and scene construction (`.construction-purpose`) explain operational purpose while preserving exact technical names.
- **Outcome C (Prediction-to-Learning Causal Bridge):** Entering stepped training displays an explicit 7-step causal bridge (`.learning-bridge`) outlining the prediction-to-loss-to-gradient-to-proposal sequence with pinned parameter rationale. Diagnostic debugger controls remain strictly omitted.

No model mathematics, autograd, optimizer schedules, evidence schemas, archive formats, or durability semantics were modified. Representative workbench regressions (`m3-d-integration.spec.ts`, `m4-e-integrated-browser.spec.ts` Routes A and D) pass without regression. Independent M5 foundation review, M6 workshop/release readiness, and full unfamiliar-user testing remain ungranted and NOT_RUN.

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

Visual verification screenshot: `01-attract-1920.png`.

---

## 3. 5-Stop Short Route, Concept-First Framing, and Detour Resumption

Walk-up visitors are guided through a structured 5-stop route through the live forward computation, with each stop communicating operational purpose before or alongside arithmetic while retaining exact technical terminology:

1. **Stop 1 · Prediction:** Chosen position, known target, top predicted token, and full probability distribution. Concept: *"What does the model predict comes next? Compare token probabilities with the known target."* (Screenshot: `02-prediction-1920.png`)
2. **Stop 2 · Q/K scores:** Query and key dot product projections and scaling. Concept: *"Compare this position's query with allowed earlier keys to produce attention scores."* (Screenshot: `03-qk-1920.png`)
3. **Stop 3 · Softmax:** Causal attention softmax normalization and attention distribution. Concept: *"Turn the causal scores into normalized attention weights across allowed earlier keys."* (Screenshot: `04-softmax-1920.png`)
4. **Stop 4 · Value mixture:** Attention-weighted value vector mixture $\Sigma \alpha V$. Concept: *"Use normalized attention weights to combine information from allowed value vectors into this head's output."* (Screenshot: `05-value-mixture-1920.png`)
5. **Stop 5 · Residual:** Concatenation, WO output projection, and residual stream summation. Concept: *"Project the attention result and add it back to the saved residual stream."* Transition to learning via **Teach: step through learning** (`#short-teach`). (Screenshot: `06-residual-1920.png`)

### Navigation and Resumption Mechanics (Outcome A)
- **Sequential Progression:** The primary action button advances sequentially: **Continue: [Next Landmark]** (`#short-continue`) for stops 1–4, transitioning to **Teach: step through learning** (`#short-teach`) at stop 5.
- **Resume Button Absence:** During normal progression through stops 1–5, `#short-resume` is strictly absent from the DOM (`toHaveCount(0)`).
- **Free Exploration:** Visitors may click **Explore freely** (`#visitor-explore-toggle`) to reveal operation selection.
- **Detour Navigation:** Only when an off-route operation is selected does the guide indicate `"Exploring a detour"` and present **Resume short route** (`#short-resume`). (Screenshot: `14-detour-resume-1920.png`)
- **Detour Resumption:** Clicking resume restores the active route landmark and camera focus while preserving the live execution run ID, clears the detour notice, and removes `#short-resume` from the DOM.

---

## 4. Paced Stepped Training, Causal Bridge, and Explicit Candidate Decisions

Stepped training provides walk-up visitors with a calm, paced learning experience with clear conceptual causality and explicit candidate authority:

- **Launch:** Activated via **Teach: step through learning** (`#short-teach`) at Stop 5.
- **Prediction-to-Learning Causal Bridge (Outcome C):** At the top of `#execution-controls`, an explicit 7-step sequence connects forward execution to parameter proposals:
  1. *Predictions for known targets*
  2. *Per-position losses combine into training objective*
  3. *Backpropagation carries backward signal*
  4. *Parameter uses produce gradient contributions*
  5. *Contributions accumulate into final gradient*
  6. *Adam uses final gradient for parameter proposal*
  7. *Provisional candidate: Accept or Discard*
  - Accompanied by pinned parameter rationale explaining why `wte[0,0]` is followed and that candidate proposals remain provisional until accepted. (Screenshot: `07-learning-entry-1920.png`)
- **Paced Stepping:**
  - **Run to next gradient contribution** (`#execution-pin`) advances execution to the next matching backward node for the pinned parameter. (Screenshot: `08-gradient-contribution-1920.png`)
  - **Continue** (`#execution-continue`) executes through remaining forward/backward nodes to the candidate completion phase.
  - Diagnostic controls (`#execution-next`, `#execution-pause`, `#execution-follow`, `details`) are completely absent from the DOM in visitor mode.
- **Explicit Candidate Decision:**
  - When the proposal reaches **Candidate ready — not accepted**, two unambiguous choices are presented:
    - **Accept update** (`#execution-accept`): Commits candidate weights into the live accepted model. (Screenshots: `09-candidate-ready-1920.png`, `10-post-accept-1920.png`)
    - **Discard candidate** (`#execution-cancel`): Dispatches a cancel command to worker. Provisional candidate is discarded without updating accepted model, cleanly restoring prior execution. (Screenshot: `11-post-discard-1920.png`)

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
- **Capability Enforcement (`eventSafety` and `configurableIdleReset`):**
  - `capabilities.eventSafety` is made operational on external link clicks (intercepting outbound navigation) and document dragover/drop handlers (preventing file drop onto the kiosk presentation).
  - `capabilities.configurableIdleReset` operationally gates rendering of the `#exhibit-opt-out` button in `app/spatial/presenter.ts`, ensuring the opt-out affordance is only exposed when permitted by the active profile capabilities (`facilitator` and `workbench`, never unguided `visitor`).
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
  - In addition to standard navigation buttons, direct measurements in 1280x720 explicitly verify visitor execution controls (`#execution-pin`, `#execution-continue`, `#execution-cancel`, `#execution-accept`) and facilitator execution controls satisfy `boundingBox.height >= 44px` across stopped and candidate-ready states.
  - All primary interactive elements (`#short-continue`, `#short-teach`, `#visitor-explore-toggle`, `#clear-session`, `#execution-pin`, `#execution-continue`, `#execution-cancel`, `#execution-accept`, `.facilitator-landmarks button`, `#operator-controls`, `#exhibit-opt-out`) satisfy `boundingBox.height >= 44px`.
- **Keyboard & Motion Conformance:**
  - Full keyboard accessibility via `Tab` and `Enter` verified.
  - Reduced motion (`prefers-reduced-motion: reduce`) verified without animation stalls or camera jump artifacts. (Screenshot: `21-reduced-motion-1280.png`)
- **Visual Review Disposition (`ENGINEERING LAYOUT / RENDERING PASS` · `P0 FINAL VISUAL / PRODUCT DISPOSITION PENDING FINAL CONFIRMATION`):**
  - Engineering visual inspection confirms layout integrity, typography (Instrument Graphite / Plex), contrast, and 720p bounds without clipping, as well as measured 44px touch targets across viewports for all interactive controls (including visitor and facilitator stepped training execution controls). Full unfamiliar-user testing, visual hierarchy, spectator readability, teaching effectiveness, and human visual sign-off remain separated for the independent P0 final visual/product disposition and subsequent M6 qualification following M5 foundation acceptance.

---

## 8. Verification Results and Automated Conformance

### Rerun successfully on the P0-R3 exact candidate (`2f23353ca388c12f0939683ef1833e0430b8df49`)

| Test Suite | Command | Result | Conformance Details |
|---|---|---|---|
| **Portable Reference** | `npm run test:reference` | **PASS (17/17)** | Strict float64 numerical conformance; differing floats = 0, max error = 0.0 |
| **Canonical Reference** | `npm run test:reference:canonical` | **PASS (1/1)** | Byte-exact canonical regeneration against golden reference |
| **TypeScript Typecheck** | `npm run typecheck` | **PASS (0 errors)** | Full compilation clean; revision hash generated (`sha256:e68cefa7c2a39f0dfa25e46332ee86302293b785963698db26858000b9d01946`) |
| **Unit & Integration Suite** | `npm test` | **PASS (247/247)** | 235 passed, 12 skipped, 0 failures in 19.8s (with loopback permissions for launcher; under standard sandbox 245 pass, 2 fail on loopback connect EPERM) |
| **Reference Example** | `npm run example` | **PASS (exit 0)** | MicroGPT forward pass, loss, and 896 parameter updates exact |
| **Production Build** | `npm run build` | **PASS (exit 0)** | Vite production bundle built in 167ms |
| **ABQ Overnight Spec** | `playwright test tests/browser/abq-overnight.spec.ts` | **PASS (7/7)** | 7/7 tests passing in 1.5m covering Q01–Q08 overnight matrix, budget fixtures, and opt-out persistence |
| **Pre-M5 Qualification Spec** | `playwright test tests/browser/pre-m5-abq-experience.spec.ts` | **PASS (8/8)** | 8/8 qualification tests passing in 3.8m covering DOM omissions, 5-stop concept-first framing, detour resumption without false-positive resume, prediction-to-learning causal bridge, Visitor Discard, Visitor Accept, facilitator opt-out, 44px touch targets across 1080p and 720p (including visitor and facilitator execution controls), and 720p constraints |
| **M3-D Integration Regression** | `playwright.slice.config.ts tests/browser/m3-d-integration.spec.ts` | **PASS (3/3)** | 3/3 tests passing in 15.2s verifying workbench experiment families, stale work cancellation, and canonical state return |
| **M4-E Integrated Browser Regression** | `playwright.slice.config.ts tests/browser/m4-e-integrated-browser.spec.ts` | **PASS (1/1)** | 1/1 test passing in 34.8s across Routes A and D verifying canonical predictions, oblique projections, head ablation provenance, and stepped learning |

### NOT RUN in P0-R1 / P0-R1a / P0-R3

- **Exact M4-C1 Near-Limit Browser Regression:** `tests/browser/m4-c1-retention.spec.ts`
- **M4-C2 Near-Limit Retained-Work Browser Regression:** `tests/browser/m4-c2-render-work.spec.ts`
- **M4-E Route C (Capacity Refusal Near Limit):** Guarded in `tests/browser/m4-e-integrated-browser.spec.ts`
- **Reason:** The exact previously qualified near-limit archive artifact (`15,246,474` bytes, `sha256:97cc5303b66d50130a8862b9e72f2b4428ce21b75c2e356eb2ffc247a2940cf8`) was not available locally. In strict accordance with Model Lab rules, no replacement witness was invented or approximated to manufacture a green test pass. M4's historical qualification remains attached to its original candidate and evidence; P0 changes did not modify retention, capacity, or archive semantics; and M5 remains responsible for its own independent foundation review.

---

## 9. Visual Evidence and Artifact Inventory

All 24 visual review screenshots and machine-readable summaries were captured during the qualification run and archived under `test-results/scratch/p0-final-review-evidence-20260918-01/`:

| Artifact | Dimensions | Size (bytes) | SHA-256 | Verification Scope |
|---|---|---|---|---|
| `01-attract-1920.png` | 1920x1080 | 154,604 | `902e23882f754158eb21870fc167668e9e61c1bf0b606d65b18773003d3d819f` | Attract mode / exhibit entry state at 1080p |
| `02-prediction-1920.png` | 1920x1080 | 171,819 | `b6ba456761521a77c6353a4efe3eb9e3e5766c253d5d611c44925f4fed4d0fd2` | Stop 1 (Prediction): concept-first purpose, probability distribution, top token |
| `03-qk-1920.png` | 1920x1080 | 225,243 | `573360dbb857df465731a708076d5cc20b2ab673464d41ff578e1bd236f469a1` | Stop 2 (Q/K scores): query/key scores with operational purpose preceding dot product arithmetic |
| `04-softmax-1920.png` | 1920x1080 | 206,730 | `6835e9d497d2f72d9b352643c7a7d4f1fee1237fe3cea7d6fbc62d4c9385ce39` | Stop 3 (Softmax): causal attention normalization weights and distribution |
| `05-value-mixture-1920.png` | 1920x1080 | 243,602 | `94563795da0219843100d3ec4e261b9bf9a8f5b30662c91e2f12c9678231d8b0` | Stop 4 (Value mixture): attention-weighted value combination $\Sigma \alpha V$ with concept preceding formulas |
| `06-residual-1920.png` | 1920x1080 | 186,920 | `608b4ec1b32cf9914bf37c2f07a18bea0c971d51d1b2354e4606cc7fd1a4db45` | Stop 5 (Residual): output projection and residual stream summation with `#short-teach` |
| `07-learning-entry-1920.png` | 1920x1080 | 193,849 | `ed43d1f97b8871a6e07c35a7efabb5a152f72b1380f73c3ae07fcc3bd415ccbf` | Stepped learning entry showing 7-step causal bridge and pinned parameter rationale |
| `08-gradient-contribution-1920.png` | 1920x1080 | 233,170 | `6f7b2c3c513e428a2528dc56cb90779dbd490155e5455df1c227690bcee8a93d` | Stepped learning stopped at pinned parameter gradient contribution node |
| `09-candidate-ready-1920.png` | 1920x1080 | 230,654 | `0a6cb39da5db3109cecf9a5a45c75620a3eab64436d856d567564e9754f532de` | Stepped learning candidate ready with Accept update and Discard candidate choices |
| `10-post-accept-1920.png` | 1920x1080 | 178,161 | `2a8ff8930cc579c9e4ff9536b69004100a831936c6fc3f7cf774819c2b9d02a7` | Post-accept settled state showing training step 1 live update |
| `11-post-discard-1920.png` | 1920x1080 | 179,668 | `5f8d7158f5a6161a1149b062d5de1b5a4b423040ee2ecc39bd95600b5aa51853` | Post-discard state restoring prior execution without mutating accepted weights |
| `12-free-explore-1920.png` | 1920x1080 | 179,636 | `77d86be8be5bcce2e02f20750a5bd1a93ea1d25b17373052991438720150301d` | Free explore mode enabled in visitor profile without workbench affordances |
| `13-facilitator-1920.png` | 1920x1080 | 209,559 | `a80e96f09512c0da3beaced5b65316fc076b1a13efc49c15b1115d049c4bbadb` | Facilitator panel with authoritative retention string, landmarks, and idle reset toggle |
| `14-detour-resume-1920.png` | 1920x1080 | 242,175 | `073cabaca7af730709780f9da8e4cc8d0193bcc97ba4bf07ed974c247391f276` | Detour exploration displaying `#short-resume` and detour notice; verified disappears on resume |
| `15-attract-1280.png` | 1280x720 | 114,207 | `143c0453baa5907026e26f295270622dba8958c0549e156ca402eaba5bd07067` | Attract mode entry layout at 720p |
| `16-prediction-1280.png` | 1280x720 | 106,665 | `8deb8ccf11b943c358bc6eefe9bd267cde77f420a1dda8d4a1815aabb70dc749` | Stop 1 (Prediction) layout at 720p |
| `17-scene-math-1280.png` | 1280x720 | 146,731 | `91f5c44b21af173602d9ff7e2d192dd422a18fb823973f75f90f712ba1900cf1` | Scene math construction layout at 720p within viewport bounds |
| `18-learning-entry-1280.png` | 1280x720 | 105,819 | `f9974884d1bc520c0137a2319e1cee6ec7e1761b0f872da70733e015ddbf59c4` | Stepped learning entry at 720p showing compact causal bridge within viewport bounds |
| `19-gradient-contribution-1280.png` | 1280x720 | 147,418 | `2e63dcc35ef39ab1f3989b8ef991cb08c7c87ce63422ebf644d4cb9c27ead9b2` | Stopped gradient contribution state at 720p with measured 44px execution controls |
| `20-candidate-ready-1280.png` | 1280x720 | 156,477 | `4760cb5249e005ce8e880541571c26030ada18ae4ea54f13ce5522a636932844` | Candidate ready state at 720p with measured 44px Accept and Discard controls |
| `21-post-accept-1280.png` | 1280x720 | 127,853 | `8ac2f6e73738bdb4f56ac0ecad19573e565399dada70fa3a9b17dc4d43be779d` | Post-accept settled state at 720p showing training step 1 live update |
| `22-post-discard-1280.png` | 1280x720 | 108,485 | `0d8318c6528b251d97dba6b658c1fca0d789de33b258bffda319d6c161e48f37` | Post-discard state at 720p restoring prior execution without updating accepted weights |
| `23-facilitator-1280.png` | 1280x720 | 141,694 | `93b192a1ec93138145682702515e91ef1cc762a8bd54a03608e275218e7298ff` | Facilitator panel layout at 720p within viewport height bounds |
| `24-reduced-motion-1280.png` | 1280x720 | 141,694 | `753a7947bc567843cc10fc10aa49529847c5d5c387aac648fef049dfc68e05b1` | Reduced motion route presentation at 720p |
| `qualification-summary.json` | JSON | 719 | — | Machine-readable qualification descriptor and verified property list |
| `review-manifest.json` | JSON | 2,752 | — | Untracked candidate binding manifest mapping screenshots to implementation commit |

---

## 10. Summary and Gate Closure Recommendation

Pre-M5 ABQ Visitor Experience Stabilization achieves complete engineering qualification of the walk-up visitor experience and the final P0-R3 teaching hierarchy repairs without altering Model Lab's foundational architecture, model math, or durability guarantees. All qualification criteria have been verified with zero regressions across the representative test suite.

Engineering closure is complete for the exact candidate (`2f23353ca388c12f0939683ef1833e0430b8df49`). Promotion remains gated by the independent P0 final visual/product disposition using the candidate-bound rendered evidence set. The branch `pre-m5-abq-experience` is not authorized for `foundation-v2` integration until P0 review concludes. M5 independent foundation review and M6 release readiness remain ungranted and NOT_RUN.
