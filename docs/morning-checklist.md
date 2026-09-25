# ABQ morning checks and evidence levels

The [foundation ledger](foundation-status.md) governs M5 and M6 status. The [operator runbook](abq-operator-runbook.md) gives the current startup and health check; the [teaching check](teaching-check.md) gives the future unfamiliar-user protocol.

| Evidence level | Current record | Limit |
| --- | --- | --- |
| Automated exact-candidate public qualification | The [current record](reviews/pre-M5-current-public-qualification.md) reports `pre-m5-public` PASS, 15/15 browser tests, for commit `ec842f8ff8d0be10ed0a547359333b6e4ad6a859`, tree `fc00de8d766cc49edd537f3f0218638512b8ba26`. | It qualifies that exact candidate only. Browser automation does not prove comprehension or transfer to a later commit. |
| Owner-operated real-device Neo smoke | The owner used and visually checked the MacBook Neo. The primary observed visual blockers were popup/card text overflow; those were repaired, and the owner visually confirmed the main observed Neo issues were fixed. | Owner smoke is not an unfamiliar-user pass, complete station check, or measured comprehension. |
| Unfamiliar-user formative teaching test | **NOT RUN**. | Requires independent M5 foundation acceptance before full unfamiliar-user testing. Do not invent participants, counts, timing, or outcomes. |
| M6 actual-station and release acceptance | **NOT RUN**. | Requires the later station, workshop, and release procedure. No event acceptance is granted. |

## Six unfamiliar-user tasks · pending

After the M5 gate, give each unfamiliar participant the current Guided page without teaching answers first. Record start state, actions, assistance, their own explanation, outcome, and any misconception. Do not use owner smoke or browser checks as participant results.

| Task | Observe | Result |
| --- | --- | --- |
| Find the next-character prediction | Separate read prefix, prediction, and known target. | NOT RUN |
| Explain one forward operation | Point to operands, operation, and a numerical result. | NOT RUN |
| Explore and return | Inspect deeper evidence or a world object and resume Guided without losing context. | NOT RUN |
| Explain gradient accumulation | Separate one retained contribution, running partial, and completed gradient. | NOT RUN |
| Inspect and decide on a candidate | Explain proposal, Accept, Discard, and the one-example comparison. | NOT RUN |
| Explain one optional model experiment | Identify intervention site, observed result, and unchanged accepted model. | NOT RUN |

## Actual station and release checks · NOT RUN

Record exact kit commit/tree and manifest hashes; device, OS, browser, display/scaling, power, and input configuration. Verify offline launch, fonts and workers, readable evidence and decisions at viewing distance, touch and keyboard use, reduced motion, idle warning and opt-out, Public Reset, restart, and any approved local recorded fallback. Record operator and event decisions separately. The brief startup check is in the [runbook](abq-operator-runbook.md); neither it nor automated qualification substitutes for M6.
