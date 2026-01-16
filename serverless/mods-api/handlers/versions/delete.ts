/**
 * Delete Version Handler
 * Deletes a specific version of a mod
 */

import { createError } from '../../utils/errors.js';
import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomerKey } from '../../utils/customer.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

interface Auth {
    customerId: string;
    jwtToken: string;
}

export async function handleDeleteVersion(
    request: Request,
    env: Env,
    modId: string,
    versionId: string,
    auth: Auth | null
): Promise<Response> {
    const corsHeaders = getCorsHeaders(env, request);

    if (!auth) {
        const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required to delete versions');
        return new Response(JSON.stringify(rfcError), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }

    try {
        // Get mod metadata to verify ownership
        const modKey = getCustomerKey(auth.customerId, `mod_${modId}`);
        const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;

        if (!mod) {
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Verify ownership
        if (mod.customerId !== auth.customerId) {
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to delete this version');
            return new Response(JSON.stringify(rfcError), {
                status: 403,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get the version
        const versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
        const version = await env.MODS_KV.get(versionKey, { type: 'json' }) as ModVersion | null;

        if (!version) {
            const rfcError = createError(request, 404, 'Version Not Found', 'The requested version was not found');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Verify the version belongs to this mod
        if (version.modId !== modId) {
            const rfcError = createError(request, 400, 'Invalid Version', 'This version does not belong to the specified mod');
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Delete R2 file if exists
        if (version.r2Key) {
            try {
                await env.MODS_R2.delete(version.r2Key);
                console.log('[DeleteVersion] Deleted R2 file:', version.r2Key);
            } catch (r2Error) {
                console.error('[DeleteVersion] Failed to delete R2 file:', version.r2Key, r2Error);
                // Continue with metadata deletion even if R2 fails
            }
        }

        // Delete version metadata
        await env.MODS_KV.delete(versionKey);

        // Remove from mod's version list
        const versionListKey = getCustomerKey(auth.customerId, `mod_${modId}_versions`);
        const versionIds = await env.MODS_KV.get(versionListKey, { type: 'json' }) as string[] | null;
        
        if (versionIds) {
            const updatedList = versionIds.filter(id => id !== versionId);
            await env.MODS_KV.put(versionListKey, JSON.stringify(updatedList));
        }

        // Update mod's currentVersionId if this was the current version
        if (mod.currentVersionId === versionId) {
            // Get remaining versions and set the most recent as current
            const remainingVersionIds = versionIds?.filter(id => id !== versionId) || [];
            
            if (remainingVersionIds.length > 0) {
                // Fetch remaining versions to find the most recent
                const remainingVersions: ModVersion[] = [];
                for (const vid of remainingVersionIds) {
                    const vKey = getCustomerKey(auth.customerId, `version_${vid}`);
                    const v = await env.MODS_KV.get(vKey, { type: 'json' }) as ModVersion | null;
                    if (v) remainingVersions.push(v);
                }
                
                // Sort by createdAt descending
                remainingVersions.sort((a, b) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                
                mod.currentVersionId = remainingVersions[0]?.versionId || null;
            } else {
                mod.currentVersionId = null;
            }
            
            mod.updatedAt = new Date().toISOString();
            await env.MODS_KV.put(modKey, JSON.stringify(mod));
            
            // Update global key if public
            if (mod.visibility === 'public') {
                await env.MODS_KV.put(`mod_${modId}`, JSON.stringify(mod));
            }
        }

        console.log('[DeleteVersion] Successfully deleted version:', {
            modId,
            versionId,
            version: version.version,
        });

        return new Response(JSON.stringify({ success: true, message: 'Version deleted successfully' }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('[DeleteVersion] Error:', error);
        const rfcError = createError(
            request,
            500,
            'Delete Failed',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to delete version'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}
