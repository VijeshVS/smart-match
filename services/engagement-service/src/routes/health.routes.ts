import { Router } from 'express';
import type { HealthStatus } from '@talent-ai/shared-types';
import { config } from '../config.js';
import { eventBus } from '../lib/event-bus.js';
import { prisma } from '../lib/prisma.js';

export const healthRouter: Router = Router();

async function databaseCheck(): Promise<'up' | 'down'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'up';
  } catch {
    return 'down';
  }
}

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
  const database = await databaseCheck();
  const rabbitmq = eventBus.isConnected ? 'up' : 'down';

  const checks: HealthStatus['checks'] = { database, rabbitmq };
  const criticalDown = database === 'down';
  const status: HealthStatus['status'] = criticalDown
    ? 'down'
    : rabbitmq === 'down'
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
