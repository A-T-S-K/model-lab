import {test} from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../fixtures/canonical.initial.json';
import {ForwardDriver} from '../../app/worker/forward-driver.js';
import {ModelSession} from '../../app/worker/controller.js';
import {snapshotTraining} from '../../model/state.js';
import type {RunResult} from '../../app/worker/protocol.js';
const tick=()=>new Promise(r=>setTimeout(r,2));
async function wait(check:()=>boolean){for(let i=0;i<15000&&!check();i++)await tick();assert(check());}
async function setup(){
 const s=new ModelSession(),tag={sessionId:'prospective',generationId:0};let n=0,max=0,pending=0;const commands:any[]=[];let accepted:RunResult|undefined;
 await s.handle({...tag,runId:'init',command:'initialize'});
 const d=new ForwardDriver({request:async(c:any)=>{commands.push(c);pending++;max=Math.max(max,pending);try{return await s.handle({...tag,runId:String(++n),...c});}finally{pending--;}}},()=>{},async r=>{accepted=r;},e=>{throw e;},0);
 return {s,d,commands,tag,get accepted(){return accepted;},get max(){return max;}};
}
for(const document of ['abca','a','abcabca'])test('S01/S02 prospective actual execution equals fast path '+document,async()=>{
 const h=await setup(),fast=new ModelSession();await fast.handle({...h.tag,runId:'init',command:'initialize'});
 for(let pass=0;pass<2;pass++){
  const reference=await fast.handle({...h.tag,runId:'fast'+pass,command:'train',document});assert.equal(reference.status,'result');
  h.d.pin=pass?fixture.parameters.wte.flat().length+fixture.parameters.wpe.flat().length:0;
  await h.d.start(document,true);const initial=h.d.progress!.start!.snapshot,execution=h.d.progress!.executionId;
  h.d.runToContribution();await wait(()=>h.d.phase==='paused');
  let t=h.d.progress!.training!;assert.equal(t.phase,'backward');assert(t.stopped);assert(!t.final);assert(t.contributions.length);assert.equal(t.proposal,undefined);
  const event=t.contributions.at(-1)!;assert.equal(event.after,event.before+event.contribution);assert.equal(t.gradient,event.after);assert.equal(h.d.progress!.executionId,execution);
  assert.deepEqual(snapshotTraining((h.s as any).model,(h.s as any).optimizer),initial.state);
  const sequence=h.d.progress!.sequence;await new Promise(r=>setTimeout(r,30));assert.equal(h.d.progress!.sequence,sequence);
  h.d.runToContribution();await wait(()=>h.d.phase==='paused');t=h.d.progress!.training!;assert(t.final||t.contributions.at(-1)!.ordinal>event.ordinal);
  h.d.continue();await wait(()=>h.d.progress?.training?.phase==='ready');assert.equal(h.commands.filter(c=>c.command==='acceptTraining').length,pass);
  assert.deepEqual(snapshotTraining((h.s as any).model,(h.s as any).optimizer),initial.state);
  await h.d.acceptUpdate();if(reference.status==='result'){assert.deepEqual(h.accepted!.learn,reference.result.learn);assert.deepEqual(h.accepted!.snapshots,reference.result.snapshots);}
 }
 assert.equal(h.max,1);assert(!h.commands.some(c=>['train','predict'].includes(c.command)));
 await h.d.start(document,true);h.d.runToContribution();await wait(()=>h.d.phase==='paused');const before=snapshotTraining((h.s as any).model,(h.s as any).optimizer);await h.d.cancel();assert.deepEqual(snapshotTraining((h.s as any).model,(h.s as any).optimizer),before);
});
test('S03 unused embedding stops before first optimizer proposal; subsequent action cannot restart',async()=>{
 const h=await setup();h.d.pin=8;await h.d.start('a',true);h.d.runToContribution();await wait(()=>h.d.phase==='paused');
 const t=h.d.progress!.training!;assert.equal(t.phase,'optimizer proposal');assert.equal(t.count,0);assert.equal(t.gradient,0);assert(t.final&&t.stopped);assert.deepEqual(t.contributions,[]);assert.equal(t.proposal,undefined);
 const sequence=h.d.progress!.sequence;h.d.runToContribution();await new Promise(r=>setTimeout(r,20));assert.equal(h.d.progress!.sequence,sequence);await h.d.cancel();
});
for(const action of ['pause','explore','pin','next','continue','cancel','discard'] as const)test('S04 delayed permit superseded by '+action,async()=>{
 const h=await setup();await h.d.start('a',true);
 const client=(h.d as any).client,request=client.request;let release!:()=>void;let admitted=false;
 client.request=async(c:any)=>{const r=await request(c);if(c.command==='advanceTraining'&&!admitted){admitted=true;await new Promise<void>(resolve=>release=resolve);}return r;};
 h.d.runToContribution();await wait(()=>admitted);assert(h.d.pending);
 if(action==='pin')h.d.pin=1;else if(action==='next')void h.d.next();else if(action==='cancel')await h.d.cancel();else h.d[action]();
 assert(!h.d.runningToGradient);release();await new Promise(r=>setTimeout(r,30));
 if(action==='continue'){await wait(()=>h.d.progress?.training?.phase==='ready');}else assert.equal(h.commands.filter(c=>c.command==='advanceTraining').length,1);assert.notEqual(h.d.phase,'running');assert.equal(h.max,1);await h.d.cancel();
});
test('S03 exhausting an observed pin stops before proposals without rewinding',async()=>{
 const h=await setup();await h.d.start('a',true);h.d.runToContribution();await wait(()=>h.d.phase==='paused');
 const first=h.d.progress!.training!.contributions.at(-1)!;assert(first);
 let last=first.ordinal;
 for(let boundary=0;!h.d.progress!.training!.final;boundary++){
  assert(boundary<20);h.d.runToContribution();await wait(()=>h.d.phase==='paused');const t=h.d.progress!.training!;
  if(!t.final){assert(t.contributions.at(-1)!.ordinal>last);last=t.contributions.at(-1)!.ordinal;}
 }
 const t=h.d.progress!.training!;assert.equal(t.phase,'optimizer proposal');assert.equal(t.count,0);assert.equal(t.proposal,undefined);assert.equal(t.contributions.at(-1)!.ordinal,last);await h.d.cancel();
});
