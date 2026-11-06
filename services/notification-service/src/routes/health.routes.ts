import { Router } from 'express';
import type { HealthStatus } from '@talent-ai/shared-types';
import { config } from '../config.js';
import { eventBus } from '../lib/event-bus.js';
import { isMongoReady } from '../lib/mongo.js';
import { connectedClientCount, isRealtimeBridgeReady } from '../services/websocket.js';

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

healthRouter.get('/readiness', (_req, res) => {
  const mongo = isMongoReady() ? 'up' : 'down';
  const rabbitmq = eventBus.isConnected ? 'up' : 'down';
  const redis = isRealtimeBridgeReady() ? 'up' : 'down';

  const checks: HealthStatus['checks'] = { mongodb: mongo, rabbitmq, redis };

  const status: HealthStatus['status'] =
    mongo === 'down' ? 'down' : rabbitmq === 'down' || redis === 'down' ? 'degraded' : 'ok';

  res.status(mongo === 'down' ? 503 : 200).json({
    status,
    service: config.serviceName,
    version: config.version,
    uptimeSeconds: Math.floor(process.uptime()),
    checks,
    connections: { websocketClients: connectedClientCount() },
    timestamp: new Date().toISOString(),
  } satisfies HealthStatus & { connections: { websocketClients: number } });
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
