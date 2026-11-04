import { Router } from 'express';
import type { HealthStatus } from '@talent-ai/shared-types';
import { config } from '../config.js';
import { circuitBreakers } from '../proxy/routes.js';
import { redis } from '../lib/redis.js';

export const healthRouter: Router = Router();

async function redisCheck(): Promise<'up' | 'down'> {
  try {
    return (await redis.ping()) === 'PONG' ? 'up' : 'down';
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
  const redisState = await redisCheck();
  const checks: HealthStatus['checks'] = { redis: redisState };

  const payload = {
    status: redisState === 'up' ? 'ok' : 'down',
    service: config.serviceName,
    version: config.version,
    uptimeSeconds: Math.floor(process.uptime()),
    checks,
    circuits: circuitBreakers.map((breaker) => breaker.snapshot()),
    timestamp: new Date().toISOString(),
  } satisfies HealthStatus & { circuits: unknown };

  res.status(redisState === 'up' ? 200 : 503).json(payload);
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
