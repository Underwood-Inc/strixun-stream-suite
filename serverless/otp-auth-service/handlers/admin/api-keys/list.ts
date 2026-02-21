/**
 * List customer API keys
 * GET /admin/customers/{customerId}/api-keys
 *
 * Returns API keys with double-encrypted values (encrypted with customer's JWT).
 * Router encrypts the entire response again (data in transit).
 */

import { getCorsHeaders } from '../../../utils/cors.js';
import { decryptData, getJWTSecret } from '../../../utils/crypto.js';
import { indexGet } from '@strixun/kv-entities';
import type { ApiKeysEnv, ApiKeyData, ApiKeyResponse, EncryptedKeyData, ListApiKeysResponse } from './types.js';

export async function handleListApiKeys(
    request: Request,
    env: ApiKeysEnv,
    customerId: string,
    jwtToken: string | null = null
): Promise<Response> {
    try {
        const keyDataStrings = await indexGet(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId);
        const keys: ApiKeyData[] = keyDataStrings.map(s => JSON.parse(s) as ApiKeyData);
        const jwtSecret = getJWTSecret(env);
        const keysWithEncryptedValues = await Promise.all(keys.map(async (k): Promise<ApiKeyResponse> => {
            let doubleEncryptedKey: EncryptedKeyData | null = null;

            if (k.encryptedKey && jwtToken) {
                try {
                    const decryptedKeyRaw = await decryptData(k.encryptedKey, jwtSecret);
                    if (!decryptedKeyRaw) {
                        return {
                            keyId: k.keyId,
                            name: k.name,
                            createdAt: k.createdAt,
                            lastUsed: k.lastUsed,
                            status: k.status,
                            apiKey: null,
                            allowedOrigins: k.allowedOrigins || [],
                            allowedScopes: k.allowedScopes
                        };
                    }
                    const decryptedKey = decryptedKeyRaw.trim();
                    const { encryptWithJWT } = await import('@strixun/api-framework');
                    const encrypted = await encryptWithJWT(decryptedKey, jwtToken);
                    doubleEncryptedKey = {
                        doubleEncrypted: true,
                        encrypted: true,
                        algorithm: encrypted.algorithm,
                        iv: encrypted.iv,
                        salt: encrypted.salt,
                        tokenHash: encrypted.tokenHash ?? '',
                        data: encrypted.data,
                        timestamp: encrypted.timestamp ?? ''
                    };
                } catch (error) {
                    console.error('Failed to double-encrypt API key:', error);
                }
            }

            return {
                keyId: k.keyId,
                name: k.name,
                createdAt: k.createdAt,
                lastUsed: k.lastUsed,
                status: k.status,
                apiKey: doubleEncryptedKey,
                allowedOrigins: k.allowedOrigins || [],
                allowedScopes: k.allowedScopes
            };
        }));

        const response: ListApiKeysResponse = {
            success: true,
            apiKeys: keysWithEncryptedValues
        };

        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Failed to list API keys',
            message: errorMessage
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}
