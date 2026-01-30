/**
 * File integrity badge handler
 * GET /mods/:modId/versions/:versionId/badge
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { getEntity, canAccessVisible } from '@strixun/kv-entities';
import { verifyStrixunHash } from '../../utils/hash.js';
import type { ModMetadata, ModVersion, VariantVersion } from '../../types/mod.js';
import type { Env } from '../../worker.js';

type VerificationStatus = 'verified' | 'unverified' | 'tampered';

function generateBadge(status: VerificationStatus, _hash: string, domain: string, style: 'flat' | 'flat-square' | 'plastic' = 'flat'): string {
    let color: string;
    let message: string;

    if (status === 'verified') {
        color = '#4caf50';
        message = 'Verified';
    } else if (status === 'tampered') {
        color = '#ff9800';
        message = 'Tampered';
    } else {
        color = '#f44336';
        message = 'Unverified';
    }

    const textColor = '#fff';
    const label = `${domain} ☁`;
    const labelWidth = Math.max(label.length * 7 + 12, 80);
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

export async function handleBadge(
    request: Request,
    env: Env,
    modId: string,
    versionId: string,
    auth: { customerId: string; jwtToken?: string } | null
): Promise<Response> {
    try {
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return new Response('Mod not found', { status: 404 });
        }

        // Access control
        let jwtToken = auth?.jwtToken || null;
        if (!jwtToken) {
            const cookieHeader = request.headers.get('Cookie');
            if (cookieHeader) {
                const authCookie = cookieHeader.split(';').find(c => c.trim().startsWith('auth_token='));
                if (authCookie) {
                    jwtToken = authCookie.split('=')[1]?.trim() || null;
                }
            }
        }

        const { isAdmin: checkIsAdmin } = await import('../../utils/admin.js');
        const isAdmin = auth?.customerId && jwtToken ? await checkIsAdmin(auth.customerId, jwtToken, env) : false;
        const modForAccess = { ...mod, id: mod.modId, visibility: mod.visibility || 'public' as const };

        if (!canAccessVisible(modForAccess, { customerId: auth?.customerId || null, isAdmin })) {
            return new Response('Mod not found', { status: 404 });
        }

        // Get version
        let version = await getEntity<ModVersion>(env.MODS_KV, 'mods', 'version', versionId);
        let variantVersion: VariantVersion | null = null;

        if (!version) {
            variantVersion = await getEntity<VariantVersion>(env.MODS_KV, 'mods', 'version', versionId);
        }

        if (!version && !variantVersion) {
            return new Response('Version not found', { status: 404 });
        }

        const fileVersion = version || variantVersion;

        // Get style
        const url = new URL(request.url);
        const style = (url.searchParams.get('style') || 'flat') as 'flat' | 'flat-square' | 'plastic';

        let domain = url.hostname;
        if (env.ENVIRONMENT === 'development' || domain === 'localhost') {
            domain = 'localhost';
        }

        // Determine verification status
        let verificationStatus: VerificationStatus = 'unverified';

        if (fileVersion!.sha256) {
            if (jwtToken) {
                try {
                    const encryptedFile = await env.MODS_R2.get(fileVersion!.r2Key);

                    if (encryptedFile) {
                        const isEncrypted = encryptedFile.customMetadata?.encrypted === 'true';
                        const encryptionFormat = encryptedFile.customMetadata?.encryptionFormat;
                        let decryptedFileData: ArrayBuffer;

                        if (isEncrypted && (encryptionFormat === 'binary-v4' || encryptionFormat === 'binary-v5')) {
                            const { decryptBinaryWithJWT } = await import('@strixun/api-framework');
                            const encryptedBinary = await encryptedFile.arrayBuffer();
                            const decryptedBytes = await decryptBinaryWithJWT(new Uint8Array(encryptedBinary), jwtToken);
                            decryptedFileData = decryptedBytes.buffer as ArrayBuffer;
                        } else {
                            decryptedFileData = await encryptedFile.arrayBuffer();
                        }

                        const isValid = await verifyStrixunHash(decryptedFileData, fileVersion!.sha256, env);
                        verificationStatus = isValid ? 'verified' : 'tampered';
                    }
                } catch {
                    verificationStatus = 'verified';
                }
            } else {
                verificationStatus = 'verified';
            }
        }

        const hash = fileVersion!.sha256 || 'unknown';
        const badge = generateBadge(verificationStatus, hash, domain, style);

        const corsHeaders = createCORSHeaders(request, {
            credentials: true,
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
        });

        return new Response(badge, {
            status: 200,
            headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=300',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Badge generation error:', error);
        return new Response('Badge generation failed', { status: 500 });
    }
}
