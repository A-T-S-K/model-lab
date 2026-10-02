process.env.TSX_DISABLE_CACHE = '1';
const { register } = await import('tsx/esm/api');
register();
const { runOwnedStages } = await import('../tests/support/ordinary-runner.ts');
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const { allocateOrdinaryOutput, refuseOrdinaryOverrides } = await import('../tests/support/ordinary-output.ts');
import { runtimeIdentity } from './runtime-identity.mjs';
const { readGitCandidateState } = await import('../tests/support/qualification-evidence.ts');

const root = fileURLToPath(new URL('../', import.meta.url));
const [profile, ...args] = process.argv.slice(2);
refuseOrdinaryOverrides(args, process.env);
const output = await allocateOrdinaryOutput(root, profile, process.env.BROWSER_EVIDENCE_DIR);
console.log(`Owned ${profile} output: ${output.directory}`);
const env = { ...process.env, MODEL_LAB_ORDINARY_OUTPUT: output.directory, MODEL_LAB_ORDINARY_TOKEN: output.token, PWTEST_CACHE_DIR: join(output.directory, 'cache'), TMPDIR: join(output.directory, 'temporary'), TMP: join(output.directory, 'temporary'), TEMP: join(output.directory, 'temporary'), npm_config_cache: join(output.directory, 'npm-cache'), npm_config_logs_dir: join(output.directory, 'npm-logs') };
try {
  await output.write('source.json', JSON.stringify({ ...readGitCandidateState(root), runtime: (await runtimeIdentity(root)).revision, args, profile }, null, 2));
  // pretypecheck generates runtime/revision.ts. Build only into this fresh owned
  // child; Vite must never empty the checkout's existing dist.
  await runOwnedStages(root, output, [
    { command: 'npm', args: ['run', 'typecheck'], name: 'typecheck' },
    { command: join(root, 'node_modules/.bin/vite'), args: ['build', '--outDir', join(output.directory, 'build'), '--emptyOutDir', 'false'], name: 'build' },
    { command: process.execPath, args: ['--import', 'tsx', join(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config', profile === 'http' ? 'playwright.http.config.ts' : 'playwright.config.ts', ...args], name: 'playwright' },
  ], env);
  await output.write('completion.json', JSON.stringify({ status: 'passed', source: readGitCandidateState(root), runtime: (await runtimeIdentity(root)).revision }));
} catch (error) {
  // The stage runner records failure/interruption; preflight errors are retained too.
  const { existsSync } = await import('node:fs');
  if (!['failure.json', 'interruption.json'].some(name => existsSync(join(output.directory, name)))) {
    await output.write('failure.json', JSON.stringify({ status: 'failed', error: String(error) }));
  }
  console.error(error); process.exitCode = 1;
}
