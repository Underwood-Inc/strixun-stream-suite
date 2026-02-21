/**
 * Security service
 * Security logging, IP allowlisting, and audit logging
 */

import { getCustomer } from './customer.js';

interface Env {
  OTP_AUTH_KV: KVNamespace;
  [key: string]: unknown;
}

interface AuditEvent {
  eventType: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Log security event to KV (audit trail per customer per day).
 */
export async function logSecurityEvent(
  customerId: string,
  eventType: string,
  details: Record<string, unknown>,
  env: Env
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const auditKey = `audit_${customerId}_${today}`;

    const existing = (await env.OTP_AUTH_KV.get(auditKey, { type: 'json' })) as {
      customerId: string;
      date: string;
      events: AuditEvent[];
    } | null || {
      customerId,
      date: today,
      events: [] as AuditEvent[]
    };

    existing.events.push({
      eventType,
      timestamp: new Date().toISOString(),
      ...details
    });

    if (existing.events.length > 1000) {
      existing.events = existing.events.slice(-1000);
    }

    await env.OTP_AUTH_KV.put(auditKey, JSON.stringify(existing), { expirationTtl: 7776000 });
  } catch (error) {
    console.error('Security logging error:', error);
  }
}

/**
 * Check if IP is in CIDR range (simplified IPv4).
 */
export function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    const [network, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength, 10);

    const ipParts = ip.split('.').map(Number);
    const networkParts = network.split('.').map(Number);

    if (ipParts.length !== 4 || networkParts.length !== 4) {
      return false;
    }

    const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    const networkNum = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
    const mask = (0xffffffff << (32 - prefix)) >>> 0;

    return (ipNum & mask) === (networkNum & mask);
  } catch {
    return false;
  }
}

/**
 * Check IP allowlist for customer (config.allowedIPs); no config = allow.
 */
export async function checkIPAllowlist(customerId: string, ip: string, env: Env): Promise<boolean> {
  if (!customerId || !ip) return true;

  try {
    const customer = await getCustomer(customerId, env);
    if (!customer?.config?.allowedIPs) {
      return true;
    }

    const allowedIPs = customer.config.allowedIPs as string[];
    if (allowedIPs.includes('*') || allowedIPs.includes(ip)) {
      return true;
    }

    for (const allowed of allowedIPs) {
      if (allowed.includes('/') && isIPInCIDR(ip, allowed)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('IP allowlist check error:', error);
    return true;
  }
}
