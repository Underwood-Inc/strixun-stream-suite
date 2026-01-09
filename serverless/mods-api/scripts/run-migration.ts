/**
 * CLI Script to Run Variant Migration
 * 
 * Usage:
 *   pnpm migration:dry-run   # Test migration without changes
 *   pnpm migration:run       # Execute actual migration
 * 
 * Or directly with wrangler:
 *   wrangler dev --local --test-scheduled --env development
 */

import { dryRunVariantMigration, migrateAllVariantsToVersions } from './migrate-variants-to-versions.js';

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    MODS_PUBLIC_URL?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

/**
 * Scheduled event handler for running migration via cron
 */
export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log('[Migration CLI] Starting scheduled migration task');
        
        const isDryRun = env.MIGRATION_DRY_RUN === 'true';
        
        if (isDryRun) {
            console.log('[Migration CLI] Running in DRY RUN mode');
            const stats = await dryRunVariantMigration(env);
            console.log('[Migration CLI] Dry run complete:', JSON.stringify(stats, null, 2));
        } else {
            console.log('[Migration CLI] Running ACTUAL migration');
            const stats = await migrateAllVariantsToVersions(env);
            console.log('[Migration CLI] Migration complete:', JSON.stringify(stats, null, 2));
            
            if (stats.errors.length > 0) {
                console.error('[Migration CLI] Migration completed with errors:', stats.errors);
            }
        }
    },
    
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        
        // Admin endpoint to trigger migration manually
        if (url.pathname === '/admin/migrate/dry-run') {
            console.log('[Migration CLI] Manual dry run triggered');
            const stats = await dryRunVariantMigration(env);
            return new Response(JSON.stringify(stats, null, 2), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        if (url.pathname === '/admin/migrate/run') {
            console.log('[Migration CLI] Manual migration triggered');
            const stats = await migrateAllVariantsToVersions(env);
            return new Response(JSON.stringify(stats, null, 2), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        return new Response('Migration CLI\n\nEndpoints:\n  /admin/migrate/dry-run\n  /admin/migrate/run', {
            headers: { 'Content-Type': 'text/plain' }
        });
    }
};
