/**
 * Access Service Migrations Integration Tests
 * 
 * Tests that all actual migrations for the Access Service work correctly
 * using real Miniflare workers with real KV storage.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Miniflare } from 'miniflare';
import { MigrationRunner } from '../../shared/migration-runner.js';
import { migrations } from './index.js';

describe('Access Service Migrations (Integration)', () => {
    let mf: Miniflare;
    let kv: any; // Miniflare KV type differs slightly from @cloudflare/workers-types
    let runner: MigrationRunner;

    beforeAll(async () => {
        // Start Miniflare worker with real KV (using pre-built JavaScript from pretest script)
        mf = new Miniflare({
            scriptPath: './dist/worker.js', // Use compiled JavaScript instead of TypeScript
            modules: true,
            compatibilityDate: '2024-01-01',
            compatibilityFlags: ['nodejs_compat'],
            kvNamespaces: ['ACCESS_KV'],
            bindings: {
                JWT_SECRET: 'test-jwt-secret',
                SERVICE_API_KEY: 'test-service-key',
                ENVIRONMENT: 'test',
            },
        });

        // Get the actual KV namespace from Miniflare
        // Note: Using 'any' because Miniflare's KV type signature differs from @cloudflare/workers-types
        kv = await mf.getKVNamespace('ACCESS_KV');
    });

    afterAll(async () => {
        await mf.dispose();
    });

    beforeEach(async () => {
        // Clear KV before each test
        const keys = await kv.list();
        for (const key of keys.keys) {
            await kv.delete(key.name);
        }
        
        // Create fresh runner for each test
        runner = new MigrationRunner(kv, 'access');
    });

    it('should have at least one migration defined', () => {
        expect(migrations.length).toBeGreaterThan(0);
    });

    it('should have all migrations with unique IDs', () => {
        const ids = migrations.map(m => m.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have all migrations with descriptions', () => {
        for (const migration of migrations) {
            expect(migration.description).toBeDefined();
            expect(migration.description.length).toBeGreaterThan(0);
        }
    });

    it('should run all migrations successfully', async () => {
        const result = await runner.runPending(migrations);
        
        expect(result.ran.length).toBe(migrations.length);
        expect(result.skipped.length).toBe(0);
        
        // Verify all are marked as run
        for (const migration of migrations) {
            expect(await runner.isRun(migration.id)).toBe(true);
        }
    });

    it('should be idempotent - skip all on second run', async () => {
        await runner.runPending(migrations);
        const result = await runner.runPending(migrations);
        
        expect(result.ran.length).toBe(0);
        expect(result.skipped.length).toBe(migrations.length);
    });

    describe('Migration 001: Fix customer upload permissions', () => {
        it('should update customer role with upload permissions', async () => {
            const migration = migrations.find(m => m.id === '001_fix_customer_upload_permissions');
            expect(migration).toBeDefined();
            
            await runner.runPending([migration!]);
            
            // Check that customer role was updated in REAL KV
            const roleData = await kv.get('role_customer');
            expect(roleData).toBeDefined();
            
            const role = JSON.parse(roleData!);
            expect(role.name).toBe('customer');
            expect(role.permissions).toContain('upload:mod');
            expect(role.permissions).toContain('edit:mod-own');
            expect(role.permissions).toContain('delete:mod-own');
            expect(role.defaultQuotas).toBeDefined();
            expect(role.defaultQuotas['upload:mod']).toEqual({ limit: 10, period: 'day' });
        });

        it('should support rollback if needed', async () => {
            const migration = migrations.find(m => m.id === '001_fix_customer_upload_permissions');
            expect(migration).toBeDefined();
            expect(migration!.down).toBeDefined();
            
            await runner.runPending([migration!]);
            await runner.rollback(migration!);
            
            // Check that customer role was reverted in REAL KV
            const roleData = await kv.get('role_customer');
            expect(roleData).toBeDefined();
            
            const role = JSON.parse(roleData!);
            expect(role.permissions).toEqual([]);
        });
    });

    it('should run migrations in order', async () => {
        const executionOrder: string[] = [];
        
        // Temporarily monkey-patch migrations to track order
        const originalUps = migrations.map(m => m.up);
        
        migrations.forEach((migration, index) => {
            const originalUp = originalUps[index];
            migration.up = async (kv, ...args) => {
                executionOrder.push(migration.id);
                return await originalUp(kv, ...args);
            };
        });
        
        await runner.runPending(migrations);
        
        // Restore original functions
        migrations.forEach((migration, index) => {
            migration.up = originalUps[index];
        });
        
        expect(executionOrder).toEqual(migrations.map(m => m.id));
    });

    it('should have meaningful migration IDs with proper naming convention', () => {
        for (const migration of migrations) {
            // Migration IDs should start with a number (e.g., 001_, 002_)
            expect(migration.id).toMatch(/^\d{3}_/);
            
            // Should use snake_case
            expect(migration.id).toMatch(/^[0-9a-z_]+$/);
        }
    });

    it('should allow partial migration runs (for recovery scenarios)', async () => {
        // Run first migration only
        if (migrations.length > 1) {
            await runner.runPending([migrations[0]]);
            
            // Run all migrations
            const result = await runner.runPending(migrations);
            
            expect(result.ran.length).toBe(migrations.length - 1);
            expect(result.skipped.length).toBe(1);
            expect(result.skipped[0]).toBe(migrations[0].id);
        }
    });
});
