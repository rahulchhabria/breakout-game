import * as Sentry from '@sentry/react';

export const logInfo = (msg: string) => Sentry.captureMessage(msg, 'info');
export const logWarning = (msg: string) => Sentry.captureMessage(msg, 'warning');
export const logError = (msg: string) => Sentry.captureMessage(msg, 'error');
export const addBreadcrumb = (msg: string, level: Sentry.SeverityLevel = 'info') =>
  Sentry.addBreadcrumb({ message: msg, level }); 