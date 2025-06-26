import * as Sentry from '@sentry/react';

// Initialize Sentry as early as possible
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || 'https://fff74e528b4cafe486546e7e9898d710@o4506312335294464.ingest.us.sentry.io/4509563503640576',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],
  tracesSampleRate: 1.0,
  // Capture 10% of all sessions for replay plus 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  _experiments: { enableLogs: true },
});