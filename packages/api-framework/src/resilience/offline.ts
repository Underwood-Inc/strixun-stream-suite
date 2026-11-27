/**
 * API Framework - Offline Queue
 *
 * Queues requests for later sync. Uses OCE for background flush only — not
 * navigator.onLine and never blocks user-initiated HTTP.
 */

import type { APIRequest, APIResponse, OfflineQueueEntry, OfflineConfig } from '../types';
import { getPageConnectivityEngine } from '../connectivity/getPageConnectivityEngine';

export class OfflineQueue {
  private queue: OfflineQueueEntry[] = [];
  private config: Required<OfflineConfig>;
  private syncListeners: Array<() => void> = [];

  constructor(config: OfflineConfig = { enabled: false }) {
    this.config = {
      enabled: config.enabled ?? false,
      queueSize: config.queueSize || 100,
      syncOnReconnect: config.syncOnReconnect ?? true,
      retryOnReconnect: config.retryOnReconnect ?? true,
    };
  }

  /**
   * OCE-backed hint: may background sync be attempted now?
   */
  isConnectivityAvailableForBackgroundSync(): boolean {
    try {
      return !getPageConnectivityEngine().getSnapshot().unavailable;
    } catch {
      return true;
    }
  }

  /**
   * @deprecated Use isConnectivityAvailableForBackgroundSync for flush gating.
   * Returns true so user-initiated requests are never blocked by the OCE flag.
   */
  isCurrentlyOnline(): boolean {
    return true;
  }

  /**
   * Queue request for later execution
   */
  enqueue<T = unknown>(
    request: APIRequest,
    executor: () => Promise<APIResponse<T>>
  ): Promise<APIResponse<T>> {
    return new Promise<APIResponse<T>>((resolve, reject) => {
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

      (entry as unknown as { executor: () => Promise<APIResponse<T>> }).executor =
        executor;
      (entry as unknown as { resolve: (response: APIResponse<T>) => void }).resolve =
        resolve;
      (entry as unknown as { reject: (error: Error) => void }).reject = reject;

      if (this.isConnectivityAvailableForBackgroundSync() && this.config.retryOnReconnect) {
        void this.processQueue();
      }
    });
  }

  /**
   * Process queued requests (background flush respects OCE unavailable)
   */
  async processQueue(): Promise<void> {
    if (
      !this.isConnectivityAvailableForBackgroundSync() ||
      this.queue.length === 0
    ) {
      return;
    }

    const entries = [...this.queue];
    this.queue = [];

    for (const entry of entries) {
      const executor = (entry as unknown as { executor: () => Promise<APIResponse<unknown>> })
        .executor;
      const resolve = (entry as unknown as { resolve: (response: APIResponse<unknown>) => void })
        .resolve;
      const reject = (entry as unknown as { reject: (error: Error) => void }).reject;

      if (!executor) {
        continue;
      }

      if (!this.isConnectivityAvailableForBackgroundSync()) {
        this.queue.unshift(entry);
        continue;
      }

      try {
        const response = await executor();
        resolve(response);
      } catch (error) {
        entry.retries++;
        if (entry.retries < 3) {
          this.queue.push(entry);
        } else {
          reject(error as Error);
        }
      }
    }

    this.syncListeners.forEach((listener) => listener());
  }

  async sync(): Promise<void> {
    if (!this.isConnectivityAvailableForBackgroundSync()) {
      return;
    }
    await this.processQueue();
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clear(): void {
    for (const entry of this.queue) {
      const reject = (entry as unknown as { reject: (error: Error) => void }).reject;
      if (reject) {
        reject(new Error('Offline queue cleared'));
      }
    }
    this.queue = [];
  }

  onSync(listener: () => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}