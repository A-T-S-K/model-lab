import {test} from 'node:test';
import assert from 'node:assert/strict';
import profile from '../../research/pythia/profile.json';
import witnessProfile from '../../research/witnesses/profile.json';
import {fullSupportDistribution} from '../../app/views/full-support-distribution.js';
import {composePythiaWorld,renderPythiaScene,renderPythiaWorld,resolvePythiaSelection,selectPythiaPoint} from '../../app/spatial/pythia-world.js';
import {composeEvidenceFallback,shapeFallbackConfig} from '../../app/spatial/evidence-fallback.js';
import type {EvidenceEnvelope,EvidencePoint,EvidenceRun} from '../../trace/evidence.js';
import type {WorldSelection} from '../../app/spatial/topology.js';

const n=3;
function shape(id:string){return id==='tokens'?[n]:id==='logits'?[50304]:id==='attention.weights'?[4,n,n]:id==='attention.qkv'?[n,4,3,32]:[n,128];}
function fixture():{run:EvidenceRun;envelope:EvidenceEnvelope}{
  const points=profile.captureSchema.map(schema=>{
    const pointShape=shape(schema.id),size=pointShape.reduce((a,b)=>a*b,1),values=schema.id==='tokens'?[101,102,103]:schema.id==='attention.weights'?Array.from({length:size},(_,i)=>Math.fround((i+1)/100)):schema.id==='logits'?Array.from({length:size},(_,i)=>Math.fround((i%17-8)/8)):Array(size).fill(0);
    return {...schema,shape:pointShape,axes:schema.axes.map((axis,i)=>({...axis,size:pointShape[i]!})),dtype:schema.id==='tokens'?'int32':'float32',encoding:'json-numbers-row-major',values,origin:'observed',availability:'available',semantics:schema.id==='attention.qkv'?'Observed fused QKV before RoPE.':schema.id==='attention.weights'?'Observed probabilities after RoPE, scaling and causal mask.':schema.id==='norm.attention'||schema.id==='norm.mlp'?'LayerNorm of the same residual input.':schema.id==='mlp.output'?'GELU MLP output; internals uncaptured.':schema.id==='residual.output'?'(attention.output + mlp.output) + residual.input':schema.id==='logits'?'Full 50304 observed final-position logits.':schema.id} as EvidencePoint;
  });
  const run={version:1,id:'pythia-test:run',integration:'pythia-native-v1',definition:profile.definition,checkpoint:profile.checkpoint,inputTransform:profile.inputTransform,profile:profile.profile,runtime:profile.runtime,request:{version:1,integration:'pythia-native-v1',profile:profile.profile,requestId:'run',sessionId:'pythia-test',epoch:0,action:'predict',input:'The cat sat'},execution:'native',precision:{storage:'F16',compute:'float32',policy:'test fixture mirrors admitted profile'},input:{text:'The cat sat',tokenIds:[101,102,103],labels:['The',' cat',' sat'],offsets:[[0,3],[3,7],[7,11]]},points,limits:['Inference/capture/replay only.']} as EvidenceRun;
  return {run,envelope:{version:1,codec:'pythia-native-v1',record:run}};
}
const blank=():WorldSelection=>({node:'',port:'',phase:'',coordinates:{}});

test('M2-D source-bound overview has six repeated blocks and only nonzero block 1 has observed detail',()=>{
  const {run,envelope}=fixture(),model=composePythiaWorld(run,envelope,blank(),false),scene=renderPythiaScene(model);
  assert.equal(model.profile.architecture.configRevision,`sha256:${run.definition.split(':')[1]}`);
  assert.equal(model.world.descriptor.nodes.filter(node=>/^structure\.block\.\d$/.test(node.id)).length,6);
  assert.equal((scene.match(/data-pythia-block=/g)??[]).length,6);assert.match(scene,/BLOCK 1/);assert.match(scene,/NONZERO LAYER 1/);
  assert.deepEqual([0,2,3,4,5].map(layer=>scene.includes(`data-pythia-block="${layer}"`)),[true,true,true,true,true]);
  assert(model.world.relationships.some(edge=>edge.origin==='source_declared'&&edge.from.node==='structure.block.0'&&edge.to.node==='structure.block.1'));
  assert(!model.world.relationships.some(edge=>edge.origin==='observed'&&edge.to.node==='lm_head'));
  assert(!model.world.descriptor.nodes.some(node=>node.operation.toLowerCase().includes('position embedding')));
});

test('M2-D selected layer uses two observed parallel LayerNorm branches and one three-input residual',()=>{
  const {run,envelope}=fixture(),model=composePythiaWorld(run,envelope,blank(),false),edges=model.world.relationships.filter(edge=>edge.origin==='observed');
  const consumers=edges.filter(edge=>edge.from.node==='gpt_neox.layers.1'&&edge.from.port==='input').map(edge=>edge.to.node).sort();
  assert.deepEqual(consumers,['gpt_neox.layers.1','gpt_neox.layers.1.input_layernorm','gpt_neox.layers.1.post_attention_layernorm']);
  const residualInputs=edges.filter(edge=>edge.to.node==='gpt_neox.layers.1'&&edge.to.port==='output').map(edge=>edge.from.node).sort();
  assert.deepEqual(residualInputs,['gpt_neox.layers.1','gpt_neox.layers.1.attention','gpt_neox.layers.1.mlp']);
  assert.equal(model.profile.architecture.normalization.kind,'LayerNorm');assert.notEqual(model.profile.architecture.normalization.kind,'RMSNorm');
  assert.equal(model.profile.architecture.activation,'gelu');assert.equal(model.profile.architecture.parallelResidual,true);
  const html=renderPythiaWorld(model,'ready','',false);assert.match(html,/128 → affine with bias → 512 → GELU → affine with bias → 128/);
  assert.doesNotMatch(html,/ReLU|mlp\.hidden|preactivation/i);
});

test('M2-D typed attention navigation selects two heads while pre-RoPE QKV refuses score reconstruction',()=>{
  const {run,envelope}=fixture(),selection=blank(),model=composePythiaWorld(run,envelope,selection,false);
  assert(selectPythiaPoint(model,'attention.weights',{query_head:0,query_position:2,key_position:1}));let resolved=resolvePythiaSelection(run,selection);assert(resolved.valid);const head0=resolved.point.values![resolved.index!];
  selection.coordinates.query_head=2;resolved=resolvePythiaSelection(run,selection);assert(resolved.valid);const head2=resolved.point.values![resolved.index!];assert.notEqual(head0,head2);
  let html=renderPythiaWorld(model,'ready','',false);assert.match(html,/Observed after rotary position transformation, scaling, causal masking/);assert.match(html,new RegExp(`head 2 · query 2 · key 1 = <strong>${head2}`));
  assert(selectPythiaPoint(model,'attention.qkv',{input_position:2,query_head:2,qkv_member:0,head_feature:31}));html=renderPythiaWorld(model,'ready','',false);assert.match(html,/PRE-RoPE/);assert.match(html,/No Q·K reconstruction is presented/);
  model.memory.refusal='Unsupported native score detail: post-RoPE Q/K and attention scores were not captured.';html=renderPythiaWorld(model,'ready','',false);assert.match(html,/post-RoPE Q\/K and attention scores were not captured/);
});

test('M2-D logits use all 50304 entries, preserve omitted mass and select unlabeled index 50303',()=>{
  const {run,envelope}=fixture(),model=composePythiaWorld(run,envelope,blank(),false);assert(selectPythiaPoint(model,'logits',{output_index:50303}));
  const logits=model.selected.values!,distribution=fullSupportDistribution(logits,50303);assert.equal(distribution.size,50304);assert.equal(distribution.denominator,logits.reduce((sum,value)=>sum+Math.exp(value-distribution.maximum),0));assert(distribution.omittedMass>0&&distribution.omittedMass<1);
  const html=renderPythiaWorld(model,'ready','',false);assert.match(html,/all <strong>50304<\/strong> observed logits/);assert.match(html,/Omitted probability mass/);assert.match(html,/Exact output index 50303/);assert.match(html,/No tokenizer label exists: index ≥ 50277/);assert.doesNotMatch(html,/tetrahedron|simplex/i);
});

test('M2-D replay composes without an executor and switching worlds clears incompatible coordinates',()=>{
  const pythia=fixture(),selection=blank(),live=composePythiaWorld(pythia.run,pythia.envelope,selection,false);selectPythiaPoint(live,'attention.qkv',{input_position:2,query_head:3,qkv_member:2,head_feature:31});
  const shapeRun=witnessProfile.fixtures.shape as unknown as EvidenceRun,shapeEnvelope={version:1,codec:shapeRun.integration,record:shapeRun} as EvidenceEnvelope;composeEvidenceFallback(shapeRun,shapeEnvelope,selection,false,shapeFallbackConfig);assert.deepEqual(Object.keys(selection.coordinates).sort(),['example','feature']);
  const replay=composePythiaWorld(pythia.run,pythia.envelope,selection,true);assert.equal(replay.source.relationship,'REPLAY');assert.equal(replay.selected.id,'residual.input');assert.deepEqual(Object.keys(selection.coordinates).sort(),['feature','input_position']);
  const html=renderPythiaWorld(replay,'ready','',true);assert.match(html,/SAVED REPLAY · NO EXECUTION/);assert.match(html,/never invokes the native bridge/);
});
