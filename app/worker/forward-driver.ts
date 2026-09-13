import type { ForwardProgress, RunResult, WorkerResponse } from './protocol.js';
import type { ModelWorkerClient } from './client.js';
import { immutableCopy, type Artifact } from '../../trace/types.js';

/** One permit in flight, one browser task between acknowledgements. No model math here. */
export class ForwardDriver {
  progress?: ForwardProgress;
  preview?: RunResult;
  phase: 'idle' | 'starting' | 'paused' | 'running' | 'pausing' | 'cancelling' = 'idle';
  follow = true;
  private epoch = 0;
  private inFlight = false;
  private timer?: ReturnType<typeof setTimeout>;
  private artifacts: Artifact[] = [];
  constructor(private client: Pick<ModelWorkerClient, 'request'>,
    private changed: () => void, private completed: (result: RunResult) => Promise<void>,
    private failed: (error: unknown) => void, readonly pace = 220) {}
  private get cancelling() { return this.phase === 'cancelling'; }
  get active() { return this.phase !== 'idle'; }
  get pending() { return this.inFlight; }
  private clearTimer() { if (this.timer !== undefined) clearTimeout(this.timer); this.timer = undefined; }
  /** Used before a worker reset: immediately invalidate all continuations. */
  discard() { this.epoch++; this.clearTimer(); this.phase = 'idle'; this.inFlight = false; this.progress = undefined; this.preview = undefined; this.artifacts = []; }
  async start(document: string) {
    if (this.active) return;
    this.discard(); const epoch = this.epoch; this.phase = 'starting'; this.follow = true; this.changed();
    try {
      const response = await this.client.request({ command: 'startForward', document });
      if (epoch !== this.epoch) return;
      if (response.status !== 'forward' || !response.progress.start) throw new Error('Missing paused start');
      this.accept(response.progress); if (!this.cancelling) this.phase = 'paused'; this.changed();
    } catch (error) { if (epoch === this.epoch) { this.discard(); this.failed(error); } }
  }
  private accept(progress: ForwardProgress) {
    const frozen = immutableCopy(progress);
    this.progress = frozen;
    this.artifacts.push(...frozen.artifacts);
    const start = frozen.start;
    if (start) this.preview = { run: { formatVersion: 1, manifest: start.manifest, artifacts: [], capture: frozen.capture },
      tokenIds: start.tokenIds, targetIds: start.targetIds, trainingStep: start.trainingStep,
      snapshots: [start.snapshot], runs: [], logits: [], probabilities: [] };
    if (this.preview) this.preview = { ...this.preview, run: { ...this.preview.run, artifacts: this.artifacts, capture: frozen.capture } };
  }
  pause() {
    this.clearTimer();
    if (this.phase === 'running') this.phase = this.inFlight ? 'pausing' : 'paused';
    this.changed();
  }
  explore() { if (!this.active) return; this.follow = false; this.pause(); }
  continue() { if (this.phase !== 'paused') return; this.phase = 'running'; this.changed(); this.schedule(); }
  private schedule() { this.clearTimer(); if (this.phase === 'running') this.timer = setTimeout(() => { this.timer = undefined; void this.next(); }, this.pace); }
  async next() {
    if (this.inFlight || !this.progress || !['paused', 'running'].includes(this.phase)) return;
    const epoch = this.epoch, id = this.progress.executionId, permit = this.progress.sequence + 1;
    this.inFlight = true; this.changed();
    try {
      const response: WorkerResponse = await this.client.request({ command: 'advanceForward', executionId: id, permit });
      if (epoch !== this.epoch) return;
      this.inFlight = false;
      if (response.status === 'result') {
        this.discard(); await this.completed(response.result); return;
      }
      if (response.status !== 'forward' || response.progress.executionId !== id || response.progress.sequence !== permit) throw new Error('Unexpected forward acknowledgement');
      this.accept(response.progress);
      if (this.phase === 'pausing') this.phase = 'paused';
      this.changed(); this.schedule();
    } catch (error) {
      if (epoch !== this.epoch) return;
      // Release worker roots even when the failed request was a transport/protocol failure.
      void this.client.request({ command: 'cancelForward', executionId: id }).catch(() => {});
      this.discard(); this.failed(error);
    }
  }
  async cancel() {
    if (!this.active) return;
    this.clearTimer();
    const id = this.progress?.executionId;
    // A start awaiting its acknowledgement has no ID yet. Its request runId is unknown;
    // the serial cancel command releases that sole cursor after start returns.
    this.phase = 'cancelling'; this.changed();
    try {
      await this.client.request(id ? { command: 'cancelForward', executionId: id } : { command: 'cancel' });
      // A result received before cancellation wins and has already used normal publication.
      if (!this.active) return;
      this.discard(); this.changed();
    } catch (error) { this.discard(); this.failed(error); }
  }
}
