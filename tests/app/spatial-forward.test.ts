import {test} from 'node:test';
import assert from 'node:assert/strict';
import {affineMixture,probabilitySimplex,probabilityColor,tetrahedron} from '../../app/spatial/geometry.js';
import {forwardReadModel,operations,dependencies,addressId} from '../../app/spatial/forward.js';
import {ModelSession} from '../../app/worker/controller.js';
const close=(a:number,b:number)=>assert(Math.abs(a-b)<=1e-30+1e-12*Math.abs(b),`${a} != ${b}`);
test('B07 affine ranks 0–4 preserve every contributor, exact distances at low rank and fixed projection at high rank',()=>{
  for(let rank=0;rank<=4;rank++){
    const points=[[2,3,4,5],...Array.from({length:rank},(_,i)=>[2,3,4,5].map((x,j)=>x+Number(i===j)))];
    const weights=points.map(()=>1/points.length),g=affineMixture(points,weights);
    assert.equal(g.rank,rank);assert.equal(g.exact,rank<=3);assert.equal(g.coordinates.length,points.length);
    g.mixture.forEach((x,i)=>close(x,points.reduce((s,p,j)=>s+p[i]*weights[j],0)));
    if(g.exact)for(let i=0;i<points.length;i++)for(let j=0;j<points.length;j++)close(Math.hypot(...g.coordinates[i].map((x,k)=>x-g.coordinates[j][k])),Math.hypot(...points[i].map((x,k)=>x-points[j][k])));
    if(!g.exact)assert.deepEqual(g.coordinates,points.map(p=>p.slice(0,3).map((x,i)=>x-points[0][i])));
  }
  const collinear=affineMixture([[0,0,0,0],[2,4,6,8],[3,6,9,12]],[.2,.3,.5]);assert.equal(collinear.rank,1);
  assert.throws(()=>affineMixture([[1],[2]],[.2,.2]));
});
test('B08–B09 simplex barycenters and continuous probability domains distinguish zero and unavailable',()=>{
  assert.deepEqual(probabilitySimplex([1,0,0,0]).point,tetrahedron[0]);
  assert.deepEqual(probabilitySimplex([.25,.25,.25,.25]).point,[0,0,0]);
  assert.notDeepEqual(probabilitySimplex([.1,.2,.3,.4]).point,probabilitySimplex([.4,.3,.2,.1]).point);
  assert.equal(probabilityColor(0),'rgb(0,34,78)');assert.equal(probabilityColor(1),'rgb(254,232,56)');
  assert.notEqual(probabilityColor(0),probabilityColor(undefined));assert.equal(probabilityColor(-1),'#667078');assert.equal(probabilityColor(2),'#667078');
  assert.throws(()=>probabilitySimplex([.5,.5,0]));
});
test('B01–B05 all forward families, source rows, complete stable softmax, earlier-position edges and missing captures',async()=>{
  const session=new ModelSession(),tag={sessionId:'forward-b',generationId:0};
  await session.handle({...tag,runId:'init',command:'initialize'});
  for(const document of ['abca','abcb','abcabca','']){
    const response=await session.handle({...tag,runId:document||'empty',command:'predict',document});assert.equal(response.status,'result');if(response.status!=='result')return;
    const r=response.result,f=forwardReadModel(r.run,r.snapshots[0]);
    for(const address of f.addresses){const e=f.explain(address,0);assert(e.output?.length);assert(e.artifact?.id);assert(e.indexValid);
      if(e.terms)close(e.terms.reduce((s,t)=>s+t.product,0),e.observed!);
      if(e.exponentials) e.exponentials.forEach((x,i)=>close(x/e.denominator!,e.output![i]));
      if(e.meanSquare!==undefined)close(e.inputs![0]*e.normScale!,e.observed!);
      if(e.pairs)close(e.pairs[0]!+e.pairs[1]!,e.observed!);
      if(e.before!==undefined)assert.equal(e.observed,Math.max(0,e.before));
      if(e.mixture)e.mixture.mixture.forEach((x,i)=>close(x,e.output![i]));
      for(const d of e.upstream){assert(f.downstream(d.address).some(c=>addressId(c.address)===addressId(address)));}
    }
    assert.equal(f.values({kind:'mlpRelu',token:0})!.length,32);
    assert.equal(f.explain({kind:'q',token:0},32).indexValid,false);
    assert.equal(forwardReadModel(r.run,undefined).explain({kind:'q',token:0},0).terms,undefined);
    assert.equal(f.values({kind:'q',token:8}),undefined);
    for(const op of operations)assert(f.addresses.some(a=>a.kind===op.kind));
  }
  assert(dependencies({kind:'attentionLogits',token:3,head:1},5,2).some(d=>d.address.kind==='k'&&d.address.token===0));
  assert.equal(dependencies({kind:'headOutput',token:7,head:0},8,2).filter(d=>d.address.kind==='v').length,8);
});
