/**
 * Data Request Handlers (Admin)
 * 
 * Handles admin endpoints for creating and managing sensitive data requests.
 * Requires super-admin authentication.
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { requireSuperAdmin } from '../../utils/super-admin.js';
import { verifyTokenOIDC, extractAuthToken } from '../../utils/verify-token.js';
import { getCustomer } from '../../services/customer.js';
import {
    createDataRequest,
    getDataRequest,
    getRequesterDataRequests,
    CreateDataRequestParams,
} from '../../services/data-request.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    SUPER_ADMIN_API_KEY?: string;
    SUPER_ADMIN_EMAILS?: string;
    JWT_SECRET?: string;
    [key: string]: any;
}

/**
 * Create a new data request
 * POST /admin/data-requests
 */
export async function handleCreateDataRequest(request: Request, env: Env): Promise<Response> {
    try {
        // Require super-admin authentication
        const authError = await requireSuperAdmin(request, env);
        if (authError) {
            return authError;
        }

        let requesterId: string | null = null;
        let requesterEmail: string | null = null;

        const token = extractAuthToken(request.headers.get('Cookie'));
        if (token) {
            const payload = await verifyTokenOIDC(token, env);
            if (payload) {
                requesterId = payload.customerId || null;
                requesterEmail = payload.email || null;
            }
        }

        if (!requesterId || !requesterEmail) {
            return new Response(JSON.stringify({ 
                error: 'Could not identify requester',
                detail: 'Valid JWT token is required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get requester's customer info
        const { getCustomerByEmail } = await import('../../services/customer.js');
        const requesterCustomer = await getCustomerByEmail(requesterEmail, env);
        if (requesterCustomer) {
            requesterId = requesterCustomer.customerId;
        }

        // Parse request body
        const body = await request.json() as {
            targetUserId?: string;
            targetCustomerId?: string | null;
            dataType?: 'email' | 'userId' | 'custom';
            reason?: string;
            expiresIn?: number;
        };

        const { targetUserId, targetCustomerId, dataType, reason, expiresIn } = body;

        // Validate required fields
        if (!targetUserId || typeof targetUserId !== 'string') {
            return new Response(JSON.stringify({ 
                error: 'targetUserId is required',
                detail: 'targetUserId must be a non-empty string (customer email)'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (!dataType || !['email', 'userId', 'custom'].includes(dataType)) {
            return new Response(JSON.stringify({ 
                error: 'dataType is required',
                detail: 'dataType must be one of: email, userId, custom'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            return new Response(JSON.stringify({ 
                error: 'reason is required',
                detail: 'reason must be a non-empty string explaining why access is needed'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get target customer's info
        const { getCustomerByEmail: getCustomerByEmailUtil } = await import('../../services/customer.js');
        const targetCustomer = await getCustomerByEmailUtil(targetUserId, env);
        const resolvedTargetCustomerId = targetCustomerId || (targetCustomer ? targetCustomer.customerId : null);

        // Create data request
        const dataRequest = await createDataRequest({
            requesterId: requesterId || requesterEmail,
            requesterEmail,
            targetUserId: targetUserId.toLowerCase().trim(),
            targetCustomerId: resolvedTargetCustomerId,
            dataType,
            reason: reason.trim(),
            expiresIn,
        }, env);

        // Return request (without sensitive data)
        const responseData = {
            success: true,
            request: {
                requestId: dataRequest.requestId,
                requesterId: dataRequest.requesterId,
                requesterEmail: dataRequest.requesterEmail,
                targetUserId: dataRequest.targetUserId,
                targetCustomerId: dataRequest.targetCustomerId,
                dataType: dataRequest.dataType,
                reason: dataRequest.reason,
                status: dataRequest.status,
                createdAt: dataRequest.createdAt,
                expiresAt: dataRequest.expiresAt,
            },
        };

        return new Response(JSON.stringify(responseData), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: 'Failed to create data request',
            message: error.message,
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get data request by ID
 * GET /admin/data-requests/:id
 */
export async function handleGetDataRequest(request: Request, env: Env, requestId: string): Promise<Response> {
    try {
        // Require super-admin authentication
        const authError = await requireSuperAdmin(request, env);
        if (authError) {
            return authError;
        }

        if (!requestId) {
            return new Response(JSON.stringify({ 
                error: 'Request ID is required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get request (try with null customerId first, then check if it's in a specific customer namespace)
        let dataRequest = await getDataRequest(requestId, null, env);
        
        if (!dataRequest) {
            const reqToken = extractAuthToken(request.headers.get('Cookie'));
            if (reqToken) {
                const payload = await verifyTokenOIDC(reqToken, env);
                if (payload && payload.customerId) {
                    const requesterRequests = await getRequesterDataRequests(payload.customerId, null, env);
                    dataRequest = requesterRequests.find(r => r.requestId === requestId) || null;
                }
            }
        }

        if (!dataRequest) {
            return new Response(JSON.stringify({ 
                error: 'Data request not found'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Return request (without sensitive data like encrypted request key)
        const responseData = {
            success: true,
            request: {
                requestId: dataRequest.requestId,
                requesterId: dataRequest.requesterId,
                requesterEmail: dataRequest.requesterEmail,
                targetUserId: dataRequest.targetUserId,
                targetCustomerId: dataRequest.targetCustomerId,
                dataType: dataRequest.dataType,
                reason: dataRequest.reason,
                status: dataRequest.status,
                createdAt: dataRequest.createdAt,
                approvedAt: dataRequest.approvedAt,
                rejectedAt: dataRequest.rejectedAt,
                expiresAt: dataRequest.expiresAt,
            },
        };

        return new Response(JSON.stringify(responseData), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: 'Failed to get data request',
            message: error.message,
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * List all data requests created by requester
 * GET /admin/data-requests
 */
export async function handleListDataRequests(request: Request, env: Env): Promise<Response> {
    try {
        // Require super-admin authentication
        const authError = await requireSuperAdmin(request, env);
        if (authError) {
            return authError;
        }

        const listToken = extractAuthToken(request.headers.get('Cookie'));
        if (!listToken) {
            return new Response(JSON.stringify({ 
                error: 'Authentication required',
                detail: 'Please authenticate with HttpOnly cookie'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const payload = await verifyTokenOIDC(listToken, env);
        if (!payload || !payload.customerId) {
            return new Response(JSON.stringify({ 
                error: 'Invalid token',
                detail: 'Could not identify requester from token'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get all requests created by this requester
        const requests = await getRequesterDataRequests(payload.customerId, null, env);

        // Filter out sensitive data
        const responseData = {
            success: true,
            requests: requests.map(r => ({
                requestId: r.requestId,
                requesterId: r.requesterId,
                requesterEmail: r.requesterEmail,
                targetUserId: r.targetUserId,
                targetCustomerId: r.targetCustomerId,
                dataType: r.dataType,
                reason: r.reason,
                status: r.status,
                createdAt: r.createdAt,
                approvedAt: r.approvedAt,
                rejectedAt: r.rejectedAt,
                expiresAt: r.expiresAt,
            })),
        };

        return new Response(JSON.stringify(responseData), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: 'Failed to list data requests',
            message: error.message,
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

