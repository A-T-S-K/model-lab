import { mkdir, readFile, lstat, access } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { allocateSliceOutput, validateScratchPath, refuseRunnerOutputOverrides } from './slice-output.js';

export function refuseOrdinaryOverrides(argv: readonly string[], env: NodeJS.ProcessEnv) {
  refuseRunnerOutputOverrides(argv, env);
  if (argv.some(arg => /^(-[cu]|--(?:config|add-reporter|last-failed-file|update-snapshots|ui|ui-host|ui-port|test-list)(?:=|$))/.test(arg))) {
    throw Error('Config, snapshot, UI and external test-list overrides refused by owned runner');
  }
  for (const name of Object.keys(env)) {
    if (/^(?:MODEL_LAB_ORDINARY_|MODEL_LAB_QUALIFICATION_|PLAYWRIGHT_.*(?:OUTPUT|REPORT)|PW_TEST_REPORTER|PWTEST_CACHE_DIR|PW_TEST_SOURCE_TRANSFORM(?:_SCOPE)?|.*_EVIDENCE_DIR$|M2B_HANDOFF_DIR|M2D_HANDOFF_DIR|M4A_HANDOFF_DIR)/.test(name) && name !== 'BROWSER_EVIDENCE_DIR') {
      if (/^(M2B|M2D|M4A)_HANDOFF_DIR$/.test(name) && env.SLICE_PHASE === 'offline') continue;
      throw Error(`${name} override refused by owned runner`);
    }
  }
}

export async function allocateOrdinaryOutput(root: string, profile: string, destination?: string) {
  if (!['browser', 'http'].includes(profile)) throw Error('Unknown browser profile');
  const output = await allocateSliceOutput(root, destination, `${profile}-`);
  for (const child of ['build', 'handoff', 'cache', 'temporary', 'npm-cache', 'npm-logs']) await mkdir(join(output.directory, child));
  const token = randomUUID();
  const stat = await lstat(output.directory);
  await output.write('invocation.json', JSON.stringify({ token, profile, pid: process.pid, dev: stat.dev, ino: stat.ino }));
  return { ...output, token, profile };
}

// Configs never allocate. The wrapper passes a fresh invocation token to loaders
// and workers; stale shell exports cannot cause adoption of a previous run.
export async function ordinaryContext(root: string, profile: string, env = process.env) {
  const directory = await validateScratchPath(root, env.MODEL_LAB_ORDINARY_OUTPUT ?? '');
  const marker = join(directory, 'invocation.json');
  const markerStat = await lstat(marker);
  if (!markerStat.isFile() || markerStat.isSymbolicLink()) throw Error('Invocation receipt alias refused');
  const receipt = JSON.parse(await readFile(marker, 'utf8'));
  const stat = await lstat(directory);
  if (receipt.token !== env.MODEL_LAB_ORDINARY_TOKEN || receipt.profile !== profile || receipt.dev !== stat.dev || receipt.ino !== stat.ino) throw Error('Ordinary invocation ownership mismatch');
  try { process.kill(receipt.pid, 0); } catch { throw Error('Ordinary invocation owner is no longer active'); }
  for (const name of ['completion.json', 'failure.json', 'interruption.json']) {
    try { await access(join(directory, name)); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    throw Error('Ordinary invocation already finished');
  }
  const paths = {} as Record<'build' | 'runner' | 'evidence' | 'report' | 'handoff', string>;
  for (const child of ['build', 'runner', 'evidence', 'report', 'handoff'] as const) {
    paths[child] = await validateScratchPath(root, join(directory, child));
    if (!(await lstat(paths[child])).isDirectory()) throw Error('Owned output child must be a directory');
  }
  return { directory, ...paths };
}
