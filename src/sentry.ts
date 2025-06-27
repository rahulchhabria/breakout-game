import * as Sentry from '@sentry/react';

// Initialize Sentry as early as possible
Sentry.init({
  // DSN should be provided via environment variable `VITE_SENTRY_DSN`
  // so errors are sent to the correct project. The fallback value is for local
  // development only.
  dsn:
    import.meta.env.VITE_SENTRY_DSN ||
    'https://fff74e528b4cafe486546e7e9898d710@o4506312335294464.ingest.us.sentry.io/4509563503640576',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],
  tracesSampleRate: 1.0,
  // Capture 10% of all sessions for replay plus 100% of sessions with an error
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  _experiments: { enableLogs: true },
  // Print useful debugging information to the console so we can verify that
  // events, replays and logs are actually being sent.
  debug: true,
});
