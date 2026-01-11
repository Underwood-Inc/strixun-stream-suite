/**
 * List Variant Versions Handler
 * GET /mods/:modId/variants/:variantId/versions
 * Returns all versions for a specific variant
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
import type { ModVersion } from '../../types/mod.js';
import type { Env } from '../../worker.js';

export async function handleListVariantVersions(
    request: Request,
    env: Env,
    _modId: string,
    variantId: string,
    auth: { customerId: string } | null
): Promise<Response> {
    try {
        // Get the variant's version list
        const variantVersionsListKey = auth 
            ? getCustomerKey(auth.customerId, `variant_${variantId}_versions`)
            : `variant_${variantId}_versions`;
            
        const versionIds = await env.MODS_KV.get(variantVersionsListKey, { type: 'json' }) as string[] | null;

        if (!versionIds || versionIds.length === 0) {
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

        // Fetch all version metadata
        const versions: ModVersion[] = [];
        for (const versionId of versionIds) {
            const versionKey = auth 
                ? getCustomerKey(auth.customerId, `version_${versionId}`)
                : `version_${versionId}`;
                
            const version = await env.MODS_KV.get(versionKey, { type: 'json' }) as ModVersion | null;
            if (version) {
                versions.push(version);
            }
        }

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
    } catch (error) {
        console.error('[ListVariantVersions] Error:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            'Failed to list variant versions'
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
