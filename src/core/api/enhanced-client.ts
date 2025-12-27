/**
 * API Framework - Enhanced API Client
 * 
 * Full-featured API client with all advanced features integrated
 */

import type {
  APIRequest,
  APIResponse,
  APIClientConfig,
  OptimisticConfig,
} from './types';
import { APIClient } from './client';
import { RequestDeduplicator } from './request/deduplicator';
import { RequestQueue } from './request/queue';
import { CancellationManager } from './request/cancellation';
import { RetryManager } from './resilience/retry';
import { CircuitBreaker } from './resilience/circuit-breaker';
import { OfflineQueue } from './resilience/offline';
import { CacheManager } from './cache/strategies';
// RequestBatcher and RequestDebouncer reserved for future use
// import { RequestBatcher } from './batch/batcher';
// import { RequestDebouncer } from './batch/debouncer';
import { OptimisticUpdateManager } from './optimistic/updates';
import { createLoggingPlugin, createMetricsPlugin } from './plugins';

export class EnhancedAPIClient extends APIClient {
  private deduplicator: RequestDeduplicator;
  private queue: RequestQueue;
  private cancellationManager: CancellationManager;
  private retryManager: RetryManager;
  private circuitBreaker: CircuitBreaker;
  private offlineQueue: OfflineQueue;
  private cacheManager: CacheManager;
  // Batcher and debouncer reserved for future use
  // private _batcher: RequestBatcher;
  // private _debouncer: RequestDebouncer;
  private optimisticManager: OptimisticUpdateManager;

  constructor(config: APIClientConfig = {}) {
    super(config);

    // Initialize managers
    this.deduplicator = new RequestDeduplicator();
    this.queue = new RequestQueue({
      maxConcurrent: 6,
      defaultPriority: 'normal',
    });
    this.cancellationManager = new CancellationManager();
    this.retryManager = new RetryManager(config.retry);
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
    });
    this.offlineQueue = new OfflineQueue(config.offline);
    this.cacheManager = new CacheManager(config.cache?.enabled ?? true);
    // this._batcher = new RequestBatcher();
    // this._debouncer = new RequestDebouncer();
    this.optimisticManager = new OptimisticUpdateManager();

    // Setup default plugins
    if (config.plugins === undefined || config.plugins.length === 0) {
      this.use(createLoggingPlugin({ enabled: true }).middleware!);
      this.use(createMetricsPlugin({ enabled: true }).middleware!);
    }
  }

  /**
   * Make request with all features integrated
   */
  override async requestRaw<T = unknown>(request: APIRequest): Promise<APIResponse<T>> {
    console.log('[EnhancedAPIClient] requestRaw called:', { method: request.method, path: request.path, url: request.url });
    // Get or create abort controller
    const controller = this.cancellationManager.getController(request.id);
    request.signal = request.signal || controller.signal;

    // Check cache first
    if (request.cache) {
      console.log('[EnhancedAPIClient] Checking cache...');
      const cached = await this.cacheManager.get<T>(request, request.cache);
      if (cached) {
        console.log('[EnhancedAPIClient] Cache hit, returning cached response');
        return cached;
      }
      console.log('[EnhancedAPIClient] Cache miss');
    }

    // Execute with all features
    console.log('[EnhancedAPIClient] Starting request pipeline...');
    try {
      return this.deduplicator.deduplicate<T>(request, async (): Promise<APIResponse<T>> => {
        console.log('[EnhancedAPIClient] Deduplicator passed, enqueueing...');
        return this.queue.enqueue(request, async () => {
          console.log('[EnhancedAPIClient] Queue passed, executing circuit breaker...');
          return this.circuitBreaker.execute(async () => {
            console.log('[EnhancedAPIClient] Circuit breaker passed, executing retry manager...');
            return this.retryManager.execute(request, async (): Promise<APIResponse<T>> => {
              // Check offline queue
              if (this.offlineQueue.isEnabled() && !this.offlineQueue.isCurrentlyOnline()) {
                console.log('[EnhancedAPIClient] Offline, queuing request...');
                return this.offlineQueue.enqueue(request, async () => {
                  return super.requestRaw<T>(request);
                });
              }

              console.log('[EnhancedAPIClient] Executing actual request...');
              // Execute request
              const response = await super.requestRaw<T>(request);
              console.log('[EnhancedAPIClient] Request completed, status:', response.status);

              // Cache response
              if (request.cache) {
                await this.cacheManager.set(request, response, request.cache);
              }

              // Cleanup cancellation
              this.cancellationManager.cleanup(request.id);

              return response;
            });
          });
        });
      });
    } catch (error) {
      console.error('[EnhancedAPIClient] Error in request pipeline:', error);
      throw error;
    }
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
    return this.optimisticManager.execute(request, async () => {
      return this.requestRaw<T>(request);
    }, config);
  }

  /**
   * Cancel request
   */
  cancel(requestId: string): boolean {
    return this.cancellationManager.cancel(requestId);
  }

  /**
   * Cancel all requests
   */
  cancelAll(): void {
    this.cancellationManager.cancelAll();
  }

  /**
   * Invalidate cache
   */
  async invalidateCache(path: string, params?: Record<string, unknown>): Promise<void> {
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
    return this.cacheManager.invalidateByTags(tags);
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    await this.cacheManager.clear();
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
      memorySize: (this.cacheManager as any).memoryCache.size(),
      queueSize: this.queue.getQueueSize(),
      runningCount: this.queue.getRunningCount(),
    };
  }

  /**
   * Generate request ID (override to use cancellation manager)
   */
  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

