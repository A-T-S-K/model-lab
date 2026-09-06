import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

test('beginner example executes with only model, fixture, and example sources', async () => {
  const isolated = await mkdtemp(join(tmpdir(), 'model-lab-math-only-'));
  try {
    // Infrastructure sources are deliberately absent, so a runtime dependency would fail.
    for (const folder of ['model', 'fixtures', 'examples']) {
      await cp(fileURLToPath(new URL(`../../${folder}`, import.meta.url)), join(isolated, folder), { recursive: true });
    }
    await writeFile(join(isolated, 'package.json'), '{"type":"module"}\n');
    const output = execFileSync(process.execPath, ['--import', import.meta.resolve('tsx'), 'examples/predict-teach.ts'], { cwd: isolated, encoding: 'utf8' });
    const before = Number(output.match(/Probability before: (\S+)/)?.[1]);
    const after = Number(output.match(/Probability after one real update: (\S+)/)?.[1]);
    assert.ok(Math.abs(before - 0.3591443770854818) < 1e-9);
    assert.ok(Math.abs(after - 0.4070454916035887) < 1e-9);
    assert.match(output, /Parameters updated: 896/);
    assert.match(output, /Completed training steps: 1/);
  } finally { await rm(isolated, { recursive: true, force: true }); }
});
