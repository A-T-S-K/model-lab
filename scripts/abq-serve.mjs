#!/usr/bin/env node
// Dependency-free prepared-asset server. Node 24+. No source or npm needed.
import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=await realpath(resolve(dirname(fileURLToPath(import.meta.url)),'dist'));
const port=Number(process.env.PORT??4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT must be an integer from 1024 to 65535');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webm':'video/webm'};
const server=createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
  const path=decodeURIComponent((req.url??'/').split('?')[0]);
  if(!path.startsWith('/')||path.includes('\\')||path.includes('\0')||path.split('/').some(s=>s==='..'||s==='.'||s.startsWith('.'))){res.writeHead(403).end('Forbidden');return;}
  const target=await realpath(resolve(root,'.'+(path==='/'?'/index.html':path)));
  if(!target.startsWith(root+sep)||!(await stat(target)).isFile()){res.writeHead(403).end('Forbidden');return;}
  const bytes=await readFile(target);res.writeHead(200,{'Content-Type':types[extname(target)]??'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){res.writeHead(e instanceof URIError?400:404).end('Not found');}
});
server.on('error',e=>{console.error(`Model Lab launcher failed: ${e.code??e.message}. Choose a free loopback PORT; no existing process was stopped.`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Model Lab prepared exhibit: http://127.0.0.1:${port}/?presentation=spatial&kiosk=1`));
