import {test} from 'node:test';
import assert from 'node:assert/strict';
import profile from '../../research/witnesses/profile.json';
import {EvidenceStore,parseEvidence,serializeEvidence,type EvidenceEnvelope,type EvidencePoint,type EvidenceRun} from '../../trace/evidence.js';
import {integrations} from '../../trace/integrations.js';
import {composeEvidenceFallback,groupedFallbackConfig,groupedMappingValue,opaqueFallbackConfig,renderEvidenceFallback,renderEvidenceFallbackScene,resolveEvidenceSelection,selectEvidencePoint,selectionForEvidencePoint,shapeFallbackConfig,type CoordinateMemory} from '../../app/spatial/evidence-fallback.js';
import {evidenceWorldIntegration} from '../../app/spatial/integrations.js';
import type {WorldSelection} from '../../app/spatial/topology.js';

type FixtureName='grouped'|'shape'|'opaque';
async function fixture(name:FixtureName){
  const run=profile.fixtures[name] as unknown as EvidenceRun,envelope={version:1,codec:run.integration,record:run} as EvidenceEnvelope,store=new EvidenceStore(integrations());
  return {run:await store.admit(envelope),envelope,store};
}
const blank=():WorldSelection=>({node:'',port:'',phase:'',coordinates:{}});

test('M2-C registered fixtures compose through one bounded evidence fallback',async()=>{
  for(const name of ['grouped','shape','opaque'] as const){
    const {run,envelope}=await fixture(name),selection=blank(),integration=evidenceWorldIntegration(run.integration)!;
    const composition=integration.compose(run,envelope,selection,false);assert.equal(composition.kind,'registered');if(composition.kind!=='registered')continue;
    assert.equal(composition.model.presentation.id,'bounded-evidence-fallback-v1');assert.equal(composition.model.world.run,run.id);
    assert.equal(composition.model.world.nodes.length,run.points.length);assert.equal(composition.model.source.relationship,'HISTORICAL');
  }
});

test('M2-C grouped query and KV coordinates remain distinct and use the observed mapping',async()=>{
  const {run,envelope}=await fixture('grouped'),selection=blank(),model=composeEvidenceFallback(run,envelope,selection,false,groupedFallbackConfig),memory=model.memory;
  assert.deepEqual([0,1,2,3].map(q=>groupedMappingValue(run,q)),[0,0,1,1]);
  selection.coordinates.query_head=2;assert(selectEvidencePoint(run,selection,'mapping',memory,groupedFallbackConfig));
  assert.deepEqual(selection.coordinates,{query_head:2});assert(selectEvidencePoint(run,selection,'key',memory,groupedFallbackConfig));
  assert.deepEqual(selection.coordinates,{kv_head:1,key_position:0,feature:0});assert.equal(model.config.mapping!(run,memory.values)?.statement,'Selected query head 2 maps to KV head 1');
  assert.equal(resolveEvidenceSelection(run,{node:'key',port:'output',phase:'forward',coordinates:{query_head:1,key_position:0,feature:0}}).valid,false);
  assert.equal(resolveEvidenceSelection(run,{node:'key',port:'output',phase:'forward',coordinates:{kv_head:2,key_position:0,feature:0}}).valid,false);
  assert(selectEvidencePoint(run,selection,'value',memory,groupedFallbackConfig));assert.deepEqual(selection.coordinates,{kv_head:1,key_position:0,value_feature:0});
  assert(selectEvidencePoint(run,selection,'scores',memory,groupedFallbackConfig));assert.deepEqual(selection.coordinates,{query_head:2,key_position:0});
  selection.coordinates.key_position=1;const scores=resolveEvidenceSelection(run,selection);assert(scores.valid&&scores.index===5);assert.equal(scores.point.values![scores.index],-0.7071067690849304);
  assert(selectEvidencePoint(run,selection,'weights',memory,groupedFallbackConfig));assert.equal(resolveEvidenceSelection(run,selection).point?.values?.[5],0.0558072067797184);
  assert(selectEvidencePoint(run,selection,'output',memory,groupedFallbackConfig));assert.deepEqual(selection.coordinates,{query_head:2,value_feature:0});assert.equal(resolveEvidenceSelection(run,selection).point?.values?.[4],5.111614227294922);
  assert(model.world.relationships.some(r=>r.kind==='coordinate_mapping'&&r.origin==='derived'));
});

test('M2-C coordinates survive only matching roles and coordinate spaces',async()=>{
  const {run}=await fixture('shape'),input=run.points[0]!,output=run.points[1]!,selection:WorldSelection={node:input.node,port:input.port,phase:input.phase,coordinates:{example:1,feature:2}};
  const memory:CoordinateMemory={identity:'fixture:shape',values:new Map()};
  const compatible=selectionForEvidencePoint(output,input,selection,memory);assert.deepEqual(compatible.coordinates,{example:1,feature:2});
  const other={...output,axes:output.axes.map((axis,i)=>i===1?{...axis,space:'unrelated:feature'}:axis)} as EvidencePoint;
  const incompatible=selectionForEvidencePoint(other,input,selection,memory);assert.deepEqual(incompatible.coordinates,{example:1,feature:0});
});

test('M2-C shape-only world remains structural and renders no numerical glyph',async()=>{
  const {run,envelope}=await fixture('shape'),selection=blank(),model=composeEvidenceFallback(run,envelope,selection,false,shapeFallbackConfig);
  assert(run.points.every(p=>p.availability==='shape_only'&&p.values===null));assert(model.world.relationships.every(r=>r.kind==='structural'));
  assert(!renderEvidenceFallbackScene(model).includes('data-numerical-glyph'));
  selectEvidencePoint(run,selection,'unknown.custom',model.memory,shapeFallbackConfig);const html=renderEvidenceFallback(composeEvidenceFallback(run,envelope,selection,false,shapeFallbackConfig),'ready','',false);
  assert.match(html,/Shape \[2, 5\]/);assert.match(html,/structural preview, not a forward execution/);assert.match(html,/values are null/);
});

test('M2-C opaque boundary retains known input and output while unsupported detail refuses fabrication',async()=>{
  const {run,envelope}=await fixture('opaque'),selection=blank(),model=composeEvidenceFallback(run,envelope,selection,false,opaqueFallbackConfig);
  assert.deepEqual(run.points.find(p=>p.id==='input')!.values,[3,4]);assert.deepEqual(run.points.find(p=>p.id==='output')!.values,[5]);assert.equal(run.points.find(p=>p.id==='opaque.norm')!.values,null);
  assert(model.world.relationships.some(r=>r.kind==='evidence_boundary'&&r.from.node==='input'&&r.to.node==='opaque.norm'));
  selectEvidencePoint(run,selection,'unknown.scalar.explanation',model.memory,opaqueFallbackConfig);const html=renderEvidenceFallback(composeEvidenceFallback(run,envelope,selection,false,opaqueFallbackConfig),'ready','',false);
  assert.match(html,/requested scalar explanation is unsupported/i);assert.match(html,/no internal arithmetic is registered/i);assert.doesNotMatch(html,/3\s*[×*²^]|4\s*[×*²^]|sqrt|square root/i);
});

test('M2-C saved fixture replay composes without execution and fixture switching clears coordinates',async()=>{
  const grouped=await fixture('grouped'),selection=blank(),live=composeEvidenceFallback(grouped.run,grouped.envelope,selection,false,groupedFallbackConfig);
  selection.coordinates.query_head=3;selectEvidencePoint(grouped.run,selection,'output',live.memory,groupedFallbackConfig);assert.deepEqual(selection.coordinates,{query_head:3,value_feature:0});
  const shape=await fixture('shape'),switched=composeEvidenceFallback(shape.run,shape.envelope,selection,false,shapeFallbackConfig);assert.equal(switched.selected.id,'input');assert.deepEqual(selection.coordinates,{example:0,feature:0});
  const replayStore=new EvidenceStore(integrations()),replayed=await replayStore.admit(parseEvidence(serializeEvidence(grouped.envelope))),saved=composeEvidenceFallback(replayed,replayStore.envelope(replayed.id),blank(),true,groupedFallbackConfig);
  assert.equal(saved.source.relationship,'REPLAY');assert.deepEqual(replayed.points,grouped.run.points);assert.equal(saved.run.request.action,'predict');
});

test('M2-C fallback bounds scene objects and discloses retained points beyond the scene',async()=>{
  const grouped=await fixture('grouped'),points=Array.from({length:30},(_,i)=>({...grouped.run.points[0]!,id:`point.${i}`,node:`point.${i}`,shape:[],axes:[],values:[i],dependencies:[]})),run={...grouped.run,id:'fixture:bounded',definition:'fixture-bounded-v1',points} as EvidenceRun,envelope={version:1,codec:run.integration,record:run} as EvidenceEnvelope;
  const model=composeEvidenceFallback(run,envelope,blank(),false,{label:'Bounded synthetic evidence'});assert.equal(model.displayed.length,24);assert.equal(model.hiddenCount,6);assert.equal(model.world.nodes.length,24);
  const html=renderEvidenceFallback(model,'ready','',false);assert.match(html,/first 24 of 30 points/);assert.match(html,/6 additional points remain/);assert.match(html,/point\.29/);
});
