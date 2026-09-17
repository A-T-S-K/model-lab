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

test('T06 disposable local-worker authority recovers last matching receipt, not an unacknowledged candidate after worker death',async()=>{
 const OriginalWorker=globalThis.Worker,workers:any[]=[];
 class FakeWorker {onmessage:any;onerror:any;sent:any[]=[];constructor(){workers.push(this);}postMessage(m:any){this.sent.push(m);}terminate(){}}
 globalThis.Worker=FakeWorker as any;
 try {
  const client=new ModelWorkerClient(),initial={id:'accepted-0',state:{}} as any;
  const init=client.initialize();workers[0].onmessage({data:{...workers[0].sent[0],status:'ready',archivedSnapshot:initial,snapshot:{}}});await init;
  const accept=client.request({command:'acceptTraining',executionId:'candidate',candidateId:'candidate-1'});const rejected=assert.rejects(accept,/worker died/);
  // Neither wrong generation nor wrong request is a matching receipt.
  const response={...workers[0].sent[1],status:'result',result:{snapshots:[initial,{id:'candidate-1'}]}};
  workers[0].onmessage({data:{...response,generationId:99}});workers[0].onmessage({data:{...response,runId:'unknown'}});
  workers[0].onerror({message:'worker died'});await rejected;
  // Unlike a surviving remote authority, this worker's private unacknowledged state died with it.
  const recovery=client.cancel();assert.equal(workers[1].sent[0].command,'restore');assert.equal(workers[1].sent[0].snapshot.id,'accepted-0');
  workers[1].onmessage({data:{...workers[1].sent[0],status:'ready',archivedSnapshot:initial,snapshot:{}}});await recovery;
  const accepted=client.request({command:'acceptTraining',executionId:'new',candidateId:'candidate-1'});
  workers[1].onmessage({data:{...workers[1].sent[1],status:'result',result:{snapshots:[initial,{id:'candidate-1'}]}}});await accepted;
  const retained=client.cancel();assert.equal(workers[2].sent[0].snapshot.id,'candidate-1');workers[2].onmessage({data:{...workers[2].sent[0],status:'ready',snapshot:{}}});await retained;client.dispose();
 }finally{globalThis.Worker=OriginalWorker;}
});
