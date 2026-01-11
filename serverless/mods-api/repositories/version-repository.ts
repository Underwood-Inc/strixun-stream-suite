/**
 * Version Repository
 * KV operations for version metadata
 * 
 * Agnostic design: Works for both mod versions and variant versions
 */

import { getCustomerKey } from '../utils/customer.js';
import type { ModVersion } from '../types/mod.js';

export class VersionRepository {
    constructor(private kv: KVNamespace) {}

    /**
     * Save version metadata to KV
     * Stores in both customer scope and global scope (if public)
     */
    async save(version: ModVersion, customerId: string, isPublic: boolean = false): Promise<void> {
        const key = getCustomerKey(customerId, `version_${version.versionId}`);
        await this.kv.put(key, JSON.stringify(version));

        // Also save to global if public
        if (isPublic) {
            await this.kv.put(`version_${version.versionId}`, JSON.stringify(version));
        }
    }

    /**
     * Get version metadata from KV
     * Tries customer scope first, then global scope
     */
    async get(versionId: string, customerId: string | null): Promise<ModVersion | null> {
        // Try customer scope first
        if (customerId) {
            const key = getCustomerKey(customerId, `version_${versionId}`);
            const data = await this.kv.get(key, { type: 'json' }) as ModVersion | null;
            if (data) return data;
        }

        // Fall back to global
        const data = await this.kv.get(`version_${versionId}`, { type: 'json' }) as ModVersion | null;
        return data;
    }

    /**
     * Delete version metadata from KV
     * Removes from both customer and global scope
     */
    async delete(versionId: string, customerId: string): Promise<void> {
        const key = getCustomerKey(customerId, `version_${versionId}`);
        await this.kv.delete(key);
        await this.kv.delete(`version_${versionId}`);
    }

    /**
     * List all versions for a parent (variant or mod)
     * Uses the parent's version list key
     */
    async listByParent(parentId: string, customerId: string, parentType: 'variant' | 'mod'): Promise<ModVersion[]> {
        // Get version IDs from parent's list
        const listKey = parentType === 'variant'
            ? getCustomerKey(customerId, `variant_${parentId}_versions`)
            : getCustomerKey(customerId, `mod_${parentId}_versions`);
        
        const versionIds = await this.kv.get(listKey, { type: 'json' }) as string[] | null;
        
        if (!versionIds || versionIds.length === 0) {
            return [];
        }

        // Fetch all versions in parallel
        const versions = await Promise.all(
            versionIds.map(id => this.get(id, customerId))
        );

        return versions.filter(Boolean) as ModVersion[];
    }

    /**
     * Increment download counter for a version
     * Non-blocking operation, errors are logged but not thrown
     */
    async incrementDownloads(versionId: string, customerId: string): Promise<void> {
        try {
            const version = await this.get(versionId, customerId);
            if (version) {
                version.downloads = (version.downloads || 0) + 1;
                // Determine if public by checking if it exists in global scope
                const isPublic = !!(await this.kv.get(`version_${versionId}`));
                await this.save(version, customerId, isPublic);
            }
        } catch (error) {
            console.error('[VersionRepository] Failed to increment downloads:', error);
        }
    }
}
