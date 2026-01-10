/**
 * Seed Handlers
 * 
 * Seed default roles and permissions on first deployment.
 */

import type { Env } from '../types/authorization.js';
import { DEFAULT_ROLES, DEFAULT_PERMISSIONS } from '../types/authorization.js';
import { 
    isSeeded, 
    markSeeded, 
    saveRoleDefinition, 
    savePermissionDefinition 
} from '../utils/authz-kv.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';

/**
 * POST /authz/seed
 * Seed default roles and permissions
 * Only runs if not already seeded
 */
export async function handleSeedDefaults(
    request: Request,
    env: Env
): Promise<Response> {
    try {
        // Check if already seeded
        if (await isSeeded(env)) {
            return new Response(JSON.stringify({
                message: 'Default roles and permissions already seeded',
                seeded: false,
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(createCORSHeaders(request, env).entries()),
                },
            });
        }
        
        // Seed roles
        console.log('[Seed] Seeding default roles...');
        for (const role of DEFAULT_ROLES) {
            await saveRoleDefinition(role, env);
            console.log(`[Seed] Saved role: ${role.name}`);
        }
        
        // Seed permissions
        console.log('[Seed] Seeding default permissions...');
        for (const permission of DEFAULT_PERMISSIONS) {
            await savePermissionDefinition(permission, env);
            console.log(`[Seed] Saved permission: ${permission.name}`);
        }
        
        // Mark as seeded
        await markSeeded(env);
        
        console.log('[Seed] Default roles and permissions seeded successfully');
        
        return new Response(JSON.stringify({
            message: 'Default roles and permissions seeded successfully',
            seeded: true,
            rolesCount: DEFAULT_ROLES.length,
            permissionsCount: DEFAULT_PERMISSIONS.length,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    } catch (error) {
        console.error('[Seed] Error:', error);
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
}
