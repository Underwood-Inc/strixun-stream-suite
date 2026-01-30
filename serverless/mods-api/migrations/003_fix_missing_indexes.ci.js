/**
 * Migration 003: Fix Missing Indexes
 * Creates indexes that weren't created by the broken 002 migration
 */
export const migration = {
    id: '003_fix_missing_indexes',
    description: 'Create missing indexes from broken 002',
    
    run(namespaceId, kv) {
        console.log('   Creating missing indexes...');
        
        const customerModIndex = new Map();
        const modVersionIndex = new Map();
        const variantVersionIndex = new Map();
        const publicMods = [];
        let stats = { indexes: 0, slugs: 0 };
        
        const normalizeModId = (modId) => modId.startsWith('mod_') ? modId.substring(4) : modId;
        
        // Scan all mods
        console.log('     Scanning mods...');
        for (const keyInfo of kv.listKeys('mods:mod:')) {
            const modJson = kv.kvGet(keyInfo.name);
            if (!modJson) continue;
            
            let mod;
            try { mod = JSON.parse(modJson); } catch { continue; }
            if (!mod || !mod.modId) continue;
            
            // Customer index
            if (mod.customerId) {
                const existing = customerModIndex.get(mod.customerId) || [];
                if (!existing.includes(mod.modId)) existing.push(mod.modId);
                customerModIndex.set(mod.customerId, existing);
            }
            
            // Public index
            if (mod.visibility === 'public' && !publicMods.includes(mod.modId)) {
                publicMods.push(mod.modId);
            }
            
            // Slug index
            if (mod.slug) {
                kv.kvPut(`idx:mods:by-slug:${mod.slug}`, mod.modId);
                stats.slugs++;
            }
        }
        
        // Scan all versions
        console.log('     Scanning versions...');
        for (const keyInfo of kv.listKeys('mods:version:')) {
            const versionJson = kv.kvGet(keyInfo.name);
            if (!versionJson) continue;
            
            let version;
            try { version = JSON.parse(versionJson); } catch { continue; }
            if (!version || !version.versionId) continue;
            
            if (version.modId) {
                const modId = normalizeModId(version.modId);
                
                if (version.variantId) {
                    const existing = variantVersionIndex.get(version.variantId) || [];
                    if (!existing.includes(version.versionId)) existing.push(version.versionId);
                    variantVersionIndex.set(version.variantId, existing);
                } else {
                    const existing = modVersionIndex.get(modId) || [];
                    if (!existing.includes(version.versionId)) existing.push(version.versionId);
                    modVersionIndex.set(modId, existing);
                }
            }
        }
        
        // Write indexes
        console.log('     Writing indexes...');
        
        for (const [customerId, modIds] of customerModIndex) {
            kv.kvPut(`idx:mods:by-customer:${customerId}`, JSON.stringify(modIds));
            stats.indexes++;
        }
        
        if (publicMods.length > 0) {
            kv.kvPut('idx:mods:by-visibility:public', JSON.stringify(publicMods));
            stats.indexes++;
        }
        
        for (const [modId, versionIds] of modVersionIndex) {
            kv.kvPut(`idx:mods:versions-for:${modId}`, JSON.stringify(versionIds));
            stats.indexes++;
        }
        
        for (const [variantId, versionIds] of variantVersionIndex) {
            kv.kvPut(`idx:mods:versions-for-variant:${variantId}`, JSON.stringify(versionIds));
            stats.indexes++;
        }
        
        console.log(`   ✅ Created: ${stats.indexes} indexes, ${stats.slugs} slug mappings`);
    }
};
