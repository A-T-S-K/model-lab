import { lstat, readFile, realpath, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, relative, sep, join } from 'node:path';
import { allocateTestOutput } from './test-output.js';

export async function validateScratchPath(root: string, path: string) {
  const base = await realpath(root);
  if (path.includes('\\') || path.split('/').includes('..')) throw Error('Unsafe scratch path');
  const target = resolve(base, path), parts = relative(base, target).split(sep);
  if (parts[0] !== 'test-results' || parts[1] !== 'scratch' || parts.length < 3) throw Error('Expected allocated scratch path');
  let current = base;
  for (const part of parts) {
    current = join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink() || await realpath(current) !== current) throw Error('Scratch symlink refused');
  }
  const owner = join(base, ...parts.slice(0, 3));
  const marker = join(owner, 'allocation.json');
  if ((await lstat(marker)).isSymbolicLink()) throw Error('Allocation symlink refused');
  if (JSON.parse(await readFile(marker, 'utf8')).directory !== owner) throw Error('Missing output ownership');
  return target;
}

export async function allocateSliceOutput(root: string, destination?: string) {
  const output = await allocateTestOutput(root, destination);
  // Runner cleanup can only reach this child. Custom evidence and replay handoff
  // remain siblings, never nested in a runner or reporter cleanup directory.
  for (const child of ['runner', 'evidence', 'report']) await mkdir(join(output.directory, child));
  return output;
}

export async function browserEvidenceDirectory(root: string, output: string) {
  await validateScratchPath(root, output);
  return mkdtemp(join(output, 'evidence', 'test-'));
}

export async function readReplayPair(root: string, savedPath: string, responsePath: string, output: string) {
  const destination = await validateScratchPath(root, output);
  const paths = await Promise.all([savedPath, responsePath].map(path => realpath(resolve(root, path))));
  if (paths.some(path => path === destination || path.startsWith(destination + sep))) throw Error('Replay inputs must be outside current output');
  const [saved, response] = await Promise.all(paths.map(path => readFile(path, 'utf8')));
  const parsed = JSON.parse(saved), native = JSON.parse(response);
  if (JSON.stringify(parsed.envelope) !== JSON.stringify(native)) throw Error('Saved replay/response mismatch');
  return { saved, native };
}
