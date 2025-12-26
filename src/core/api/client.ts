/**
 * API Framework - Core API Client
 * 
 * Main API client with middleware pipeline and request management
 */

import type {
  APIRequest,
  APIResponse,
  APIClientConfig,
  Middleware,
} from './types';
import { MiddlewarePipeline } from './middleware/index';
import { createAuthMiddleware } from './middleware/auth';
import { createErrorMiddleware } from './middleware/error';
import { createTransformMiddleware, defaultRequestTransformer } from './middleware/transform';
import { RequestBuilder } from './utils/request-builder';
import { handleResponse, handleErrorResponse, isSuccessResponse } from './utils/response-handler';
import { secureFetch } from '../services/encryption';

export class APIClient {
  private config: Required<APIClientConfig>;
  private middlewarePipeline: MiddlewarePipeline;
  private baseURL: string;

  constructor(config: APIClientConfig = {}) {
    this.baseURL = config.baseURL || '';
    
    this.config = {
      baseURL: this.baseURL,
      defaultHeaders: config.defaultHeaders || {},
      timeout: config.timeout || 30000,
      retry: config.retry || {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 1000,
        maxDelay: 10000,
        retryableErrors: [408, 429, 500, 502, 503, 504],
      },
      cache: {
        enabled: config.cache?.enabled ?? true,
        defaultStrategy: config.cache?.defaultStrategy || 'network-first',
        defaultTTL: config.cache?.defaultTTL || 5 * 60 * 1000,
      },
      offline: {
        enabled: config.offline?.enabled ?? false,
        queueSize: config.offline?.queueSize || 100,
        syncOnReconnect: config.offline?.syncOnReconnect ?? true,
        retryOnReconnect: config.offline?.retryOnReconnect ?? true,
      },
      auth: config.auth || {},
      errorHandler: config.errorHandler || (async () => {}),
      plugins: config.plugins || [],
    };

    this.middlewarePipeline = new MiddlewarePipeline();

    // Setup default middlewares
    this.setupDefaultMiddlewares();

    // Setup plugins
    this.setupPlugins();
  }

  /**
   * Setup default middlewares
   */
  private setupDefaultMiddlewares(): void {
    // Request transformation (ensures proper headers, etc.)
    this.use(
      createTransformMiddleware({
        transformRequest: defaultRequestTransformer,
      })
    );

    // Authentication
    if (this.config.auth.tokenGetter || this.config.auth.csrfTokenGetter) {
      this.use(
        createAuthMiddleware({
          tokenGetter: this.config.auth.tokenGetter,
          csrfTokenGetter: this.config.auth.csrfTokenGetter,
          onTokenExpired: this.config.auth.onTokenExpired,
          baseURL: this.baseURL,
        })
      );
    }

    // Error handling
    this.use(
      createErrorMiddleware({
        handler: this.config.errorHandler,
      })
    );
  }

  /**
   * Setup plugins
   */
  private setupPlugins(): void {
    for (const plugin of this.config.plugins) {
      if (plugin.setup) {
        plugin.setup(this);
      }
      if (plugin.middleware) {
        this.use(plugin.middleware);
      }
    }
  }

  /**
   * Add middleware to pipeline
   */
  use(middleware: Middleware): this {
    this.middlewarePipeline.use(middleware);
    return this;
  }

  /**
   * Remove middleware from pipeline
   */
  removeMiddleware(middleware: Middleware): this {
    this.middlewarePipeline.remove(middleware);
    return this;
  }

  /**
   * Create request builder
   */
  request(): RequestBuilder {
    return new RequestBuilder();
  }

  /**
   * Make API request
   */
  async requestRaw<T = unknown>(request: APIRequest): Promise<APIResponse<T>> {
    // Build full URL
    const url = this.buildURL(request.url || request.path);

    // Merge headers
    const headers = new Headers({
      ...this.config.defaultHeaders,
      ...request.headers,
    });

    // Serialize body
    let body: string | undefined;
    if (request.body) {
      if (typeof request.body === 'string') {
        body = request.body;
      } else {
        body = JSON.stringify(request.body);
      }
    }

    // Create fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      body,
      signal: request.signal,
    };

    // Execute through middleware pipeline
    return this.middlewarePipeline.execute<T>(request, async (req: APIRequest) => {
      // Create timeout controller if needed
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let abortController: AbortController | undefined;

      if (req.timeout || this.config.timeout) {
        abortController = new AbortController();
        const timeout = req.timeout || this.config.timeout;
        timeoutId = setTimeout(() => {
          abortController?.abort();
        }, timeout);

        if (req.signal) {
          req.signal.addEventListener('abort', () => {
            abortController?.abort();
          });
        }
      }

      try {
        // Make fetch request
        const response = await secureFetch(url, {
          ...fetchOptions,
          signal: abortController?.signal || req.signal,
        });

        // Clear timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Handle response
        if (isSuccessResponse(response.status)) {
          return handleResponse<T>(req, response);
        } else {
          throw await handleErrorResponse(req, response);
        }
      } catch (error) {
        // Clear timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Handle abort
        if (error instanceof Error && error.name === 'AbortError') {
          const apiError = new Error('Request timeout') as typeof error & { status?: number };
          apiError.status = 408;
          throw apiError;
        }

        throw error;
      }
    });
  }

  /**
   * Make GET request
   */
  async get<T = unknown>(
    path: string,
    params?: Record<string, unknown>,
    options?: Partial<APIRequest>
  ): Promise<APIResponse<T>> {
    return this.requestRaw<T>({
      id: this.generateRequestId(),
      method: 'GET',
      path,
      url: this.buildURL(path, params),
      params,
      ...options,
    });
  }

  /**
   * Make POST request
   */
  async post<T = unknown>(
    path: string,
    body?: unknown,
    options?: Partial<APIRequest>
  ): Promise<APIResponse<T>> {
    return this.requestRaw<T>({
      id: this.generateRequestId(),
      method: 'POST',
      path,
      url: this.buildURL(path),
      body,
      ...options,
    });
  }

  /**
   * Make PUT request
   */
  async put<T = unknown>(
    path: string,
    body?: unknown,
    options?: Partial<APIRequest>
  ): Promise<APIResponse<T>> {
    return this.requestRaw<T>({
      id: this.generateRequestId(),
      method: 'PUT',
      path,
      url: this.buildURL(path),
      body,
      ...options,
    });
  }

  /**
   * Make DELETE request
   */
  async delete<T = unknown>(
    path: string,
    options?: Partial<APIRequest>
  ): Promise<APIResponse<T>> {
    return this.requestRaw<T>({
      id: this.generateRequestId(),
      method: 'DELETE',
      path,
      url: this.buildURL(path),
      ...options,
    });
  }

  /**
   * Make PATCH request
   */
  async patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: Partial<APIRequest>
  ): Promise<APIResponse<T>> {
    return this.requestRaw<T>({
      id: this.generateRequestId(),
      method: 'PATCH',
      path,
      url: this.buildURL(path),
      body,
      ...options,
    });
  }

  /**
   * Build full URL from path and params
   */
  private buildURL(path: string, params?: Record<string, unknown>): string {
    // If path is already a full URL, use it
    if (path.startsWith('http://') || path.startsWith('https://')) {
      const url = new URL(path);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
          }
        });
      }
      return url.toString();
    }

    // Build URL from base URL and path
    const base = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(base + cleanPath, window.location.origin);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    // Return path + query if no base URL, otherwise full URL
    if (!this.baseURL) {
      return url.pathname + url.search;
    }

    return url.toString();
  }

  /**
   * Generate unique request ID
   */
  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Update configuration
   */
  configure(config: Partial<APIClientConfig>): this {
    Object.assign(this.config, config);
    return this;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<APIClientConfig>> {
    return { ...this.config };
  }
}


