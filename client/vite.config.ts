/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API = process.env.VITE_API_PROXY ?? 'http://localhost:4000';

// Deployed commit, embedded at build time (Render sets RENDER_GIT_COMMIT during the build).
const APP_VERSION = (process.env.RENDER_GIT_COMMIT ?? process.env.APP_VERSION ?? 'dev').slice(0, 7);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': API, '/uploads': API },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  },
});
