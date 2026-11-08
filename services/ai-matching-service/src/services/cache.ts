import { createHash } from 'node:crypto';
import { getServiceMetrics } from '@talent-ai/observability/metrics';
import type { Redis } from 'ioredis';
import { config } from '../config.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

const { domain } = getServiceMetrics(config.serviceName);

/** `ai-matching:v1:<namespace>:<digest>` → `<namespace>`. */
function cacheNamespace(key: string): string {
  return key.split(':')[2] ?? 'unknown';
}

/** Deterministic JSON so cache keys do not depend on object key order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);

  return `{${entries.join(',')}}`;
}

export function cacheKey(namespace: string, payload: unknown): string {
  const digest = createHash('sha256').update(stableStringify(payload)).digest('hex');
  return `ai-matching:v1:${namespace}:${digest}`;
}

export class ResponseCache {
  constructor(private readonly client: Redis) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.client.get(key);
      domain.aiCacheRequests.inc({
        cache: cacheNamespace(key),
        result: value ? 'hit' : 'miss',
      });
      return value ? (JSON.parse(value) as T) : undefined;
    } catch (error) {
      domain.aiCacheRequests.inc({ cache: cacheNamespace(key), result: 'error' });
      logger.warn({ err: error }, 'redis cache read failed; continuing without cache');
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      logger.warn({ err: error }, 'redis cache write failed; continuing without cache');
    }
  }

  async health(): Promise<'up' | 'down'> {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}

export const responseCache = new ResponseCache(redis);
