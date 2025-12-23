/**
 * API Framework - Offline Queue
 * 
 * Queue requests when offline and sync when connection restored
 */

import type { APIRequest, APIResponse, OfflineQueueEntry, OfflineConfig } from '../types';

export class OfflineQueue {
  private queue: OfflineQueueEntry[] = [];
  private config: Required<OfflineConfig>;
  private isOnline = true;
  private syncListeners: Array<() => void> = [];

  constructor(config: OfflineConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      queueSize: config.queueSize || 100,
      syncOnReconnect: config.syncOnReconnect ?? true,
      retryOnReconnect: config.retryOnReconnect ?? true,
    };

    // Listen to online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      this.isOnline = navigator.onLine;
    }
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.isOnline = true;
    if (this.config.syncOnReconnect) {
      this.sync();
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.isOnline = false;
  }

  /**
   * Check if currently online
   */
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Queue request for later execution
   */
  enqueue(
    request: APIRequest,
    executor: () => Promise<APIResponse>
  ): Promise<APIResponse> {
    return new Promise((resolve, reject) => {
      // Check queue size
      if (this.queue.length >= this.config.queueSize) {
        reject(new Error('Offline queue is full'));
        return;
      }

      const entry: OfflineQueueEntry = {
        request,
        timestamp: Date.now(),
        retries: 0,
      };

      this.queue.push(entry);

      // Store executor in metadata for later execution
      (entry as unknown as { executor: () => Promise<APIResponse> }).executor = executor;
      (entry as unknown as { resolve: (response: APIResponse) => void }).resolve = resolve;
      (entry as unknown as { reject: (error: Error) => void }).reject = reject;

      // If online, try to execute immediately
      if (this.isOnline && this.config.retryOnReconnect) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests
   */
  async processQueue(): Promise<void> {
    if (!this.isOnline || this.queue.length === 0) {
      return;
    }

    const entries = [...this.queue];
    this.queue = [];

    for (const entry of entries) {
      const executor = (entry as unknown as { executor: () => Promise<APIResponse> }).executor;
      const resolve = (entry as unknown as { resolve: (response: APIResponse) => void }).resolve;
      const reject = (entry as unknown as { reject: (error: Error) => void }).reject;

      if (!executor) {
        continue;
      }

      try {
        const response = await executor();
        resolve(response);
      } catch (error) {
        entry.retries++;
        // Re-queue if retries not exhausted (max 3 retries)
        if (entry.retries < 3) {
          this.queue.push(entry);
        } else {
          reject(error as Error);
        }
      }
    }

    // Notify listeners
    this.syncListeners.forEach((listener) => listener());
  }

  /**
   * Sync queue (process all pending requests)
   */
  async sync(): Promise<void> {
    await this.processQueue();
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear queue
   */
  clear(): void {
    for (const entry of this.queue) {
      const reject = (entry as unknown as { reject: (error: Error) => void }).reject;
      if (reject) {
        reject(new Error('Offline queue cleared'));
      }
    }
    this.queue = [];
  }

  /**
   * Add sync listener
   */
  onSync(listener: () => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  /**
   * Check if queue is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}


