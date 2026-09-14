# Foundation status

D0 is preserved as historical documentation alignment. **M0 preparation is complete.**
The **repaired first-M1 slice is QUALIFIED within its bounded canonical/native/replay
scope**, as recorded in the [repair qualification](reviews/M1-repair-qualification.md).
The original historical preservation failure remains FAILED; the missing worker timing
sample is LOST / RETIRED BY OWNER and remains absent. Full M1, foundation, M5 and
release acceptance remain ungranted. See [authority](README.md).

The canonical browser worker now validates versioned intents and retained runs enter
the shared store through the strict legacy codec. Native pinned Pythia executes
through an optional loopback bridge into the same inspector/player. Saved native
evidence replayed after bridge shutdown; canonical operation required no bridge.
These are bounded subset results, not complete FP or migration-stage acceptance.

## Historical engineering evidence

[Canonical acceptance](acceptance-v0.2.1.md), [experiments](experiments-v0.2.md),
[overnight rehearsal](abq-overnight-review.md) and the pre-existing local
[product review](abq-product-review.md) report results for their own implementations
and artifacts. Existing ablation, training-data research and the test-only alternate
trace producer are prerequisites/evidence, not FP passes through a future shared path.
Their tests, visual checks and soak were not rerun in D0. No old-soak transfer applies.
The local product review remains pre-existing untracked work.

## Required proofs

Definitions and all acceptance/disqualifying criteria remain in the
[full proof matrix](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix).
Each row is a status pointer, not a reduced acceptance definition.

| Proof | Witness / definition | Status |
| --- | --- | --- |
| FP-01 | [Canonical preservation through new contracts](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix) | SUBSET EXERCISED; full proof unaccepted; see slice report |
| FP-02 | [Noncanonical multi-layer tiny transformer](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix) | NOT_RUN |
| FP-03 | [Native Pythia execution, selected internals, generation and disconnected replay](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix) | SUBSET EXERCISED; full proof unaccepted; see slice report |
| FP-04 | [MLP/SGD plus grouped query/KV-axis numerical fixture](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix) | NOT_RUN |
| FP-05 | [Shape-only, unknown and opaque states](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix) | NOT_RUN |
| FP-06 | [Actual activation and composite parameterized replacement](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix) | NOT_RUN |
| FP-07 | [Head ablation and donor activation patch](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix) | NOT_RUN |
| FP-08 | [Matched data substitution and defense control](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix) | NOT_RUN |
| FP-09 | [Repeated invocations and bounded generation/cache correctness](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix) | NOT_RUN |
| FP-10 | [Legacy replay, export/import and representation-aware comparison](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix) | SUBSET EXERCISED; full proof unaccepted; see slice report |
| FP-11 | [Async, retention, transport and inert-import failure controls](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix) | SUBSET EXERCISED; full proof unaccepted; see slice report |
| FP-12 | [Shared visual/explanation routes and extension change surface](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#3-required-proof-matrix) | SUBSET EXERCISED; full proof unaccepted; see slice report |

Native Pythia is a required real second transformer executing through the shared
request/evidence path, with pinned native comparison, useful internal evidence and
saved replay without Python. The MLP/SGD witness independently challenges numeric
input, non-attention, objective, optimizer and dtype assumptions. Neither replaces
the other; grouped-axis numerical and shape-only/opaque fixtures remain required.
See [portfolio](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#2-initial-model-portfolio)
and [native acceptance](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#4-detailed-native-model-adapter-acceptance).

## Migration and later gates

| Stage | Definition | Status |
| --- | --- | --- |
| M0 | [freeze invariants and the migration map, not untested APIs](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#m0-freeze-invariants-and-the-migration-map-not-untested-apis) | PREPARATION COMPLETE; slice report migration map |
| M1 | [contracts, codecs, and dual producers early](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#m1-contracts-codecs-and-dual-producers-early) | Repaired first slice QUALIFIED within its scoped report; full M1 unaccepted |
| M2 | [topology, world, and interaction separation](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#m2-topology-world-and-interaction-separation) | NOT_RUN |
| M3 | [variants and experiments](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#m3-variants-and-experiments) | NOT_RUN |
| M4 | [durable payloads and failure boundaries](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#m4-durable-payloads-and-failure-boundaries) | NOT_RUN |
| M5 | [independent foundation review](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#m5-independent-foundation-review) | NOT_RUN |
| M6 | [full user testing, workshop, station, release](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#m6-full-user-testing-workshop-station-release) | NOT_RUN |

M0–M4 implement and exercise the foundation; M5 independently reviews all required
witnesses and retained guarantees on the exact candidate. Only then does M6 perform
full unfamiliar-user testing, timed workshop rehearsal, station and release checks.
Internal engineering, expert visual and accessibility review may continue earlier.
Foundation proof records must retain identities, commands, measured errors/policies,
artifacts, failures, unsupported capabilities, changes and reviewer disposition per
[record template](design/Model-Lab-Foundation-Proofs-and-Migration-v2.md#9-completion-record-template).

## Current source to target map

This preserves D0's starting source-to-target map. The implemented M0 extraction,
production callers, compatibility behavior and affected tests are in the
[M0/M1 report](reviews/M0-M1-first-vertical-slice.md#m0-migration--dependency-map);
no universal API is frozen.

| Current source and inspected constraint | Target destination |
| --- | --- |
| [trace/types.ts](../trace/types.ts): active run/artifact numeric dtype is float64; Adam `TrainingStateRecord` is provisional, used only by its constructor/test rather than production state admission | Versioned typed evidence and registered optimizer/state codecs; inspect active consumers first |
| [archive/snapshot.ts](../archive/snapshot.ts): active `TrainingSnapshot` validation requires character vocabulary, terminal BOS, MicroGPT names/4× MLP shapes and Adam continuation | Preserve exact validator and hashes as registered legacy MicroGPT codec; never weaken admission globally |
| [app/worker/protocol.ts](../app/worker/protocol.ts): model-specific request/results, `TrainStepResult`, snapshots and `generationId` request epoch | Adapter-facing intents, receipts, capabilities and cancellation; invocation/token step stays separate from epoch |
| [archive/session.ts](../archive/session.ts): float64/model-state admission, concrete learning and head-ablation records | Generic codec/recipe dispatch retaining immutable references and exact state/receipt safeguards |
| [trace/compare.ts](../trace/compare.ts): strict model/input/target/numeric/runtime matching plus shape/axes/kind checks | Keep this policy; add purpose-specific compatibility and explicit representation mappings/refusals |
| [app/spatial/forward.ts](../app/spatial/forward.ts): address omits layer and bindings select layer0 | Full semantic graph/source queries, integration layout hints, shared continuous-world composition |

Design [§§3–7](design/Model-Lab-Refined-Platform-Design-v2.md#3-architecture-a-small-modular-application-with-explicit-extension-boundaries)
and [§11](design/Model-Lab-Refined-Platform-Design-v2.md#11-current-source-migration-anchors)
define the intended separation. The first shared legacy/native path is now exercised
as scoped above. General codecs and the complete replacement/experiment/failure
portfolio remain target work; no complete acceptance follows from this subset.

## Findings retained and next gate

The previously identified projection wording and pre-ablation provenance findings
remain later authorized runtime work, included in the M5 candidate by the proof plan.
D0 neither reproduced nor resolved them. The historical product review's absence of
observed blockers is scoped visual evidence, not a dismissal of those earlier findings.

D0 remains complete as documented in its unchanged report. The current task explicitly
authorized M0 and the first M1 slice, including the local optional Python profile.
Its final protection audit found that an existing unit test wrote new timings over
`test-results/wave2b-review/worker-performance.json`. The test output path is corrected;
original bytes with SHA-256
`7b5883ef34a101b49e981ecdd168c39988ec95704cb71f2732d4ea46b7695f97`
are still needed for recovery. The prepared ABQ kit, original dist, canonical fixtures,
oracle, D0 documents other than this authorized ledger update, and product review
remain preserved. Do not use the overwritten timing file as original Wave 2B evidence.

Next: recover that exact historical artifact and review this uncommitted slice. Any
remaining M1 witnesses require a separate bounded authorization. No M2, independent
foundation acceptance, unfamiliar-user testing or release gate is authorized by this
status update. Full M1/FP/M5 acceptance remains ungranted.

## M1-R1 containment and review preparation

The [R1 report](reviews/M1-R1-evidence-recovery.md) records the bounded follow-up.
**UNRECOVERED / QUARANTINED / OWNER DISPOSITION REQUIRED:** the known overwritten
`test-results/wave2b-review/worker-performance.json` was hash-verified, byte-backed up
and quarantined; its historical pathname is absent. The expected original SHA-256
`7b5883ef34a101b49e981ecdd168c39988ec95704cb71f2732d4ea46b7695f97` and the
first-M1 failed preservation record remain unchanged. One bounded recovery pass
reused earlier findings and found no candidate in existing reachable local Git history.
No timings were reconstructed or substituted.

T10 now allocates fresh scratch output, refuses existing/protected/aliased paths and
retains failures. Six focused protection cases passed; the same 26 affected training
cases passed with unset and explicit output settings. Other historical/native/browser
writers remain unrun and require separate protection before reuse. Runtime identities,
original dist, prepared kit, fixtures, oracle and prior evidence remain preserved,
with the single quarantine exception explicit.

Separate first-M1 (accurately labeled combined D0 + first-M1) and incremental R1
patches plus a raw-evidence index are available in the report. Source review can
proceed, but delivery qualification remains blocked. The owner must provide a
specific backup for further exact recovery or explicitly retire the affected timing
sample as available proof while retaining the loss record. Retirement is not approved
here. M0 and original functional slice results remain as reported; full M1, foundation,
M5 and release acceptance are not granted. STOP after R1; no M2 authorization.

## Owner disposition: missing historical worker sample

**LOST / RETIRED BY OWNER.** The [owner-disposition record](reviews/M1-owner-disposition.md)
retires the missing original `test-results/wave2b-review/worker-performance.json`
as available historical proof, with expected SHA-256
`7b5883ef34a101b49e981ecdd168c39988ec95704cb71f2732d4ea46b7695f97`.
The historical pathname remains absent; the replacement remains quarantined.
No further recovery search, reconstruction or substituted measurement is authorized.

This resolves only the owner-disposition requirement in the earlier entries.
Those entries and original reports remain historical records; preservation remains
FAILED, and source/qualification review is still required. No first-M1, full M1,
foundation, M5 or release acceptance is granted; M2 remains unauthorized.

The [bounded fresh-session source review](reviews/M1-first-slice-source-review.md)
requests changes for canonical receipt selection, direct legacy snapshot identity
validation and inspector selection/replay state. R1 protection has no additional
blocker within its stated scope; other native/browser writers and runner cleanup
still need fresh output routing before qualification. No repairs or test reruns
occurred. The review is not independent M5 acceptance and grants no later gate.

## Repaired first-M1 candidate qualification

The [repair report](reviews/M1-repair-qualification.md) records reproduction and repair
of all three reviewed defects, fresh native/browser/runner/build output ownership,
and the complete authorized qualification. Application runtime is
`sha256:a003043fcf7c9cf3fc9c1c13cbd3e43735c285431f3067bbf9faddbf5070785e`;
the pinned native binding remains unchanged. Affected tests, canonical/reference,
typecheck/build, native comparison/transport, shared live/stale routes, 14 retained
canonical routes and disconnected replay passed. Canonical prediction made zero
native requests after task-owned bridge shutdown. Local source checkpoints are
`b5ad07a`, `0404025` and `be11952`; no remote writes occurred.

This qualifies only the repaired first slice. Earlier blocked/pending entries above
retain their historical task scope; the original failed preservation check is never
converted to PASS. The retired worker sample remains absent, and all other protected
evidence remains preserved. No remaining blocker was observed in the requested repair
scope. Full M1, independent M5, foundation and release acceptance remain ungranted;
no M2 or additional model witness is started.
