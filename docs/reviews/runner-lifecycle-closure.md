# Owned runner failure lifecycle closure

This bounded working-source pass repairs the stage helper used by both ordinary
npm browser/HTTP entrypoints. It grants no M5, foundation, release or exact-candidate
acceptance. Production code, browser assertions, package selection and previous
unstaged work remain unchanged.

## Identity and preservation

Branch `pre-m5-abq-experience`, HEAD
`ffb2db9217dac8ff3195fc2943918656daa78b59`; no staging, switching or commits.
Read-only runtime identity at start is
`sha256:cb0ff18267668a33b2a6f97fa7ca1d96a4dc7d5103ceafeda9bf2f9d6c847c98`.
The [starting source manifest](../../test-results/scratch/lifecycle-review-qhhkhxy7/starting-source.json),
byte copies under `starting-source/`, incoming `starting.patch` and status distinguish
previous work from this pass. The inventory includes `.DS_Store` and
`docs/merge-readiness-plan.md`. The [protected inventory](../../test-results/scratch/lifecycle-review-qhhkhxy7/protected.json)
covers existing outputs, dist and generated identity before checks.

## Reproduction and repair

Source review found that log `error` rejected the stage Promise independently of
child closure, then `finally` cleared the child reference. This was reproduced,
not assumed: [original control](../../test-results/scratch/lifecycle-review-qhhkhxy7/original-reproduction.json)
uses the saved starting helper, replacing only its log factory with a deterministic
Writable. The Promise rejected with the injected error while its child was alive
250 ms later. The control explicitly killed only its own detached process group.
An initial control import-path error is retained separately; it proves no lifecycle
behavior.

[ordinary-runner.ts](../../tests/support/ordinary-runner.ts) now waits for exclusive
file open before spawning. Log error, spawn error, nonzero closure and interruption
converge on one failure path. It preserves the first error, signals only the spawned
child's POSIX process group, waits for child/stdio and group disappearance, escalates
to SIGKILL after 1.5 seconds, and bounds the subsequent wait to 1.5 seconds. Cleanup
and log settlement have deadlines; cleanup failures are recorded separately and
reported without replacing the original error. Windows uses direct-child signals;
this is not Windows descendant-tree qualification.

Two async iterable pumps await Writable callbacks. Node pipe buffers and stream
backpressure bound memory; there is no growing output accumulator. stdout/stderr
remain distinct on the console and share the retained stage log. No relative order
between the two pipes is promised. A destroyed/nonwritable destination refuses a
write. `finished(..., {cleanup:true})` manages stream completion/listeners; it does
not manage the child. On success the child closes, both pumps drain, log ends and
its completion is awaited. On failure the child is stopped before log disposal and
receipt finalization. Signal handlers are removed when the invocation settles.

`scripts/run-browser.mjs` was reviewed and remains unchanged. It still allocates a
fresh output before typecheck, builds into that allocation, starts installed
Playwright with tsx, and retains source/failure/interruption/completion receipts.
Output/config/reporter override refusal and per-test/per-attempt evidence remain.

## Checks and limits

The [focused regressions](../../tests/integration/ordinary-runner.test.ts) exercise
opening collision before execution, mid-stream log failure, missing executable,
nonzero exit/tail retention, a 1 MiB backpressured successful stream, real-file
completion and SIGINT/SIGTERM against children that ignore graceful termination.
Additional controls verify a stubborn descendant in the owned POSIX group and
a delayed log disposal that reports cleanup failure without replacing the original
error. They check actual PID disappearance before reading the receipt, listener counts,
original errors and retained allocation bytes. They use only fresh temporary trees
and processes owned by the controls; no historical sentinel is overwritten.

- `TSX_DISABLE_CACHE=1 node --import tsx --test tests/integration/ordinary-runner.test.ts tests/integration/ordinary-output.test.ts tests/integration/test-output.test.ts tests/integration/slice-output.test.ts`: **24/24 passed**, no skips on darwin-arm64. [Log](../../test-results/scratch/lifecycle-review-qhhkhxy7/safety-complete.log).
- `./node_modules/.bin/tsc --noEmit`: passed without npm's generation hook. [Log](../../test-results/scratch/lifecycle-review-qhhkhxy7/typecheck-complete.log).
- Both ordinary entrypoints' owned typecheck/build stages and HTTP workflow are exercised; browser diagnostic disposition is in [browser triage](browser-failure-triage.md).

Node v24.21.0 and the already installed TypeScript 7.0.2, Vite 8.2.2 and Playwright
1.63.0 were used. No install, native backend, weight download, push, publication,
deployment or other-repository change occurred. SIGKILL of the wrapper, power loss,
Windows process trees, detached grandchildren escaping the owned POSIX group and
adversarial filesystem swaps are not qualified. An absent final receipt is not success.

## Incremental change and final preservation

This pass modifies only the incoming `tests/support/ordinary-runner.ts` and adds
two links to the incoming `docs/README.md`; the new lifecycle regression file and
two review documents belong to this pass. The previous agent owns the unchanged
wrapper, output helpers/tests, package/config/browser plumbing, roadmap and safety
review. `.DS_Store` and the merge plan are byte-preserved.

[Incremental source delta](../../test-results/scratch/lifecycle-review-qhhkhxy7/incremental-changes.json)
and [incremental patch](../../test-results/scratch/lifecycle-review-qhhkhxy7/incremental.patch)
compare against starting bytes, not HEAD.
[Final preservation](../../test-results/scratch/lifecycle-review-qhhkhxy7/preservation-final.json)
checks 7,642 pre-existing output/dist/generated files with zero differences.
The unchanged runtime hash is source identity, not an additional test pass.
