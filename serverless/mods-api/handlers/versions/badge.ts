/**
 * File integrity badge handler
 * GET /mods/:modId/versions/:versionId/badge
 * Generates SVG badge showing file integrity verification status
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
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
 */
export async function handleBadge(
    request: Request,
    env: Env,
    modId: string,
    versionId: string,
    auth: { userId: string; customerId: string | null } | null
): Promise<Response> {
    try {
        // Get mod metadata - check both global scope and customer scope
        let mod: ModMetadata | null = null;
        
        // First try global scope (for public mods)
        const globalModKey = `mod_${modId}`;
        mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        
        // If not found and authenticated, check customer scope
        if (!mod && auth?.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, `mod_${modId}`);
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
        }

        if (!mod) {
            return new Response('Mod not found', { status: 404 });
        }

        // Check if user is super admin
        const { isSuperAdminEmail } = await import('../../utils/admin.js');
        const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;

        // CRITICAL: Enforce strict visibility and status filtering
        // Only super admins can bypass these checks
        if (!isAdmin) {
            // For non-super users: ONLY public, published mods are allowed
            // Check visibility: MUST be 'public'
            if (mod.visibility !== 'public') {
                // Only show private/unlisted mods to their author
                if (mod.authorId !== auth?.userId) {
                    return new Response('Mod not found', { status: 404 });
                }
            }
            
            // Check status: MUST be 'published'
            if (mod.status !== 'published') {
                // Only show non-published mods to their author
                if (mod.authorId !== auth?.userId) {
                    return new Response('Mod not found', { status: 404 });
                }
            }
        } else {
            // Super admins: check visibility but allow all statuses
            if (mod.visibility === 'private' && mod.authorId !== auth?.userId) {
                return new Response('Mod not found', { status: 404 });
            }
        }

        // Get version metadata - check both global scope and customer scope
        let version: ModVersion | null = null;
        
        // First try global scope
        const globalVersionKey = `version_${versionId}`;
        version = await env.MODS_KV.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
        
        // If not found and authenticated, check customer scope
        if (!version && auth?.customerId) {
            const customerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
            version = await env.MODS_KV.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
        }

        if (!version || version.modId !== modId) {
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

