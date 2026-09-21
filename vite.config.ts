import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { atlasDevSave } from './tools/atlasDevSave.ts';

// `VITE_BASE` lets the same code deploy to a sub-path (e.g. GitHub Pages at
// https://user.github.io/my-atlas/). Locally it defaults to "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), atlasDevSave()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
