# M4-D mutation reconciliation qualification

**Disposition: ENGINEERING-QUALIFIED for the M4-D / FP-11 simulated surviving-authority
coordination slice.** M4 remains **IN PROGRESS**. This report does not qualify a deployed
remote backend, process-restart durability, universal distributed exactly-once execution,
M4-E integration/closure or independent M5 foundation acceptance.

## Candidate identity and scope

- Starting branch and HEAD: `m4-durable-evidence` at
  `00e9d84542751285177a98863fe22c1602d92510`; live `origin/m4-durable-evidence`
  matched before editing.
- Frozen M3 tag: `foundation-v2-m3-qualified^{commit}` remained
  `0f390851d594e73907929f0af0be76ab4cc1032c`.
- Qualified implementation commit: `e3414a4` (`Implement M4-D mutation reconciliation`).
- Starting application runtime:
  `sha256:2a41db3800f10546884d300c8ebfdeb2a69b304afc2242a95b28839528a6259a`.
- Qualified application runtime:
  `sha256:9cedab2d7bbf66d351373f8324f37e6eaaab14763e2a78243f01f9255eb7f594`
  over 127 production inputs.
- Qualified native profile: `pythia-14m-cpu-f32-eager-uncached-generation-v2`.
- Native runtime remained
  `sha256:1e6828657d55bb74295bfc95bd2e7af64d0e7c5516ace241207a7244ff3d012a`;
  no native Pythia file changed and no native requalification ran.

The production addition is a generic coordinator and validator in
`app/worker/mutation-coordinator.ts`. It knows no model arithmetic, parameter names,
Pythia/MLP architecture, intervention semantics, archive recipe or executable payload.
Transport objects are reviewed build-time instances; imported data cannot register one.
The bounded authority and fault transport live only in test support. They simulate an
authority that survives a transport failure in the same process and make no restart-
durability, service, database, cloud, HTTP or WAN claim.

## Identity and protocol contract

One immutable version-1 request contains:

| Identity | Contract |
| --- | --- |
| authority | bounded opaque ID for the reviewed authority instance |
| integration | bounded opaque ID for the reviewed integration binding |
| client | bounded opaque session/client ID |
| operation | bounded stable idempotency key for the logical mutation |
| intent | lowercase `sha256:` digest supplied by integration-specific validation |
| expected state | bounded exact authoritative before-state ID |

The operation, intent and expected-state identities are retained unchanged for every
submission and reconciliation attempt. Display labels, timestamps, list positions and
response order are not identities. The coordinator remains generic over the already
validated integration intent; it does not interpret model operations.

A closed version-1 committed receipt contains authority, integration, client, operation,
intent, before-state, authority-owned after-state and `sha256:` receipt identity plus the
literal `committed` status. Unknown/missing fields, unknown versions or status, invalid
IDs, wrong operation/intent/before state/authority/integration/client, malformed after-
state/receipt identity and conflicting receipts block as integrity errors. The client
never invents the resulting state. A duplicate committed operation returns the exact
stored receipt.

The proof authority holds at most eight ledger entries by default and refuses new work
when full rather than evicting receipts. The coordinator holds at most 64 receipts by
default and refuses before dispatch when its bound is reached. At most one unresolved
mutation exists per stream.

## Coordinator states and transitions

The presentation-ready union distinguishes `READY`, `SUBMITTING`, `COMMITTED`,
`REFUSED`, `INDETERMINATE`, `RECONCILING` and `BLOCKED`. `INDETERMINATE` retains the
operation and expected-state identities plus the ambiguity reason; it is never named
failed, rolled back or discarded.

```text
READY -> SUBMITTING -> COMMITTED | REFUSED | BLOCKED
                    -> INDETERMINATE
INDETERMINATE -> RECONCILING -> COMMITTED
                             -> REFUSED(definitely_not_committed) -> same-ID retry
                             -> BLOCKED(state conflict or integrity)
                             -> INDETERMINATE(unavailable)
```

Only authoritative absence with unchanged current state enables retry. That retry uses
the same request object and therefore the same operation, intent and expected state.
Absence with changed state releases publication capacity, blocks retry and requires an
explicit matching refresh/rebase. Unavailable reconciliation returns to
`INDETERMINATE`; there is no timer or speculative loop. A late exact acknowledgement is
deduplicated against the bounded receipt history and publishes nothing again.

Cancellation or local presentation reset after dispatch can only change the explanatory
reason while retaining `INDETERMINATE`; neither erases the operation nor asserts remote
rollback. Read-only state/authority inspection remains independently possible while the
mutation stream is blocked.

## Fault authority and witnesses

The deterministic local fixture can independently drop a request before delivery, commit
and drop the acknowledgement, delay an acknowledgement, duplicate request or response,
fail reconciliation, advance state through another operation, or return caller-selected
malformed/conflicting reconciliation data. First application validates the intent digest
and expected state, applies once, records its immutable receipt, then returns or loses the
acknowledgement. No model arithmetic occurs in the fixture.

| Witness | Result | Authority applies | Client publications |
| --- | --- | ---: | ---: |
| A normal `S0 -> S1` | committed; next request targeted `S1` | 1 | 1 |
| B commit then lost acknowledgement | `INDETERMINATE`, second mutation blocked; reconcile returned original receipt | 1 | 1 after reconcile |
| C request dropped before authority | authoritative absent at `S0`; same-ID retry committed | 1 total | 1 |
| D duplicate delivery after hidden/normal commit | original receipt returned | 1 | 1 |
| E same operation with changed intent or expected state | hard `operation_conflict`; state/receipt unchanged | 1 | 1 |
| F absent operation after unrelated `S0 -> Sx` | `BLOCKED` conflict; no retry or causation claim | 1 for the other operation | 0 for A |
| G reconciliation unavailable | remained `INDETERMINATE`; one query per explicit call and no churn | 0 | 0 |
| H late and duplicate acknowledgement after reconcile | state unchanged and no duplicate callback/retention commit | 1 | 1 |

Delayed acknowledgement also held `SUBMITTING` and blocked the stream. Direct stale
expected-state and bounded-ledger cases applied zero additional mutations. Malformed and
mismatched reconciliation receipts blocked; none was repaired.

This establishes idempotent authority application by stable operation ID, an
authoritative receipt ledger, expected-state precondition, reconciliation of ambiguous
outcomes and exactly one client publication of the authoritative receipt. It does not
claim arbitrary distributed exactly-once execution.

## Retention, cancellation and local-worker distinction

`MutationPublicationLifecycle` is a narrow hook: the caller may hold an existing C1
reservation or equivalent authority across submit, ambiguity, reconciliation and final
publication without coupling `SessionRetention` to a transport schema. The qualification
used a real `SessionRetention` transaction:

- lost acknowledgement retained one active reservation and published/committed zero;
- reconciled commit consumed that reservation once;
- late acknowledgement left the publish/commit count at one;
- authoritatively absent/unchanged state could retain the reservation for safe same-ID
  retry or explicitly release it; release occurred once;
- absent/changed state released the no-commit publication authority and stayed blocked.

The 32 MiB durable operation policy and all C1 bounds are unchanged. Coordinator state,
pending transport handles and reconciliation attempts are runtime transaction state and
are not serialized into `.mlarchive`.

The canonical worker is intentionally different: it owns mutable state locally, so worker
death destroys private unacknowledged state and T06 restores the last matching acknowledged
snapshot. `ModelWorkerClient` was not changed into a durable remote client and normal Learn
does not use the fault transport. Its existing integration T06 passed. The representative
browser T06 also exposed and corrected a C1 ordering regression: an acknowledged local
worker update is now published before fallible archive admission, while its pre-execution
reservation remains held for one idempotent immutable-evidence retry. The final route
retained accepted step 1 through injected archive admission failure, later cancellation
and worker restart. This preserves the local contract; it is not remote reconciliation.

## Archive, C1/C2 and browser regressions

- Qualified M4-B2 read-only import/re-export remained byte-identical at **13,285,363
  bytes** and
  `sha256:7cef8902cfd6489fe482ee314d8251de4e6eb263e5506df001a76ab20a7d7373`.
- The M4-C1 near-limit archive remained inspectable and exportable; native work refused
  before transport, Clear Session restored canonical Predict and native requests were 0.
- M4-C2 retained navigation preserved bounded run/point windows, exact Pythia index 50,303,
  shape-only/opaque truthfulness and zero native requests.
- M4-B2 browser import kept live accepted state unchanged and refused a tampered
  replacement with zero native requests.
- Canonical cancellation/reset and local T06 candidate acceptance routes passed.

Final browser evidence and report are under
`test-results/scratch/m4d-browser-20260917-04/`; the exact protected build is under
`test-results/scratch/m4d-build-20260917-03/build/`. Original `dist`, historical evidence,
prepared ABQ material, fixtures, oracle and native assets were not replaced.

## Commands and results

| Command / scope | Result |
| --- | --- |
| branch/status/tag plus live `git ls-remote` | PASS; required starting identities matched |
| focused M4-D plus local worker/client tests | PASS, final focused set 16/16 |
| candidate/forward-driver/training/retention/archive/C2 focused regressions | PASS |
| witness-backed `npm test` with localhost access | PASS, 236/236, zero skips |
| `npm run test:reference` | PASS, 17/17; exact structure/identity and zero differing floats |
| `npm run test:reference:canonical` | PASS, 1/1; byte-identical fixture regeneration |
| `npm run typecheck` | PASS |
| `npm run example` | PASS; one real update, 896 parameters updated |
| fresh protected Vite build | PASS, 114 modules; original `dist` untouched |
| representative browser suite | PASS, 5/5 in 39.2 s |
| qualified M4-B2 read-only import/re-export | PASS; exact bytes, ID and byte equality above |

The first unprivileged full-suite attempt passed 233 tests, skipped the optional native
recording and had only two managed-sandbox localhost `EPERM` failures. The permitted
witness-backed rerun passed 236/236. An initial browser allocation used a build directory
without its ownership marker and stopped before execution. The next combined browser run
passed four routes but reproduced the pre-existing C1/local-T06 ordering regression; an
isolated rerun reproduced it. All outputs were preserved rather than reused. After the
ordering repair, the exact rebuilt candidate passed all five final routes.

## Unrun scope and disposition

No real remote service, HTTP mutation server, WebSocket service, database, cloud API,
durable daemon, mutable Pythia/MLP backend, arbitrary plugin mutation, benchmark, soak,
installation isolation, broad CI, aggregate acceptance, M5 review, M6 unfamiliar-user/
workshop/station/release test, deployment, PR or merge ran. No process-restart recovery,
automatic crash recovery or durable remote ledger is claimed.

M4-D engineering-qualifies the implemented remote-transport reconciliation portion of
FP-11 using the bounded simulated authority/transport contract. **M4 stays IN PROGRESS.**
The next dependency is **M4-E integrated M4 qualification and closure**.
