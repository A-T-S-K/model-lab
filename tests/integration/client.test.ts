import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelWorkerClient } from '../../app/worker/client.js';
import type { WorkerRequest } from '../../app/worker/protocol.js';

test('reset cancels old work and ignores both stale replies and stale worker errors', async () => {
  const OriginalWorker = globalThis.Worker;
  const workers: FakeWorker[] = [];
  class FakeWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: ((event: { message: string }) => void) | null = null;
    sent: WorkerRequest[] = []; terminated = false;
    constructor() { workers.push(this); }
    postMessage(request: WorkerRequest) { this.sent.push(request); }
    terminate() { this.terminated = true; }
  }
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  try {
    const client = new ModelWorkerClient();
    const first = client.initialize();
    const cancelled = assert.rejects(first, /cancelled/);
    const reset = client.reset();
    assert.equal(workers[0].terminated, true);
    await cancelled;
    workers[0].onerror?.({ message: 'old worker failed late' });
    workers[0].onmessage?.({ data: { ...workers[0].sent[0], status: 'ready' } });
    workers[1].onmessage?.({ data: { ...workers[1].sent[0], status: 'ready', snapshot: {} } });
    assert.equal((await reset).status, 'ready');
    const running = client.request({ command: 'train', document: 'abca' });
    const cancelledTrain = assert.rejects(running, /cancelled/);
    const cancel = client.cancel(); await cancelledTrain;
    workers[2].onmessage?.({ data: { ...workers[2].sent[0], status: 'ready', snapshot: {} } });
    await cancel; client.dispose();
  } finally { globalThis.Worker = OriginalWorker; }
});
