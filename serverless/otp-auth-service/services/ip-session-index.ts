/**
 * IP-to-Session Index Service
 * 
 * Maintains a mapping from IP addresses to active sessions for cross-application
 * session discovery. This allows applications to find active sessions for a given IP.
 */

import { hashEmail } from '../utils/crypto.js';
import { getCustomerKey } from './customer.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

interface IPSessionMapping {
    userId: string;
    customerId: string | null;
    sessionKey: string;
    expiresAt: string;
    email: string;
    createdAt: string;
}

/**
 * Hash IP address for storage key
 * Uses SHA-256 to hash IP address for privacy
 */
async function hashIP(ip: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get IP session index key
 */
function getIPSessionKey(ipHash: string): string {
    return `ip_session_${ipHash}`;
}

/**
 * Store IP-to-session mapping
 * 
 * @param ip - IP address
 * @param userId - User ID
 * @param customerId - Customer ID (optional)
 * @param sessionKey - Session storage key
 * @param expiresAt - Session expiration time
 * @param email - User email
 * @param env - Worker environment
 */
export async function storeIPSessionMapping(
    ip: string,
    userId: string,
    customerId: string | null,
    sessionKey: string,
    expiresAt: string,
    email: string,
    env: Env
): Promise<void> {
    if (!ip || ip === 'unknown') {
        return; // Don't store unknown IPs
    }
    
    const ipHash = await hashIP(ip);
    const indexKey = getIPSessionKey(ipHash);
    
    // Get existing sessions for this IP
    const existing = await env.OTP_AUTH_KV.get(indexKey, { type: 'json' }) as IPSessionMapping[] | null;
    const sessions = existing || [];
    
    // Remove existing session for this user (if any) to avoid duplicates
    const filtered = sessions.filter(s => s.userId !== userId);
    
    // Add new session
    const mapping: IPSessionMapping = {
        userId,
        customerId,
        sessionKey,
        expiresAt,
        email,
        createdAt: new Date().toISOString(),
    };
    
    filtered.push(mapping);
    
    // Calculate TTL from expiration time
    const expiresAtDate = new Date(expiresAt);
    const now = new Date();
    const ttl = Math.max(0, Math.floor((expiresAtDate.getTime() - now.getTime()) / 1000));
    
    // Store with TTL matching session expiration
    await env.OTP_AUTH_KV.put(indexKey, JSON.stringify(filtered), { expirationTtl: ttl });
}

/**
 * Get active sessions for an IP address
 * 
 * @param ip - IP address
 * @param env - Worker environment
 * @returns Array of active session mappings
 */
export async function getSessionsByIP(
    ip: string,
    env: Env
): Promise<IPSessionMapping[]> {
    if (!ip || ip === 'unknown') {
        return [];
    }
    
    const ipHash = await hashIP(ip);
    const indexKey = getIPSessionKey(ipHash);
    
    const sessions = await env.OTP_AUTH_KV.get(indexKey, { type: 'json' }) as IPSessionMapping[] | null;
    
    if (!sessions) {
        return [];
    }
    
    // Filter out expired sessions
    const now = new Date();
    const activeSessions = sessions.filter(s => new Date(s.expiresAt) > now);
    
    // If some sessions expired, update the index
    if (activeSessions.length < sessions.length) {
        if (activeSessions.length === 0) {
            // All expired, delete the index
            await env.OTP_AUTH_KV.delete(indexKey);
        } else {
            // Update with only active sessions
            const expiresAtDate = new Date(activeSessions[0].expiresAt);
            const ttl = Math.max(0, Math.floor((expiresAtDate.getTime() - now.getTime()) / 1000));
            await env.OTP_AUTH_KV.put(indexKey, JSON.stringify(activeSessions), { expirationTtl: ttl });
        }
    }
    
    return activeSessions;
}

/**
 * Delete IP-to-session mapping for a specific user
 * 
 * @param ip - IP address
 * @param userId - User ID
 * @param env - Worker environment
 */
export async function deleteIPSessionMapping(
    ip: string,
    userId: string,
    env: Env
): Promise<void> {
    if (!ip || ip === 'unknown') {
        return;
    }
    
    const ipHash = await hashIP(ip);
    const indexKey = getIPSessionKey(ipHash);
    
    const sessions = await env.OTP_AUTH_KV.get(indexKey, { type: 'json' }) as IPSessionMapping[] | null;
    
    if (!sessions) {
        return;
    }
    
    // Remove session for this user
    const filtered = sessions.filter(s => s.userId !== userId);
    
    if (filtered.length === 0) {
        // No more sessions for this IP, delete the index
        await env.OTP_AUTH_KV.delete(indexKey);
    } else {
        // Update with remaining sessions
        const expiresAtDate = new Date(filtered[0].expiresAt);
        const now = new Date();
        const ttl = Math.max(0, Math.floor((expiresAtDate.getTime() - now.getTime()) / 1000));
        await env.OTP_AUTH_KV.put(indexKey, JSON.stringify(filtered), { expirationTtl: ttl });
    }
}

/**
 * Clean up expired IP session mappings
 * This is a maintenance function that can be called periodically
 * 
 * @param env - Worker environment
 */
export async function cleanupExpiredIPMappings(env: Env): Promise<number> {
    // Note: KV doesn't support listing all keys, so this function
    // can only clean up mappings we know about
    // In practice, expired mappings will be cleaned up automatically
    // when getSessionsByIP is called (it filters expired sessions)
    
    // This function is a placeholder for future batch cleanup if needed
    return 0;
}

