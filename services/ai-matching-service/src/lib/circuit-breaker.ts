export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;
  resetTimeoutMs: number;
}

/**
 * Small single-process circuit breaker for outbound AI provider calls.
 *
 * Closed: requests pass through. After `failureThreshold` consecutive failures
 * the breaker opens and requests fail fast for `resetTimeoutMs`. It then allows
 * one half-open trial; a success closes it and a failure re-opens it.
 */
export class CircuitBreaker {
  readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private openedAt = 0;
  private halfOpenInFlight = false;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold;
    this.resetTimeoutMs = options.resetTimeoutMs;
  }

  get currentState(): CircuitState {
    this.refreshState();
    return this.state;
  }

  get consecutiveFailures(): number {
    return this.failures;
  }

  /** Returns true when a request may be attempted. */
  canRequest(): boolean {
    this.refreshState();

    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') return false;

    // HALF_OPEN: allow exactly one trial request at a time.
    if (this.halfOpenInFlight) return false;
    this.halfOpenInFlight = true;
    return true;
  }

  recordSuccess(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.halfOpenInFlight = false;
  }

  recordFailure(): void {
    this.failures += 1;
    this.halfOpenInFlight = false;

    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }

  remainingCooldownMs(): number {
    this.refreshState();
    if (this.state !== 'OPEN') return 0;
    return Math.max(0, this.openedAt + this.resetTimeoutMs - Date.now());
  }

  private refreshState(): void {
    if (
      this.state === 'OPEN' &&
      this.openedAt > 0 &&
      Date.now() - this.openedAt >= this.resetTimeoutMs
    ) {
      this.state = 'HALF_OPEN';
      this.halfOpenInFlight = false;
    }
  }
}
