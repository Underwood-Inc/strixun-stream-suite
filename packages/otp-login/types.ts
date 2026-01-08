/**
 * OTP Login Types
 * 
 * Type definitions for the OTP login component
 */

// Import encryption utilities
// Note: These will be dynamically imported to avoid bundling issues
export type EncryptedData = {
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
  // otpEncryptionKey removed - service key encryption was obfuscation only
}

export interface LoginSuccessData {
  /** Customer ID (primary identifier) - OTP Auth Service uses customerId */
  customerId?: string;
  /** User ID (OIDC sub claim or userId) - Deprecated, use customerId */
  userId?: string;
  /** Customer/User email */
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

