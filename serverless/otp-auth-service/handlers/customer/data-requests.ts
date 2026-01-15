/**
 * Data Request Handlers (Customer)
 * 
 * Handles customer endpoints for approving/rejecting sensitive data requests.
 * Customers can view and manage requests for their own data.
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { verifyJWT, getJWTSecret } from '../../utils/crypto.js';
import { hashEmail } from '../../utils/crypto.js';
import { getCustomerKey } from '../../services/customer.js';
import {
    getDataRequest,
    getCustomerDataRequests,
    approveDataRequest,
    rejectDataRequest,
    getDecryptedRequestKey,
} from '../../services/data-request.js';
import { decryptTwoStage } from '../../utils/two-stage-encryption.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    JWT_SECRET?: string;
    [key: string]: any;
}


/**
 * Authenticate customer request
 */
async function authenticateCustomer(request: Request, env: Env): Promise<{
    authenticated: boolean;
    status?: number;
    error?: string;
    customerId?: string;
    email?: string;
    token?: string;
}> {
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
    const jwtSecret = getJWTSecret(env);
    const payload = await verifyJWT(token, jwtSecret);

    if (!payload) {
        return { authenticated: false, status: 401, error: 'Invalid or expired token' };
    }

    return {
        authenticated: true,
        customerId: payload.customerId || payload.userId || payload.sub,
        email: payload.email,
        token,
    };
}

/**
 * Get customer's data requests (requests for this customer's data)
 * GET /customer/data-requests
 */
export async function handleGetCustomerDataRequests(request: Request, env: Env): Promise<Response> {
    try {
        const auth = await authenticateCustomer(request, env);
        if (!auth.authenticated) {
            return new Response(JSON.stringify({ error: auth.error }), {
                status: auth.status || 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get customer from KV to ensure they exist
        const emailHash = await hashEmail(auth.email!);
        const customerKey = getCustomerKey(auth.customerId, `customer_${emailHash}`);
        const customer = await env.OTP_AUTH_KV.get(customerKey, { type: 'json' }) as Customer | null;

        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get all requests for this customer
        const requests = await getCustomerDataRequests(auth.email!, auth.customerId, env);

        // Filter out sensitive data
        const responseData = {
            success: true,
            requests: requests.map(r => ({
                requestId: r.requestId,
                requesterId: r.requesterId,
                requesterEmail: r.requesterEmail,
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
            error: 'Failed to get customer data requests',
            message: error.message,
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get specific data request
 * GET /customer/data-requests/:id
 */
export async function handleGetCustomerDataRequest(
    request: Request,
    env: Env,
    requestId: string
): Promise<Response> {
    try {
        const auth = await authenticateCustomer(request, env);
        if (!auth.authenticated) {
            return new Response(JSON.stringify({ error: auth.error }), {
                status: auth.status || 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (!requestId) {
            return new Response(JSON.stringify({ 
                error: 'Request ID is required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get request
        const dataRequest = await getDataRequest(requestId, auth.customerId, env);

        if (!dataRequest) {
            return new Response(JSON.stringify({ 
                error: 'Data request not found'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Verify this is the customer's request
        if (dataRequest.targetUserId !== auth.email) {
            return new Response(JSON.stringify({ 
                error: 'Access denied',
                detail: 'This request is not for your data'
            }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Return request (without sensitive data)
        const responseData = {
            success: true,
            request: {
                requestId: dataRequest.requestId,
                requesterId: dataRequest.requesterId,
                requesterEmail: dataRequest.requesterEmail,
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
 * Approve a data request
 * POST /customer/data-requests/:id/approve
 */
export async function handleApproveDataRequest(
    request: Request,
    env: Env,
    requestId: string
): Promise<Response> {
    try {
        const auth = await authenticateCustomer(request, env);
        if (!auth.authenticated || !auth.token) {
            return new Response(JSON.stringify({ error: auth.error }), {
                status: auth.status || 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (!requestId) {
            return new Response(JSON.stringify({ 
                error: 'Request ID is required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get request to verify it's for this customer
        const dataRequest = await getDataRequest(requestId, auth.customerId, env);

        if (!dataRequest) {
            return new Response(JSON.stringify({ 
                error: 'Data request not found'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (dataRequest.targetUserId !== auth.email) {
            return new Response(JSON.stringify({ 
                error: 'Access denied',
                detail: 'This request is not for your data'
            }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get requester's token from request body (optional, for encrypting request key)
        const body = await request.json().catch(() => ({})) as { requesterToken?: string };
        const requesterToken = body.requesterToken || auth.token; // Fallback to owner's token if not provided

        // Approve request
        const approvedRequest = await approveDataRequest({
            requestId,
            ownerUserId: auth.email!,
            ownerToken: auth.token,
            requesterToken,
        }, env);

        return new Response(JSON.stringify({
            success: true,
            request: {
                requestId: approvedRequest.requestId,
                status: approvedRequest.status,
                approvedAt: approvedRequest.approvedAt,
            },
            message: 'Data request approved successfully',
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: 'Failed to approve data request',
            message: error.message,
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Reject a data request
 * POST /customer/data-requests/:id/reject
 */
export async function handleRejectDataRequest(
    request: Request,
    env: Env,
    requestId: string
): Promise<Response> {
    try {
        const auth = await authenticateCustomer(request, env);
        if (!auth.authenticated) {
            return new Response(JSON.stringify({ error: auth.error }), {
                status: auth.status || 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (!requestId) {
            return new Response(JSON.stringify({ 
                error: 'Request ID is required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get request to verify it's for this customer
        const dataRequest = await getDataRequest(requestId, auth.customerId, env);

        if (!dataRequest) {
            return new Response(JSON.stringify({ 
                error: 'Data request not found'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (dataRequest.targetUserId !== auth.email) {
            return new Response(JSON.stringify({ 
                error: 'Access denied',
                detail: 'This request is not for your data'
            }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Reject request
        const rejectedRequest = await rejectDataRequest(
            requestId,
            auth.email!,
            auth.customerId,
            env
        );

        return new Response(JSON.stringify({
            success: true,
            request: {
                requestId: rejectedRequest.requestId,
                status: rejectedRequest.status,
                rejectedAt: rejectedRequest.rejectedAt,
            },
            message: 'Data request rejected successfully',
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: 'Failed to reject data request',
            message: error.message,
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Decrypt double-encrypted data using approved request
 * POST /customer/data-requests/:id/decrypt
 * 
 * This endpoint allows the requester to decrypt double-encrypted data
 * after the request has been approved.
 */
export async function handleDecryptData(
    request: Request,
    env: Env,
    requestId: string
): Promise<Response> {
    try {
        const auth = await authenticateCustomer(request, env);
        if (!auth.authenticated || !auth.token) {
            return new Response(JSON.stringify({ error: auth.error }), {
                status: auth.status || 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (!requestId) {
            return new Response(JSON.stringify({ 
                error: 'Request ID is required'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Parse request body (contains double-encrypted data)
        const body = await request.json() as {
            encryptedData?: unknown;
            ownerToken?: string; // Owner's JWT token (provided by system)
        };

        const { encryptedData, ownerToken } = body;

        if (!encryptedData) {
            return new Response(JSON.stringify({ 
                error: 'encryptedData is required',
                detail: 'Must provide double-encrypted data to decrypt'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (!ownerToken) {
            return new Response(JSON.stringify({ 
                error: 'ownerToken is required',
                detail: 'Must provide data owner\'s JWT token to decrypt'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get request and verify it's approved
        const dataRequest = await getDataRequest(requestId, auth.customerId, env);

        if (!dataRequest) {
            return new Response(JSON.stringify({ 
                error: 'Data request not found'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        if (dataRequest.status !== 'approved') {
            return new Response(JSON.stringify({ 
                error: 'Request is not approved',
                detail: `Request status: ${dataRequest.status}`
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Verify requester matches
        if (dataRequest.requesterId !== auth.customerId && dataRequest.requesterEmail !== auth.email) {
            return new Response(JSON.stringify({ 
                error: 'Access denied',
                detail: 'Only the requester can decrypt data using this request'
            }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get decrypted request key
        const requestKey = await getDecryptedRequestKey(requestId, auth.token!, auth.customerId, env);

        // Decrypt double-encrypted data
        const decryptedData = await decryptTwoStage(
            encryptedData as any,
            ownerToken,
            requestKey
        );

        return new Response(JSON.stringify({
            success: true,
            decryptedData,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: 'Failed to decrypt data',
            message: error.message,
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

