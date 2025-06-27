/// <reference types="node" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin, type SentryVitePluginOptions } from '@sentry/vite-plugin';
import { version } from './package.json';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      // Inject version at build time
      __APP_VERSION__: JSON.stringify(version),
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor code into separate chunks
            vendor: ['react', 'react-dom'],
            sentry: ['@sentry/react'],
          },
        },
      },
      // Ensure proper minification and optimization
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false, // Keep console logs for Sentry
        },
      },
    },
    plugins: [
      react(),
      // Enable Sentry plugin in all environments for source maps
      sentryVitePlugin({
        org: 'rc-sentry-projects',
        project: 'breakout-game',
        authToken: env.SENTRY_AUTH_TOKEN,
        release: {
          name: version,
          setCommits: {
            auto: true
          },
          deploy: {
            env: mode
          }
        },
        sourcemaps: {
          assets: './dist',
          filesToDeleteAfterUpload: ['**/*.js.map'],
        },
        telemetry: false, // Disable Sentry telemetry
      } satisfies SentryVitePluginOptions),
    ],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
