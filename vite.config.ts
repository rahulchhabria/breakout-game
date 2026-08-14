/// <reference types="node" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
    // minify: 'esbuild', // Uncomment if you want, but test with and without if issues return
  },
  server: {
    proxy: {
      '/ingest/static': {
        target: 'https://us-assets.i.posthog.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest\/static/, '/static'),
      },
      '/ingest': {
        target: 'https://us.i.posthog.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ingest/, ''),
      },
    },
  },
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'rc-sentry-projects',
      project: 'breakout-game',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: './dist/**',
        filesToDeleteAfterUpload: './dist/**/*.map',
      },
    }),
  ],
});
