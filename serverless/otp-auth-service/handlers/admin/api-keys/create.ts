/**
 * Create new API key for customer
 * POST /admin/customers/{customerId}/api-keys
 */

import { getCorsHeaders } from '../../../utils/cors.js';
import { createApiKeyForCustomer } from '../../../services/api-key.js';
import { getCustomer } from '@strixun/api-framework';
import type { ApiKeysEnv, CreateApiKeyBody, CreateApiKeyResponse } from './types.js';

export async function handleCreateApiKey(
    request: Request,
    env: ApiKeysEnv,
    customerId: string
): Promise<Response> {
    try {
        const body = await request.json() as CreateApiKeyBody;
        const name = body.name || 'New API Key';

        const { extractAuthToken, verifyTokenOIDC } = await import('../../../utils/verify-token.js');
        const jwtToken = extractAuthToken(request.headers.get('Cookie'));
        if (!jwtToken) {
            return new Response(JSON.stringify({ error: 'Authentication required. Please authenticate with HttpOnly cookie.' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const jwtPayload = await verifyTokenOIDC(jwtToken, env);
        if (!jwtPayload || !jwtPayload.customerId) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (jwtPayload.customerId !== customerId) {
            return new Response(JSON.stringify({ error: 'Forbidden: You can only create API keys for your own account' }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const customer = await getCustomer(customerId, jwtToken, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        let allowedOrigins: string[] | undefined;
        if (Array.isArray(body.allowedOrigins)) {
            allowedOrigins = [];
            for (const origin of body.allowedOrigins) {
                if (typeof origin !== 'string') continue;
                const trimmed = origin.trim();
                if (!trimmed) continue;
                if (trimmed === 'null' || trimmed.startsWith('http://') || trimmed.startsWith('https://')) allowedOrigins.push(trimmed);
            }
            if (allowedOrigins.length === 0) allowedOrigins = undefined;
        }
        let allowedScopes: string[] | undefined;
        if (Array.isArray(body.allowedScopes)) {
            const { SCOPES_SUPPORTED } = await import('../../../shared/oidc-constants.js');
            const supportedSet = new Set(SCOPES_SUPPORTED);
            allowedScopes = body.allowedScopes.filter((s): s is string => typeof s === 'string' && supportedSet.has(s.trim()));
        }
        const { apiKey, keyId } = await createApiKeyForCustomer(customerId, name, env, { allowedOrigins, allowedScopes });

        const response: CreateApiKeyResponse = {
            success: true,
            apiKey,
            keyId,
            name,
            message: 'API key created successfully. Your API key is also available in the API Keys tab.'
        };

        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Failed to create API key',
            message: errorMessage
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}
