import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from '../src/lib/circuit-breaker.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('CircuitBreaker', () => {
  it('opens after the configured number of failures', () => {
    const breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 2,
      resetTimeoutMs: 10_000,
    });

    expect(breaker.canRequest()).toBe(true);
    breaker.recordFailure();
    expect(breaker.currentState).toBe('CLOSED');

    breaker.recordFailure();
    expect(breaker.currentState).toBe('OPEN');
    expect(breaker.canRequest()).toBe(false);
    expect(breaker.remainingCooldownMs()).toBeGreaterThan(0);
  });

  it('allows one half-open trial and closes on success', async () => {
    const breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 1,
      resetTimeoutMs: 20,
    });

    breaker.recordFailure();
    expect(breaker.canRequest()).toBe(false);

    await delay(30);
    expect(breaker.canRequest()).toBe(true);
    expect(breaker.canRequest()).toBe(false);

    breaker.recordSuccess();
    expect(breaker.currentState).toBe('CLOSED');
    expect(breaker.canRequest()).toBe(true);
  });

  it('re-opens when the half-open trial fails', async () => {
    const breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 1,
      resetTimeoutMs: 20,
    });

    breaker.recordFailure();
    await delay(30);
    expect(breaker.canRequest()).toBe(true);

    breaker.recordFailure();
    expect(breaker.currentState).toBe('OPEN');
    expect(breaker.canRequest()).toBe(false);
  });
});
