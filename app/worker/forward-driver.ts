import type { ForwardProgress, RunResult, WorkerResponse } from './protocol.js';
import type { ModelWorkerClient } from './client.js';
import { immutableCopy, type Artifact } from '../../trace/types.js';

/** One permit in flight, one browser task between acknowledgements. No model math here. */
export class ForwardDriver {
  progress?: ForwardProgress;
  preview?: RunResult;
  phase: 'idle' | 'starting' | 'paused' | 'running' | 'pausing' | 'cancelling' = 'idle';
  follow = true;
  private pinned = 0;
  get pin() { return this.pinned; }
  set pin(pin: number) { if (pin !== this.pinned) { this.pinned = pin; if (this.active) this.pause(); } }
  private gradientIntent?: { epoch: number; executionId: string; pin: number; sequence: number };
  get runningToGradient() { return !!this.gradientIntent; }
  stopAtPin = false;
  private accepting?: Promise<void>;
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
  discard() { this.gradientIntent = undefined; this.stopAtPin = false; this.epoch++; this.clearTimer(); this.phase = 'idle'; this.inFlight = false; this.progress = undefined; this.preview = undefined; this.artifacts = []; }
  async start(document: string, training = false) {
    if (this.active) return;
    this.discard(); const epoch = this.epoch; this.phase = 'starting'; this.follow = true; this.changed();
    try {
      const response = await this.client.request({ command: training ? 'startTraining' : 'startForward', document });
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
    if (start) this.artifacts = [...frozen.artifacts];
    if (start) this.preview = { run: { formatVersion: 1, manifest: start.manifest, artifacts: [], capture: frozen.capture },
      tokenIds: start.tokenIds, targetIds: start.targetIds, trainingStep: start.trainingStep,
      snapshots: [start.snapshot], runs: [], logits: [], probabilities: [] };
    if (this.preview) this.preview = { ...this.preview, run: { ...this.preview.run, artifacts: this.artifacts, capture: frozen.capture } };
  }
  async inspectPin(pin: number) {
    this.pin = pin;
    const p = this.progress, epoch = this.epoch;
    if (!p?.training || this.inFlight) return;
    const response = await this.client.request({ command: 'inspectTraining', executionId: p.executionId, pin });
    if (epoch !== this.epoch || this.progress?.sequence !== p.sequence || pin !== this.pin || response.status !== 'forward') return;
    this.accept(response.progress); this.changed();
  }
  pause() {
    this.gradientIntent = undefined; this.stopAtPin = false; this.clearTimer();
    if (this.phase === 'running') this.phase = this.inFlight ? 'pausing' : 'paused';
    this.changed();
  }
  explore() { if (!this.active) return; this.follow = false; this.pause(); }
  continue() { this.gradientIntent = undefined; this.stopAtPin = false; this.resume(); }
  runToContribution() {
    const p = this.progress;
    if (this.phase !== 'paused' || this.inFlight || !p?.training || p.training.final) return;
    this.gradientIntent = { epoch: this.epoch, executionId: p.executionId, pin: this.pin, sequence: p.sequence };
    this.stopAtPin = false; this.resume();
  }
  runToProposal() { this.gradientIntent = undefined; this.stopAtPin = true; this.resume(); }
  private resume() { if (this.phase !== 'paused' || this.progress?.training?.phase === 'ready') return; this.phase = 'running'; this.changed(); this.schedule(); }
  private schedule() { this.clearTimer(); if (this.phase === 'running') this.timer = setTimeout(() => { this.timer = undefined; void this.advance(); }, this.progress?.training ? 0 : this.pace); }
  async next() { this.pause(); await this.advance(); }
  private async advance() {
    if (this.inFlight || !this.progress || !['paused', 'running'].includes(this.phase)) return;
    const epoch = this.epoch, id = this.progress.executionId, permit = this.progress.sequence + 1;
    this.inFlight = true; this.changed();
    try {
      let response: WorkerResponse = await this.client.request(this.progress.training ? { command: 'advanceTraining', executionId: id, permit, budget: this.phase === 'running' ? 128 : 1, pin: this.pin, stop: this.stopAtPin || (!!this.gradientIntent && this.gradientIntent.epoch === epoch && this.gradientIntent.executionId === id && this.gradientIntent.pin === this.pin && this.progress.sequence >= this.gradientIntent.sequence && this.progress.training.phase === 'backward') } : { command: 'advanceForward', executionId: id, permit });
      if (epoch !== this.epoch) return;
      if (response.status === 'forward' && (response.progress.executionId !== id || response.progress.sequence !== permit)) throw new Error('Unexpected forward acknowledgement');
      // A pin can change while an admitted unit finishes. Refresh read-only evidence
      // before exposing that acknowledgement under the new parameter's label.
      while (response.status === 'forward' && response.progress.training && response.progress.training.pin !== this.pin && !this.cancelling) {
        const focused = await this.client.request({ command: 'inspectTraining', executionId: id, pin: this.pin });
        if (epoch !== this.epoch) return;
        if (focused.status !== 'forward' || focused.progress.executionId !== id || focused.progress.sequence !== permit) throw new Error('Unexpected pin acknowledgement');
        // Inspection has no new artifact delta. Retain the admitted unit's delta
        // and any new source header while updating only the pin-specific fields.
        response = { ...response, progress: { ...response.progress, training: focused.progress.training } };
      }
      this.inFlight = false;
      if (response.status === 'result') {
        this.discard(); await this.completed(response.result); return;
      }
      if (response.status !== 'forward' || response.progress.executionId !== id || response.progress.sequence !== permit) throw new Error('Unexpected forward acknowledgement');
      this.accept(response.progress);
      if (this.progress?.training?.phase === 'ready' || this.progress?.training?.stopped) { if (!this.cancelling) this.phase = 'paused'; this.gradientIntent = undefined; this.stopAtPin = false; }
      if (this.phase === 'pausing') this.phase = 'paused';
      this.changed(); this.schedule();
    } catch (error) {
      if (epoch !== this.epoch) return;
      // Release worker roots even when the failed request was a transport/protocol failure.
      void this.client.request({ command: 'cancelForward', executionId: id }).catch(() => {});
      this.discard(); this.failed(error);
    }
  }
  acceptUpdate() {
    if (this.accepting) return this.accepting;
    this.accepting = this.acceptCandidate().finally(() => { this.accepting = undefined; });
    return this.accepting;
  }
  private async acceptCandidate() {
    const p = this.progress;
    if (this.inFlight || this.phase !== 'paused' || p?.training?.phase !== 'ready' || !p.training.candidateId) return;
    this.inFlight = true; this.phase = 'pausing'; this.changed(); const epoch = this.epoch;
    try {
      const response = await this.client.request({ command: 'acceptTraining', executionId: p.executionId, candidateId: p.training.candidateId });
      if (epoch !== this.epoch) return;
      if (response.status !== 'result') throw new Error('Missing accepted candidate');
      this.discard(); await this.completed(response.result);
    } catch (error) { if (epoch === this.epoch) { this.discard(); this.failed(error); } }
  }
  async cancel() {
    if (this.accepting) { await this.accepting; return; }
    if (!this.active) return;
    this.gradientIntent = undefined; this.stopAtPin = false; this.clearTimer();
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
