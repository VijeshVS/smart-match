import { afterEach, describe, expect, it, vi } from 'vitest';
import { CircuitBreaker } from '../src/lib/circuit-breaker.js';

const options = {
  name: 'talent-service',
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
};

afterEach(() => {
  vi.useRealTimers();
});

describe('CircuitBreaker', () => {
  it('stays closed while requests succeed', () => {
    const breaker = new CircuitBreaker(options);
    breaker.recordSuccess();
    expect(breaker.canRequest()).toBe(true);
    expect(breaker.snapshot().state).toBe('CLOSED');
  });

  it('opens after the failure threshold and fails fast', () => {
    const breaker = new CircuitBreaker(options);
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.canRequest()).toBe(true);

    breaker.recordFailure();
    expect(breaker.snapshot().state).toBe('OPEN');
    expect(breaker.canRequest()).toBe(false);
    expect(breaker.remainingCooldownMs()).toBeGreaterThan(0);
  });

  it('admits a single probe after the cooldown and closes on success', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const breaker = new CircuitBreaker(options);
    for (let attempt = 0; attempt < options.failureThreshold; attempt += 1) {
      breaker.recordFailure();
    }
    expect(breaker.canRequest()).toBe(false);

    vi.advanceTimersByTime(options.resetTimeoutMs + 1);
    expect(breaker.canRequest()).toBe(true);
    expect(breaker.snapshot().state).toBe('HALF_OPEN');

    // No second probe while the first is still in flight.
    expect(breaker.canRequest()).toBe(false);

    breaker.recordSuccess();
    expect(breaker.snapshot().state).toBe('CLOSED');
    expect(breaker.canRequest()).toBe(true);
  });

  it('re-opens when the half-open probe fails', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const breaker = new CircuitBreaker(options);
    for (let attempt = 0; attempt < options.failureThreshold; attempt += 1) {
      breaker.recordFailure();
    }

    vi.advanceTimersByTime(options.resetTimeoutMs + 1);
    expect(breaker.canRequest()).toBe(true);
    breaker.recordFailure();

    expect(breaker.snapshot().state).toBe('OPEN');
    expect(breaker.canRequest()).toBe(false);
  });
});
