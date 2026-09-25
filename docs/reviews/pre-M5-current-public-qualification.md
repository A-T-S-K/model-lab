# Current pre-M5 public qualification record

This records an exact-candidate engineering/public qualification, not independent
foundation acceptance, unfamiliar-user validation, station acceptance, or release.

| Field | Recorded value |
| --- | --- |
| Repository/branch | `A-T-S-K/model-lab`, `pre-m5-abq-experience` |
| Commit | `ec842f8ff8d0be10ed0a547359333b6e4ad6a859` |
| Tree | `fc00de8d766cc49edd537f3f0218638512b8ba26` |
| Runtime source identity | `sha256:81b0670ab4d49eefede24d0f72ff3b6914e541c34c4ca4803e1b35be75f32ca6` |
| Command/profile | `npm run qualify:public`, `pre-m5-public` |
| Result | PASS; verified candidate binding; 15/15 browser tests |
| Local output | `test-results/scratch/qualification-UBGQkf/` (not checked in) |

The local `candidate.json`, `completion.json` and Playwright `report/results.json`
record the binding and result. This qualification covers the public browser route
on the named candidate. The current ABQ presenter/operator documents and curated
assets describe that Guided route; their alignment is a documentation audit, not a
measured learning outcome. Owner-operated MacBook Neo visual smoke remains separately
scoped real-device evidence. M5 and M6 are **NOT_RUN**. A later docs-only commit has
a different tree and needs its own exact-candidate public qualification.
