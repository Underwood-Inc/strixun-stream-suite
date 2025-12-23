/**
 * API Framework - Circuit Breaker
 * 
 * Circuit breaker pattern to prevent cascading failures
 */

import type { CircuitBreakerConfig, CircuitBreakerState, CircuitState } from '../types';

export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: Required<CircuitBreakerConfig>;
  private successCount = 0;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      resetTimeout: config.resetTimeout || 60000, // 1 minute
      monitoringPeriod: config.monitoringPeriod || 60000, // 1 minute
    };

    this.state = {
      state: 'closed',
      failures: 0,
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    key?: string
  ): Promise<T> {
    // Check circuit state
    if (this.state.state === 'open') {
      // Check if we should attempt to close
      if (this.shouldAttemptReset()) {
        this.state.state = 'half-open';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    if (this.state.state === 'half-open') {
      this.successCount++;
      // If we have enough successes, close the circuit
      if (this.successCount >= 2) {
        this.state.state = 'closed';
        this.state.failures = 0;
        this.state.lastFailureTime = undefined;
        this.state.nextAttemptTime = undefined;
      }
    } else {
      // Reset failure count on success
      this.state.failures = 0;
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();

    if (this.state.state === 'half-open') {
      // If we fail in half-open, go back to open
      this.state.state = 'open';
      this.state.nextAttemptTime = Date.now() + this.config.resetTimeout;
    } else if (this.state.failures >= this.config.failureThreshold) {
      // Open the circuit
      this.state.state = 'open';
      this.state.nextAttemptTime = Date.now() + this.config.resetTimeout;
    }
  }

  /**
   * Check if we should attempt to reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.state.nextAttemptTime) {
      return true;
    }
    return Date.now() >= this.state.nextAttemptTime;
  }

  /**
   * Get current state
   */
  getState(): Readonly<CircuitBreakerState> {
    return { ...this.state };
  }

  /**
   * Manually reset circuit breaker
   */
  reset(): void {
    this.state = {
      state: 'closed',
      failures: 0,
    };
    this.successCount = 0;
  }

  /**
   * Manually open circuit breaker
   */
  open(): void {
    this.state.state = 'open';
    this.state.nextAttemptTime = Date.now() + this.config.resetTimeout;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state.state === 'open';
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state.state === 'half-open';
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state.state === 'closed';
  }
}

