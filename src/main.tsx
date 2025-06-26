import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import * as Sentry from '@sentry/react';
import { browserTracingIntegration, replayIntegration } from '@sentry/react';

Sentry.init({
  dsn: 'https://fff74e528b4cafe486546e7e9898d710@o4506312335294464.ingest.us.sentry.io/4509563503640576',
  integrations: [
    browserTracingIntegration(),
    replayIntegration(),
  ],
  tracesSampleRate: 1.0, // Adjust in production as needed
  replaysSessionSampleRate: 1.0, // Capture 100% of all sessions for testing
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
  _experiments: { enableLogs: true }, // Enable Sentry logs
});

// Sentry log forwarding for console.log, warn, error
const origLog = console.log;
console.log = function (...args) {
  Sentry.addBreadcrumb({
    category: 'console',
    message: args.map(String).join(' '),
    level: 'info',
  });
  origLog.apply(console, args);
};

const origWarn = console.warn;
console.warn = function (...args) {
  Sentry.captureMessage(args.map(String).join(' '), 'warning');
  origWarn.apply(console, args);
};

const origError = console.error;
console.error = function (...args) {
  Sentry.captureMessage(args.map(String).join(' '), 'error');
  origError.apply(console, args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
