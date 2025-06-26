import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'https://fff74e528b4cafe486546e7e9898d710@o4506312335294464.ingest.us.sentry.io/4509563503640576',
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0, // Adjust in production as needed
  replaysSessionSampleRate: 1.0, // Capture 100% of all sessions for testing
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
  _experiments: { enableLogs: true }, // Enable Sentry logs
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);