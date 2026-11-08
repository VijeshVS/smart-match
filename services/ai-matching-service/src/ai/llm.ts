import { getServiceMetrics } from '@talent-ai/observability/metrics';
import type { AiEngine, LLMProvider } from '@talent-ai/shared-types';
import type { ZodType } from 'zod';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { CircuitBreaker } from '../lib/circuit-breaker.js';
import { createLlmClients, ProviderError } from './providers.js';
import type { LlmAnswer, LlmClient } from './types.js';

const { domain } = getServiceMetrics(config.serviceName);

const CIRCUIT_STATE_VALUES = {
  CLOSED: 0,
  HALF_OPEN: 1,
  OPEN: 2,
} as const;

export interface GenerateJsonOptions<T> {
  system: string;
  prompt: string;
  schema: ZodType<T>;
  /** Deterministic answer used when the provider is unavailable. */
  fallback: () => T;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Extracts a JSON value from a provider response. Providers occasionally wrap
 * JSON in markdown fences or add a sentence before it, so parsing is defensive.
 */
export function extractJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to the first balanced object / array.
  }

  const objectStart = trimmed.indexOf('{');
  const arrayStart = trimmed.indexOf('[');
  const start =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);

  if (start === -1) {
    throw new Error('Provider response did not contain JSON');
  }

  const opening = trimmed[start];
  const closing = opening === '{' ? '}' : ']';
  const end = trimmed.lastIndexOf(closing);
  if (end <= start) {
    throw new Error('Provider response contained malformed JSON');
  }

  return JSON.parse(trimmed.slice(start, end + 1));
}

/**
 * Provider-agnostic LLM gateway with a circuit breaker and deterministic
 * fallback. Every operation supplies its own fallback so a rate-limited or
 * misconfigured provider never turns into a user-facing failure.
 */
export class LlmService {
  readonly primary: AiEngine;
  private readonly clients: Map<LLMProvider, LlmClient>;
  private readonly breaker: CircuitBreaker;

  constructor(options: {
    primary: AiEngine;
    clients: Map<LLMProvider, LlmClient>;
    failureThreshold: number;
    resetTimeoutMs: number;
  }) {
    this.primary = options.primary;
    this.clients = options.clients;
    this.breaker = new CircuitBreaker({
      name: 'llm-provider',
      failureThreshold: options.failureThreshold,
      resetTimeoutMs: options.resetTimeoutMs,
    });
  }

  get provider(): AiEngine {
    return this.primary;
  }

  get circuitState(): string {
    return this.breaker.currentState;
  }

  private syncCircuitMetric(): void {
    domain.aiCircuitState.set(
      { breaker: this.breaker.name },
      CIRCUIT_STATE_VALUES[this.breaker.currentState],
    );
  }

  async generateJson<T>(options: GenerateJsonOptions<T>): Promise<LlmAnswer<T>> {
    if (this.primary === 'local') {
      domain.aiProviderRequests.inc({ provider: 'local', outcome: 'skipped' });
      this.syncCircuitMetric();
      return { value: options.fallback(), provider: 'local', fallback: false };
    }

    if (!this.breaker.canRequest()) {
      domain.aiProviderRequests.inc({ provider: this.primary, outcome: 'circuit_open' });
      this.syncCircuitMetric();
      logger.warn(
        { provider: this.primary, circuit: this.breaker.currentState },
        'AI provider circuit open; using deterministic fallback',
      );
      return { value: options.fallback(), provider: 'local', fallback: true };
    }

    const client = this.clients.get(this.primary);
    if (!client) {
      domain.aiProviderRequests.inc({ provider: this.primary, outcome: 'unconfigured' });
      this.syncCircuitMetric();
      return { value: options.fallback(), provider: 'local', fallback: true };
    }

    const startedAt = process.hrtime.bigint();
    try {
      const text = await client.complete({
        system: options.system,
        prompt: options.prompt,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });
      const parsed = options.schema.parse(extractJson(text));
      this.breaker.recordSuccess();
      domain.aiProviderRequests.inc({ provider: this.primary, outcome: 'success' });
      domain.aiProviderDuration.observe(
        { provider: this.primary, outcome: 'success' },
        Number(process.hrtime.bigint() - startedAt) / 1e9,
      );
      this.syncCircuitMetric();
      return { value: parsed, provider: this.primary, fallback: false };
    } catch (error) {
      this.breaker.recordFailure();
      domain.aiProviderRequests.inc({ provider: this.primary, outcome: 'error' });
      domain.aiProviderDuration.observe(
        { provider: this.primary, outcome: 'error' },
        Number(process.hrtime.bigint() - startedAt) / 1e9,
      );
      this.syncCircuitMetric();
      logger.warn(
        {
          err: error,
          provider: this.primary,
          retryable: error instanceof ProviderError ? error.retryable : undefined,
          consecutiveFailures: this.breaker.consecutiveFailures,
        },
        'AI provider call failed; using deterministic fallback',
      );
      return { value: options.fallback(), provider: 'local', fallback: true };
    }
  }
}

export const llm = new LlmService({
  primary: config.ai.provider,
  clients: createLlmClients(),
  failureThreshold: config.ai.circuitFailureThreshold,
  resetTimeoutMs: config.ai.circuitResetTimeoutMs,
});
