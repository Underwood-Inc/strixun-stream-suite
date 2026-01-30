/**
 * File verification handler
 * GET /mods/:modId/versions/:versionId/verify
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getEntity, canAccessVisible } from '@strixun/kv-entities';
import { calculateStrixunHash, verifyStrixunHash, formatStrixunHash } from '../../utils/hash.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';
import type { Env } from '../../worker.js';

export async function handleVerifyVersion(
    request: Request,
    env: Env,
    modId: string,
    versionId: string,
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

        const version = await getEntity<ModVersion>(env.MODS_KV, 'mods', 'version', versionId);

        if (!version || version.modId !== modId) {
            return errorResponse(request, env, 404, 'Version Not Found', 'The requested version was not found');
        }

        const encryptedFile = await env.MODS_R2.get(version.r2Key);

        if (!encryptedFile) {
            return errorResponse(request, env, 404, 'File Not Found', 'The requested file was not found in storage');
        }

        let decryptedFileData: ArrayBuffer;
        const isEncrypted = encryptedFile.customMetadata?.encrypted === 'true';
        const encryptionFormat = encryptedFile.customMetadata?.encryptionFormat;

        if (isEncrypted) {
            const cookieHeader = request.headers.get('Cookie');
            const authCookie = cookieHeader?.split(';').find(c => c.trim().startsWith('auth_token='));

            if (!authCookie) {
                return errorResponse(request, env, 401, 'Authentication Required', 'JWT token required to decrypt and verify files');
            }

            const jwtToken = authCookie.split('=')[1]?.trim();

            try {
                if (encryptionFormat === 'binary-v4' || encryptionFormat === 'binary-v5') {
                    const { decryptBinaryWithJWT } = await import('@strixun/api-framework');
                    const encryptedBinary = await encryptedFile.arrayBuffer();
                    const decryptedBytes = await decryptBinaryWithJWT(new Uint8Array(encryptedBinary), jwtToken);
                    decryptedFileData = decryptedBytes.buffer as ArrayBuffer;
                } else {
                    const { decryptWithJWT } = await import('@strixun/api-framework');
                    const encryptedData = await encryptedFile.text();
                    const encryptedJson = JSON.parse(encryptedData);
                    const decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken) as string;
                    const binaryString = atob(decryptedBase64);
                    const fileBytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        fileBytes[i] = binaryString.charCodeAt(i);
                    }
                    decryptedFileData = fileBytes.buffer;
                }
            } catch (error) {
                return errorResponse(request, env, 500, 'Decryption Failed', 'Failed to decrypt file for verification');
            }
        } else {
            decryptedFileData = await encryptedFile.arrayBuffer();
        }

        const currentHash = await calculateStrixunHash(decryptedFileData, env);
        const isValid = await verifyStrixunHash(decryptedFileData, version.sha256, env);

        const verificationResult = {
            verified: isValid,
            modId: version.modId,
            versionId: version.versionId,
            version: version.version,
            fileName: version.fileName,
            fileSize: version.fileSize,
            expectedHash: formatStrixunHash(version.sha256),
            actualHash: formatStrixunHash(currentHash),
            verifiedAt: new Date().toISOString(),
            strixunVerified: isValid,
        };

        return new Response(JSON.stringify(verificationResult, null, 2), {
            status: isValid ? 200 : 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Verify version error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Verify Version',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
        );
    }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
    const headers = createCORSHeaders(request, {
        credentials: true,
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });
    return Object.fromEntries(headers.entries());
}

function errorResponse(request: Request, env: Env, status: number, title: string, detail: string): Response {
    const rfcError = createError(request, status, title, detail);
    return new Response(JSON.stringify(rfcError), {
        status,
        headers: { 'Content-Type': 'application/problem+json', ...corsHeaders(request, env) },
    });
}
