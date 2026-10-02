import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ordinaryContext } from './tests/support/ordinary-output.js';
import { refuseRunnerOutputOverrides } from './tests/support/slice-output.js';
refuseRunnerOutputOverrides(process.argv, process.env);
const output = await ordinaryContext(fileURLToPath(new URL('./', import.meta.url)), 'http');
const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";

const port = 4176;
export default defineConfig({
  testDir: './tests/http-browser',
  outputDir: join(output.runner, 'playwright'),
  metadata: { sliceOutput: output.directory, ordinaryOutput: output.directory },
  reporter: [['list'], ['json', { outputFile: join(output.report, 'results.json') }]],
  workers: 1,
  use: {
    baseURL: `http://model-lab.test:${port}`,
    headless: true,
    launchOptions: { args: ['--host-resolver-rules=MAP model-lab.test 127.0.0.1', '--no-proxy-server'] },
  },
  webServer: {
    command: `./node_modules/.bin/vite preview --configLoader native --config vite.http.config.ts --outDir ${quote(output.build)} --host 0.0.0.0 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
