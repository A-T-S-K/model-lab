import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelSession } from '../../app/worker/controller.js';
import { EvidenceStore, parseEvidence, serializeEvidence } from '../../trace/evidence.js';
import { integrations } from '../../trace/integrations.js';

// Exercise direct saved-envelope admission, without a disk fixture or alternate validator.
test('direct legacy import rejects a jointly forged checkpoint ID without admitting partial evidence', async () => {
  const session = new ModelSession(), tag={sessionId:'legacy-import',generationId:0};
  await session.handle({...tag,runId:'init',command:'initialize'});
  const response=await session.handle({...tag,runId:'predict',command:'predict',document:'abca'});
  if(response.status!=='result')throw Error('missing fixture result');
  const envelope={version:1 as const,codec:'microgpt-legacy-v1',record:{run:response.result.run,snapshot:response.result.snapshots[0]}};
  const store = new EvidenceStore(integrations());
  const good = await store.admit(envelope);
  const before = store.envelope(good.id);
  const id='arbitrary-matching-string';
  const bad={...envelope,record:{snapshot:{...envelope.record.snapshot,id},
    run:{...envelope.record.run,manifest:{...envelope.record.run.manifest,startingCheckpointId:id}}}};
  const fresh = new EvidenceStore(integrations());
  await assert.rejects(fresh.admit(parseEvidence(serializeEvidence(bad))), /snapshot.*(hash|ID)|checkpoint/i);
  assert.equal(fresh.list().length, 0);
  await assert.rejects(store.admit(bad));
  assert.equal(store.envelope(good.id), before);
  assert.equal(store.get(good.id).checkpoint, envelope.record.snapshot.id);
  assert.deepEqual(await new EvidenceStore(integrations()).admit(parseEvidence(serializeEvidence(envelope))), good);
});
