// Import Sentry instrumentation first
import './sentry';

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';

import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <Sentry.ErrorBoundary fallback={<p>An error has occurred</p>} showDialog>
    <StrictMode>
      <App />
    </StrictMode>
  </Sentry.ErrorBoundary>
);