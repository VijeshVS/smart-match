// Must be the first import: OpenTelemetry has to patch modules before use.
import './tracing.js';

import { shutdownTracing } from '@talent-ai/observability/tracing';
import { config } from './config.js';
import { createApp } from './app.js';
import { eventBus } from './lib/event-bus.js';
import { logger } from './lib/logger.js';
import { qdrant } from './lib/qdrant.js';
import { redis } from './lib/redis.js';
import { startTalentIndexer } from './services/indexer.js';

const app = createApp();

try {
  await qdrant.ensureCollection();
} catch (error) {
  logger.warn(
    { err: error, collection: config.qdrant.collection },
    'Qdrant not reachable at startup; indexing and search will retry lazily',
  );
}

// Register the consumer before connecting so it is also started on the first
// successful reconnect if RabbitMQ is unavailable at boot.
await startTalentIndexer();

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
      aiProvider: config.ai.provider,
      embeddingProvider: config.embedding.provider,
      qdrantCollection: config.qdrant.collection,
    },
    'ai-matching-service listening',
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'ai-matching-service shutting down');

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  await Promise.allSettled([
    eventBus.close(),
    redis.quit().catch(() => redis.disconnect()),
    shutdownTracing(),
  ]);

  clearTimeout(forceExit);
  logger.info('ai-matching-service stopped');
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
