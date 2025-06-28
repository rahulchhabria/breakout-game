/// <reference types="node" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { version } from './package.json';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    // Inject version at build time
    __APP_VERSION__: JSON.stringify(version),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version),
  },
  build: {
    sourcemap: true,
    // minify: 'esbuild', // Uncomment if you want, but test with and without if issues return
  },
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'rc-sentry-projects',
      project: 'breakout-game',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: process.env.npm_package_version,
      },
      sourcemaps: {
        assets: './dist',
      },
    }),
  ],
});
