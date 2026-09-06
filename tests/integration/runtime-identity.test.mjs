import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile, mkdir, readdir, symlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeIdentity, generateRuntimeIdentity, generatedPath } from '../../scripts/runtime-identity.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('runtime identity is deterministic, covers runtime sources, and reproduces in a Git-free subtree', async () => {
  const original = await runtimeIdentity(root);
  assert.match(original.revision, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(await runtimeIdentity(root), original);
  for (const path of ['model/microgpt.ts', 'model/value.ts', 'inspect/capture.ts', 'trace/types.ts',
    'archive/snapshot.ts', 'archive/experiment.ts', 'app/worker/inspector.ts', 'app/worker/worker.ts',
    'app/worker/inspector-worker.ts', 'experiments/common.ts', 'app/source/catalog.ts']) {
    assert.ok(original.sources.includes(path), `identity includes ${path}`);
  }
  assert.ok(!original.sources.includes(generatedPath), 'generated identity cannot hash itself');
  const isolated = await mkdtemp(join(tmpdir(), 'model-lab-runtime-'));
  try {
    for (const path of original.sources) {
      await mkdir(dirname(join(isolated, path)), { recursive: true });
      await cp(join(root, path), join(isolated, path));
    }
    assert.deepEqual(await generateRuntimeIdentity(isolated), original);
    assert.match(await readFile(join(isolated, generatedPath), 'utf8'), new RegExp(original.revision));
    for (const path of ['model/microgpt.ts', 'inspect/capture.ts', 'archive/session.ts', 'app/worker/inspector.ts']) {
      const baseline = await readFile(join(isolated, path));
      await writeFile(join(isolated, path), Buffer.concat([baseline, Buffer.from('\n// relevant source change\n')]));
      assert.notEqual((await runtimeIdentity(isolated)).revision, original.revision, path);
      await writeFile(join(isolated, path), baseline);
    }
    await writeFile(join(isolated, 'inspect/new-evidence.ts'), 'export const evidence = true;\n');
    assert.notEqual((await runtimeIdentity(isolated)).revision, original.revision, 'new production files are automatically covered');
  } finally { await rm(isolated, { recursive: true, force: true }); }
});

test('dev builds a Git-free source copy and serves unchanged runtime assets after source edits', { timeout: 60000 }, async () => {
  const isolated = await mkdtemp(join(tmpdir(), 'model-lab-dev-identity-'));
  let child;
  let exited;
  try {
    for (const path of (await runtimeIdentity(root)).sources) {
      await mkdir(dirname(join(isolated, path)), { recursive: true });
      await cp(join(root, path), join(isolated, path));
    }
    // Reuse installed tools, not a pre-existing build or generated revision.
    await symlink(join(root, 'node_modules'), join(isolated, 'node_modules'), 'dir');
    const reservation = createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    child = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--strictPort'], {
      cwd: isolated, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    exited = once(child, 'exit');
    let output = '';
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(`Dev server did not start: ${output}`)), 45000);
      const stop = () => clearTimeout(deadline);
      const read = bytes => {
        output += bytes.toString();
        if (output.includes(`http://127.0.0.1:${port}/`)) { stop(); resolve(); }
      };
      child.stdout.on('data', read); child.stderr.on('data', read);
      child.once('error', error => { stop(); reject(error); });
      child.once('exit', code => { stop(); reject(new Error(`Dev exited ${code}: ${output}`)); });
    });
    const revision = (await runtimeIdentity(isolated)).revision;
    const origin = `http://127.0.0.1:${port}`;
    const html = await (await fetch(origin)).text();
    assert.doesNotMatch(html, /@vite\/client/, 'no HMR can load changed code under an old revision');
    const assets = (await readdir(join(isolated, 'dist/assets'))).filter(path => path.endsWith('.js'));
    assert.ok(assets.length >= 3, 'app and both execution workers were built from the copy');
    const before = await Promise.all(assets.map(async path => (await fetch(`${origin}/assets/${path}`)).text()));
    assert.ok(before.filter(source => source.includes(revision)).length >= 2,
      'live worker and historical inspector embed the same revision');
    const sourcePath = join(isolated, 'model/value.ts');
    await writeFile(sourcePath, (await readFile(sourcePath, 'utf8')) +
      '\nthrow new Error("This source edit must wait for a server restart");\n');
    assert.notEqual((await runtimeIdentity(isolated)).revision, revision);
    const after = await Promise.all(assets.map(async path => (await fetch(`${origin}/assets/${path}`)).text()));
    assert.deepEqual(after, before, 'source editing cannot change any served execution or inspection asset');
    assert.equal(await (await fetch(origin)).text(), html);
  } finally {
    if (child?.pid) {
      // npm owns a shell and preview process; stop the entire test process group.
      try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      await exited;
    }
    await rm(isolated, { recursive: true, force: true });
  }
});
