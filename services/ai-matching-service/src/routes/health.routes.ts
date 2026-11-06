import { Router } from 'express';
import type { HealthStatus } from '@talent-ai/shared-types';
import { config } from '../config.js';
import { eventBus } from '../lib/event-bus.js';
import { qdrant } from '../lib/qdrant.js';
import { responseCache } from '../services/cache.js';

export const healthRouter: Router = Router();

healthRouter.get('/liveness', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: config.serviceName,
    version: config.version,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/readiness', async (_req, res) => {
  const [vectorStore, cache] = await Promise.all([qdrant.health(), responseCache.health()]);
  const rabbitmq = eventBus.isConnected ? 'up' : 'down';

  const checks: HealthStatus['checks'] = {
    qdrant: vectorStore,
    redis: cache,
    rabbitmq,
  };

  const criticalDown = vectorStore === 'down';
  const status: HealthStatus['status'] = criticalDown
    ? 'down'
    : cache === 'down' || rabbitmq === 'down'
      ? 'degraded'
      : 'ok';

  const payload: HealthStatus = {
    status,
    service: config.serviceName,
    version: config.version,
    uptimeSeconds: Math.floor(process.uptime()),
    checks,
    timestamp: new Date().toISOString(),
  };

  res.status(criticalDown ? 503 : 200).json(payload);
});

healthRouter.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: config.serviceName,
    version: config.version,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
