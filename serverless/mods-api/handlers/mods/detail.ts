/**
 * Get mod detail handler
 * GET /mods/:slug
 * Accepts slug (URL-friendly identifier) and looks up mod by slug
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
import type { ModMetadata, ModVersion, ModDetailResponse, VariantVersion } from '../../types/mod.js';
import type { AuthResult } from '../../utils/auth.js';

/**
 * Handle get mod detail request
 * CRITICAL: modId parameter must be the actual modId, not a slug
 * Slug-to-modId resolution should happen in the router before calling this handler
 */
export async function handleGetModDetail(
    request: Request,
    env: Env,
    modId: string,
    auth: AuthResult | null
): Promise<Response> {
    try {
        // Check if customer is super admin (needed for filtering)
        let isAdmin = false;
        if (auth?.customerId) {
            const { isSuperAdmin } = await import('../../utils/admin.js');
            isAdmin = await isSuperAdmin(auth.customerId, auth.jwtToken, env);
        }
        
        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        // Use modId directly - it already includes 'mod_' prefix
        let mod: ModMetadata | null = null;
        
        // Check customer scope first if authenticated
        if (auth?.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, modId);
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // Fall back to global scope if not found
        if (!mod) {
            const globalModKey = modId;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // If still not found, search all customer scopes (for cross-customer access)
        if (!mod) {
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                for (const key of listResult.keys) {
                    // Match both customer_{id}_mods_list and customer_{id}/mods_list patterns
                    if (key.name.endsWith('_mods_list') || key.name.endsWith('/mods_list')) {
                        // CRITICAL: Customer IDs can contain underscores (e.g., cust_2233896f662d)
                        // Extract everything between "customer_" and the final "_mods_list" or "/mods_list"
                        let customerId: string | null = null;
                        if (key.name.endsWith('_mods_list')) {
                            const match = key.name.match(/^customer_(.+)_mods_list$/);
                            customerId = match ? match[1] : null;
                        } else if (key.name.endsWith('/mods_list')) {
                            const match = key.name.match(/^customer_(.+)\/mods_list$/);
                            customerId = match ? match[1] : null;
                        }
                        
                        if (customerId) {
                            const customerModKey = getCustomerKey(customerId, modId);
                            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            if (mod) break;
                        }
                    }
                }
                if (mod) break;
                cursor = listResult.list_complete ? undefined : listResult.cursor;
            } while (cursor);
        }
        
        // CRITICAL: Filter mods that don't meet visibility/status requirements
        if (mod && !isAdmin) {
            const modVisibility = mod.visibility || 'public';
            const modStatus = mod.status || 'published';
            // For non-super customers: ONLY public, published/approved mods are allowed
            const isAllowedStatus = modStatus === 'published' || modStatus === 'approved';
            if (modVisibility !== 'public' || !isAllowedStatus) {
                // Only allow if customer is the author
                if (mod.authorId !== auth?.customerId) {
                    mod = null; // Filter out - don't show to non-authors
                }
            }
        }
        
        if (!mod) {
            const rfcError = createError(
                request,
                404,
                'Mod Not Found',
                'The requested mod was not found'
            );
            const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }
        
        // Use mod.modId directly - no normalization needed
        const storedModId = mod.modId;

        // isAdmin already checked above
        const isAuthor = mod.authorId === auth?.customerId;
        
        // CRITICAL: Enforce strict visibility and status filtering
        // Only super admins can bypass these checks
        if (!isAdmin) {
            // For non-super users: ONLY public, published mods are allowed
            // Legacy mods without proper fields are filtered out
            
            // Check visibility: MUST be 'public'
            // Legacy mods without visibility field are treated as public
            const modVisibility = mod.visibility || 'public';
            if (modVisibility !== 'public') {
                // Only show private/unlisted mods to their author
                if (mod.authorId !== auth?.customerId) {
                    const rfcError = createError(
                        request,
                        404,
                        'Mod Not Found',
                        'The requested mod was not found'
                    );
                    const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
                    });
                    return new Response(JSON.stringify(rfcError), {
                        status: 404,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    });
                }
            }
            
            // Check status: MUST be 'published' or 'approved'
            // Legacy mods without status field are treated as published
            const modStatus = mod.status || 'published';
            const isAllowedStatus = modStatus === 'published' || modStatus === 'approved';
            if (!isAllowedStatus) {
                // Only show non-published/approved mods to their author
                if (!isAuthor) {
                    const rfcError = createError(
                        request,
                        404,
                        'Mod Not Found',
                        'The requested mod was not found'
                    );
                    const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
                    });
                    return new Response(JSON.stringify(rfcError), {
                        status: 404,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    });
                }
            }
        } else {
            // Super admins: check visibility but allow all statuses
            if (mod.visibility === 'private' && mod.authorId !== auth?.customerId) {
                const rfcError = createError(
                    request,
                    404,
                    'Mod Not Found',
                    'The requested mod was not found'
                );
                const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
                });
                return new Response(JSON.stringify(rfcError), {
                    status: 404,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                });
            }
        }

        // Get all versions - try global scope first, then mod's customer scope
        // CRITICAL: Use mod.customerId (where mod was uploaded), not auth.customerId
        let versionIds: string[] = [];
        
        // Check global scope first
        // Use storedModId directly - it already includes 'mod_' prefix
        const globalVersionsKey = `${storedModId}_versions`;
        const globalVersionsData = await env.MODS_KV.get(globalVersionsKey, { type: 'json' }) as string[] | null;
        if (globalVersionsData) {
            versionIds = globalVersionsData;
        } else if (mod.customerId) {
            // Fall back to mod's customer scope (where it was uploaded)
            const customerVersionsKey = getCustomerKey(mod.customerId, `${storedModId}_versions`);
            const customerVersionsData = await env.MODS_KV.get(customerVersionsKey, { type: 'json' }) as string[] | null;
            versionIds = customerVersionsData || [];
        } else if (auth?.customerId) {
            // Last resort: try auth customer's scope (for backward compatibility)
            const customerVersionsKey = getCustomerKey(auth.customerId, `${storedModId}_versions`);
            const customerVersionsData = await env.MODS_KV.get(customerVersionsKey, { type: 'json' }) as string[] | null;
            versionIds = customerVersionsData || [];
        }

        const versions: ModVersion[] = [];
        for (const versionId of versionIds) {
            // Try global scope first, then mod's customer scope
            let version: ModVersion | null = null;
            
            const globalVersionKey = `version_${versionId}`;
            version = await env.MODS_KV.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
            
            if (!version && mod.customerId) {
                // Try mod's customer scope (where version was uploaded)
                const customerVersionKey = getCustomerKey(mod.customerId, `version_${versionId}`);
                version = await env.MODS_KV.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
            }
            
            if (!version && auth?.customerId && auth.customerId !== mod.customerId) {
                // Last resort: try auth customer's scope (for backward compatibility)
                const customerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
                version = await env.MODS_KV.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
            }
            
            if (version) {
                versions.push(version);
            }
        }

        // Sort versions by semantic version (newest first)
        versions.sort((a, b) => {
            const aParts = a.version.split('.').map(Number);
            const bParts = b.version.split('.').map(Number);
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aPart = aParts[i] || 0;
                const bPart = bParts[i] || 0;
                if (aPart !== bPart) {
                    return bPart - aPart;
                }
            }
            return 0;
        });

        // CRITICAL: Ensure mod has customerId (for data scoping)
        // Set customerId from auth context if missing (for legacy mods)
        // Only use auth.customerId if the current customer is the mod author
        let modKeyToSave: string | null = null;
        if (!mod.customerId && auth?.customerId && mod.authorId === auth.customerId) {
            console.log('[GetModDetail] Setting missing customerId on legacy mod:', {
                modId: mod.modId,
                customerId: auth.customerId,
                authorId: mod.authorId,
                currentCustomerId: auth.customerId
            });
            mod.customerId = auth.customerId;
            
            // Determine the correct modKey to save to
            // Try customer scope first, then global scope
            modKeyToSave = getCustomerKey(auth.customerId, mod.modId);
            const globalModKey = mod.modId;
            const existingMod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (existingMod && existingMod.modId === mod.modId) {
                // Mod exists in global scope, save to both customer and global
                modKeyToSave = globalModKey;
            }
        }

        // CRITICAL: Fetch author display name from customer data
        // Customer is the primary data source for all customizable customer info
        // Look up customer by mod.customerId to get displayName
        const storedDisplayName = mod.authorDisplayName; // Preserve as fallback only
        let fetchedDisplayName: string | null = null;
        
        if (mod.customerId) {
            const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
            fetchedDisplayName = await fetchDisplayNameByCustomerId(mod.customerId, env);
            if (fetchedDisplayName) {
                console.log('[GetModDetail] Fetched authorDisplayName from customer data:', { 
                    authorDisplayName: fetchedDisplayName, 
                    customerId: mod.customerId,
                    modId: mod.modId
                });
            } else {
                console.warn('[GetModDetail] Could not fetch displayName from customer data:', {
                    customerId: mod.customerId,
                    modId: mod.modId
                });
            }
        } else {
            console.warn('[GetModDetail] Mod missing customerId, cannot fetch displayName from customer data:', {
                modId: mod.modId,
                authorId: mod.authorId
            });
        }
        
        // Always prefer fetched value from customer data - it's the source of truth
        // Fall back to stored value only if fetch failed (for backward compatibility)
        mod.authorDisplayName = fetchedDisplayName || storedDisplayName || null;
        
        if (!fetchedDisplayName && !storedDisplayName) {
            console.warn('[GetModDetail] Could not fetch authorDisplayName and no stored value available:', {
                customerId: mod.customerId,
                modId: mod.modId
            });
        }

        // Persist customerId update to KV if we set it (non-blocking)
        if (modKeyToSave) {
            env.MODS_KV.put(modKeyToSave, JSON.stringify(mod)).catch(error => {
                console.error('[GetModDetail] Failed to persist customerId update:', error);
            });
        }

        // Populate fileName for each variant from its current VariantVersion
        if (mod.variants && mod.variants.length > 0) {
            for (const variant of mod.variants) {
                if (variant.currentVersionId) {
                    const variantVersionKey = `variantversion:${variant.currentVersionId}`;
                    const variantVersion = await env.MODS_KV.get(variantVersionKey, { type: 'json' }) as VariantVersion | null;
                    if (variantVersion && variantVersion.fileName) {
                        variant.fileName = variantVersion.fileName;
                    }
                }
            }
        }

        const response: ModDetailResponse = {
            mod,
            versions
        };

        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Get mod detail error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Get Mod Detail',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while fetching mod details'
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

interface Env {
    MODS_KV: KVNamespace;
    ENVIRONMENT?: string;
    [key: string]: any;
}

