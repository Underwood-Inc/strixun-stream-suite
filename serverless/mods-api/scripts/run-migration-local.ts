/**
 * Local Migration Runner
 * Run this with: npx tsx serverless/mods-api/scripts/run-migration-local.ts
 */

import { dryRunVariantMigration, migrateAllVariantsToVersions } from './migrate-variants-to-versions.js';

async function main() {
    console.log('='.repeat(80));
    console.log('VARIANT MIGRATION TOOL');
    console.log('='.repeat(80));
    
    const isDryRun = process.argv.includes('--dry-run');
    
    // Mock environment for local testing
    const env = {
        MODS_KV: null as any, // Will need to connect to actual KV
        MODS_R2: null as any, // Will need to connect to actual R2
        MODS_PUBLIC_URL: process.env.MODS_PUBLIC_URL || '',
        ENVIRONMENT: 'development'
    };
    
    console.log('\n⚠ WARNING: This requires actual Cloudflare KV/R2 connection');
    console.log('⚠ Use wrangler commands or admin API endpoints instead\n');
    
    if (isDryRun) {
        console.log('🔍 Running DRY RUN (no changes will be made)...\n');
        const stats = await dryRunVariantMigration(env);
        console.log('\n✓ Dry run complete!');
        console.log(JSON.stringify(stats, null, 2));
    } else {
        console.log('🚀 Running ACTUAL MIGRATION...\n');
        const stats = await migrateAllVariantsToVersions(env);
        console.log('\n✓ Migration complete!');
        console.log(JSON.stringify(stats, null, 2));
    }
}

main().catch(console.error);
