import { Redis } from 'ioredis';
import { config } from '../config.js';
import { logger } from './logger.js';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  retryStrategy(times) {
    return Math.min(times * 250, 5_000);
  },
});

redis.on('error', (error) => {
  logger.error({ err: error }, 'redis error');
});
