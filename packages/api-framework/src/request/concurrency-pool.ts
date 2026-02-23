/**
 * API Framework - Concurrency Pool
 *
 * Generic, type-safe concurrency limiter for any async work.
 * Unlike RequestQueue, this has no dependency on APIRequest/APIResponse
 * types — it accepts any `() => Promise<T>` and caps how many
 * can be in-flight at once. Excess work queues and drains as
 * earlier tasks resolve.
 *
 * @example
 * ```ts
 * import { ConcurrencyPool } from '@strixun/api-framework';
 *
 * const pool = new ConcurrencyPool(3);
 * const result = await pool.enqueue(() => fetch('/api/thing'));
 * ```
 */

interface QueueEntry<T> {
    execute: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
}

export class ConcurrencyPool {
    private readonly maxConcurrency: number;
    private active = 0;
    private queue: QueueEntry<any>[] = [];

    constructor(maxConcurrency: number) {
        if (maxConcurrency < 1) {
            throw new Error('ConcurrencyPool: maxConcurrency must be >= 1');
        }
        this.maxConcurrency = maxConcurrency;
    }

    /**
     * Schedule async work through the pool.
     * Resolves/rejects with the same value as the supplied function.
     * Queues if the pool is at capacity.
     */
    enqueue<T>(execute: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ execute, resolve, reject });
            this.drain();
        });
    }

    /** Number of tasks currently executing */
    get activeCount(): number {
        return this.active;
    }

    /** Number of tasks waiting in the queue */
    get pendingCount(): number {
        return this.queue.length;
    }

    private drain(): void {
        while (this.active < this.maxConcurrency && this.queue.length > 0) {
            const entry = this.queue.shift()!;
            this.active++;
            entry.execute()
                .then(entry.resolve)
                .catch(entry.reject)
                .finally(() => {
                    this.active--;
                    this.drain();
                });
        }
    }
}
