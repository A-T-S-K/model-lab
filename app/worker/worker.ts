import { ModelSession } from './controller.js';
import type { WorkerRequest, WorkerResponse } from './protocol.js';
const session = new ModelSession();
const scope = globalThis as unknown as { onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null; postMessage: (message: WorkerResponse) => void };
scope.onmessage = event => { void session.handle(event.data).then(response => scope.postMessage(response)); };
