/**
 * API Framework - Request Debouncing
 * 
 * Debounce requests to prevent rapid-fire API calls
 */

import type { APIRequest, APIResponse } from '../types';

export interface DebouncerConfig {
  delay?: number;
  shouldDebounce?: (request: APIRequest) => boolean;
}

export class RequestDebouncer {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private config: Required<DebouncerConfig>;

  constructor(config: DebouncerConfig = {}) {
    this.config = {
      delay: config.delay || 300, // 300ms default
      shouldDebounce: config.shouldDebounce || (() => true),
    };
  }

  /**
   * Generate debounce key from request
   */
  private getKey(request: APIRequest): string {
    return `${request.method}:${request.path || request.url}`;
  }

  /**
   * Debounce request
   */
  debounce<T = unknown>(
    request: APIRequest,
    executor: () => Promise<APIResponse<T>>
  ): Promise<APIResponse<T>> {
    // Check if should debounce
    if (!this.config.shouldDebounce(request)) {
      return executor();
    }

    const key = this.getKey(request);

    return new Promise((resolve, reject) => {
      // Clear existing timer
      const existingTimer = this.timers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer
      const timer = setTimeout(async () => {
        this.timers.delete(key);
        try {
          const response = await executor();
          resolve(response);
        } catch (error) {
          reject(error);
        }
      }, this.config.delay);

      this.timers.set(key, timer);
    });
  }

  /**
   * Cancel debounced request
   */
  cancel(request: APIRequest): boolean {
    const key = this.getKey(request);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Clear all debounced requests
   */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

