#!/usr/bin/env node
/**
 * CI Migration Runner for mods-api
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from '../../../scripts/ci-migration-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Migration 001: Attach Variants to First Version
 */
function migration001(namespaceId, kv) {
    console.log('   Attaching variants to first version...');
    let modsProcessed = 0;
    let variantsUpdated = 0;
    
    const modKeys = kv.listKeys('mods:mod:');
    
    for (const keyInfo of modKeys) {
        const key = keyInfo.name;
        if (!key.startsWith('mods:mod:')) continue;
        
        const modJson = kv.kvGet(key);
        if (!modJson) continue;
        
        let mod;
        try { mod = JSON.parse(modJson); } catch { continue; }
        
        if (!mod.variants || mod.variants.length === 0) continue;
        
        const versionKeys = kv.listKeys('mods:version:');
        const versions = [];
        
        for (const vKeyInfo of versionKeys) {
            const versionJson = kv.kvGet(vKeyInfo.name);
            if (!versionJson) continue;
            try {
                const version = JSON.parse(versionJson);
                if (version.modId === mod.modId) versions.push(version);
            } catch { continue; }
        }
        
        if (versions.length === 0) continue;
        
        versions.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return aTime - bTime;
        });
        
        const firstVersion = versions[0];
        let modUpdated = false;
        
        for (const variant of mod.variants) {
            if (!variant.parentVersionId || variant.parentVersionId === '') {
                variant.parentVersionId = firstVersion.versionId;
                variantsUpdated++;
                modUpdated = true;
            }
        }
        
        if (modUpdated) {
            kv.kvPut(key, JSON.stringify(mod));
            modsProcessed++;
        }
    }
    
    console.log(`   ✅ Updated ${variantsUpdated} variants across ${modsProcessed} mods`);
}

/**
 * Migration 002: Unified Key Structure
 */
function migration002(namespaceId, kv) {
    console.log('   Migrating to unified key pattern...');
    let migrated = 0;
    
    // Migrate mod_ keys
    for (const keyInfo of kv.listKeys('mod_')) {
        const key = keyInfo.name;
        if (!key.startsWith('mod_') || key.startsWith('mods:')) continue;
        const modId = key.substring(4);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`mods:mod:${modId}`, value)) migrated++;
    }
    
    // Migrate version_ keys
    for (const keyInfo of kv.listKeys('version_')) {
        const key = keyInfo.name;
        if (!key.startsWith('version_')) continue;
        const versionId = key.substring(8);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`mods:version:${versionId}`, value)) migrated++;
    }
    
    // Migrate variant_ keys
    for (const keyInfo of kv.listKeys('variant_')) {
        const key = keyInfo.name;
        if (!key.startsWith('variant_')) continue;
        const variantId = key.substring(8);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`mods:variant:${variantId}`, value)) migrated++;
    }
    
    // Migrate slug_ keys
    for (const keyInfo of kv.listKeys('slug_')) {
        const key = keyInfo.name;
        if (!key.startsWith('slug_')) continue;
        const slug = key.substring(5);
        const value = kv.kvGet(key);
        if (value && kv.kvPut(`idx:mods:by-slug:${slug}`, value)) migrated++;
    }
    
    console.log(`   ✅ Migrated ${migrated} keys`);
}

runMigrations({
    servicePrefix: 'mods',
    kvBinding: 'MODS_KV',
    wranglerPath: path.join(__dirname, '..', 'wrangler.toml'),
    migrations: [
        { id: '001_attach_variants_to_first_version', description: 'Attach variants to first version', run: migration001 },
        { id: '002_migrate_to_unified_keys', description: 'Migrate to unified key pattern', run: migration002 },
    ]
}).catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
