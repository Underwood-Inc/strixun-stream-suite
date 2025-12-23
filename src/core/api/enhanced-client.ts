/**
 * API Framework - Enhanced API Client
 * 
 * Full-featured API client with all advanced features integrated
 */

import type {
  APIRequest,
  APIResponse,
  APIClientConfig,
  RequestPriority,
  CacheConfig,
  RetryConfig,
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
import { RequestBatcher } from './batch/batcher';
import { RequestDebouncer } from './batch/debouncer';
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
  private batcher: RequestBatcher;
  private debouncer: RequestDebouncer;
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
    this.batcher = new RequestBatcher();
    this.debouncer = new RequestDebouncer();
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
    // Get or create abort controller
    const controller = this.cancellationManager.getController(request.id);
    request.signal = request.signal || controller.signal;

    // Check cache first
    if (request.cache) {
      const cached = await this.cacheManager.get<T>(request, request.cache);
      if (cached) {
        return cached;
      }
    }

    // Execute with all features
    return this.deduplicator.deduplicate(request, async () => {
      return this.queue.enqueue(request, async () => {
        return this.circuitBreaker.execute(async () => {
          return this.retryManager.execute(request, async () => {
            // Check offline queue
            if (this.offlineQueue.isEnabled() && !this.offlineQueue.isCurrentlyOnline()) {
              return this.offlineQueue.enqueue(request, async () => {
                return super.requestRaw<T>(request);
              });
            }

            // Execute request
            const response = await super.requestRaw<T>(request);

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
  }

  /**
   * Make GET request with caching
   */
  async getCached<T = unknown>(
    path: string,
    params?: Record<string, unknown>,
    cacheConfig?: CacheConfig,
    options?: Partial<APIRequest>
  ): Promise<APIResponse<T>> {
    return this.get<T>(path, params, {
      ...options,
      cache: cacheConfig || {
        strategy: 'stale-while-revalidate',
        ttl: 5 * 60 * 1000,
        maxAge: 10 * 60 * 1000,
      },
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
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

