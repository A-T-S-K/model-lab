import {test} from 'node:test';
import assert from 'node:assert/strict';
import profile from '../../research/witnesses/profile.json';
import {EvidenceStore,IntegrationRegistry,parseEvidence,serializeEvidence,type EvidenceEnvelope,type EvidencePoint,type EvidenceRun} from '../../trace/evidence.js';
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
  const memory:CoordinateMemory={identity:'fixture:shape',values:new Map(),pointOffset:0,upstreamOffset:0,downstreamOffset:0,valueOffset:0};
  const compatible=selectionForEvidencePoint(output,input,selection,memory);assert.deepEqual(compatible.coordinates,{example:1,feature:2});
  const other={...output,axes:output.axes.map((axis,i)=>i===1?{...axis,space:'unrelated:feature'}:axis)} as EvidencePoint;
  const incompatible=selectionForEvidencePoint(other,input,selection,memory);assert.deepEqual(incompatible.coordinates,{example:1,feature:0});
});

test('M2-C shape-only world remains structural and renders no numerical glyph',async()=>{
  const {run,envelope}=await fixture('shape'),selection=blank(),model=composeEvidenceFallback(run,envelope,selection,false,shapeFallbackConfig);
  assert(run.points.every(p=>p.availability==='shape_only'&&p.values===null));assert(model.world.relationships.every(r=>r.kind==='structural'));
  assert(!renderEvidenceFallbackScene(model).includes('data-numerical-glyph'));
  selectEvidencePoint(run,selection,'unknown.custom',model.memory,shapeFallbackConfig);const html=renderEvidenceFallback(composeEvidenceFallback(run,envelope,selection,false,shapeFallbackConfig),'ready','',false);
  assert.match(html,/Shape \[2, 5\]/);assert.match(html,/Only structural shape/);assert.doesNotMatch(html,/data-testid="fallback-values"/);
});

test('M2-C opaque boundary retains known input and output while unsupported detail refuses fabrication',async()=>{
  const {run,envelope}=await fixture('opaque'),selection=blank(),model=composeEvidenceFallback(run,envelope,selection,false,opaqueFallbackConfig);
  assert.deepEqual(run.points.find(p=>p.id==='input')!.values,[3,4]);assert.deepEqual(run.points.find(p=>p.id==='output')!.values,[5]);assert.equal(run.points.find(p=>p.id==='opaque.norm')!.values,null);
  assert(model.world.relationships.some(r=>r.kind==='evidence_boundary'&&r.from.node==='input'&&r.to.node==='opaque.norm'));
  selectEvidencePoint(run,selection,'unknown.scalar.explanation',model.memory,opaqueFallbackConfig);const html=renderEvidenceFallback(composeEvidenceFallback(run,envelope,selection,false,opaqueFallbackConfig),'ready','',false);
  assert.match(html,/does not support the requested evidence/i);assert.match(html,/no registered scalar explanation/i);assert.doesNotMatch(html,/3\s*[×*²^]|4\s*[×*²^]|sqrt|square root/i);
});

test('M2-C saved fixture replay composes without execution and fixture switching clears coordinates',async()=>{
  const grouped=await fixture('grouped'),selection=blank(),live=composeEvidenceFallback(grouped.run,grouped.envelope,selection,false,groupedFallbackConfig);
  selection.coordinates.query_head=3;selectEvidencePoint(grouped.run,selection,'output',live.memory,groupedFallbackConfig);assert.deepEqual(selection.coordinates,{query_head:3,value_feature:0});
  const shape=await fixture('shape'),switched=composeEvidenceFallback(shape.run,shape.envelope,selection,false,shapeFallbackConfig);assert.equal(switched.selected.id,'input');assert.deepEqual(selection.coordinates,{example:0,feature:0});
  const replayStore=new EvidenceStore(integrations()),replayed=await replayStore.admit(parseEvidence(serializeEvidence(grouped.envelope))),saved=composeEvidenceFallback(replayed,replayStore.envelope(replayed.id),blank(),true,groupedFallbackConfig);
  assert.equal(saved.source.relationship,'REPLAY');assert.deepEqual(replayed.points,grouped.run.points);assert.equal(saved.run.request.action,'predict');
});

test('M4-C2 fallback bounds a 2048-point scene and moves the window to an exact retained point',async()=>{
  const grouped=await fixture('grouped'),points=Array.from({length:2048},(_,i)=>({...grouped.run.points[0]!,id:`point.${i}`,node:`point.${i}`,shape:[],axes:[],values:[i],dependencies:i?[`point.${i-1}`]:[]})),run={...grouped.run,id:'fixture:bounded',definition:'fixture-bounded-v1',points} as EvidenceRun,envelope={version:1,codec:run.integration,record:run} as EvidenceEnvelope,selection=blank();
  let model=composeEvidenceFallback(run,envelope,selection,false,{label:'Bounded synthetic evidence'});assert.equal(model.displayed.length,24);assert.equal(model.hiddenCount,2024);assert.equal(model.world.nodes.length,24);assert(model.world.relationships.length<=23);
  assert(selectEvidencePoint(run,selection,'point.2039',model.memory,model.config));model=composeEvidenceFallback(run,envelope,selection,false,model.config);assert.equal(model.selected.id,'point.2039');assert(model.displayed.some(point=>point.id==='point.2039'));assert.equal(model.world.nodes.length,24);
  const html=renderEvidenceFallback(model,'ready','',false);assert.match(html,/showing 2017–2040 of 2048 retained/);assert.match(html,/2024 retained points are outside/);assert.match(html,/point\.2039/);
});

test('M4-C2 generic fallback reads payload-backed evidence through bounded store slices',async()=>{
  const values=Array.from({length:300},(_,index)=>index+0.25),point:EvidencePoint={id:'large',node:'generic.large',port:'output',invocation:'fixture:0',phase:'forward',shape:[300],axes:[{role:'feature',space:'generic:feature',size:300}],dtype:'float64',encoding:'json-numbers-row-major',values,origin:'observed',availability:'available',source:{file:'fixture.ts',symbol:'large',revision:'fixture'},owners:[],dependencies:[],semantics:'Generic payload-backed tensor.',capabilities:['slice','source']};
  const run:EvidenceRun={version:1,id:'generic-payload',integration:'generic-test-v1',definition:'generic-test',checkpoint:'checkpoint',inputTransform:'identity',profile:'generic-test',runtime:'runtime',request:{version:1,integration:'generic-test-v1',profile:'generic-test',requestId:'request',sessionId:'session',epoch:0,action:'predict',input:'fixture'},execution:'native',precision:{storage:'float64',compute:'float64',policy:'exact fixture'},input:{text:'fixture',tokenIds:[1],labels:['fixture'],offsets:[[0,1]]},points:[point],limits:[]};
  const registry=new IntegrationRegistry().register({id:'generic-test-v1',decode:async record=>record as EvidenceRun}),store=new EvidenceStore(registry),retained=await store.admit({version:1,codec:'generic-test-v1',record:run}),selection=blank();
  assert.equal(retained.points[0]!.availability,'available');assert.equal(retained.points[0]!.values,null);assert(retained.points[0]!.payload);
  let model=composeEvidenceFallback(retained,store.metadataEnvelope(retained.id),selection,true,{label:'Generic payload'},store);selection.coordinates.feature=299;model=composeEvidenceFallback(retained,store.metadataEnvelope(retained.id),selection,true,{label:'Generic payload'},store);
  const html=renderEvidenceFallback(model,'ready','',true);assert.match(html,/Selected exact value 299\.25/);assert.match(html,/payload|AVAILABLE/);assert.match(html,/showing 285–300 of 300 retained elements/);assert.doesNotMatch(html,/DETAIL UNSUPPORTED|BUDGET EXCEEDED/);assert.equal((html.match(/<option/g)??[]).length,1,'large axis uses constant-DOM numeric input');
});

test('M4-C2 fallback bounds relationship DOM and preserves precise availability vocabulary',async()=>{
  const grouped=await fixture('grouped'),source={...grouped.run.points[0]!,id:'source',node:'source',shape:[200000],axes:[{role:'output_index',space:'stress:index',size:200000}],values:Array(200000).fill(1),dependencies:[]} as EvidencePoint;
  const states=['not_captured','not_applicable','unsupported','budget_exceeded','shape_only','opaque'] as const;
  const consumers=Array.from({length:80},(_,i)=>({...grouped.run.points[0]!,id:`consumer.${i}`,node:`consumer.${i}`,shape:[],axes:[],values:[i],dependencies:['source']} as EvidencePoint));
  const unavailable=states.map((availability,i)=>({...grouped.run.points[0]!,id:`state.${availability}`,node:`state.${availability}`,shape:[2],axes:[{role:'feature',space:'stress:feature',size:2}],values:null,availability,dependencies:[],semantics:`${availability} fixture`} as EvidencePoint));
  const run={...grouped.run,id:'fixture:relationships',definition:'fixture-stress',points:[source,...consumers,...unavailable]} as EvidenceRun,envelope={version:1,codec:run.integration,record:run} as EvidenceEnvelope,selection=blank();
  let model=composeEvidenceFallback(run,envelope,selection,false,{label:'Relationship stress'});assert(selectEvidencePoint(run,selection,'source',model.memory,model.config));model=composeEvidenceFallback(run,envelope,selection,false,model.config);let html=renderEvidenceFallback(model,'ready','',false);
  assert.match(html,/showing 1–24 of 80 retained/);assert.equal((html.match(/consumer\.\d+ · available/g)??[]).length,24);assert.match(html,/type="number" min="0" max="199999"/);assert.equal((html.match(/<option/g)??[]).length,24,'only bounded operation options exist');
  for(const availability of states){assert(selectEvidencePoint(run,selection,`state.${availability}`,model.memory,model.config));model=composeEvidenceFallback(run,envelope,selection,false,model.config);html=renderEvidenceFallback(model,'ready','',false);assert.match(html,new RegExp(availability.replaceAll('_',' ').toUpperCase()));assert.doesNotMatch(html,/Selected exact value 0/);}
  assert(selectEvidencePoint(run,selection,'state.budget_exceeded',model.memory,model.config));html=renderEvidenceFallback(composeEvidenceFallback(run,envelope,selection,false,model.config),'ready','',false);assert.match(html,/capture budget prevented retention/i);assert.match(html,/zero is not substituted/i);
});
