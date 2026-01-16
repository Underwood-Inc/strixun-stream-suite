/**
 * Centralized KV Key Builder
 * 
 * CRITICAL: All KV key generation MUST go through this module to prevent:
 * - Double-prefix bugs (e.g., mod_mod_xxx)
 * - Inconsistent key patterns across handlers
 * - Multi-tenant isolation issues
 * 
 * Usage:
 *   import { KVKeys } from '../utils/kv-keys.js';
 *   const modKey = KVKeys.mod(customerId, modId);
 *   const versionKey = KVKeys.version(customerId, versionId);
 */

// ============================================================================
// Internal Normalizers - Strip prefixes to prevent double-prefixing
// ============================================================================

/**
 * Normalize modId by stripping 'mod_' prefix if present
 */
function normalizeModId(modId: string): string {
    if (!modId) return modId;
    return modId.startsWith('mod_') ? modId.substring(4) : modId;
}

/**
 * Normalize versionId by stripping 'ver_' or 'version_' prefix if present
 */
function normalizeVersionId(versionId: string): string {
    if (!versionId) return versionId;
    if (versionId.startsWith('ver_')) return versionId; // ver_ is the actual prefix, keep it
    if (versionId.startsWith('version_')) return versionId.substring(8);
    return versionId;
}

/**
 * Normalize variantId by stripping 'variant_' prefix if present
 */
function normalizeVariantId(variantId: string): string {
    if (!variantId) return variantId;
    if (variantId.startsWith('var_')) return variantId; // var_ is the actual prefix, keep it
    if (variantId.startsWith('variant_')) return variantId.substring(8);
    return variantId;
}

/**
 * Normalize snapshotId by stripping 'snapshot_' prefix if present
 */
function normalizeSnapshotId(snapshotId: string): string {
    if (!snapshotId) return snapshotId;
    if (snapshotId.startsWith('snap_')) return snapshotId; // snap_ is the actual prefix, keep it
    if (snapshotId.startsWith('snapshot_')) return snapshotId.substring(9);
    return snapshotId;
}

// ============================================================================
// Customer Scoping - Apply customer isolation prefix
// ============================================================================

/**
 * Apply customer scope prefix to a key
 * @param customerId - Customer ID (null for global/public scope)
 * @param key - Base key
 * @returns Scoped key
 */
function applyCustomerScope(customerId: string | null, key: string): string {
    if (customerId) {
        return `customer_${customerId}_${key}`;
    }
    return key;
}

/**
 * Apply customer scope prefix for R2 storage (uses / instead of _)
 * @param customerId - Customer ID (null for global/public scope)
 * @param key - Base key
 * @returns Scoped R2 key
 */
function applyCustomerScopeR2(customerId: string | null, key: string): string {
    if (customerId) {
        return `customer_${customerId}/${key}`;
    }
    return key;
}

// ============================================================================
// KVKeys - Centralized Key Builder
// ============================================================================

export const KVKeys = {
    // ========================================================================
    // MOD KEYS
    // ========================================================================

    /**
     * Customer-scoped mod key
     * @example KVKeys.mod('cust_123', 'mod_abc') → 'customer_cust_123_mod_abc'
     * @example KVKeys.mod('cust_123', 'abc') → 'customer_cust_123_mod_abc'
     */
    mod(customerId: string, modId: string): string {
        const normalized = normalizeModId(modId);
        return applyCustomerScope(customerId, `mod_${normalized}`);
    },

    /**
     * Global/public mod key (no customer scope)
     * @example KVKeys.modGlobal('mod_abc') → 'mod_abc'
     * @example KVKeys.modGlobal('abc') → 'mod_abc'
     */
    modGlobal(modId: string): string {
        const normalized = normalizeModId(modId);
        return `mod_${normalized}`;
    },

    /**
     * Customer-scoped mod versions list key
     * @example KVKeys.modVersions('cust_123', 'mod_abc') → 'customer_cust_123_mod_abc_versions'
     */
    modVersions(customerId: string, modId: string): string {
        const normalized = normalizeModId(modId);
        return applyCustomerScope(customerId, `mod_${normalized}_versions`);
    },

    /**
     * Global mod versions list key
     * @example KVKeys.modVersionsGlobal('mod_abc') → 'mod_abc_versions'
     */
    modVersionsGlobal(modId: string): string {
        const normalized = normalizeModId(modId);
        return `mod_${normalized}_versions`;
    },

    /**
     * Customer-scoped mod snapshots list key
     * @example KVKeys.modSnapshots('cust_123', 'mod_abc') → 'customer_cust_123_mod_abc_snapshots'
     */
    modSnapshots(customerId: string, modId: string): string {
        const normalized = normalizeModId(modId);
        return applyCustomerScope(customerId, `mod_${normalized}_snapshots`);
    },

    // ========================================================================
    // VERSION KEYS
    // ========================================================================

    /**
     * Customer-scoped version key
     * @example KVKeys.version('cust_123', 'ver_xyz') → 'customer_cust_123_version_ver_xyz'
     */
    version(customerId: string, versionId: string): string {
        const normalized = normalizeVersionId(versionId);
        return applyCustomerScope(customerId, `version_${normalized}`);
    },

    /**
     * Global/public version key (no customer scope)
     * @example KVKeys.versionGlobal('ver_xyz') → 'version_ver_xyz'
     */
    versionGlobal(versionId: string): string {
        const normalized = normalizeVersionId(versionId);
        return `version_${normalized}`;
    },

    // ========================================================================
    // VARIANT KEYS
    // ========================================================================

    /**
     * Customer-scoped variant key
     * @example KVKeys.variant('cust_123', 'var_xyz') → 'customer_cust_123_variant_var_xyz'
     */
    variant(customerId: string, variantId: string): string {
        const normalized = normalizeVariantId(variantId);
        return applyCustomerScope(customerId, `variant_${normalized}`);
    },

    /**
     * Global variant key
     * @example KVKeys.variantGlobal('var_xyz') → 'variant_var_xyz'
     */
    variantGlobal(variantId: string): string {
        const normalized = normalizeVariantId(variantId);
        return `variant_${normalized}`;
    },

    /**
     * Customer-scoped variant versions list key
     * @example KVKeys.variantVersions('cust_123', 'var_xyz') → 'customer_cust_123_variant_var_xyz_versions'
     */
    variantVersions(customerId: string, variantId: string): string {
        const normalized = normalizeVariantId(variantId);
        return applyCustomerScope(customerId, `variant_${normalized}_versions`);
    },

    /**
     * Global variant versions list key
     * @example KVKeys.variantVersionsGlobal('var_xyz') → 'variant_var_xyz_versions'
     */
    variantVersionsGlobal(variantId: string): string {
        const normalized = normalizeVariantId(variantId);
        return `variant_${normalized}_versions`;
    },

    // ========================================================================
    // SNAPSHOT KEYS
    // ========================================================================

    /**
     * Customer-scoped snapshot key
     * @example KVKeys.snapshot('cust_123', 'snap_xyz') → 'customer_cust_123_snapshot_snap_xyz'
     */
    snapshot(customerId: string, snapshotId: string): string {
        const normalized = normalizeSnapshotId(snapshotId);
        return applyCustomerScope(customerId, `snapshot_${normalized}`);
    },

    /**
     * Global snapshot key
     * @example KVKeys.snapshotGlobal('snap_xyz') → 'snapshot_snap_xyz'
     */
    snapshotGlobal(snapshotId: string): string {
        const normalized = normalizeSnapshotId(snapshotId);
        return `snapshot_${normalized}`;
    },

    // ========================================================================
    // RATING KEYS
    // ========================================================================

    /**
     * Mod ratings list key (always global since ratings are public)
     * @example KVKeys.modRatings('mod_abc') → 'mod_abc_ratings'
     */
    modRatings(modId: string): string {
        const normalized = normalizeModId(modId);
        return `mod_${normalized}_ratings`;
    },

    /**
     * Individual rating key
     * @example KVKeys.rating('mod_abc', 'cust_123') → 'mod_abc_rating_cust_123'
     */
    rating(modId: string, customerId: string): string {
        const normalized = normalizeModId(modId);
        return `mod_${normalized}_rating_${customerId}`;
    },

    // ========================================================================
    // R2 KEYS (File Storage)
    // ========================================================================

    /**
     * Customer-scoped R2 file key
     * @example KVKeys.r2File('cust_123', 'mods/abc/file.jar') → 'customer_cust_123/mods/abc/file.jar'
     */
    r2File(customerId: string, path: string): string {
        return applyCustomerScopeR2(customerId, path);
    },

    /**
     * R2 mod file key
     * @example KVKeys.r2ModFile('cust_123', 'mod_abc', 'ver_xyz', 'file.jar') 
     *          → 'customer_cust_123/mods/abc/ver_xyz/file.jar'
     */
    r2ModFile(customerId: string, modId: string, versionId: string, fileName: string): string {
        const normalizedModId = normalizeModId(modId);
        return applyCustomerScopeR2(customerId, `mods/${normalizedModId}/${versionId}/${fileName}`);
    },

    /**
     * R2 thumbnail key
     * @example KVKeys.r2Thumbnail('cust_123', 'mod_abc') → 'customer_cust_123/thumbnails/abc.webp'
     */
    r2Thumbnail(customerId: string, modId: string): string {
        const normalizedModId = normalizeModId(modId);
        return applyCustomerScopeR2(customerId, `thumbnails/${normalizedModId}.webp`);
    },

    // ========================================================================
    // SLUG KEYS
    // ========================================================================

    /**
     * Slug to modId mapping key
     * @example KVKeys.slugMapping('my-cool-mod') → 'slug_my-cool-mod'
     */
    slugMapping(slug: string): string {
        return `slug_${slug}`;
    },

    /**
     * ModId to slug reverse mapping key
     * @example KVKeys.modSlugMapping('mod_abc') → 'mod_abc_slug'
     */
    modSlugMapping(modId: string): string {
        const normalized = normalizeModId(modId);
        return `mod_${normalized}_slug`;
    },

    // ========================================================================
    // UTILITY EXPORTS - For backward compatibility during migration
    // ========================================================================

    /**
     * Re-export normalizeModId for handlers that need direct access
     * DEPRECATED: Prefer using KVKeys methods which handle normalization internally
     */
    normalizeModId,

    /**
     * Re-export for backward compatibility
     * DEPRECATED: Use specific KVKeys methods instead
     */
    applyCustomerScope,
};

// Re-export individual functions for backward compatibility during migration
export { normalizeModId, applyCustomerScope as getCustomerKey };
