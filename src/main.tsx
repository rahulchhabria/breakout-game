import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import * as Sentry from '@sentry/react';
import { browserTracingIntegration, replayIntegration } from '@sentry/react';
// TODO: Add Sentry profiling integration when available for Vite/React. See: https://docs.sentry.io/product/performance/profiling/getting-started-js/
// import { ProfilingIntegration } from '@sentry/profiling-react';

Sentry.init({
  dsn: 'https://fff74e528b4cafe486546e7e9898d710@o4506312335294464.ingest.us.sentry.io/4509563503640576',
  integrations: [
    browserTracingIntegration(),
    replayIntegration(),
    // new ProfilingIntegration(), // Uncomment when supported
  ],
  tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
  replaysSessionSampleRate: 0.1, // Adjust for production (10% of all sessions)
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
  // profilesSampleRate: 1.0, // Uncomment when profiling is supported
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
