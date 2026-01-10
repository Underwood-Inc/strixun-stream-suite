/**
 * Access Service Worker
 * 
 * Handles access control decisions, roles, permissions, and quotas.
 * Service-agnostic: works for ANY service (mods, customer, analytics, etc.)
 * 
 * Key Principles:
 * - Service-to-service authentication (X-Service-Key required for all endpoints)
 * - No customer data storage (only references customerId)
 * - No business logic (only access control decisions)
 * - Service-agnostic (resource types are generic strings)
 */

import type { Env } from './types/authorization.js';
import { DEFAULT_ROLES, DEFAULT_PERMISSIONS } from './types/authorization.js';
import { handleAccessRoutes } from './router/access-routes.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { isSeeded, markSeeded, saveRoleDefinition, savePermissionDefinition } from './utils/access-kv.js';
import { MigrationRunner } from '../shared/migration-runner.js';
import { migrations } from './migrations/index.js';

/**
 * Auto-seed KV with default roles/permissions
 * 
 * SAFE FOR PRODUCTION: Runs once per deploy
 * - Checks `seeded` flag in KV before running
 * - Only runs on first request after deploy (when KV is empty or `seeded` flag missing)
 * - Ensures default role/permission definitions are always available
 * - Does NOT affect customer authorization data (that's stored separately)
 * - Default role definitions CAN be updated/overwritten (ensures consistency)
 * 
 * This provides a functional restore of key configurations on every deploy.
 * 
 * Runs on ALL environments (dev + production)
 */
async function autoSeedDefaults(env: Env): Promise<void> {
    // Check if already seeded
    if (await isSeeded(env)) {
        return; // Already seeded, skip silently
    }
    
    const envName = env.ENVIRONMENT || 'production';
    console.log(`[AccessWorker] 🌱 Auto-seeding ${envName} KV with default roles/permissions...`);
    
    try {
        // Seed default role definitions
        // Note: This will overwrite if role definitions changed in code
        // This is INTENTIONAL - ensures defaults stay consistent with codebase
        for (const role of DEFAULT_ROLES) {
            await saveRoleDefinition(role, env);
            console.log(`[AccessWorker] ✓ Seeded role: ${role.name}`);
        }
        
        // Seed default permission definitions
        for (const permission of DEFAULT_PERMISSIONS) {
            await savePermissionDefinition(permission, env);
            console.log(`[AccessWorker] ✓ Seeded permission: ${permission.name}`);
        }
        
        // Mark as seeded (prevents re-seeding on subsequent requests)
        await markSeeded(env);
        
        console.log(`[AccessWorker] ✅ ${envName} KV seeded successfully!`);
    } catch (error) {
        console.error(`[AccessWorker] ❌ Failed to auto-seed ${envName} KV:`, error);
        // Don't throw - seeding failure shouldn't break the service
    }
}

/**
 * Auto-run migrations on startup
 * 
 * SAFE FOR PRODUCTION: Idempotent
 * - Tracks which migrations have been run
 * - Skips duplicates automatically
 * - Only runs new/pending migrations
 * - Runs on ALL environments (dev + production)
 * 
 * This ensures database schema/data is always up-to-date on every deploy.
 */
async function autoRunMigrations(env: Env): Promise<void> {
    const envName = env.ENVIRONMENT || 'production';
    console.log(`[AccessWorker] 🔄 Checking for pending migrations in ${envName}...`);
    
    try {
        const runner = new MigrationRunner(env.ACCESS_KV, 'access');
        const result = await runner.runPending(migrations, env);
        
        if (result.ran.length > 0) {
            console.log(`[AccessWorker] ✅ Ran ${result.ran.length} migrations:`, result.ran);
        }
        
        if (result.skipped.length > 0) {
            console.log(`[AccessWorker] ⏭️  Skipped ${result.skipped.length} migrations (already run)`);
        }
        
        if (result.ran.length === 0 && result.skipped.length === 0) {
            console.log(`[AccessWorker] ✓ No migrations to run`);
        }
    } catch (error) {
        console.error(`[AccessWorker] ❌ Migration failed:`, error);
        // Don't throw - migration failure shouldn't break the service
        // But log it prominently so it's visible in production logs
    }
}

// Track if we've attempted initialization in this worker instance
let hasAttemptedInit = false;

/**
 * Main worker entry point
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Auto-initialize on first request (all environments)
        // Runs migrations first, then seeds defaults
        if (!hasAttemptedInit) {
            ctx.waitUntil((async () => {
                await autoRunMigrations(env);
                await autoSeedDefaults(env);
            })());
            hasAttemptedInit = true;
        }
        
        const url = new URL(request.url);
        const path = url.pathname;

        // Health check endpoint
        if (path === '/health' || path === '/health/ready') {
            return new Response(JSON.stringify({
                status: 'healthy',
                service: 'access-service',
                timestamp: new Date().toISOString(),
                environment: env.ENVIRONMENT || 'production',
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }

        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: Object.fromEntries(createCORSHeaders(request, env).entries()),
            });
        }

        // Route to access control handlers
        try {
            const result = await handleAccessRoutes(request, path, env);
            
            if (result) {
                return result.response;
            }

            // 404: Route not found
            return new Response(JSON.stringify({
                error: 'Not Found',
                message: `Route ${path} not found`,
                code: 'ROUTE_NOT_FOUND',
            }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        } catch (error) {
            console.error('[AccessWorker] Unhandled error:', error);
            
            return new Response(JSON.stringify({
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error',
                code: 'INTERNAL_ERROR',
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
    },
};
