import * as Sentry from '@sentry/react';

// Initialize Sentry as early as possible
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || 'https://fff74e528b4cafe486546e7e9898d710@o4506312335294464.ingest.us.sentry.io/4509563503640576',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
    Sentry.feedbackIntegration({
      // Enable system-based color scheme
      colorScheme: 'system',
      // Enable screenshots (supported on desktop browsers)
      enableScreenshot: true,
    }),
  ],
  tracesSampleRate: 1.0,
  // Capture 10% of all sessions for replay plus 100% of sessions with an error
  replaysSessionSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  _experiments: { enableLogs: true },
  
  // Show feedback dialog for all unhandled errors
  beforeSend(event) {
    if (event.exception) {
      Sentry.showReportDialog({ eventId: event.event_id });
    }
    return event;
  },
});