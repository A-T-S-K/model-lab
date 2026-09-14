import { canonicalIntent } from './execution-intent.js';
import type { WorkerRequest, WorkerResponse } from './protocol.js';
import type { ArchivedSnapshot } from '../../archive/session.js';
type Command = WorkerRequest extends infer R ? R extends WorkerRequest ? Omit<R, 'sessionId' | 'runId' | 'generationId'> : never : never;

/** Termination cancels synchronous scalar work immediately; generations reject late replies. */
export class ModelWorkerClient {
  onFailure?: (error: Error) => void;
  private failure?: Error;
  readonly sessionId = crypto.randomUUID();
  private generationId = 0;
  private sequence = 0;
  private worker: Worker;
  private completedSnapshot?: ArchivedSnapshot;
  private pending = new Map<string, { resolve: (value: WorkerResponse) => void; reject: (error: Error) => void }>();

  constructor() { this.worker = this.spawn(); }
  private spawn(): Worker {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.sessionId !== this.sessionId || response.generationId !== this.generationId) return;
      const pending = this.pending.get(response.runId);
      if (!pending) return;
      this.pending.delete(response.runId);
      if (response.status === 'ready' && response.archivedSnapshot) this.completedSnapshot = response.archivedSnapshot;
      if (response.status === 'result') this.completedSnapshot = response.result.snapshots.at(-1);
      if (response.status === 'error') pending.reject(new Error(response.error)); else pending.resolve(response);
    };
    worker.onerror = event => {
      if (worker !== this.worker) return;
      for (const pending of this.pending.values()) pending.reject(new Error(event.message));
      this.pending.clear();
      this.failure = new Error(event.message);
      this.onFailure?.(this.failure);
    };
    return worker;
  }
  request(command: Command): Promise<WorkerResponse> {
    if (this.failure) return Promise.reject(this.failure);
    const runId = `${this.sessionId}:${this.generationId}:${++this.sequence}`;
    return new Promise((resolve, reject) => {
      this.pending.set(runId, { resolve, reject });
      const request: WorkerRequest = { ...command, runId, sessionId: this.sessionId, generationId: this.generationId };
      const intent = canonicalIntent(request);
      this.worker.postMessage(intent ? { ...request, intent } : request);
    });
  }
  initialize(): Promise<WorkerResponse> { return this.request({ command: 'initialize' }); }
  reset(snapshot?: ArchivedSnapshot): Promise<WorkerResponse> {
    this.worker.terminate();
    for (const pending of this.pending.values()) pending.reject(new Error('Run cancelled by reset'));
    this.pending.clear(); this.generationId++;
    this.failure = undefined; this.worker = this.spawn();
    return snapshot ? this.request({ command: 'restore', snapshot }) : this.initialize();
  }
  cancel(): Promise<WorkerResponse> { return this.reset(this.completedSnapshot); }
  dispose(): void {
    this.worker.terminate();
    for (const pending of this.pending.values()) pending.reject(new Error('Worker disposed'));
    this.pending.clear();
  }
}
