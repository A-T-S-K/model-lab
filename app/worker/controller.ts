import fixture from '../../fixtures/canonical.initial.json';
import { loadModel, createOptimizerState, snapshotTraining, restoreTraining } from '../../model/state.js';
import { predict, tokenize } from '../../model/microgpt.js';
import { trainStep } from '../../model/training.js';
import { TraceRecorder } from '../../trace/recorder.js';
import { TracePlayer } from '../../trace/player.js';
import type { RecordedRun, RunManifest } from '../../trace/types.js';
import { archiveSnapshot, snapshotId, type ArchivedSnapshot, type LearningExperiment } from '../../archive/session.js';
import { CaptureContext } from '../../inspect/capture.js';
import { runManifest } from './manifest.js';
import type { AttentionDetail, WorkerRequest, WorkerResponse } from './protocol.js';

export function attentionDetail(run: RecordedRun, layer: number, head: number, query: number, key: number): AttentionDetail {
  const player = new TracePlayer(run);
  const empty: AttentionDetail = { provenance: 'derived', availability: key > query ? 'not_applicable' : 'not_captured', q: [], k: [], products: [], sum: null, scale: null, scaled: null, observedLogit: null, probability: null, logits: [], sourceRunId: run.manifest.runId };
  if (![layer, head, query, key].every(value => Number.isSafeInteger(value) && value >= 0) || key > query) return empty;
  const config = run.manifest.model.architecture;
  const width = Number(config.nEmbd) / Number(config.nHead);
  if (head >= Number(config.nHead) || layer >= Number(config.nLayer)) return empty;
  const get = (kind: string, token: number, selectedHead?: number) => player.selectConcept({ kind, layer, token, ...(selectedHead === undefined ? {} : { head: selectedHead }) })[0]?.values;
  const qFull = get('q', query); const kFull = get('k', key);
  const logits = get('attentionLogits', query, head); const probabilities = get('attentionProbabilities', query, head);
  if (!qFull || !kFull || !logits || !probabilities || key >= logits.length) return empty;
  const q = qFull.slice(head * width, (head + 1) * width);
  const k = kFull.slice(head * width, (head + 1) * width);
  const products = q.map((value, i) => value * k[i]);
  const sum = products.reduce((a, b) => a + b, 0);
  const scale = 1 / Math.sqrt(width);
  return { provenance: 'derived', availability: 'available', q, k, products, sum, scale,
    scaled: sum * scale, observedLogit: logits[key], probability: probabilities[key], logits: [...logits], sourceRunId: run.manifest.runId };
}

/** Owns the only mutable live model. Requests execute serially across async hashing. */
export class ModelSession {
  private model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
  private optimizer = createOptimizerState(this.model, fixture.optimizer);
  private run?: RecordedRun;
  private contexts = new Map<string, CaptureContext>();
  private generationId = -1;
  private sessionId = '';
  private queue: Promise<unknown> = Promise.resolve();

  handle(request: WorkerRequest, publishTrainingResult?: (response: WorkerResponse) => void): Promise<WorkerResponse> {
    const response = this.queue.then(() => this.execute(request, publishTrainingResult));
    this.queue = response.catch(() => undefined);
    return response;
  }

  private async execute(request: WorkerRequest, publishTrainingResult?: (response: WorkerResponse) => void): Promise<WorkerResponse> {
    const tag = { sessionId: request.sessionId, runId: request.runId, generationId: request.generationId };
    let rollback: ReturnType<typeof snapshotTraining> | undefined;
    try {
      if (request.command === 'initialize' || request.command === 'reset' || request.command === 'restore') {
        if (request.generationId < this.generationId || (this.sessionId && request.sessionId !== this.sessionId)) throw new Error('Stale session or generation');
        if (request.command === 'restore') {
          if (await snapshotId(request.snapshot.state) !== request.snapshot.id) throw new Error('Snapshot identity mismatch');
          const restored = restoreTraining(request.snapshot.state);
          this.model = restored.model; this.optimizer = restored.optimizer;
        } else {
          this.model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
          this.optimizer = createOptimizerState(this.model, fixture.optimizer);
        }
        this.run = undefined; this.contexts.clear();
        this.sessionId = request.sessionId; this.generationId = request.generationId;
        const snapshot = snapshotTraining(this.model, this.optimizer);
        return { ...tag, status: 'ready', snapshot, archivedSnapshot: await archiveSnapshot(snapshot) };
      }
      if (request.sessionId !== this.sessionId || request.generationId !== this.generationId) throw new Error('Stale session or generation');
      if (request.command === 'cancel') return { ...tag, status: 'cancelled' };
      if (request.command === 'detail') {
        if (!this.run) throw new Error('Predict first to capture evidence');
        return { ...tag, status: 'detail', detail: attentionDetail(this.run, request.layer, request.head, request.query, request.key) };
      }
      if (request.command === 'inspect') {
        const context = this.contexts.get(request.sourceRunId);
        return { ...tag, status: 'inspection', inspection: context ? context.inspect(request.target) : {
          sourceRunId: request.sourceRunId, provenance: 'observed', availability: 'not_captured', graph: null,
          reason: 'The live execution has been released. Use the archived snapshot for verified historical inspection.',
        } };
      }
      if (request.command !== 'predict' && request.command !== 'train') throw new Error('Unknown worker command');
      const { tokenIds, targetIds } = tokenize(this.model, request.document);
      const starting = await archiveSnapshot(snapshotTraining(this.model, this.optimizer));
      const capture = (id: string, snapshot: ArchivedSnapshot) => {
        const recorder = new TraceRecorder(runManifest(id, tag, snapshot, tokenIds, targetIds));
        return { recorder, context: new CaptureContext(this.model, recorder) };
      };
      if (request.command === 'predict') {
        const { recorder, context } = capture(request.runId, starting);
        const prediction = predict(this.model, tokenIds, context);
        this.run = recorder.finish(); this.contexts.clear(); this.contexts.set(request.runId, context);
        return { ...tag, status: 'result', result: { ...prediction, run: this.run, tokenIds, targetIds,
          trainingStep: this.optimizer.step, snapshots: [starting], runs: [this.run] } };
      }
      rollback = starting.state;
      // All three executions have their own immutable manifests and semantic evidence.
      const before = capture(`${request.runId}:before`, starting);
      predict(this.model, tokenIds, before.context);
      const beforeRun = before.recorder.finish();
      const training = capture(`${request.runId}:training`, starting);
      const learn = trainStep(this.model, this.optimizer, tokenIds, targetIds, training.context);
      const trainingRun = training.recorder.finish();
      const resulting = await archiveSnapshot(snapshotTraining(this.model, this.optimizer));
      const after = capture(request.runId, resulting);
      const prediction = predict(this.model, tokenIds, after.context);
      const afterRun = after.recorder.finish();
      const experiment: LearningExperiment = {
        id: `${request.runId}:learning`, startingSnapshotId: starting.id, resultingSnapshotId: resulting.id,
        beforeRunId: beforeRun.manifest.runId, trainingRunId: trainingRun.manifest.runId,
        afterRunId: afterRun.manifest.runId, backwardRunId: trainingRun.manifest.runId,
        objective: { inputIds: tokenIds, targetIds, meanLoss: learn.meanLoss }, update: learn.update,
      };
      const response: WorkerResponse = { ...tag, status: 'result', result: { ...prediction, run: afterRun, tokenIds, targetIds,
        trainingStep: this.optimizer.step, learn, experiment, snapshots: [starting, resulting],
        runs: [beforeRun, trainingRun, afterRun] } };
      // Production publication is synchronous structured-clone acceptance, inside rollback protection.
      publishTrainingResult?.(response);
      this.run = afterRun; this.contexts.clear();
      this.contexts.set(trainingRun.manifest.runId, training.context);
      this.contexts.set(afterRun.manifest.runId, after.context);
      return response;
    } catch (error) {
      if (rollback) {
        const restored = restoreTraining(rollback);
        this.model = restored.model; this.optimizer = restored.optimizer;
      }
      return { ...tag, status: 'error', error: error instanceof Error ? error.message : String(error) };
    }
  }
}
