/**
 * Migration 004: Fix Version Index Keys
 * 
 * The 003 migration created indexes with stripped mod_ prefix:
 *   idx:mods:versions-for:1768067932047_hhx8oagss1
 * 
 * But the app looks up with full modId:
 *   idx:mods:versions-for:mod_1768067932047_hhx8oagss1
 * 
 * This migration recreates indexes with correct keys.
 */
export const migration = {
    id: '005_fix_version_index_keys',
    description: 'Fix version index keys to use full modId',
    
    run(namespaceId, kv) {
        console.log('   Fixing version index keys...');
        
        const modVersionIndex = new Map();
        let stats = { indexes: 0 };
        
        // Scan all versions
        console.log('     Scanning versions...');
        for (const keyInfo of kv.listKeys('mods:version:')) {
            const versionJson = kv.kvGet(keyInfo.name);
            if (!versionJson) continue;
            
            let version;
            try { version = JSON.parse(versionJson); } catch { continue; }
            if (!version || !version.versionId || !version.modId) continue;
            
            // Skip variant versions - they use variantId not modId for index
            if (version.variantId) continue;
            
            // Use FULL modId - do NOT strip prefix
            const modId = version.modId;
            
            const existing = modVersionIndex.get(modId) || [];
            if (!existing.includes(version.versionId)) {
                existing.push(version.versionId);
            }
            modVersionIndex.set(modId, existing);
        }
        
        // Write indexes with correct keys
        console.log('     Writing corrected indexes...');
        
        for (const [modId, versionIds] of modVersionIndex) {
            const indexKey = `idx:mods:versions-for:${modId}`;
            kv.kvPut(indexKey, JSON.stringify(versionIds));
            stats.indexes++;
            console.log(`       Created: ${indexKey} -> ${versionIds.length} versions`);
        }
        
        console.log(`   ✅ Created ${stats.indexes} corrected version indexes`);
    }
};
