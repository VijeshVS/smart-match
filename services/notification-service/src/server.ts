// Must be the first import: OpenTelemetry has to patch modules before use.
import './tracing.js';

import { shutdownTracing } from '@talent-ai/observability/tracing';
import { config } from './config.js';
import { createApp } from './app.js';
import { eventBus } from './lib/event-bus.js';
import { logger } from './lib/logger.js';
import { connectMongo, disconnectMongo } from './lib/mongo.js';
import { NotificationModel } from './models/notification.model.js';
import { RecruiterContactModel, TalentContactModel } from './models/contact.model.js';
import { startNotificationConsumers } from './services/consumers.js';
import {
  closeWebSockets,
  registerWebSocketServer,
  startRealtimeBridge,
} from './services/websocket.js';

const app = createApp();

await connectMongo();

// Build unique/query indexes eagerly so a bad deployment fails at boot rather
// than on the first notification write.
await Promise.all([
  NotificationModel.init(),
  TalentContactModel.init(),
  RecruiterContactModel.init(),
]);

// Register consumers before connecting so they also start on the first
// successful reconnect if RabbitMQ is unavailable at boot.
await startNotificationConsumers();

// Multi-replica live delivery depends on this bridge; without Redis the service
// still works, scoped to sockets held by the current replica.
await startRealtimeBridge();

try {
  await eventBus.connect();
} catch (error) {
  logger.warn({ err: error }, 'RabbitMQ not reachable at startup; consumers will retry');
}

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.nodeEnv,
      dbName: config.mongo.dbName,
      websocketPath: config.websocketPath,
      emailEnabled: config.email.enabled,
    },
    'notification-service listening',
  );
});

registerWebSocketServer(server);

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'notification-service shutting down');

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  await closeWebSockets();
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  await Promise.allSettled([eventBus.close(), disconnectMongo(), shutdownTracing()]);

  clearTimeout(forceExit);
  logger.info('notification-service stopped');
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
