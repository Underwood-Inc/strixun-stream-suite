/**
 * OTP Authentication Service - Standalone Worker
 * Cloudflare Worker for multi-tenant OTP authentication
 * 
 * This worker handles:
 * - Email OTP Authentication System (secure user authentication)
 * - Multi-tenant customer isolation
 * - API key management
 * - JWT token generation and validation
 * 
 * @version 2.2.2 - Added: Auto-run migrations on startup
 */

import { initializeServiceTypes, type ExecutionContext } from '@strixun/types';
import { route } from './router.js';
import { MigrationRunner } from '../shared/migration-runner.js';
import { migrations } from './migrations/index.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: unknown;
}

// Initialize service types
initializeServiceTypes();

// Track if migrations have been run this instance
let migrationsRun = false;

/**
 * Auto-run migrations on startup
 * SAFE FOR PRODUCTION: Idempotent - tracks which migrations have been run
 */
async function autoRunMigrations(env: Env): Promise<void> {
    const envName = env.ENVIRONMENT || 'production';
    console.log(`[OTPAuth] 🔄 Checking for pending migrations in ${envName}...`);
    
    try {
        const runner = new MigrationRunner(env.OTP_AUTH_KV, 'otp-auth');
        const result = await runner.runPending(migrations, env);
        
        if (result.ran.length > 0) {
            console.log(`[OTPAuth] ✅ Ran ${result.ran.length} migrations:`, result.ran);
        }
        
        if (result.skipped.length > 0) {
            console.log(`[OTPAuth] ⏭️  Skipped ${result.skipped.length} migrations (already run)`);
        }
        
        if (result.ran.length === 0 && result.skipped.length === 0) {
            console.log(`[OTPAuth] ✓ No migrations to run`);
        }
    } catch (error) {
        console.error(`[OTPAuth] ❌ Failed to run migrations in ${envName}:`, error);
    }
}

/**
 * Main request handler
 * Delegates to router for all routing logic including CORS
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Auto-run migrations on first request (idempotent, safe for production)
        if (!migrationsRun) {
            migrationsRun = true;
            ctx.waitUntil(autoRunMigrations(env));
        }
        
        // Route handles everything including CORS preflight
        return route(request, env, ctx);
    }
};
