import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';
import { loadSecret } from '@talent-ai/observability/secrets';

// Load `services/talent-service/.env` first, then the repository root `.env`.
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

/** URI-shaped secret loaded through `loadSecret` (no minimum length). */
function uriFromEnv(name: string) {
  return z.preprocess(
    () => loadSecret(name),
    z.string().min(1, `${name} or ${name}_FILE is required`),
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
  PORT: z.coerce.number().int().positive().default(5002),
  LOG_LEVEL: z.string().default('info'),
  TRUST_PROXY: booleanFromEnv(false),

  // MongoDB is the talent profile aggregate's only datastore.
  MONGODB_URI: uriFromEnv('MONGODB_URI'),
  MONGODB_DB: z.string().min(1).default('talent_profiles'),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().positive().max(100).default(10),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

  RABBITMQ_URL: z.string().min(1).default('amqp://talent:talent@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('talent.events.topic'),

  // Synchronous dependency used to hide already-screened candidates from the
  // blind Talent Swipe queue.
  ENGAGEMENT_SERVICE_URL: z.string().url().default('http://localhost:5004'),
  ENGAGEMENT_TIMEOUT_MS: z.coerce.number().int().positive().max(30_000).default(3_000),

  // Access tokens are verified when a service is called directly (bypassing
  // the gateway). The gateway injects identity headers after verification.
  JWT_ACCESS_SECRET: secretFromEnv('JWT_ACCESS_SECRET'),
  JWT_ISSUER: z.string().min(1).default('talent.ai'),
  JWT_AUDIENCE: z.string().min(1).default('talent.ai'),
  TRUST_GATEWAY_HEADERS: booleanFromEnv(true),

  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2_000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().max(100).default(25),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),

  CORS_ORIGINS: csv,

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
  throw new Error(`Invalid talent-service configuration:\n${issues}`);
}

const raw = env.data;

if (raw.NODE_ENV === 'production' && raw.JWT_ACCESS_SECRET.includes('change-me')) {
  throw new Error('Production JWT_ACCESS_SECRET must not use the development placeholder');
}

export const config = Object.freeze({
  serviceName: 'talent-service',
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
  mongo: Object.freeze({
    uri: raw.MONGODB_URI,
    dbName: raw.MONGODB_DB,
    maxPoolSize: raw.MONGODB_MAX_POOL_SIZE,
    serverSelectionTimeoutMs: raw.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  }),
  rabbitmq: Object.freeze({
    url: raw.RABBITMQ_URL,
    exchange: raw.RABBITMQ_EXCHANGE,
  }),
  engagement: Object.freeze({
    url: raw.ENGAGEMENT_SERVICE_URL.replace(/\/+$/, ''),
    timeoutMs: raw.ENGAGEMENT_TIMEOUT_MS,
  }),
  jwt: Object.freeze({
    accessSecret: raw.JWT_ACCESS_SECRET,
    issuer: raw.JWT_ISSUER,
    audience: raw.JWT_AUDIENCE,
  }),
  trustGatewayHeaders: raw.TRUST_GATEWAY_HEADERS,
  outbox: Object.freeze({
    pollIntervalMs: raw.OUTBOX_POLL_INTERVAL_MS,
    batchSize: raw.OUTBOX_BATCH_SIZE,
    maxAttempts: raw.OUTBOX_MAX_ATTEMPTS,
  }),
  corsOrigins: raw.CORS_ORIGINS,
});

export type AppConfig = typeof config;
