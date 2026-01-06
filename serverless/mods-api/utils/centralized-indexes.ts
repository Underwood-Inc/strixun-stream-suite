/**
 * Centralized Index Management
 * ARCHITECTURAL IMPROVEMENT: Single source of truth for slugs and public mods
 * Provides O(1) lookups instead of O(n) customer scope scanning
 */

import type { 
    SlugIndex, 
    SlugIndexEntry, 
    PublicModsIndex, 
    PublicModsIndexEntry,
    ModStatus,
    ModCategory
} from '../types/mod.js';

/**
 * KV key for global slug index
 */
export const SLUG_INDEX_KEY = 'slug_index';

/**
 * KV key for global public mods index
 */
export const PUBLIC_MODS_INDEX_KEY = 'public_mods_index';

/**
 * Get slug index from KV
 * Returns empty object if not found (first time initialization)
 */
export async function getSlugIndex(env: Env): Promise<SlugIndex> {
    const index = await env.MODS_KV.get(SLUG_INDEX_KEY, { type: 'json' }) as SlugIndex | null;
    return index || {};
}

/**
 * Save slug index to KV
 */
export async function saveSlugIndex(index: SlugIndex, env: Env): Promise<void> {
    await env.MODS_KV.put(SLUG_INDEX_KEY, JSON.stringify(index));
}

/**
 * Get public mods index from KV
 * Returns empty object if not found (first time initialization)
 */
export async function getPublicModsIndex(env: Env): Promise<PublicModsIndex> {
    const index = await env.MODS_KV.get(PUBLIC_MODS_INDEX_KEY, { type: 'json' }) as PublicModsIndex | null;
    return index || {};
}

/**
 * Save public mods index to KV
 */
export async function savePublicModsIndex(index: PublicModsIndex, env: Env): Promise<void> {
    await env.MODS_KV.put(PUBLIC_MODS_INDEX_KEY, JSON.stringify(index));
}

/**
 * Add slug to index
 * Returns false if slug already exists
 */
export async function addSlugToIndex(
    slug: string,
    modId: string,
    customerId: string | null,
    env: Env
): Promise<boolean> {
    const index = await getSlugIndex(env);
    
    // Check if slug already exists
    if (index[slug]) {
        return false;
    }
    
    // Add new entry
    index[slug] = {
        modId,
        customerId,
        slug,
        createdAt: new Date().toISOString()
    };
    
    await saveSlugIndex(index, env);
    return true;
}

/**
 * Update slug in index (for slug changes)
 * Returns false if new slug already exists
 */
export async function updateSlugInIndex(
    oldSlug: string,
    newSlug: string,
    modId: string,
    customerId: string | null,
    env: Env
): Promise<boolean> {
    const index = await getSlugIndex(env);
    
    // Check if new slug already exists (and it's not the same mod)
    if (index[newSlug] && index[newSlug].modId !== modId) {
        return false;
    }
    
    // Remove old entry
    delete index[oldSlug];
    
    // Add new entry (preserve original createdAt if it was the same mod)
    const originalCreatedAt = index[newSlug]?.createdAt || new Date().toISOString();
    index[newSlug] = {
        modId,
        customerId,
        slug: newSlug,
        createdAt: originalCreatedAt
    };
    
    await saveSlugIndex(index, env);
    return true;
}

/**
 * Remove slug from index
 */
export async function removeSlugFromIndex(slug: string, env: Env): Promise<void> {
    const index = await getSlugIndex(env);
    delete index[slug];
    await saveSlugIndex(index, env);
}

/**
 * Check if slug exists in index
 * Returns modId if exists, null otherwise
 */
export async function checkSlugExists(slug: string, env: Env): Promise<string | null> {
    const index = await getSlugIndex(env);
    return index[slug]?.modId || null;
}

/**
 * Resolve slug to mod location
 * Returns { modId, customerId } if found, null otherwise
 */
export async function resolveSlugToMod(
    slug: string, 
    env: Env
): Promise<{ modId: string; customerId: string | null } | null> {
    const index = await getSlugIndex(env);
    const entry = index[slug];
    
    if (!entry) {
        return null;
    }
    
    return {
        modId: entry.modId,
        customerId: entry.customerId
    };
}

/**
 * Add mod to public index
 */
export async function addModToPublicIndex(
    modId: string,
    customerId: string | null,
    status: ModStatus,
    featured: boolean,
    category: ModCategory,
    env: Env
): Promise<void> {
    const index = await getPublicModsIndex(env);
    
    const now = new Date().toISOString();
    index[modId] = {
        modId,
        customerId,
        status,
        featured,
        category,
        createdAt: index[modId]?.createdAt || now, // Preserve original if exists
        updatedAt: now
    };
    
    await savePublicModsIndex(index, env);
}

/**
 * Update mod in public index
 */
export async function updateModInPublicIndex(
    modId: string,
    updates: Partial<Omit<PublicModsIndexEntry, 'modId' | 'createdAt'>>,
    env: Env
): Promise<void> {
    const index = await getPublicModsIndex(env);
    
    if (!index[modId]) {
        console.warn('[CentralizedIndexes] Cannot update non-existent mod in public index:', modId);
        return;
    }
    
    index[modId] = {
        ...index[modId],
        ...updates,
        updatedAt: new Date().toISOString()
    };
    
    await savePublicModsIndex(index, env);
}

/**
 * Remove mod from public index
 */
export async function removeModFromPublicIndex(modId: string, env: Env): Promise<void> {
    const index = await getPublicModsIndex(env);
    delete index[modId];
    await savePublicModsIndex(index, env);
}

/**
 * Check if mod is in public index
 */
export async function isModPublic(modId: string, env: Env): Promise<boolean> {
    const index = await getPublicModsIndex(env);
    return !!index[modId];
}

/**
 * Get all public mod IDs (for listing)
 * Returns array of modIds with their metadata
 */
export async function getPublicModIds(env: Env): Promise<PublicModsIndexEntry[]> {
    const index = await getPublicModsIndex(env);
    return Object.values(index);
}

/**
 * Get public mods by category
 */
export async function getPublicModsByCategory(
    category: ModCategory, 
    env: Env
): Promise<PublicModsIndexEntry[]> {
    const index = await getPublicModsIndex(env);
    return Object.values(index).filter(entry => entry.category === category);
}

/**
 * Get featured public mods
 */
export async function getFeaturedPublicMods(env: Env): Promise<PublicModsIndexEntry[]> {
    const index = await getPublicModsIndex(env);
    return Object.values(index).filter(entry => entry.featured);
}

/**
 * Environment interface
 */
interface Env {
    MODS_KV: KVNamespace;
    [key: string]: any;
}
