/**
 * Update allowed origins and scopes for a specific API key
 * PUT /admin/customers/{customerId}/api-keys/{keyId}/origins
 *
 * Each API key can have its own set of allowed origins (CORS) and allowed OIDC scopes.
 */

import { getCorsHeaders } from '../../../utils/cors.js';
import { logSecurityEvent } from '../../../services/security.js';
import { indexGet } from '@strixun/kv-entities';
import type { ApiKeysEnv, ApiKeyData, UpdateOriginsBody, UpdateOriginsResponse } from './types.js';

export async function handleUpdateKeyOrigins(
    request: Request,
    env: ApiKeysEnv,
    customerId: string,
    keyId: string
): Promise<Response> {
    try {
        const body = await request.json() as UpdateOriginsBody;

        if (!Array.isArray(body.allowedOrigins)) {
            return new Response(JSON.stringify({
                error: 'Invalid request',
                message: 'allowedOrigins must be an array of strings'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const validatedOrigins: string[] = [];
        for (const origin of body.allowedOrigins) {
            if (typeof origin !== 'string') continue;
            const trimmed = origin.trim();
            if (!trimmed) continue;
            if (trimmed === 'null') {
                validatedOrigins.push('null');
                continue;
            }
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                validatedOrigins.push(trimmed);
            } else {
                return new Response(JSON.stringify({
                    error: 'Invalid origin',
                    message: `Origin "${trimmed}" must be http:// or https:// URL, or null (for file://).`
                }), {
                    status: 400,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                });
            }
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

        let validatedScopes: string[] | undefined;
        if (body.allowedScopes !== undefined) {
            const { SCOPES_SUPPORTED } = await import('../../../shared/oidc-constants.js');
            const supportedSet = new Set(SCOPES_SUPPORTED);
            validatedScopes = Array.isArray(body.allowedScopes)
                ? body.allowedScopes.filter((s: unknown) => typeof s === 'string' && supportedSet.has((s as string).trim()))
                : [];
        }

        const { indexRemove, indexAdd: indexAddEntry, putEntity } = await import('@strixun/kv-entities');
        const oldKeyString = JSON.stringify(keyData);
        await indexRemove(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, oldKeyString);

        keyData.allowedOrigins = validatedOrigins;
        if (validatedScopes !== undefined) keyData.allowedScopes = validatedScopes.length > 0 ? validatedScopes : undefined;
        await indexAddEntry(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, JSON.stringify(keyData));

        if (keyData.apiKeyHash) {
            await putEntity(env.OTP_AUTH_KV, 'auth', 'apikey', keyData.apiKeyHash, keyData);
        }

        await logSecurityEvent(customerId, 'api_key_origins_updated', {
            keyId: keyId,
            keyName: keyData.name,
            originsCount: validatedOrigins.length
        }, env);

        const response: UpdateOriginsResponse = {
            success: true,
            keyId,
            allowedOrigins: validatedOrigins,
            ...(validatedScopes !== undefined && { allowedScopes: validatedScopes }),
            message: `Allowed origins updated successfully. ${validatedOrigins.length} origin(s) configured.`
        };

        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Failed to update allowed origins',
            message: errorMessage
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}
