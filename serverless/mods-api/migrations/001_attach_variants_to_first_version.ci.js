/**
 * Migration 001: Attach Variants to First Version
 * Sets parentVersionId on variants that don't have one
 */
export const migration = {
    id: '001_attach_variants_to_first_version',
    description: 'Attach variants to first version',
    
    run(namespaceId, kv) {
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
            
            // Get versions for this mod from index
            const versionIdsJson = kv.kvGet(`idx:mods:versions-for:${mod.modId}`);
            if (!versionIdsJson) continue;
            
            let versionIds;
            try { versionIds = JSON.parse(versionIdsJson); } catch { continue; }
            if (!versionIds || versionIds.length === 0) continue;
            
            // Get all versions and find oldest
            const versions = [];
            for (const vId of versionIds) {
                const vJson = kv.kvGet(`mods:version:${vId}`);
                if (!vJson) continue;
                try { versions.push(JSON.parse(vJson)); } catch { continue; }
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
};
