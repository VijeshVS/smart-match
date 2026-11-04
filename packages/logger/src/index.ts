export * from './correlation.js';

import pino, { type Logger, type LoggerOptions } from 'pino';
import { getCorrelationContext } from './correlation.js';

export interface CreateLoggerOptions {
  /** Canonical service name, e.g. `auth-service`. */
  serviceName: string;
  level?: string;
  /**
   * Pretty-print human readable logs. Defaults to true outside production
   * and false in production (JSON to stdout).
   */
  pretty?: boolean;
  base?: Record<string, unknown>;
}

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  '*.password',
  '*.passwordHash',
  '*.refreshToken',
  '*.accessToken',
];

/**
 * Creates a Pino logger that automatically stamps every line with the
 * service name and the current correlation / trace context.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const isProduction = process.env.NODE_ENV === 'production';
  const pretty = options.pretty ?? !isProduction;

  const pinoOptions: LoggerOptions = {
    name: options.serviceName,
    level: options.level ?? process.env.LOG_LEVEL ?? 'info',
    base: {
      service: options.serviceName,
      env: process.env.NODE_ENV ?? 'development',
      ...options.base,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: REDACTED_PATHS,
      censor: '[REDACTED]',
    },
    mixin() {
      const context = getCorrelationContext();
      if (!context) return {};
      return {
        correlationId: context.correlationId,
        ...(context.traceId ? { traceId: context.traceId } : {}),
        ...(context.spanId ? { spanId: context.spanId } : {}),
      };
    },
  };

  if (pretty) {
    pinoOptions.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname,service,env',
        singleLine: false,
      },
    };
  }

  return pino(pinoOptions);
}

/**
 * Returns a child logger bound to an explicit correlation id. Useful for
 * queue consumers where there is no HTTP request context.
 */
export function childLogger(
  logger: Logger,
  context: { correlationId: string; traceId?: string; spanId?: string },
): Logger {
  return logger.child(context);
}

export type { Logger } from 'pino';
