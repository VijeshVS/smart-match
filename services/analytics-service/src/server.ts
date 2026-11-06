// Must be the first import: OpenTelemetry has to patch modules before use.
import './tracing.js';

import { shutdownTracing } from '@talent-ai/observability/tracing';
import { config } from './config.js';
import { createApp } from './app.js';
import { eventBus } from './lib/event-bus.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { startAnalyticsConsumer } from './services/event-consumer.js';

const app = createApp();

// Fail fast when the read-model database is unreachable. Migrations are applied
// by `db:deploy` in deployment, never at boot.
await prisma.$queryRaw`SELECT 1`;

// Register the consumer before connecting so it also starts on the first
// successful reconnect if RabbitMQ is unavailable at boot.
await startAnalyticsConsumer();

try {
  await eventBus.connect();
} catch (error) {
  logger.warn({ err: error }, 'RabbitMQ not reachable at startup; consumer will retry');
}

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.nodeEnv,
      database: new URL(config.databaseUrl).pathname.replace(/^\//, ''),
    },
    'analytics-service listening',
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'analytics-service shutting down');

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  await Promise.allSettled([eventBus.close(), prisma.$disconnect(), shutdownTracing()]);

  clearTimeout(forceExit);
  logger.info('analytics-service stopped');
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
