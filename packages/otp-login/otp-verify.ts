/**
 * OTP Verification Handler
 * 
 * Handles verifying OTP codes with the server
 * CRITICAL: Email and OTP are encrypted in transit using service key encryption
 */

import { OTP_PATTERN, OTP_LENGTH_DESCRIPTION } from '../../shared-config/otp-config.js';
import type { OtpLoginConfig, OtpLoginState, LoginSuccessData } from './types.js';
import { encryptRequestBody, validateEncryptedBody } from './encryption.js';
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

    // CRITICAL: Encrypt request body (email and OTP) - NEVER send unencrypted
    let encryptedBody: string;
    try {
      if (!config.otpEncryptionKey) {
        throw new Error('OTP encryption key is required');
      }
      encryptedBody = await encryptRequestBody({
        email: state.email,
        otp,
      }, config.otpEncryptionKey);
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
      userId: data.userId || data.sub,
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

