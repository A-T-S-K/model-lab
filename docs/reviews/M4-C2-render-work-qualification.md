# M4-C2 renderer/work qualification

## Disposition

**ENGINEERING-QUALIFIED for the M4-C2 bounded retained-evidence presentation and
truthful availability-state slice.** Retained runs, snapshots, points, relationships,
coordinates, scalar fanout, structural events and comparison rows now have explicit
presentation windows. Windowing limits DOM and derived read work; it does not remove,
rewrite or charge retained evidence. Exact identities remain reachable through paging,
typed coordinates or exact-ID lookup. M4 remains **IN PROGRESS**. Remote mutation
idempotency and ambiguous acknowledgement reconciliation remain M4-D; M4-E was not
started.

This adds bounded renderer/DOM construction, large retained-evidence navigation,
truthful pending/opaque/budget-exceeded presentation, generic payload-backed fallback
and presentation/evidence isolation evidence to FP-11 and FP-12. It is not independent
M5 acceptance.

## Authority and candidate identity

- Starting local HEAD, tracked remote and verified live `origin/m4-durable-evidence`:
  `b2084d45932376a35d66ae1db3e015583a90ef1f`.
- Frozen `foundation-v2-m3-qualified^{commit}`:
  `0f390851d594e73907929f0af0be76ab4cc1032c`.
- Implementation candidate: `a46a1fd36dbcf149ffe5216bd5affe46994df145`.
- Qualified application runtime:
  `sha256:2a41db3800f10546884d300c8ebfdeb2a69b304afc2242a95b28839528a6259a`.
- Qualified native profile remains
  `pythia-14m-cpu-f32-eager-uncached-generation-v2`; native runtime remains
  `sha256:1e6828657d55bb74295bfc95bd2e7af64d0e7c5516ace241207a7244ff3d012a`.
  No native adapter, bridge, profile, dependency, weight or tokenizer file changed.
- The starting worktree was clean. Original `dist`, prepared ABQ materials, canonical
  fixtures/oracle, pinned native assets and all historical M4-A/B1/B2/C1 evidence were
  preserved. Fresh qualification output used task-owned children of
  `test-results/scratch`.

## Presentation work contract

`app/presentation/work-contract.ts` is a small presentation-only contract. It owns
window calculations and these limits; it has no archive writer, executor or payload
ownership:

| Surface | Limit | Rationale |
| --- | ---: | --- |
| History runs / comparison runs | 32 each | Bounded against portable-v1's 4,096 direct-run ceiling; exact ID and pages retain arbitrary access. |
| History snapshots | 64 | Bounded against portable-v1's 1,024-snapshot ceiling; exact snapshot ID remains available. |
| Shared-inspector runs | 32 | Bounded independently of the retained store; one selected-item slot is kept inside the limit. |
| Shared-inspector / fallback points | 24 | Reuses the established fallback world-object limit against the 2,048-point evidence ceiling. |
| Spatial learning transitions | 64 | Prevents the retained learning-experiment selector from tracking the portable record ceiling. |
| Coordinate `<option>` values | 64 | Reuses the proven Pythia threshold; larger axes use labeled exact integer input. |
| Upstream/downstream/dependency rows | 24 | Matches the bounded point window; totals and previous/next controls disclose retained remainder. |
| Scalar consumer rows | 24 | Bounds consumer buttons and gradient-contribution rows while retaining repeated operand occurrences. |
| Scalar operand rows | 16 | Bounds unusual high-fan-in operations; paged wording does not present a subset as a complete equality. |
| Structural events / values per event | 12 / 16 | Bounds both event and inner-value DOM dimensions. |
| Breadcrumbs | 16 | Older rendered path entries are dropped with an explicit retained-evidence statement. |
| Comparison rows | 32 | Replaces the complete raw-pair serialization with a bounded page and complete pair count. |
| Generic value preview | 16 | Preserves the existing small value-preview scale; selected typed coordinates move the window. |
| Payload slice | 256 | Existing qualified M4-B1 slice ceiling. |
| Full-support size | 200,000 | Existing qualified per-run numerical ceiling. |
| Distribution top-k | 20 maximum, 5 default | Keeps returned summary bounded while preserving the qualified top-five presentation. |

The generic reverse-dependency lookup is bounded by the evidence contract: at most
2,048 points × 64 declared dependencies = 131,072 inspected references. It creates
relationship objects only for the 24-point scene window. Dependencies crossing the
window are counted as retained off-window relationships.

## Navigation and identity results

History run, comparison-run and reset-snapshot selectors page their retained collections,
show exact totals and retain the selected semantic ID when a different page is shown.
Exact run/snapshot entry reaches an arbitrary retained record without a complete
`<datalist>`. Portable ordering is untouched.

The shared inspector pages runs and points independently. Its current run/point remains
explicit when outside the browsed page. `Next recorded point` and dependency navigation
move to the page containing the actual point ID. Paging calls no executor. The focused
browser witness opened a 109-evidence-run near-limit archive with at most 32 run entries
plus the empty selector option and at most 24 point buttons.

The fallback world uses the existing 24-object ceiling but follows the selected point
instead of freezing the first page. The operation selector contains only the current
bounded window. Relationship controls show totals and page 24 entries; selecting a
related off-window point shifts the world to that actual point. A 2,048-point stress
fixture reached point 2,039 while retaining 24 scene nodes.

## Payload, coordinate and availability results

The generic fallback now receives the authoritative `EvidenceStore`. Inline and
payload-backed `available` points share bounded `slice()` reads: four values for a scene
preview, one for the selected exact coordinate and sixteen for the value table. A direct
model-independent test admitted a 300-value point, proved retained `values === null` plus
a payload descriptor, displayed exact index 299 as `299.25`, and rendered no unsupported
or budget-exceeded label. No whole payload or 200,000-element presentation array is
constructed.

Axes of at most 64 coordinates use a select. Larger axes use an exact integer input with
real min/max; invalid or fractional coordinates refuse through input validity and never
silently clamp or execute. The 200,000-coordinate stress fixture produced no proportional
coordinate options.

| State | Presentation contract |
| --- | --- |
| `available` | Authentic inline or payload-backed numerical evidence through bounded reads. |
| `not_captured` | Not saved for this occurrence; no value or automatic reexecution. |
| `not_applicable` | Coordinate/computation does not exist for the occurrence. |
| `unsupported` | Backend or representation does not support the requested evidence/action. |
| `budget_exceeded` | Capture budget prevented retention; zero is not substituted; structural/source metadata remains; opening is not execution. |
| `shape_only` | Shape, axes, roles/spaces, source and known topology only; no numeric glyph/table/average. |
| `opaque` | Known boundary, relationships, qualified shape/source and coverage limit only; no invented interior arithmetic or model label. |

## Pending, verification and Microscope

Pending scalar detail clears the prior inspection before rendering and now announces
`PENDING`, source identity and that no prior scalar is the pending result. Cancellation
and stale epoch checks retain their existing publication barriers. A cache reservation
refusal renders `BUDGET EXCEEDED`, states that no scalar was retained/substituted and
does not describe execution failure. Failed recomputation still returns before graph
rendering with `VERIFICATION FAILED` and “does not explain the original run.”

Microscope pages operands (16), consumers/gradient rows (24), structural events (12)
and structural values/node links (16). A 100-consumer / 30-event stress graph preserved
the complete returned-graph contribution sum internally while rendering only one page.
The sum is explicitly scoped to the returned inspection graph, not the visible page or
an unproven complete execution. Whole captures remain statistics-only. Breadcrumb DOM
is limited to 16 while source graph identity remains unchanged.

## Full-support derivation work

`fullSupportDistributionFromSlices` now refuses non-safe, nonpositive or greater-than-
200,000 support; slices over 256; top-k over 20 or support; nonfinite/incomplete slices;
and invalid selected indices. At the maximum qualified support the instrumented test
observed exactly:

- 782 slice calls per pass × 2 passes = **1,564 calls**;
- **400,000 numerical values scanned**;
- maximum request size **256 values**;
- five returned top rows plus one selected summary; no complete output array.

An eight-entry weak-owner presentation memo stores only bounded distribution summaries.
An unchanged run/point/index rerender made zero additional slice calls. This is ephemeral
presentation state and is absent from portable evidence.

## Retention, archive and state isolation

The C1 near-limit witness remained byte-identical and exportable after read-only import:

- archive ID `sha256:97cc5303b66d50130a8862b9e72f2b4428ce21b75c2e356eb2ffc247a2940cf8`;
- 15,246,474 archive bytes, 14,808,112 manifest bytes and 751,779 manifest nodes;
- 111 recorded runs / 109 evidence runs;
- exact retained Pythia index 50,303 `-3.8919265270233154`;
- byte-identical re-export and zero native requests during browser paging/inspection.

The qualified M4-B2 archive imported and re-exported as the identical 13,285,363 bytes
and archive ID
`sha256:7cef8902cfd6489fe482ee314d8251de4e6eb263e5506df001a76ab20a7d7373`
with 71 recorded runs, 69 evidence runs, 10 snapshots and byte equality. C2 adds no
portable paging state and charges no durable-history bytes.

Unit/integration and browser witnesses retained accepted canonical snapshots, run IDs,
evidence content IDs and payload IDs across navigation. The generic presentation paths
contain no executor call. Clear Session resets all new page offsets with the existing
archive/ephemeral-state reset. Kiosk controls remain hidden by the existing public-mode
boundary; no developer archive paging was added as a Guided lesson.

## Commands and results

| Command / scope | Result |
| --- | --- |
| Branch/status/tag plus live `git ls-remote` | PASS; required starting identities matched |
| Focused M4-C2 presentation/fallback/full-support tests | PASS, 13/13 |
| Witness-backed `npm test` on exact runtime | PASS, 223/223, zero skips |
| `npm run test:reference` | PASS, 17/17; exact structure/identity, zero differing floats |
| `npm run test:reference:canonical` | PASS, 1/1; byte-identical fixture regeneration |
| `npm run typecheck` | PASS; runtime identity above |
| `npm run example` | PASS; one real update, 896 parameters updated |
| Fresh protected Vite build | PASS, 114 modules; original `dist` untouched |
| Focused M4-C2 1920×1080 + 1280×720 reduced-motion browser route | PASS, 1/1; 5.6 s; zero native requests |
| C1 near-limit import/measure/export | PASS; exact identity/counts and byte equality above |
| B2 read-only import/re-export | PASS; exact 13,285,363 bytes and qualified ID above |

Final browser evidence is under
`test-results/scratch/m4c2-browser-20260917-08/evidence/test-BGRJD4/`:

- `m4-c2-bounded-retained-pythia-1920.png`;
- `m4-c2-opaque-reduced-1280.png`;
- `m4-c2-browser.json`.

Visual inspection found the exact selected Pythia output, full-support summary and
retained-archive status readable at 1920×1080. At 1280×720 with reduced motion, the
opaque boundary, known relationships, precise availability language and scrollable lens
remain readable without a numerical placeholder or evidence-semantic change.

## Worktree caveats and unrun scope

Two early browser allocations ended before a runner result was collected, and one
subsequent route timed out while trying to click a disabled last-page control. Those
fresh outputs were preserved, not reused; the route was corrected to choose an enabled
direction and passed on the exact final build. One initial unprivileged `npm test` passed
all product tests but its two localhost-listener tests failed with managed-sandbox
`EPERM`; the permitted witness-backed exact-candidate run passed 223/223.

Per the C2 boundary, no remote mutation idempotency/reconciliation, M4-D, M4-E, native
runtime change/requalification, benchmark, soak, installation isolation, broad CI,
aggregate release acceptance, deployment, PR, merge, M5 independent review, or M6
unfamiliar-user/workshop/station/release qualification ran. No FPS, wall-clock semantic
criterion, memory percentage or performance improvement is claimed.

## Ledger and next dependency

M4 remains **IN PROGRESS**. M4-C2 engineering-qualifies bounded renderer work/DOM,
large retained-evidence navigation, exact generic payload-backed presentation, truthful
pending/opaque/budget-exceeded states and no presentation-driven mutation for FP-11 and
FP-12. The next dependency is **M4-D mutation idempotency and ambiguous acknowledgement
reconciliation**. M4-E remains after D.
