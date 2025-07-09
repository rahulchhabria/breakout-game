import * as Sentry from '@sentry/react';

const { logger } = Sentry;

// Type for log attributes
export type LogAttributes = Record<string, unknown>;

// Buffer for recent logs for Sentry breadcrumbs
const RECENT_LOGS_LIMIT = 10;
type LogLevel = Sentry.Breadcrumb['level'];
const recentLogs: Array<{ level: LogLevel; message: string; attributes?: LogAttributes; timestamp: number }> = [];

export function getRecentLogs() {
  return [...recentLogs];
}

// Wrapper for Sentry's logger that provides consistent logging interface and tracks recent logs
export const log = {
  trace: (message: string, attributes?: LogAttributes) => {
    recentLogs.push({ level: 'info', message, attributes, timestamp: Date.now() });
    if (recentLogs.length > RECENT_LOGS_LIMIT) recentLogs.shift();
    logger.trace(message, attributes);
  },
  debug: (message: string, attributes?: LogAttributes) => {
    recentLogs.push({ level: 'debug', message, attributes, timestamp: Date.now() });
    if (recentLogs.length > RECENT_LOGS_LIMIT) recentLogs.shift();
    logger.debug(message, attributes);
  },
  info: (message: string, attributes?: LogAttributes) => {
    recentLogs.push({ level: 'info', message, attributes, timestamp: Date.now() });
    if (recentLogs.length > RECENT_LOGS_LIMIT) recentLogs.shift();
    logger.info(message, attributes);
  },
  warn: (message: string, attributes?: LogAttributes) => {
    recentLogs.push({ level: 'warning', message, attributes, timestamp: Date.now() });
    if (recentLogs.length > RECENT_LOGS_LIMIT) recentLogs.shift();
    logger.warn(message, attributes);
  },
  error: (message: string, error?: Error, attributes?: LogAttributes) => {
    recentLogs.push({ level: 'error', message, attributes, timestamp: Date.now() });
    if (recentLogs.length > RECENT_LOGS_LIMIT) recentLogs.shift();
    logger.error(
      logger.fmt`${message}: ${error?.message || 'Unknown error'}`,
      {
        ...attributes,
        stack: error?.stack,
        name: error?.name,
      }
    );
  },
  fatal: (message: string, error?: Error, attributes?: LogAttributes) => {
    recentLogs.push({ level: 'fatal', message, attributes, timestamp: Date.now() });
    if (recentLogs.length > RECENT_LOGS_LIMIT) recentLogs.shift();
    logger.fatal(
      logger.fmt`${message}: ${error?.message || 'Unknown error'}`,
      {
        ...attributes,
        stack: error?.stack,
        name: error?.name,
      }
    );
  },
  fmt: (strings: TemplateStringsArray, ...values: unknown[]) => {
    return logger.fmt(strings, ...values);
  }
}; 