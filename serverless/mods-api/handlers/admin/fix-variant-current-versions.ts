/**
 * Migration: Fix Variants Missing currentVersionId
 * 
 * Problem: Due to a bug in mod update logic, some variants had their currentVersionId
 * overwritten to null/undefined when metadata was updated. This migration finds those
 * variants and restores their currentVersionId by finding the latest version.
 * 
 * When to Run: After deploying the fix for currentVersionId overwrite bug
 * 
 * Usage:
 *   Dry Run: GET /admin/migrate/fix-variant-versions?dryRun=true
 *   Actual:  POST /admin/migrate/fix-variant-versions
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import type { ModMetadata, ModVariant } from '../../types/mod.js';
import type { Env } from '../../worker.js';

interface MigrationResult {
    totalMods: number;
    modsWithVariants: number;
    variantsChecked: number;
    variantsFixed: number;
    variantsAlreadyValid: number;
    variantsSkipped: number;
    errors: Array<{ modId: string; variantId: string; error: string }>;
    fixedVariants: Array<{ modId: string; modTitle: string; variantId: string; variantName: string; restoredVersionId: string }>;
}

/**
 * Fix variants missing currentVersionId
 */
export async function handleFixVariantCurrentVersions(
    request: Request,
    env: Env,
    dryRun: boolean = false
): Promise<Response> {
    const startTime = Date.now();
    console.log(`[FixVariantVersions] Starting migration (dryRun: ${dryRun})...`);
    
    const result: MigrationResult = {
        totalMods: 0,
        modsWithVariants: 0,
        variantsChecked: 0,
        variantsFixed: 0,
        variantsAlreadyValid: 0,
        variantsSkipped: 0,
        errors: [],
        fixedVariants: [],
    };
    
    try {
        // Get all customer IDs from the KV (list all keys starting with 'customer_')
        const { keys } = await env.MODS_KV.list({ prefix: 'customer_' });
        const customerIds = new Set<string>();
        
        for (const key of keys) {
            // Extract customerId from keys like 'customer_abc123_mod_xyz'
            const match = key.name.match(/^customer_([^_]+)_/);
            if (match) {
                customerIds.add(match[1]);
            }
        }
        
        console.log(`[FixVariantVersions] Found ${customerIds.size} customers`);
        
        // Process each customer's mods
        for (const customerId of customerIds) {
            // Get all mods for this customer
            const { keys: modKeys } = await env.MODS_KV.list({ prefix: `customer_${customerId}_mod_` });
            const mods: ModMetadata[] = [];
            
            for (const key of modKeys) {
                const modData = await env.MODS_KV.get(key.name);
                if (modData) {
                    try {
                        mods.push(JSON.parse(modData));
                    } catch (error) {
                        console.warn(`[FixVariantVersions] Failed to parse mod:`, key.name);
                    }
                }
            }
            
            result.totalMods += mods.length;
            
            for (const mod of mods) {
                if (!mod.variants || mod.variants.length === 0) {
                    continue;
                }
                
                result.modsWithVariants++;
                let modNeedsUpdate = false;
                const updatedVariants: ModVariant[] = [];
                
                for (const variant of mod.variants) {
                    result.variantsChecked++;
                    
                    // Check if variant is missing currentVersionId
                    if (variant.currentVersionId) {
                        result.variantsAlreadyValid++;
                        updatedVariants.push(variant);
                        continue;
                    }
                    
                    console.log(`[FixVariantVersions] Found variant without currentVersionId:`, {
                        modId: mod.modId,
                        modTitle: mod.title,
                        variantId: variant.variantId,
                        variantName: variant.name,
                    });
                    
                    try {
                        // Get all versions for this variant
                        const versionListKey = `variant_${variant.variantId}_versions`;
                        const versionListData = await env.MODS_KV.get(versionListKey);
                        const versionIds: string[] = versionListData ? JSON.parse(versionListData) : [];
                        
                        if (!versionIds || versionIds.length === 0) {
                            console.warn(`[FixVariantVersions] Variant has no versions:`, {
                                modId: mod.modId,
                                variantId: variant.variantId,
                            });
                            result.variantsSkipped++;
                            result.errors.push({
                                modId: mod.modId,
                                variantId: variant.variantId,
                                error: 'No versions found for variant',
                            });
                            updatedVariants.push(variant);
                            continue;
                        }
                        
                        // Get the latest version ID (versions are sorted newest first)
                        const latestVersionId = versionIds[0];
                        
                        console.log(`[FixVariantVersions] Found latest version:`, {
                            modId: mod.modId,
                            variantId: variant.variantId,
                            latestVersionId: latestVersionId,
                        });
                        
                        // Update the variant with the latest version ID
                        const updatedVariant: ModVariant = {
                            ...variant,
                            currentVersionId: latestVersionId,
                        };
                        
                        updatedVariants.push(updatedVariant);
                        modNeedsUpdate = true;
                        result.variantsFixed++;
                        result.fixedVariants.push({
                            modId: mod.modId,
                            modTitle: mod.title,
                            variantId: variant.variantId,
                            variantName: variant.name,
                            restoredVersionId: latestVersionId,
                        });
                    } catch (error) {
                        console.error(`[FixVariantVersions] Error processing variant:`, {
                            modId: mod.modId,
                            variantId: variant.variantId,
                            error,
                        });
                        result.errors.push({
                            modId: mod.modId,
                            variantId: variant.variantId,
                            error: error instanceof Error ? error.message : String(error),
                        });
                        updatedVariants.push(variant);
                    }
                }
                
                // Save updated mod if any variants were fixed
                if (modNeedsUpdate && !dryRun) {
                    const updatedMod: ModMetadata = {
                        ...mod,
                        variants: updatedVariants,
                        updatedAt: new Date().toISOString(),
                    };
                    
                    const modKey = `customer_${customerId}_${mod.modId}`;
                    await env.MODS_KV.put(modKey, JSON.stringify(updatedMod));
                    
                    console.log(`[FixVariantVersions] ✓ Saved updated mod:`, {
                        modId: mod.modId,
                        variantsFixed: updatedVariants.filter(v => v.currentVersionId).length,
                    });
                }
            }
        }
        
        const duration = Date.now() - startTime;
        console.log(`[FixVariantVersions] Migration complete (${duration}ms)`, result);
        
        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify({
            success: true,
            dryRun,
            duration: `${duration}ms`,
            result,
            message: dryRun
                ? `Dry run complete. Found ${result.variantsFixed} variants that need fixing.`
                : `Migration complete. Fixed ${result.variantsFixed} variants.`,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error) {
        console.error('[FixVariantVersions] Migration failed:', error);
        
        const rfcError = createError(
            request,
            500,
            'Migration Failed',
            error instanceof Error ? error.message : 'Unknown error'
        );
        
        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}
