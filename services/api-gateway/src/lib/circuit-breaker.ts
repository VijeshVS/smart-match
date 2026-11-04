export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;
  resetTimeoutMs: number;
}

/**
 * Lightweight in-process circuit breaker around a downstream proxy route.
 *
 * CLOSED    — traffic flows; consecutive failures are counted.
 * OPEN      — requests fail fast until the cooldown elapses.
 * HALF_OPEN — exactly one probe is admitted; success closes, failure re-opens.
 */
export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private nextAttemptAt = 0;
  private halfOpenProbeInFlight = false;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold;
    this.resetTimeoutMs = options.resetTimeoutMs;
  }

  canRequest(): boolean {
    if (this.state === 'CLOSED') return true;

    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptAt) return false;
      this.state = 'HALF_OPEN';
      this.halfOpenProbeInFlight = false;
    }

    if (this.halfOpenProbeInFlight) return false;
    this.halfOpenProbeInFlight = true;
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.halfOpenProbeInFlight = false;
  }

  recordFailure(): void {
    this.halfOpenProbeInFlight = false;
    this.consecutiveFailures += 1;

    if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptAt = Date.now() + this.resetTimeoutMs;
    }
  }

  remainingCooldownMs(): number {
    if (this.state !== 'OPEN') return 0;
    return Math.max(0, this.nextAttemptAt - Date.now());
  }

  snapshot(): { name: string; state: CircuitState; consecutiveFailures: number } {
    return {
      name: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
    };
  }
}
