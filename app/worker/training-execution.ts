import { forwardSequence, forwardBoundaries, objectiveSequence } from '../../model/microgpt.js';
import { backwardSequence, zeroGrad } from '../../model/autograd.js';
import { adamProposals, applyAdam, validateOptimizerState, type AdamUpdate, type ParameterUpdate } from '../../model/training.js';
import { parameterValues, restoreTraining, snapshotTraining } from '../../model/state.js';
import { archiveSnapshot, type ArchivedSnapshot } from '../../archive/session.js';
import { TraceRecorder } from '../../trace/recorder.js';
import { CaptureContext } from '../../inspect/capture.js';
import { immutableCopy, type RecordedRun } from '../../trace/types.js';
import { runManifest } from './manifest.js';
import type { ForwardProgress, RequestTag, RunResult } from './protocol.js';

export type TrainingPhase = 'baseline forward' | 'training forward' | 'loss' | 'backward seed' | 'backward' | 'optimizer proposal' | 'candidate application' | 'candidate forward' | 'ready';
export interface LiveContribution { child: number | undefined; operand: number; childAdjoint: number; localDerivative: number; contribution: number; before: number; after: number; ordinal: number }
export interface TrainingProgress {
  phase: TrainingPhase; count: number; processed: number; acceptedStep: number; candidateId?: string;
  pin: number; gradient: number; final: boolean; contributions: LiveContribution[]; proposal?: ParameterUpdate;
  stopped: boolean; sourceRunId: string; baselinePasses: number;
}
/** One private working snapshot in the existing session transaction. No accepted writes. */
export class TrainingExecution {
  readonly working;
  phase: TrainingPhase = 'baseline forward'; sequence = 0; count = 0; sent = 0;
  private forward; private boundaries; private objective?: ReturnType<typeof objectiveSequence>;
  private backward?: ReturnType<typeof backwardSequence>; private proposals?: ReturnType<typeof adamProposals>;
  private objectiveResult?: ReturnType<typeof objectiveSequence> extends Generator<unknown,infer R> ? R : never;
  private update?: AdamUpdate; private beforeRun?: RecordedRun; private trainingRun?: RecordedRun;
  private trainingContext?: CaptureContext; private candidate?: ArchivedSnapshot;
  private contributions: LiveContribution[] = []; private pin = 0; private hit = false;
  private occurrence = 0; private proposalValues: ParameterUpdate[] = [];
  private gradients: number[] = []; private startPending = true;
  recorder!: TraceRecorder; context!: CaptureContext; result?: RunResult;
  constructor(readonly id: string, readonly tag: RequestTag, readonly starting: ArchivedSnapshot, readonly tokenIds: number[], readonly targetIds: number[]) {
    this.working = restoreTraining(starting.state);
    validateOptimizerState(this.working.model, this.working.optimizer);
    this.capture(`${id}:before`, starting);
    this.forward = forwardSequence(this.working.model, tokenIds, this.context);
    this.boundaries = forwardBoundaries(this.working.model, tokenIds);
  }
  private capture(id: string, snapshot: ArchivedSnapshot) {
    this.recorder = new TraceRecorder(runManifest(id, this.tag, snapshot, this.tokenIds, this.targetIds));
    this.context = new CaptureContext(this.working.model, this.recorder); this.sent = 0; this.startPending = true;
  }
  private change(phase: TrainingPhase) { this.phase = phase; this.count = 0; }
  inspect(source: string, target: Parameters<CaptureContext['inspect']>[0]) {
    return (source === this.recorder.manifest.runId ? this.context : source === `${this.id}:training` ? this.trainingContext : undefined)?.inspect(target);
  }
  progress(processed = 0, stopped = false): ForwardProgress {
    const delta = this.recorder.delta(this.sent); this.sent += delta.artifacts.length;
    const snapshot = this.phase === 'candidate forward' || this.phase === 'ready' ? this.candidate! : this.starting;
    const start = this.startPending ? { manifest: this.recorder.manifest, snapshot, tokenIds: this.tokenIds, targetIds: this.targetIds, trainingStep: this.starting.state.optimizer.step } : undefined;
    this.startPending = false;
    return immutableCopy({ executionId: this.id, sequence: this.sequence, total: this.boundaries.length, ...delta, start,
      ...(this.phase.endsWith('forward') ? { last: this.boundaries[this.count - 1], next: this.boundaries[this.count] } : {}),
      training: { phase: this.phase, count: this.count, processed, acceptedStep: this.starting.state.optimizer.step, candidateId: this.candidate?.id,
        pin: this.pin, gradient: this.gradients[this.pin] ?? parameterValues(this.working.model)[this.pin].grad,
        final: this.gradients.length > 0, contributions: this.contributions, proposal: this.proposalValues[this.pin], stopped,
        sourceRunId: this.recorder.manifest.runId, baselinePasses: 1 } });
  }
  async advance(permit: number, budget: number, pin: number, stop: boolean) {
    if (permit !== this.sequence + 1 || this.phase === 'ready') throw new Error('Duplicate or out-of-order permit');
    if (!Number.isInteger(budget) || budget < 1 || budget > 128 || !Number.isInteger(pin) || !parameterValues(this.working.model)[pin]) throw new Error('Invalid work budget or pin');
    if (pin !== this.pin) { this.pin = pin; this.contributions = []; }
    this.hit = false; const phase = this.phase; let processed = 0;
    do { if (this.phase === 'candidate application') await this.applyCandidate(); else this.unit(); processed++; } while (processed < budget && this.phase === phase && !(stop && this.hit) && (phase === 'backward' || phase === 'optimizer proposal'));
    this.sequence++; return this.progress(processed, stop && (this.hit || this.phase !== phase));
  }
  private unit() {
    const { model, optimizer } = this.working;
    if (this.phase.endsWith('forward')) {
      const next = this.forward.next();
      if (next.done) throw new Error('Unexpected forward completion');
      this.count++;
      if (this.count < this.boundaries.length) return;
      const end = this.forward.next(); if (!end.done) throw new Error('Incomplete forward');
      if (this.phase === 'baseline forward') {
        this.beforeRun = this.recorder.finish(); this.capture(`${this.id}:training`, this.starting); this.trainingContext = this.context;
        zeroGrad(parameterValues(model)); this.forward = forwardSequence(model, this.tokenIds, this.context); this.change('training forward');
      } else if (this.phase === 'training forward') {
        this.objective = objectiveSequence(end.value, this.targetIds, this.context); this.change('loss');
      } else {
        const afterRun = this.recorder.finish(), objective = this.objectiveResult!, update = this.update!;
        const numbers = (rows: typeof end.value.logits) => rows.map(row => row.map(v => v.data));
        const prediction = { logits: numbers(end.value.logits), probabilities: numbers(end.value.probabilities) };
        const learn = { meanLoss: objective.mean.data, perPositionLoss: objective.perPosition.map(v => v.data),
          before: { logits: numbers(objective.logits), probabilities: numbers(objective.probabilities) }, after: prediction, update };
        this.result = { ...prediction, run: afterRun, tokenIds: this.tokenIds, targetIds: this.targetIds, trainingStep: optimizer.step, learn,
          snapshots: [this.starting, this.candidate!], runs: [this.beforeRun!, this.trainingRun!, afterRun],
          experiment: { id: `${this.id}:learning`, startingSnapshotId: this.starting.id, resultingSnapshotId: this.candidate!.id,
            beforeRunId: this.beforeRun!.manifest.runId, trainingRunId: this.trainingRun!.manifest.runId, afterRunId: this.id,
            backwardRunId: this.trainingRun!.manifest.runId, objective: { inputIds: this.tokenIds, targetIds: this.targetIds, meanLoss: learn.meanLoss }, update } };
        this.change('ready');
      }
    } else if (this.phase === 'loss') {
      const next = this.objective!.next(); this.count++;
      if (next.done) { this.objectiveResult = next.value; this.change('backward seed'); }
    } else if (this.phase === 'backward seed') {
      const parameters = parameterValues(model);
      this.backward = backwardSequence(this.objectiveResult!.mean, e => {
        this.occurrence++;
        if (e.parent !== parameters[this.pin]) return;
        this.hit = true;
        this.contributions.push({ child: this.context.nodeId(e.child), operand: e.operand, childAdjoint: e.childAdjoint,
          localDerivative: e.localDerivative, contribution: e.contribution, before: e.before, after: e.after, ordinal: this.occurrence });
        if (this.contributions.length > 8) this.contributions.shift();
      });
      this.backward.next(); this.change('backward');
    } else if (this.phase === 'backward') {
      const next = this.backward!.next(); this.count++;
      if (next.done) {
        this.gradients = parameterValues(model).map(v => v.grad); this.context.captureBackward(this.objectiveResult!.mean);
        this.trainingRun = this.recorder.finish(); this.proposals = adamProposals(model, optimizer); this.change('optimizer proposal');
      }
    } else if (this.phase === 'optimizer proposal') {
      const next = this.proposals!.next(); this.count++;
      if (next.done) { this.update = next.value; this.change('candidate application'); }
      else { this.proposalValues.push(next.value); this.hit = next.value.index === this.pin; }
    }
  }
  private async applyCandidate() {
    const { model, optimizer } = this.working;
    applyAdam(model, optimizer, this.update!); optimizer.datasetCursor++;
    this.candidate = await archiveSnapshot(snapshotTraining(model, optimizer));
    this.capture(this.id, this.candidate); this.forward = forwardSequence(model, this.tokenIds, this.context); this.change('candidate forward');
  }

  acceptedContexts() { return new Map([[`${this.id}:training`, this.trainingContext!], [this.id, this.context]]); }
}
