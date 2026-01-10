/**
 * Version Service
 * Business logic for version uploads and downloads
 * 
 * Handles file storage in R2 and version metadata in KV
 */

import { VersionRepository } from '../repositories/version-repository.js';
import { VariantRepository } from '../repositories/variant-repository.js';
import { decryptBinaryWithSharedKey } from '@strixun/api-framework';
import { calculateStrixunHash, formatStrixunHash } from '../utils/hash.js';
import { getCustomerR2Key } from '../utils/customer.js';
import { addR2SourceMetadata, getR2SourceInfo } from '../utils/r2-source.js';
import type { ModVersion, VersionUploadRequest } from '../types/mod.js';
import type { Env } from '../worker.js';

export interface VersionUploadResult {
    version: ModVersion;
    setAsCurrent: boolean;
}

export class VersionService {
    constructor(
        private versionRepo: VersionRepository,
        private variantRepo: VariantRepository,
        private r2: R2Bucket,
        private env: Env
    ) {}

    /**
     * Upload a new version for a variant
     * Handles file encryption, R2 storage, and metadata creation
     */
    async uploadVersion(
        variantId: string,
        file: ArrayBuffer,
        metadata: VersionUploadRequest,
        fileName: string,
        customerId: string,
        request: Request
    ): Promise<VersionUploadResult> {
        // Get variant
        const variant = await this.variantRepo.get(variantId, customerId);
        if (!variant) {
            throw new Error('Variant not found');
        }

        // Decrypt file with shared key
        console.log('[VersionService] Decrypting file with shared key');
        const decryptedBinary = await decryptBinaryWithSharedKey(file, this.env.MODS_ENCRYPTION_KEY);
        if (!decryptedBinary) {
            throw new Error('Decryption failed - shared key does not match');
        }
        console.log('[VersionService] Binary decryption successful with shared key');

        // Calculate hash
        const hash = await calculateStrixunHash(decryptedBinary, this.env.FILE_INTEGRITY_KEYPHRASE);
        const formattedHash = formatStrixunHash(hash);

        // Generate version ID and R2 key
        const versionId = `ver_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        const r2Key = getCustomerR2Key(customerId, `versions/${variantId}/${versionId}`);

        // Upload to R2
        const r2SourceInfo = getR2SourceInfo(this.env, request);
        console.log('[VersionService] R2 storage source:', {
            isLocal: r2SourceInfo.isLocal,
            source: r2SourceInfo.source,
            environment: r2SourceInfo.environment,
            hostname: request.headers.get('host'),
            storageLocation: r2SourceInfo.storageLocation
        });

        const r2Metadata = addR2SourceMetadata({
            customerId,
            variantId,
            versionId,
            fileName,
            hash: formattedHash,
            uploadedAt: new Date().toISOString(),
        }, this.env, request);

        await this.r2.put(r2Key, decryptedBinary, {
            customMetadata: r2Metadata,
        });

        // Create version metadata
        const version: ModVersion = {
            versionId,
            variantId,
            modId: variant.modId,
            version: metadata.version,
            changelog: metadata.changelog,
            gameVersions: metadata.gameVersions || [],
            dependencies: metadata.dependencies || [],
            r2Key,
            fileName,
            fileSize: decryptedBinary.byteLength,
            sha256: formattedHash,
            downloadUrl: '', // Will be set by repository
            downloads: 0,
            createdAt: new Date().toISOString(),
        };

        // Determine if parent is public
        const isPublic = await this.isParentPublic(variant.modId, customerId);

        // Save version to KV
        await this.versionRepo.save(version, customerId, isPublic);

        // Add to variant's version list
        await this.variantRepo.addVersion(variantId, versionId, customerId);

        // If this is the first version, automatically set as current
        const setAsCurrent = variant.currentVersionId === null;
        if (setAsCurrent) {
            await this.variantRepo.setCurrentVersion(variantId, versionId, customerId, isPublic);
        }

        return { version, setAsCurrent };
    }

    /**
     * Download a specific version
     * Returns decrypted file binary
     */
    async downloadVersion(
        versionId: string,
        customerId: string | null,
        request: Request
    ): Promise<{ file: ArrayBuffer; fileName: string }> {
        // Get version metadata
        const version = await this.versionRepo.get(versionId, customerId);
        if (!version) {
            throw new Error('Version not found');
        }

        // Get file from R2
        const r2SourceInfo = getR2SourceInfo(this.env, request);
        console.log('[VersionService] Fetching file from R2:', {
            r2Key: version.r2Key,
            r2Source: r2SourceInfo.source,
            isLocal: r2SourceInfo.isLocal,
            storageLocation: r2SourceInfo.storageLocation
        });

        const r2Object = await this.r2.get(version.r2Key);
        if (!r2Object) {
            throw new Error('File not found in storage');
        }

        const encryptedFile = await r2Object.arrayBuffer();

        // Decrypt file (re-encrypt for client)
        // Note: File is stored decrypted in R2, we encrypt for transit
        // This matches the existing architecture
        const file = encryptedFile; // Already decrypted in R2

        // Increment download counter (async, don't block)
        if (customerId) {
            this.versionRepo.incrementDownloads(versionId, customerId).catch(err => {
                console.error('[VersionService] Failed to increment download counter:', err);
            });
        }

        return {
            file,
            fileName: version.fileName
        };
    }

    /**
     * List all versions for a variant
     */
    async listVersions(variantId: string, customerId: string): Promise<ModVersion[]> {
        return await this.versionRepo.listByParent(variantId, customerId, 'variant');
    }

    /**
     * Delete a version
     * Also removes from variant's version list and R2
     */
    async deleteVersion(versionId: string, customerId: string): Promise<void> {
        const version = await this.versionRepo.get(versionId, customerId);
        if (!version) {
            throw new Error('Version not found');
        }

        // Delete from R2
        await this.r2.delete(version.r2Key);

        // Delete version metadata
        await this.versionRepo.delete(versionId, customerId);

        // Remove from variant's version list
        if (version.variantId) {
            await this.variantRepo.removeVersion(version.variantId, versionId, customerId);

            // If this was the current version, clear currentVersionId
            const variant = await this.variantRepo.get(version.variantId, customerId);
            if (variant && variant.currentVersionId === versionId) {
                const isPublic = await this.isParentPublic(variant.modId, customerId);
                // Set to null or find another version
                const remainingVersions = await this.versionRepo.listByParent(version.variantId, customerId, 'variant');
                if (remainingVersions.length > 0) {
                    // Set most recent version as current
                    const latest = remainingVersions.sort((a, b) => 
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )[0];
                    await this.variantRepo.setCurrentVersion(version.variantId, latest.versionId, customerId, isPublic);
                } else {
                    // No versions left, set to null
                    await this.variantRepo.setCurrentVersion(version.variantId, null as any, customerId, isPublic);
                }
            }
        }
    }

    /**
     * Check if parent resource is public
     */
    private async isParentPublic(modId: string, customerId: string): Promise<boolean> {
        const { getCustomerKey } = await import('../utils/customer.js');
        const modKey = getCustomerKey(customerId, `mod_${modId}`);
        const mod = await this.env.MODS_KV.get(modKey, { type: 'json' }) as any;
        return mod?.visibility === 'public';
    }
}
