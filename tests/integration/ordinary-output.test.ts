import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, writeFile, readFile, mkdir, symlink, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { allocateOrdinaryOutput, ordinaryContext, refuseOrdinaryOverrides } from '../support/ordinary-output.js';
import { browserEvidenceDirectory } from '../support/slice-output.js';
import { runOwnedStages } from '../support/ordinary-runner.js';
const temporary = () => mkdtemp(join(tmpdir(), 'model-lab-ordinary-')).then(path => realpath(path));
const inherited = (o: Awaited<ReturnType<typeof allocateOrdinaryOutput>>) => ({ MODEL_LAB_ORDINARY_OUTPUT: o.directory, MODEL_LAB_ORDINARY_TOKEN: o.token });

test('fresh ordinary roots preserve previous bytes; explicit collision, traversal and aliases refuse', async () => {
  const root = await temporary();
  const first = await allocateOrdinaryOutput(root, 'browser', 'test-results/scratch/first');
  await first.write('sentinel', 'keep');
  const next = await allocateOrdinaryOutput(root, 'browser');
  assert.notEqual(first.directory, next.directory);
  for (const destination of ['test-results/scratch/first', 'test-results/scratch/../old', 'test-results/old', 'dist', 'test-results/scratch/child/nested']) await assert.rejects(allocateOrdinaryOutput(root, 'browser', destination));
  await mkdir(join(root, 'protected')); await writeFile(join(root, 'protected/sentinel'), 'keep');
  await symlink(join(root, 'protected'), join(root, 'test-results/scratch/alias'));
  await assert.rejects(allocateOrdinaryOutput(root, 'http', 'test-results/scratch/alias'));
  const other = await temporary(); await mkdir(join(other, 'test-results'));
  await symlink(join(root, 'protected'), join(other, 'test-results/scratch'));
  await assert.rejects(allocateOrdinaryOutput(other, 'http'));
  assert.equal(await readFile(join(first.directory, 'sentinel'), 'utf8'), 'keep');
  assert.equal(await readFile(join(root, 'protected/sentinel'), 'utf8'), 'keep');
});

test('output, config, reporters, snapshot and environment bypasses refuse before allocation', () => {
  for (const arg of ['--output=x', '--reporter=json', '--add-reporter=html', '-u', '--config=x', '-cother.ts', '--last-failed-file=x', '--update-snapshots', '--ui', '--test-list=x']) assert.throws(() => refuseOrdinaryOverrides([arg], {}));
  for (const key of ['PLAYWRIGHT_LAST_RUN_OUTPUT_FILE','PLAYWRIGHT_JSON_OUTPUT_DIR','PLAYWRIGHT_HTML_REPORT','PW_TEST_REPORTER','PWTEST_CACHE_DIR','PW_TEST_SOURCE_TRANSFORM','ABQ_EVIDENCE_DIR','FIXES_EVIDENCE_DIR','WAVE2B_EVIDENCE_DIR','SLICE_EVIDENCE_DIR','MODEL_LAB_ORDINARY_TOKEN','MODEL_LAB_QUALIFICATION_ROOT','M2B_HANDOFF_DIR']) assert.throws(() => refuseOrdinaryOverrides([], {[key]:'x'}));
  refuseOrdinaryOverrides(['--workers=2', '--retries=1'], { BROWSER_EVIDENCE_DIR: 'test-results/scratch/new' });
  refuseOrdinaryOverrides([], { SLICE_PHASE: 'offline', M2B_HANDOFF_DIR: 'read-only-old-input' });
});

test('config and worker inheritance reuse exactly one active allocation; wrong/stale ownership refuses', async () => {
  const root = await temporary(), output = await allocateOrdinaryOutput(root, 'http');
  const env = inherited(output);
  assert.deepEqual(await ordinaryContext(root, 'http', env), await ordinaryContext(root, 'http', {...env, TEST_WORKER_INDEX:'2'}));
  assert.equal((await readdir(join(root,'test-results/scratch'))).length,1);
  await assert.rejects(ordinaryContext(root,'browser',env),/mismatch/);
  await assert.rejects(ordinaryContext(root,'http',{...env,MODEL_LAB_ORDINARY_TOKEN:'old'}),/mismatch/);
  const expired=await allocateOrdinaryOutput(root,'http');
  const marker=join(expired.directory,'invocation.json');
  const receipt=JSON.parse(await readFile(marker,'utf8'));receipt.pid=2147483647;
  await writeFile(marker,JSON.stringify(receipt));
  await assert.rejects(ordinaryContext(root,'http',inherited(expired)),/no longer active/);
  await output.write('completion.json','{}');
  await assert.rejects(ordinaryContext(root,'http',env),/finished/);
});

test('concurrent/retried evidence is unique; synthetic runner cleanup preserves evidence and handoff input', async () => {
  const root=await temporary(), output=await allocateOrdinaryOutput(root,'browser');
  const dirs=await Promise.all(Array.from({length:12},()=>browserEvidenceDirectory(root,output.directory)));
  assert.equal(new Set(dirs).size,12);
  await Promise.all(dirs.map((dir,i)=>writeFile(join(dir,'same.json'),String(i),{flag:'wx'})));
  await writeFile(join(output.directory,'handoff/replay.json'),'original',{flag:'wx'});
  await rm(join(output.directory,'runner'),{recursive:true});
  for (const [i,dir] of dirs.entries()) assert.equal(await readFile(join(dir,'same.json'),'utf8'),String(i));
  assert.equal(await readFile(join(output.directory,'handoff/replay.json'),'utf8'),'original');
});

test('actual stage failure retains partial bytes, allocation and failure log', async () => {
  const root=await temporary(), output=await allocateOrdinaryOutput(root,'browser');
  await assert.rejects(runOwnedStages(root,output,[{command:process.execPath,args:['-e',"console.error('partial failure');process.exit(7)"],name:'failure-test'}],process.env));
  assert.match(await readFile(join(output.directory,'failure-test.log'),'utf8'),/partial failure/);
  assert.match(await readFile(join(output.directory,'failure.json'),'utf8'),/exited 7/);
  assert.ok(await readFile(join(output.directory,'allocation.json'),'utf8'));
});

test('actual interruption forwards signal and retains partial evidence and receipt', async () => {
  const root=await temporary();
  const helper=resolve('tests/support/ordinary-runner.ts'), allocator=resolve('tests/support/ordinary-output.ts');
  const script=join(root,'interrupt.mjs');
  await writeFile(script, `import {allocateOrdinaryOutput} from ${JSON.stringify(allocator)};\nimport {runOwnedStages} from ${JSON.stringify(helper)};\nconst o=await allocateOrdinaryOutput(${JSON.stringify(root)},'browser');console.log(o.directory);try{await runOwnedStages(${JSON.stringify(root)},o,[{command:process.execPath,args:['-e',"console.log('ready');setInterval(()=>{},1000)"],name:'wait'}],process.env)}catch{process.exitCode=1}`);
  const child=spawn(process.execPath,['--import','tsx',script],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
  let log=''; const closed=new Promise(resolve=>child.once('close',resolve));
  await new Promise<void>((resolve,reject)=>{child.stdout.on('data',b=>{log+=b;if(log.includes('ready'))resolve()});child.once('error',reject);child.once('exit',()=>reject(Error('early exit '+log)));});
  child.kill('SIGTERM'); await closed;
  const directory=log.split('\n')[0];
  assert.match(await readFile(join(directory,'interruption.json'),'utf8'),/SIGTERM/);
  assert.match(await readFile(join(directory,'wait.log'),'utf8'),/ready/);
  assert.ok(await readFile(join(directory,'allocation.json'),'utf8'));
});

test('real Playwright workers and retry inherit one config allocation and retain every custom attempt', async () => {
  const root=await temporary(), output=await allocateOrdinaryOutput(root,'browser');
  await writeFile(join(root,'package.json'),JSON.stringify({type:'module'}));
  const config=join(root,'playwright.config.ts'), spec=join(root,'workers.spec.ts');
  const api=resolve('node_modules/@playwright/test/index.mjs');
  const helper=resolve('tests/support/ordinary-output.ts'), evidence=resolve('tests/support/slice-output.ts');
  await writeFile(config,`import {defineConfig} from ${JSON.stringify(api)};import {ordinaryContext} from ${JSON.stringify(helper)};const o=await ordinaryContext(${JSON.stringify(root)},'browser');export default defineConfig({testDir:${JSON.stringify(root)},testMatch:'workers.spec.ts',workers:2,fullyParallel:true,retries:1,outputDir:o.runner,reporter:[['json',{outputFile:o.report+'/results.json'}]]});`);
  await writeFile(spec,`import {test,expect} from ${JSON.stringify(api)};import {ordinaryContext} from ${JSON.stringify(helper)};import {browserEvidenceDirectory} from ${JSON.stringify(evidence)};import {writeFile} from 'node:fs/promises';for(const name of ['steady','retry'])test(name,async({},info)=>{const o=await ordinaryContext(${JSON.stringify(root)},'browser');const dir=await browserEvidenceDirectory(${JSON.stringify(root)},o.directory);await writeFile(dir+'/attempt.json',JSON.stringify({name,retry:info.retry,worker:info.workerIndex}),{flag:'wx'});expect(name==='retry'?info.retry:1).toBe(1)});`);
  await runOwnedStages(process.cwd(),output,[{command:process.execPath,args:['--import','tsx',resolve('node_modules/@playwright/test/cli.js'),'test','--config',config],name:'workers'}],{...process.env,...inherited(output)});
  const dirs=await readdir(join(output.directory,'evidence'));
  const attempts=await Promise.all(dirs.map(async dir=>JSON.parse(await readFile(join(output.directory,'evidence',dir,'attempt.json'),'utf8'))));
  assert.equal(attempts.length,3);assert.deepEqual(attempts.filter(a=>a.name==='retry').map(a=>a.retry).sort(),[0,1]);
  assert.equal((await readdir(join(root,'test-results/scratch'))).length,1);
  assert.equal(JSON.parse(await readFile(join(output.directory,'report/results.json'),'utf8')).stats.flaky,1);
});

test('supported npm wrapper rejects CLI and environment overrides before hooks or any output allocation', async () => {
  const root=await temporary(), sentinel=join(root,'sentinel');await writeFile(sentinel,'keep');
  for (const [args, overrides] of [
    [['--output',root], {}],
    [['--add-reporter=html'], {}],
    [[], {PLAYWRIGHT_LAST_RUN_OUTPUT_FILE:sentinel}],
    [[], {MODEL_LAB_ORDINARY_OUTPUT:root}],
  ] as [string[],NodeJS.ProcessEnv][]) {
    const child=spawn(process.execPath,[resolve('scripts/run-browser.mjs'),'http',...args],{cwd:process.cwd(),env:{...process.env,...overrides},stdio:['ignore','pipe','pipe']});
    let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
    const code=await new Promise(resolve=>child.once('close',resolve));
    assert.notEqual(code,0);assert.match(log,/override.*refused|overrides refused/);assert.doesNotMatch(log,/Owned .* output/);
    assert.deepEqual(await readdir(root),['sentinel']);assert.equal(await readFile(sentinel,'utf8'),'keep');
  }
});
