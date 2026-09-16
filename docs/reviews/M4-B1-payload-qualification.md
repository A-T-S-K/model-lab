# M4-B1 byte-backed numerical payload qualification

## Disposition

**ENGINEERING-QUALIFIED for the M4-B1 bounded payload-storage slice.** M4 remains
**IN PROGRESS**. This candidate qualifies validated admission-time conversion of large
numerical evidence to immutable content-addressed bytes, bounded access, integrity
controls, exact float64/float32/int32 decoding, retained M4-A generation inspection and
executor-free replay. It does not implement or qualify a portable whole-session archive,
session retention policy or remote mutation reconciliation. FP-10 and FP-11 therefore
remain open beyond this qualified support, and independent M5 review remains required.

## Authority and candidate identity

- Starting local HEAD and verified remote `origin/m4-durable-evidence`:
  `ffda6da546da078be19f67285f7111e42eaffa59`.
- Frozen `foundation-v2-m3-qualified` tag object:
  `0a433a5ecc9a99cb74a0843f84c28cace53c72be`; peeled milestone commit:
  `0f390851d594e73907929f0af0be76ab4cc1032c`.
- Ending implementation candidate:
  `d5340e85315bd10f7d06f990e6d3a44d51d478d6`. This report and ledger are a
  subsequent documentation-only closure commit.
- Starting application runtime:
  `sha256:ab73bfef4254fee02c48c67cecc2c60394c94ecb995948389618536884c988f4`.
- Qualified ending application runtime:
  `sha256:7adf48a92ab8ce093a18e42f1c2f5edf989b13da042f065743d2d718347449d3`.
- The qualified native generation profile remains
  `pythia-14m-cpu-f32-eager-uncached-generation-v2`; its native runtime remains
  `sha256:1e6828657d55bb74295bfc95bd2e7af64d0e7c5516ace241207a7244ff3d012a`.
  The native adapter, bridge protocol, dependencies, weights and profile were untouched.
- The worktree was clean at start. Original `dist`, prepared ABQ material, canonical
  fixtures/oracle, pinned Pythia assets and historical M4-A outputs were not modified.
  All new build, browser and copied witness inputs are under fresh owned children of
  `test-results/scratch`.

## Payload architecture and policy

Registered codecs continue to accept their existing inline producer envelopes. The
store first validates the envelope and qualified `EvidenceRun`, checks request/evidence
identity, and only then normalizes retained numerical storage. Admission may temporarily
hold decoded JSON arrays; the retained store does not.

The deterministic policy is model-independent: available points with at most 256 values
remain inline; available points with more than the existing 256-value slice ceiling are
byte-backed. Unavailable, not-applicable, unsupported, budget-exceeded, shape-only and
opaque points receive no bytes and no zero substitute. A backed retained point has
`values: null` plus a payload descriptor, while its `availability` remains `available`.

`InMemoryNumericalPayloadStore` owns copied `Uint8Array` bytes without exposing mutable
buffers. Its version-1 descriptor declares:

- `model-lab-numerical-payload-v1` format;
- SHA-256 content ID;
- dtype and element encoding;
- explicit `little-endian` byte order;
- explicit `row-major` layout;
- element count and byte length.

Supported encodings are IEEE-754 binary64, IEEE-754 binary32 and signed int32. Encoding
and decoding use `DataView` with an explicit little-endian flag; host endianness is never
implicit. Payload identity is SHA-256 over the canonical decoding metadata followed by
the exact numerical bytes. Dtype, element encoding, byte order, layout, element count
and byte length therefore participate. Shape is not treated as decoding identity; the
point's qualified shape product is separately required to equal the descriptor's element
count. Equal metadata and bytes deduplicate, without merging evidence occurrences.

`EvidenceStore.contentId()` retains its prior meaning: the hash of the original admitted
envelope. A payload ID is a separate storage identity and does not replace run, request,
invocation, checkpoint, profile, runtime or evidence identity. For a backed run the full
source envelope is discarded after normalization. Only registered bounded codec metadata
is retained; it has a 256,000-byte ceiling and refuses any numerical array longer than
256. `envelope()` deliberately refuses for these runs instead of rematerializing them;
`metadataEnvelope()` serves bounded presentation metadata. Historical
`model-lab-json-v1` serialization/parsing is unchanged for original envelopes and small
inline retained envelopes. Portable export of backed sessions belongs to M4-B2.

## Bounded access, player and presentation

`EvidenceStore.slice(runId, pointId, start, count)` remains the single direct numerical
read and enforces nonnegative safe integers, `count <= 256`, strict end bounds, exact
dtype decoding and an immutable returned array. Missing runs, points or payloads fail.
`EvidencePlayer` now uses qualified shape/count rather than assuming `current.values` is
materialized.

The shared inspector and Pythia world use store slices for exact scalar and small slice
access. Generic full-support softmax derives maximum, denominator, top-k and selected
probability in two bounded passes without returning a full tensor. Generation views use
the already-qualified retained top-k/omitted-mass receipt; arbitrary output inspection
reads one exact logit and does not invent an unretained probability. Save/export controls
are disabled for backed runs until M4-B2 can define the portable container. Source access
remains metadata-only, and navigation/seek/step never invokes an executor.

## Exact codec and integrity results

- Float64 round-tripped positive, negative, fractional, `+0` and `-0` exactly.
- Float32 round-tripped values already exact under `Math.fround`, including `+0` and
  `-0`; arbitrary doubles were refused as float32.
- Int32 round-tripped `-2147483648`, negative, zero and `2147483647` exactly; overflow
  was refused.
- `Object.is(decodedNegativeZero, -0)` passed for binary64 and binary32.
- Identical raw bytes interpreted as float32 `1` and int32 `1065353216` received distinct
  IDs. Repeated identical dtype/metadata/bytes deduplicated. Reordered descriptor object
  fields did not change identity.
- Unknown format, unsupported dtype/encoding/byte order/layout, malformed ID, byte-length
  mismatch, element-count/shape mismatch, dtype/point mismatch, changed bytes, hash
  mismatch, nonfinite float32 bytes, int32 overflow, truncated bytes, missing payload and
  oversized/nonsensical slices all refused.
- Direct and store-level slice tests covered first value, middle, exact end, 256 values,
  count 257, negative start/count, start beyond end, crossing the end, unavailable point,
  unknown run, unknown point and absent backing storage. No case clamped silently.

## Real M4-A stress witness

The exact qualified recording was reused read-only and copied byte-for-byte into fresh
task-owned test input. Its SHA-256 is
`e4e388e070020eac77dcbfa35baffa3524b8c64c296d267dd810b29278751a50`;
the JSON remains 3,194,555 bytes with 35 points and 163,860 numerical values.

- Run identity stayed `qualification:qualification-generate`; request, cancellation
  epoch, profile, runtime, checkpoint, invocation, choice and source identities remained
  unchanged. Original envelope content ID stayed
  `sha256:421013b4587a19cc2d097fa8cb5fed89b6b7bfa3415798383af72c9f99364190`.
- 27 point references became payload-backed and 8 available scalar/small points remained
  inline. Those references address 18 unique payloads / 438,272 unique stored bytes.
  Deterministic structural inspection found zero retained numerical arrays longer than
  256 in the run or bounded codec metadata.
- All three 50,304-element logits occurrences are backed descriptors of 201,216 bytes.
  `prefill:0/logits` and `generation:1/logits` legitimately deduplicate to
  `sha256:2ad698672b618265bcac8840fda692d24af3c1d09d716afe37588481a31fcee4`
  because their exact prefixes, bytes and decoding metadata match. The distinct
  `generation:2/logits` payload is
  `sha256:eb4cee8f90d85ad5a8276ab08403b3d3c74ff42163da273eff3a5805c4ae6c2f`.
  The three evidence occurrences remain distinct.
- Bounded output index 50,303 decoded exactly as `-3.8919265270233154`.
- The selected `generation:2/attention.qkv` slice at flat offsets 511–518 decoded exactly
  as `[-0.14655473828315735, 2.905082941055298, 3.862351417541504,
  -7.279216766357422, -12.423630714416504, 1.786351203918457,
  -6.3037872314453125, -0.3044796884059906]`.
- Choice evidence remained separate inline int32 derived evidence. Cache remained
  unsupported/unqualified, and the selected activation source remained
  `transformers/models/gpt_neox/modeling_gpt_neox.py`.
- A new store with no executor independently admitted the same original envelope and
  reproduced retained metadata, payload IDs, player navigation and exact slices. The
  browser replay issued zero native requests.

## Compatibility and regression result

Canonical legacy MicroGPT, noncanonical MicroGPT, native MLP/SGD float32, grouped-axis
numerical fixtures, shape-only and opaque fixtures, historical M2-D Pythia prediction,
the current M4-A generation codec, M3 variants/experiments and `SessionArchive` coverage
all passed in the final suite. Old JSON envelopes admit without rewriting fixture bytes.
Strict representation comparison remains unchanged for existing inline codecs; a future
comparison policy that requires unavailable original backed-envelope data refuses rather
than globally materializing tensors. Canonical reference bytes and regenerated snapshot
bytes remained exact.

## Commands and results

| Command / scope | Result |
| --- | --- |
| Status, HEAD, tag object/peeled commit and actual remote `ls-remote` | PASS; starting identities above |
| Focused payload codec, shared evidence, MLP/grouped/shape/opaque, Pythia prediction/generation/world tests | PASS, 27/27 before the final aggregate run |
| `npm test` with fresh task-owned byte-identical copies of all optional witnesses | PASS, 209/209, zero skips |
| `npm run test:reference` | PASS, 17/17; exact structure/identity, zero differing floats |
| `npm run test:reference:canonical` | PASS, 1/1; canonical fixture regenerated byte-for-byte |
| `npm run typecheck` | PASS; final runtime identity above |
| `npm run example` | PASS; one real update, 896 parameters updated |
| Fresh Vite build to `test-results/scratch/m4b1-build-20260916-02/build` | PASS, 108 modules; original `dist` untouched |
| Focused final M4-B1 browser route against the fresh build | PASS, 1/1; exact logit/QKV, retained summary, source/cache disclosure, zero native requests |

The first unprivileged aggregate run passed 202 cases but its two localhost-listener
tests failed with managed-sandbox `EPERM`; four optional witnesses were skipped in that
invocation. The two listener tests passed 3/3 when granted loopback permission. A later
attempt to run the full optional-witness suite directly against preserved paths was
blocked by the external action layer before execution; byte-identical inputs were copied
to a fresh owned directory and the final 209/209 run passed. No historical path was used
as a writer.

The first focused browser attempt passed all product checks but its test incorrectly
expected `adapter.py` after selecting a native activation. The UI correctly disclosed
the recording's `GPTNeoXLayer.forward` source. The assertion was changed to the exact
recorded source identity; the corrected route passed, followed by a second final pass
against the final runtime/build.

## Browser and visual evidence

Final browser result and images are under
`test-results/scratch/m4b1-browser-20260916-04/evidence/test-YuA9BG/`:

- `m4-b1-browser.json`: exact run/index/logit/source/cache result and zero requests;
- `m4-b1-payload-inspector-1920.png`: payload-backed 201,216-byte diagnostic and exact
  bounded index 50,303;
- `m4-b1-exact-logit-1920.png`: retained full-support summary, omitted mass and exact
  arbitrary logit without an invented probability;
- `m4-b1-payload-replay-1920.png`: disconnected retained world/source navigation.

Visual inspection found no clipping or misleading storage/presentation claim at
1920×1080. The user-facing world remains about model evidence; storage details appear
only in the developer-oriented shared inspector.

## Unrun scope

Per the M4-B1 boundary, no portable whole-session export/import, retention/eviction
policy, remote mutation reconciliation, native producer/profile change, native
requalification, benchmark, soak, installation isolation, aggregate acceptance, broad
CI, full browser catalog, deployment, PR, merge, M5 review, M6 user/workshop test or
release qualification ran. No measured memory/performance percentage is claimed.

## Ledger disposition and next dependency

M4 stays **IN PROGRESS**. M4-B1 supplies qualified bounded byte-backed storage support
to FP-10 and payload-integrity/bounded-fetch controls to FP-11, but neither proof is
complete. FP-03 and FP-09 retain their M4-A dispositions unchanged. The next dependency
is **M4-B2 portable session archive export/import**; retention policy and remote mutation
reconciliation remain separate later M4 work.
