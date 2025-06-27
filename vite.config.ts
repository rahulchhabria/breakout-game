/// <reference types="node" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin, type SentryVitePluginOptions } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'rc-sentry-projects',
      project: 'breakout-game',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: './dist',
        filesToDeleteAfterUpload: ['**/*.js.map'],
      },
    } satisfies SentryVitePluginOptions),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
