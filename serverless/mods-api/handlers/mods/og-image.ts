/**
 * Open Graph image handler
 * GET /mods/:slug/og-image
 * Generates a rich preview image with dark background and gold border
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import type { ModMetadata } from '../../types/mod.js';

/**
 * Get category display name
 */
function getCategoryDisplayName(category: string): string {
    const categoryMap: Record<string, string> = {
        script: 'Script',
        overlay: 'Overlay',
        theme: 'Theme',
        asset: 'Asset',
        plugin: 'Plugin',
        other: 'Other',
    };
    return categoryMap[category] || category;
}

/**
 * Truncate text to fit in OG image
 */
function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Escape XML special characters for SVG
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Generate SVG-based OG image
 */
function generateOGImage(mod: ModMetadata, thumbnailUrl?: string): string {
    const categoryDisplay = escapeXml(getCategoryDisplayName(mod.category));
    const title = escapeXml(truncateText(mod.title, 50));
    const description = escapeXml(truncateText(mod.description.replace(/\n/g, ' ').replace(/\*\*/g, '').replace(/\*/g, ''), 120));
    // CRITICAL: Never display email - use displayName or "Unknown User"
    const authorName = escapeXml(truncateText(mod.authorDisplayName || 'Unknown User', 30));
    
    // Theme colors matching Strixun Stream Suite
    const bgColor = '#1a1a1a';
    const borderColor = '#d4af37';
    const textColor = '#f9f9f9';
    const textSecondary = '#b0b0b0';
    const accentColor = '#d4af37';
    
    // OG image standard size: 1200x630
    const width = 1200;
    const height = 630;
    const borderWidth = 8;
    const padding = 40;
    const thumbnailSize = 280;
    const thumbnailX = padding;
    const thumbnailY = (height - thumbnailSize) / 2;
    
    // Build thumbnail URL - if provided, use it; otherwise show placeholder
    const hasThumbnail = !!thumbnailUrl;
    const thumbnailImage = hasThumbnail 
        ? `<image href="${thumbnailUrl}" x="${thumbnailX}" y="${thumbnailY}" width="${thumbnailSize}" height="${thumbnailSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#thumbnail-clip)"/>`
        : `<rect x="${thumbnailX}" y="${thumbnailY}" width="${thumbnailSize}" height="${thumbnailSize}" fill="#252525" rx="8"/>
           <text x="${thumbnailX + thumbnailSize / 2}" y="${thumbnailY + thumbnailSize / 2}" text-anchor="middle" dominant-baseline="middle" fill="${textSecondary}" font-size="48" font-weight="600">${categoryDisplay}</text>`;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="thumbnail-clip">
      <rect x="${thumbnailX}" y="${thumbnailY}" width="${thumbnailSize}" height="${thumbnailSize}" rx="8"/>
    </clipPath>
    <linearGradient id="border-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${borderColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#b8941f;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Dark background -->
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  
  <!-- Gold border -->
  <rect x="${borderWidth / 2}" y="${borderWidth / 2}" width="${width - borderWidth}" height="${height - borderWidth}" fill="none" stroke="url(#border-gradient)" stroke-width="${borderWidth}" rx="12"/>
  
  <!-- Thumbnail area with border -->
  <rect x="${thumbnailX - 4}" y="${thumbnailY - 4}" width="${thumbnailSize + 8}" height="${thumbnailSize + 8}" fill="none" stroke="${borderColor}" stroke-width="3" rx="12"/>
  ${thumbnailImage}
  
  <!-- Content area -->
  <g transform="translate(${thumbnailX + thumbnailSize + padding}, ${padding})">
    <!-- Category badge -->
    <rect x="0" y="0" width="120" height="36" fill="${accentColor}" rx="18"/>
    <text x="60" y="24" text-anchor="middle" dominant-baseline="middle" fill="${bgColor}" font-size="16" font-weight="700" font-family="system-ui, -apple-system, sans-serif">${categoryDisplay}</text>
    
    <!-- Title -->
    <text x="0" y="80" fill="${textColor}" font-size="56" font-weight="700" font-family="system-ui, -apple-system, sans-serif">${title}</text>
    
    <!-- Description -->
    <text x="0" y="160" fill="${textSecondary}" font-size="28" font-weight="400" font-family="system-ui, -apple-system, sans-serif">
      <tspan x="0" dy="0">${description}</tspan>
    </text>
    
    <!-- Metadata row -->
    <g transform="translate(0, 280)">
      <!-- Author -->
      <circle cx="12" cy="12" r="8" fill="${accentColor}"/>
      <text x="28" y="16" fill="${textSecondary}" font-size="20" font-weight="500" font-family="system-ui, -apple-system, sans-serif">${authorName}</text>
      
      <!-- Downloads -->
      <g transform="translate(320, 0)">
        <text x="0" y="16" fill="${textSecondary}" font-size="20" font-weight="500" font-family="system-ui, -apple-system, sans-serif"> ${mod.downloadCount.toLocaleString()} downloads</text>
      </g>
      
      <!-- Version -->
      <g transform="translate(600, 0)">
        <text x="0" y="16" fill="${textSecondary}" font-size="20" font-weight="500" font-family="system-ui, -apple-system, sans-serif">v${mod.latestVersion}</text>
      </g>
    </g>
    
    <!-- Branding -->
    <g transform="translate(0, 380)">
      <text x="0" y="0" fill="${textSecondary}" font-size="18" font-weight="600" font-family="system-ui, -apple-system, sans-serif">Strixun Stream Suite</text>
      <line x1="0" y1="8" x2="200" y2="8" stroke="${accentColor}" stroke-width="2"/>
    </g>
  </g>
</svg>`.replace(/\n\s+/g, '\n').trim();
}

/**
 * Handle OG image request
 * CRITICAL: modId parameter must be the actual modId, not a slug
 * Slug-to-modId resolution should happen in the router before calling this handler
 */
export async function handleOGImage(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string } | null
): Promise<Response> {
    try {
        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        let mod: ModMetadata | null = null;
        const normalizedModId = normalizeModId(modId);
        
        // Check customer scope first if authenticated
        if (auth?.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // Fall back to global scope if not found
        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
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
                cursor = listResult.list_complete ? undefined : listResult.cursor;
            } while (cursor);
        }

        if (!mod) {
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
            const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Check visibility
        if (mod.visibility === 'private' && mod.authorId !== auth?.customerId) {
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
            const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // EXCEPTION: Allow public access (no JWT required) for OG images (social media crawlers)
        // Get JWT token from HttpOnly cookie (optional for public access)
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        let jwtToken: string | null = null;
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
            const cookies = cookieHeader.split(';').map(c => c.trim());
            const authCookie = cookies.find(c => c.startsWith('auth_token='));
            if (authCookie) {
                jwtToken = authCookie.substring('auth_token='.length).trim();
            }
        }

        // Generate OG image SVG
        const ogImageSvg = generateOGImage(mod, mod.thumbnailUrl);
        
        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        // Encrypt with JWT if token is present, otherwise return unencrypted SVG for public access
        if (jwtToken) {
            const encoder = new TextEncoder();
            const svgBytes = encoder.encode(ogImageSvg);
            const { encryptBinaryWithJWT } = await import('@strixun/api-framework');
            const encryptedSvg = await encryptBinaryWithJWT(svgBytes, jwtToken);
            const headers = new Headers(Object.fromEntries(corsHeaders.entries()));
            headers.set('Content-Type', 'application/octet-stream'); // Binary encrypted data
            headers.set('X-Encrypted', 'true'); // Flag to indicate encrypted response
            headers.set('X-Original-Content-Type', 'image/svg+xml'); // Preserve original content type
            headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
            
            return new Response(encryptedSvg, {
                status: 200,
                headers,
            });
        } else {
            // Return unencrypted SVG for public access (social media crawlers)
            const headers = new Headers(Object.fromEntries(corsHeaders.entries()));
            headers.set('Content-Type', 'image/svg+xml');
            headers.set('X-Encrypted', 'false'); // Flag to indicate unencrypted response
            headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
            
            return new Response(ogImageSvg, {
                status: 200,
                headers,
            });
        }
    } catch (error: any) {
        console.error('OG image error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Generate OG Image',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while generating the preview image'
        );
        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
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

