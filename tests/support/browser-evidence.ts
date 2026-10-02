import { test as base, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { browserEvidenceDirectory, validateScratchPath } from './slice-output.js';
export { expect };
export type { Page, TestInfo } from '@playwright/test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestInfo } from '@playwright/test';
const directories = new WeakMap<TestInfo, Promise<string>>();
export function evidenceDirectory(info: TestInfo): Promise<string> {
  let directory = directories.get(info);
  if (!directory) {
    const output = info.config.metadata.sliceOutput;
    if (typeof output !== 'string') throw Error('Protected evidence requires an owned browser or slice config');
    directory = browserEvidenceDirectory(fileURLToPath(new URL('../../', import.meta.url)), output).then(async path => {
      await writeFile(join(path, 'test-info.json'), JSON.stringify({ testId: info.testId, title: info.titlePath, file: info.file, project: info.project.name, retry: info.retry, repeatEachIndex: info.repeatEachIndex, workerIndex: info.workerIndex }, null, 2), { flag: 'wx' });
      return path;
    });
    directories.set(info, directory);
  }
  return directory;
}
export async function writableHandoff(info: TestInfo, name: string) {
  if (typeof info.config.metadata.ordinaryOutput === 'string') {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const parent = await validateScratchPath(root, join(info.config.metadata.ordinaryOutput, 'handoff'));
    // A separate fresh per-attempt handoff can become another invocation's input.
    return mkdtemp(join(parent, 'test-'));
  }
  return validateScratchPath(fileURLToPath(new URL('../../', import.meta.url)), process.env[name] ?? '');
}
export const test = base.extend<{ evidenceDir: string }>({
  evidenceDir: async ({}, use, info) => {
    for (const name of ['SPATIAL_EVIDENCE_DIR', 'WAVE2_EVIDENCE_DIR', 'WAVE2C_EVIDENCE_DIR', 'STOP_EVIDENCE_DIR']) {
      if (process.env[name] !== undefined) throw Error(`${name} is no longer a writable destination; use a fresh SLICE_EVIDENCE_DIR under test-results/scratch`);
    }
    await use(await evidenceDirectory(info));
  },
});
