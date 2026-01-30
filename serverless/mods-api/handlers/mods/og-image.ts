/**
 * Open Graph image handler
 * GET /mods/:slug/og-image
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getEntity, canAccessVisible } from '@strixun/kv-entities';
import type { ModMetadata } from '../../types/mod.js';

function getCategoryDisplayName(category: string): string {
    const categoryMap: Record<string, string> = {
        script: 'Script', overlay: 'Overlay', theme: 'Theme',
        asset: 'Asset', plugin: 'Plugin', other: 'Other',
    };
    return categoryMap[category] || category;
}

function truncateText(text: string, maxLength: number): string {
    return text.length <= maxLength ? text : text.substring(0, maxLength - 3) + '...';
}

function escapeXml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function generateOGImage(mod: ModMetadata, thumbnailUrl?: string): string {
    const categoryDisplay = escapeXml(getCategoryDisplayName(mod.category));
    const title = escapeXml(truncateText(mod.title, 50));
    const description = escapeXml(truncateText(mod.description.replace(/\n/g, ' ').replace(/\*\*/g, '').replace(/\*/g, ''), 120));
    const authorName = escapeXml(truncateText(mod.authorDisplayName || 'Unknown User', 30));
    
    const bgColor = '#1a1a1a';
    const borderColor = '#d4af37';
    const textColor = '#f9f9f9';
    const textSecondary = '#b0b0b0';
    const accentColor = '#d4af37';
    const width = 1200;
    const height = 630;
    
    const thumbnailImage = thumbnailUrl 
        ? `<image href="${thumbnailUrl}" x="40" y="175" width="280" height="280" preserveAspectRatio="xMidYMid slice" clip-path="url(#thumbnail-clip)"/>`
        : `<rect x="40" y="175" width="280" height="280" fill="#252525" rx="8"/><text x="180" y="315" text-anchor="middle" fill="${textSecondary}" font-size="48" font-weight="600">${categoryDisplay}</text>`;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs><clipPath id="thumbnail-clip"><rect x="40" y="175" width="280" height="280" rx="8"/></clipPath></defs>
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  <rect x="4" y="4" width="${width - 8}" height="${height - 8}" fill="none" stroke="${borderColor}" stroke-width="8" rx="12"/>
  <rect x="36" y="171" width="288" height="288" fill="none" stroke="${borderColor}" stroke-width="3" rx="12"/>
  ${thumbnailImage}
  <g transform="translate(360, 40)">
    <rect x="0" y="0" width="120" height="36" fill="${accentColor}" rx="18"/>
    <text x="60" y="24" text-anchor="middle" fill="${bgColor}" font-size="16" font-weight="700" font-family="system-ui">${categoryDisplay}</text>
    <text x="0" y="80" fill="${textColor}" font-size="56" font-weight="700" font-family="system-ui">${title}</text>
    <text x="0" y="160" fill="${textSecondary}" font-size="28" font-family="system-ui">${description}</text>
    <g transform="translate(0, 280)">
      <circle cx="12" cy="12" r="8" fill="${accentColor}"/>
      <text x="28" y="16" fill="${textSecondary}" font-size="20" font-family="system-ui">${authorName}</text>
      <text x="320" y="16" fill="${textSecondary}" font-size="20" font-family="system-ui">${mod.downloadCount.toLocaleString()} downloads</text>
      <text x="600" y="16" fill="${textSecondary}" font-size="20" font-family="system-ui">v${mod.latestVersion}</text>
    </g>
    <g transform="translate(0, 380)">
      <text fill="${textSecondary}" font-size="18" font-weight="600" font-family="system-ui">Strixun Stream Suite</text>
      <line x1="0" y1="8" x2="200" y2="8" stroke="${accentColor}" stroke-width="2"/>
    </g>
  </g>
</svg>`.trim();
}

export async function handleOGImage(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string } | null
): Promise<Response> {
    try {
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        const modForAccess = { ...mod, id: mod.modId, visibility: mod.visibility || 'public' as const };
        if (!canAccessVisible(modForAccess, { customerId: auth?.customerId || null, isAdmin: false })) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        let jwtToken: string | null = null;
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
            const authCookie = cookieHeader.split(';').find(c => c.trim().startsWith('auth_token='));
            if (authCookie) {
                jwtToken = authCookie.split('=')[1]?.trim() || null;
            }
        }

        const ogImageSvg = generateOGImage(mod, mod.thumbnailUrl);

        const corsHeaders = createCORSHeaders(request, {
            credentials: true,
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });

        if (jwtToken) {
            const encoder = new TextEncoder();
            const svgBytes = encoder.encode(ogImageSvg);
            const { encryptBinaryWithJWT } = await import('@strixun/api-framework');
            const encryptedSvg = await encryptBinaryWithJWT(svgBytes, jwtToken);
            
            const headers = new Headers(Object.fromEntries(corsHeaders.entries()));
            headers.set('Content-Type', 'application/octet-stream');
            headers.set('X-Encrypted', 'true');
            headers.set('X-Original-Content-Type', 'image/svg+xml');
            headers.set('Cache-Control', 'public, max-age=3600');
            
            return new Response(encryptedSvg, { status: 200, headers });
        } else {
            const headers = new Headers(Object.fromEntries(corsHeaders.entries()));
            headers.set('Content-Type', 'image/svg+xml');
            headers.set('X-Encrypted', 'false');
            headers.set('Cache-Control', 'public, max-age=3600');
            
            return new Response(ogImageSvg, { status: 200, headers });
        }
    } catch (error: any) {
        console.error('OG image error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Generate OG Image',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
        );
    }
}

function errorResponse(request: Request, env: Env, status: number, title: string, detail: string): Response {
    const rfcError = createError(request, status, title, detail);
    const corsHeaders = createCORSHeaders(request, {
        credentials: true,
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    });
    return new Response(JSON.stringify(rfcError), {
        status,
        headers: { 'Content-Type': 'application/problem+json', ...Object.fromEntries(corsHeaders.entries()) },
    });
}

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}
