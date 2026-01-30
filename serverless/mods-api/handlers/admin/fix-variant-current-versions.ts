/**
 * Migration: Fix Variants Missing currentVersionId
 * 
 * Uses the new kv-entities pattern to find and fix variants missing currentVersionId
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getExistingEntities,
    indexGet,
    putEntity,
} from '@strixun/kv-entities';
import type { ModMetadata, ModVariant, VariantVersion } from '../../types/mod.js';
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
        // Get all mod IDs from all indexes
        const publicModIds = await indexGet(env.MODS_KV, 'mods', 'by-visibility', 'public');
        const privateModIds = await indexGet(env.MODS_KV, 'mods', 'by-visibility', 'private');
        const allModIds = [...new Set([...publicModIds, ...privateModIds])];

        // Fetch all mods
        const mods = await getExistingEntities<ModMetadata>(env.MODS_KV, 'mods', 'mod', allModIds);
        result.totalMods = mods.length;

        for (const mod of mods) {
            if (!mod.variants || mod.variants.length === 0) {
                continue;
            }

            result.modsWithVariants++;
            let modNeedsUpdate = false;
            const updatedVariants: ModVariant[] = [];

            for (const variant of mod.variants) {
                result.variantsChecked++;

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
                    const versionIds = await indexGet(env.MODS_KV, 'mods', 'versions-for', variant.variantId);

                    if (versionIds.length === 0) {
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

                    // Fetch versions to find the latest one
                    const versions = await getExistingEntities<VariantVersion>(env.MODS_KV, 'mods', 'version', versionIds);
                    versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                    const latestVersionId = versions[0]?.versionId;
                    if (!latestVersionId) {
                        result.variantsSkipped++;
                        updatedVariants.push(variant);
                        continue;
                    }

                    console.log(`[FixVariantVersions] Found latest version:`, {
                        modId: mod.modId,
                        variantId: variant.variantId,
                        latestVersionId,
                    });

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

            if (modNeedsUpdate && !dryRun) {
                const updatedMod: ModMetadata = {
                    ...mod,
                    variants: updatedVariants,
                    updatedAt: new Date().toISOString(),
                };

                await putEntity(env.MODS_KV, 'mods', 'mod', mod.modId, updatedMod);

                console.log(`[FixVariantVersions] Saved updated mod:`, {
                    modId: mod.modId,
                    variantsFixed: updatedVariants.filter(v => v.currentVersionId).length,
                });
            }
        }

        const duration = Date.now() - startTime;
        console.log(`[FixVariantVersions] Migration complete (${duration}ms)`, result);

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
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error) {
        console.error('[FixVariantVersions] Migration failed:', error);
        const rfcError = createError(request, 500, 'Migration Failed', error instanceof Error ? error.message : 'Unknown error');
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: { 'Content-Type': 'application/problem+json', ...corsHeaders(request, env) },
        });
    }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
    const headers = createCORSHeaders(request, {
        credentials: true,
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });
    return Object.fromEntries(headers.entries());
}
