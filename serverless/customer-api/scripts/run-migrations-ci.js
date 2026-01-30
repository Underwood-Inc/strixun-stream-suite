#!/usr/bin/env node
/**
 * CI Migration Runner for customer-api
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../../../scripts/ci-migration-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Migration 001: Unified Key Structure
 */
function migration001(namespaceId, kv) {
    console.log('   Migrating to unified key pattern...');
    let migrated = 0;
    
    // Migrate customer_ keys
    for (const keyInfo of kv.listKeys('customer_')) {
        const key = keyInfo.name;
        if (!key.startsWith('customer_') || key.startsWith('customer:')) continue;
        const customerId = key.substring(9);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`customer:customer:${customerId}`, value)) migrated++;
    }
    
    // Migrate email_ keys
    for (const keyInfo of kv.listKeys('email_')) {
        const key = keyInfo.name;
        if (!key.startsWith('email_')) continue;
        const emailHash = key.substring(6);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`idx:customer:email-to-customer:${emailHash}`, value)) migrated++;
    }
    
    // Migrate preferences_ keys
    for (const keyInfo of kv.listKeys('preferences_')) {
        const key = keyInfo.name;
        if (!key.startsWith('preferences_')) continue;
        const customerId = key.substring(12);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`customer:preferences:${customerId}`, value)) migrated++;
    }
    
    console.log(`   ✅ Migrated ${migrated} keys`);
}

runMigrations({
    servicePrefix: 'customer',
    kvBinding: 'CUSTOMER_KV',
    wranglerPath: path.join(__dirname, '..', 'wrangler.toml'),
    migrations: [
        { id: '001_migrate_to_unified_keys', description: 'Migrate to unified key pattern', run: migration001 },
    ]
}).catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
