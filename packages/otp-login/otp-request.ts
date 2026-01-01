/**
 * OTP Request Handler
 * 
 * Handles requesting OTP codes from the server
 * SECURITY: HTTPS provides transport security. Service key encryption removed (was obfuscation only).
 */

import type { OtpLoginConfig, OtpLoginState } from './types.js';
import { parseErrorResponse, handleNetworkError } from './utils.js';
import { autoFetchDevOtp } from './dev-otp-fetch.js';
import type { CountdownManager } from './countdown.js';
import { startCountdown, startRateLimitCountdown, stopRateLimitCountdown } from './countdown.js';

export interface OtpRequestContext {
  config: OtpLoginConfig;
  state: OtpLoginState;
  setState: (updates: Partial<OtpLoginState>) => void;
  countdownManager: CountdownManager;
}

/**
 * Request OTP code
 */
export async function requestOtp(context: OtpRequestContext): Promise<void> {
  const { config, state, setState, countdownManager } = context;
  const email = state.email.trim().toLowerCase();

  // Validate email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const errorMsg = 'Please enter a valid email address';
    setState({ error: errorMsg });
    config.onError?.(errorMsg);
    return;
  }

  try {
    setState({ loading: true, error: null });

    const endpoint = config.endpoints?.requestOtp || `${config.apiUrl}/auth/request-otp`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    // CRITICAL: Encrypt request body (email) - NEVER send unencrypted
    let encryptedBody: string;
    try {
      if (!config.otpEncryptionKey) {
        throw new Error('OTP encryption key is required');
      }
      encryptedBody = await encryptRequestBody({ email }, config.otpEncryptionKey);
    } catch (encryptError) {
      console.error('[OtpLoginCore] ✗ ENCRYPTION FAILED - Aborting request to prevent unencrypted data transmission');
      console.error('[OtpLoginCore] Encryption error:', encryptError);
      setState({ 
        loading: false, 
        error: 'Encryption failed. Cannot send request without encryption. Please check your configuration.' 
      });
      config.onError?.('Encryption failed. Cannot send request without encryption.');
      return; // CRITICAL: Do NOT send request if encryption fails
    }
    
    // Verify encrypted body is actually encrypted (not plain JSON)
    try {
      validateEncryptedBody(encryptedBody);
    } catch (validationError) {
      setState({ 
        loading: false, 
        error: validationError instanceof Error ? validationError.message : 'Encryption validation failed. Request aborted for security.' 
      });
      config.onError?.('Encryption validation failed.');
      return;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: encryptedBody,
    });

    const responseText = await response.text().catch(() => null);
    const data = parseErrorResponse(responseText, response.status, response.statusText);

    if (!response.ok) {
      // Extract error message with priority: detail > error > title > status text
      const errorMsg = data.detail || data.error || data.title || 
        `Server error (${response.status}): ${response.statusText || 'Unknown error'}`;
      const errorCode = data.errorCode || data.reason || data.code || 'unknown_error';
      
      // Check if this is a rate limit error (429)
      if (response.status === 429 && (data.reset_at || data.reset_at_iso)) {
        // Use server's authoritative retry_after value if available, otherwise calculate from reset_at
        const secondsUntilReset = data.retry_after !== undefined 
          ? Math.max(0, Math.ceil(data.retry_after))
          : (() => {
              const resetAt = new Date(data.reset_at);
              const now = new Date();
              return Math.max(0, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
            })();
        
        setState({ 
          error: errorMsg, 
          loading: false,
          errorCode: errorCode || 'rate_limit_exceeded',
          errorDetails: data.rate_limit_details,
          rateLimitResetAt: data.reset_at_iso || data.reset_at,
          rateLimitCountdown: secondsUntilReset,
        });
        
        // Start rate limit countdown
        startRateLimitCountdown(countdownManager);
      } else {
        setState({ 
          error: errorMsg, 
          loading: false,
          errorCode: errorCode,
          errorDetails: data.rate_limit_details,
          rateLimitResetAt: null,
          rateLimitCountdown: 0,
        });
        stopRateLimitCountdown(countdownManager);
      }
      
      config.onError?.(errorMsg);
      return;
    }

    // Success - switch to OTP step
    setState({
      step: 'otp',
      loading: false,
      error: null,
      countdown: 600, // 10 minutes
    });

    // Start countdown
    startCountdown(countdownManager);

    // DEV MODE: Automatically fetch and populate OTP code from dev endpoint
    // Only works in local development when dev endpoint is available
    await autoFetchDevOtp(email, {
      apiUrl: config.apiUrl,
      state: context.state,
      setState: context.setState,
    });
  } catch (err) {
    const errorMsg = handleNetworkError(err);
    setState({ 
      error: errorMsg, 
      loading: false,
      errorCode: 'network_error'
    });
    config.onError?.(errorMsg);
  }
}

