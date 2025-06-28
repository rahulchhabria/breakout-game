/// <reference types="node" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin, type SentryVitePluginOptions } from '@sentry/vite-plugin';
import { codecovVitePlugin } from "@codecov/vite-plugin";
import { version } from './package.json';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      // Inject version at build time
      __APP_VERSION__: JSON.stringify(version),
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version),
    },
    build: {
      sourcemap: true,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor code into separate chunks
            vendor: ['react', 'react-dom'],
            sentry: ['@sentry/react'],
          },
        },
      },
    },
    plugins: [
      react(),
      // Enable Sentry plugin in all environments for source maps
      sentryVitePlugin({
        org: 'rc-sentry-projects',
        project: 'breakout-game',
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {
          name: process.env.npm_package_version,
        },
        sourcemaps: {
          assets: './dist',
          filesToDeleteAfterUpload: ['**/*.js.map'],
        },
        telemetry: false, // Disable Sentry telemetry
      } satisfies SentryVitePluginOptions),
      // Add Codecov bundle analysis plugin
      codecovVitePlugin({
        enableBundleAnalysis: true,
        bundleName: "breakout-game",
        uploadToken: env.CODECOV_TOKEN || '1caa27b6-4658-40cb-96c8-8173ab8e380e',
        telemetry: false, // Disable telemetry
      }),
    ],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
