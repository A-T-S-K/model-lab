# Model Lab v0.2.1 acceptance

**Engineering acceptance: PASS — September 6, 2026.**

**HUMAN TEACHING VALIDATION: PENDING.** Automated checks and reviewer assessments do not establish beginner comprehension. The [short facilitator checklist](teaching-check.md) is ready for actual unfamiliar-user sessions.

## Exact accepted implementation

- Baseline v0.2 commit: `5026620c11567ab3e4fbeeb16ff6880922879f72`, preserved unchanged.
- Final implementation commit: `238757e5216d2969063e0275f1f04202f59cfcb7` on local `model-lab`.
- Implementation commit tree: `ccdc39427e787ee0d108a0b0e5460771f630ad27`; Model Lab subtree: `dc298666cf127fd46d4ada817507d6c9c59dc5fc`.
- Exact production runtime revision: `sha256:b95a492bc6d112263eba17e4453be4fbee8a0adbf6392c2c39f18073c59bd596` (41 production source/build-input files).
- Final acceptance image: `model-lab:v0.2.1-acceptance`, image ID `sha256:93e5388746220a2add132997a2087196bcf3b498b34403b080f3a4347b75a7ee`.

This report and final plan-status updates were written after the checks; they change no implementation, tests, fixtures, build inputs, or runtime revision. No push, merge, remote change, repository license change, or unrelated contributor-surface edit occurred. The pre-existing untracked audit was preserved.

## Fresh validation

Local host: Node `v24.20.0`, Python `3.9.6`, Chromium through the pinned Playwright dependency. The container independently built production assets on Node 24 Alpine. Both builds recorded the same runtime revision above.

| Check on final implementation | Result |
| --- | --- |
| `npm run test:reference` | 9 tests pass; canonical expected fixture regenerates byte-for-byte |
| `npm test` | 54 tests pass, including numerical, evidence, archive, historical, runtime-identity and model-only isolation regressions |
| `npm run build` | Strict typecheck and production build pass |
| `npm run test:browser` | 21 Chromium tests pass, 38.4 seconds on this host |
| `npm run example` | Observer-free predict → one real update → predict succeeds; 896 parameters, step 1 |
| `npm run measure:guided` | All 18 documented candidate probabilities reproduce from final source |
| `npm run test:isolation` | Fresh `npm ci`, 9 reference tests, exact fixture check, 54 unit/integration tests, build, and 21 browser tests pass without sibling source or Git metadata |
| Standalone Docker build and Chromium smoke | Predict, Learn, actual gradient, head ablation and verified historical inspection pass; zero page errors and WAN requests in the instrumented smoke; temporary containers removed |
| Repository checks | `git diff --check` passes; current local documentation links resolve; workflow YAML parses and contains the scoped required checks |

Final isolated source copy: `/var/folders/2g/6n8r5w2n7z54m4y1m8vj9cjh0000gn/T/model-lab-isolation-won_txln`. Its runtime identity exactly matches the original subtree. Its 21 browser tests passed in 39.1 seconds.

Local execution logs are under `/tmp/model-lab-v021-final-{acceptance,isolation,docker-build,container-smoke,example,measurement}.log`. These paths are local validation artifacts, not portable repository dependencies.

The [narrow GitHub Actions workflow](../../.github/workflows/model-lab.yml) runs reference/unit/build/browser, isolated-subtree, and container checks for Model Lab changes. Its commands were exercised locally; hosted Actions has not run because this work has not been pushed.

## Repaired truth and preserved depth

Input edits preserve the exact captured input and numerical evidence while immediately marking it stale; invalid edits cannot relabel the old run as current. Forward stages follow observed model order, Combined Heads precedes projection, and training is separate. Every displayed stage resolves to a real source symbol; unknown mappings explicitly say unmapped, while actual leaves remain terminal.

Run manifests carry exact content-derived runtime identity. History, experiment validation, and comparison enforce compatibility; verified reconstruction supports recursive operand navigation without changing live state. `npm run dev` builds and serves fixed assets: restart after source edits. A real temporary-server test verifies that edits cannot hot-load new workers under an old revision.

The core mathematics and direct `backward → captureBackward → adamStep` boundary are unchanged. Observation descriptions and packaging moved to a small supporting module. Focused extraction validation compared a complete 683-event semantic/root/structural/backward transcript, including ablation, and complete training output byte-for-byte. Final reference and conformance checks preserve live scalar roots, repeated operand edges, accumulated gradients and all 896 Adam inputs, continuation state, historical refusal, comparisons and the declared head-ablation boundary.

The always-true Learn gate and write-only UI counter were removed. Actively used attention derivation remains. The immutable contract is now `TrainingStateRecord`; `TrainingSnapshot` uniquely names complete concrete resumable model/optimizer state. Durable repository guidance, historical-document routing and upstream provenance were corrected without changing licensing files or vendoring upstream code.

Guided is an authored Predict → Teach → See What Changed lesson. From the fixed initial model, ten real updates on `abca` increase P(a | START, a, b, c) from **35.91443770854818%** to **91.43985601971759%**. Selection uses the complete [fixed candidate sweep](guided-measurement.md), while UI values always come from actual worker results. Repeat teaching continues the current state; cancellation and optimizer exhaustion display only completed updates. Earlier comparison actions follow their own recorded result; experiment disclosure stays visible across modes. Explore and Microscope retain the real gradient and Adam evidence.

Browser acceptance also covers 105 resets, rapid cancellation, a Clear-session/cancellation accounting race, session-budget refusal without history loss, the actual 995→1000 optimizer-limit case, desktop/390px narrow layouts, touch, reduced motion, inactivity/foreground/refresh, offline source/revision access, and no horizontal overflow. Desktop and mobile Guided screenshots were visually inspected. Numeric evidence is never replaced by a canned success result or missing-value zero.

## Independent review

Four fresh reviewers examined evidence truthfulness, mathematics/readability, historical correctness, and the beginner path. The evidence reviewer found one P1 issue: Guided navigation changed the selected position while preserving attention detail for the previous position. A new browser regression failed on the old implementation, then passed after all three navigation paths clamped the key and refreshed the arithmetic. The reviewer confirmed closure. The other three reviews reported no actionable defects. Full local, isolated and container acceptance above was rerun after that repair; no review finding remains unresolved.

The prior [v0.2](acceptance-v0.2.md), [v0.1](acceptance.md), capture, training and experiment reports remain historical evidence. No old Node benchmark timings or upstream numerical-comparison measurements are represented as newly rerun. This pass adds no organism or major platform feature and makes no generalization or human-comprehension claim.
