import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutorRegistry, type CanonicalReceipt } from '../../app/worker/executors.js';
import { SessionArchive } from '../../archive/session.js';
import { ModelSession } from '../../app/worker/controller.js';

test('canonical binding returns only the request receipt; refuses failures with prior history intact', async () => {
  const session=new ModelSession(),archive=new SessionArchive();
  const tag={sessionId:'receipt-test',generationId:0};
  await session.handle({...tag,runId:'init',command:'initialize'});
  for(const runId of ['first','later']) {
    const response=await session.handle({...tag,runId,command:'predict',document:'abca'});
    assert.equal(response.status,'result');if(response.status!=='result')throw Error('missing result');
    for(const snapshot of response.result.snapshots)await archive.addSnapshot(snapshot);
    await archive.addRun(response.result.run);
  }
  const binding=new ExecutorRegistry().get('microgpt-legacy-v1');
  const context={input:'unused',endpoint:'unused',store:archive.evidence};
  const run=await binding.execute({...context,canonical:async()=>({status:'completed',runId:'first'})});
  assert.equal(run.id,'first','select exact returned identity even if it is not last in the store');
  const before=archive.evidence.list();
  for(const outcome of [
    {status:'refused',reason:'invalid input d'},
    {status:'refused',reason:'session evidence budget'},
    {status:'failed',reason:'worker failure'},
  ] as CanonicalReceipt[]) {
    await assert.rejects(binding.execute({...context,canonical:async()=>outcome}),new RegExp(outcome.status==='completed'?'never':outcome.reason));
    assert.deepEqual(archive.evidence.list(),before);
  }
  await assert.rejects(binding.execute({...context,canonical:async()=>{throw Error('worker rejected');}}),/worker rejected/);
  await assert.rejects(binding.execute({...context,canonical:async()=>({status:'completed',runId:'missing'})}),/Missing run/);
});
