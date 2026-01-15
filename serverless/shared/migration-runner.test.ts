/**
 * Migration Runner Unit Tests - 100% Coverage
 * 
 * Tests the generic migration runner system for correctness, idempotency, and error handling.
 * 
 * NOTE: These are UNIT tests using a mock KV. Integration tests with real Miniflare KV
 * are in access-service/migrations/migrations.integration.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MigrationRunner, type Migration } from './migration-runner';

// Simple in-memory KV mock for UNIT tests only
// Integration tests use real Miniflare KV
class InMemoryKV {
    private store = new Map<string, { value: string; metadata?: any }>();

    async get(key: string): Promise<string | null> {
        const item = this.store.get(key);
        return item?.value || null;
    }

    async put(key: string, value: string, options?: { metadata?: any }): Promise<void> {
        this.store.set(key, { value, metadata: options?.metadata });
    }

    async delete(key: string): Promise<void> {
        this.store.delete(key);
    }

    async list() {
        return {
            keys: Array.from(this.store.keys()).map(name => ({ name })),
            list_complete: true,
            cursor: undefined,
        };
    }

    // Helper for testing
    getStore() {
        return this.store;
    }

    clear() {
        this.store.clear();
    }
}

describe('MigrationRunner (Unit)', () => {
    let mockKV: InMemoryKV;
    let runner: MigrationRunner;

    beforeEach(() => {
        mockKV = new InMemoryKV();
        runner = new MigrationRunner(mockKV as any, 'test-service');
    });

    describe('constructor', () => {
        it('should create a runner with correct prefix', () => {
            const testRunner = new MigrationRunner(mockKV as any, 'my-service');
            expect(testRunner).toBeInstanceOf(MigrationRunner);
        });
    });

    describe('isRun', () => {
        it('should return false for migration that has not been run', async () => {
            const result = await runner.isRun('001_test');
            expect(result).toBe(false);
        });

        it('should return true for migration that has been run', async () => {
            await mockKV.put('migration_test-service_001_test', 'true');
            const result = await runner.isRun('001_test');
            expect(result).toBe(true);
        });

        it('should return false for migration marked as something other than "true"', async () => {
            await mockKV.put('migration_test-service_001_test', 'false');
            const result = await runner.isRun('001_test');
            expect(result).toBe(false);
        });
    });

    describe('runPending', () => {
        it('should run a single pending migration', async () => {
            const upSpy = vi.fn(async () => {});
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: upSpy,
            };

            const result = await runner.runPending([migration]);

            expect(result.ran).toEqual(['001_test']);
            expect(result.skipped).toEqual([]);
            expect(upSpy).toHaveBeenCalledTimes(1);
            expect(await runner.isRun('001_test')).toBe(true);
        });

        it('should run multiple pending migrations in order', async () => {
            const executionOrder: string[] = [];
            
            const migration1: Migration = {
                id: '001_first',
                description: 'First migration',
                up: async () => { executionOrder.push('001'); },
            };
            
            const migration2: Migration = {
                id: '002_second',
                description: 'Second migration',
                up: async () => { executionOrder.push('002'); },
            };
            
            const migration3: Migration = {
                id: '003_third',
                description: 'Third migration',
                up: async () => { executionOrder.push('003'); },
            };

            const result = await runner.runPending([migration1, migration2, migration3]);

            expect(result.ran).toEqual(['001_first', '002_second', '003_third']);
            expect(result.skipped).toEqual([]);
            expect(executionOrder).toEqual(['001', '002', '003']);
        });

        it('should skip migrations that have already been run', async () => {
            const upSpy = vi.fn(async () => {});
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: upSpy,
            };

            // Run once
            await runner.runPending([migration]);
            
            // Run again
            const result = await runner.runPending([migration]);

            expect(result.ran).toEqual([]);
            expect(result.skipped).toEqual(['001_test']);
            expect(upSpy).toHaveBeenCalledTimes(1); // Should only be called once
        });

        it('should handle mix of pending and already-run migrations', async () => {
            const migration1: Migration = {
                id: '001_first',
                description: 'First migration',
                up: async () => {},
            };
            
            const migration2: Migration = {
                id: '002_second',
                description: 'Second migration',
                up: async () => {},
            };
            
            const migration3: Migration = {
                id: '003_third',
                description: 'Third migration',
                up: async () => {},
            };

            // Run first and third
            await runner.runPending([migration1]);
            await runner.runPending([migration3]);
            
            // Run all three
            const result = await runner.runPending([migration1, migration2, migration3]);

            expect(result.ran).toEqual(['002_second']);
            expect(result.skipped).toEqual(['001_first', '003_third']);
        });

        it('should pass KV namespace to migration.up()', async () => {
            let receivedKV: any = null;
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: async (kv) => { receivedKV = kv; },
            };

            await runner.runPending([migration]);

            expect(receivedKV).toBe(mockKV);
        });

        it('should pass additional arguments to migration.up()', async () => {
            let receivedArgs: any[] = [];
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: async (kv, ...args) => { receivedArgs = args; },
            };

            await runner.runPending([migration], 'arg1', 42, { test: true });

            expect(receivedArgs).toEqual(['arg1', 42, { test: true }]);
        });

        it('should throw error if migration fails', async () => {
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: async () => { throw new Error('Migration failed!'); },
            };

            await expect(runner.runPending([migration]))
                .rejects
                .toThrow('Migration 001_test failed: Migration failed!');
            
            // Should NOT be marked as run
            expect(await runner.isRun('001_test')).toBe(false);
        });

        it('should stop execution if a migration fails', async () => {
            const migration1Spy = vi.fn(async () => {});
            const migration2Spy = vi.fn(async () => { throw new Error('Failed!'); });
            const migration3Spy = vi.fn(async () => {});

            const migration1: Migration = {
                id: '001_first',
                description: 'First',
                up: migration1Spy,
            };
            
            const migration2: Migration = {
                id: '002_second',
                description: 'Second',
                up: migration2Spy,
            };
            
            const migration3: Migration = {
                id: '003_third',
                description: 'Third',
                up: migration3Spy,
            };

            await expect(runner.runPending([migration1, migration2, migration3]))
                .rejects
                .toThrow();

            expect(migration1Spy).toHaveBeenCalledTimes(1);
            expect(migration2Spy).toHaveBeenCalledTimes(1);
            expect(migration3Spy).not.toHaveBeenCalled(); // Should not run
            
            expect(await runner.isRun('001_first')).toBe(true);
            expect(await runner.isRun('002_second')).toBe(false);
            expect(await runner.isRun('003_third')).toBe(false);
        });

        it('should store metadata with migration marker', async () => {
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: async () => {},
            };

            await runner.runPending([migration]);

            const marker = mockKV.getStore().get('migration_test-service_001_test');
            expect(marker?.metadata).toBeDefined();
            expect(marker?.metadata?.runAt).toBeDefined();
            expect(new Date(marker!.metadata!.runAt)).toBeInstanceOf(Date);
        });
    });

    describe('getStatus', () => {
        it('should return status for no migrations', async () => {
            const status = await runner.getStatus([]);
            expect(status).toEqual([]);
        });

        it('should return status for pending migrations', async () => {
            const migrations: Migration[] = [
                { id: '001_test', description: 'Test 1', up: async () => {} },
                { id: '002_test', description: 'Test 2', up: async () => {} },
            ];

            const status = await runner.getStatus(migrations);

            expect(status).toEqual([
                { id: '001_test', run: false, description: 'Test 1' },
                { id: '002_test', run: false, description: 'Test 2' },
            ]);
        });

        it('should return status for completed migrations', async () => {
            const migrations: Migration[] = [
                { id: '001_test', description: 'Test 1', up: async () => {} },
                { id: '002_test', description: 'Test 2', up: async () => {} },
            ];

            await runner.runPending(migrations);
            const status = await runner.getStatus(migrations);

            expect(status).toEqual([
                { id: '001_test', run: true, description: 'Test 1' },
                { id: '002_test', run: true, description: 'Test 2' },
            ]);
        });

        it('should return status for mix of pending and completed', async () => {
            const migration1: Migration = { id: '001_test', description: 'Test 1', up: async () => {} };
            const migration2: Migration = { id: '002_test', description: 'Test 2', up: async () => {} };
            const migration3: Migration = { id: '003_test', description: 'Test 3', up: async () => {} };

            await runner.runPending([migration1, migration3]);
            const status = await runner.getStatus([migration1, migration2, migration3]);

            expect(status).toEqual([
                { id: '001_test', run: true, description: 'Test 1' },
                { id: '002_test', run: false, description: 'Test 2' },
                { id: '003_test', run: true, description: 'Test 3' },
            ]);
        });
    });

    describe('rollback', () => {
        it('should rollback a migration that has been run', async () => {
            const downSpy = vi.fn(async () => {});
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: async () => {},
                down: downSpy,
            };

            await runner.runPending([migration]);
            await runner.rollback(migration);

            expect(downSpy).toHaveBeenCalledTimes(1);
            expect(await runner.isRun('001_test')).toBe(false);
        });

        it('should throw error if migration does not implement down()', async () => {
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: async () => {},
                // No down()
            };

            await runner.runPending([migration]);

            await expect(runner.rollback(migration))
                .rejects
                .toThrow('Migration 001_test does not implement down() - cannot rollback');
        });

        it('should throw error if migration has not been run', async () => {
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: async () => {},
                down: async () => {},
            };

            await expect(runner.rollback(migration))
                .rejects
                .toThrow('Migration 001_test has not been run - cannot rollback');
        });

        it('should pass KV namespace to migration.down()', async () => {
            let receivedKV: any = null;
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: async () => {},
                down: async (kv) => { receivedKV = kv; },
            };

            await runner.runPending([migration]);
            await runner.rollback(migration);

            expect(receivedKV).toBe(mockKV);
        });

        it('should pass additional arguments to migration.down()', async () => {
            let receivedArgs: any[] = [];
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: async () => {},
                down: async (kv, ...args) => { receivedArgs = args; },
            };

            await runner.runPending([migration]);
            await runner.rollback(migration, 'arg1', 42, { test: true });

            expect(receivedArgs).toEqual(['arg1', 42, { test: true }]);
        });

        it('should throw error if rollback fails', async () => {
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: async () => {},
                down: async () => { throw new Error('Rollback failed!'); },
            };

            await runner.runPending([migration]);

            await expect(runner.rollback(migration))
                .rejects
                .toThrow('Rollback failed!');
            
            // Should STILL be marked as run (rollback failed)
            expect(await runner.isRun('001_test')).toBe(true);
        });

        it('should be idempotent - can run migration again after rollback', async () => {
            const upSpy = vi.fn(async () => {});
            const downSpy = vi.fn(async () => {});
            const migration: Migration = {
                id: '001_test',
                description: 'Test migration',
                up: upSpy,
                down: downSpy,
            };

            // Run, rollback, run again
            await runner.runPending([migration]);
            await runner.rollback(migration);
            await runner.runPending([migration]);

            expect(upSpy).toHaveBeenCalledTimes(2);
            expect(downSpy).toHaveBeenCalledTimes(1);
            expect(await runner.isRun('001_test')).toBe(true);
        });
    });

    describe('service prefix isolation', () => {
        it('should isolate migrations by service prefix', async () => {
            const runner1 = new MigrationRunner(mockKV as any, 'service-a');
            const runner2 = new MigrationRunner(mockKV as any, 'service-b');

            const migration: Migration = {
                id: '001_test',
                description: 'Test',
                up: async () => {},
            };

            await runner1.runPending([migration]);

            expect(await runner1.isRun('001_test')).toBe(true);
            expect(await runner2.isRun('001_test')).toBe(false); // Different service
        });

        it('should allow same migration ID across different services', async () => {
            const runner1 = new MigrationRunner(mockKV as any, 'service-a');
            const runner2 = new MigrationRunner(mockKV as any, 'service-b');

            const upSpy1 = vi.fn(async () => {});
            const upSpy2 = vi.fn(async () => {});

            const migration1: Migration = {
                id: '001_test',
                description: 'Test A',
                up: upSpy1,
            };

            const migration2: Migration = {
                id: '001_test',
                description: 'Test B',
                up: upSpy2,
            };

            await runner1.runPending([migration1]);
            await runner2.runPending([migration2]);

            expect(upSpy1).toHaveBeenCalledTimes(1);
            expect(upSpy2).toHaveBeenCalledTimes(1);
            expect(await runner1.isRun('001_test')).toBe(true);
            expect(await runner2.isRun('001_test')).toBe(true);
        });
    });
});
