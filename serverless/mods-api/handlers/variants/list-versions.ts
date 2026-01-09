/**
 * List Variant Versions Handler
 * GET /mods/:modId/variants/:variantId/versions
 * Returns all versions for a variant
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { getVariantVersions } from '../../utils/variant-versions.js';
import type { ModMetadata, VariantVersion } from '../../types/mod.js';

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

/**
 * Handle list variant versions request
 */
export async function handleListVariantVersions(
    request: Request,
    env: Env,
    modId: string,
    variantId: string,
    auth: { customerId: string; email?: string } | null
): Promise<Response> {
    try {
        // Get mod metadata
        const normalizedModId = normalizeModId(modId);
        let mod: ModMetadata | null = null;
        let modKey: string | null = null;
        let modCustomerId: string | null = null;
        
        // Try auth customer scope first
        if (auth?.customerId) {
            modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
            mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
            if (mod) {
                modCustomerId = auth.customerId;
            }
        }
        
        // Try global scope if not found
        if (!mod) {
            modKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
            if (mod) {
                modCustomerId = null; // Global scope
            }
        }
        
        // Search all customer scopes as fallback
        if (!mod) {
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                for (const key of listResult.keys) {
                    if (key.name.endsWith('_mods_list')) {
                        const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                        const customerId = match ? match[1] : null;
                        if (customerId) {
                            const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            if (mod) {
                                modKey = customerModKey;
                                modCustomerId = customerId;
                                break;
                            }
                        }
                    }
                }
                if (mod) break;
                cursor = listResult.list_complete ? undefined : (listResult as any).cursor;
            } while (cursor);
        }

        if (!mod || !modKey) {
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Find the variant in mod metadata
        const variant = mod.variants?.find(v => v.variantId === variantId);
        
        // If variant doesn't exist in mod metadata, return empty list
        // DO NOT clean up - variant might be valid but just not in this mod
        if (!variant) {
            console.warn('[ListVariantVersions] Variant not found in mod metadata:', {
                modId: mod.modId,
                variantId,
            });
            
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify({ versions: [] }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Try to load variant versions
        let versions: VariantVersion[] = [];
        try {
            versions = await getVariantVersions(variantId, modCustomerId, env);
        } catch (error) {
            console.error('[ListVariantVersions] Error loading variant versions:', error);
            versions = [];
        }

        // NOTE: Do NOT clean up variants with zero versions!
        // Variants can legitimately have no versions if they're newly created.
        // Only clean up truly orphaned data (when files are missing from R2, etc.)

        // Return versions (empty array if none exist)
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify({ versions }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('[ListVariantVersions] Error:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to list variant versions'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
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
