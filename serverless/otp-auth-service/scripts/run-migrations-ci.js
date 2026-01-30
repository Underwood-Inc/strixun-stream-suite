#!/usr/bin/env node
/**
 * CI Migration Runner for otp-auth-service
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
    
    // Migrate session_ keys
    for (const keyInfo of kv.listKeys('session_')) {
        const key = keyInfo.name;
        if (!key.startsWith('session_') || key.startsWith('otp-auth:')) continue;
        const customerId = key.substring(8);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`otp-auth:session:${customerId}`, value)) migrated++;
    }
    
    // Migrate blacklist_ -> jwt-denylist
    for (const keyInfo of kv.listKeys('blacklist_')) {
        const key = keyInfo.name;
        if (!key.startsWith('blacklist_')) continue;
        const tokenHash = key.substring(10);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`otp-auth:jwt-denylist:${tokenHash}`, value)) migrated++;
    }
    
    // Migrate onboarding_ keys
    for (const keyInfo of kv.listKeys('onboarding_')) {
        const key = keyInfo.name;
        if (!key.startsWith('onboarding_')) continue;
        const customerId = key.substring(11);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`otp-auth:onboarding:${customerId}`, value)) migrated++;
    }
    
    // Migrate twitch_ keys
    for (const keyInfo of kv.listKeys('twitch_')) {
        const key = keyInfo.name;
        if (!key.startsWith('twitch_')) continue;
        const twitchId = key.substring(7);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`otp-auth:twitch-link:${twitchId}`, value)) migrated++;
    }
    
    console.log(`   ✅ Migrated ${migrated} keys`);
}

runMigrations({
    servicePrefix: 'otp-auth',
    kvBinding: 'OTP_AUTH_KV',
    wranglerPath: path.join(__dirname, '..', 'wrangler.toml'),
    migrations: [
        { id: '001_migrate_to_unified_keys', description: 'Migrate to unified key pattern', run: migration001 },
    ]
}).catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
