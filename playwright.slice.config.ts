import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',outputDir:'./test-results/m0-m1-first-slice/playwright',
  timeout:60_000,workers:1,
  use:{baseURL:'http://127.0.0.1:4318',headless:true},
  webServer:{command:'npx vite preview --outDir test-results/m0-m1-first-slice/dist --host 127.0.0.1 --port 4318 --strictPort',url:'http://127.0.0.1:4318',reuseExistingServer:false},
});
