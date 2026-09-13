import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {request} from 'node:http';
const get=(port,path)=>new Promise((resolve,reject)=>{const r=request({hostname:'127.0.0.1',port,path},s=>{s.resume();s.on('end',()=>resolve({status:s.statusCode,type:s.headers['content-type']}));});r.on('error',reject);r.end();});
test('prepared launcher serves local assets, rejects traversal/methods and fails on occupied port',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'abq-launcher-'));await mkdir(join(dir,'dist'));await writeFile(join(dir,'dist/index.html'),'<h1>launcher fixture</h1>');await writeFile(join(dir,'dist/worker.js'),'postMessage(1)');await copyFile('scripts/abq-serve.mjs',join(dir,'serve.mjs'));
 const port=14373;let child,other;
 try{
  child=spawn(process.execPath,[join(dir,'serve.mjs')],{env:{...process.env,PORT:String(port)}});let log='';await new Promise((res,rej)=>{child.stdout.on('data',d=>{log+=d;if(log.includes('prepared exhibit'))res();});child.on('exit',c=>rej(Error(`Launcher exited ${c}`)));});
  assert.equal((await get(port,'/')).status,200);assert.match((await get(port,'/worker.js')).type,/javascript/);for(const p of ['/../serve.mjs','/%2e%2e/serve.mjs','/%2e/worker.js','/%5c../serve.mjs'])assert.equal((await get(port,p)).status,403,p);
  other=spawn(process.execPath,[join(dir,'serve.mjs')],{env:{...process.env,PORT:String(port)}});let errors='';other.stderr.on('data',d=>errors+=d);const exit=await new Promise(res=>other.on('exit',res));assert.equal(exit,1);assert.match(errors,/EADDRINUSE/);assert.equal((await get(port,'/')).status,200);
 }finally{child?.kill();other?.kill();await rm(dir,{recursive:true,force:true});}
});
