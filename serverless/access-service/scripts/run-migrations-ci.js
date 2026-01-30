#!/usr/bin/env node
/**
 * CI Migration Runner for access-service
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../../../scripts/ci-migration-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Migration 002: Unified Key Structure
 */
function migration002(namespaceId, kv) {
    console.log('   Migrating to unified key pattern...');
    let migrated = 0;
    
    // Migrate access_ keys
    for (const keyInfo of kv.listKeys('access_')) {
        const key = keyInfo.name;
        if (!key.startsWith('access_') || key.startsWith('access:')) continue;
        const customerId = key.substring(7);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`access:customer-auth:${customerId}`, value)) migrated++;
    }
    
    // Migrate role_ keys
    for (const keyInfo of kv.listKeys('role_')) {
        const key = keyInfo.name;
        if (!key.startsWith('role_')) continue;
        const roleName = key.substring(5);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`access:role:${roleName}`, value)) migrated++;
    }
    
    // Migrate permission_ keys
    for (const keyInfo of kv.listKeys('permission_')) {
        const key = keyInfo.name;
        if (!key.startsWith('permission_')) continue;
        const permName = key.substring(11);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`access:permission:${permName}`, value)) migrated++;
    }
    
    // Migrate system_seeded
    const seededValue = kv.kvGet('system_seeded');
    if (seededValue && kv.kvPut('access:system:seeded', seededValue)) migrated++;
    
    console.log(`   ✅ Migrated ${migrated} keys`);
}

runMigrations({
    servicePrefix: 'access',
    kvBinding: 'ACCESS_KV',
    wranglerPath: path.join(__dirname, '..', 'wrangler.toml'),
    migrations: [
        { id: '002_migrate_to_unified_keys', description: 'Migrate to unified key pattern', run: migration002 },
    ]
}).catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
