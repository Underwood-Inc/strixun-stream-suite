/**
 * Display Name Management Handlers
 * 
 * Handles display name changes with uniqueness validation
 * CRITICAL: Updates CUSTOMER_KV via customer-api (NOT OTP_AUTH_KV)
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { 
    validateDisplayName, 
    sanitizeDisplayName,
    isNameUnique,
    reserveDisplayName,
    releaseDisplayName
} from '../../services/nameGenerator.js';
import { updateCustomer } from '@strixun/api-framework';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    JWT_SECRET?: string;
    CUSTOMER_API_URL?: string;
    NETWORK_INTEGRITY_KEYPHRASE?: string;
    [key: string]: any;
}

interface AuthResult {
    authenticated: boolean;
    status?: number;
    error?: string;
    customerId?: string;
    email?: string;
    jwtToken?: string;
}

/**
 * Verify JWT token and extract customer info
 * ONLY checks HttpOnly cookie - NO Authorization header fallback
 */
async function authenticateRequest(request: Request, env: Env): Promise<AuthResult> {
    // ONLY check HttpOnly cookie - NO Authorization header fallback
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
        return { authenticated: false, status: 401, error: 'Authentication required. Please authenticate with HttpOnly cookie.' };
    }

    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (!authCookie) {
        return { authenticated: false, status: 401, error: 'Authentication required. Please authenticate with HttpOnly cookie.' };
    }

    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const token = authCookie.substring('auth_token='.length).trim();
    
    // Import JWT utilities from crypto.js
    const { verifyJWT, getJWTSecret } = await import('../../utils/crypto.js');
    const jwtSecret = getJWTSecret(env);
    const payload = await verifyJWT(token, jwtSecret);

    if (!payload) {
        return { authenticated: false, status: 401, error: 'Invalid or expired token' };
    }

    return {
        authenticated: true,
        customerId: payload.customerId || payload.userId || payload.sub,
        email: payload.email,
        jwtToken: token,
    };
}

/**
 * Get current customer's display name from customer-api
 * GET /customer/display-name
 */
export async function handleGetDisplayName(request: Request, env: Env): Promise<Response> {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated) {
            return new Response(JSON.stringify({ error: auth.error }), {
                status: auth.status || 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (!auth.customerId) {
            return new Response(JSON.stringify({ error: 'Customer ID required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Fetch customer data from customer-api
        const { fetchCustomerByCustomerId } = await import('@strixun/api-framework');
        const customer = await fetchCustomerByCustomerId(auth.customerId, env);

        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            success: true,
            displayName: customer.displayName || null,
            customerId: customer.customerId,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
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
 * Update customer's display name via customer-api
 * PUT /customer/display-name
 */
export async function handleUpdateDisplayName(request: Request, env: Env): Promise<Response> {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated) {
            return new Response(JSON.stringify({ error: auth.error }), {
                status: auth.status || 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (!auth.customerId) {
            return new Response(JSON.stringify({ 
                error: 'Customer ID required',
                detail: 'Customer ID must be present in JWT token'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const body = await request.json() as { displayName?: string };
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
                detail: 'Display name must be 3-32 characters, start with a letter, contain only letters, spaces, and dashes'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Check uniqueness (global scope)
        const unique = await isNameUnique(sanitized, null, env);
        if (!unique) {
            return new Response(JSON.stringify({ 
                error: 'Display name already taken',
                detail: 'Please choose a different display name'
            }), {
                status: 409, // Conflict
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get current customer data to check for existing display name
        const { fetchCustomerByCustomerId } = await import('@strixun/api-framework');
        const customer = await fetchCustomerByCustomerId(auth.customerId, env);

        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Release old display name if it exists (user-initiated change)
        if (customer.displayName && customer.displayName !== sanitized) {
            await releaseDisplayName(customer.displayName, null, env); // Global scope
        }

        // Reserve new display name (global scope)
        await reserveDisplayName(sanitized, auth.customerId, null, env);

        // Update display name via customer-api
        // This updates both customer record and preferences in CUSTOMER_KV
        const customerApiUrl = env.CUSTOMER_API_URL || (env.ENVIRONMENT === 'development' ? 'http://localhost:8790' : 'https://customer-api.idling.app');
        const updateResponse = await fetch(`${customerApiUrl}/customer/${auth.customerId}/display-name`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('Cookie') || '',
            },
            body: JSON.stringify({ displayName: sanitized }),
        });

        if (!updateResponse.ok) {
            const errorData = await updateResponse.json().catch(() => ({}));
            return new Response(JSON.stringify({ 
                error: 'Failed to update display name',
                detail: errorData.detail || 'Customer API update failed'
            }), {
                status: updateResponse.status,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            success: true,
            displayName: sanitized,
            message: 'Display name updated successfully',
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: 'Failed to update display name',
            message: error.message,
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Regenerate customer's display name via customer-api
 * POST /customer/display-name/regenerate
 */
export async function handleRegenerateDisplayName(request: Request, env: Env): Promise<Response> {
    try {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated) {
            return new Response(JSON.stringify({ error: auth.error }), {
                status: auth.status || 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (!auth.customerId) {
            return new Response(JSON.stringify({ 
                error: 'Customer ID required',
                detail: 'Customer ID must be present in JWT token'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get current customer data
        const { fetchCustomerByCustomerId } = await import('@strixun/api-framework');
        const customer = await fetchCustomerByCustomerId(auth.customerId, env);

        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Generate new unique display name
        const { generateUniqueDisplayName } = await import('../../services/nameGenerator.js');
        const newDisplayName = await generateUniqueDisplayName({
            maxAttempts: 10,
            pattern: 'random',
            maxWords: 2 // Support dash-separated names
        }, env);
        
        // Handle empty string (generation failed after retries)
        if (!newDisplayName || newDisplayName.trim() === '') {
            return new Response(JSON.stringify({
                error: 'Unable to generate unique display name',
                detail: 'Display name generation failed. Please try again or contact support.'
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Release old display name if it exists (user-initiated regeneration)
        if (customer.displayName && customer.displayName !== newDisplayName) {
            await releaseDisplayName(customer.displayName, null, env); // Global scope
        }

        // Reserve new display name (global scope)
        await reserveDisplayName(newDisplayName, auth.customerId, null, env);

        // Update display name via customer-api
        const customerApiUrl = env.CUSTOMER_API_URL || 'http://localhost:8790';
        const updateResponse = await fetch(`${customerApiUrl}/customer/${auth.customerId}/display-name`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('Cookie') || '',
            },
            body: JSON.stringify({ displayName: newDisplayName }),
        });

        if (!updateResponse.ok) {
            const errorData = await updateResponse.json().catch(() => ({}));
            return new Response(JSON.stringify({ 
                error: 'Failed to regenerate display name',
                detail: errorData.detail || 'Customer API update failed'
            }), {
                status: updateResponse.status,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            success: true,
            displayName: newDisplayName,
            message: 'Display name regenerated successfully',
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: 'Failed to regenerate display name',
            message: error.message,
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}
