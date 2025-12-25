/**
 * Display Name Management Handlers
 * 
 * Handles display name changes with uniqueness validation
 * 
 * @module handlers/user/displayName
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomerKey } from '../../services/customer.js';
import { 
    validateDisplayName, 
    sanitizeDisplayName,
    isNameUnique,
    reserveDisplayName,
    releaseDisplayName
} from '../../services/nameGenerator.js'; // TypeScript file, .js extension for compatibility

/**
 * Verify JWT token and extract user info
 */
async function authenticateRequest(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authenticated: false, status: 401, error: 'Authorization header required' };
    }

    const token = authHeader.substring(7);
    
    // Import JWT utilities from crypto.js
    const { verifyJWT, getJWTSecret } = await import('../../utils/crypto.js');
    const jwtSecret = getJWTSecret(env);
    const payload = await verifyJWT(token, jwtSecret);

    if (!payload) {
        return { authenticated: false, status: 401, error: 'Invalid or expired token' };
    }

    return {
        authenticated: true,
        userId: payload.userId || payload.sub,
        email: payload.email,
        customerId: payload.customerId || null,
    };
}

/**
 * Get current user's display name
 * GET /user/display-name
 */
export async function handleGetDisplayName(request, env) {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated) {
            return new Response(JSON.stringify({ error: auth.error }), {
                status: auth.status,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get user from KV
        const { hashEmail } = await import('../../utils/crypto.js');
        const emailHash = await hashEmail(auth.email);
        const userKey = getCustomerKey(auth.customerId, `user_${emailHash}`);
        const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' });

        if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            success: true,
            displayName: user.displayName || null,
            userId: user.userId,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get display name',
            message: error.message,
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Update user's display name
 * PUT /user/display-name
 */
export async function handleUpdateDisplayName(request, env) {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated) {
            return new Response(JSON.stringify({ error: auth.error }), {
                status: auth.status,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json();
        const { displayName } = body;

        if (!displayName || typeof displayName !== 'string') {
            return new Response(JSON.stringify({ 
                error: 'Display name is required',
                detail: 'displayName must be a non-empty string'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Sanitize and validate
        const sanitized = sanitizeDisplayName(displayName);
        if (!validateDisplayName(sanitized)) {
            return new Response(JSON.stringify({ 
                error: 'Invalid display name format',
                detail: 'Display name must be 3-30 characters, start with a letter, and contain only alphanumeric characters and spaces'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Check uniqueness
        const unique = await isNameUnique(sanitized, auth.customerId, env);
        if (!unique) {
            return new Response(JSON.stringify({ 
                error: 'Display name already taken',
                detail: 'Please choose a different display name'
            }), {
                status: 409, // Conflict
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get user from KV
        const { hashEmail } = await import('../../utils/crypto.js');
        const emailHash = await hashEmail(auth.email);
        const userKey = getCustomerKey(auth.customerId, `user_${emailHash}`);
        const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' });

        if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Release old display name if it exists
        if (user.displayName && user.displayName !== sanitized) {
            await releaseDisplayName(user.displayName, auth.customerId, env);
        }

        // Reserve new display name
        await reserveDisplayName(sanitized, auth.userId, auth.customerId, env);

        // Update user
        user.displayName = sanitized;
        await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });

        return new Response(JSON.stringify({
            success: true,
            displayName: sanitized,
            message: 'Display name updated successfully',
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to update display name',
            message: error.message,
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

