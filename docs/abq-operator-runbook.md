# ABQ operator runbook

**Foundation prerequisite:** full unfamiliar-user testing, timed workshop rehearsal,
actual-station and release qualification follow independent M5 foundation acceptance
at M6. See the [status ledger](foundation-status.md) and [authority map](README.md).
These current MicroGPT/ABQ instructions are retained for that gate and for authorized
internal engineering/visual/accessibility review; old rehearsal passes do not waive it.
Human results remain unrun/pending. This document grants no execution permission.

This is a local engineering rehearsal. Physical station and unfamiliar-user acceptance remain separate gates. Run commands from the standalone repository root unless explicitly inside the prepared kit.

## Prepare before travel

Requires Node 24+, installed project dependencies, Python 3.9+ for reference tests, and the installed Playwright Chromium for engineering checks. Installation/build preparation may need networking. Do not install anything at exhibit startup.

```sh
npm ci
npm run prepare:abq
```

The command builds once and creates `test-results/abq-overnight/release/`: bundled app, model/inspector workers, fonts, notices, hash manifest, `serve.mjs`, and `START-HERE.txt`. It deliberately refuses to overwrite an existing kit. Preserve a qualified kit before preparing a replacement. No source checkout or node_modules is copied. The artifact files are read-only. Node itself must already be installed on the station.

## Offline startup

Stop only your identified project preview before taking its port. Inside the prepared kit:

```sh
node serve.mjs
```

Open **http://127.0.0.1:4173/?presentation=spatial&kiosk=1**. If the port is occupied, the launcher fails without stopping that process. Use `PORT=4175 node serve.mjs` and the corresponding URL if needed. The server binds loopback only. Stop it with Ctrl-C. Ordinary `/` retains Classic entry; `/?presentation=spatial` remains the direct development presentation.

Confirm the connected model and **RECORDED RUN · REPLAY / Recorded real run. Not live.** Start produces a fresh prediction through the same model owner. Idle presentation is static, so it needs no motion loop or recurring model commands. The recording is numerical evidence from this runtime, not a live execution claim.

## Experience profiles and operator procedures

Model Lab presents three distinct experience profiles:
- **Visitor (`visitor`)**: Default walk-up kiosk profile activated via `/?presentation=spatial&kiosk=1`. Applies progressive disclosure over the continuous spatial world. Unneeded workbench controls are omitted from the DOM: Shared Inspector, classic presentation toggle, portable archive host / import / export, research variants, `.learning-toolbar`, `#spatial-patch`, raw execution stepping controls (`#step-prediction`, `#step-learning`, `#spatial-learn`), and diagnostics stepping controls (`#execution-next`, `#execution-pause`, `#execution-follow`). Primary navigation is driven by the 5-stop short route (`#short-continue` for stops 0–3, `#short-teach` for stop 4) with optional Free Exploration toggle and detour resumption. Touch targets maintain a 44px minimum height.
- **Facilitator (`facilitator`)**: Revealed when the operator clicks **Show operator controls** (`#operator-controls`). Exposes the facilitator panel with teaching landmarks (`#short-sample` and direct stop selectors `0`–`4`), authoritative retention capacity status, idle reset opt-out toggle, and operator header controls.
- **Workbench (`workbench`)**: Full engineering inspection Workbench profile accessed at `/?presentation=spatial` (without `kiosk=1`). Contains all research variants, shared inspector, export/import archive capabilities, learning transition toolbar, and full diagnostic stepping controls.

## Visitor and facilitated use

**Start · explore a real prediction** launches a fresh live prediction and opens the 5-stop Short teaching route:
1. **Stop 1 · Prediction**: shows the chosen position, known target, top token and probability distribution.
2. **Stop 2 · Q/K scores**: inspects query/key dot products and scaling.
3. **Stop 3 · Softmax**: inspects causal attention softmax normalization.
4. **Stop 4 · Value mixture**: inspects attention-weighted value combinations.
5. **Stop 5 · Residual**: distinguishes concatenation, WO projection, and residual connection.

The primary action button advances sequentially: **Continue: [Next Landmark]** (`#short-continue`) for stops 1–4, and **Teach: step through learning** (`#short-teach`) at stop 5.
Visitors can click **Explore freely** (`#visitor-explore-toggle`) to open full semantic selection, or take an operation detour. While on a detour, **Resume short route** (`#short-resume`) restores the route landmark and camera focus.

When **Teach: step through learning** is clicked, the visitor steps through learning using paced controls: **Run to next gradient contribution** (`#execution-pin`) advances to the next matching backward node for the pinned parameter, and **Continue** (`#execution-continue`) runs to **Candidate ready — not accepted**. At Ready, the visitor decides explicitly: **Accept update** (`#execution-accept`) or **Discard candidate** (`#execution-cancel`). Diagnostic stepping buttons (`#execution-next`, `#execution-pause`, `#execution-follow`) are omitted in visitor mode.

## Reset, retention, and recovery

**Public Reset** (`#clear-session`) is the visitor reset action: resets to canonical baseline model, clears visitor history, cancels active candidate/intervention, and returns to the initial exhibit entry. Crucially, **Public Reset preserves facilitator configuration**: if the facilitator clicked **Disable idle reset · facilitated session**, the opt-out remains active across resets until explicitly re-enabled.

The authoritative retention display reports durable archive capacity:
`${runs} retained runs · ${retainedMiB} MiB retained of ${hardLimitMiB} MiB durable archive limit; this is durable retained evidence capacity, not total page/process memory.`

Initial field-test idle timing is **300 seconds**, with a **20-second warning**. **Keep this session** renews activity. Pointer, touch, keyboard, and wheel count as activity; background execution/rendering do not. To facilitate without expiry: **Show operator controls → Disable idle reset · facilitated session**. The opt-out persists across Public Reset until **Enable idle reset · 300 seconds** is clicked. For custom timing, set `&idleSeconds=900&warningSeconds=20` in the event URL. Bounds: idle 30–3600 seconds; warning 5–120 seconds, at least five seconds shorter than idle. Setting changes are runtime state, not persisted visitor data.

When durable archive capacity is exceeded, admission backpressure cleanly refuses new executions with `Retention capacity exceeded` until cleared via Public Reset. History is never silently evicted. Cancel, discard, and reset remain available.

On worker/inspection failure, cancel the current action if available, then Clear session to restart from the canonical visitor baseline. Already accepted receipts remain accepted even if later archival failed; public reset is a separate deliberate action. If the app cannot recover, reload and start a new in-memory session. Reload, browser restart and OS reboot do **not** resume transactions or history.

Fallback: play the actual `test-results/abq-overnight/final-media/paced-route.webm` with the label **RECORDED DEMONSTRATION · NOT LIVE**. Keep that file beside the kit when transporting the release materials; no remote URL is required. Do not describe fallback playback as fresh computation.

## Morning checks

Verify kit hashes against `manifest.json`, launch with conference networking unavailable, confirm bundled fonts and source, rehearse a prediction, partial gradient, explicit candidate decision, matched head test and public reset. Consult `abq-overnight-review.md` for actual completed checks and limitations. Complete `morning-checklist.md` on the real station. No browser-shell lockdown, system sleep setting, deployment or event approval is implied.
