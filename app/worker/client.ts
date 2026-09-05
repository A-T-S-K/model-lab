import type { WorkerRequest, WorkerResponse } from './protocol.js';
type Command = WorkerRequest extends infer R ? R extends WorkerRequest ? Omit<R, 'sessionId' | 'runId' | 'generationId'> : never : never;

/** Termination cancels synchronous scalar work immediately; generations reject late replies. */
export class ModelWorkerClient {
  readonly sessionId = crypto.randomUUID();
  private generationId = 0;
  private sequence = 0;
  private worker: Worker;
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
      if (response.status === 'error') pending.reject(new Error(response.error)); else pending.resolve(response);
    };
    worker.onerror = event => {
      if (worker !== this.worker) return;
      for (const pending of this.pending.values()) pending.reject(new Error(event.message));
      this.pending.clear();
    };
    return worker;
  }
  request(command: Command): Promise<WorkerResponse> {
    const runId = `${this.sessionId}:${this.generationId}:${++this.sequence}`;
    return new Promise((resolve, reject) => {
      this.pending.set(runId, { resolve, reject });
      this.worker.postMessage({ ...command, runId, sessionId: this.sessionId, generationId: this.generationId });
    });
  }
  initialize(): Promise<WorkerResponse> { return this.request({ command: 'initialize' }); }
  reset(): Promise<WorkerResponse> {
    this.worker.terminate();
    for (const pending of this.pending.values()) pending.reject(new Error('Run cancelled by reset'));
    this.pending.clear(); this.generationId++;
    this.worker = this.spawn();
    return this.initialize();
  }
  cancel(): Promise<WorkerResponse> { return this.reset(); }
  dispose(): void {
    this.worker.terminate();
    for (const pending of this.pending.values()) pending.reject(new Error('Worker disposed'));
    this.pending.clear();
  }
}
