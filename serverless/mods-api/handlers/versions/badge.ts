/**
 * File integrity badge handler
 * GET /mods/:modId/versions/:versionId/badge
 * Generates SVG badge showing file integrity verification status
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

type VerificationStatus = 'verified' | 'unverified' | 'tampered';

/**
 * Generate SVG badge for file integrity
 */
function generateBadge(status: VerificationStatus, _hash: string, domain: string, style: 'flat' | 'flat-square' | 'plastic' = 'flat'): string {
    let color: string;
    let message: string;
    
    if (status === 'verified') {
        color = '#4caf50'; // Green
        message = 'Verified';
    } else if (status === 'tampered') {
        color = '#ff9800'; // Orange
        message = 'Tampered';
    } else {
        color = '#f44336'; // Red
        message = 'Unverified';
    }
    
    const textColor = '#fff';
    const label = `${domain} ☁`;
    
    // Calculate text widths (approximate)
    // Domain + cloud emoji takes more space (use 7px per char for domain, emoji is wider)
    const labelWidth = Math.max(label.length * 7 + 12, 80); // Minimum width for readability
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
        // CRITICAL: This must work for unauthenticated requests (badge images loaded in <img> tags)
        if (!mod) {
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                for (const key of listResult.keys) {
                    // Match both customer_{id}_mods_list and customer_{id}/mods_list patterns
                    if (key.name.endsWith('_mods_list') || key.name.endsWith('/mods_list')) {
                        // CRITICAL: Customer IDs can contain underscores (e.g., cust_0ab4c4434c48)
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
                            const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            if (mod) {
                                console.log('[Badge] Found mod in customer scope:', { customerId, modId: mod.modId, key: key.name });
                                break;
                            }
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
        // For pending/changes_requested: allow if public (images are part of public presentation)
        // Draft mods: only author/admin (draft means not ready for public viewing)
        // CRITICAL: Image requests from <img> tags don't include auth, so we can't check isAuthor
        // Solution: Allow public pending mods to be accessible (they're public, just pending review)
        // But block draft mods from public access (they're not ready)
        if (modStatus === 'draft' && !isAuthor && !isAdmin) {
            // Draft mods are not ready for public viewing
            return new Response('Mod not found', { status: 404 });
        } else if (modStatus !== 'published' && modStatus !== 'approved') {
            // For pending/changes_requested: allow if public (images are part of public presentation)
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
                    // Match both customer_{id}_mods_list and customer_{id}/mods_list patterns
                    if (key.name.endsWith('_mods_list') || key.name.endsWith('/mods_list')) {
                        // CRITICAL: Customer IDs can contain underscores (e.g., cust_0ab4c4434c48)
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
        
        // Extract domain from request URL (hostname)
        const domain = url.hostname;

        // EXCEPTION: Allow public browsing (no JWT required) for badge images
        // Get JWT token from request (optional for public access)
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        const jwtToken = request.headers.get('Authorization')?.replace('Bearer ', '').trim() || null;

        // Perform actual file integrity verification
        // EXCEPTION: For public browsing (no JWT), skip verification and show as "unverified"
        // Verification requires JWT to decrypt files, so we can't verify without it
        let verificationStatus: VerificationStatus = 'unverified';
        
        if (version.sha256 && jwtToken) {
            // Hash exists and JWT is present - verify it matches the actual file
            try {
                // Get file from R2
                const encryptedFile = await env.MODS_R2.get(version.r2Key);
                
                if (encryptedFile) {
                    // Decrypt file to calculate hash (same as upload process)
                    const isEncrypted = encryptedFile.customMetadata?.encrypted === 'true';
                    const encryptionFormat = encryptedFile.customMetadata?.encryptionFormat;
                    let decryptedFileData: ArrayBuffer;
                    
                    if (isEncrypted) {
                        // File is encrypted - decrypt it first
                        if (encryptionFormat === 'binary-v4' || encryptionFormat === 'binary-v5') {
                            const { decryptBinaryWithJWT } = await import('@strixun/api-framework');
                            const encryptedBinary = await encryptedFile.arrayBuffer();
                            const decryptedBytes = await decryptBinaryWithJWT(new Uint8Array(encryptedBinary), jwtToken);
                            // Convert Uint8Array to ArrayBuffer
                            decryptedFileData = new ArrayBuffer(decryptedBytes.length);
                            new Uint8Array(decryptedFileData).set(decryptedBytes);
                        } else {
                            // Legacy JSON encrypted format
                            const { decryptWithJWT } = await import('@strixun/api-framework');
                            const encryptedData = await encryptedFile.text();
                            const encryptedJson = JSON.parse(encryptedData);
                            const decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken) as string;
                            
                            // Convert base64 back to binary
                            const binaryString = atob(decryptedBase64);
                            const fileBytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                fileBytes[i] = binaryString.charCodeAt(i);
                            }
                            decryptedFileData = fileBytes.buffer;
                        }
                    } else {
                        // Legacy file (not encrypted) - use as-is
                        decryptedFileData = await encryptedFile.arrayBuffer();
                    }
                    
                    // Verify hash matches (verifyStrixunHash accepts ArrayBuffer)
                    const isValid = await verifyStrixunHash(decryptedFileData as ArrayBuffer, version.sha256, env);
                    verificationStatus = isValid ? 'verified' : 'tampered';
                    
                    if (!isValid) {
                        console.warn('[Badge] File integrity check failed - hash mismatch:', {
                            versionId: version.versionId,
                            modId: version.modId,
                            expectedHash: version.sha256.substring(0, 16) + '...',
                        });
                    }
                } else {
                    // File not found in R2 - treat as unverified
                    console.warn('[Badge] File not found in R2 for verification:', {
                        versionId: version.versionId,
                        r2Key: version.r2Key,
                    });
                    verificationStatus = 'unverified';
                }
            } catch (error) {
                // Verification failed (decryption error, etc.) - treat as unverified
                console.error('[Badge] Verification error:', error);
                verificationStatus = 'unverified';
            }
        } else if (version.sha256 && !jwtToken) {
            // Hash exists but no JWT - can't verify (public browsing)
            // Show as "unverified" since we can't decrypt files to verify
            console.log('[Badge] Skipping verification for public browsing (no JWT token)');
            verificationStatus = 'unverified';
        }
        
        const hash = version.sha256 || 'unknown';
        const badge = generateBadge(verificationStatus, hash, domain, style);

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        // Encrypt with JWT if token is present, otherwise return unencrypted SVG for public browsing
        if (jwtToken) {
            // Convert SVG string to binary and encrypt with JWT
            const encoder = new TextEncoder();
            const badgeBytes = encoder.encode(badge);
            const { encryptBinaryWithJWT } = await import('@strixun/api-framework');
            const encryptedBadge = await encryptBinaryWithJWT(badgeBytes, jwtToken);
            
            return new Response(encryptedBadge, {
                status: 200,
                headers: {
                    'Content-Type': 'application/octet-stream', // Binary encrypted data
                    'X-Encrypted': 'true', // Flag to indicate encrypted response
                    'X-Original-Content-Type': 'image/svg+xml', // Preserve original content type
                    'Cache-Control': 'public, max-age=300', // 5 minutes - verification can change if file is modified
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        } else {
            // Return unencrypted SVG for public browsing (badge images loaded in <img> tags)
            return new Response(badge, {
                status: 200,
                headers: {
                    'Content-Type': 'image/svg+xml',
                    'X-Encrypted': 'false', // Flag to indicate unencrypted response
                    'Cache-Control': 'public, max-age=300', // 5 minutes - verification can change if file is modified
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }
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

