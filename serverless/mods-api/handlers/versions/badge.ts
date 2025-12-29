/**
 * File integrity badge handler
 * GET /mods/:modId/versions/:versionId/badge
 * Generates SVG badge showing file integrity verification status
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { formatStrixunHash } from '../../utils/hash.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

/**
 * Generate SVG badge for file integrity
 */
function generateBadge(verified: boolean, hash: string, style: 'flat' | 'flat-square' | 'plastic' = 'flat'): string {
    const status = verified ? 'verified' : 'unverified';
    const color = verified ? '#4caf50' : '#f44336';
    const textColor = '#fff';
    const label = 'Strixun';
    const message = verified ? 'Verified' : 'Unverified';
    
    // Calculate text widths (approximate)
    const labelWidth = label.length * 6 + 10;
    const messageWidth = message.length * 6 + 10;
    const totalWidth = labelWidth + messageWidth;
    const height = 20;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">`;
    
    if (style === 'flat-square') {
        svg += `<rect width="${totalWidth}" height="${height}" fill="#555"/>`;
        svg += `<rect x="${labelWidth}" width="${messageWidth}" height="${height}" fill="${color}"/>`;
    } else if (style === 'plastic') {
        svg += `<linearGradient id="bg" x2="0" y2="100%">`;
        svg += `<stop offset="0" stop-color="#bbb" stop-opacity=".1"/>`;
        svg += `<stop offset="1" stop-opacity=".1"/>`;
        svg += `</linearGradient>`;
        svg += `<rect width="${totalWidth}" height="${height}" fill="#555"/>`;
        svg += `<rect x="${labelWidth}" width="${messageWidth}" height="${height}" fill="${color}"/>`;
        svg += `<rect width="${totalWidth}" height="${height}" fill="url(#bg)"/>`;
    } else {
        // flat (default)
        svg += `<rect width="${totalWidth}" height="${height}" rx="3" fill="#555"/>`;
        svg += `<rect x="${labelWidth}" width="${messageWidth}" height="${height}" rx="3" fill="${color}"/>`;
    }
    
    svg += `<g fill="${textColor}" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">`;
    svg += `<text x="${labelWidth / 2}" y="14">${label}</text>`;
    svg += `<text x="${labelWidth + messageWidth / 2}" y="14">${message}</text>`;
    svg += `</g>`;
    svg += `</svg>`;
    
    return svg;
}

/**
 * Handle badge request
 * CRITICAL: modId parameter must be the actual modId, not a slug
 * Slug-to-modId resolution should happen in the router before calling this handler
 */
export async function handleBadge(
    request: Request,
    env: Env,
    modId: string,
    versionId: string,
    auth: { userId: string; customerId: string | null; email?: string } | null
): Promise<Response> {
    try {
        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        let mod: ModMetadata | null = null;
        const normalizedModId = normalizeModId(modId);
        
        // Check global scope first
        const globalModKey = `mod_${normalizedModId}`;
        mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        
        // Fall back to customer scope if authenticated and not found in global
        if (!mod && auth?.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // If still not found, search all customer scopes (for cross-customer access)
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
                            if (mod) break;
                        }
                    }
                }
                if (mod) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor);
        }

        if (!mod) {
            console.error('[Badge] Mod not found:', { modId, hasAuth: !!auth });
            return new Response('Mod not found', { status: 404 });
        }
        
        console.log('[Badge] Mod found:', { modId: mod.modId, slug: mod.slug, status: mod.status, visibility: mod.visibility, customerId: mod.customerId });

        // Check if user is super admin
        const { isSuperAdminEmail } = await import('../../utils/admin.js');
        const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;

        // CRITICAL: Enforce visibility and status filtering
        // Badges are often loaded as images without auth, so we need to be more permissive
        const isAuthor = mod.authorId === auth?.userId;
        const modVisibility = mod.visibility || 'public';
        const modStatus = mod.status || 'published';
        
        // Visibility check: private mods only visible to author or admin
        if (modVisibility === 'private' && !isAuthor && !isAdmin) {
            return new Response('Mod not found', { status: 404 });
        }
        
        // Status check: allow badges for published/approved mods to everyone
        // For pending/changes_requested/denied: allow if public (images are part of public presentation)
        // OR if user is author/admin (for private pending mods)
        // CRITICAL: Image requests from <img> tags don't include auth, so we can't check isAuthor
        // Solution: Allow public pending mods to be accessible (they're public, just pending review)
        if (modStatus !== 'published' && modStatus !== 'approved') {
            // Allow if mod is public (even if pending) - images are part of public presentation
            // OR if authenticated user is author/admin (for private pending mods)
            const isPublicPending = modVisibility === 'public';
            if (!isPublicPending && (!isAuthor && !isAdmin)) {
                return new Response('Mod not found', { status: 404 });
            }
        }

        // Get version metadata - use mod's customerId (not auth customerId)
        // CRITICAL: Versions are stored in the mod's customer scope (where mod was uploaded)
        let version: ModVersion | null = null;
        
        // Check global scope first (for published mods)
        const globalVersionKey = `version_${versionId}`;
        version = await env.MODS_KV.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
        
        // If not found, check mod's customer scope (where version was uploaded)
        // This is critical for badges loaded without auth (as images)
        if (!version && mod.customerId) {
            const modCustomerVersionKey = getCustomerKey(mod.customerId, `version_${versionId}`);
            version = await env.MODS_KV.get(modCustomerVersionKey, { type: 'json' }) as ModVersion | null;
        }
        
        // Check auth customer scope (if authenticated and different from mod's customer scope)
        if (!version && auth?.customerId && auth.customerId !== mod.customerId) {
            const authCustomerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
            version = await env.MODS_KV.get(authCustomerVersionKey, { type: 'json' }) as ModVersion | null;
        }
        
        // Last resort: search all customer scopes (for cross-customer access)
        // This handles cases where versions might be in unexpected scopes
        if (!version) {
            console.log('[Badge] Version not found in expected scopes, searching all customer scopes');
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                for (const key of listResult.keys) {
                    if (key.name.endsWith('_mods_list')) {
                        const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                        const customerId = match ? match[1] : null;
                        if (customerId) {
                            const customerVersionKey = getCustomerKey(customerId, `version_${versionId}`);
                            version = await env.MODS_KV.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
                            if (version) {
                                console.log('[Badge] Found version in customer scope:', { customerId, versionId: version.versionId });
                                break;
                            }
                        }
                    }
                }
                if (version) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor);
        }

        // Check version belongs to mod (compare with mod.modId, not the input parameter)
        // Normalize both modIds before comparison to handle cases where one has mod_ prefix and the other doesn't
        if (!version) {
            console.error('[Badge] Version not found:', { versionId, modId: mod.modId, modCustomerId: mod.customerId, hasAuth: !!auth });
            return new Response('Version not found', { status: 404 });
        }
        
        const normalizedVersionModId = normalizeModId(version.modId);
        const normalizedModModId = normalizeModId(mod.modId);
        if (normalizedVersionModId !== normalizedModModId) {
            console.error('[Badge] Version modId mismatch:', { versionModId: version.modId, normalizedVersionModId, modModId: mod.modId, normalizedModModId });
            return new Response('Version not found', { status: 404 });
        }

        // Get style from query params
        const url = new URL(request.url);
        const style = (url.searchParams.get('style') || 'flat') as 'flat' | 'flat-square' | 'plastic';

        // Generate badge (always verified if hash exists - actual verification happens on /verify endpoint)
        const verified = !!version.sha256;
        const hash = version.sha256 || 'unknown';
        const badge = generateBadge(verified, hash, style);

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        return new Response(badge, {
            status: 200,
            headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=3600',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Badge generation error:', error);
        return new Response('Badge generation failed', { status: 500 });
    }
}

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    ENVIRONMENT?: string;
    [key: string]: any;
}

