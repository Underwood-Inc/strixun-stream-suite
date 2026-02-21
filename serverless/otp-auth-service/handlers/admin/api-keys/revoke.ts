/**
 * Revoke API key
 * DELETE /admin/customers/{customerId}/api-keys/{keyId}
 */

import { getCorsHeaders } from '../../../utils/cors.js';
import { logSecurityEvent } from '../../../services/security.js';
import { indexGet } from '@strixun/kv-entities';
import type { ApiKeysEnv, ApiKeyData, RevokeApiKeyResponse } from './types.js';

export async function handleRevokeApiKey(
    request: Request,
    env: ApiKeysEnv,
    customerId: string,
    keyId: string
): Promise<Response> {
    try {
        const keyDataStrings = await indexGet(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId);
        const customerKeys: ApiKeyData[] = keyDataStrings.map(s => JSON.parse(s) as ApiKeyData);
        const keyData = customerKeys.find(k => k.keyId === keyId);

        if (!keyData) {
            return new Response(JSON.stringify({ error: 'API key not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const { indexRemove, indexAdd: indexAddEntry } = await import('@strixun/kv-entities');
        const oldKeyString = JSON.stringify(keyData);
        await indexRemove(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, oldKeyString);

        keyData.status = 'revoked';
        keyData.revokedAt = new Date().toISOString();
        await indexAddEntry(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, JSON.stringify(keyData));

        await logSecurityEvent(customerId, 'api_key_revoked', {
            keyId: keyId,
            keyName: keyData.name
        }, env);

        const response: RevokeApiKeyResponse = {
            success: true,
            message: 'API key revoked successfully'
        };

        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Failed to revoke API key',
            message: errorMessage
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}
