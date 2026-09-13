# ABQ operator runbook

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

## Visitor and facilitated use

**Start · explore a real prediction** → **Sample abca · q3 / h0 / k0** shows the chosen position, known target, highest-probability token and full distribution. Q/K scores → Softmax → Value mixture → Residual opens scene calculations. For another input, explicitly enter it and Predict; the sample control does not overwrite it. **Values / arithmetic / source** retains exact components, operands, consumers and source. Camera buttons, Home and Back are navigation only. On a 1280px display, collapse the Short teaching route disclosure after choosing a landmark to give the calculation more room, or scroll its local panel; reopen the route to choose another landmark.

**Step through learning** → **Run to next gradient contribution** is the untimed two-action route. Wait for the actual partial accumulator. Continue runs toward **Candidate ready — not accepted**. Compare Current/Candidate, then explicitly **Accept update** or **Discard candidate**. Lower loss on this example does not imply generalization. Never call an idle reset an acceptance decision.

At Weighted values, **Test without this head** runs matched disposable baseline/zeroed-head computations from the selected checkpoint. It does not train the accepted model. Use **Return to current model** afterward. A provisional candidate must first be explicitly accepted/discarded, or cancelled before Ready.

## Reset and recovery

**Clear session** is the public reset: canonical model, empty visitor history, no pending candidate or inspector, valid default selection and Home camera. The next visitor sees the retained idle recording. Reset deliberately clears a previously accepted visitor update as station policy; it does not relabel its acceptance receipt as discarded.

Initial field-test idle timing is **300 seconds**, with a **20-second warning**. **Keep this session** renews activity. Pointer, touch, keyboard and wheel count as activity; rendering/playback do not. To facilitate without expiry: **Show operator controls → Disable idle reset · facilitated session**. For a longer timed session use `&idleSeconds=900&warningSeconds=20` in the event URL. Bounds: idle 30–3600 seconds; warning 5–120 seconds, at least five seconds shorter than idle. Settings are in the URL, not persisted visitor data.

The **64 MiB** limit is an estimated serialized-evidence admission budget plus operation headroom, not a cap on total page/worker/process memory. When admission refuses new work, read the visible reason and Clear session. History is not silently evicted. Cancel/discard/reset remain available. Do not repeatedly click a refused action.

On worker/inspection failure, cancel the current action if available, then Clear session to restart from the canonical visitor baseline. Already accepted receipts remain accepted even if later archival failed; public reset is a separate deliberate action. If the app cannot recover, reload and start a new in-memory session. Reload, browser restart and OS reboot do **not** resume transactions or history.

Fallback: play the actual `test-results/abq-overnight/final-media/paced-route.webm` with the label **RECORDED DEMONSTRATION · NOT LIVE**. Keep that file beside the kit when transporting the release materials; no remote URL is required. Do not describe fallback playback as fresh computation.

## Morning checks

Verify kit hashes against `manifest.json`, launch with conference networking unavailable, confirm bundled fonts and source, rehearse a prediction, partial gradient, explicit candidate decision, matched head test and public reset. Consult `abq-overnight-review.md` for actual completed checks and limitations. Complete `morning-checklist.md` on the real station. No browser-shell lockdown, system sleep setting, deployment or event approval is implied.
