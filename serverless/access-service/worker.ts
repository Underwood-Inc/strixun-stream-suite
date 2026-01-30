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
import { createCORSHeaders } from './utils/cors.js';
import { isSeeded, markSeeded, saveRoleDefinition, savePermissionDefinition } from './utils/access-kv.js';

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
 * Bootstrap super-admin access for initial setup
 * Looks up customer by email and grants super-admin role
 * CRITICAL SECURITY: Only uses explicitly configured emails from environment
 */
async function bootstrapSuperAdmin(env: Env): Promise<void> {
    try {
        // SECURITY: Only bootstrap if explicitly configured
        const bootstrapEmails = env.SUPER_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        
        if (!bootstrapEmails || bootstrapEmails.length === 0) {
            console.warn('\n========================================');
            console.warn('⚠ ACCESS SERVICE: SUPER_ADMIN_EMAILS NOT SET');
            console.warn('========================================\n');
            return;
        }
        
        console.log('\n========================================');
        console.log(`★ BOOTSTRAPPING ${bootstrapEmails.length} SUPER-ADMIN(S) ★`);
        console.log('========================================');
        console.log(`Emails: ${bootstrapEmails.join(', ')}`);
        
                for (const email of bootstrapEmails) {
                    try {
                        // Use Customer API to look up customer by email
                        // Use env var if set, otherwise fallback to appropriate Customer API URL
                        const customerApiUrl = env.CUSTOMER_API_URL || (env.ENVIRONMENT === 'development' ? 'http://localhost:8790' : 'https://customer-api.idling.app');
                        if (!customerApiUrl) {
                            console.error(`[AccessWorker] CUSTOMER_API_URL not configured and no fallback available`);
                            continue;
                        }
                        
                        const lookupUrl = `${customerApiUrl}/customer/by-email/${encodeURIComponent(email)}`;
                        
                        const response = await fetch(lookupUrl, {
                            headers: {
                                'X-Service-Key': env.SERVICE_API_KEY!,
                                'Content-Type': 'application/json',
                            },
                        });
                        
                        if (!response.ok) {
                            console.warn(`▲ [WARNING] [AccessWorker] ⚠ Customer not found for email: ${email} (${response.status})`);
                            console.warn('');
                            continue;
                        }
                        
                        const customerData = await response.json() as { customerId?: string };
                        const customerId = customerData.customerId;
                
                if (!customerId) {
                    console.warn(`[AccessWorker] ⚠ Customer not found for email: ${email} (never logged in)`);
                    continue;
                }
                
                // Check if customer already has super-admin role
                const rolesKey = `customer:${customerId}:roles`;
                const existingRoles = await env.ACCESS_KV.get(rolesKey, { type: 'json' }) as string[] | null;
                
                if (existingRoles && existingRoles.includes('super-admin')) {
                    // Already has super-admin, skip
                    continue;
                }
                
                // Grant super-admin role
                const roles = existingRoles || [];
                if (!roles.includes('super-admin')) {
                    roles.push('super-admin');
                }
                
                await env.ACCESS_KV.put(rolesKey, JSON.stringify(roles));
                console.log(`\n★★★ GRANTED SUPER-ADMIN TO: ${email} (${customerId}) ★★★\n`);
            } catch (emailError) {
                console.error(`[AccessWorker] ❌ Failed to bootstrap super-admin for ${email}:`, emailError);
            }
        }
    } catch (error) {
        console.error(`[AccessWorker] ❌ Failed to bootstrap super-admin:`, error);
        // Don't throw - bootstrap failure shouldn't break the service
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
        // Seeds defaults and bootstraps super-admin (migrations run in CI)
        if (!hasAttemptedInit) {
            console.log('[AccessWorker] 🚀 First request received - initializing service...');
            ctx.waitUntil((async () => {
                try {
                    await autoSeedDefaults(env);
                    await bootstrapSuperAdmin(env);
                    console.log('[AccessWorker] ✓ Service initialization complete!');
                } catch (initError) {
                    console.error('[AccessWorker] ❌ Service initialization failed:', initError);
                }
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
