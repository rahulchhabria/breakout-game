import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true, // Required for Sentry source maps
  },
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'rc-sentry-projects',
      project: 'breakout-game',
      authToken: process.env.SENTRY_AUTH_TOKEN, // Set this in your environment
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
