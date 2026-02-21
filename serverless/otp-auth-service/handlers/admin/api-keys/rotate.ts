/**
 * Rotate API key
 * POST /admin/customers/{customerId}/api-keys/{keyId}/rotate
 */

import { getCorsHeaders } from '../../../utils/cors.js';
import { createApiKeyForCustomer } from '../../../services/api-key.js';
import { logSecurityEvent } from '../../../services/security.js';
import { indexGet } from '@strixun/kv-entities';
import type { ApiKeysEnv, ApiKeyData, RotateApiKeyResponse } from './types.js';

export async function handleRotateApiKey(
    request: Request,
    env: ApiKeysEnv,
    customerId: string,
    keyId: string
): Promise<Response> {
    try {
        const keyDataStrings = await indexGet(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId);
        const customerKeys: ApiKeyData[] = keyDataStrings.map(s => JSON.parse(s) as ApiKeyData);
        const oldKeyData = customerKeys.find(k => k.keyId === keyId);

        if (!oldKeyData) {
            return new Response(JSON.stringify({ error: 'API key not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const { apiKey: newApiKey, keyId: newKeyId } = await createApiKeyForCustomer(
            customerId,
            `${oldKeyData.name} (rotated)`,
            env
        );

        const { indexRemove, indexAdd: indexAddEntry } = await import('@strixun/kv-entities');
        const oldKeyString = JSON.stringify(oldKeyData);
        await indexRemove(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, oldKeyString);

        oldKeyData.status = 'rotated';
        oldKeyData.rotatedAt = new Date().toISOString();
        oldKeyData.replacedBy = newKeyId;
        await indexAddEntry(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, JSON.stringify(oldKeyData));

        await logSecurityEvent(customerId, 'api_key_rotated', {
            oldKeyId: keyId,
            newKeyId: newKeyId
        }, env);

        const response: RotateApiKeyResponse = {
            success: true,
            apiKey: newApiKey,
            keyId: newKeyId,
            oldKeyId: keyId,
            message: 'API key rotated successfully. Old key will work for 7 days. Your new API key is also available in the API Keys tab.'
        };

        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Failed to rotate API key',
            message: errorMessage
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}
