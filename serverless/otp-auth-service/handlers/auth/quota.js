/**
 * Quota Handler
 * Handles quota and usage information endpoint
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { verifyJWT, getJWTSecret } from '../../utils/crypto.js';
import { checkQuota as checkQuotaService } from '../../services/analytics.js';
import { getCustomerCached } from '../../utils/cache.js';
import { getCustomer } from '../../services/customer.js';
import { getPlanLimits } from '../../utils/validation.js';

// Wrapper for checkQuota to pass getPlanLimits
async function checkQuota(customerId, env) {
    return checkQuotaService(customerId, async (id) => await getCustomerCached(id, (cid) => getCustomer(cid, env)), getPlanLimits, env);
}

/**
 * Get quota and usage information
 * GET /auth/quota
 */
export async function handleGetQuota(request, env) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Authorization header required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // CRITICAL: Trim token to ensure it matches the token used for encryption
        const token = authHeader.substring(7).trim();
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get customer ID from token (for multi-tenant isolation)
        const customerId = payload.customerId || null;
        
        // Get quota information
        const quotaInfo = await checkQuota(customerId, env);
        
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
        return new Response(JSON.stringify({ 
            error: 'Failed to get quota information',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

