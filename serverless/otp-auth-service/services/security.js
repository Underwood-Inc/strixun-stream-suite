/**
 * Security service
 * Security logging, IP allowlisting, and audit logging
 */

import { getCustomer } from './customer.js';

/**
 * Log security event
 * @param {string} customerId - Customer ID
 * @param {string} eventType - Event type
 * @param {object} details - Event details
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
export async function logSecurityEvent(customerId, eventType, details, env) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const auditKey = `audit_${customerId}_${today}`;
        
        const existing = await env.OTP_AUTH_KV.get(auditKey, { type: 'json' }) || {
            customerId,
            date: today,
            events: []
        };
        
        existing.events.push({
            eventType,
            timestamp: new Date().toISOString(),
            ...details
        });
        
        // Keep only last 1000 events
        if (existing.events.length > 1000) {
            existing.events = existing.events.slice(-1000);
        }
        
        await env.OTP_AUTH_KV.put(auditKey, JSON.stringify(existing), { expirationTtl: 7776000 }); // 90 days
    } catch (error) {
        console.error('Security logging error:', error);
    }
}

/**
 * Check if IP is in CIDR range (simplified IPv4)
 * @param {string} ip - IP address
 * @param {string} cidr - CIDR notation (e.g., "192.168.1.0/24")
 * @returns {boolean} True if IP is in range
 */
export function isIPInCIDR(ip, cidr) {
    try {
        const [network, prefixLength] = cidr.split('/');
        const prefix = parseInt(prefixLength, 10);
        
        const ipParts = ip.split('.').map(Number);
        const networkParts = network.split('.').map(Number);
        
        if (ipParts.length !== 4 || networkParts.length !== 4) {
            return false;
        }
        
        // Convert to 32-bit integers
        const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
        const networkNum = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
        const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
        
        return (ipNum & mask) === (networkNum & mask);
    } catch (error) {
        return false;
    }
}

/**
 * Check IP allowlist
 * @param {string} customerId - Customer ID
 * @param {string} ip - IP address
 * @param {*} env - Worker environment
 * @returns {Promise<boolean>} True if IP is allowed
 */
export async function checkIPAllowlist(customerId, ip, env) {
    if (!customerId || !ip) return true; // Allow if no customer or IP
    
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer || !customer.config || !customer.config.allowedIPs) {
            return true; // No IP restrictions
        }
        
        const allowedIPs = customer.config.allowedIPs;
        
        // Check for wildcard (allow all)
        if (allowedIPs.includes('*')) {
            return true;
        }
        
        // Check exact match
        if (allowedIPs.includes(ip)) {
            return true;
        }
        
        // Check CIDR ranges
        for (const allowed of allowedIPs) {
            if (allowed.includes('/')) {
                // Simple CIDR check (for IPv4)
                if (isIPInCIDR(ip, allowed)) {
                    return true;
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('IP allowlist check error:', error);
        return true; // Fail open
    }
}

