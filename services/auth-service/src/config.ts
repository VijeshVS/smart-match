import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';
import { loadSecret } from '@talent-ai/observability/secrets';

// Load `services/auth-service/.env` first, then the repository root `.env`.
// Both are optional; environment variables always take precedence.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: [path.resolve(currentDir, '../.env'), path.resolve(currentDir, '../../../.env')],
});

function booleanFromEnv(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === undefined || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return value;
  }, z.boolean());
}

/** Accepts `<NAME>` or a Docker/Kubernetes secret mounted at `<NAME>_FILE`. */
function secretFromEnv(name: string) {
  return z.preprocess(
    () => loadSecret(name),
    z.string().min(32, `${name} must be at least 32 characters`),
  );
}

const csv = z
  .string()
  .default('http://localhost:3000,http://localhost:3001')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5001),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  RABBITMQ_URL: z.string().min(1).default('amqp://talent:talent@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('talent.events.topic'),

  JWT_ACCESS_SECRET: secretFromEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: secretFromEnv('JWT_REFRESH_SECRET'),
  JWT_ISSUER: z.string().min(1).default('talent.ai'),
  JWT_AUDIENCE: z.string().min(1).default('talent.ai'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60),

  COOKIE_NAME: z.string().min(1).default('talent_ai_refresh'),
  COOKIE_PATH: z.string().min(1).default('/api/v1/auth'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_SECURE: booleanFromEnv(false),
  COOKIE_DOMAIN: z
    .string()
    .optional()
    .transform((value) => (value?.trim() ? value.trim() : undefined)),

  ARGON2_MEMORY_KIB: z.coerce.number().int().positive().default(19_456),
  ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),

  CORS_ORIGINS: csv,
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2_000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().max(100).default(25),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),

  TRUST_PROXY: booleanFromEnv(false),

  OTEL_ENABLED: booleanFromEnv(true),
  OTEL_EXPORTER_OTLP_ENDPOINT: z
    .string()
    .optional()
    .transform((value) => (value?.trim() ? value.trim() : undefined)),
});

const env = envSchema.safeParse(process.env);

if (!env.success) {
  const issues = env.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid auth-service configuration:\n${issues}`);
}

const raw = env.data;

if (raw.NODE_ENV === 'production') {
  if (raw.JWT_ACCESS_SECRET.includes('change-me') || raw.JWT_REFRESH_SECRET.includes('change-me')) {
    throw new Error('Production JWT secrets must not use the development placeholders');
  }
  if (raw.COOKIE_SAME_SITE === 'none' && !raw.COOKIE_SECURE) {
    throw new Error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
  }
}

export const config = Object.freeze({
  serviceName: 'auth-service',
  version: '0.1.0',
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  port: raw.PORT,
  logLevel: raw.LOG_LEVEL,
  trustProxy: raw.TRUST_PROXY,
  otel: Object.freeze({
    enabled: raw.OTEL_ENABLED,
    endpoint: raw.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  databaseUrl: raw.DATABASE_URL,
  redisUrl: raw.REDIS_URL,
  rabbitmq: Object.freeze({
    url: raw.RABBITMQ_URL,
    exchange: raw.RABBITMQ_EXCHANGE,
  }),
  jwt: Object.freeze({
    accessSecret: raw.JWT_ACCESS_SECRET,
    refreshSecret: raw.JWT_REFRESH_SECRET,
    issuer: raw.JWT_ISSUER,
    audience: raw.JWT_AUDIENCE,
    accessTokenTtlSeconds: raw.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: raw.REFRESH_TOKEN_TTL_SECONDS,
  }),
  cookie: Object.freeze({
    name: raw.COOKIE_NAME,
    path: raw.COOKIE_PATH,
    sameSite: raw.COOKIE_SAME_SITE,
    secure: raw.COOKIE_SECURE,
    domain: raw.COOKIE_DOMAIN,
    maxAgeMs: raw.REFRESH_TOKEN_TTL_SECONDS * 1000,
  }),
  argon2: Object.freeze({
    memoryCost: raw.ARGON2_MEMORY_KIB,
    timeCost: raw.ARGON2_TIME_COST,
    parallelism: raw.ARGON2_PARALLELISM,
  }),
  corsOrigins: raw.CORS_ORIGINS,
  outbox: Object.freeze({
    pollIntervalMs: raw.OUTBOX_POLL_INTERVAL_MS,
    batchSize: raw.OUTBOX_BATCH_SIZE,
    maxAttempts: raw.OUTBOX_MAX_ATTEMPTS,
  }),
});

export type AppConfig = typeof config;
