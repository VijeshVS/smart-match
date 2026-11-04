import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';
import { loadSecret } from '@talent-ai/observability/secrets';

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
  API_GATEWAY_PORT: z.coerce.number().int().positive().default(8080),
  PORT: z.coerce.number().int().positive().optional(),
  LOG_LEVEL: z.string().default('info'),
  TRUST_PROXY: booleanFromEnv(false),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: secretFromEnv('JWT_ACCESS_SECRET'),
  JWT_ISSUER: z.string().min(1).default('talent.ai'),
  JWT_AUDIENCE: z.string().min(1).default('talent.ai'),

  AUTH_SERVICE_URL: z.string().url().default('http://localhost:5001'),
  TALENT_SERVICE_URL: z.string().url().default('http://localhost:5002'),
  RECRUITER_SERVICE_URL: z.string().url().default('http://localhost:5003'),
  ENGAGEMENT_SERVICE_URL: z.string().url().default('http://localhost:5004'),
  REWARDS_SERVICE_URL: z.string().url().default('http://localhost:5005'),
  AI_MATCHING_SERVICE_URL: z.string().url().default('http://localhost:5006'),
  NOTIFICATION_SERVICE_URL: z.string().url().default('http://localhost:5007'),
  ANALYTICS_SERVICE_URL: z.string().url().default('http://localhost:5008'),

  RATE_LIMIT_GENERAL_PER_MINUTE: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_SENSITIVE_PER_MINUTE: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_FAIL_OPEN: booleanFromEnv(true),

  PROXY_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  CIRCUIT_RESET_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

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
  throw new Error(`Invalid api-gateway configuration:\n${issues}`);
}

const raw = env.data;

if (raw.NODE_ENV === 'production' && raw.JWT_ACCESS_SECRET.includes('change-me')) {
  throw new Error('Production JWT_ACCESS_SECRET must not use the development placeholder');
}

export const config = Object.freeze({
  serviceName: 'api-gateway',
  version: '0.1.0',
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  port: raw.API_GATEWAY_PORT,
  logLevel: raw.LOG_LEVEL,
  trustProxy: raw.TRUST_PROXY,
  otel: Object.freeze({
    enabled: raw.OTEL_ENABLED,
    endpoint: raw.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  redisUrl: raw.REDIS_URL,
  jwt: Object.freeze({
    accessSecret: raw.JWT_ACCESS_SECRET,
    issuer: raw.JWT_ISSUER,
    audience: raw.JWT_AUDIENCE,
  }),
  services: Object.freeze({
    auth: raw.AUTH_SERVICE_URL,
    talent: raw.TALENT_SERVICE_URL,
    recruiter: raw.RECRUITER_SERVICE_URL,
    engagement: raw.ENGAGEMENT_SERVICE_URL,
    rewards: raw.REWARDS_SERVICE_URL,
    ai: raw.AI_MATCHING_SERVICE_URL,
    notification: raw.NOTIFICATION_SERVICE_URL,
    analytics: raw.ANALYTICS_SERVICE_URL,
  }),
  rateLimit: Object.freeze({
    generalPerMinute: raw.RATE_LIMIT_GENERAL_PER_MINUTE,
    sensitivePerMinute: raw.RATE_LIMIT_SENSITIVE_PER_MINUTE,
    failOpen: raw.RATE_LIMIT_FAIL_OPEN,
  }),
  proxy: Object.freeze({
    timeoutMs: raw.PROXY_TIMEOUT_MS,
    failureThreshold: raw.CIRCUIT_FAILURE_THRESHOLD,
    resetTimeoutMs: raw.CIRCUIT_RESET_TIMEOUT_MS,
  }),
  corsOrigins: raw.CORS_ORIGINS,
});

export type GatewayConfig = typeof config;
