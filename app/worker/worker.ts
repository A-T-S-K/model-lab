import { ModelSession } from './controller.js';
import type { WorkerRequest, WorkerResponse } from './protocol.js';
const session = new ModelSession();
const scope = globalThis as unknown as { onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null; postMessage: (message: WorkerResponse) => void };
scope.onmessage = event => {
  void session.handle(event.data, response => scope.postMessage(response)).then(response => {
    if (!['train', 'acceptTraining'].includes(event.data.command) || response.status !== 'result') scope.postMessage(response);
  });
};
