import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allocateSliceOutput, browserEvidenceDirectory, readReplayPair, validateScratchPath } from '../support/slice-output.js';

test('slice output refuses historical/aliased roots and collisions; runner cleanup preserves live-to-offline inputs', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'model-lab-slice-output-')));
  const protectedDir = join(root, 'test-results', 'old');
  await mkdir(protectedDir, {recursive:true});await writeFile(join(protectedDir,'sentinel'),'keep');
  for (const destination of ['test-results/old','test-results','test-results/scratch/../old']) await assert.rejects(allocateSliceOutput(root,destination));
  const live = await allocateSliceOutput(root,'test-results/scratch/live');
  await assert.rejects(allocateSliceOutput(root,'test-results/scratch/live'), {code:'EEXIST'});
  await symlink(protectedDir,join(root,'test-results/scratch/alias'));
  await assert.rejects(allocateSliceOutput(root,'test-results/scratch/alias'));
  await assert.rejects(validateScratchPath(root,'test-results/scratch/alias'));
  const evidence = await browserEvidenceDirectory(root,live.directory);
  const response=JSON.stringify({record:{id:'synthetic-live'}}),saved=JSON.stringify({serialization:'model-lab-json-v1',envelope:JSON.parse(response)});
  const savedPath=join(evidence,'saved.json'),responsePath=join(evidence,'response.json');
  await writeFile(savedPath,saved,{flag:'wx'});await writeFile(responsePath,response,{flag:'wx'});
  const offline=await allocateSliceOutput(root);
  await assert.rejects(readReplayPair(root,savedPath,responsePath,live.directory),/outside/);
  // Model the installed runner's recursive cleanup, ONLY on a synthetic runner child.
  await rm(join(live.directory,'runner'),{recursive:true});await rm(join(offline.directory,'runner'),{recursive:true});
  assert.deepEqual(await readReplayPair(root,savedPath,responsePath,offline.directory),{saved,native:JSON.parse(response)});
  assert.equal(await readFile(savedPath,'utf8'),saved);assert.equal(await readFile(responsePath,'utf8'),response);
  assert.equal(await readFile(join(protectedDir,'sentinel'),'utf8'),'keep');assert.deepEqual(await readdir(protectedDir),['sentinel']);
  assert.notEqual(await browserEvidenceDirectory(root,offline.directory),await browserEvidenceDirectory(root,offline.directory));
});
