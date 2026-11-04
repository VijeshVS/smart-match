import { startTracing } from '@talent-ai/observability/tracing';
import { config } from './config.js';

/**
 * Starts OpenTelemetry before Express, Prisma, ioredis and amqplib are loaded.
 * `server.ts` imports this module first so the instrumentations can patch those
 * modules on require.
 */
export const tracing = startTracing({
  serviceName: config.serviceName,
  serviceVersion: config.version,
  environment: config.nodeEnv,
  endpoint: config.otel.endpoint,
  enabled: config.otel.enabled,
});
