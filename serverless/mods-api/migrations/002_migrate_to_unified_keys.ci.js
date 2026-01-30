/**
 * Migration 002: Unified Key Structure
 * Migrates old key patterns to new unified pattern
 */
export const migration = {
    id: '002_migrate_to_unified_keys',
    description: 'Migrate to unified key pattern',
    
    run(namespaceId, kv) {
        console.log('   Migrating to unified key pattern...');
        let migrated = 0;
        
        // Migrate mod_ keys
        for (const keyInfo of kv.listKeys('mod_')) {
            const key = keyInfo.name;
            if (!key.startsWith('mod_') || key.startsWith('mods:')) continue;
            if (key.includes('_versions') || key.includes('_snapshots')) continue;
            
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
};
