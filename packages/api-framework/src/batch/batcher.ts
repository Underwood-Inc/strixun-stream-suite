/**
 * API Framework - Request Batching
 * 
 * Batch multiple requests into a single network call
 */

import type { APIRequest, APIResponse, BatchRequest } from '../types';

export interface BatcherConfig {
  maxBatchSize?: number;
  batchDelay?: number;
  shouldBatch?: (request: APIRequest) => boolean;
}

export class RequestBatcher {
  private queue: BatchRequest[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private config: Required<BatcherConfig>;
  private processing = false;

  constructor(config: BatcherConfig = {}) {
    this.config = {
      maxBatchSize: config.maxBatchSize || 10,
      batchDelay: config.batchDelay || 50, // 50ms debounce
      shouldBatch: config.shouldBatch || (() => true),
    };
  }

  /**
   * Add request to batch
   */
  async batch(
    request: APIRequest,
    executor: () => Promise<APIResponse>
  ): Promise<APIResponse> {
    // Check if request should be batched
    if (!this.config.shouldBatch(request)) {
      return executor();
    }

    return new Promise((resolve, reject) => {
      // Find or create batch
      let batch = this.queue.find((b) => b.requests.length < this.config.maxBatchSize);
      
      if (!batch) {
        batch = {
          requests: [],
          resolve: () => {},
          reject: () => {},
        };
        this.queue.push(batch);
      }

      batch.requests.push(request);
      (batch as unknown as { executors: Array<() => Promise<APIResponse>> }).executors = 
        (batch as unknown as { executors: Array<() => Promise<APIResponse>> }).executors || [];
      (batch as unknown as { executors: Array<() => Promise<APIResponse>> }).executors.push(executor);
      (batch as unknown as { resolvers: Array<(response: APIResponse) => void> }).resolvers = 
        (batch as unknown as { resolvers: Array<(response: APIResponse) => void> }).resolvers || [];
      (batch as unknown as { resolvers: Array<(response: APIResponse) => void> }).resolvers.push(resolve);
      (batch as unknown as { rejecters: Array<(error: Error) => void> }).rejecters = 
        (batch as unknown as { rejecters: Array<(error: Error) => void> }).rejecters || [];
      (batch as unknown as { rejecters: Array<(error: Error) => void> }).rejecters.push(reject);

      // Schedule batch processing
      this.scheduleBatch();
    });
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.processBatches();
    }, this.config.batchDelay);
  }

  /**
   * Process all ready batches
   */
  private async processBatches(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const batches = [...this.queue];
    this.queue = [];

    for (const batch of batches) {
      await this.processBatch(batch);
    }

    this.processing = false;
  }

  /**
   * Process single batch
   */
  private async processBatch(batch: BatchRequest): Promise<void> {
    const executors = (batch as unknown as { executors: Array<() => Promise<APIResponse>> }).executors || [];
    const resolvers = (batch as unknown as { resolvers: Array<(response: APIResponse) => void> }).resolvers || [];
    const rejecters = (batch as unknown as { rejecters: Array<(error: Error) => void> }).rejecters || [];

    try {
      // Execute all requests in parallel
      const responses = await Promise.all(executors.map((executor) => executor()));
      
      // Resolve all promises
      responses.forEach((response, index) => {
        resolvers[index]?.(response);
      });
    } catch (error) {
      // Reject all promises on error
      rejecters.forEach((reject) => {
        reject(error as Error);
      });
    }
  }

  /**
   * Clear all batches
   */
  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    for (const batch of this.queue) {
      const rejecters = (batch as unknown as { rejecters: Array<(error: Error) => void> }).rejecters || [];
      rejecters.forEach((reject) => {
        reject(new Error('Batch cleared'));
      });
    }

    this.queue = [];
  }
}


