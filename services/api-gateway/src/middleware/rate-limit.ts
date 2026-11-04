import type { Request, RequestHandler } from 'express';
import { sendError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';

export type RateLimitBucket = 'general' | 'sensitive';

/**
 * Atomic Redis token bucket.
 *
 * KEYS[1] = bucket key
 * ARGV[1] = now (epoch ms)  ARGV[2] = capacity
 * ARGV[3] = refill per ms   ARGV[4] = cost
 * ARGV[5] = key TTL (ms)
 *
 * Returns { allowed (0|1), remaining tokens, wait ms when denied }.
 */
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_per_ms = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local ttl_ms = tonumber(ARGV[5])

local bucket = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(bucket[1])
local ts = tonumber(bucket[2])

if tokens == nil or ts == nil then
  tokens = capacity
  ts = now
end

local elapsed = now - ts
if elapsed < 0 then elapsed = 0 end
tokens = math.min(capacity, tokens + elapsed * refill_per_ms)

local allowed = 0
local wait_ms = 0

if tokens >= cost then
  allowed = 1
  tokens = tokens - cost
else
  wait_ms = math.ceil((cost - tokens) / refill_per_ms)
end

redis.call('HSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, ttl_ms)

return { allowed, math.floor(tokens), wait_ms }
`;

const KEY_TTL_MS = 120_000;

export interface RateLimiterOptions {
  bucket: RateLimitBucket;
  limitPerMinute: number;
  failOpen: boolean;
  /** Stable identity for the bucket, e.g. user id or client ip. */
  keyResolver: (req: Request) => string;
}

export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const capacity = options.limitPerMinute;
  const refillPerMs = capacity / 60_000;

  return (req, res, next) => {
    void (async () => {
      const identity = options.keyResolver(req) || 'anonymous';
      const key = `talent:gateway:ratelimit:${options.bucket}:${identity}`;

      try {
        const result = (await redis.eval(
          TOKEN_BUCKET_SCRIPT,
          1,
          key,
          String(Date.now()),
          String(capacity),
          String(refillPerMs),
          '1',
          String(KEY_TTL_MS),
        )) as [number, number, number];

        const allowed = Number(result[0]) === 1;
        const remaining = Math.max(0, Number(result[1]) || 0);
        const waitMs = Math.max(0, Number(result[2]) || 0);

        res.setHeader('RateLimit-Limit', String(capacity));
        res.setHeader('RateLimit-Remaining', String(remaining));
        res.setHeader('RateLimit-Policy', `${capacity};w=60`);

        if (allowed) {
          res.setHeader(
            'RateLimit-Reset',
            String(Math.ceil((capacity - remaining) / refillPerMs / 1000)),
          );
          next();
          return;
        }

        const retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.setHeader('RateLimit-Reset', String(retryAfterSeconds));

        sendError(
          res,
          429,
          'RATE_LIMIT_EXCEEDED',
          `Rate limit exceeded for ${options.bucket} routes. Retry in ${retryAfterSeconds}s.`,
          { retryAfterSeconds, bucket: options.bucket },
        );
      } catch (error) {
        logger.warn({ err: error, bucket: options.bucket, identity }, 'rate limiter unavailable');

        if (options.failOpen) {
          next();
          return;
        }

        sendError(res, 503, 'RATE_LIMITER_UNAVAILABLE', 'Rate limiting is temporarily unavailable');
      }
    })();
  };
}
