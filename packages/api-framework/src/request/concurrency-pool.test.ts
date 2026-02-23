/**
 * ConcurrencyPool tests
 *
 * Verifies concurrency limiting, queue draining, error propagation,
 * and counter accuracy.
 */

import { describe, it, expect } from 'vitest';
import { ConcurrencyPool } from './concurrency-pool';

function deferred<T = void>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('ConcurrencyPool', () => {
    it('throws when maxConcurrency < 1', () => {
        expect(() => new ConcurrencyPool(0)).toThrow('maxConcurrency must be >= 1');
        expect(() => new ConcurrencyPool(-1)).toThrow('maxConcurrency must be >= 1');
    });

    it('resolves with the return value of the enqueued function', async () => {
        const pool = new ConcurrencyPool(2);
        const result = await pool.enqueue(() => Promise.resolve(42));
        expect(result).toBe(42);
    });

    it('rejects when the enqueued function rejects', async () => {
        const pool = new ConcurrencyPool(2);
        await expect(
            pool.enqueue(() => Promise.reject(new Error('boom')))
        ).rejects.toThrow('boom');
    });

    it('limits concurrency to maxConcurrency', async () => {
        const pool = new ConcurrencyPool(2);
        let peakActive = 0;

        const makeTask = () => {
            const d = deferred();
            const task = pool.enqueue(async () => {
                peakActive = Math.max(peakActive, pool.activeCount);
                await d.promise;
            });
            return { task, resolve: d.resolve };
        };

        const t1 = makeTask();
        const t2 = makeTask();
        const t3 = makeTask();

        // Two active, one queued
        expect(pool.activeCount).toBe(2);
        expect(pool.pendingCount).toBe(1);

        // Resolve all and await
        t1.resolve();
        t2.resolve();
        t3.resolve();
        await Promise.all([t1.task, t2.task, t3.task]);

        // Peak concurrency never exceeded the limit
        expect(peakActive).toBe(2);
    });

    it('drains the queue in FIFO order', async () => {
        const pool = new ConcurrencyPool(1);
        const order: number[] = [];

        const d1 = deferred();
        const d2 = deferred();
        const d3 = deferred();

        const p1 = pool.enqueue(async () => { await d1.promise; order.push(1); });
        const p2 = pool.enqueue(async () => { await d2.promise; order.push(2); });
        const p3 = pool.enqueue(async () => { await d3.promise; order.push(3); });

        d1.resolve();
        await p1;

        d2.resolve();
        await p2;

        d3.resolve();
        await p3;

        expect(order).toEqual([1, 2, 3]);
    });

    it('does not block the queue when one task rejects', async () => {
        const pool = new ConcurrencyPool(1);
        const results: string[] = [];

        const d1 = deferred();
        const d2 = deferred<string>();

        const p1 = pool.enqueue(() => d1.promise);
        const p2 = pool.enqueue(() => d2.promise);

        d1.reject(new Error('fail'));
        await expect(p1).rejects.toThrow('fail');

        d2.resolve('ok');
        const r2 = await p2;
        expect(r2).toBe('ok');
    });

    it('handles many tasks beyond concurrency limit', async () => {
        const pool = new ConcurrencyPool(3);
        const tasks = Array.from({ length: 20 }, (_, i) =>
            pool.enqueue(() => Promise.resolve(i))
        );

        const results = await Promise.all(tasks);
        expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i));
    });

    it('reports correct activeCount and pendingCount', async () => {
        const pool = new ConcurrencyPool(1);
        expect(pool.activeCount).toBe(0);
        expect(pool.pendingCount).toBe(0);

        const d = deferred();
        pool.enqueue(() => d.promise);

        expect(pool.activeCount).toBe(1);
        expect(pool.pendingCount).toBe(0);

        pool.enqueue(() => Promise.resolve());
        expect(pool.pendingCount).toBe(1);

        d.resolve();
        await new Promise((r) => setTimeout(r, 10));

        expect(pool.activeCount).toBe(0);
        expect(pool.pendingCount).toBe(0);
    });
});
