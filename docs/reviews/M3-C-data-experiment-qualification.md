# M3-C registered data-experiment qualification

**Date:** September 16, 2026

**Starting source:** `eb0d9292b0f9571ff5683a5bb4155c5c3966970a` on `wave-1a-spatial`, equal to live `origin/wave-1a-spatial` before implementation

**Qualified application source:** `b7676e60cd1c5540f2b451f148b8babcd2d0c658`

**Qualified application runtime:** `sha256:6b079bc9d22cc1b1607cdc821d8783a764551dbc8a6d6d611827598f951ed4a4` (116 runtime inputs)

**Disposition:** M3-C and the bounded FP-08 implementation slice are ENGINEERING-QUALIFIED. M3 remains IN PROGRESS pending a separately authorized integrated M3 qualification. Independent M5/foundation acceptance remains pending.

## Registered boundary and retained authentic work

Reviewed build-time recipe `microgpt.matched-data-substitution@1` owns the bounded design, native execution binding, three arm construction, data and evaluation declarations, receipt validation, external-record correlation and presentation metadata. Imported data can select only an already registered identity; it cannot register or execute a module, closure, command or saved source text.

`runPoisoningTrial` is a compatibility projection over that registered executor. There is one authoritative computation. The prior real training work remains: each update retains before, training/backward and after runs, a complete learning experiment, exact start/end snapshots and the applied Adam evidence. Strict `compareRuns` is unchanged and remains the evaluation-run comparison. Generic `SessionArchive.dataExperiments` admission validates common source, lifecycle, linked snapshot/run/learning identities and duplicate IDs before dispatching recipe-specific validation.

The immutable common starting checkpoint and snapshot are both:

`sha256:d1a46ae0fe2830a2bbcdc118913c5d974ef82e6acc2ef1004b5f8d0dae5b3ca1`

The source definition is `microgpt@14fb038816c7aae0bb9342c2dbf1a51dd134a5ff`. The receipt is `sha256:25f6e8cf6d0948f36e279dd33de9c07ad7f3807744738593060d00813158dad0` in the final browser witness. Its identity covers the complete common record; worker session/run identities intentionally remain explicit parts of that execution receipt.

## Design and policy

The fixed design was not tuned after observation:

- clean schedule, in order: `abca`, `bcab`, `cabc`, `abab`;
- declared substitution `m3-c-matched-data:substitution:0`: step 0, `abca → abcc`;
- triggered prefix `abc`; controls `bca` and `cab`;
- desired token `c`;
- clean evaluation documents `abca`, `bcab`, `cabc`, `abab`;
- input transform `microgpt.character-teacher-forcing@1`;
- objective `microgpt.next-token-mean-nll@1`.

The defense is `schedule-integrity-allowlist@1`. At each step the clean schedule declares the sole allowed document. An equal proposal is accepted; a different proposal is normalized to the declared clean document. It is a deterministic schedule-integrity control, not a content classifier or evidence of a general poisoning defense.

`matched-training-arms@1` passed with no reasons. All arms start from the exact complete source, perform four ordered updates, retain the same model/configuration/parameter order, Adam configuration, teacher-forcing transform and objective, and finish at optimizer step/cursor 4. Treatment differs only at the declared substitution. Defended proposals exactly equal treatment proposals, and effective documents follow only the allowlist decision.

Final snapshots:

| Arm | Final snapshot |
| --- | --- |
| Clean | `sha256:cc016da222d940f1a97fd5f4cb0a1156981860ba52d5c6fa0b7a7af83eb09c36` |
| Treatment | `sha256:0e32431ec669a0b12fb979691d35b4c2f848349700150ef300707519ed5726c4` |
| Defended | `sha256:cc016da222d940f1a97fd5f4cb0a1156981860ba52d5c6fa0b7a7af83eb09c36` |

The recommended policy normalizes the sole changed proposal, so clean and defended final state are exactly equal. Equality is the observed state result, not a required efficacy conclusion.

## Per-step lineage and external record identity

Every row is explicit `common source/step start → proposed → policy decision → effective → learning/training evidence → step end`. External record IDs are canonical SHA-256 identities over all interpretation and linkage fields. They are not neural artifacts.

| Arm / step | Proposed → decision → effective | Start → end snapshot | Learning / training run | External policy record |
| --- | --- | --- | --- | --- |
| clean 0 | `abca → accepted → abca` | `d1a46ae…b3ca1 → 0a43d3e…65712` | `m3-c-matched-data:clean:0` / `inspection:1:data:clean:0:training` | `sha256:6be461026a743b0f003d0474c9dbe2d4430d02ce79bf17a5273783eeb3a76c89` |
| clean 1 | `bcab → accepted → bcab` | `0a43d3e…65712 → 05109fa…a68b8` | `m3-c-matched-data:clean:1` / `inspection:1:data:clean:1:training` | `sha256:f5f580ba41f5bae6d2edb023eccb51a3cee6fc41b8a31d3dfcc3be04e4392a92` |
| clean 2 | `cabc → accepted → cabc` | `05109fa…a68b8 → bde4ae1…c286a` | `m3-c-matched-data:clean:2` / `inspection:1:data:clean:2:training` | `sha256:8ab9ebe2542fb1a00e374da5a8c7370080b973c89004e7c4afdbaa55f3264e65` |
| clean 3 | `abab → accepted → abab` | `bde4ae1…c286a → cc016da…09c36` | `m3-c-matched-data:clean:3` / `inspection:1:data:clean:3:training` | `sha256:3e3ad320b790b611583f1cbdc7d0b743e271aca8b215db77a393f256647785df` |
| treatment 0 | `abcc → substituted → abcc` | `d1a46ae…b3ca1 → 1e6216b…d7797` | `m3-c-matched-data:treatment:0` / `inspection:1:data:treatment:0:training` | `sha256:0b1159fd16481c90952db75e342868df114ce01221f48bfab0253c092e6c4c2d` |
| treatment 1 | `bcab → accepted → bcab` | `1e6216b…d7797 → 4c82505…6e624` | `m3-c-matched-data:treatment:1` / `inspection:1:data:treatment:1:training` | `sha256:e5a6fd37818e3b42d4ec805fbadd9db23d65b424a03d34ab2a26a9917d337784` |
| treatment 2 | `cabc → accepted → cabc` | `4c82505…6e624 → f733a17…fc769` | `m3-c-matched-data:treatment:2` / `inspection:1:data:treatment:2:training` | `sha256:e44883614e098cd2bbdaf5532d3d15a006916c986ba557616fec754384122ae2` |
| treatment 3 | `abab → accepted → abab` | `f733a17…fc769 → 0e32431…726c4` | `m3-c-matched-data:treatment:3` / `inspection:1:data:treatment:3:training` | `sha256:e1adf535fc0507d70ea8a7930b45c229f6c62c5fc9ea401ed3670d2d25208bad` |
| defended 0 | `abcc → normalized → abca` | `d1a46ae…b3ca1 → 0a43d3e…65712` | `m3-c-matched-data:defended:0` / `inspection:1:data:defended:0:training` | `sha256:f239eecb750b584ced11b8aff88bf42a7e71be5687c41e0bcbe9c479bfa086c2` |
| defended 1 | `bcab → accepted → bcab` | `0a43d3e…65712 → 05109fa…a68b8` | `m3-c-matched-data:defended:1` / `inspection:1:data:defended:1:training` | `sha256:1eed917edc2680f2064f0a72d69ec07c830b83b81073e6a9af0e94ae48f6fcc0` |
| defended 2 | `cabc → accepted → cabc` | `05109fa…a68b8 → bde4ae1…c286a` | `m3-c-matched-data:defended:2` / `inspection:1:data:defended:2:training` | `sha256:797d5d54112ec2b2f2f31192bb00781a089dd56a843494b8d065098f2bce6437` |
| defended 3 | `abab → accepted → abab` | `bde4ae1…c286a → cc016da…09c36` | `m3-c-matched-data:defended:3` / `inspection:1:data:defended:3:training` | `sha256:40ef805f9d70a40dc4d2f204ce9db78e3b4ff6cede2082636bcbf2badaed834c` |

At the exact substitution step, clean records proposed/effective `abca` and `accepted`; treatment records proposed/effective `abcc`, `substituted` and the declared substitution ID; defended records proposal `abcc`, expected `abca`, `normalized`, and effective `abca`. The three policy hashes above correlate to the three named learning experiments and training runs by experiment, arm, step, all before/training/after run IDs, start/end snapshots and requested/effective documents.

The isolated correlation fixture uses only deterministic plain external records and step identities, without importing model code. It passes the exact link, then refuses a changed training-run identity. Admission also refuses content-hash tampering and wrong arm, step, training run, start snapshot or end snapshot. Correlation establishes that one external policy decision is linked to one model training step; it makes no causal claim about an internal mechanism.

## Observed evaluation and derived values

All three final arms execute the same declared inputs. Values below are retained observed model evidence.

| Evaluation / desired `c` | Clean | Treatment | Defended |
| --- | ---: | ---: | ---: |
| Triggered prefix `abc` | `0.22836873846037267` | `0.28817107563175154` | `0.22836873846037267` |
| Control prefix `bca` | `0.219208998557869` | `0.2645350237485791` | `0.219208998557869` |
| Control prefix `cab` | `0.2813109674092682` | `0.34050059671562116` | `0.2813109674092682` |
| Mean loss across `abca`, `bcab`, `cabc`, `abab` | `1.0539085273735747` | `1.0742336346831418` | `1.0539085273735747` |

Derived observations:

- triggered treatment − clean: `0.059802337171378867`;
- triggered defended − clean: `0`;
- triggered defended − treatment: `-0.059802337171378867`;
- clean-task loss treatment − clean: `0.02032510730956716`;
- clean-task loss defended − clean: `0`;
- clean-task loss defended − treatment: `-0.02032510730956716`.

No attack-success, mitigation-success or robustness threshold was declared. The treatment, control and loss movements are measurements, not categorical security outcomes. The defended equality follows this fixture's schedule oracle and must not be generalized to real-world pipelines.

## Refusals, lifecycle and accepted-state isolation

Tests refuse unknown recipe identity, invalid source hash, zero schedule, exhausted optimizer schedule, duplicate substitution step, wrong original, no-op replacement, out-of-vocabulary desired token, undeclared treatment change, extra/missing/reordered updates, clean deviation, defended proposal mismatch, wrong expected document, policy-inconsistent decision, wrong arm/step/run/start/end link, policy-record tampering, duplicate experiment ID, failed/cancelled arm, and missing triggered/control/clean evaluation.

The browser action runs synchronously in the disposable inspector worker. The application admits nothing until the worker returns the complete bundle and every snapshot, run, learning experiment and common receipt validates. Inspector cancellation terminates that worker and invalidates its generation; a failed or late operation cannot publish a successful receipt. No asynchronous behavior was fabricated inside the experiment.

The accepted canonical snapshot before and after the browser route was exactly
`sha256:d1a46ae0fe2830a2bbcdc118913c5d974ef82e6acc2ef1004b5f8d0dae5b3ca1`.
No arm is adopted. Returning to canonical and running Predict uses the same accepted state. Original `dist`, canonical fixture and independent Python oracle hashes were unchanged.

## Presentation and visual evidence

The existing continuous-world screen adds one bounded developer action and receipt rather than a separate security dashboard. The receipt presents the common start, equal budget, exact three-arm substitution step, raw probability/loss table, derived deltas and complete expandable lineage. `MODEL EVIDENCE` and `EXTERNAL CONTEXT` are separate panels; policy metadata never appears as a neural tensor. The lineage buttons open the exact retained model training runs linked by external records.

Final exact-candidate evidence is under `test-results/scratch/m3-c-browser-20260916-f/evidence/test-apkViI/`:

- `m3-c-data-experiment-1920.png` shows the common start, clean/treatment/defended step, model observations, external allowlist record and correlation links at 1920×1080;
- `m3-c-data-experiment-1280-reduced.png` verifies the compact three-arm and two-domain layout at 1280×720 with reduced motion;
- `m3-c-browser-evidence.json` retains the complete receipt plus byte-identical accepted before/after snapshots.

Manual inspection found the exact substitution, raw metrics, neutral interpretation and evidence-domain separation readable at both sizes. The compact receipt is intentionally bounded and scrollable for the full 12-step lineage.

## Commands and results

- Focused data/archive/poisoning/M3-A/M3-B1/M3-B2 regression set: 40/40 passed.
- `npm test` with required loopback permission: 196 cases, 191 passed, five optional native-profile skips, zero failures. The initial sandboxed pass had only the two expected localhost `EPERM` failures; the authorized rerun passed.
- `npm run test:reference`: 17 portable reference tests plus strict numerical conformance passed; zero differing floats.
- `npm run test:reference:canonical`: byte-exact canonical regeneration passed.
- `npm run typecheck`: passed at the qualified runtime.
- `npm run example`: passed with the retained canonical values and 896 updated parameters.
- `npm run build -- --outDir test-results/scratch/m3-c-candidate-20260916-c/build`: fresh protected exact-candidate build passed. The size advisory was non-failing; original `dist` was not used or changed.
- Final exact-candidate Playwright under `test-results/scratch/m3-c-browser-20260916-f`: 5/5 passed—the M3-C route, both retained M3-A routes, M3-B1 and M3-B2.

Protected intermediate evidence remains preserved. The first browser command was refused because its build root lacked the repository ownership marker; the build was reallocated correctly. A sandboxed preview then failed with loopback `EPERM`. The first permitted integrated browser pass found the application-realm data-recipe registry missing even though the inspector worker registry was populated; the application now explicitly loads the build-time contribution, and the focused plus final integrated reruns passed. No failed run was rewritten as a pass.

## Unrun scope and next dependency

No Pythia/native rerun, broad CI, benchmark, soak, installation isolation, aggregate acceptance, unfamiliar-user testing, deployment, PR, merge, M4, M5 or M6 work was run. The unrelated pre-existing untracked `docs/abq-product-review.md`, prepared ABQ kit and historical evidence were not modified.

M3-C stops here. The next dependency is the separately authorized final integrated M3 qualification. M3 remains IN PROGRESS; this report does not grant independent foundation acceptance.
