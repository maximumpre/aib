import { defineConfig } from 'astro/config';
import { devApi } from './scripts/dev-api-plugin.mjs';

export default defineConfig({
  build: {
    format: 'file',
  },
  // Dev/preview only. Two dev-only Vite plugins, neither of which can affect
  // `astro build` output or a deployment:
  //   devApi()               → runs the real Vercel `api/` handlers behind /api/*
  //   crawlerSeoPreview()    → `CSP=1` forces the crawler twin at `/`
  vite: {
    plugins: devApi(),
  },
});
