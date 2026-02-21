/**
 * API Framework - API Client (Default)
 * 
 * Single API client with optional advanced features
 * All enhancements are opt-in via config.features flags
 */

import type {
  APIRequest,
  APIResponse,
  APIClientConfig,
  Middleware,
  OptimisticConfig,
} from './types';
import { MiddlewarePipeline } from './middleware/index';
import { createAuthMiddleware } from './middleware/auth';
import { createErrorMiddleware } from './middleware/error';
import { createTransformMiddleware, defaultRequestTransformer } from './middleware/transform';
import { RequestBuilder } from './utils/request-builder';
import { handleResponse, handleErrorResponse, isSuccessResponse } from './utils/response-handler';
import { secureFetch } from './utils/secure-fetch';
import { RequestDeduplicator } from './request/deduplicator';
import { RequestQueue } from './request/queue';
import { CancellationManager } from './request/cancellation';
import { RetryManager } from './resilience/retry';
import { CircuitBreaker } from './resilience/circuit-breaker';
import { OfflineQueue } from './resilience/offline';
import { CacheManager } from './cache/strategies';
import { OptimisticUpdateManager } from './optimistic/updates';
import { createLoggingPlugin, createMetricsPlugin } from './plugins';
// Enhanced features (optional imports)
import { createE2EEncryptionMiddleware } from './enhanced/encryption/jwt-encryption';
import { createResponseFilterMiddleware } from './enhanced/filtering/response-filter';
import { createErrorLegendMiddleware } from './enhanced/errors/legend-integration';
import type { RequestContext, TypeDefinition } from './enhanced/types';
import type { WorkerAdapter } from './enhanced/workers/adapter';

/**
 * API Client - Default implementation with optional features
 * 
 * All advanced features are opt-in via config.features:
 * - deduplication: Deduplicate identical requests
 * - queue: Request queuing with priority
 * - cancellation: Request cancellation support
 * - circuitBreaker: Circuit breaker pattern
 * - offlineQueue: Offline request queuing
 * - optimisticUpdates: Optimistic UI updates
 * - logging: Request/response logging
 * - metrics: Performance metrics collection
 */
export class APIClient {
  private config: Required<APIClientConfig>;
  private middlewarePipeline: MiddlewarePipeline;
  private baseURL: string;

  // Optional feature managers - only initialized if enabled
  private deduplicator?: RequestDeduplicator;
  private queue?: RequestQueue;
  private cancellationManager?: CancellationManager;
  private retryManager?: RetryManager;
  private circuitBreaker?: CircuitBreaker;
  private offlineQueue?: OfflineQueue;
  private cacheManager?: CacheManager;
  private optimisticManager?: OptimisticUpdateManager;

  // Enhanced feature managers (optional, enabled via feature flags)
  private workerAdapter?: WorkerAdapter | null;
  private requestContext!: RequestContext;

  // Feature flags
  private features: Required<NonNullable<APIClientConfig['features']>>;

  constructor(config: APIClientConfig = {}) {
    this.baseURL = config.baseURL || '';
    
    // Initialize feature flags with defaults (all disabled by default)
    this.features = {
      deduplication: config.features?.deduplication ?? false,
      queue: config.features?.queue ?? false,
      cancellation: config.features?.cancellation ?? false,
      circuitBreaker: config.features?.circuitBreaker ?? false,
      offlineQueue: config.features?.offlineQueue ?? false,
      optimisticUpdates: config.features?.optimisticUpdates ?? false,
      logging: config.features?.logging ?? false,
      metrics: config.features?.metrics ?? false,
      e2eEncryption: config.features?.e2eEncryption ?? false,
      responseFiltering: config.features?.responseFiltering ?? false,
      errorLegend: config.features?.errorLegend ?? false,
      workerAdapter: config.features?.workerAdapter ?? false,
    };
    
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
        enabled: config.cache?.enabled ?? false,
        defaultStrategy: config.cache?.defaultStrategy || 'network-only',
        defaultTTL: config.cache?.defaultTTL || 0,
      },
      offline: {
        enabled: config.offline?.enabled ?? false,
        queueSize: config.offline?.queueSize || 100,
        syncOnReconnect: config.offline?.syncOnReconnect ?? true,
        retryOnReconnect: config.offline?.retryOnReconnect ?? true,
      },
      // CRITICAL: Default to 'include' for HttpOnly cookie support
      credentials: config.credentials || 'include',
      auth: config.auth || {},
      errorHandler: config.errorHandler || (async () => {}),
      plugins: config.plugins || [],
      features: this.features,
      encryption: config.encryption,
      filtering: config.filtering,
      errorHandling: config.errorHandling,
      worker: config.worker,
    } as Required<APIClientConfig>;

    this.middlewarePipeline = new MiddlewarePipeline();

    // Initialize request context first
    this.requestContext = {
      request: {} as APIRequest,
      env: config.worker?.env,
    };

    // Initialize retry manager if retry config is provided
    if (config.retry) {
      this.retryManager = new RetryManager(config.retry);
    }

    // Initialize only enabled features
    if (this.features.deduplication) {
      this.deduplicator = new RequestDeduplicator();
    }

    if (this.features.queue) {
      this.queue = new RequestQueue({
        maxConcurrent: 6,
        defaultPriority: 'normal',
      });
    }

    if (this.features.cancellation) {
      this.cancellationManager = new CancellationManager();
    }

    if (this.features.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000,
      });
    }

    if (this.features.offlineQueue) {
      this.offlineQueue = new OfflineQueue(config.offline);
    }

    // Cache manager is initialized if cache is enabled in config
    if (config.cache?.enabled) {
      this.cacheManager = new CacheManager(true);
    }

    if (this.features.optimisticUpdates) {
      this.optimisticManager = new OptimisticUpdateManager();
    }

    // Setup default middlewares
    this.setupDefaultMiddlewares();

    // Setup enhanced middlewares if enabled
    this.setupEnhancedMiddlewares();

    // Setup plugins if enabled
    if (this.features.logging) {
      this.use(createLoggingPlugin({ enabled: true }).middleware!);
    }

    if (this.features.metrics) {
      this.use(createMetricsPlugin({ enabled: true }).middleware!);
    }

    // Setup plugins
    this.setupPlugins();
  }

  /**
   * Setup enhanced middlewares (from EnhancedAPIClientV2)
   */
  private setupEnhancedMiddlewares(): void {
    // Error handling with legend (must be first to catch all errors)
    if (this.features.errorLegend && this.config.errorHandling?.useErrorLegend) {
      this.use(
        createErrorLegendMiddleware(
          this.config.errorHandling.useErrorLegend
        )
      );
    }

    // E2E encryption (before response filtering)
    if (this.features.e2eEncryption && this.config.encryption?.enabled) {
      this.use(
        createE2EEncryptionMiddleware(this.config.encryption)
      );
    }

    // Response filtering
    if (this.features.responseFiltering && this.config.filtering) {
      // Cast to match ResponseFilterConfig type requirements
      const filterConfig = {
        ...this.config.filtering,
        rootConfig: {
          ...this.config.filtering.rootConfig,
          alwaysInclude: this.config.filtering.rootConfig.alwaysInclude as ('id' | 'customerId')[],
        },
      };
      this.use(
        createResponseFilterMiddleware(filterConfig as any)
      );
    }
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

    // Authentication (include when onTokenExpired is set for cookie-based refresh+retry)
    if (this.config.auth.tokenGetter || this.config.auth.csrfTokenGetter || this.config.auth.onTokenExpired) {
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
   * Make API request with optional features applied
   */
  async requestRaw<T = unknown>(request: APIRequest): Promise<APIResponse<T>> {
    // Update request context (for enhanced features)
    this.requestContext.request = request;
    
    // Enhance context with Worker adapter if available
    if (this.features.workerAdapter && this.workerAdapter) {
      this.requestContext = this.workerAdapter.enhanceContext(this.requestContext);
    }

    // Get or create abort controller if cancellation is enabled
    if (this.features.cancellation && this.cancellationManager) {
      const controller = this.cancellationManager.getController(request.id);
      request.signal = request.signal || controller.signal;
    }

    // Check cache if enabled
    if (request.cache && this.cacheManager?.enabled) {
      const cached = await this.cacheManager.get<T>(request, request.cache);
      if (cached) {
        return cached;
      }
    }

    // Execute request with optional features
    try {
      let executor = async (): Promise<APIResponse<T>> => {
        // Check offline queue if enabled
        if (this.features.offlineQueue && this.offlineQueue) {
          if (!this.offlineQueue.isCurrentlyOnline()) {
            return this.offlineQueue.enqueue(request, async () => {
              return this.executeBaseRequest<T>(request);
            });
          }
        }

        // Execute base request
        const response = await this.executeBaseRequest<T>(request);

        // Cache response if enabled
        if (request.cache && this.cacheManager) {
          await this.cacheManager.set(request, response, request.cache);
        }

        // Cleanup cancellation if enabled
        if (this.features.cancellation && this.cancellationManager) {
          this.cancellationManager.cleanup(request.id);
        }

        return response;
      };

      // Apply retry manager if available
      if (this.retryManager) {
        const retryMgr = this.retryManager;
        const baseExecutor = executor;
        executor = async () => {
          return retryMgr.execute(request, baseExecutor);
        };
      }

      // Apply circuit breaker if enabled
      if (this.features.circuitBreaker && this.circuitBreaker) {
        const cb = this.circuitBreaker;
        const baseExecutor = executor;
        executor = async () => {
          return cb.execute(baseExecutor);
        };
      }

      // Apply queue if enabled
      if (this.features.queue && this.queue) {
        const queue = this.queue;
        const baseExecutor = executor;
        executor = async () => {
          return queue.enqueue(request, baseExecutor);
        };
      }

      // Apply deduplication if enabled
      if (this.features.deduplication && this.deduplicator) {
        const dedup = this.deduplicator;
        return dedup.deduplicate<T>(request, executor);
      }

      return executor();
    } catch (error) {
      // Cleanup cancellation on error
      if (this.features.cancellation && this.cancellationManager) {
        this.cancellationManager.cleanup(request.id);
      }
      throw error;
    }
  }

  /**
   * Execute base request (without optional features)
   */
  private async executeBaseRequest<T = unknown>(request: APIRequest): Promise<APIResponse<T>> {
    // Build full URL
    const url = this.buildURL(request.url || request.path);

    // Execute through middleware pipeline
    return this.middlewarePipeline.execute<T>(request, async (req: APIRequest) => {
      // Merge headers AFTER middleware has run
      const headers = new Headers({
        ...this.config.defaultHeaders,
        ...req.headers,
      });

      // Serialize body
      let body: string | FormData | undefined;
      if (req.body) {
        if (req.body instanceof FormData) {
          body = req.body;
          headers.delete('Content-Type');
        } else if (typeof req.body === 'string') {
          body = req.body;
        } else {
          body = JSON.stringify(req.body);
        }
      }

      // Create fetch options
      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
        body,
        signal: req.signal,
        // CRITICAL: Include credentials if configured (for HttpOnly cookies)
        credentials: this.config.credentials,
      };

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

        // Handle abort (timeout)
        if (error instanceof Error && error.name === 'AbortError') {
          // Check if this is a connection error (backend not running)
          const isConnectionError = error.message?.includes('Failed to fetch') || 
                                   error.message?.includes('NetworkError') ||
                                   error.message?.includes('ECONNREFUSED');
          
          if (isConnectionError) {
            const apiError = new Error('Backend server is not available. Please ensure the API server is running.') as typeof error & { status?: number; code?: string };
            apiError.status = 503;
            apiError.code = 'BACKEND_NOT_AVAILABLE';
            throw apiError;
          }
          
          const apiError = new Error('Request timeout') as typeof error & { status?: number };
          apiError.status = 408;
          throw apiError;
        }

        // Handle network errors (backend not running, CORS, etc.)
        if (error instanceof TypeError && error.message?.includes('Failed to fetch')) {
          const apiError = new Error('Unable to connect to the API server. Please ensure the backend is running.') as typeof error & { status?: number; code?: string };
          apiError.status = 503;
          apiError.code = 'NETWORK_ERROR';
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
   * Make GET request with caching
   */
  async getCached<T = unknown>(
    path: string,
    params?: Record<string, unknown>,
    cacheConfig?: { enabled?: boolean; defaultStrategy?: string; defaultTTL?: number },
    options?: Partial<APIRequest>
  ): Promise<APIResponse<T>> {
    const cache: any = cacheConfig ? {
      strategy: (cacheConfig as any).defaultStrategy || 'stale-while-revalidate',
      ttl: (cacheConfig as any).defaultTTL || 5 * 60 * 1000,
      maxAge: ((cacheConfig as any).defaultTTL || 5 * 60 * 1000) * 2,
    } : {
      strategy: 'stale-while-revalidate',
      ttl: 5 * 60 * 1000,
      maxAge: 10 * 60 * 1000,
    };
    return this.get<T>(path, params, {
      ...options,
      cache,
    });
  }

  /**
   * Make request with optimistic update
   */
  async requestOptimistic<T = unknown>(
    request: APIRequest,
    config: OptimisticConfig
  ): Promise<APIResponse<T>> {
    if (!this.features.optimisticUpdates || !this.optimisticManager) {
      throw new Error('Optimistic updates are not enabled. Set config.features.optimisticUpdates = true');
    }
    return this.optimisticManager.execute(request, async () => {
      return this.requestRaw<T>(request);
    }, config);
  }

  /**
   * Cancel request
   */
  cancel(requestId: string): boolean {
    if (!this.features.cancellation || !this.cancellationManager) {
      return false;
    }
    return this.cancellationManager.cancel(requestId);
  }

  /**
   * Cancel all requests
   */
  cancelAll(): void {
    if (this.features.cancellation && this.cancellationManager) {
      this.cancellationManager.cancelAll();
    }
  }

  /**
   * Invalidate cache
   */
  async invalidateCache(path: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.cacheManager) {
      return;
    }
    const request: APIRequest = {
      id: this.generateRequestId(),
      method: 'GET',
      url: path,
      path,
      params,
    };
    await this.cacheManager.invalidate(request);
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateCacheByTags(tags: string[]): Promise<number> {
    if (!this.cacheManager) {
      return 0;
    }
    return this.cacheManager.invalidateByTags(tags);
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memorySize: number;
    queueSize: number;
    runningCount: number;
  } {
    return {
      memorySize: this.cacheManager ? (this.cacheManager as any).memoryCache.size() : 0,
      queueSize: this.queue?.getQueueSize() ?? 0,
      runningCount: this.queue?.getRunningCount() ?? 0,
    };
  }

  /**
   * Build full URL from path and params
   */
  private buildURL(path: string, params?: Record<string, unknown>): string {
    // If path is already a full URL, use it directly
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

    // Use baseURL exactly as provided - if it's a full URL, use it directly
    const base = (this.baseURL || '').trim();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    // Debug logging for URL construction
    if (typeof window !== 'undefined' && (base.includes('customer-api') || !base)) {
      console.log('[APIClient.buildURL] URL construction:', {
        path,
        baseURL: this.baseURL,
        base,
        isFullURL: base.startsWith('http://') || base.startsWith('https://'),
        windowOrigin: window.location.origin,
        cleanPath
      });
    }
    
    // CRITICAL: If baseURL is a full URL, use it directly - NEVER use window.location.origin
    if (base.startsWith('http://') || base.startsWith('https://')) {
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const fullUrl = cleanBase + cleanPath;
      const url = new URL(fullUrl);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
          }
        });
      }
      return url.toString();
    }
    
    // If baseURL is not a full URL and is empty, error - don't guess
    if (!base) {
      throw new Error(`Cannot build URL: baseURL is not set and path '${path}' is not a full URL`);
    }
    
    // baseURL is set but not a full URL - use it with window.location.origin
    // This should only happen for relative paths, never for full URLs
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const fullPath = cleanBase + cleanPath;
    
    // CRITICAL: If cleanPath somehow contains a full URL, extract and use it directly
    // This should never happen, but be defensive against malformed inputs
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      const url = new URL(cleanPath);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
          }
        });
      }
      return url.toString();
    }
    
    const url = typeof window !== 'undefined'
      ? new URL(fullPath, window.location.origin)
      : new URL(fullPath, 'https://localhost');

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
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
    if (config.baseURL !== undefined) {
      this.baseURL = config.baseURL;
    }
    return this;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<APIClientConfig>> {
    return { ...this.config };
  }

  /**
   * Make request with type definition (enhanced feature)
   */
  async requestTyped<T extends Record<string, any>>(
    request: APIRequest,
    _typeDef?: TypeDefinition
  ): Promise<APIResponse<T & { id: string; customerId: string }>> {
    // Update request context
    this.requestContext.request = request;
    
    // Enhance context with Worker adapter if available
    if (this.features.workerAdapter && this.workerAdapter) {
      this.requestContext = this.workerAdapter.enhanceContext(this.requestContext);
    }

    // Execute request
    const response = await this.requestRaw<T>(request);

    // If successful, ensure root config is present
    if (response.status < 400 && response.data) {
      const data = response.data as Partial<T>;
      const rootConfig = {
        id: data.id || this.requestContext.customer?.id || this.generateId(),
        customerId: data.customerId || this.requestContext.customer?.customerId || '',
      };

      // Ensure root fields are present
      const enhancedData = {
        ...rootConfig,
        ...data,
      };

      return {
        ...response,
        data: enhancedData as T & { id: string; customerId: string },
      };
    }

    return response as APIResponse<T & { id: string; customerId: string }>;
  }

  /**
   * Set customer context (for root config and encryption)
   */
  setCustomer(customer: { id: string; customerId: string }): this {
    this.requestContext.customer = customer;
    return this;
  }

  /**
   * Get customer context
   */
  getCustomer(): RequestContext['customer'] {
    return this.requestContext.customer;
  }

  /**
   * Get Worker adapter
   */
  getWorkerAdapter(): WorkerAdapter | null | undefined {
    return this.workerAdapter;
  }

  /**
   * Get request context
   */
  getRequestContext(): RequestContext {
    return { ...this.requestContext };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function to create APIClient instance
 */
export function createAPIClient(config: Partial<APIClientConfig> = {}): APIClient {
  function getApiUrl(): string {
    if (typeof window !== 'undefined' && (window as any).getWorkerApiUrl) {
      return (window as any).getWorkerApiUrl() || '';
    }
    return '';
  }

  // Use provided baseURL exactly as provided - only fall back if it's undefined
  const apiUrl = config.baseURL !== undefined ? config.baseURL : getApiUrl();

  const defaultConfig: APIClientConfig = {
    baseURL: apiUrl,
    timeout: 30000,
    retry: {
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelay: 1000,
      maxDelay: 10000,
      retryableErrors: [408, 429, 500, 502, 503, 504],
    },
    cache: {
      enabled: false,
      defaultStrategy: 'network-only',
      defaultTTL: 0,
    },
    offline: {
      enabled: false,
      queueSize: 100,
      syncOnReconnect: true,
      retryOnReconnect: true,
    },
    ...config,
  };

  return new APIClient(defaultConfig);
}

/**
 * Default API client instance (singleton)
 */
let defaultClient: APIClient | null = null;

/**
 * Get or create default API client
 */
export function getAPIClient(): APIClient {
  if (!defaultClient) {
    defaultClient = createAPIClient();
  }
  return defaultClient;
}

/**
 * Set default API client
 */
export function setAPIClient(client: APIClient): void {
  defaultClient = client;
}

/**
 * Reset default API client
 */
export function resetAPIClient(): void {
  defaultClient = null;
}
