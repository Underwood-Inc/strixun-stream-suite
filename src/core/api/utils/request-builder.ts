/**
 * API Framework - Request Builder
 * 
 * Utility for building API requests with proper formatting
 */

import type { APIRequest, HTTPMethod } from '../types';

export class RequestBuilder {
  private request: Partial<APIRequest>;

  constructor() {
    this.request = {
      id: this.generateRequestId(),
      headers: {},
      metadata: {},
    };
  }

  /**
   * Set HTTP method
   */
  method(method: HTTPMethod): this {
    this.request.method = method;
    return this;
  }

  /**
   * Set URL path
   */
  path(path: string): this {
    this.request.path = path;
    return this;
  }

  /**
   * Set full URL
   */
  url(url: string): this {
    this.request.url = url;
    return this;
  }

  /**
   * Set query parameters
   */
  params(params: Record<string, unknown>): this {
    this.request.params = { ...this.request.params, ...params };
    return this;
  }

  /**
   * Set request body
   */
  body(body: unknown): this {
    this.request.body = body;
    return this;
  }

  /**
   * Set header
   */
  header(key: string, value: string): this {
    if (!this.request.headers) {
      this.request.headers = {};
    }
    this.request.headers[key] = value;
    return this;
  }

  /**
   * Set multiple headers
   */
  headers(headers: Record<string, string>): this {
    if (!this.request.headers) {
      this.request.headers = {};
    }
    Object.assign(this.request.headers, headers);
    return this;
  }

  /**
   * Set AbortSignal for cancellation
   */
  signal(signal: AbortSignal): this {
    this.request.signal = signal;
    return this;
  }

  /**
   * Set request priority
   */
  priority(priority: APIRequest['priority']): this {
    this.request.priority = priority;
    return this;
  }

  /**
   * Set cache configuration
   */
  cache(cache: APIRequest['cache']): this {
    this.request.cache = cache;
    return this;
  }

  /**
   * Set retry configuration
   */
  retry(retry: APIRequest['retry']): this {
    this.request.retry = retry;
    return this;
  }

  /**
   * Set timeout
   */
  timeout(timeout: number): this {
    this.request.timeout = timeout;
    return this;
  }

  /**
   * Set metadata
   */
  metadata(key: string, value: unknown): this {
    if (!this.request.metadata) {
      this.request.metadata = {};
    }
    this.request.metadata[key] = value;
    return this;
  }

  /**
   * Build the final request
   */
  build(): APIRequest {
    if (!this.request.method) {
      throw new Error('Request method is required');
    }
    if (!this.request.url && !this.request.path) {
      throw new Error('Request URL or path is required');
    }

    // Build URL from path and params if needed
    if (this.request.path && !this.request.url) {
      const url = new URL(this.request.path, 'https://api.example.com');
      if (this.request.params) {
        Object.entries(this.request.params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
          }
        });
      }
      // Remove the base URL, keep only path + query
      this.request.url = url.pathname + url.search;
    }

    return this.request as APIRequest;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Create a new request builder
 */
export function createRequest(): RequestBuilder {
  return new RequestBuilder();
}

