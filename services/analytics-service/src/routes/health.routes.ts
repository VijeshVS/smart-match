import { Router } from 'express';
import type { HealthStatus } from '@talent-ai/shared-types';
import { config } from '../config.js';
import { eventBus } from '../lib/event-bus.js';
import { prisma } from '../lib/prisma.js';

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
  const postgres = await prisma.$queryRaw`SELECT 1`
    .then(() => 'up' as const)
    .catch(() => 'down' as const);

  const rabbitmq = eventBus.isConnected ? 'up' : 'down';
  const checks: HealthStatus['checks'] = { postgres, rabbitmq };

  const status: HealthStatus['status'] =
    postgres === 'down' ? 'down' : rabbitmq === 'down' ? 'degraded' : 'ok';

  res.status(postgres === 'down' ? 503 : 200).json({
    status,
    service: config.serviceName,
    version: config.version,
    uptimeSeconds: Math.floor(process.uptime()),
    checks,
    timestamp: new Date().toISOString(),
  } satisfies HealthStatus);
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
