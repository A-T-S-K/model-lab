# ABQ operator runbook

Use this for local field operation of the current Guided exhibit. Independent M5 review, unfamiliar-user testing, actual-station checks, and M6 release acceptance remain pending; see the [foundation ledger](foundation-status.md). The [presenter guide](abq-facilitator-guide.md) covers the lesson.

## 1. Candidate and kit identity

Operate only a kit tied by its `manifest.json` commit, tree, runtime identity, and file hashes to the candidate explicitly accepted at the appropriate release gate. The current documentation candidate is provisional, not a frozen release. Keep the kit and its manifest together; verify hashes before use.

## 2. Station prerequisites

Prepare on a machine with Node.js 24+, installed project dependencies, and the build toolchain. The station needs Node.js 24+, a supported browser, local file access, and the prepared kit. The exhibit does not require a WAN connection, source checkout, `node_modules`, or a dependency install at startup. Protect power, display, input devices, and browser availability under the later station gate.

## 3. Build and prepare

From the repository root, after the candidate is chosen and dependencies are installed:

```sh
npm run prepare:abq
```

This runs a build and writes `test-results/abq-overnight/release/`: bundled assets and workers, font notices, `serve.mjs`, `START-HERE.txt`, and a hash manifest. It refuses an existing release directory rather than overwriting it. The kit is made read-only. Preserve any existing qualified kit and use a fresh owned destination for a replacement. `npm ci` is a preparation step only when dependencies are absent; it may need networking.

## 4. Offline startup

From the prepared kit directory:

```sh
node serve.mjs
```

Open `http://127.0.0.1:4173/?presentation=spatial&kiosk=1`. The launcher binds loopback by default. If that port is occupied, stop this launcher and use `PORT=4175 node serve.mjs`, then open the same URL on port 4175. Do not stop an unidentified process to free a port. The optional `MODEL_LAB_HOST=0.0.0.0` bind is a separate, intentional network configuration.

The opening prediction is a recorded replay. **Start · make a prediction** performs fresh local execution.

## 5. Brief operator health check

After launch or restart, check the station without treating this as a full teaching session:

1. Confirm the local page opens, bundled fonts and workers load, and **Start · make a prediction** is visible.
2. Press Start; confirm a fresh Predict result and advance into Part 1.
3. Open **Deep inspection**, inspect a value, and **Return to Guided**.
4. Advance through the forward recap to **Part 2 · learn from an example**. Reach one retained contribution, then continue to the candidate comparison.
5. Choose **Discard candidate**; confirm the accepted model was preserved. Press **Public Reset** and confirm the opening state returns.

A failed check needs investigation and a new check; it is not a release disposition.

## 6. Visitor profile

The kiosk visitor follows the continuous Guided Part 1 prediction and Part 2 learning path. Guided advances through the current concepts; selecting a world object opens Explore, and **Resume route** returns to the same Guided computation. Deep inspection offers Values, Exact Math, and Source; scalar Microscope access appears where available. Visitor controls omit workbench research, archive, and raw diagnostic stepping controls. The completed route offers **Explore the Model** and **Start Over**.

## 7. Facilitator controls

Open `?presentation=spatial&kiosk=1&facilitator=1` for the facilitator profile. **Show operator controls** opens the panel with the authoritative retained archive capacity display and **Disable idle reset · facilitated session**. Facilitators follow the same Guided lesson as visitors; the panel does not replace lesson navigation. **Hide operator controls** closes it. The normal visitor URL does not expose this panel.

## 8. Candidate decision

Training produces a provisional candidate evaluated against the accepted baseline on one example. **Accept update** commits the candidate parameters and optimizer state only after successful acceptance. **Discard candidate** leaves the prior accepted state authoritative. A lower loss on the example, if shown, does not establish general improvement. Do not call a proposal accepted before the receipt completes. If the acceptance result is ambiguous, stop further mutation and reconcile authoritative state.

## 9. Public Reset

**Public Reset** cancels active provisional work, clears visitor history, restores canonical weights, and returns to the recorded opening. It does not turn an unaccepted candidate into an accepted one. A facilitator idle-reset opt-out persists across Public Reset until explicitly re-enabled. Reset is deliberate; use it between visitors after decisions or recovery.

## 10. Idle and reset behavior

The initial kiosk policy resets after 300 seconds without activity, with a 20-second warning. **Keep this session** renews activity. Pointer, touch, keyboard, and wheel input count as activity; background rendering or execution does not. The facilitator opt-out persists across Public Reset. Re-enable with **Enable idle reset · 300 seconds**. URL parameters `idleSeconds` and `warningSeconds` set runtime timing; allowed ranges are 30–3600 and 5–120 seconds, with warning at least five seconds shorter than idle. Settings are reflected in the URL; visitor evidence is not persisted across reload.

## 11. Failure and recovery

If execution or inspection fails, cancel the active action when offered, then use Public Reset for a fresh canonical visitor session. Retention-capacity refusal blocks new execution without silently evicting retained history; reset is the explicit way to clear this public session. Do not infer that an archival failure undid an already accepted update. If the page cannot recover, reload: this starts a new in-memory session, not transaction or history recovery. Keep error text and candidate identity for review.

## 12. Offline fallback

A recorded fallback may be used only if the actual labeled media is present, checked with the release kit, and approved in the later station procedure. The current kit preparation script does not bundle a fallback video. Label any fallback **RECORDED DEMONSTRATION · NOT LIVE** and never describe playback as a fresh prediction.

## 13. End of day and restart

Finish or discard the visitor candidate, use Public Reset, and close the local browser. Stop the identified `serve.mjs` process with Ctrl-C. On restart, launch the same accepted kit, verify its identity, and run the brief health check. A restart does not resume visitor history or an in-flight transaction.

## 14. Morning checks

Use the [morning checklist](morning-checklist.md) for evidence levels and the later actual-station procedure. Operator checks do not establish unfamiliar-user comprehension or M6 acceptance.
