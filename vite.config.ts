/// <reference types="vitest" />

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve('./'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1500,
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
    // We removed the 'define' block here.
    // This allows the app to read window.__ENV__ (injected by Cloud Run)
    // without Vite overwriting it with empty build-time values.
  };
});
