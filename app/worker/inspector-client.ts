import type { HistoricalRequest, AblationRequest, ActivationPatchRequest, ActivationVariantRequest, WorkerResponse } from './protocol.js';
import type { InspectionResult } from '../../inspect/types.js';
import type { HeadAblationExperiment } from '../../experiments/ablation.js';
import type { ActivationPatchExperiment } from '../../experiments/activation-patch.js';
import type { ActivationVariantExperiment } from '../../experiments/model-variant.js';

/** Cancellation terminates disposable historical work; it never resets the live model. */
export class InspectorWorkerClient {
  private worker?: Worker;
  private generation = 0;
  private sequence = 0;
  private sessionId = crypto.randomUUID();
  private pending = new Map<string, {resolve(value: WorkerResponse): void; reject(error: Error): void}>();
  async inspect(request: Omit<HistoricalRequest, 'command' | 'sessionId' | 'generationId' | 'runId'>): Promise<InspectionResult> {
    const response = await this.request({ ...request, command: 'inspect' });
    if (response.status !== 'inspection') throw new Error('Invalid inspection response');
    return response.inspection;
  }
  async ablate(request: Omit<AblationRequest, 'command' | 'sessionId' | 'generationId' | 'runId'>): Promise<HeadAblationExperiment> {
    const response = await this.request({ ...request, command: 'ablate' });
    if (response.status !== 'ablation') throw new Error('Invalid ablation response');
    return response.experiment;
  }
  async activationPatch(request: Omit<ActivationPatchRequest, 'command' | 'sessionId' | 'generationId' | 'runId'>): Promise<ActivationPatchExperiment> {
    const response = await this.request({ ...request, command: 'activationPatch' });
    if (response.status !== 'activationPatch') throw new Error('Invalid activation-patch response');
    return response.experiment;
  }
  async activationVariant(request: Omit<ActivationVariantRequest, 'command' | 'sessionId' | 'generationId' | 'runId'>): Promise<ActivationVariantExperiment> {
    const response = await this.request({ ...request, command: 'activationVariant' });
    if (response.status !== 'activationVariant') throw new Error('Invalid activation-variant response');
    return response.experiment;
  }
  private request(request: Omit<HistoricalRequest, 'sessionId' | 'generationId' | 'runId'> | Omit<AblationRequest, 'sessionId' | 'generationId' | 'runId'> | Omit<ActivationPatchRequest, 'sessionId' | 'generationId' | 'runId'> | Omit<ActivationVariantRequest, 'sessionId' | 'generationId' | 'runId'>): Promise<WorkerResponse> {
    if (!this.worker) {
      const worker = new Worker(new URL('./inspector-worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        if (worker !== this.worker || data.sessionId !== this.sessionId || data.generationId !== this.generation) return;
        const pending = this.pending.get(data.runId); if (!pending) return;
        this.pending.delete(data.runId);
        if (data.status === 'inspection' || data.status === 'ablation' || data.status === 'activationPatch' || data.status === 'activationVariant') pending.resolve(data);
        else pending.reject(new Error(data.status === 'error' ? data.error : 'Invalid inspector response'));
      };
      worker.onerror = event => { if (worker === this.worker) { for (const item of this.pending.values()) item.reject(new Error(event.message)); this.pending.clear(); } };
    }
    const runId = `inspection:${++this.sequence}`;
    return new Promise((resolve, reject) => {
      this.pending.set(runId, { resolve, reject });
      this.worker!.postMessage({ ...request, sessionId: this.sessionId, generationId: this.generation, runId });
    });
  }
  cancel(): void {
    this.worker?.terminate(); this.worker = undefined; this.generation++;
    for (const pending of this.pending.values()) pending.reject(new Error('Inspection cancelled'));
    this.pending.clear();
  }
  dispose(): void { this.cancel(); }
}
