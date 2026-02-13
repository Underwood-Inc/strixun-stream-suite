/**
 * OTP Verification Handler
 * 
 * Handles verifying OTP codes with the server
 * SECURITY: HTTPS provides transport security. Service key encryption removed (was obfuscation only).
 */

import { OTP_PATTERN, OTP_LENGTH_DESCRIPTION } from '../shared-config/otp-config.js';
import type { OtpLoginConfig, OtpLoginState, LoginSuccessData } from './types.js';
import { parseErrorResponse, handleNetworkError } from './utils.js';
import { stopCountdown } from './countdown.js';
import type { CountdownManager } from './countdown.js';

export interface OtpVerifyContext {
  config: OtpLoginConfig;
  state: OtpLoginState;
  setState: (updates: Partial<OtpLoginState>) => void;
  countdownManager: CountdownManager;
}

/**
 * Verify OTP code
 */
export async function verifyOtp(context: OtpVerifyContext): Promise<void> {
  const { config, state, setState, countdownManager } = context;
  const otp = state.otp.trim();

  // Validate OTP using centralized config
  if (!otp || !OTP_PATTERN.test(otp)) {
    setState({ error: `Please enter a valid ${OTP_LENGTH_DESCRIPTION} OTP` });
    return;
  }

  try {
    setState({ loading: true, error: null });

    const endpoint = config.endpoints?.verifyOtp || `${config.apiUrl}/auth/verify-otp`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    // Send plain JSON - HTTPS provides transport security
    const requestBody = JSON.stringify({ email: state.email, otp });

    // CRITICAL: credentials: 'include' is required for HttpOnly cookie SSO
    // This allows cookies to be sent/received across origins (CORS with credentials)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
      credentials: 'include', // CRITICAL: Send/receive cookies for SSO
    });

    const responseText = await response.text().catch(() => null);
    const data = parseErrorResponse(responseText, response.status, response.statusText);

    if (!response.ok) {
      // Extract error message with priority: detail > error > title > status text
      const errorMsg = data.detail || data.error || data.title || 
        `Server error (${response.status}): ${response.statusText || 'Unknown error'}`;
      const errorCode = data.errorCode || 'unknown_error';
      
      setState({ 
        error: errorMsg, 
        loading: false,
        errorCode: errorCode
      });
      config.onError?.(errorMsg);
      return;
    }

    // Success - call onSuccess callback
    const successData: LoginSuccessData = {
      customerId: data.customerId || data.sub, // OTP Auth Service returns customerId
      email: data.email || state.email,
      displayName: data.displayName || null, // Include display name
      token: data.access_token || data.token,
      expiresAt: data.expiresAt,
      data,
    };

    stopCountdown(countdownManager);
    setState({ loading: false });
    config.onSuccess(successData);
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

