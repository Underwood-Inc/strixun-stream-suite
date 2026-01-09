/**
 * Delete Variant Version Handler
 * DELETE /mods/:modId/variants/:variantId/versions/:variantVersionId
 * Allows mod authors to delete their variant version uploads
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { deleteVariantVersion } from '../../utils/variant-versions.js';
import { isSuperAdminEmail } from '../../utils/admin.js';
import type { ModMetadata } from '../../types/mod.js';

/**
 * Handle delete variant version request
 * Allows mod authors (or admins) to delete a specific variant version
 */
export async function handleDeleteVariantVersion(
    request: Request,
    env: Env,
    modId: string,
    variantId: string,
    variantVersionId: string,
    auth: { customerId: string; email?: string }
): Promise<Response> {
    try {
        // Normalize modId
        const normalizedModId = normalizeModId(modId);
        
        // Get mod metadata to verify ownership
        const modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;

        if (!mod) {
            // Try global scope
            const globalModKey = `mod_${normalizedModId}`;
            const globalMod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (!globalMod) {
                const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return new Response(JSON.stringify(rfcError), {
                    status: 404,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                });
            }
            // Check authorization for global mod
            const isAdmin = isSuperAdminEmail(auth.email || '', env);
            if (globalMod.authorId !== auth.customerId && !isAdmin) {
                const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to delete this variant version');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return new Response(JSON.stringify(rfcError), {
                    status: 403,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                });
            }
        } else {
            // Check authorization for customer-scoped mod
            const isAdmin = isSuperAdminEmail(auth.email || '', env);
            if (mod.authorId !== auth.customerId && !isAdmin) {
                const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to delete this variant version');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return new Response(JSON.stringify(rfcError), {
                    status: 403,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                });
            }
        }

        // Verify variant belongs to this mod
        const modVariants = (mod || await env.MODS_KV.get(`mod_${normalizedModId}`, { type: 'json' }) as ModMetadata | null)?.variants || [];
        const variant = modVariants.find(v => v.variantId === variantId);
        
        if (!variant) {
            const rfcError = createError(request, 404, 'Variant Not Found', 'The requested variant was not found for this mod');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Delete the variant version
        await deleteVariantVersion(variantVersionId, auth.customerId, env);

        console.log('[DeleteVariantVersion] Successfully deleted variant version:', {
            modId,
            variantId,
            variantVersionId,
            customerId: auth.customerId,
        });

        // Return success response
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Variant version deleted successfully',
            variantVersionId,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('[DeleteVariantVersion] Error:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to delete variant version'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
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

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}
