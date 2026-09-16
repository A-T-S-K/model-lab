import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EvidenceStore} from '../../trace/evidence.js';
import {integrations} from '../../trace/integrations.js';
import {composePythiaWorld,renderPythiaWorld,selectPythiaPoint} from '../../app/spatial/pythia-world.js';

const path=process.env.NATIVE_GENERATION_RECORDING;
test('generation timeline selects retained native occurrences and discloses uncached policy',{skip:!path},async()=>{
  const envelope=JSON.parse(await readFile(path!,'utf8')),store=new EvidenceStore(integrations()),run=await store.admit(envelope),selection={node:'',port:'',phase:'',coordinates:{}},model=composePythiaWorld(run,store.metadataEnvelope(run.id),selection,false,store);
  let html=renderPythiaWorld(model,'ready','',false);assert.match(html,/prompt \/ prefill · prefill:0/);assert.match(html,/uncached · full prefix reexecuted/);assert.match(html,/cache unsupported\/unqualified/);
  assert(selectPythiaPoint(model,'generation:2/logits',{output_index:50303}));html=renderPythiaWorld(model,'ready','',false);assert.match(html,/generated step 2 · generation:2/);assert.match(html,/Effective prefix IDs: \[510, 5798, 2206, 327\]/);assert.match(html,/Exact output index 50303/);
  assert(selectPythiaPoint(model,'generation:2/choice'));html=renderPythiaWorld(model,'ready','',true);assert.match(html,/Derived generation-policy decision/);assert.match(html,/SAVED REPLAY · NO EXECUTION/);
});
