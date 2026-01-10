/**
 * Variant Service
 * Business logic for variant operations
 * 
 * Agnostic design: Works for any parent resource type (mod, plugin, theme, etc.)
 */

import { VariantRepository } from '../repositories/variant-repository.js';
import { VersionRepository } from '../repositories/version-repository.js';
import { getCustomerKey, normalizeModId } from '../utils/customer.js';
import type { ModVariant, ModVersion, ModMetadata } from '../types/mod.js';

export interface CreateVariantRequest {
    name: string;
    description?: string;
}

export interface UpdateVariantRequest {
    name?: string;
    description?: string;
}

export class VariantService {
    constructor(
        private variantRepo: VariantRepository,
        private versionRepo: VersionRepository,
        private kv: KVNamespace
    ) {}

    /**
     * Create a new variant for a parent resource
     * Does NOT upload any files - use VersionService for that
     */
    async create(
        parentId: string,
        data: CreateVariantRequest,
        customerId: string
    ): Promise<ModVariant> {
        // Verify parent exists and user has permission
        const normalizedParentId = normalizeModId(parentId);
        const parentKey = getCustomerKey(customerId, `mod_${normalizedParentId}`);
        const parent = await this.kv.get(parentKey, { type: 'json' }) as ModMetadata | null;

        if (!parent) {
            throw new Error('Parent resource not found');
        }

        if (parent.authorId !== customerId) {
            throw new Error('Not authorized to create variants for this resource');
        }

        // Generate variant ID
        const variantId = `variant-${Date.now()}`;

        // Create variant metadata
        const variant: ModVariant = {
            variantId,
            modId: normalizedParentId,
            name: data.name,
            description: data.description,
            currentVersionId: null, // No versions yet
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Save variant to its own KV key
        const isPublic = parent.visibility === 'public';
        await this.variantRepo.save(variant, customerId, isPublic);

        // Add to parent's variant list
        await this.addVariantToParent(normalizedParentId, variantId, customerId);

        // ALSO update parent's variants array for backward compatibility
        // This ensures existing code that reads mod.variants still works
        if (!parent.variants) {
            parent.variants = [];
        }
        parent.variants.push(variant);
        parent.updatedAt = new Date().toISOString();
        await this.kv.put(parentKey, JSON.stringify(parent));

        // Update global scope if public
        if (isPublic) {
            await this.kv.put(`mod_${normalizedParentId}`, JSON.stringify(parent));
        }

        return variant;
    }

    /**
     * Get variant by ID
     */
    async get(variantId: string, customerId: string | null): Promise<ModVariant | null> {
        return await this.variantRepo.get(variantId, customerId);
    }

    /**
     * Update variant metadata
     */
    async update(
        variantId: string,
        data: UpdateVariantRequest,
        customerId: string
    ): Promise<ModVariant> {
        const variant = await this.variantRepo.get(variantId, customerId);
        if (!variant) {
            throw new Error('Variant not found');
        }

        // Update fields
        if (data.name !== undefined) variant.name = data.name;
        if (data.description !== undefined) variant.description = data.description;
        variant.updatedAt = new Date().toISOString();

        // Check if parent is public
        const parentKey = getCustomerKey(customerId, `mod_${variant.modId}`);
        const parent = await this.kv.get(parentKey, { type: 'json' }) as ModMetadata | null;
        const isPublic = parent?.visibility === 'public';

        // Save updated variant
        await this.variantRepo.save(variant, customerId, isPublic);

        // ALSO update in parent's variants array for backward compatibility
        if (parent && parent.variants) {
            const index = parent.variants.findIndex(v => v.variantId === variantId);
            if (index !== -1) {
                parent.variants[index] = variant;
                parent.updatedAt = new Date().toISOString();
                await this.kv.put(parentKey, JSON.stringify(parent));

                if (isPublic) {
                    await this.kv.put(`mod_${variant.modId}`, JSON.stringify(parent));
                }
            }
        }

        return variant;
    }

    /**
     * Delete variant and all its versions
     * CASCADE: Also deletes all versions and R2 files
     */
    async delete(variantId: string, customerId: string): Promise<void> {
        const variant = await this.variantRepo.get(variantId, customerId);
        if (!variant) {
            throw new Error('Variant not found');
        }

        // Get all versions for this variant
        const versions = await this.versionRepo.listByParent(variantId, customerId, 'variant');

        // Delete all versions (R2 files will be deleted by version handlers)
        for (const version of versions) {
            await this.versionRepo.delete(version.versionId, customerId);
        }

        // Delete version list
        const versionListKey = getCustomerKey(customerId, `variant_${variantId}_versions`);
        await this.kv.delete(versionListKey);

        // Delete variant metadata
        await this.variantRepo.delete(variantId, customerId);

        // Remove from parent's variant list
        await this.removeVariantFromParent(variant.modId, variantId, customerId);

        // ALSO remove from parent's variants array for backward compatibility
        const parentKey = getCustomerKey(customerId, `mod_${variant.modId}`);
        const parent = await this.kv.get(parentKey, { type: 'json' }) as ModMetadata | null;
        if (parent && parent.variants) {
            parent.variants = parent.variants.filter(v => v.variantId !== variantId);
            parent.updatedAt = new Date().toISOString();
            await this.kv.put(parentKey, JSON.stringify(parent));

            if (parent.visibility === 'public') {
                await this.kv.put(`mod_${variant.modId}`, JSON.stringify(parent));
            }
        }
    }

    /**
     * List all versions for a variant
     */
    async listVersions(variantId: string, customerId: string): Promise<ModVersion[]> {
        return await this.versionRepo.listByParent(variantId, customerId, 'variant');
    }

    /**
     * Get current version for a variant
     */
    async getCurrentVersion(variantId: string, customerId: string | null): Promise<ModVersion | null> {
        const variant = await this.variantRepo.get(variantId, customerId);
        if (!variant || !variant.currentVersionId) {
            return null;
        }

        return await this.versionRepo.get(variant.currentVersionId, customerId);
    }

    /**
     * Set current version for a variant
     * This is called automatically when a new version is uploaded,
     * but can also be called manually to switch to a different version
     */
    async setCurrentVersion(variantId: string, versionId: string, customerId: string): Promise<void> {
        const variant = await this.variantRepo.get(variantId, customerId);
        if (!variant) {
            throw new Error('Variant not found');
        }

        // Verify version exists and belongs to this variant
        const version = await this.versionRepo.get(versionId, customerId);
        if (!version || version.variantId !== variantId) {
            throw new Error('Version not found or does not belong to this variant');
        }

        // Check if parent is public
        const parentKey = getCustomerKey(customerId, `mod_${variant.modId}`);
        const parent = await this.kv.get(parentKey, { type: 'json' }) as ModMetadata | null;
        const isPublic = parent?.visibility === 'public';

        // Update variant's currentVersionId
        await this.variantRepo.setCurrentVersion(variantId, versionId, customerId, isPublic);

        // ALSO update in parent's variants array for backward compatibility
        if (parent && parent.variants) {
            const index = parent.variants.findIndex(v => v.variantId === variantId);
            if (index !== -1) {
                parent.variants[index].currentVersionId = versionId;
                parent.variants[index].updatedAt = new Date().toISOString();
                parent.updatedAt = new Date().toISOString();
                await this.kv.put(parentKey, JSON.stringify(parent));

                if (isPublic) {
                    await this.kv.put(`mod_${variant.modId}`, JSON.stringify(parent));
                }
            }
        }
    }

    /**
     * Add variant ID to parent's variant list
     */
    private async addVariantToParent(parentId: string, variantId: string, customerId: string): Promise<void> {
        const listKey = getCustomerKey(customerId, `mod_${parentId}_variants`);
        const variants = await this.kv.get(listKey, { type: 'json' }) as string[] | null;
        const updated = [...(variants || []), variantId];
        await this.kv.put(listKey, JSON.stringify(updated));
    }

    /**
     * Remove variant ID from parent's variant list
     */
    private async removeVariantFromParent(parentId: string, variantId: string, customerId: string): Promise<void> {
        const listKey = getCustomerKey(customerId, `mod_${parentId}_variants`);
        const variants = await this.kv.get(listKey, { type: 'json' }) as string[] | null;
        if (variants) {
            const updated = variants.filter(id => id !== variantId);
            await this.kv.put(listKey, JSON.stringify(updated));
        }
    }
}
