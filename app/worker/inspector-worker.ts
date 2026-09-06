import { inspectHistorical } from './inspector.js';
import type { HistoricalRequest, AblationRequest, WorkerResponse } from './protocol.js';
import { runHeadAblation } from '../../experiments/ablation.js';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<HistoricalRequest | AblationRequest>) => void; postMessage(response: WorkerResponse): void };
scope.onmessage = event => {
  const request = event.data;
  const tag = { sessionId: request.sessionId, runId: request.runId, generationId: request.generationId };
  const execution = request.command === 'ablate'
    ? runHeadAblation(request.snapshot, request.inputIds, request.targetIds, request.selection, tag).then(experiment => ({ ...tag, status: 'ablation' as const, experiment }))
    : inspectHistorical(request).then(inspection => ({ ...tag, status: 'inspection' as const, inspection }));
  void execution.then(response => scope.postMessage(response))
    .catch(error => scope.postMessage({ ...tag, status: 'error', error: error instanceof Error ? error.message : String(error) }));
};
