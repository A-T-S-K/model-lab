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

import {spatialReadModel} from '../../app/spatial/bindings.js';
import {forwardTourEvidence,learningHandoff} from '../../app/presentation/release-learning.js';
import {releaseIntroduction} from '../../app/views/release-learning.js';

test('forward tour reads authentic causal arithmetic, projection lineage and unchanged prediction endpoint',async()=>{
  const session=new ModelSession(),tag={sessionId:'forward-tour',generationId:0};
  await session.handle({...tag,runId:'init',command:'initialize'});
  const r=await session.handle({...tag,runId:'predict',command:'predict',document:'abca'});
  if(r.status!=='result')throw Error('real prediction required');
  const {run,snapshots}=r.result;
  const source={sourceRunId:run.manifest.runId,sourceSnapshotId:snapshots[0]!.id,capturedDocument:'abca',origin:'OBSERVED',verification:'NONE',relationship:'HISTORICAL',phase:'FORWARD',availability:'AVAILABLE'} as const;
  const selection={layer:0,query:3,key:0,head:0,feature:0};
  const m=spatialReadModel(run,snapshots[0],source,selection),e=forwardTourEvidence(m,'abca');assert(e.available);
  assert.equal(e.run,run.manifest.runId);assert.equal(e.width,4);
  assert.deepEqual(e.positions.filter(p=>p.eligible).map(p=>p.position),[0,1,2,3]);assert(!e.positions[4]!.eligible);
  assert.equal(m.forward.values({kind:'attentionLogits',layer:0,head:0,token:3})![4],undefined);
  assert.equal(e.q.explanation.parameterName,'layer0.attn_wq');assert.equal(e.keys[0]!.explanation.parameterName,'layer0.attn_wk');assert.equal(e.values[0]!.explanation.parameterName,'layer0.attn_wv');
  const close=(derived:number,observed:number)=>assert(Math.abs(derived-observed)<=1e-30+1e-12*Math.abs(observed));
  assert.deepEqual(e.lens.q,e.q.values!.slice(0,4));assert.deepEqual(e.lens.k,e.keys[0]!.values!.slice(0,4));
  assert.deepEqual(e.lens.products,e.lens.q!.map((v,i)=>v*e.lens.k![i]!));assert.equal(e.lens.sum,e.lens.products!.reduce((s,v)=>s+v,0));
  close(e.lens.sum!/Math.sqrt(e.width),e.heads[0]!.score.values![0]!);
  for(const h of e.heads){
    assert.equal(h.score.values!.length,4);assert.equal(h.weights.values!.length,4);close(h.weights.values!.reduce((s,v)=>s+v,0),1);
    const x=h.output.explanation;assert.equal(x.points!.length,4);
    for(let i=0;i<e.width;i++)close(x.points!.reduce((sum,v,k)=>sum+v![i]!*x.probabilities![k]!,0),h.output.values![i]!);
    assert.equal(x.reconstructionProvenance,'DERIVED');assert.equal(h.score.address.head,h.head);
  }
  assert.deepEqual(e.get('attentionOutput').values,e.heads.flatMap(h=>[...h.output.values!]));
  for(const kind of ['attentionProjection','mlpUp','mlpDown','logits']){
    const x=e.get(kind);assert(x.explanation.terms);close(x.explanation.terms.reduce((s,t)=>s+t.product,0),x.values![0]!);
    assert.equal(x.identity,m.forward.semanticId(x.address));assert.equal(x.artifact,m.forward.artifact(x.address)?.id);
  }
  assert.equal(e.get('attentionResidual').explanation.upstream[1]!.address.kind,'embeddingNorm');
  assert.equal(e.get('mlpResidual').explanation.upstream[1]!.address.kind,'attentionResidual');
  for(let i=0;i<8;i++){
    close(e.get('attentionProjection').values![i]!+e.get('embeddingNorm').values![i]!,e.get('attentionResidual').values![i]!);
    close(e.get('mlpDown').values![i]!+e.get('attentionResidual').values![i]!,e.get('mlpResidual').values![i]!);
  }
  assert.deepEqual(e.get('mlpRelu').values,e.get('mlpUp').values!.map(v=>Math.max(0,v)));
  assert.equal(e.get('mlpUp').values!.length,32);assert.equal(e.get('mlpDown').values!.length,8);
  assert.equal(e.get('preMlpNorm').explanation.upstream[0]!.address.kind,'attentionResidual');
  const softmax=e.get('probabilities').explanation;assert.equal(softmax.scoreInputs!.length,4);
  assert.equal(softmax.denominator,softmax.exponentials!.reduce((s,v)=>s+v,0));
  e.intro.rows.forEach((row,i)=>close(softmax.exponentials![i]!/softmax.denominator!,row.probability));
  assert.deepEqual(e.intro.rows.map(x=>x.probability),r.result.probabilities[3]);
  assert.match(releaseIntroduction(m.forward,'p1_complete','abca',false,false,undefined,m)!,/original chapter 1 result/);
  assert.match(releaseIntroduction(m.forward,'p1_attention_compare','abca',false,false,undefined,m)!,/future · excluded; no score coordinate/);
  assert(learningHandoff(m,'abca',true).available);assert(!learningHandoff(m,'abca',false).available);assert(!learningHandoff(m,'ab',true).available);assert(!learningHandoff(undefined,'abca',true).available);
  const stale=forwardTourEvidence(m,'ab');assert(stale.available&&stale.intro.stale);
  assert(!forwardTourEvidence(undefined,'abca').available);
  assert(!forwardTourEvidence({...m,source:{...source,sourceRunId:'other'}},'abca').available);
  assert(!forwardTourEvidence({...m,selection:{...selection,head:1}},'abca').available);
  const incompatible=spatialReadModel(run,{...snapshots[0]!,id:'wrong'},source,selection);assert(!forwardTourEvidence(incompatible,'abca').available);
  const missing={...m,forward:{...m.forward,values:(a:Parameters<typeof m.forward.values>[0])=>a.kind==='v'?undefined:m.forward.values(a)}};
  assert(!forwardTourEvidence(missing,'abca').available);
});
