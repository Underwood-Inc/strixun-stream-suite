/**
 * Generic Migration Runner
 * 
 * Reusable migration system for ANY service/KV namespace.
 * Tracks which migrations have been run and executes pending ones.
 * 
 * Usage:
 *   const runner = new MigrationRunner(env.MY_KV, 'my-service');
 *   await runner.runPending(migrations);
 */

import type { KVNamespace } from '@cloudflare/workers-types';

export interface Migration {
    id: string;
    description: string;
    up(kv: KVNamespace, ...args: any[]): Promise<void>;
    down?(kv: KVNamespace, ...args: any[]): Promise<void>;
}

export class MigrationRunner {
    private readonly kv: KVNamespace;
    private readonly prefix: string;

    /**
     * @param kv - KV namespace to use for migration tracking
     * @param servicePrefix - Unique prefix for this service (e.g., 'access', 'mods', 'customer')
     */
    constructor(kv: KVNamespace, servicePrefix: string) {
        this.kv = kv;
        this.prefix = `migration_${servicePrefix}_`;
    }

    /**
     * Check if a migration has been run
     */
    async isRun(migrationId: string): Promise<boolean> {
        const key = `${this.prefix}${migrationId}`;
        const value = await this.kv.get(key);
        return value === 'true';
    }

    /**
     * Mark a migration as run
     */
    private async markRun(migrationId: string): Promise<void> {
        const key = `${this.prefix}${migrationId}`;
        await this.kv.put(key, 'true', {
            metadata: {
                runAt: new Date().toISOString(),
            },
        });
    }

    /**
     * Run all pending migrations
     * 
     * @param migrations - Array of migrations to run (in order)
     * @param args - Additional arguments to pass to migration.up()
     * @returns Object with arrays of ran and skipped migration IDs
     */
    async runPending(migrations: Migration[], ...args: any[]): Promise<{ ran: string[]; skipped: string[] }> {
        const ran: string[] = [];
        const skipped: string[] = [];

        for (const migration of migrations) {
            if (await this.isRun(migration.id)) {
                console.log(`[Migration] Skipping ${migration.id} (already run)`);
                skipped.push(migration.id);
                continue;
            }

            console.log(`[Migration] Running ${migration.id}: ${migration.description}`);

            try {
                await migration.up(this.kv, ...args);
                await this.markRun(migration.id);
                ran.push(migration.id);
                console.log(`[Migration] ✓ Completed ${migration.id}`);
            } catch (error) {
                console.error(`[Migration] ✗ Failed ${migration.id}:`, error);
                throw new Error(`Migration ${migration.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        return { ran, skipped };
    }

    /**
     * Get status of all migrations
     */
    async getStatus(migrations: Migration[]): Promise<{ id: string; run: boolean; description: string }[]> {
        const status = [];

        for (const migration of migrations) {
            const run = await this.isRun(migration.id);
            status.push({
                id: migration.id,
                run,
                description: migration.description,
            });
        }

        return status;
    }

    /**
     * Rollback a specific migration (if down() is implemented)
     * 
     * WARNING: Use with caution! This can break your system if not carefully tested.
     */
    async rollback(migration: Migration, ...args: any[]): Promise<void> {
        if (!migration.down) {
            throw new Error(`Migration ${migration.id} does not implement down() - cannot rollback`);
        }

        if (!(await this.isRun(migration.id))) {
            throw new Error(`Migration ${migration.id} has not been run - cannot rollback`);
        }

        console.log(`[Migration] Rolling back ${migration.id}`);

        try {
            await migration.down(this.kv, ...args);
            // Remove migration marker
            const key = `${this.prefix}${migration.id}`;
            await this.kv.delete(key);
            console.log(`[Migration] ✓ Rolled back ${migration.id}`);
        } catch (error) {
            console.error(`[Migration] ✗ Rollback failed ${migration.id}:`, error);
            throw error;
        }
    }
}
