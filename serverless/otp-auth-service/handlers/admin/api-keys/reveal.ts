/**
 * Reveal API key on-demand
 * POST /admin/customers/{customerId}/api-keys/{keyId}/reveal
 *
 * Decrypts and returns API key; requires user's JWT token.
 * This is the only way to see the actual API key value.
 */

import { getCorsHeaders } from '../../../utils/cors.js';
import { decryptData, getJWTSecret } from '../../../utils/crypto.js';
import { logSecurityEvent } from '../../../services/security.js';
import { indexGet } from '@strixun/kv-entities';
import type { ApiKeysEnv, ApiKeyData, RevealApiKeyResponse } from './types.js';

export async function handleRevealApiKey(
    request: Request,
    env: ApiKeysEnv,
    customerId: string,
    keyId: string,
    jwtToken: string | null
): Promise<Response> {
    try {
        if (!jwtToken) {
            return new Response(JSON.stringify({
                error: 'JWT token required',
                message: 'You must be authenticated to reveal API keys'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const keyDataStrings = await indexGet(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId);
        const customerKeys: ApiKeyData[] = keyDataStrings.map(s => JSON.parse(s) as ApiKeyData);
        const keyData = customerKeys.find(k => k.keyId === keyId);

        if (!keyData) {
            return new Response(JSON.stringify({ error: 'API key not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const jwtSecret = getJWTSecret(env);
        let apiKey: string | null = null;
        if (keyData.encryptedKey) {
            const decryptedKey = await decryptData(keyData.encryptedKey, jwtSecret);
            if (decryptedKey) apiKey = decryptedKey.trim();
        }

        await logSecurityEvent(customerId, 'api_key_revealed', {
            keyId: keyId,
            keyName: keyData.name
        }, env);

        const response: RevealApiKeyResponse = {
            success: true,
            apiKey,
            keyId,
            name: keyData.name,
            message: 'API key revealed. Copy it now - it will not be shown again.'
        };

        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Failed to reveal API key',
            message: errorMessage
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}
