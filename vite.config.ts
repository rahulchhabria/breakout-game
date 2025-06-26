/// <reference types="node" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      include: './dist',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: 'rc-sentry-projects',
      project: 'breakout-game',
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
