import { forward } from '../../model/microgpt.js';
import { loadModel } from '../../model/state.js';
import fixture from '../../fixtures/noncanonical.initial.json';
import { NONCANONICAL, pointMetadata } from '../../trace/noncanonical.js';
import { check, validateRequest, evidenceHash, type EvidencePoint, type ExecutionRequest, type EvidenceEnvelope } from '../../trace/evidence.js';
import { RUNTIME_REVISION } from '../../runtime/revision.js';
export async function executeNoncanonical(intent:ExecutionRequest):Promise<EvidenceEnvelope>{
  const r=validateRequest(intent);check(r.version===1&&r.integration===NONCANONICAL&&r.profile==='microgpt-multilayer-f64-v1'&&r.action==='predict'&&typeof r.input==='string','Noncanonical request refused');
  const ids=[fixture.config.bosTokenId,...[...r.input].map(c=>fixture.config.vocabulary.indexOf(c))];
  check(ids.length<=fixture.config.blockSize&&ids.every(n=>n>=0),'Use at most five characters from w x y z !');
  const points:EvidencePoint[]=[];
  forward(loadModel(fixture.config,fixture.parameters,fixture.parameterOrder),ids,{observe(e){points.push({...pointMetadata(e.kind,e.token!,e.layer,e.head),values:[...e.values]});}});
  return {version:1,codec:NONCANONICAL,record:{state:fixture,run:{version:1,id:`${r.sessionId}:${r.requestId}`,integration:NONCANONICAL,definition:await evidenceHash(fixture.config),checkpoint:await evidenceHash(fixture),inputTransform:await evidenceHash(fixture.config.vocabulary),profile:r.profile,runtime:RUNTIME_REVISION,request:r,execution:'native',precision:{storage:'float64',compute:'float64',policy:'Native MicroGPT binary64, unchanged arithmetic'},input:{text:r.input,tokenIds:ids,labels:ids.map(id=>fixture.config.vocabulary[id]??'BOS'),offsets:[]},points,limits:['Separate deterministic 2-layer, 3-head, width-6, context-6, 5-character fixture. Existing readable MicroGPT forward; no copied scene.','Prediction only; saved parameters/config/order are inference state. No optimizer continuation, scalar capture, generation or mutation advertised.']}}};
}
