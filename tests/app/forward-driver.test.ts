import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ForwardDriver} from '../../app/worker/forward-driver.js';
import {ModelSession} from '../../app/worker/controller.js';
import type {WorkerResponse} from '../../app/worker/protocol.js';

test('E02/E07 driver holds one permit, renders Pausing until ack, no hidden-time catch-up, accepts completion before cancel',async()=>{
 const s=new ModelSession(),tag={sessionId:'driver',generationId:0};let n=0;await s.handle({...tag,runId:'init',command:'initialize'});
 const commands:any[]=[];let release:(()=>void)|undefined;let delay=false;let completed=0;
 const client={request:async(command:any):Promise<WorkerResponse>=>{commands.push(command);const result=await s.handle({...tag,runId:`r${++n}`,...command});if(delay&&command.command==='advanceForward')await new Promise<void>(r=>{release=r;});return result;}};
 const d=new ForwardDriver(client,()=>{},async()=>{completed++;},e=>{throw e;},5);
 await d.start('');assert.equal(d.phase,'paused');assert.equal(d.progress?.sequence,0);
 await new Promise(r=>setTimeout(r,30));assert.equal(commands.filter(c=>c.command==='advanceForward').length,0);
 delay=true;d.continue();await new Promise(r=>setTimeout(r,12));assert(d.pending);d.pause();assert.equal(d.phase,'pausing');
 void d.next();assert.equal(commands.filter(c=>c.command==='advanceForward').length,1);
 release!();await new Promise(r=>setTimeout(r,20));assert.equal(d.phase,'paused');assert.equal(d.progress?.sequence,1);
 await new Promise(r=>setTimeout(r,20));assert.equal(d.progress?.sequence,1);
 delay=false;d.continue();d.explore();assert.equal(d.follow,false);assert.equal(d.phase,'paused');
 await d.cancel();assert.equal(d.active,false);assert.equal(d.preview,undefined);
 await d.start('');while(d.progress && d.progress.sequence<d.progress.total-1)await d.next();
 delay=true;const next=d.next();await new Promise(r=>setTimeout(r,1));const cancel=d.cancel();release!();await next;await cancel;
 assert.equal(completed,1);assert.equal(d.active,false);
});

test('E07 reset invalidation ignores a late acknowledgement; failures release the partial cursor',async()=>{
 let reply:(r:WorkerResponse)=>void=()=>{};const commands:any[]=[];
 const client={request:(c:any):Promise<WorkerResponse>=>{commands.push(c);return new Promise(r=>reply=r);}};
 const d=new ForwardDriver(client,()=>{},async()=>assert.fail(),()=>{});
 const start=d.start('');d.discard();reply({sessionId:'s',runId:'r',generationId:0,status:'error',error:'late'});await start;
 assert.equal(d.active,false);assert.equal(d.preview,undefined);
 const s=new ModelSession();const tag={sessionId:'failure',generationId:0};await s.handle({...tag,runId:'init',command:'initialize'});let id=0,failed=0;
 const failing={request:async(c:any)=>{if(c.command==='advanceForward')throw Error('worker failure');return s.handle({...tag,runId:String(++id),...c});}};
 const f=new ForwardDriver(failing,()=>{},async()=>{},()=>failed++);await f.start('a');await f.next();await new Promise(r=>setTimeout(r,10));
 assert.equal(failed,1);assert.equal(f.preview,undefined);assert.equal((await s.handle({...tag,runId:'normal',command:'predict',document:'a'})).status,'result');
});
