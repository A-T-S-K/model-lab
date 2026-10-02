import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ModelSession} from '../../app/worker/controller.js';
import {forwardReadModel} from '../../app/spatial/forward.js';
import {introductoryEvidence, predictionFeedback, releaseLearningEnabled} from '../../app/presentation/release-learning.js';

test('opt-in learning activity cannot replace explicit deployment or classic entries',()=>{
  assert(releaseLearningEnabled(new URLSearchParams('experience=learn')));
  for(const q of ['', 'presentation=spatial','experience=learn&presentation=classic','experience=learn&kiosk=1','experience=learn&demo=1'])assert(!releaseLearningEnabled(new URLSearchParams(q)));
});

test('introduction binds exact full support, token lookup, both norms and causal prefix to an authentic run',async()=>{
  const session=new ModelSession();const tag={sessionId:'release-intro',generationId:0};
  await session.handle({...tag,runId:'init',command:'initialize'});
  const response=await session.handle({...tag,runId:'prediction',command:'predict',document:'abca'});
  assert.equal(response.status,'result');if(response.status!=='result')throw Error('expected computation');
  const f=forwardReadModel(response.result.run,response.result.snapshots[0]);const e=introductoryEvidence(f,'abca');
  assert(e.available);assert.equal(e.document,'abca');assert.equal(e.prefix,'abc');assert.equal(e.targetLabel,'a');assert.equal(e.finalTarget,'END');assert.equal(e.finalPosition,4);assert.equal(e.token,2);
  assert.deepEqual(e.rows.map(r=>r.probability),response.result.probabilities[3]);
  for(const m of e.members){assert.deepEqual(m.values,f.values(m.address));assert.equal(m.identity,f.semanticId(m.address));assert.equal(m.artifact,f.artifact(m.address)?.id);}
  assert.equal(e.members[0]!.values![0]!+e.members[1]!.values![0]!,e.members[2]!.values![0]);
  assert.match(predictionFeedback(e,'guarantee'),new RegExp(e.predictedLabel));assert.match(predictionFeedback(e,'train'),/did not train/);
  const stale=introductoryEvidence(f,'ab');assert(stale.available&&stale.stale);assert.equal(stale.document,'abca');
  assert(!introductoryEvidence(f,'abca',999).available);assert(!introductoryEvidence(undefined,'abca').available);
  const missing={...f,values:(a:Parameters<typeof f.values>[0])=>a.kind==='probabilities'?undefined:f.values(a)};
  assert(!introductoryEvidence(missing,'abca').available);
  const short=await session.handle({...tag,runId:'short',command:'predict',document:'ab'});assert.equal(short.status,'result');
  if(short.status==='result')assert(!introductoryEvidence(forwardReadModel(short.result.run,short.result.snapshots[0]),'ab').available);
  const unsupported=await session.handle({...tag,runId:'unsupported',command:'predict',document:'z'});assert.equal(unsupported.status,'error');
});
