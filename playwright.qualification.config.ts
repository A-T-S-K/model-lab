import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { refuseRunnerOutputOverrides } from './tests/support/slice-output.js';
import { qualificationBrowserContext } from './tests/support/qualification-evidence.js';

const root = fileURLToPath(new URL('./', import.meta.url));
refuseRunnerOutputOverrides(process.argv, process.env);
const qualification = await qualificationBrowserContext(root);
if (!qualification) throw new Error('playwright.qualification.config.ts requires the qualification orchestrator environment');

const port = Number(process.env.MODEL_LAB_QUALIFICATION_PORT);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Explicit valid MODEL_LAB_QUALIFICATION_PORT required');
}
const shellQuote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";

export default defineConfig({
  testDir: './tests/browser',
  outputDir: join(qualification.runner, 'playwright'),
  metadata: {
    qualificationRoot: qualification.allocation,
    candidateCommit: qualification.candidate.expected.commit,
    candidateTree: qualification.candidate.expected.tree,
    runtimeIdentity: qualification.expectedRuntimeIdentity,
  },
  reporter: [
    ['list'],
    ['json', { outputFile: join(qualification.report, 'results.json') }],
  ],
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:' + port,
    headless: true,
  },
  webServer: {
    command: './node_modules/.bin/vite preview --outDir ' + shellQuote(qualification.build) +
      ' --host 127.0.0.1 --port ' + String(port) + ' --strictPort',
    url: 'http://127.0.0.1:' + port,
    reuseExistingServer: false,
  },
});
