#!/usr/bin/env node
import {cp,mkdir,readFile,writeFile,readdir,chmod,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runtimeIdentity} from './runtime-identity.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const destination=resolve(root,'test-results/abq-overnight/release');
try{await access(destination);throw Error('Release already exists. Preserve qualified artifacts; move the old built kit aside before preparing again.');}catch(e){if(e.code!=='ENOENT')throw e;}
execFileSync('npm',['run','build'],{cwd:root,stdio:'inherit'});
await mkdir(destination,{recursive:true});await cp(resolve(root,'dist'),resolve(destination,'dist'),{recursive:true});
await cp(resolve(root,'scripts/abq-serve.mjs'),resolve(destination,'serve.mjs'));
await mkdir(resolve(destination,'notices'));await cp(resolve(root,'reference/PROVENANCE.md'),resolve(destination,'notices/PROVENANCE.md'));
for(const [name,p] of [['plex-sans','@ibm/plex-sans'],['plex-mono','@ibm/plex-mono']])await cp(resolve(root,`node_modules/${p}/fonts/complete/woff2/license.txt`),resolve(destination,`notices/${name}-license.txt`));
await writeFile(resolve(destination,'START-HERE.txt'),`MODEL LAB · PREPARED LOCAL EXHIBIT\nRequires already-installed Node.js 24+. No npm install or checkout is needed.\nFrom this artifact directory: node serve.mjs\nOpen http://127.0.0.1:4173/?presentation=spatial&kiosk=1\nOptional alternate port: PORT=4175 node serve.mjs\nOpt-in network bind: MODEL_LAB_HOST=0.0.0.0 node serve.mjs, then open this machine's HTTP hostname or IP.\nStop with Ctrl-C. Reload starts a new in-memory visitor session.\nPublic Reset clears visitor history and restores canonical weights. Never treats a candidate as accepted.\nRead notices/ for font licenses and source attribution/limitations.\nThis is prepared offline operation, not offline dependency installation or crash recovery.\n`);
const digest=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const files={};async function visit(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const rel=prefix+e.name,p=resolve(dir,e.name);if(e.isDirectory())await visit(p,rel+'/');else files[rel]=await digest(p);}}
await visit(destination);
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const identity=await runtimeIdentity(root);
const manifest={created:new Date().toISOString(),sourceCommit:git('rev-parse','HEAD'),sourceTree:git('rev-parse','HEAD^{tree}'),sourceStatus:git('status','--short'),runtime:identity.revision,runtimeInputs:identity.sources,node:process.version,npm:execFileSync('npm',['--version'],{encoding:'utf8'}).trim(),platform:process.platform,arch:process.arch,launcherSHA256:files['serve.mjs'],preparerSHA256:await digest(resolve(root,'scripts/prepare-abq.mjs')),files};
await writeFile(resolve(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(resolve(root,'test-results/abq-overnight/artifact-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
async function protect(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,e.name);if(e.isDirectory()){await protect(p);await chmod(p,0o555);}else await chmod(p,0o444);}}
await protect(destination);await chmod(destination,0o555);console.log(`Prepared read-only kit: ${destination}`);
