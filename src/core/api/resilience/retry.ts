/**
 * API Framework - Retry Manager
 * 
 * Automatic retry with exponential backoff and configurable strategies
 */

import type { APIRequest, APIResponse, APIError, RetryConfig, RetryState } from '../types';
import { isRetryableError } from '../utils/response-handler';

export class RetryManager {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig = {}) {
    this.config = {
      maxAttempts: config.maxAttempts || 3,
      backoff: config.backoff || 'exponential',
      initialDelay: config.initialDelay || 1000,
      maxDelay: config.maxDelay || 10000,
      retryableErrors: config.retryableErrors || [408, 429, 500, 502, 503, 504],
      retryable: config.retryable || ((error: APIError) => {
        if (error.status) {
          return config.retryableErrors?.includes(error.status) ?? false;
        }
        return isRetryableError(error.status);
      }),
    };
  }

  /**
   * Calculate delay for retry attempt
   */
  private calculateDelay(attempt: number, retryAfter?: number): number {
    // Use Retry-After header if available
    if (retryAfter) {
      return Math.min(retryAfter, this.config.maxDelay);
    }

    let delay: number;

    switch (this.config.backoff) {
      case 'exponential':
        delay = this.config.initialDelay * Math.pow(2, attempt - 1);
        break;
      case 'linear':
        delay = this.config.initialDelay * attempt;
        break;
      case 'fixed':
        delay = this.config.initialDelay;
        break;
      default:
        delay = this.config.initialDelay;
    }

    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: APIError): boolean {
    return this.config.retryable(error);
  }

  /**
   * Execute request with retry logic
   */
  async execute<T = unknown>(
    request: APIRequest,
    executor: () => Promise<APIResponse<T>>
  ): Promise<APIResponse<T>> {
    const state: RetryState = {
      attempt: 0,
    };

    let lastError: APIError | undefined;

    while (state.attempt < this.config.maxAttempts) {
      state.attempt++;

      try {
        const response = await executor();
        return response;
      } catch (error) {
        lastError = error as APIError;

        // Check if error is retryable
        if (!this.isRetryable(lastError)) {
          throw lastError;
        }

        // Don't retry if this was the last attempt
        if (state.attempt >= this.config.maxAttempts) {
          throw lastError;
        }

        // Calculate delay
        const delay = this.calculateDelay(state.attempt, lastError.retryAfter);
        state.lastError = lastError;
        state.nextRetryAt = Date.now() + delay;

        // Wait before retry
        await this.delay(delay);
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  configure(config: Partial<RetryConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<RetryConfig>> {
    return { ...this.config };
  }
}


