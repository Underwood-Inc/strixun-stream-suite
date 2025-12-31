/**
 * Dev OTP Auto-Fetch
 * 
 * Automatically fetches and populates OTP codes from dev endpoint in local development
 * SECURITY: Only works when dev endpoint is available (test mode)
 */

import type { OtpLoginState } from './types.js';

export interface DevOtpFetchConfig {
  apiUrl: string;
  state: OtpLoginState;
  setState: (updates: Partial<OtpLoginState>) => void;
}

/**
 * Auto-fetch OTP code from dev endpoint (local development only)
 * This automatically retrieves and populates the OTP code in dev mode
 */
export async function autoFetchDevOtp(email: string, config: DevOtpFetchConfig): Promise<void> {
  try {
    // Only attempt in local development (localhost)
    const apiUrl = config.apiUrl || '';
    const isLocalDev = apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1') || apiUrl.includes(':8787');
    
    if (!isLocalDev) {
      // Not local dev - skip auto-fetch
      return;
    }

    // Construct dev endpoint URL
    // Handle both direct worker URLs (localhost:8787) and proxied URLs (/auth-api)
    const devEndpoint = `${apiUrl.replace(/\/$/, '')}/dev/otp?email=${encodeURIComponent(email)}`;
    
    // Wait a short moment for OTP to be stored in KV
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Fetch OTP from dev endpoint
    const response = await fetch(devEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Dev endpoint not available or OTP not found - this is fine, just skip
      if (response.status === 403) {
        // Dev endpoint disabled (production mode) - expected, skip silently
        return;
      }
      // Other errors - log but don't fail
      console.log('[OtpLoginCore] Dev OTP fetch failed (this is OK):', response.status);
      return;
    }

    const data = await response.json() as { otp?: string };
    
    if (data.otp && typeof data.otp === 'string') {
      // Auto-populate OTP code
      config.setState({ otp: data.otp });
      console.log('[OtpLoginCore] [DEV] Auto-populated OTP code from dev endpoint');
    }
  } catch (error) {
    // Silently fail - dev endpoint might not be available
    // This is expected in production or when dev endpoint is disabled
    console.log('[OtpLoginCore] Dev OTP auto-fetch failed (this is OK):', error);
  }
}

