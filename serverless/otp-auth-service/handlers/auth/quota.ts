/**
 * Quota Handler
 * Handles quota and usage information endpoint
 */

import { getCorsHeaders, getCorsHeadersRecord } from '../../utils/cors.js';
import { checkQuota as checkQuotaService } from '../../services/analytics.js';
import { getCustomerCached } from '../../utils/cache.js';
import { getCustomer } from '../../services/customer.js';
import { getPlanLimits } from '../../utils/validation.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    JWT_SECRET?: string;
    ALLOWED_ORIGINS?: string;
}

// Wrapper for checkQuota to pass getPlanLimits
async function checkQuota(customerId: string, env: Env) {
    return checkQuotaService(customerId, async (id: string) => await getCustomerCached(id, (cid: string) => getCustomer(cid, env)), getPlanLimits, env);
}

/**
 * Get quota and usage information
 * GET /auth/quota
 * SECURITY: JWT authentication is PRIMARY and REQUIRED
 * API key is NOT a fallback - if JWT fails, request fails
 * JWT is ALWAYS required for encryption (no compromising security)
 */
export async function handleGetQuota(request: Request, env: Env, customerId: string | null = null): Promise<Response> {
    try {
        // SECURITY: JWT authentication is PRIMARY
        // If customerId is provided from router (from JWT auth), use it
        // If customerId is null, JWT verification failed - request should fail
        let resolvedCustomerId: string | null = null;
        
        // Debug logging
        console.log(`[QuotaHandler] Received customerId parameter:`, {
            customerId,
            type: typeof customerId,
            isNull: customerId === null,
            isUndefined: customerId === undefined,
            isString: typeof customerId === 'string',
            trimmed: typeof customerId === 'string' ? customerId.trim() : 'N/A',
            isEmpty: typeof customerId === 'string' ? customerId.trim() === '' : 'N/A'
        });
        
        // Check if customerId is a valid non-empty string (from JWT authentication in router)
        if (customerId && typeof customerId === 'string' && customerId.trim() !== '') {
            // customerId provided from router (JWT auth) - use it directly
            resolvedCustomerId = customerId.trim();
            console.log(`[QuotaHandler] Using customerId from JWT authentication: ${resolvedCustomerId}`);
        } else {
            // No valid customerId provided - JWT authentication failed in router
            // Do NOT fall back to API key - security requirement: JWT is mandatory
            console.log(`[QuotaHandler] No valid customerId provided - JWT authentication failed`);
            return new Response(JSON.stringify({ error: 'JWT token required. Please provide a valid JWT token in the Authorization header.' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // At this point, resolvedCustomerId should be set (either from API key auth or JWT)
        if (!resolvedCustomerId) {
            return new Response(JSON.stringify({ error: 'Customer ID required' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get quota information
        const quotaInfo = await checkQuota(resolvedCustomerId, env);
        
        if (!quotaInfo.allowed && !quotaInfo.quota) {
            // If quota check failed but no quota info, return basic structure
            return new Response(JSON.stringify({
                success: true,
                quota: {
                    otpRequestsPerDay: 1000,
                    otpRequestsPerMonth: 10000
                },
                usage: {
                    daily: 0,
                    monthly: 0,
                    remainingDaily: 1000,
                    remainingMonthly: 10000
                }
            }), {
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/json',
                },
            });
        }
        
        return new Response(JSON.stringify({
            success: true,
            quota: quotaInfo.quota || {
                otpRequestsPerDay: 1000,
                otpRequestsPerMonth: 10000
            },
            usage: quotaInfo.usage || {
                daily: 0,
                monthly: 0,
                remainingDaily: 1000,
                remainingMonthly: 10000
            }
        }), {
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        const err = error as Error;
        return new Response(JSON.stringify({ 
            error: 'Failed to get quota information',
            message: err.message 
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}
