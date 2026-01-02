/**
 * Data Request Handlers (Admin)
 * 
 * Handles admin endpoints for creating and managing sensitive data requests.
 * Requires super-admin authentication.
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { requireSuperAdmin, authenticateSuperAdminEmail } from '../../utils/super-admin.js';
import { verifyJWT, getJWTSecret } from '../../utils/crypto.js';
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

        // Get requester info from JWT or API key
        let requesterId: string | null = null;
        let requesterEmail: string | null = null;

        // Try to get from JWT token
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            // CRITICAL: Trim token to ensure it matches the token used for encryption
            const token = authHeader.substring(7).trim();
            const jwtSecret = getJWTSecret(env);
            const payload = await verifyJWT(token, jwtSecret);
            
            if (payload) {
                requesterId = payload.customerId || null;
                requesterEmail = payload.email || null;
            }
        }

        // If no JWT, try email-based super admin
        if (!requesterEmail) {
            requesterEmail = await authenticateSuperAdminEmail(request, env);
        }

        if (!requesterEmail) {
            return new Response(JSON.stringify({ 
                error: 'Could not identify requester',
                detail: 'Super admin email is required'
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
                detail: 'targetUserId must be a non-empty string (user email)'
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

        // Get target user's customer info
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
        
        // If not found, try to find it by searching requester's requests
        if (!dataRequest) {
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const jwtSecret = getJWTSecret(env);
                const payload = await verifyJWT(token, jwtSecret);
                
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

        // Get requester info from JWT
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ 
                error: 'Authorization header required',
                detail: 'JWT token is required to identify requester'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // CRITICAL: Trim token to ensure it matches the token used for encryption
        const token = authHeader.substring(7).trim();
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);

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

