/**
 * Update variant handler
 * PUT /mods/:modId/variants/:variantId
 * Updates an existing variant's metadata (name, description)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import type { ModMetadata } from '../../types/mod.js';
import type { Env } from '../../worker.js';

export interface UpdateVariantRequest {
    name?: string;
    description?: string;
}

/**
 * Handle update variant request
 */
export async function handleUpdateVariant(
    request: Request,
    env: Env,
    modId: string,
    variantId: string,
    auth: { customerId: string }
): Promise<Response> {
    try {
        // Parse request body
        const body = await request.json() as UpdateVariantRequest;

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
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to update this variant');
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

        // Find variant
        if (!mod.variants) {
            mod.variants = [];
        }

        const variantIndex = mod.variants.findIndex(v => v.variantId === variantId);
        if (variantIndex === -1) {
            const rfcError = createError(request, 404, 'Variant Not Found', 'The requested variant was not found');
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

        // Update variant metadata (only user-editable fields)
        const variant = mod.variants[variantIndex];
        
        if (body.name !== undefined) {
            if (!body.name || body.name.trim().length === 0) {
                const rfcError = createError(request, 400, 'Invalid Variant Data', 'Variant name cannot be empty');
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
            variant.name = body.name.trim();
        }

        if (body.description !== undefined) {
            variant.description = body.description.trim();
        }

        variant.updatedAt = new Date().toISOString();
        mod.variants[variantIndex] = variant;
        mod.updatedAt = new Date().toISOString();

        // Save updated mod
        await env.MODS_KV.put(modKey, JSON.stringify(mod));

        // Also update in global scope if mod is public
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${normalizedModId}`;
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
        }

        console.log('[UpdateVariant] Variant updated:', {
            modId: normalizedModId,
            variantId,
            updates: body
        });

        // Return updated variant
        const corsHeaders = createCORSHeaders(request, { 
            credentials: true, 
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*']
        });
        
        return new Response(JSON.stringify({ variant }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });

    } catch (error: any) {
        console.error('[UpdateVariant] Error:', error);
        const rfcError = createError(request, 500, 'Internal Server Error', error.message || 'Failed to update variant');
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
