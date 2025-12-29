/**
 * OTP Login Component - Core Logic
 * 
 * Framework-agnostic email OTP authentication component
 * Can be used with any framework or vanilla JavaScript
 * 
 * CRITICAL: All OTP requests (email and OTP code) are encrypted in transit
 * using service key encryption for maximum security.
 */

// Import OTP configuration
import { OTP_LENGTH, OTP_PATTERN, OTP_LENGTH_DESCRIPTION } from '../../shared-config/otp-config.js';

// Import encryption utilities
// Note: These will be dynamically imported to avoid bundling issues
type EncryptedData = {
  version: number;
  encrypted: boolean;
  algorithm: string;
  iv: string;
  salt: string;
  tokenHash: string;
  data: string;
  timestamp: string;
};

export interface OtpLoginConfig {
  /** OTP Auth API base URL */
  apiUrl: string;
  /** Callback when login succeeds */
  onSuccess: (data: LoginSuccessData) => void;
  /** Callback when login fails */
  onError?: (error: string) => void;
  /** Optional: Custom API endpoints */
  endpoints?: {
    requestOtp?: string;
    verifyOtp?: string;
  };
  /** Optional: Custom headers to include in requests */
  customHeaders?: Record<string, string>;
  /** Optional: OTP encryption key for encrypting request bodies (required for full encryption) */
  otpEncryptionKey?: string;
}

export interface LoginSuccessData {
  /** User ID (OIDC sub claim or userId) */
  userId?: string;
  /** User email */
  email: string;
  /** Display name (anonymized) */
  displayName?: string | null;
  /** Access token */
  token: string;
  /** Token expiration timestamp */
  expiresAt?: number;
  /** Full response data */
  data?: any;
}

export interface RateLimitDetails {
  reason?: string;
  emailLimit?: {
    current: number;
    max: number;
    resetAt: string;
  };
  ipLimit?: {
    current: number;
    max: number;
    resetAt: string;
  };
  quotaLimit?: {
    daily?: {
      current: number;
      max: number;
    };
    monthly?: {
      current: number;
      max: number;
    };
  };
  failedAttempts?: number;
}

export interface OtpLoginState {
  step: 'email' | 'otp';
  email: string;
  otp: string;
  loading: boolean;
  error: string | null;
  errorCode?: string; // Error code for mapping
  errorDetails?: RateLimitDetails; // Detailed rate limit info
  countdown: number;
  rateLimitResetAt: string | null; // ISO timestamp when rate limit resets
  rateLimitCountdown: number; // Seconds until rate limit resets
}

export class OtpLoginCore {
  private config: OtpLoginConfig;
  private state: OtpLoginState;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private rateLimitCountdownInterval: ReturnType<typeof setInterval> | null = null;
  private stateListeners: Array<(state: OtpLoginState) => void> = [];

  constructor(config: OtpLoginConfig) {
    this.config = config;
    this.state = {
      step: 'email',
      email: '',
      otp: '',
      loading: false,
      error: null,
      countdown: 0,
      rateLimitResetAt: null,
      rateLimitCountdown: 0,
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: OtpLoginState) => void): () => void {
    this.stateListeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  /**
   * Get current state
   */
  getState(): OtpLoginState {
    return { ...this.state };
  }

  /**
   * Update state and notify listeners
   */
  private setState(updates: Partial<OtpLoginState>): void {
    this.state = { ...this.state, ...updates };
    this.stateListeners.forEach(listener => listener(this.state));
  }

  /**
   * Set email
   */
  setEmail(email: string): void {
    this.setState({ email: email.trim().toLowerCase() });
  }

  /**
   * Set OTP
   */
  setOtp(otp: string): void {
    // Only allow digits, max OTP_LENGTH characters
    const cleanOtp = otp.replace(/\D/g, '').slice(0, OTP_LENGTH);
    this.setState({ otp: cleanOtp });
  }

  /**
   * Encrypt request body using OTP encryption key
   * Uses Web Crypto API (available in browsers and workers)
   * Matches server-side encryptWithServiceKey implementation exactly
   */
  private async encryptRequestBody(data: { email?: string; otp?: string }): Promise<string> {
    // If no encryption key provided, throw error (encryption is mandatory)
    // CRITICAL: Never send unencrypted data - always require encryption key
    if (!this.config.otpEncryptionKey) {
      console.error('[OtpLoginCore] ❌ CRITICAL: OTP encryption key is missing!');
      console.error('[OtpLoginCore] Config:', {
        hasKey: !!this.config.otpEncryptionKey,
        keyLength: this.config.otpEncryptionKey?.length || 0,
        apiUrl: this.config.apiUrl
      });
      throw new Error('OTP encryption key is required. Please configure otpEncryptionKey in OtpLoginConfig.');
    }

    const serviceKey = this.config.otpEncryptionKey;
    if (serviceKey.length < 32) {
      console.error('[OtpLoginCore] ❌ CRITICAL: OTP encryption key is too short!', {
        keyLength: serviceKey.length,
        requiredLength: 32
      });
      throw new Error('OTP encryption key must be at least 32 characters long.');
    }
    
    console.log('[OtpLoginCore] ✅ Encrypting request body with key length:', serviceKey.length);

    try {
      // Constants matching server-side implementation
      const PBKDF2_ITERATIONS = 100000;
      const SALT_LENGTH = 16;
      const IV_LENGTH = 12;
      const KEY_LENGTH = 256;

      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

      // Hash service key for verification (matches hashServiceKey)
      const encoder = new TextEncoder();
      const keyData = encoder.encode(serviceKey);
      const keyHashBuffer = await crypto.subtle.digest('SHA-256', keyData);
      const keyHashArray = Array.from(new Uint8Array(keyHashBuffer));
      const keyHash = keyHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Derive key from service key (matches deriveKeyFromServiceKey)
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(serviceKey),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );

      // Ensure salt is a proper BufferSource (matches server implementation)
      const saltBuffer = new ArrayBuffer(salt.byteLength);
      const saltView = new Uint8Array(saltBuffer);
      saltView.set(salt);
      const saltArray = saltView;

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltArray,
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
      );

      // Encrypt data
      const dataStr = JSON.stringify(data);
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        derivedKey,
        encoder.encode(dataStr)
      );

      // Convert to base64 (matches arrayBufferToBase64)
      const arrayBufferToBase64 = (buffer: ArrayBuffer | Uint8Array): string => {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };

      // Return encrypted blob (matches server-side format exactly)
      const encryptedData: EncryptedData = {
        version: 3,
        encrypted: true,
        algorithm: 'AES-GCM-256',
        iv: arrayBufferToBase64(iv.buffer),
        salt: arrayBufferToBase64(salt.buffer),
        tokenHash: keyHash, // Reuse tokenHash field for service key hash
        data: arrayBufferToBase64(encrypted),
        timestamp: new Date().toISOString(),
      };

      return JSON.stringify(encryptedData);
    } catch (error) {
      console.error('[OtpLoginCore] Encryption failed:', error);
      throw new Error('Failed to encrypt OTP request. Please check your encryption key configuration.');
    }
  }

  /**
   * Request OTP code
   * CRITICAL: Email is encrypted in transit using service key encryption
   */
  async requestOtp(): Promise<void> {
    const email = this.state.email.trim().toLowerCase();

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const errorMsg = 'Please enter a valid email address';
      this.setState({ error: errorMsg });
      this.config.onError?.(errorMsg);
      return;
    }

    try {
      this.setState({ loading: true, error: null });

      const endpoint = this.config.endpoints?.requestOtp || `${this.config.apiUrl}/auth/request-otp`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.customHeaders) {
        Object.assign(headers, this.config.customHeaders);
      }

      // CRITICAL: Encrypt request body (email) - NEVER send unencrypted
      let encryptedBody: string;
      try {
        encryptedBody = await this.encryptRequestBody({ email });
      } catch (encryptError) {
        console.error('[OtpLoginCore] ❌ ENCRYPTION FAILED - Aborting request to prevent unencrypted data transmission');
        console.error('[OtpLoginCore] Encryption error:', encryptError);
        this.setState({ 
          loading: false, 
          error: 'Encryption failed. Cannot send request without encryption. Please check your configuration.' 
        });
        this.config.onError?.('Encryption failed. Cannot send request without encryption.');
        return; // CRITICAL: Do NOT send request if encryption fails
      }
      
      // Verify encrypted body is actually encrypted (not plain JSON)
      try {
        const parsed = JSON.parse(encryptedBody);
        if (!parsed.encrypted || parsed.encrypted !== true) {
          console.error('[OtpLoginCore] ❌ CRITICAL: Encrypted body does not have encrypted flag! Aborting.');
          this.setState({ 
            loading: false, 
            error: 'Encryption validation failed. Request aborted for security.' 
          });
          this.config.onError?.('Encryption validation failed.');
          return;
        }
        console.log('[OtpLoginCore] ✅ Verified encrypted payload:', {
          version: parsed.version,
          algorithm: parsed.algorithm,
          hasData: !!parsed.data
        });
      } catch (parseError) {
        console.error('[OtpLoginCore] ❌ CRITICAL: Encrypted body is not valid JSON! Aborting.');
        this.setState({ 
          loading: false, 
          error: 'Encryption validation failed. Request aborted for security.' 
        });
        this.config.onError?.('Encryption validation failed.');
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: encryptedBody,
      });

      let data: any;
      try {
        const responseText = await response.text();
        if (responseText) {
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            // Response is not valid JSON - create error object from status
            data = {
              detail: `Server error (${response.status}): ${response.statusText || 'Invalid response format'}`,
              error: `Server error (${response.status}): ${response.statusText || 'Invalid response format'}`,
              errorCode: 'invalid_response',
              status: response.status
            };
          }
        } else {
          // Empty response
          data = {
            detail: `Server error (${response.status}): Empty response from server`,
            error: `Server error (${response.status}): Empty response from server`,
            errorCode: 'empty_response',
            status: response.status
          };
        }
      } catch (readError) {
        // Failed to read response
        data = {
          detail: `Network error: Unable to read server response`,
          error: `Network error: Unable to read server response`,
          errorCode: 'response_read_error',
          status: response.status
        };
      }

      if (!response.ok) {
        // Extract error message with priority: detail > error > title > status text
        const errorMsg = data.detail || data.error || data.title || 
          `Server error (${response.status}): ${response.statusText || 'Unknown error'}`;
        const errorCode = data.errorCode || data.reason || data.code || 'unknown_error';
        
        // Check if this is a rate limit error (429)
        if (response.status === 429 && (data.reset_at || data.reset_at_iso)) {
          // Use server's authoritative retry_after value if available, otherwise calculate from reset_at
          // The server's retry_after is the source of truth and accounts for server clock time
          const secondsUntilReset = data.retry_after !== undefined 
            ? Math.max(0, Math.ceil(data.retry_after))
            : (() => {
                const resetAt = new Date(data.reset_at);
                const now = new Date();
                return Math.max(0, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
              })();
          
          this.setState({ 
            error: errorMsg, 
            loading: false,
            errorCode: errorCode || 'rate_limit_exceeded',
            errorDetails: data.rate_limit_details,
            rateLimitResetAt: data.reset_at_iso || data.reset_at,
            rateLimitCountdown: secondsUntilReset,
          });
          
          // Start rate limit countdown
          this.startRateLimitCountdown();
        } else {
          this.setState({ 
            error: errorMsg, 
            loading: false,
            errorCode: errorCode,
            errorDetails: data.rate_limit_details,
            rateLimitResetAt: null,
            rateLimitCountdown: 0,
          });
          this.stopRateLimitCountdown();
        }
        
        this.config.onError?.(errorMsg);
        return;
      }

      // Success - switch to OTP step
      this.setState({
        step: 'otp',
        loading: false,
        error: null,
        countdown: 600, // 10 minutes
      });

      // Start countdown
      this.startCountdown();
    } catch (err) {
      // Handle different types of errors with detailed messages
      let errorMsg = 'Failed to request OTP';
      
      if (err instanceof TypeError) {
        // Network errors, CORS errors, etc.
        if (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch')) {
          errorMsg = 'Network error: Unable to connect to the server. Please check your internet connection and try again.';
        } else if (err.message.includes('CORS')) {
          errorMsg = 'CORS error: Cross-origin request blocked. Please contact support.';
        } else {
          errorMsg = `Network error: ${err.message}`;
        }
      } else if (err instanceof SyntaxError) {
        // JSON parsing errors
        errorMsg = 'Server response error: Invalid response format from server. Please try again.';
      } else if (err instanceof Error) {
        // Other Error instances
        if (err.name === 'AbortError') {
          errorMsg = 'Request timeout: The request took too long. Please try again.';
        } else {
          errorMsg = err.message || 'An unexpected error occurred. Please try again.';
        }
      } else if (typeof err === 'string') {
        errorMsg = err;
      } else {
        errorMsg = 'An unexpected error occurred. Please try again.';
      }
      
      this.setState({ 
        error: errorMsg, 
        loading: false,
        errorCode: 'network_error'
      });
      this.config.onError?.(errorMsg);
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(): Promise<void> {
    const otp = this.state.otp.trim();

    // Validate OTP using centralized config
    if (!otp || !OTP_PATTERN.test(otp)) {
      this.setState({ error: `Please enter a valid ${OTP_LENGTH_DESCRIPTION} OTP` });
      return;
    }

    try {
      this.setState({ loading: true, error: null });

      const endpoint = this.config.endpoints?.verifyOtp || `${this.config.apiUrl}/auth/verify-otp`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.customHeaders) {
        Object.assign(headers, this.config.customHeaders);
      }

      // CRITICAL: Encrypt request body (email and OTP) - NEVER send unencrypted
      let encryptedBody: string;
      try {
        encryptedBody = await this.encryptRequestBody({
          email: this.state.email,
          otp,
        });
      } catch (encryptError) {
        console.error('[OtpLoginCore] ❌ ENCRYPTION FAILED - Aborting request to prevent unencrypted data transmission');
        console.error('[OtpLoginCore] Encryption error:', encryptError);
        this.setState({ 
          loading: false, 
          error: 'Encryption failed. Cannot send request without encryption. Please check your configuration.' 
        });
        this.config.onError?.('Encryption failed. Cannot send request without encryption.');
        return; // CRITICAL: Do NOT send request if encryption fails
      }
      
      // Verify encrypted body is actually encrypted (not plain JSON)
      try {
        const parsed = JSON.parse(encryptedBody);
        if (!parsed.encrypted || parsed.encrypted !== true) {
          console.error('[OtpLoginCore] ❌ CRITICAL: Encrypted body does not have encrypted flag! Aborting.');
          this.setState({ 
            loading: false, 
            error: 'Encryption validation failed. Request aborted for security.' 
          });
          this.config.onError?.('Encryption validation failed.');
          return;
        }
        console.log('[OtpLoginCore] ✅ Verified encrypted payload:', {
          version: parsed.version,
          algorithm: parsed.algorithm,
          hasData: !!parsed.data
        });
      } catch (parseError) {
        console.error('[OtpLoginCore] ❌ CRITICAL: Encrypted body is not valid JSON! Aborting.');
        this.setState({ 
          loading: false, 
          error: 'Encryption validation failed. Request aborted for security.' 
        });
        this.config.onError?.('Encryption validation failed.');
        return;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: encryptedBody,
      });

      let data: any;
      try {
        const responseText = await response.text();
        if (responseText) {
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            // Response is not valid JSON
            data = {
              detail: `Server error (${response.status}): ${response.statusText || 'Invalid response format'}`,
              error: `Server error (${response.status}): ${response.statusText || 'Invalid response format'}`,
              errorCode: 'invalid_response',
              status: response.status
            };
          }
        } else {
          // Empty response
          data = {
            detail: `Server error (${response.status}): Empty response from server`,
            error: `Server error (${response.status}): Empty response from server`,
            errorCode: 'empty_response',
            status: response.status
          };
        }
      } catch (readError) {
        // Failed to read response
        data = {
          detail: 'Network error: Unable to read server response',
          error: 'Network error: Unable to read server response',
          errorCode: 'response_read_error',
          status: response.status
        };
      }

      if (!response.ok) {
        // Extract error message with priority: detail > error > title > status text
        const errorMsg = data.detail || data.error || data.title || 
          `Server error (${response.status}): ${response.statusText || 'Unknown error'}`;
        const errorCode = data.errorCode || 'unknown_error';
        
        this.setState({ 
          error: errorMsg, 
          loading: false,
          errorCode: errorCode
        });
        this.config.onError?.(errorMsg);
        return;
      }

      // Success - call onSuccess callback
      const successData: LoginSuccessData = {
        userId: data.userId || data.sub,
        email: data.email || this.state.email,
        displayName: data.displayName || null, // Include display name
        token: data.access_token || data.token,
        expiresAt: data.expiresAt,
        data,
      };

      this.stopCountdown();
      this.setState({ loading: false });
      this.config.onSuccess(successData);
    } catch (err) {
      // Handle different types of errors with detailed messages
      let errorMsg = 'Failed to verify OTP';
      
      if (err instanceof TypeError) {
        // Network errors, CORS errors, etc.
        if (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch')) {
          errorMsg = 'Network error: Unable to connect to the server. Please check your internet connection and try again.';
        } else if (err.message.includes('CORS')) {
          errorMsg = 'CORS error: Cross-origin request blocked. Please contact support.';
        } else {
          errorMsg = `Network error: ${err.message}`;
        }
      } else if (err instanceof SyntaxError) {
        // JSON parsing errors
        errorMsg = 'Server response error: Invalid response format from server. Please try again.';
      } else if (err instanceof Error) {
        // Other Error instances
        if (err.name === 'AbortError') {
          errorMsg = 'Request timeout: The request took too long. Please try again.';
        } else {
          errorMsg = err.message || 'An unexpected error occurred. Please try again.';
        }
      } else if (typeof err === 'string') {
        errorMsg = err;
      } else {
        errorMsg = 'An unexpected error occurred. Please try again.';
      }
      
      this.setState({ 
        error: errorMsg, 
        loading: false,
        errorCode: 'network_error'
      });
      this.config.onError?.(errorMsg);
    }
  }

  /**
   * Go back to email step
   */
  goBack(): void {
    this.stopCountdown();
    this.setState({
      step: 'email',
      otp: '',
      error: null,
      countdown: 0,
      rateLimitResetAt: null,
      rateLimitCountdown: 0,
    });
    this.stopRateLimitCountdown();
  }

  /**
   * Reset component state
   */
  reset(): void {
    this.stopCountdown();
    this.stopRateLimitCountdown();
    this.setState({
      step: 'email',
      email: '',
      otp: '',
      loading: false,
      error: null,
      countdown: 0,
      rateLimitResetAt: null,
      rateLimitCountdown: 0,
    });
  }

  /**
   * Start countdown timer
   */
  private startCountdown(): void {
    this.stopCountdown();
    this.countdownInterval = setInterval(() => {
      if (this.state.countdown > 0) {
        this.setState({ countdown: this.state.countdown - 1 });
      } else {
        this.stopCountdown();
      }
    }, 1000);
  }

  /**
   * Stop countdown timer
   */
  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  /**
   * Start rate limit countdown timer
   * Counts down from the server's authoritative retry_after value
   * to avoid clock skew issues between server and client
   */
  private startRateLimitCountdown(): void {
    this.stopRateLimitCountdown();
    
    if (!this.state.rateLimitResetAt || this.state.rateLimitCountdown <= 0) {
      return;
    }
    
    this.rateLimitCountdownInterval = setInterval(() => {
      const currentCountdown = this.state.rateLimitCountdown;
      
      if (currentCountdown > 1) {
        // Decrement the countdown - don't recalculate from timestamp
        // This preserves the server's authoritative time calculation
        this.setState({ rateLimitCountdown: currentCountdown - 1 });
      } else {
        // Rate limit expired - clear error and countdown
        this.setState({ 
          error: null,
          rateLimitResetAt: null,
          rateLimitCountdown: 0,
        });
        this.stopRateLimitCountdown();
      }
    }, 1000);
  }

  /**
   * Stop rate limit countdown timer
   */
  private stopRateLimitCountdown(): void {
    if (this.rateLimitCountdownInterval) {
      clearInterval(this.rateLimitCountdownInterval);
      this.rateLimitCountdownInterval = null;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopCountdown();
    this.stopRateLimitCountdown();
    this.stateListeners = [];
  }

  /**
   * Format countdown seconds to MM:SS
   */
  static formatCountdown(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format rate limit countdown to human-readable string
   */
  static formatRateLimitCountdown(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (secs > 0) {
        return `${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`;
      }
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      const parts: string[] = [];
      if (hours > 0) {
        parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
      }
      if (mins > 0) {
        parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);
      }
      if (secs > 0 && hours === 0) {
        parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
      }
      return parts.join(' and ');
    }
  }
}

