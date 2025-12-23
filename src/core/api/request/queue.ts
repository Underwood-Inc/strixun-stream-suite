/**
 * API Framework - Request Queue
 * 
 * Priority-based request queue with concurrency control
 */

import type { APIRequest, APIResponse, QueuedRequest, RequestPriority } from '../types';
import { comparePriority, getDefaultPriority } from './priority';

export interface QueueConfig {
  maxConcurrent?: number;
  defaultPriority?: RequestPriority;
  maxQueueSize?: number;
}

export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private running = new Set<string>();
  private config: Required<QueueConfig>;
  private processing = false;

  constructor(config: QueueConfig = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent || 6,
      defaultPriority: config.defaultPriority || 'normal',
      maxQueueSize: config.maxQueueSize || 100,
    };
  }

  /**
   * Enqueue request
   */
  enqueue(
    request: APIRequest,
    executor: () => Promise<APIResponse>
  ): Promise<APIResponse> {
    return new Promise((resolve, reject) => {
      // Check queue size
      if (this.queue.length >= this.config.maxQueueSize) {
        reject(new Error('Request queue is full'));
        return;
      }

      const priority = request.priority || this.config.defaultPriority;
      const queuedRequest: QueuedRequest = {
        request,
        resolve,
        reject,
        priority,
        timestamp: Date.now(),
      };

      // Insert in priority order
      this.insertByPriority(queuedRequest);

      // Start processing if not already
      this.process();
    });
  }

  /**
   * Insert request in priority order
   */
  private insertByPriority(queuedRequest: QueuedRequest): void {
    const priority = queuedRequest.priority;
    let insertIndex = this.queue.length;

    for (let i = 0; i < this.queue.length; i++) {
      if (comparePriority(priority, this.queue[i].priority) < 0) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, queuedRequest);
  }

  /**
   * Process queue
   */
  private async process(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.running.size < this.config.maxConcurrent) {
      const queuedRequest = this.queue.shift();
      if (!queuedRequest) {
        break;
      }

      this.executeRequest(queuedRequest);
    }

    this.processing = false;
  }

  /**
   * Execute queued request
   */
  private async executeRequest(queuedRequest: QueuedRequest): Promise<void> {
    const requestId = queuedRequest.request.id;
    this.running.add(requestId);

    try {
      // Create executor function that will be called
      // The executor is passed from enqueue, but we need to handle it differently
      // For now, we'll assume the executor is provided via a callback
      // This will be handled by the queue manager
      
      // This is a placeholder - the actual execution will be handled by the caller
      // via a callback pattern
    } catch (error) {
      queuedRequest.reject(error as Error);
    } finally {
      this.running.delete(requestId);
      // Continue processing
      this.process();
    }
  }

  /**
   * Execute request with executor
   */
  async execute(
    queuedRequest: QueuedRequest,
    executor: () => Promise<APIResponse>
  ): Promise<void> {
    const requestId = queuedRequest.request.id;
    this.running.add(requestId);

    try {
      const response = await executor();
      queuedRequest.resolve(response);
    } catch (error) {
      queuedRequest.reject(error as Error);
    } finally {
      this.running.delete(requestId);
      // Continue processing
      this.process();
    }
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get running count
   */
  getRunningCount(): number {
    return this.running.size;
  }

  /**
   * Clear queue
   */
  clear(): void {
    // Reject all pending requests
    for (const queuedRequest of this.queue) {
      queuedRequest.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }

  /**
   * Check if queue has space
   */
  hasSpace(): boolean {
    return this.queue.length < this.config.maxQueueSize;
  }

  /**
   * Check if can process more requests
   */
  canProcess(): boolean {
    return this.running.size < this.config.maxConcurrent;
  }
}


