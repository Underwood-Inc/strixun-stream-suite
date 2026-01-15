/**
 * Variant Repository
 * KV operations for variant metadata
 * 
 * Agnostic design: Works for any parent resource type (mod, plugin, theme, etc.)
 */

import { getCustomerKey, normalizeModId } from '../utils/customer.js';
import type { ModVariant } from '../types/mod.js';

export class VariantRepository {
    constructor(private kv: KVNamespace) {}

    /**
     * Save variant metadata to KV
     * Stores in both customer scope and global scope (if parent is public)
     */
    async save(variant: ModVariant, customerId: string, isPublic: boolean = false): Promise<void> {
        const key = getCustomerKey(customerId, `variant_${variant.variantId}`);
        await this.kv.put(key, JSON.stringify(variant));

        // Also save to global if parent is public
        if (isPublic) {
            await this.kv.put(`variant_${variant.variantId}`, JSON.stringify(variant));
        }
    }

    /**
     * Get variant metadata from KV
     * Tries customer scope first, then global scope
     */
    async get(variantId: string, customerId: string | null): Promise<ModVariant | null> {
        // Try customer scope first
        if (customerId) {
            const key = getCustomerKey(customerId, `variant_${variantId}`);
            const data = await this.kv.get(key, { type: 'json' }) as ModVariant | null;
            if (data) return data;
        }

        // Fall back to global
        const data = await this.kv.get(`variant_${variantId}`, { type: 'json' }) as ModVariant | null;
        return data;
    }

    /**
     * Delete variant metadata from KV
     * Removes from both customer and global scope
     */
    async delete(variantId: string, customerId: string): Promise<void> {
        const key = getCustomerKey(customerId, `variant_${variantId}`);
        await this.kv.delete(key);
        await this.kv.delete(`variant_${variantId}`);
    }

    /**
     * Get list of version IDs for a variant
     */
    async getVersionIds(variantId: string, customerId: string): Promise<string[]> {
        const key = getCustomerKey(customerId, `variant_${variantId}_versions`);
        const data = await this.kv.get(key, { type: 'json' }) as string[] | null;
        return data || [];
    }

    /**
     * Add version ID to variant's version list
     */
    async addVersion(variantId: string, versionId: string, customerId: string): Promise<void> {
        const key = getCustomerKey(customerId, `variant_${variantId}_versions`);
        const versions = await this.getVersionIds(variantId, customerId);
        const updated = [...versions, versionId];
        await this.kv.put(key, JSON.stringify(updated));
    }

    /**
     * Remove version ID from variant's version list
     */
    async removeVersion(variantId: string, versionId: string, customerId: string): Promise<void> {
        const key = getCustomerKey(customerId, `variant_${variantId}_versions`);
        const versions = await this.getVersionIds(variantId, customerId);
        const updated = versions.filter(id => id !== versionId);
        await this.kv.put(key, JSON.stringify(updated));
    }

    /**
     * Set current version for a variant
     * Updates the variant's currentVersionId field
     */
    async setCurrentVersion(variantId: string, versionId: string, customerId: string, isPublic: boolean): Promise<void> {
        const variant = await this.get(variantId, customerId);
        if (!variant) {
            throw new Error(`Variant ${variantId} not found`);
        }

        variant.currentVersionId = versionId;
        variant.updatedAt = new Date().toISOString();

        await this.save(variant, customerId, isPublic);
    }

    /**
     * Get all variants for a parent resource (mod, plugin, etc.)
     * Uses the parent's variant list key
     */
    async listByParent(parentId: string, customerId: string): Promise<ModVariant[]> {
        // Normalize parentId (could be modId, pluginId, etc.)
        const normalizedId = normalizeModId(parentId);
        
        // Get variant IDs from parent's list
        const listKey = getCustomerKey(customerId, `mod_${normalizedId}_variants`);
        const variantIds = await this.kv.get(listKey, { type: 'json' }) as string[] | null;
        
        if (!variantIds || variantIds.length === 0) {
            return [];
        }

        // Fetch all variants in parallel
        const variants = await Promise.all(
            variantIds.map(id => this.get(id, customerId))
        );

        return variants.filter(Boolean) as ModVariant[];
    }
}
