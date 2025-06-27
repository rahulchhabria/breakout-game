/// <reference types="node" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin, type SentryVitePluginOptions } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Upload source maps to Sentry during production builds. The auth token
    // should be provided via the `SENTRY_AUTH_TOKEN` environment variable.
    sentryVitePlugin({
      org: 'rc-sentry-projects',
      project: 'breakout-game',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: './dist',
      },
    } satisfies SentryVitePluginOptions),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    sourcemap: true,
  },
});
