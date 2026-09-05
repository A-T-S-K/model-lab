import fixture from '../../fixtures/canonical.initial.json';
import { loadModel, createOptimizerState, snapshotTraining } from '../../model/state.js';
import { predict, tokenize } from '../../model/microgpt.js';
import { trainStep } from '../../model/training.js';
import { TraceRecorder } from '../../trace/recorder.js';
import { TracePlayer } from '../../trace/player.js';
import type { RecordedRun, RunManifest } from '../../trace/types.js';
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

/** Synchronous model logic is invoked only inside the worker in the browser. */
export class ModelSession {
  private model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
  private optimizer = createOptimizerState(this.model, fixture.optimizer);
  private run?: RecordedRun;
  private generationId = -1;
  private sessionId = '';

  handle(request: WorkerRequest): WorkerResponse {
    const tag = { sessionId: request.sessionId, runId: request.runId, generationId: request.generationId };
    try {
      if (request.command === 'initialize' || request.command === 'reset') {
        if (request.generationId < this.generationId || (this.sessionId && request.sessionId !== this.sessionId)) throw new Error('Stale session or generation');
        this.model = loadModel(fixture.config, fixture.parameters, fixture.parameterOrder);
        this.optimizer = createOptimizerState(this.model, fixture.optimizer);
        this.run = undefined;
        this.sessionId = request.sessionId; this.generationId = request.generationId;
        return { ...tag, status: 'ready', snapshot: snapshotTraining(this.model, this.optimizer) };
      }
      if (request.sessionId !== this.sessionId || request.generationId !== this.generationId) throw new Error('Stale session or generation');
      if (request.command === 'cancel') return { ...tag, status: 'cancelled' };
      if (request.command === 'detail') {
        if (!this.run) throw new Error('Predict first to capture evidence');
        return { ...tag, status: 'detail', detail: attentionDetail(this.run, request.layer, request.head, request.query, request.key) };
      }
      if (request.command !== 'predict' && request.command !== 'train') throw new Error('Unknown worker command');
      const { tokenIds, targetIds } = tokenize(this.model, request.document);
      const learn = request.command === 'train' ? trainStep(this.model, this.optimizer, tokenIds, targetIds) : undefined;
      const manifest: RunManifest = {
        runId: request.runId, sessionId: this.sessionId, generationId: this.generationId,
        model: { id: 'microgpt', version: fixture.reference.revision, architecture: this.model.config as unknown as RunManifest['model']['architecture'], capabilities: ['predict', 'learn', 'attentionDetail'] },
        startingCheckpointId: this.optimizer.step === 0 ? `fixture-${fixture.reference.sha256}` : `${this.sessionId}:${this.generationId}:step-${this.optimizer.step}`,
        startingSnapshotId: `${this.sessionId}:${this.generationId}:step-${this.optimizer.step}`,
        input: tokenIds, targets: targetIds, numeric: { dtype: 'float64', policy: 'ECMAScript binary64; ordered scalar reductions' },
        capture: { level: 'semantic', maxArtifacts: 1024, maxValues: 16384 }, runtimeVersion: 'model-lab-0.1.0',
      };
      const recorder = new TraceRecorder(manifest);
      const result = predict(this.model, tokenIds, recorder);
      this.run = recorder.finish();
      return { ...tag, status: 'result', result: { ...result, run: this.run, tokenIds, targetIds, trainingStep: this.optimizer.step, ...(learn ? { learn } : {}) } };
    } catch (error) {
      return { ...tag, status: 'error', error: error instanceof Error ? error.message : String(error) };
    }
  }
}
