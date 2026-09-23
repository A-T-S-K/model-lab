import { defineConfig } from '@playwright/test';

const port = 4176;
export default defineConfig({
  testDir: './tests/http-browser',
  outputDir: './test-results/scratch/playwright-http-artifacts',
  workers: 1,
  use: {
    baseURL: `http://model-lab.test:${port}`,
    headless: true,
    launchOptions: { args: ['--host-resolver-rules=MAP model-lab.test 127.0.0.1', '--no-proxy-server'] },
  },
  webServer: {
    command: `./node_modules/.bin/vite preview --config vite.http.config.ts --outDir dist --host 0.0.0.0 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
