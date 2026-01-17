/**
 * Create variant handler
 * POST /mods/:modId/variants
 * Creates a new variant for a specific mod version
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import type { ModMetadata, ModVariant } from '../../types/mod.js';
import type { Env } from '../../worker.js';

export interface CreateVariantRequest {
    name: string;
    description?: string;
    parentVersionId: string; // Required: variants must be tied to a specific mod version
}

/**
 * Handle create variant request
 */
export async function handleCreateVariant(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string }
): Promise<Response> {
    try {
        // Parse request body
        const body = await request.json() as CreateVariantRequest;

        // Validate required fields
        if (!body.name || body.name.trim().length === 0) {
            const rfcError = createError(request, 400, 'Invalid Variant Data', 'Variant name is required and cannot be empty');
            const corsHeaders = createCORSHeaders(request, { 
                credentials: true, 
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*']
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        if (!body.parentVersionId) {
            const rfcError = createError(request, 400, 'Invalid Variant Data', 'parentVersionId is required');
            const corsHeaders = createCORSHeaders(request, { 
                credentials: true, 
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*']
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get mod metadata
        const normalizedModId = normalizeModId(modId);
        const modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;

        if (!mod) {
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
            const corsHeaders = createCORSHeaders(request, { 
                credentials: true, 
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*']
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Check authorization
        if (mod.authorId !== auth.customerId) {
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to create variants for this mod');
            const corsHeaders = createCORSHeaders(request, { 
                credentials: true, 
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*']
            });
            return new Response(JSON.stringify(rfcError), {
                status: 403,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Verify parent version exists
        const versionsListKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}_versions`);
        const versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
        
        if (!versionsList || !versionsList.includes(body.parentVersionId)) {
            const rfcError = createError(request, 400, 'Invalid Parent Version', 'The specified parentVersionId does not exist');
            const corsHeaders = createCORSHeaders(request, { 
                credentials: true, 
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*']
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Generate variant ID
        const variantId = `variant-${Date.now()}`;
        const now = new Date().toISOString();

        // Create variant metadata
        const variant: ModVariant = {
            variantId,
            modId: normalizedModId,
            parentVersionId: body.parentVersionId,
            name: body.name.trim(),
            description: body.description?.trim() || '',
            currentVersionId: null, // No versions yet - will be set when file is uploaded
            createdAt: now,
            updatedAt: now,
            versionCount: 0,
            totalDownloads: 0,
        };

        // Add to mod's variants array
        if (!mod.variants) {
            mod.variants = [];
        }
        mod.variants.push(variant);
        mod.updatedAt = now;

        // Save updated mod
        await env.MODS_KV.put(modKey, JSON.stringify(mod));

        // Also update in global scope if mod is public
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${normalizedModId}`;
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
        }

        console.log('[CreateVariant] Variant created:', {
            modId: normalizedModId,
            variantId,
            name: variant.name,
            parentVersionId: variant.parentVersionId
        });

        // Return created variant
        const corsHeaders = createCORSHeaders(request, { 
            credentials: true, 
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*']
        });
        
        return new Response(JSON.stringify({ variant }), {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });

    } catch (error: any) {
        console.error('[CreateVariant] Error:', error);
        const rfcError = createError(request, 500, 'Internal Server Error', error.message || 'Failed to create variant');
        const corsHeaders = createCORSHeaders(request, { 
            credentials: true, 
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*']
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
