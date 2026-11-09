// Must be the first import: OpenTelemetry has to patch modules before use.
import './tracing.js';

import { shutdownTracing } from '@talent-ai/observability/tracing';
import { config } from './config.js';
import { createApp } from './app.js';
import { eventBus } from './lib/event-bus.js';
import { logger } from './lib/logger.js';
import { startOutboxRelay } from './lib/outbox.js';
import { prisma } from './lib/prisma.js';
import { startReviewConsumer } from './services/review-consumer.js';
import { startSwipeConsumer } from './services/swipe-consumer.js';

const app = createApp();

await prisma.$connect();

// Register consumers before connecting so they are also started on the first
// successful reconnect if RabbitMQ is unavailable at boot.
await startSwipeConsumer();
await startReviewConsumer();

try {
  await eventBus.connect();
} catch (error) {
  logger.warn({ err: error }, 'RabbitMQ not reachable at startup; consumers and outbox will retry');
}

const stopOutboxRelay = startOutboxRelay(eventBus);

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.nodeEnv,
      corsOrigins: config.corsOrigins,
    },
    'rewards-service listening',
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'rewards-service shutting down');

  stopOutboxRelay();

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
  logger.info('rewards-service stopped');
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
