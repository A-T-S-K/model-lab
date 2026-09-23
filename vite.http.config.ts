import { defineConfig } from 'vite';

/** Test-only host allowlist for the non-trustworthy HTTP-origin qualification. */
export default defineConfig({ preview: { allowedHosts: ['model-lab.test'] } });
