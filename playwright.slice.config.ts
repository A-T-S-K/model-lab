import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { allocateSliceOutput, validateScratchPath, refuseRunnerOutputOverrides } from './tests/support/slice-output.js';
const root = fileURLToPath(new URL('./', import.meta.url));
refuseRunnerOutputOverrides(process.argv, process.env);
// Main invocation allocates; workers inherit its root through their environment.
if (process.env.TEST_WORKER_INDEX === undefined) {
  const output = await allocateSliceOutput(root, process.env.SLICE_EVIDENCE_DIR);
  process.env.MODEL_LAB_SLICE_OUTPUT = output.directory;
  console.log(`Slice output: ${output.directory}`);
}
const output = await validateScratchPath(root, process.env.MODEL_LAB_SLICE_OUTPUT ?? '');
const build = await validateScratchPath(root, process.env.SLICE_BUILD_DIR ?? '');
const port = Number(process.env.SLICE_PORT);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw Error('Explicit task-owned SLICE_PORT required');
const shellQuote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
export default defineConfig({
  testDir: './tests/browser', outputDir: join(output, 'runner'),
  metadata: { sliceOutput: output },
  reporter: [['list'], ['json', { outputFile: join(output, 'report', 'results.json') }]],
  timeout: 60_000, workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true },
  webServer: { command: `./node_modules/.bin/vite preview --outDir ${shellQuote(build)} --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`, reuseExistingServer: false },
});
