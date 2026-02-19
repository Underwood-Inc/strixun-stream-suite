/**
 * Internal Handlers
 * Service-to-service endpoints for internal operations
 * Protected by X-Service-Key header authentication
 * 
 * These endpoints are NOT exposed to public API consumers.
 */

import { getCustomer, storeCustomer } from '../services/customer.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';

interface Env {
    CUSTOMER_KV: KVNamespace;
    SERVICE_API_KEY?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

/**
 * Verify internal service-to-service request
 * Checks X-Service-Key header against SERVICE_API_KEY
 * 
 * @param request - The incoming request
 * @param env - Worker environment
 * @returns True if authorized, false otherwise
 */
export function verifyInternalRequest(request: Request, env: Env): boolean {
    const serviceKey = request.headers.get('X-Service-Key');
    
    if (!env.SERVICE_API_KEY) {
        console.warn('[Internal] SERVICE_API_KEY not configured');
        return false;
    }
    
    if (!serviceKey) {
        console.warn('[Internal] Missing X-Service-Key header');
        return false;
    }
    
    return serviceKey === env.SERVICE_API_KEY;
}

/**
 * Sync lastLogin timestamp from otp-auth-service
 * POST /internal/sync-last-login
 * 
 * Called by otp-auth-service after successful OTP verification
 * to keep customer lastLogin in sync.
 * 
 * Request body:
 * {
 *   customerId: string;
 *   lastLogin: string; // ISO timestamp
 * }
 */
export async function handleSyncLastLogin(
    request: Request,
    env: Env
): Promise<Response> {
    const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()).filter(Boolean) || [],
    });

    try {
        // Verify internal request
        if (!verifyInternalRequest(request, env)) {
            return new Response(JSON.stringify({
                error: 'Unauthorized',
                message: 'Invalid or missing service key'
            }), {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Parse request body
        const body = await request.json() as { customerId?: string; lastLogin?: string };
        
        if (!body.customerId || !body.lastLogin) {
            return new Response(JSON.stringify({
                error: 'Bad Request',
                message: 'customerId and lastLogin are required'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        const { customerId, lastLogin } = body;

        // Get existing customer
        const customer = await getCustomer(env.CUSTOMER_KV, customerId);
        
        if (!customer) {
            // Customer doesn't exist yet - this can happen during initial signup
            // Just log and return success (customer will be created separately)
            console.log(`[Internal] Customer ${customerId} not found, skipping lastLogin sync`);
            return new Response(JSON.stringify({
                success: true,
                message: 'Customer not found, skipping sync'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Update lastLogin
        customer.lastLogin = lastLogin;
        customer.updatedAt = new Date().toISOString();
        
        await storeCustomer(customerId, customer, env);

        console.log(`[Internal] Synced lastLogin for customer ${customerId}: ${lastLogin}`);

        return new Response(JSON.stringify({
            success: true,
            customerId,
            lastLogin
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('[Internal] Failed to sync lastLogin:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            message: error.message || 'Failed to sync lastLogin'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}
