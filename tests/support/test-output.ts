import { constants } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

// Test-only ownership: all historical/project paths are outside this namespace.
// An override names a NEW immediate child; no invocation can adopt an old run.
// There is deliberately no cleanup API or delete-and-retry collision fallback.
export async function allocateTestOutput(root: string, destination?: string) {
  const canonicalRoot = await realpath(root);
  const scratch = join(canonicalRoot, 'test-results', 'scratch');
  if (destination !== undefined && (!destination || destination.includes('\\') ||
      destination.split('/').some(part => part === '..' || part === '.'))) {
    throw new Error('Unsafe output path');
  }
  const requested = destination === undefined ? undefined :
    resolve(canonicalRoot, destination);
  if (requested !== undefined && (dirname(requested) !== scratch ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(relative(scratch, requested)))) {
    throw new Error('Output must be a fresh immediate child of test-results/scratch');
  }
  async function verify(directory: string) {
    const parts = relative(canonicalRoot, directory).split(sep);
    if (parts.includes('..') || isAbsolute(relative(canonicalRoot, directory))) {
      throw new Error('Output escaped its root');
    }
    let current = canonicalRoot;
    for (const part of parts) {
      current = join(current, part);
      const stat = await lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(current) !== current) {
        throw new Error('Output ancestor must be a real directory, without symlinks');
      }
    }
  }
  // Create one level at a time, then check it. Never follow a pre-existing alias.
  for (const directory of [join(canonicalRoot, 'test-results'), scratch]) {
    try { await mkdir(directory, { mode: 0o700 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    await verify(directory);
  }
  let directory: string;
  if (requested === undefined) directory = await mkdtemp(join(scratch, 'training-'));
  else {
    await mkdir(requested, { mode: 0o700 }); // EEXIST is a refusal, including symlinks.
    directory = requested;
  }
  await verify(directory);
  const identity = await lstat(directory);
  async function write(name: string, bytes: string) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) throw new Error('Unsafe output filename');
    await verify(directory);
    const now = await lstat(directory);
    if (now.dev !== identity.dev || now.ino !== identity.ino) throw new Error('Output ownership changed');
    const file = await open(join(directory, name),
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await file.writeFile(bytes); } finally { await file.close(); }
  }
  await write('allocation.json', JSON.stringify({ status: 'allocated', directory, pid: process.pid }) + '\n');
  return { directory, write };
}

export async function withTestOutput<T>(root: string, destination: string | undefined,
  action: (output: Awaited<ReturnType<typeof allocateTestOutput>>) => Promise<T>): Promise<T> {
  const output = await allocateTestOutput(root, destination);
  console.log(`Training evidence: ${output.directory}`);
  try {
    const result = await action(output);
    await output.write('completion.json', JSON.stringify({ status: 'passed' }) + '\n');
    return result;
  } catch (error) {
    // Keep the allocation/partial output and the original error even if recording fails.
    try { await output.write('failure.json', JSON.stringify({ status: 'failed', error: String(error) }) + '\n'); }
    catch (recordError) { console.error('Could not retain output failure receipt:', recordError); }
    throw error;
  }
}
