/**
 * Data Request Service
 * 
 * Manages sensitive data requests where super admins can request access to
 * double-encrypted user data (like email/userId), and users can approve/reject.
 * 
 * Architecture:
 * - Super admin creates request for user's sensitive data
 * - Request includes reason and data type
 * - User (data owner) can approve/reject request
 * - When approved, request key is encrypted with requester's JWT
 * - Requester can use request key + owner's JWT to decrypt double-encrypted data
 */

import { getCustomerKey } from './customer.js';
// Uses shared encryption suite from serverless/shared/encryption
import { encryptWithJWT, decryptWithJWT } from '@strixun/api-framework';
import { generateRequestKey } from '../utils/two-stage-encryption.js';

export interface DataRequest {
    requestId: string;
    requesterId: string;        // Super admin customerId
    requesterEmail: string;     // Super admin email
    targetUserId: string;        // User whose data is requested (email)
    targetCustomerId: string | null; // User's customerId
    dataType: 'email' | 'userId' | 'custom';
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
    targetUserId: string;
    targetCustomerId: string | null;
    dataType: 'email' | 'userId' | 'custom';
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
const REQUEST_KEY_PREFIX = 'data_request_';
const USER_REQUESTS_INDEX_PREFIX = 'user_requests_'; // Index: user_requests_{targetUserId}
const REQUESTER_REQUESTS_INDEX_PREFIX = 'requester_requests_'; // Index: requester_requests_{requesterId}

/**
 * Get KV key for data request
 */
function getRequestKey(requestId: string, customerId: string | null): string {
    return getCustomerKey(customerId, `${REQUEST_KEY_PREFIX}${requestId}`);
}

/**
 * Get KV key for user's requests index
 */
function getUserRequestsIndexKey(targetUserId: string, customerId: string | null): string {
    // Use userId directly (it's already an email, which is unique)
    return getCustomerKey(customerId, `${USER_REQUESTS_INDEX_PREFIX}${targetUserId}`);
}

/**
 * Get KV key for requester's requests index
 */
function getRequesterRequestsIndexKey(requesterId: string, customerId: string | null): string {
    return getCustomerKey(customerId, `${REQUESTER_REQUESTS_INDEX_PREFIX}${requesterId}`);
}

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

    // Store request
    const requestKey = getRequestKey(requestId, params.targetCustomerId);
    await env.OTP_AUTH_KV.put(requestKey, JSON.stringify(request), {
        expirationTtl: expiresIn,
    });

    // Add to user's requests index
    const userIndexKey = getUserRequestsIndexKey(params.targetUserId, params.targetCustomerId);
    const userIndex = await env.OTP_AUTH_KV.get(userIndexKey, { type: 'json' }) as string[] | null;
    const updatedUserIndex = userIndex ? [...userIndex, requestId] : [requestId];
    await env.OTP_AUTH_KV.put(userIndexKey, JSON.stringify(updatedUserIndex), {
        expirationTtl: expiresIn,
    });

    // Add to requester's requests index
    const requesterIndexKey = getRequesterRequestsIndexKey(params.requesterId, params.targetCustomerId);
    const requesterIndex = await env.OTP_AUTH_KV.get(requesterIndexKey, { type: 'json' }) as string[] | null;
    const updatedRequesterIndex = requesterIndex ? [...requesterIndex, requestId] : [requestId];
    await env.OTP_AUTH_KV.put(requesterIndexKey, JSON.stringify(updatedRequesterIndex), {
        expirationTtl: expiresIn,
    });

    return request;
}

/**
 * Get data request by ID
 */
export async function getDataRequest(
    requestId: string,
    targetCustomerId: string | null,
    env: Env
): Promise<DataRequest | null> {
    const requestKey = getRequestKey(requestId, targetCustomerId);
    const request = await env.OTP_AUTH_KV.get(requestKey, { type: 'json' }) as DataRequest | null;
    
    if (!request) {
        return null;
    }

    // Check if expired
    if (new Date(request.expiresAt) < new Date() && request.status === 'pending') {
        request.status = 'expired';
        await env.OTP_AUTH_KV.put(requestKey, JSON.stringify(request), {
            expirationTtl: request.expiresIn,
        });
    }

    return request;
}

/**
 * Get all requests for a user (target)
 */
export async function getUserDataRequests(
    targetUserId: string,
    targetCustomerId: string | null,
    env: Env
): Promise<DataRequest[]> {
    const userIndexKey = getUserRequestsIndexKey(targetUserId, targetCustomerId);
    const requestIds = await env.OTP_AUTH_KV.get(userIndexKey, { type: 'json' }) as string[] | null;
    
    if (!requestIds || requestIds.length === 0) {
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
 */
export async function getRequesterDataRequests(
    requesterId: string,
    targetCustomerId: string | null,
    env: Env
): Promise<DataRequest[]> {
    const requesterIndexKey = getRequesterRequestsIndexKey(requesterId, targetCustomerId);
    const requestIds = await env.OTP_AUTH_KV.get(requesterIndexKey, { type: 'json' }) as string[] | null;
    
    if (!requestIds || requestIds.length === 0) {
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

    // Verify owner is the target user
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
    const requestKeyKV = getRequestKey(params.requestId, request.targetCustomerId);
    await env.OTP_AUTH_KV.put(requestKeyKV, JSON.stringify(request), {
        expirationTtl: request.expiresIn,
    });

    return request;
}

/**
 * Reject a data request
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

    // Verify owner is the target user
    if (request.targetUserId !== ownerUserId) {
        throw new Error('Only the data owner can reject this request');
    }

    // Update request
    request.status = 'rejected';
    request.rejectedAt = new Date().toISOString();

    // Store updated request
    const requestKeyKV = getRequestKey(requestId, targetCustomerId);
    await env.OTP_AUTH_KV.put(requestKeyKV, JSON.stringify(request), {
        expirationTtl: request.expiresIn,
    });

    return request;
}

/**
 * Get decrypted request key for approved request
 * 
 * This is used by the requester to decrypt double-encrypted data.
 * The requester must provide their JWT token to decrypt the request key.
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

