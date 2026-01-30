/**
 * Data Request Service
 * 
 * Manages sensitive data requests where super admins can request access to
 * double-encrypted customer data (like email/customerId), and customers can approve/reject.
 * 
 * Architecture:
 * - Super admin creates request for customer's sensitive data
 * - Request includes reason and data type
 * - Customer (data owner) can approve/reject request
 * - When approved, request key is encrypted with requester's JWT
 * - Requester can use request key + owner's JWT to decrypt double-encrypted data
 * 
 * Uses kv-entities pattern for consistent key management.
 */

import { getEntity, putEntity, indexGet, indexAdd } from '@strixun/kv-entities';
// Uses shared encryption suite from serverless/shared/encryption
import { encryptWithJWT, decryptWithJWT } from '@strixun/api-framework';
import { generateRequestKey } from '../utils/two-stage-encryption.js';

export interface DataRequest {
    requestId: string;
    requesterId: string;        // Super admin customerId
    requesterEmail: string;     // Super admin email
    targetUserId: string;        // Customer whose data is requested (email) - legacy field name
    targetCustomerId: string | null; // Customer's customerId
    dataType: 'email' | 'customerId' | 'custom';
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    requestKey?: string;         // Plain request key (only stored when approved, encrypted with requester's JWT)
    encryptedRequestKey?: string; // Request key encrypted with requester's JWT (when approved)
    createdAt: string;
    approvedAt?: string;
    rejectedAt?: string;
    expiresAt: string;
    expiresIn: number;           // TTL in seconds (default: 30 days)
}

export interface CreateDataRequestParams {
    requesterId: string;
    requesterEmail: string;
    targetUserId: string;        // Legacy field name - represents customer email
    targetCustomerId: string | null;
    dataType: 'email' | 'customerId' | 'custom';
    reason: string;
    expiresIn?: number;          // TTL in seconds (default: 30 days = 2592000)
}

export interface ApproveDataRequestParams {
    requestId: string;
    ownerUserId: string;
    ownerToken: string;          // Owner's JWT token
    requesterToken: string;      // Requester's JWT token (to encrypt request key)
}

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

const DEFAULT_EXPIRES_IN = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
    const timestamp = Date.now();
    const random = crypto.getRandomValues(new Uint8Array(8));
    const randomHex = Array.from(random).map(b => b.toString(16).padStart(2, '0')).join('');
    return `req_${timestamp}_${randomHex}`;
}

/**
 * Create a new data request
 * 
 * Stores the request entity and updates indexes for both
 * the target customer and the requester.
 */
export async function createDataRequest(
    params: CreateDataRequestParams,
    env: Env
): Promise<DataRequest> {
    const requestId = generateRequestId();
    const now = new Date();
    const expiresIn = params.expiresIn || DEFAULT_EXPIRES_IN;
    const expiresAt = new Date(now.getTime() + expiresIn * 1000);

    const request: DataRequest = {
        requestId,
        requesterId: params.requesterId,
        requesterEmail: params.requesterEmail,
        targetUserId: params.targetUserId,
        targetCustomerId: params.targetCustomerId,
        dataType: params.dataType,
        reason: params.reason,
        status: 'pending',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        expiresIn,
    };

    // Store request entity
    await putEntity(env.OTP_AUTH_KV, 'auth', 'data-request', requestId, request, {
        expirationTtl: expiresIn,
    });

    // Add to customer's requests index (by target email)
    await indexAdd(env.OTP_AUTH_KV, 'auth', 'requests-for-customer', params.targetUserId, requestId);

    // Add to requester's requests index
    await indexAdd(env.OTP_AUTH_KV, 'auth', 'requests-by-requester', params.requesterId, requestId);

    return request;
}

/**
 * Get data request by ID
 * 
 * Also handles expiration - if a pending request has expired,
 * updates its status to 'expired'.
 */
export async function getDataRequest(
    requestId: string,
    _targetCustomerId: string | null,
    env: Env
): Promise<DataRequest | null> {
    const request = await getEntity<DataRequest>(env.OTP_AUTH_KV, 'auth', 'data-request', requestId);
    
    if (!request) {
        return null;
    }

    // Check if expired
    if (new Date(request.expiresAt) < new Date() && request.status === 'pending') {
        request.status = 'expired';
        await putEntity(env.OTP_AUTH_KV, 'auth', 'data-request', requestId, request, {
            expirationTtl: request.expiresIn,
        });
    }

    return request;
}

/**
 * Get all requests for a customer (target)
 * 
 * Returns all data requests where the specified customer is the target
 * (i.e., their data is being requested).
 */
export async function getCustomerDataRequests(
    targetUserId: string,
    targetCustomerId: string | null,
    env: Env
): Promise<DataRequest[]> {
    const requestIds = await indexGet(env.OTP_AUTH_KV, 'auth', 'requests-for-customer', targetUserId);
    
    if (requestIds.length === 0) {
        return [];
    }

    const requests: DataRequest[] = [];
    for (const requestId of requestIds) {
        const request = await getDataRequest(requestId, targetCustomerId, env);
        if (request) {
            requests.push(request);
        }
    }

    // Sort by created date (newest first)
    requests.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return requests;
}

/**
 * Get all requests created by a requester
 * 
 * Returns all data requests created by the specified requester
 * (typically a super admin).
 */
export async function getRequesterDataRequests(
    requesterId: string,
    targetCustomerId: string | null,
    env: Env
): Promise<DataRequest[]> {
    const requestIds = await indexGet(env.OTP_AUTH_KV, 'auth', 'requests-by-requester', requesterId);
    
    if (requestIds.length === 0) {
        return [];
    }

    const requests: DataRequest[] = [];
    for (const requestId of requestIds) {
        const request = await getDataRequest(requestId, targetCustomerId, env);
        if (request) {
            requests.push(request);
        }
    }

    // Sort by created date (newest first)
    requests.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return requests;
}

/**
 * Approve a data request
 * 
 * When approved:
 * 1. Generate request key
 * 2. Encrypt request key with requester's JWT
 * 3. Store encrypted request key in request
 * 4. Update request status to 'approved'
 * 
 * @param params - Approval parameters including owner and requester tokens
 * @param env - Worker environment
 * @returns Updated data request
 */
export async function approveDataRequest(
    params: ApproveDataRequestParams,
    env: Env
): Promise<DataRequest> {
    const request = await getDataRequest(params.requestId, null, env);
    
    if (!request) {
        throw new Error('Data request not found');
    }

    if (request.status !== 'pending') {
        throw new Error(`Cannot approve request with status: ${request.status}`);
    }

    if (new Date(request.expiresAt) < new Date()) {
        throw new Error('Data request has expired');
    }

    // Verify owner is the target customer
    if (request.targetUserId !== params.ownerUserId) {
        throw new Error('Only the data owner can approve this request');
    }

    // Generate request key
    const requestKey = generateRequestKey();

    // Encrypt request key with requester's JWT
    const encryptedRequestKey = await encryptWithJWT(requestKey, params.requesterToken);

    // Update request
    request.status = 'approved';
    request.requestKey = requestKey; // Store plain key temporarily (will be removed after encryption)
    request.encryptedRequestKey = JSON.stringify(encryptedRequestKey);
    request.approvedAt = new Date().toISOString();

    // Remove plain request key (security: never store plain keys)
    delete request.requestKey;

    // Store updated request
    await putEntity(env.OTP_AUTH_KV, 'auth', 'data-request', params.requestId, request, {
        expirationTtl: request.expiresIn,
    });

    return request;
}

/**
 * Reject a data request
 * 
 * Updates the request status to 'rejected' and records the rejection time.
 * 
 * @param requestId - ID of the request to reject
 * @param ownerUserId - Email of the data owner (must match target)
 * @param targetCustomerId - Customer ID for scoping (nullable)
 * @param env - Worker environment
 * @returns Updated data request
 */
export async function rejectDataRequest(
    requestId: string,
    ownerUserId: string,
    targetCustomerId: string | null,
    env: Env
): Promise<DataRequest> {
    const request = await getDataRequest(requestId, targetCustomerId, env);
    
    if (!request) {
        throw new Error('Data request not found');
    }

    if (request.status !== 'pending') {
        throw new Error(`Cannot reject request with status: ${request.status}`);
    }

    // Verify owner is the target customer
    if (request.targetUserId !== ownerUserId) {
        throw new Error('Only the data owner can reject this request');
    }

    // Update request
    request.status = 'rejected';
    request.rejectedAt = new Date().toISOString();

    // Store updated request
    await putEntity(env.OTP_AUTH_KV, 'auth', 'data-request', requestId, request, {
        expirationTtl: request.expiresIn,
    });

    return request;
}

/**
 * Get decrypted request key for approved request
 * 
 * This is used by the requester to decrypt double-encrypted data.
 * The requester must provide their JWT token to decrypt the request key.
 * 
 * @param requestId - ID of the approved request
 * @param requesterToken - Requester's JWT token for decryption
 * @param targetCustomerId - Customer ID for scoping (nullable)
 * @param env - Worker environment
 * @returns Decrypted request key string
 */
export async function getDecryptedRequestKey(
    requestId: string,
    requesterToken: string,
    targetCustomerId: string | null,
    env: Env
): Promise<string> {
    const request = await getDataRequest(requestId, targetCustomerId, env);
    
    if (!request) {
        throw new Error('Data request not found');
    }

    if (request.status !== 'approved') {
        throw new Error(`Request is not approved (status: ${request.status})`);
    }

    if (!request.encryptedRequestKey) {
        throw new Error('Request key not found in approved request');
    }

    // Decrypt request key with requester's JWT
    const encryptedKey = JSON.parse(request.encryptedRequestKey);
    const requestKey = await decryptWithJWT(encryptedKey, requesterToken);

    if (typeof requestKey !== 'string') {
        throw new Error('Invalid request key format');
    }

    return requestKey;
}
