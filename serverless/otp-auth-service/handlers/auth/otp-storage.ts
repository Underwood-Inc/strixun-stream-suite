/**
 * OTP Storage Utilities
 * 
 * Handles OTP storage and retrieval from KV with customer isolation
 */

import { hashEmail } from '../../utils/crypto.js';
import { getCustomerKey } from '../../services/customer.js';

interface OTPData {
    email: string;
    otp: string;
    expiresAt: string;
    attempts: number;
}

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

/**
 * Store OTP in KV with customer isolation
 */
export async function storeOTP(
    email: string,
    otp: string,
    customerId: string | null,
    env: Env
): Promise<{ otpKey: string; latestOtpKey: string }> {
    const emailHash = await hashEmail(email);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Store OTP in KV with customer isolation
    const otpKey = getCustomerKey(customerId, `otp_${emailHash}_${Date.now()}`);
    await env.OTP_AUTH_KV.put(otpKey, JSON.stringify({
        email: email.toLowerCase().trim(),
        otp,
        expiresAt: expiresAt.toISOString(),
        attempts: 0,
    }), { expirationTtl: 600 }); // 10 minutes TTL
    
    // Also store latest OTP for quick lookup (overwrites previous)
    const latestOtpKey = getCustomerKey(customerId, `otp_latest_${emailHash}`);
    await env.OTP_AUTH_KV.put(latestOtpKey, otpKey, { expirationTtl: 600 });
    
    return { otpKey, latestOtpKey };
}

/**
 * Retrieve OTP data from KV
 * Handles backward compatibility for OTPs stored without customer prefix
 */
export async function retrieveOTP(
    email: string,
    customerId: string | null,
    env: Env
): Promise<{ otpData: OTPData; otpKey: string; latestOtpKey: string } | null> {
    const emailHash = await hashEmail(email);
    
    // Try to get latest OTP key - try with customer prefix first, then without (for backward compatibility)
    let latestOtpKey = getCustomerKey(customerId, `otp_latest_${emailHash}`);
    let latestOtpKeyValue = await env.OTP_AUTH_KV.get(latestOtpKey);
    
    // If not found with customer prefix and customerId is null, try without prefix
    // This handles cases where OTP was requested before customer isolation was implemented
    if (!latestOtpKeyValue && !customerId) {
        const fallbackKey = `otp_latest_${emailHash}`;
        latestOtpKeyValue = await env.OTP_AUTH_KV.get(fallbackKey);
        if (latestOtpKeyValue) {
            latestOtpKey = fallbackKey; // Use the fallback key for subsequent operations
        }
    }
    
    if (!latestOtpKeyValue) {
        return null;
    }
    
    // Get OTP data - latestOtpKeyValue is the actual OTP key
    const otpKey = latestOtpKeyValue;
    const otpDataStr = await env.OTP_AUTH_KV.get(otpKey);
    if (!otpDataStr) {
        return null;
    }
    
    try {
        const otpData = JSON.parse(otpDataStr) as OTPData;
        return { otpData, otpKey, latestOtpKey };
    } catch (e) {
        return null;
    }
}

/**
 * Delete OTP from KV
 */
export async function deleteOTP(otpKey: string, latestOtpKey: string, env: Env): Promise<void> {
    await env.OTP_AUTH_KV.delete(otpKey);
    await env.OTP_AUTH_KV.delete(latestOtpKey);
}

/**
 * Increment OTP attempt count
 */
export async function incrementOTPAttempts(
    otpKey: string,
    otpData: OTPData,
    env: Env
): Promise<void> {
    otpData.attempts++;
    await env.OTP_AUTH_KV.put(otpKey, JSON.stringify(otpData), { expirationTtl: 600 });
}

