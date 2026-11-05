// Must be the first import: OpenTelemetry has to patch modules before use.
import './tracing.js';

import { config } from './config.js';
import { createApp } from './app.js';
import { eventBus } from './lib/event-bus.js';
import { logger } from './lib/logger.js';
import { connectMongo, disconnectMongo } from './lib/mongo.js';
import { startOutboxRelay } from './lib/outbox.js';
import { OutboxEventModel } from './models/outbox-event.model.js';
import { TalentProfileModel } from './models/talent-profile.model.js';
import { shutdownTracing } from '@talent-ai/observability/tracing';

const app = createApp();

await connectMongo();

// Build the unique and query indexes eagerly so a bad deployment fails at boot
// rather than on the first profile write.
await Promise.all([TalentProfileModel.init(), OutboxEventModel.init()]);

try {
  await eventBus.connect();
} catch (error) {
  logger.warn({ err: error }, 'RabbitMQ not reachable at startup; outbox will retry');
}

const stopOutboxRelay = startOutboxRelay(eventBus);

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.nodeEnv,
      dbName: config.mongo.dbName,
      corsOrigins: config.corsOrigins,
    },
    'talent-service listening',
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'talent-service shutting down');

  stopOutboxRelay();

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  await Promise.allSettled([eventBus.close(), disconnectMongo(), shutdownTracing()]);

  clearTimeout(forceExit);
  logger.info('talent-service stopped');
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
