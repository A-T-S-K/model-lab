import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rename, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allocateTestOutput, withTestOutput } from '../support/test-output.js';

// Synthetic trees only; retained on success/failure, with no recursive cleanup.
async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'model-lab-r1-protection-')));
  const protectedDir = join(root, 'test-results', 'wave2b-review');
  await mkdir(protectedDir, { recursive: true });
  await writeFile(join(protectedDir, 'worker-performance.json'), 'original synthetic evidence\n');
  console.log(`Synthetic protection tree: ${root}`);
  return { root, protectedDir };
}
async function snapshot(directory: string) {
  const names = (await readdir(directory)).sort();
  return { names, bytes: await Promise.all(names.map(name => readFile(join(directory, name), 'utf8'))) };
}

test('output: concurrent defaults are fresh and an existing file is never truncated', async () => {
  const { root } = await fixture();
  const runs = await Promise.all(Array.from({ length: 8 }, () => allocateTestOutput(root)));
  assert.equal(new Set(runs.map(run => run.directory)).size, 8);
  for (const run of runs) await run.write('worker-performance.json', 'first');
  await assert.rejects(runs[0].write('worker-performance.json', 'replacement'), { code: 'EEXIST' });
  for (const run of runs) assert.equal(await readFile(join(run.directory, 'worker-performance.json'), 'utf8'), 'first');
});

test('output: explicit fresh root succeeds; collision refuses without cleanup', async () => {
  const { root } = await fixture();
  const destination = 'test-results/scratch/explicit';
  const output = await allocateTestOutput(root, destination);
  await output.write('worker-performance.json', 'original');
  const before = await snapshot(output.directory);
  await assert.rejects(allocateTestOutput(root, destination), { code: 'EEXIST' });
  assert.deepEqual(await snapshot(output.directory), before);
  const absolute = await allocateTestOutput(root, join(root, 'test-results/scratch/absolute'));
  assert.equal(absolute.directory, join(root, 'test-results/scratch/absolute'));
});

test('output: protected destinations and ancestors refuse before mutation or cleanup', async () => {
  const { root, protectedDir } = await fixture();
  const before = await snapshot(protectedDir);
  const membership = await readdir(join(root, 'test-results'));
  for (const destination of [root, 'test-results', protectedDir,
    'test-results/wave2b-review/child', 'dist', 'fixtures', 'test-results/scratch']) {
    await assert.rejects(allocateTestOutput(root, destination));
  }
  assert.deepEqual(await snapshot(protectedDir), before);
  assert.deepEqual(await readdir(join(root, 'test-results')), membership);
});

test('output: traversal, prefix lookalikes and unsafe filenames refuse', async () => {
  const { root, protectedDir } = await fixture();
  const before = await snapshot(protectedDir);
  for (const destination of ['test-results/scratch/../wave2b-review',
    'test-results/scratch/new/../../wave2b-review', 'test-results/scratch-other/new',
    '../escape', '', 'test-results\\scratch\\alias']) {
    await assert.rejects(allocateTestOutput(root, destination));
  }
  const output = await allocateTestOutput(root);
  for (const name of ['../wave2b-review/worker-performance.json', '/absolute', 'nested/file', '..', 'a\\b']) {
    await assert.rejects(output.write(name, 'bad'));
  }
  assert.deepEqual(await snapshot(protectedDir), before);
});

test('output: symlink destinations, scratch aliases and replaced run directories refuse', async () => {
  const { root, protectedDir } = await fixture();
  const before = await snapshot(protectedDir);
  const output = await allocateTestOutput(root);
  await symlink(protectedDir, join(root, 'test-results/scratch/alias'));
  await assert.rejects(allocateTestOutput(root, 'test-results/scratch/alias'));
  await symlink(join(protectedDir, 'worker-performance.json'), join(output.directory, 'worker-performance.json'));
  await assert.rejects(output.write('worker-performance.json', 'bad'));
  await rename(output.directory, output.directory + '-retained');
  await symlink(protectedDir, output.directory);
  await assert.rejects(output.write('new.json', 'bad'));
  const other = await fixture();
  await symlink(protectedDir, join(other.root, 'test-results/scratch'));
  await assert.rejects(allocateTestOutput(other.root));
  const third = await realpath(await mkdtemp(join(tmpdir(), 'model-lab-r1-protection-')));
  await symlink(protectedDir, join(third, 'test-results'));
  await assert.rejects(allocateTestOutput(third));
  assert.deepEqual(await snapshot(protectedDir), before);
});

test('output: injected failure retains partial output and failure receipt; next run is independent', async () => {
  const { root, protectedDir } = await fixture();
  const before = await snapshot(protectedDir);
  let failedDirectory = '';
  await assert.rejects(withTestOutput(root, undefined, async output => {
    failedDirectory = output.directory;
    await output.write('partial.json', 'partial');
    throw new Error('injected after allocation');
  }), /injected after allocation/);
  const failed = await snapshot(failedDirectory);
  assert.equal(JSON.parse(await readFile(join(failedDirectory, 'failure.json'), 'utf8')).status, 'failed');
  await withTestOutput(root, undefined, async output => {
    assert.notEqual(output.directory, failedDirectory);
    await output.write('worker-performance.json', 'next');
  });
  assert.deepEqual(await snapshot(failedDirectory), failed);
  assert.deepEqual(await snapshot(protectedDir), before);
});
