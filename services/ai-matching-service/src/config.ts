import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';
import { loadSecret } from '@talent-ai/observability/secrets';
import type { AiEngine, LLMProvider } from '@talent-ai/shared-types';

// Load `services/ai-matching-service/.env` first, then the repository root `.env`.
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

/** Optional secret loaded through `loadSecret`; empty values become undefined. */
function optionalSecret(name: string) {
  return z.preprocess(() => loadSecret(name), z.string().min(1).optional());
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
  PORT: z.coerce.number().int().positive().default(5006),
  LOG_LEVEL: z.string().default('info'),
  TRUST_PROXY: booleanFromEnv(false),

  // Qdrant owns the dense candidate vectors; Redis owns response caching.
  QDRANT_URL: z.string().url().default('http://localhost:6333'),
  QDRANT_COLLECTION: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9_-]+$/, 'QDRANT_COLLECTION may only contain letters, numbers, - and _')
    .default('talent_profiles'),
  QDRANT_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  QDRANT_API_KEY: optionalSecret('QDRANT_API_KEY'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  RABBITMQ_URL: z.string().min(1).default('amqp://talent:talent@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().min(1).default('talent.events.topic'),

  // Access tokens are verified when a service is called directly (bypassing
  // the gateway). The gateway injects identity headers after verification.
  JWT_ACCESS_SECRET: secretFromEnv('JWT_ACCESS_SECRET'),
  JWT_ISSUER: z.string().min(1).default('talent.ai'),
  JWT_AUDIENCE: z.string().min(1).default('talent.ai'),
  TRUST_GATEWAY_HEADERS: booleanFromEnv(true),

  AI_PROVIDER: z.enum(['auto', 'groq', 'gemini', 'openai', 'local']).default('auto'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  AI_MAX_CONCURRENCY: z.coerce.number().int().positive().max(16).default(4),
  AI_MAX_RERANK: z.coerce.number().int().positive().max(50).default(12),
  AI_CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(3),
  AI_CIRCUIT_RESET_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  AI_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
  AI_HIGH_AFFINITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  AI_MIN_MATCH_SCORE: z.coerce.number().min(0).max(1).default(0.2),

  GROQ_API_KEY: optionalSecret('GROQ_API_KEY'),
  GROQ_MODEL: z.string().min(1).default('openai/gpt-oss-120b'),
  GEMINI_API_KEY: optionalSecret('GEMINI_API_KEY'),
  GEMINI_MODEL: z.string().min(1).default('gemini-1.5-flash'),
  OPENAI_API_KEY: optionalSecret('OPENAI_API_KEY'),
  OPENAI_MODEL: z.string().min(1).default('gpt-4o-mini'),

  EMBEDDING_PROVIDER: z.enum(['local', 'openai', 'gemini']).default('local'),
  EMBEDDING_MODEL: z.string().min(1).optional(),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().min(32).max(3_072).default(384),

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
  throw new Error(`Invalid ai-matching-service configuration:\n${issues}`);
}

const raw = env.data;

if (raw.NODE_ENV === 'production' && raw.JWT_ACCESS_SECRET.includes('change-me')) {
  throw new Error('Production JWT_ACCESS_SECRET must not use the development placeholder');
}

const providerKeys: Record<LLMProvider, string | undefined> = {
  groq: raw.GROQ_API_KEY,
  gemini: raw.GEMINI_API_KEY,
  openai: raw.OPENAI_API_KEY,
};

function resolveAiProvider(): AiEngine {
  if (raw.AI_PROVIDER === 'local') return 'local';
  if (raw.AI_PROVIDER === 'auto') {
    if (providerKeys.groq) return 'groq';
    if (providerKeys.gemini) return 'gemini';
    if (providerKeys.openai) return 'openai';
    return 'local';
  }

  if (!providerKeys[raw.AI_PROVIDER]) {
    throw new Error(
      `AI_PROVIDER=${raw.AI_PROVIDER} requires ${raw.AI_PROVIDER.toUpperCase()}_API_KEY`,
    );
  }

  return raw.AI_PROVIDER;
}

const aiProvider = resolveAiProvider();

if (raw.EMBEDDING_PROVIDER !== 'local' && !providerKeys[raw.EMBEDDING_PROVIDER]) {
  throw new Error(
    `EMBEDDING_PROVIDER=${raw.EMBEDDING_PROVIDER} requires ` +
      `${raw.EMBEDDING_PROVIDER.toUpperCase()}_API_KEY`,
  );
}

export const config = Object.freeze({
  serviceName: 'ai-matching-service',
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
  qdrant: Object.freeze({
    url: raw.QDRANT_URL.replace(/\/+$/, ''),
    collection: raw.QDRANT_COLLECTION,
    timeoutMs: raw.QDRANT_TIMEOUT_MS,
    apiKey: raw.QDRANT_API_KEY,
  }),
  redisUrl: raw.REDIS_URL,
  rabbitmq: Object.freeze({
    url: raw.RABBITMQ_URL,
    exchange: raw.RABBITMQ_EXCHANGE,
  }),
  jwt: Object.freeze({
    accessSecret: raw.JWT_ACCESS_SECRET,
    issuer: raw.JWT_ISSUER,
    audience: raw.JWT_AUDIENCE,
  }),
  trustGatewayHeaders: raw.TRUST_GATEWAY_HEADERS,
  ai: Object.freeze({
    /** Configured primary engine; may be the deterministic local engine. */
    provider: aiProvider,
    timeoutMs: raw.AI_REQUEST_TIMEOUT_MS,
    maxConcurrency: raw.AI_MAX_CONCURRENCY,
    maxRerank: raw.AI_MAX_RERANK,
    circuitFailureThreshold: raw.AI_CIRCUIT_FAILURE_THRESHOLD,
    circuitResetTimeoutMs: raw.AI_CIRCUIT_RESET_TIMEOUT_MS,
    cacheTtlSeconds: raw.AI_CACHE_TTL_SECONDS,
    highAffinityThreshold: raw.AI_HIGH_AFFINITY_THRESHOLD,
    minMatchScore: raw.AI_MIN_MATCH_SCORE,
  }),
  providers: Object.freeze({
    groq: Object.freeze({
      apiKey: providerKeys.groq,
      model: raw.GROQ_MODEL,
    }),
    gemini: Object.freeze({
      apiKey: providerKeys.gemini,
      model: raw.GEMINI_MODEL,
    }),
    openai: Object.freeze({
      apiKey: providerKeys.openai,
      model: raw.OPENAI_MODEL,
    }),
  }),
  embedding: Object.freeze({
    provider: raw.EMBEDDING_PROVIDER,
    model:
      raw.EMBEDDING_MODEL ??
      (raw.EMBEDDING_PROVIDER === 'openai'
        ? 'text-embedding-3-small'
        : raw.EMBEDDING_PROVIDER === 'gemini'
          ? 'text-embedding-004'
          : 'local-hash'),
    dimensions: raw.EMBEDDING_DIMENSIONS,
  }),
  corsOrigins: raw.CORS_ORIGINS,
});

export type AppConfig = typeof config;
