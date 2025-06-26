import * as Sentry from '@sentry/react';

export const logInfo = (msg: string) => Sentry.addBreadcrumb({ message: msg, level: 'info' });
export const logWarning = (msg: string) => Sentry.captureMessage(msg, 'warning');
export const logError = (msg: string) => Sentry.captureException(new Error(msg));
export const addBreadcrumb = (msg: string, level: Sentry.SeverityLevel = 'info') =>
  Sentry.addBreadcrumb({ message: msg, level });  