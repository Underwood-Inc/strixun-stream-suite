/**
 * API Framework - Request Deduplication
 * 
 * Prevents duplicate requests from being sent simultaneously
 */

import type { APIRequest, APIResponse } from '../types';

interface PendingRequest {
  request: APIRequest;
  promise: Promise<APIResponse>;
  timestamp: number;
}

export class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly maxAge: number;

  constructor(maxAge: number = 5000) {
    this.maxAge = maxAge;
  }

  /**
   * Generate cache key for request
   */
  private getKey(request: APIRequest): string {
    const parts = [
      request.method,
      request.path || request.url,
      JSON.stringify(request.params || {}),
    ];

    // Include body hash for POST/PUT/PATCH requests
    if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const bodyStr = typeof request.body === 'string' 
        ? request.body 
        : JSON.stringify(request.body);
      parts.push(this.hashString(bodyStr));
    }

    return parts.join('|');
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if request is pending and return existing promise
   */
  getPending(key: string): Promise<APIResponse> | null {
    const pending = this.pendingRequests.get(key);
    if (!pending) {
      return null;
    }

    // Check if request is too old
    if (Date.now() - pending.timestamp > this.maxAge) {
      this.pendingRequests.delete(key);
      return null;
    }

    return pending.promise;
  }

  /**
   * Register pending request
   */
  register(key: string, request: APIRequest, promise: Promise<APIResponse>): void {
    this.pendingRequests.set(key, {
      request,
      promise,
      timestamp: Date.now(),
    });

    // Clean up when promise resolves/rejects
    promise
      .finally(() => {
        this.pendingRequests.delete(key);
      })
      .catch(() => {
        // Ignore errors, cleanup already happened
      });
  }

  /**
   * Deduplicate request - return existing promise if available, otherwise execute
   */
  async deduplicate<T = unknown>(
    request: APIRequest,
    executor: () => Promise<APIResponse<T>>
  ): Promise<APIResponse<T>> {
    const key = this.getKey(request);
    const pending = this.getPending(key);

    if (pending) {
      return pending as Promise<APIResponse<T>>;
    }

    const promise = executor();
    this.register(key, request, promise);
    return promise;
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}


