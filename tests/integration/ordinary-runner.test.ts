import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { allocateOrdinaryOutput } from '../support/ordinary-output.js';
import { runOwnedStages } from '../support/ordinary-runner.js';
const allocate = async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'model-lab-lifecycle-')));
  return { root, output: await allocateOrdinaryOutput(root, 'browser') };
};
const stage = (script: string) => [{ name: 'control', command: process.execPath, args: ['-e', script] }];
const stopped = (pid: number) => assert.throws(() => process.kill(pid, 0), /ESRCH/);

test('log collision refuses execution and retains original destination', async () => {
  const { root, output } = await allocate();
  await writeFile(join(output.directory, 'control.log'), 'original', { flag: 'wx' });
  await assert.rejects(runOwnedStages(root, output, stage(`require('fs').writeFileSync('ran','bad')`), process.env), /EEXIST/);
  await assert.rejects(readFile(join(root, 'ran')), /ENOENT/);
  assert.equal(await readFile(join(output.directory, 'control.log'), 'utf8'), 'original');
});

test('mid-stream log failure stops the actual child before receipt; stubborn child is killed within bound', { skip: process.platform === 'win32' }, async () => {
  for (const stubborn of [false, true]) {
    const { root, output } = await allocate();
    let pid = 0, writes = 0;
    const fault = Error('injected log failure');
    const log = new Writable({ write(bytes, _, done) {
      writes++;
      pid ||= Number(bytes.toString().trim());
      if (writes > 1) done(fault); else done();
    } });
    const before = process.listenerCount('SIGTERM');
    const start = Date.now();
    await assert.rejects(runOwnedStages(root, output, stage(`${stubborn ? "process.on('SIGTERM',()=>{});" : ''}console.log(process.pid);setInterval(()=>console.log('chunk'),20)`), process.env,
      { openLog: () => log, graceMs: 100, killMs: 1000, mirror: false }), error => error === fault);
    assert.ok(pid > 0); stopped(pid); assert.ok(Date.now() - start < 3000);
    const receipt = JSON.parse(await readFile(join(output.directory, 'failure.json'), 'utf8'));
    assert.match(receipt.error, /injected log failure/); assert.deepEqual(receipt.cleanupErrors, []);
    assert.equal(process.listenerCount('SIGTERM'), before);
    assert.equal(log.listenerCount('error'), 0);
    assert.ok(await readFile(join(output.directory, 'allocation.json')));
  }
});

test('spawn failure is retained and no later stage runs', async () => {
  const { root, output } = await allocate();
  await assert.rejects(runOwnedStages(root, output, [{ name: 'missing', command: join(root, 'absent'), args: [] }, ...stage(`require('fs').writeFileSync('ran','bad')`)], process.env), /ENOENT/);
  assert.match(await readFile(join(output.directory, 'failure.json'), 'utf8'), /ENOENT/);
  await assert.rejects(readFile(join(root, 'ran')), /ENOENT/);
});

test('nonzero exit retains tail; successful logs complete under backpressure', async () => {
  const failed = await allocate();
  await assert.rejects(runOwnedStages(failed.root, failed.output, stage("console.log(process.pid);console.error('tail');process.exitCode=7"), process.env, { mirror: false }), /exited 7/);
  const bytes = await readFile(join(failed.output.directory, 'control.log'), 'utf8');
  stopped(Number(bytes.split('\n')[0])); assert.match(bytes, /tail/);
  const success = await allocate(); let total = 0, finalized = false;
  const log = new Writable({ highWaterMark: 16, write(bytes, _, done) { total += bytes.length; setTimeout(done, 1); }, final(done) { finalized = true; done(); } });
  await runOwnedStages(success.root, success.output, stage("process.stdout.write('x'.repeat(1024*1024));process.stderr.write('tail')"), process.env, { openLog: () => log, mirror: false });
  assert.equal(total, 1024 * 1024 + 4); assert.equal(finalized, true); assert.equal(log.listenerCount('error'), 0);
  const disk = await allocate();
  await runOwnedStages(disk.root, disk.output, stage("console.log('complete tail')"), process.env, { mirror: false });
  assert.equal(await readFile(join(disk.output.directory, 'control.log'), 'utf8'), 'complete tail\n');
});

test('SIGINT and SIGTERM wait for stubborn owned child termination before interruption receipt', { skip: process.platform === 'win32' }, async () => {
  const { spawn } = await import('node:child_process');
  const { resolve } = await import('node:path');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    const { root, output } = await allocate();
    const script = join(root, 'interrupt.mjs');
    await writeFile(script, `import {runOwnedStages} from ${JSON.stringify(resolve('tests/support/ordinary-runner.ts'))};import {writeFile} from 'node:fs/promises';const output={directory:${JSON.stringify(output.directory)},write:(p,b)=>writeFile(${JSON.stringify(output.directory)}+'/'+p,b,{flag:'wx'})};try{await runOwnedStages(${JSON.stringify(root)},output,[{name:'control',command:process.execPath,args:['-e',"process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});console.log(process.pid);setInterval(()=>{},1000)"]}],process.env,{graceMs:100,killMs:1000})}catch{process.exitCode=1}`);
    const runner = spawn(process.execPath, ['--import', 'tsx', script], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    let pid = 0;
    runner.stderr.resume();
    const closed = new Promise(resolve => runner.once('close', resolve));
    await new Promise<void>((resolve, reject) => { runner.stdout.on('data', bytes => { pid = Number(bytes.toString().trim()); if (pid) resolve(); }); runner.once('error', reject); });
    runner.kill(signal); await closed; stopped(pid);
    const receipt = JSON.parse(await readFile(join(output.directory, 'interruption.json'), 'utf8'));
    assert.equal(receipt.signal, signal); assert.deepEqual(receipt.cleanupErrors, []);
    assert.match(await readFile(join(output.directory, 'control.log'), 'utf8'), new RegExp(String(pid)));
  }
});

test('failure cleanup kills stubborn descendants in the owned POSIX group', { skip: process.platform === 'win32' }, async () => {
  const { root, output } = await allocate();
  let pids: number[] = [], writes = 0;
  const log = new Writable({ write(bytes, _, done) {
    if (++writes === 1) { pids = JSON.parse(bytes.toString()); done(); } else done(Error('group log failure'));
  } });
  const descendant = "process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000)";
  const parent = `const child=require('child_process').spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:['ignore','pipe','ignore']});child.stdout.once('data',()=>{console.log(JSON.stringify([process.pid,child.pid]));setInterval(()=>console.log('chunk'),20)});`;
  await assert.rejects(runOwnedStages(root, output, stage(parent), process.env, { openLog: () => log, graceMs: 100, killMs: 1000, mirror: false }), /group log failure/);
  assert.equal(pids.length, 2); for (const pid of pids) stopped(pid);
  assert.deepEqual(JSON.parse(await readFile(join(output.directory, 'failure.json'), 'utf8')).cleanupErrors, []);
});

test('slow log disposal reports bounded cleanup failure while preserving original error', async () => {
  const { root, output } = await allocate(); let pid=0,writes=0;
  const log = new Writable({ write(bytes, _, done) { if (++writes===1) { pid=Number(bytes.toString().trim());done(); } else done(Error('primary fault')); }, destroy(error, done) { setTimeout(() => done(error), 500); } });
  await assert.rejects(runOwnedStages(root, output, stage("console.log(process.pid);setInterval(()=>console.log('chunk'),20)"), process.env, { openLog:()=>log, graceMs:50,killMs:50,mirror:false }), /primary fault/);
  stopped(pid); const receipt=JSON.parse(await readFile(join(output.directory,'failure.json'),'utf8'));
  assert.match(receipt.error,/primary fault/);assert.ok(receipt.cleanupErrors.some((value:string)=>value.includes('Log/pump settlement')));
  await new Promise(resolve=>setTimeout(resolve,550));assert.equal(log.listenerCount('error'),0);
});
