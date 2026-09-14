import { test as base, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { browserEvidenceDirectory } from './slice-output.js';
export { expect };
export type { Page } from '@playwright/test';
export const test = base.extend<{ evidenceDir: string }>({
  evidenceDir: async ({}, use, info) => {
    for (const name of ['SPATIAL_EVIDENCE_DIR', 'WAVE2_EVIDENCE_DIR', 'WAVE2C_EVIDENCE_DIR', 'STOP_EVIDENCE_DIR']) {
      if (process.env[name] !== undefined) throw Error(`${name} is no longer a writable destination; use a fresh SLICE_EVIDENCE_DIR under test-results/scratch`);
    }
    const output = info.config.metadata.sliceOutput;
    if (typeof output !== 'string') throw Error('Use playwright.slice.config.ts for protected evidence output');
    await use(await browserEvidenceDirectory(fileURLToPath(new URL('../../', import.meta.url)), output));
  },
});
