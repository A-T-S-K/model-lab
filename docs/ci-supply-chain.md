# CI supply-chain snapshot — September 6, 2026

The numerical-portability fix pins the existing Action major versions to immutable commits, resolved read-only from their upstream Git tag refs using `git ls-remote`:

| Action | Existing tag | Commit |
| --- | --- | --- |
| actions/checkout | v4 | `11d5960a326750d5838078e36cf38b85af677262` |
| actions/setup-node | v4 | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| actions/setup-python | v5 | `a26af69be951a213d495a4c3e4e4022e16d87065` |
| actions/upload-artifact | v4 | `ea165f8d65b6e75b540449e92b4886f43607fa02` |

`Dockerfile` remains unchanged. `docker buildx imagetools inspect` resolved these current production base digests for eventual ABQ release hardening:

| Base | Multi-platform index | linux/amd64 manifest | linux/arm64 manifest |
| --- | --- | --- | --- |
| node:24-alpine | `sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf` | `sha256:4caaaf42195bcd6f6f3559a413b20cb8f8ad089e231ee874cf7701643966689f` | `sha256:d3724e44ee368606d753e0027eb8d2a94fc1f275e5d9e4620178a12edb655f5f` |
| nginx:1.28-alpine | `sha256:a8b39bd9cf0f83869a2162827a0caf6137ddf759d50a171451b335cecc87d236` | `sha256:0dcc88822d45581e65ae329f8be769762bf628d3b2bb7d2a077d4aa5c98b30e3` | `sha256:1be286f7dd7d6e6be04f46e8df36d0084b05aa3d7fd3c6ebda3e1eff4e5b665d` |

This is a release-hardening inventory, not a claim of pinned production images. Docker tags, hosted runner images, and selected Node/Python patch releases can still move. No base-image upgrade, package upgrade, hosted canonical-environment claim, or platform redesign is part of this fix. The [reference provenance](../reference/PROVENANCE.md) explains the independent canonical and portable contracts.
