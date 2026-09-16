# M4-C1 session-retention qualification

## Disposition

**ENGINEERING-QUALIFIED for the M4-C1 bounded durable-retention, operation-
backpressure and ephemeral-cache slice.** Admitted `SessionArchive` history is not
silently evicted. Exact portable-v1 measurement and conservative multi-dimensional
reservations stop predictable evidence growth before executor contact or canonical
mutation, while derived inspection and training-summary caches have independent finite
policies. M4 remains **IN PROGRESS**. Renderer/work limits and final pending/opaque/
budget-exceeded presentation belong to M4-C2; remote mutation idempotency and ambiguous
acknowledgement reconciliation remain M4-D.

This strengthens the implemented retention/cancellation/cache-lifecycle portion of
FP-11. FP-10 retains its M4-B2 disposition. FP-03 and FP-09 are unchanged.

## Authority and candidate identity

- Starting local HEAD and verified actual remote `origin/m4-durable-evidence`:
  `b8aba8c78270a578c1951124d59067c57c6e96a0`.
- Frozen `foundation-v2-m3-qualified` tag object:
  `0a433a5ecc9a99cb74a0843f84c28cace53c72be`; peeled commit:
  `0f390851d594e73907929f0af0be76ab4cc1032c`.
- Implementation candidate: `56d8a3542172adfdccd14b01cf98a7f4c0fefabb`.
- Qualified application runtime:
  `sha256:7d5b7b2437266ab749f7c4cca119567881ecc5cfa276f344154a9a748575e50f`.
- The qualified native profile remains
  `pythia-14m-cpu-f32-eager-uncached-generation-v2`; native runtime remains
  `sha256:1e6828657d55bb74295bfc95bd2e7af64d0e7c5516ace241207a7244ff3d012a`.
  No native adapter, server, dependency, profile or weight file changed.
- The worktree was clean at start. Original `dist`, prepared ABQ materials, canonical
  fixtures/oracle, pinned Pythia assets and historical M4-A/B1/B2 outputs were preserved.
  All generated evidence used fresh task-owned scratch roots. Two superseded browser
  allocation attempts and earlier fresh builds remain preserved rather than reused.

## Retention ownership and hard boundary

Durable history is the validated content owned by `SessionArchive` and its
`EvidenceStore`: snapshots, direct runs, learning/intervention/model-variant/data
experiments, standalone evidence and referenced numerical payload bytes. It has no LRU,
per-record deletion or payload garbage collector. It leaves the session only through
explicit Clear Session or successful complete portable-archive replacement.

Ephemeral state is separate: recomputed/derived inspection detail, pending inspection
reservations and the training-summary list. Cache eviction never removes archive maps,
payload bytes, run identities, provenance or accepted model state. Pending reservations
are transaction state and do not appear in portable evidence.

The durable hard boundary is portable archive v1: 32 MiB outer bytes plus its existing
24 MiB manifest, 1,000,000 manifest-node, record-count, payload-count and 16 MiB unique-
payload limits. A live commit must remain valid under every relevant dimension, not just
the outer byte count. A close-to-limit valid import remains readable/exportable even
when no supported new operation reservation fits.

## Exact accounting and atomic publication

`measurePortableArchive()` factors the qualified v1 export plan and reports exact framed
archive bytes, manifest bytes/data nodes, payload entries, unique payload bytes and all
record counts without constructing a second complete archive byte array. Actual export
uses the same plan and then copies payload bytes once into the final frame. Measurements
therefore include the 18-byte header, canonical manifest and four-byte length prefix for
every unique payload.

`SessionRetention` owns one session generation and its active reservations. `begin()`
first measures the current archive, adds all active reservations and refuses any portable
dimension that would cross its v1 limit. It then forks the archive through existing
validators over a transaction-local layered payload store. `commit()` remeasures the
candidate, checks the producer stayed within its declaration and publishes the candidate
archive as one pointer change. Failure, cancellation, reset or replacement releases the
reservation. A late candidate tied to an old archive/generation cannot commit. Duplicate
immutable admission measures zero growth; shared payload occurrences retain multiple
evidence occurrences while charging one unique payload.

## Reservation derivation

| Supported family | Bytes | Manifest nodes | Additional structural bound | Derivation |
| --- | ---: | ---: | --- | --- |
| Canonical Predict/Learn/paced/train-many update | 8 MiB | 120,000 | 2 snapshots, 4 direct runs, 1 learning experiment | Fixed canonical capture is at most 1,024 artifacts / 16,384 values per run; one accepted update has fixed before/training/backward/after and snapshot structure. |
| Native/shared Predict/Generate/MLP/noncanonical and inert standalone import | 8 MiB | 250,000 | 2,048 payload entries, 1.6 MB unique payloads, 1 evidence entry | 4,000,000-byte producer envelope + 256,000-byte retained metadata + 200,000 float64 values + framing/canonical-encoding margin. Native generation remains fixed at 1–2 tokens. |
| Head ablation / donor patch | 16 MiB | 300,000 | 3 direct runs, 1 intervention experiment | Registered recipes have fixed two/three successful arms over bounded canonical inputs. |
| Activation/composite model variant | 16 MiB | 300,000 | 1 direct baseline, 1 model-variant experiment | Registered contributions own fixed baseline/variant run sets and bounded state/receipt schemas. |
| Matched data experiment | 16 MiB | 600,000 | 32 snapshots, 64 direct runs, 16 learning experiments, 1 data experiment | M3-C has three fixed arms, four scheduled updates per arm and fixed triggered/control evaluation structure. |

These are conservative producer-contract bounds, not observed averages or display-label
switches. The shared/native declaration lives at the trusted executor boundary; variant
and experiment families use their registered contributions. The exact postcondition
catches an unexpected producer expansion without publishing its staged archive.

Canonical train-many takes a fresh canonical reservation before every next update. Every
completed update is now durably retained. Capacity refusal stops the batch before the
next worker request; there is no execute-then-drop path.

## Import, Clear Session and no-eviction proof

Portable import retains M4-B2 atomic staging, then replaces the retention domain only
after full validation. Exact accounting is recomputed from the imported archive; no UI
counter or file-size proxy is trusted. Replacement invalidates old reservations and
clears inspection/training-summary caches while leaving accepted live model state
unchanged.

Clear Session invalidates reservations, drops the old archive/evidence/payload ownership
graph as a unit, resets both ephemeral caches and creates a fresh archive whose initial
snapshot is measured. No old payload buffer is individually edited. Source inspection,
bounded slices, comparisons, navigation, export, import and Clear Session remain
available when new evidence is blocked.

Source review and pressure tests found no durable deletion path. Cache pressure leaves
archive/evidence IDs and payload IDs unchanged, and export before/after pressure is
byte-identical.

## Ephemeral-cache policies

Historical inspection uses a deterministic LRU with at most 8 entries, 8 MiB total and
2 MiB per pending/committed entry. JSON UTF-8 byte size is counted deterministically.
A pending historical request reserves entry capacity before worker/recomputation contact;
cancel, selection change and stale completion release it. Commit is allowed only for the
same current request. Eviction increments an inspectable counter and produces no claim
that historical evidence was lost; a later supported request may recompute it.

Training summaries are a presentation cache of the latest 500 completed updates. The UI
reports total updates summarized, cached rows and discarded older rows, and explicitly
states that summary eviction does not remove retained update evidence.

## Boundary and failure witnesses

- Valid near-limit witness:
  `sha256:97cc5303b66d50130a8862b9e72f2b4428ce21b75c2e356eb2ffc247a2940cf8`;
  15,246,474 archive bytes, 14,808,112 manifest bytes, 751,779 manifest nodes and
  40 deterministic added canonical predictions. It has 248,221 manifest nodes left,
  below the native family's 250,000-node reservation, while all retained history remains
  a valid portable archive.
- Browser import retained the Pythia generation run and exact output-index 50,303 logit
  `-3.8919265270233154`. Native Generate refused on main-thread retention preflight;
  observed `/execute` request count was zero. History and export remained available.
- Clear Session released the old domain and a normal canonical Predict then completed.
- The train-many boundary test filled a valid mixed archive to slightly more than one
  canonical reservation, executed/retained update N=1, then refused N+1 before executor
  contact. The accepted optimizer step and retained learning experiment are exactly 1;
  executor contacts remained 1.
- Reservation cancellation returned the active count to zero; archive replacement made
  the delayed old candidate stale; its commit refused and a new current reservation could
  use the released capacity.
- Inspection-cache pressure caused at least four LRU evictions while archive run IDs,
  payload IDs and portable bytes remained unchanged.

Disposable interventions, variants and matched data experiments continued to leave the
accepted canonical state unchanged. Imported archive replacement also left live accepted
state unchanged. Existing worker/candidate rollback semantics passed unchanged.

## M4-B2 compatibility

Read-only import, exact measurement and re-export of the qualified M4-B2 witness produced
13,285,363 bytes, 12,847,001 manifest bytes, 18 payload entries / 438,272 unique payload
bytes, and the identical archive ID
`sha256:7cef8902cfd6489fe482ee314d8251de4e6eb263e5506df001a76ab20a7d7373`.
No framing, ordering, payload deduplication, import or tamper behavior changed.

A newly executed full mixed browser session necessarily records the new application
runtime revision and therefore has a different whole-archive hash; this was not used to
replace the qualified B2 witness. Its size remained 13,285,363 bytes and its complete
export/import/Pythia/tamper route passed.

## Commands and results

| Command / scope | Result |
| --- | --- |
| Branch/status/tag plus actual remote `ls-remote` | PASS; required starting identities matched |
| Focused retention/accounting/cache/portable tests | PASS, including optional M4-A and mixed-archive witnesses |
| Witness-backed `npm test` | PASS, 217/217, zero skips |
| `npm run test:reference` | PASS, 17/17; exact structure/identity, zero differing floats |
| `npm run test:reference:canonical` | PASS, 1/1; fixture regenerated byte-for-byte |
| `npm run typecheck` | PASS |
| `npm run example` | PASS; one real update, 896 parameters updated |
| Fresh protected Vite build | PASS, 111 modules; original `dist` untouched |
| Focused M4-C1 1920×1080 browser route | PASS, 1/1; 4.8 s; zero native requests |
| Current-candidate M4-B2 mixed browser regression | PASS, 1/1; 17.5 s; zero native requests |
| Qualified M4-B2 read-only import/measure/re-export | PASS; exact 13,285,363 bytes and qualified ID above |

Final visual evidence is under
`test-results/scratch/m4c1-browser-20260916-04/evidence/test-7K4mqa/`:

- `m4-c1-near-limit-pythia-1920.png` — retained near-limit Pythia evidence;
- `m4-c1-native-refusal-1920.png` — explicit limiting manifest-node refusal;
- `m4-c1-cleared-predict-1920.png` — normal canonical Predict after Clear Session;
- `m4-c1-browser.json` — zero-request/browser receipt.

Visual inspection found the Pythia detail readable, the capacity refusal explicit and
dimensionally truthful, and the cleared canonical route intact at 1920×1080.

## Unrun scope

Per the M4-C1 boundary, no renderer pagination/windowing, generic scene/work limits,
large-axis controls, microscope fanout limits, generic payload-backed presentation,
remote mutation idempotency/ambiguous-acknowledgement reconciliation, native runtime
change/requalification, benchmark, soak, installation isolation, broad CI, aggregate
acceptance, deployment, PR, merge, M5 review, M6 unfamiliar-user/workshop/station test
or release qualification ran. No heap/RAM measurement or performance percentage is
claimed.

## Ledger and next dependency

M4 remains **IN PROGRESS**. M4-C1 adds bounded durable retention, exact portable-v1
accounting, pre-execution backpressure, stale/cancellation controls and bounded ephemeral
cache lifecycle evidence to FP-11. FP-10, FP-03 and FP-09 keep their prior dispositions.
The next dependency is **M4-C2 renderer/work limits and pending/opaque/budget-exceeded
presentation**. M4-D remains separate.
