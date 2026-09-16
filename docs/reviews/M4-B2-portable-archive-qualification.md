# M4-B2 portable whole-session archive qualification

## Disposition

**ENGINEERING-QUALIFIED for the M4-B2 portable export/import slice.** Portable
whole-session archive v1 deterministically preserves the exercised M1–M4 evidence
portfolio, keeps large M4-A values byte-backed and deduplicated, reconstructs only
through reviewed registries and validators, and publishes no archive on any failed
import. M4 remains **IN PROGRESS**. Retention/eviction, renderer/work limits and
pending/opaque behavior belong to M4-C; remote mutation idempotency and ambiguous
acknowledgement reconciliation belong to M4-D.

This disposition completes the implemented portable export/import portion of FP-10 and
engineering-qualifies the M4-B2 bounded inert-import, tamper and atomic-publication
portion of FP-11. It is not independent M5 foundation acceptance.

## Authority and candidate identity

- Starting local HEAD and verified actual remote `origin/m4-durable-evidence`:
  `2c6b30a96ec0adb1a3a1ee032306a92a495d10a7`.
- Frozen `foundation-v2-m3-qualified^{commit}`:
  `0f390851d594e73907929f0af0be76ab4cc1032c`.
- Implementation candidate: `30d18222e57fd85e306fd81c818bd988a07a7730`.
  This report and ledger are a subsequent documentation-only closure commit.
- Starting application runtime:
  `sha256:7adf48a92ab8ce093a18e42f1c2f5edf989b13da042f065743d2d718347449d3`.
- Qualified application runtime:
  `sha256:957c1dc4aee57c654059a481a9c9f2ca073e8725f221a16cc1922c4dd9c08741`.
- Qualified native profile remains
  `pythia-14m-cpu-f32-eager-uncached-generation-v2`; native runtime remains
  `sha256:1e6828657d55bb74295bfc95bd2e7af64d0e7c5516ace241207a7244ff3d012a`.
  Native adapter/server/profile/dependencies/weights were untouched.
- The worktree was clean at start. Original `dist`, prepared ABQ material,
  canonical fixtures/oracle, pinned Pythia assets and all M4-A/B1 outputs were
  preserved. Builds and browser evidence used fresh owned scratch children.

## Container and archive identity

The v1 extension is `.mlarchive`; the filename is convenience only. Parsing is governed
by content magic and version. Framing is:

```text
8 bytes  fixed magic "MLARCHV1"
2 bytes  unsigned big-endian archive version (1)
4 bytes  unsigned big-endian manifest byte length
4 bytes  unsigned big-endian payload-entry count
N bytes  UTF-8 deterministic manifest
repeat payload count times:
  4 bytes unsigned big-endian payload byte length
  M bytes exact immutable numerical payload
EOF      required exactly; trailing bytes refuse
```

V1 is uncompressed, has no path/filename records, and uses no ZIP/TAR, database,
platform object serialization or compression dependency. Each payload identity is
resolved from the sorted manifest descriptor at the same frame index; filenames never
carry identity.

SHA-256 over the complete framed bytes is the archive byte identity. It is not
authentication, a signature or trusted-authorship proof. The final mixed archive is:

- ID: `sha256:7cef8902cfd6489fe482ee314d8251de4e6eb263e5506df001a76ab20a7d7373`;
- total bytes: `13,285,363`;
- manifest bytes: `12,847,001`;
- payload entries: `18`;
- unique payload bytes: `438,272`.

Re-export after complete import reproduced all 13,285,363 bytes exactly. Repeated export
and source archives populated in different map orders also produced identical bytes.
No export timestamp, selection, focus, active mode or wall-clock field exists.

Object keys use sorted UTF-16 order. Maps/record collections sort by immutable identity,
and payload descriptors sort by payload content ID. Semantically ordered arrays—including
parameter order, training steps and generation invocations—retain their original order.
Finite numbers remain numbers; negative zero uses a closed tagged manifest encoding and
round-trips without changing snapshot identities.

## Manifest and explicit exclusions

The closed manifest declares exactly:

- archive format and version;
- snapshots;
- directly admitted legacy/canonical runs;
- learning experiments;
- intervention experiments;
- model-variant experiments;
- data experiments;
- standalone shared-evidence entries;
- sorted numerical payload descriptors.

Definition-aware variant runs are classified through the registered variant contribution
and remain owned by their experiment. They are not guessed from model IDs, labels,
shapes or insertion order and are not passed through legacy `addRun()` admission.

The manifest contains no Worker/DOM objects, active selection, focus, pending Promise,
native endpoint, credentials, process environment, local filesystem path, closure,
executable source, command or automatic-resume declaration. Existing source/module/URL
strings inside evidence remain inert provenance metadata.

## Effective untrusted-input budgets

| Boundary | V1 limit |
| --- | ---: |
| Complete archive | 32 MiB |
| Manifest | 24 MiB |
| Snapshots | 1,024 |
| Direct runs | 4,096 |
| Learning experiments | 4,096 |
| Intervention experiments | 1,024 |
| Model-variant experiments | 1,024 |
| Data experiments | 256 |
| Standalone evidence entries | 1,024 |
| Payload entries | 4,096 |
| One payload | 2 MiB |
| Total payload bytes | 16 MiB |
| Manifest nesting | 64 levels |
| One string | 16,384 UTF-16 code units |
| Parsed manifest data nodes | 1,000,000 |

The existing evidence limits remain 4,000,000 producer-envelope bytes, 200,000 values
per run, 2,048 points, 256 values per presentation slice and 256,000 retained codec-
metadata bytes. A float64 payload at the existing 200,000-value ceiling is 1.6 MB, so
the 2 MiB single-payload limit contains every currently qualified dtype at that ceiling.
The real mixed portfolio uses 13.29 MB / 18 payloads and therefore fits with material
headroom without turning this slice into M4-C retention policy.

Length/count declarations are checked before slicing/importing payload bytes. Unsigned
header lengths cannot exceed the 32 MiB outer bound, and every addition is checked
against remaining bytes and the aggregate payload budget.

## Portable retained-evidence contract

Inline evidence retains its original envelope. Import recomputes and checks its original
evidence content ID before normal registered `admit()`.

Payload-backed evidence uses a closed entry containing:

- entry version and registered codec ID;
- fully validated retained `EvidenceRun`;
- bounded codec metadata retained by M4-B1;
- recorded original producer-envelope content ID;
- portable-entry content ID.

The portable-entry ID hashes the retained run, codec metadata, codec identity and the
recorded original-envelope ID. This covers the preserved claim without claiming that
the discarded giant producer envelope was recomputed. For the M4-A entry:

- original producer-envelope content ID:
  `sha256:421013b4587a19cc2d097fa8cb5fed89b6b7bfa3415798383af72c9f99364190`;
- portable-entry ID:
  `sha256:f9757d9b41be5a87059662b7ea66b94a46f80bec82874475e19672f0bc68a106`;
- whole-archive ID: the distinct value above;
- 18 distinct payload IDs, also separate from run/request/invocation identities.

`validateRetainedRun()` does not weaken producer `validateRun()`. Producer admission
still requires inline available values and refuses storage descriptors from producers.
Retained admission requires every available point to have exactly one qualified path:
validated inline values XOR a validated descriptor backed by imported bytes. Unavailable,
shape-only and opaque points have neither. Descriptor dtype, encoding, endianness,
layout, count, byte length, point dtype/shape, exact bytes and hash all validate.

## Codec-specific retained validation

Portable import cannot treat generic retained shape validation as integration trust.
The registered Pythia codec receives only a bounded slice reader and rechecks the current
qualified profile/runtime, definition/checkpoint/input transform, source revisions,
semantic point/axis/occurrence identities, generation receipt, effective prefix lineage,
tokenizer-label rules, termination and uncached policy.

For each generated choice it scans all 50,304 logits in chunks of at most 256 twice:
first for full-support argmax/maximum/top five and then for the stable-softmax denominator.
It checks selected logit/probability, top-k rows and omitted mass without constructing a
50,304-value presentation array. A recomputed portable-entry ID with a false choice still
refused as not full-support argmax. An entry changed to an unknown codec refused before
any integration logic ran.

## Payload export/import

The numerical payload store adds an archive-only `exportBytes()` that validates the
descriptor and returns a defensive byte copy. Normal UI/presentation access remains
limited to 256 decoded values. Export collects only payloads referenced by retained
portable entries, deduplicates by content ID, checks any repeated descriptor for exact
agreement, and writes each unique payload once.

Import first creates a private `InMemoryNumericalPayloadStore` and uses `importPayload()`
for each frame. Missing, conflicting, unreferenced or extra payload identities refuse.
The M4-A run retains 27 payload-backed occurrences over 18 unique payloads after import;
the equal prefill/first-generation bytes remain deduplicated without merging occurrences.

## Atomic staged reconstruction and inertness

Import order is payloads, snapshots, directly admitted runs, learning experiments,
interventions, model variants, data experiments, standalone shared evidence, then final
collision/completeness audit. Each class uses the same existing validator/registry as
live admission. Archive bytes cannot supply an integration registry, recipe validator,
model definition implementation or executor.

The staging `SessionArchive` and payload store remain local to `importPortableArchive()`.
Only a fully returned archive can replace the browser's historical view. On failure the
caller retains its current archive object; no rollback scheme or private-map mutation is
used. The browser additionally leaves `result`, `liveRunId`, worker and accepted snapshot
untouched.

The importer contains no `eval`, dynamic import from data, shell action, fetch/native
request or worker restore. Unknown codec/recipe/model-definition identities refuse via
reviewed registries. Source, module, URL, JavaScript-like and command-like strings are
ordinary inert data. Strict plain-object/dense-array checks, closed top-level schemas,
string/depth/node budgets and dangerous-field refusal cover prototype/object hazards.

Direct controls exercised wrong magic, truncated header/archive, oversized manifest
declaration, malformed/trailing data, mid/last-byte tampering, missing/conflicting hashes,
unknown codec and false generation choice. Existing validators cover duplicate IDs,
dangling snapshots/runs/arms/donors/variant baselines/data steps, wrong recipes/model
definitions and conflicting immutable identities. Browser corruption of the last payload
produced `Payload hash mismatch`; the valid imported archive stayed selectable and live
step remained 0.

## Mixed-session round trip

The browser constructed a real mixed session from qualified deterministic mechanisms:

- canonical MicroGPT prediction and one accepted learning update;
- head ablation and donor activation patch;
- Leaky ReLU activation model variant;
- composite `W x + s B(Ax)` variant and variant state/resume receipt;
- M3-C clean/treatment/defended matched data experiment;
- read-only admission of the exact M4-A generation recording.

The exported/imported archive contains 10 snapshots, 71 recorded runs, 13 learning
experiments, 2 intervention experiments, 2 model-variant experiments, 1 data experiment,
69 shared evidence runs and one standalone M4-A evidence entry. The apparent 69/71
difference is expected: definition-aware variant runs belong to their registered variant
receipts rather than the legacy evidence codec.

A new browser established an independent canonical live step 0, imported the archive,
and kept that accepted live step unchanged. It then selected the standalone Pythia run
from the new store with no source archive object and no native endpoint. Exact retained
post-import proof:

- `generation:2/logits[50303] = -3.8919265270233154`;
- `generation:2/attention.qkv[511:519] =`
  `[-0.14655473828315735, 2.905082941055298, 3.862351417541504,`
  `-7.279216766357422, -12.423630714416504, 1.786351203918457,`
  `-6.3037872314453125, -0.3044796884059906]`;
- generated choices `[327, 253]`;
- `generation:2` effective prefix `[510, 5798, 2206, 327]`;
- cache capability `unsupported`, `qualified: false`, `useCache: false`,
  `retainedState: false`;
- zero native requests.

## Comparison and old-format behavior

After import:

- strict canonical before/after comparison remained compatible;
- both matched-intervention receipts remained compatible under
  `matched-intervention@1`;
- both registered variant receipts and target-definition identities revalidated;
- the data receipt remained compatible under `matched-training-arms@1`;
- Pythia-to-MicroGPT comparison truthfully refused because representation/definition
  differs;
- Pythia self-comparison truthfully retained its pre-existing refusal because no generic
  comparison policy is qualified for that representation.

`model-lab-json-v1` remains separate and unchanged. The complete suite re-ran legacy
MicroGPT identity tests, historical M2-D native evidence, old standalone JSON parsing,
M1 witness fixtures and all M3 admission paths. Unknown legacy metadata was not invented
and no historical fixture bytes were rewritten.

## Browser controls and visual result

The developer surface exports one local `Blob` and imports one local file. Import swaps
only the historical archive after success, reports the archive ID and explicitly states
that the live accepted model is unchanged. Failure reports a bounded error, preserves
history/live state and returns focus to the file control. Controls are absent when kiosk
mode is enabled; Guided/attract/public reset behavior was not promoted into archive
actions. Import/export is disabled during active ambiguous operations.

Final browser output is under
`test-results/scratch/m4b2-browser-20260916-06/evidence/test-YflzuZ/`:

- `m4-b2-mixed.mlarchive` — exact mixed portable archive;
- `m4-b2-browser.json` — archive/live/native-request receipt;
- `m4-b2-imported-generation-1920.png` — disconnected imported Pythia generation world;
- `m4-b2-tamper-refusal-1920.png` — clear tamper refusal with canonical live step 0;
- `m4-b2-tampered.mlarchive` — one-byte last-payload corruption.

Visual inspection found the imported Pythia evidence readable without clipping or a live
execution claim. The tamper view clearly shows `Archive import refused`, `Payload hash
mismatch` and `Live model step 0`. The archive control remains a developer detail rather
than a kiosk action and auto-opens only to disclose an export/import result beside the
focused control. The new control did not require a compact/reduced-motion route, so no
1280×720 duplicate was added.

## Commands and results

| Command / scope | Result |
| --- | --- |
| Branch/status/tag and actual `git ls-remote` | PASS; required starting identities matched |
| Focused portable archive tests with exact M4-A input | PASS, 4/4 |
| `npm test` with M1 witness, M2-D prediction and M4-A generation recordings | PASS, 213/213, zero skips on implementation commit `30d1822` |
| `npm run test:reference` | PASS, 17/17; exact structure/identity and zero differing floats |
| `npm run test:reference:canonical` | PASS, 1/1; canonical fixture regenerated byte-for-byte |
| `npm run typecheck` | PASS; runtime identity above |
| `npm run example` | PASS; one real update, 896 parameters updated |
| Fresh Vite build to `test-results/scratch/m4b2-build-20260916-05/build` | PASS, 109 modules; original `dist` untouched |
| Focused M4-B2 mixed browser route against that build | PASS, 1/1; 14.1 s total, zero native requests |
| Read-only import/re-export audit of final `.mlarchive` | PASS; byte-identical, counts/IDs/slices above |

One initial unprivileged full-suite invocation passed 211 cases and failed only the two
localhost-listener tests with managed-sandbox `EPERM`. The complete permitted rerun on
the final implementation commit passed 213/213. Two earlier browser attempts preserved
their failed scratch roots: the first exposed a control-host lifetime bug; the second
showed that evidence-world status intentionally overrides the world status line. The
control was moved outside the self-rendering inspector and gained its own status region;
the corrected final routes passed.

## Unrun scope

Per the M4-B2 boundary, no new native generation, native profile/runtime change,
retention/eviction policy, renderer/work-limit qualification, long-session soak,
pending/opaque retention policy, remote mutation transport/reconciliation, benchmark,
installation isolation, broad CI, aggregate release acceptance, deployment, PR, merge,
M5 independent review, M6 unfamiliar-user/workshop/station test or release qualification
ran. No performance or memory percentage is claimed.

## Ledger and next dependency

M4 remains **IN PROGRESS**. FP-10 is recorded **ENGINEERING-QUALIFIED within implemented
scope** for legacy replay plus portable whole-session export/import, preserved identities,
payload-backed round trip and representation-aware comparisons/refusals. FP-11 records
the additional bounded inert-import, tamper and atomic-publication qualification while
retention/work limits and transport reconciliation remain pending. FP-03 and FP-09 keep
their M4-A dispositions unchanged.

The next dependency is **M4-C retention, work/render budgets and pending/opaque behavior**.
M4-D remote mutation reconciliation remains separate. No M4-C or M4-D implementation
was begun.
