import * as Sentry from '@sentry/react';

// Initialize Sentry as early as possible
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || 'https://fff74e528b4cafe486546e7e9898d710@o4506312335294464.ingest.us.sentry.io/4509563503640576',
  release: import.meta.env.VITE_APP_VERSION || '1.0.0',
  integrations: [
    Sentry.browserTracingIntegration(),
    // Configure Session Replay with privacy settings
    Sentry.replayIntegration({
      // Mask all text content by default
      maskAllText: true,
      // Block all media elements for privacy
      blockAllMedia: true,
      // Add canvas recording for game state
      networkDetailAllowUrls: [window.location.origin],
    }),
    // Enhanced console logging integration
    Sentry.consoleLoggingIntegration({
      levels: ['debug', 'info', 'warn', 'error', 'log', 'assert'],
    }),
    // Add canvas recording for game state
    Sentry.replayCanvasIntegration(),
    // Add the modern feedback widget
    Sentry.feedbackIntegration({
      // Use system color scheme
      colorScheme: 'system',
      // Enable screenshots on desktop browsers
      enableScreenshot: true,
      // Customize the widget appearance
      buttonLabel: 'Send Feedback',
      submitButtonLabel: 'Send',
      // Position the widget in the bottom-right corner
      placement: 'bottom-right',
      // Show branding
      showBranding: true,
    }),
  ],
  tracesSampleRate: 1.0,
  // Capture all sessions for replay
  replaysSessionSampleRate: 1.0,
  // Always capture sessions when errors occur
  replaysOnErrorSampleRate: 1.0,
  _experiments: {
    enableLogs: true,
    // Filter out noisy logs in development
    beforeSendLog: (log) => {
      // Don't send debug logs in production
      if (import.meta.env.PROD && log.level === 'debug') {
        return null;
      }
      
      // Add environment info to all logs
      return {
        ...log,
        attributes: {
          ...log.attributes,
          environment: import.meta.env.MODE,
          version: import.meta.env.VITE_APP_VERSION || '1.0.0',
        },
      };
    },
  },
});