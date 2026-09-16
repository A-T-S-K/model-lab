import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EvidenceStore} from '../../trace/evidence.js';
import {integrations} from '../../trace/integrations.js';
import {NativeClient} from '../../app/worker/native-client.js';

const path=process.env.NATIVE_GENERATION_RECORDING;

test('cancel/profile switch invalidates a delayed generation response before shared-store admission',{skip:!path},async()=>{
  const template=JSON.parse(await readFile(path!,'utf8')),originalFetch=globalThis.fetch;let release!:()=>void,posted:any;
  globalThis.fetch=async(_input,init)=>{posted=JSON.parse(String(init?.body));await new Promise<void>(resolve=>release=resolve);const value=structuredClone(template);value.record.run.request=posted;value.record.run.id=`${posted.sessionId}:${posted.requestId}`;return new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});};
  try{
    const client=new NativeClient(),store=new EvidenceStore(integrations()),pending=client.execute('The cat sat','generate','http://127.0.0.1:4319/execute',store);await new Promise(resolve=>setTimeout(resolve,0));
    const epoch=posted.epoch;client.cancel();release();await assert.rejects(pending,/Stale native response/);assert.equal(store.list().length,0);assert.equal(client.connected,false);
    assert.equal(posted.action,'generate');assert.equal(posted.generation.maxNewTokens,2);assert.equal(posted.epoch,epoch);
  }finally{globalThis.fetch=originalFetch;}
});
