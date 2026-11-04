// Must be the first import: OpenTelemetry has to patch modules before use.
import './tracing.js';

import { shutdownTracing } from '@talent-ai/observability/tracing';
import { config } from './config.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';

const app = createApp();

try {
  await redis.ping();
} catch (error) {
  logger.warn({ err: error }, 'Redis not reachable at startup; readiness will report down');
}

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.nodeEnv,
      corsOrigins: config.corsOrigins,
      services: config.services,
    },
    'api-gateway listening',
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'api-gateway shutting down');

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  await Promise.allSettled([redis.quit(), shutdownTracing()]);

  clearTimeout(forceExit);
  logger.info('api-gateway stopped');
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection');
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  void shutdown('uncaughtException');
});
