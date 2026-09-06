import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
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
