# Deterministic training retention benchmark

Measured locally with Node 24.20.0 on the canonical 896-parameter organism, fixed teacher-forced `abca`, initial schedule 1,000 steps. Command: `node --expose-gc --import tsx scripts/benchmark-training.ts`. Each step includes before/training/after semantic runs, live scalar/backward capture, SHA-256 snapshots, and full archive transition validation. Heap is Node heap after requested GC, not browser heap. Timings are one local run, not portable performance promises.

| Updates | Elapsed ms | Slowest step ms | Heap MB | Archive JSON MB | Snapshot bytes | Observed loss | Final BOS probability |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 115.6 | 109.7 | 31.49 | 0.70 | 58560 | 1.21582854516 | 0.371806283465 |
| 10 | 765.3 | 109.7 | 39.05 | 7.43 | 58347 | 0.293303511791 | 0.83291342206 |
| 50 | 3469.3 | 109.7 | 69.43 | 37.70 | 59869 | 0.000191646473075 | 0.999751875834 |
| 100 | 6933.8 | 109.7 | 108.91 | 76.03 | 60062 | 0.000106223280439 | 0.999873201331 |
| 500 | 34269.7 | 114.4 | 424.02 | 375.84 | 58153 | 8.07236292462e-06 | 0.999990597098 |

## Policy earned by measurement

Live current prediction and the actual pre-Adam backward graph remain fully retained inside the worker. Multi-step runs retain a real loss summary for every update and complete experiments at the first step, each halving of loss relative to the last retained checkpoint, and the requested final step. This retains the rapid early learning transition without hundreds of nearly redundant full experiments. Explicit single Learn and Predict actions retain full semantic evidence. No interpolation creates intermediate checkpoints. Each retained learning experiment includes both exact snapshots and all three runs. Historical missing scalar detail is verified in the separate inspector worker.

Batch count is bounded at 500, below the canonical 1,000-update schedule. The UI checks a conservative session evidence estimate between operations and stops new work at 64 MiB, preserving the archive until an explicit Clear session. Each operation has one-result headroom. Ordinary reset and cancel preserve history. Kiosk inactivity invokes Clear session. UI responsiveness and real browser rendering are measured separately in browser acceptance; Node timings above do not establish browser performance.
