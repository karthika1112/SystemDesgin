export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: CircuitBreakerState = 'CLOSED';

  constructor(
    private failureThreshold: number = 3,
    private resetTimeoutMs: number = 10000
  ) {}

  async execute<T>(action: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('CIRCUIT_OPEN: External service is currently unreachable.');
      }
    }

    try {
      const result = await action();
      this.reset();
      return result;
    } catch (err: any) {
      this.recordFailure();
      throw err;
    }
  }

  private recordFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastFailureTime = Date.now();
      console.warn(`[CIRCUIT BREAKER] Tripped OPEN! Threshold (${this.failureThreshold}) exceeded.`);
    }
  }

  private reset() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
}

// Singleton instance protecting the payment gateway
export const paymentCircuitBreaker = new CircuitBreaker(3, 15000);
