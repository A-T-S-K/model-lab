import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EvidenceStore,parseEvidence,serializeEvidence} from '../../trace/evidence.js';
import {integrations} from '../../trace/integrations.js';
import {evidenceWorldIntegration} from '../../app/spatial/integrations.js';
import {mlpDefaultSelection,resolveMlpSelection,selectionForPoint,type MlpWorldModel} from '../../app/spatial/mlp-world.js';
import {composeWorld,type WorldDescriptor,type WorldSelection} from '../../app/spatial/topology.js';

test('M2-B generic descriptors and selections do not enumerate MicroGPT layout or transformer coordinates',()=>{
  const descriptor:WorldDescriptor={integration:'example',modelDefinition:'different-model',label:'Different model',presentation:'registered-layout-from-an-integration',nodes:[{id:'module',operation:'identity',port:'output',coordinates:{}}]};
  assert.equal(descriptor.presentation,'registered-layout-from-an-integration');
  assert.deepEqual(composeWorld(descriptor,'run','call:0','forward')[0],{modelDefinition:'different-model',node:'module',port:'output',run:'run',invocation:'call:0',phase:'forward',coordinates:{}});
  const selection:WorldSelection={node:'module',port:'output',phase:'forward',coordinates:{example:0}};
  assert.deepEqual(Object.keys(selection).sort(),['coordinates','node','phase','port']);
  assert.equal('layer' in selection,false);assert.equal('query' in selection,false);assert.equal('head' in selection,false);
});

const directory=process.env.WITNESS_RECORDING_DIR;
async function recording(name:string){return JSON.parse(await readFile(`${directory}/${name}.json`,'utf8'));}

test('M2-B admitted numeric MLP composes truthful forward, parameter, gradient and SGD world',{skip:!directory},async()=>{
  const envelope=await recording('train'),store=new EvidenceStore(integrations()),run=await store.admit(envelope,envelope.record.run.request);
  const selection=mlpDefaultSelection(run),composition=evidenceWorldIntegration(run.integration)!.compose(run,envelope,selection,false);
  assert.equal(composition.kind,'registered');if(composition.kind!=='registered')return;const model=composition.model as MlpWorldModel;
  assert.equal(model.world.descriptor.presentation,'numeric-mlp-compact-v1');
  assert(!Object.values(model.selection.coordinates).includes('layer'));assert.deepEqual(Object.keys(model.selection.coordinates),['example','input_feature']);

  const edges=model.run.points.flatMap(to=>to.dependencies.map(from=>`${from}->${to.id}`));
  for(const edge of ['inputs->hidden.pre','hidden.pre->hidden','hidden->prediction','prediction->squared.error','targets->squared.error','squared.error->loss'])assert(edges.includes(edge),edge);
  for(const edge of ['w1.before->hidden.pre','b1.before->hidden.pre','w2.before->prediction','b2.before->prediction'])assert(edges.includes(edge),edge);
  assert(model.world.relationships.some(r=>r.kind==='gradient'&&r.to.node==='w1'&&r.to.port==='gradient'));
  assert(model.world.relationships.some(r=>r.kind==='optimizer_update'&&r.to.node==='w1'&&r.to.port==='after'));
  assert(model.world.relationships.some(r=>r.kind==='parameter_state'&&r.to.node==='w1'&&r.to.port==='delta'));

  const gradient=run.points.find(p=>p.id==='b2.gradient')!,selected=selectionForPoint(gradient);selected.coordinates.output_feature=0;
  assert.deepEqual(resolveMlpSelection(run,selected),{point:gradient,valid:true,index:0});
  const before=run.points.find(p=>p.id==='b2.before')!.values![0]!,g=gradient.values![0]!,delta=run.points.find(p=>p.id==='b2.delta')!.values![0]!,after=run.points.find(p=>p.id==='b2.after')!.values![0]!;assert.notEqual(g,0);
  assert.equal(after,Math.fround(before-0.0625*g));assert.equal(delta,Math.fround(after-before));assert.equal(envelope.record.resulting.optimizer.family,'SGD');

  assert.equal(resolveMlpSelection(run,{...selected,coordinates:{...selected.coordinates,output_feature:1}}).valid,false);
  assert.equal(resolveMlpSelection(run,{...selected,coordinates:{...selected.coordinates,layer:0}}).valid,false);
});

test('M2-B saved MLP replay composes without an executor and preserves semantic identity',{skip:!directory},async()=>{
  const envelope=await recording('predict'),liveStore=new EvidenceStore(integrations()),live=await liveStore.admit(envelope,envelope.record.run.request);
  const replayStore=new EvidenceStore(integrations()),replayed=await replayStore.admit(parseEvidence(serializeEvidence(envelope))),saved=replayStore.envelope(replayed.id);
  const selection=mlpDefaultSelection(replayed),composition=evidenceWorldIntegration(replayed.integration)!.compose(replayed,saved,selection,true);
  assert.equal(composition.kind,'registered');if(composition.kind!=='registered')return;
  assert.equal(composition.model.source.relationship,'REPLAY');assert.deepEqual(replayed.points,live.points);
  const hidden=selectionForPoint(replayed.points.find(p=>p.id==='hidden.pre')!,selection);assert.equal(resolveMlpSelection(replayed,hidden).valid,true);
});
