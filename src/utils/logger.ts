import * as Sentry from '@sentry/react';

const { logger } = Sentry;

// Type for log attributes
type LogAttributes = Record<string, unknown>;

// Wrapper for Sentry's logger that provides consistent logging interface
export const log = {
  trace: (message: string, attributes?: LogAttributes) => {
    logger.trace(message, attributes);
  },
  
  debug: (message: string, attributes?: LogAttributes) => {
    logger.debug(message, attributes);
  },
  
  info: (message: string, attributes?: LogAttributes) => {
    logger.info(message, attributes);
  },
  
  warn: (message: string, attributes?: LogAttributes) => {
    logger.warn(message, attributes);
  },
  
  error: (message: string, error?: Error, attributes?: LogAttributes) => {
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
    logger.fatal(
      logger.fmt`${message}: ${error?.message || 'Unknown error'}`,
      {
        ...attributes,
        stack: error?.stack,
        name: error?.name,
      }
    );
  },

  // Utility method for formatting strings with attributes
  fmt: (strings: TemplateStringsArray, ...values: unknown[]) => {
    return logger.fmt(strings, ...values);
  }
}; 