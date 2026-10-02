import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ordinaryContext } from './tests/support/ordinary-output.js';
import { refuseRunnerOutputOverrides } from './tests/support/slice-output.js';
refuseRunnerOutputOverrides(process.argv, process.env);
const output = await ordinaryContext(fileURLToPath(new URL('./', import.meta.url)), 'browser');
const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
export default defineConfig({
  testDir: './tests/browser',
  outputDir: join(output.runner, 'playwright'),
  metadata: { sliceOutput: output.directory, ordinaryOutput: output.directory },
  reporter: [['list'], ['json', { outputFile: join(output.report, 'results.json') }]],
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  webServer: { command: `./node_modules/.bin/vite preview --outDir ${quote(output.build)} --host 127.0.0.1 --port 4173 --strictPort`, url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
