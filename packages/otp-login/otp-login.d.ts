/**
 * TypeScript Definitions for OTP Login Library - CDN Usage
 * 
 * This file provides type definitions for using the OTP Login library
 * via CDN (as a global script).
 * 
 * Usage:
 *   /// <reference types="./otp-login.d.ts" />
 *   or
 *   import type { ... } from './otp-login.d.ts';
 */

/**
 * OTP Login Core Library (window.OtpLoginCore)
 * 
 * Available when otp-core.js is loaded via CDN
 */
declare namespace OtpLoginCoreLib {
  /**
   * OTP Login Core Class
   * Framework-agnostic email OTP authentication logic
   */
  export class OtpLoginCore {
    /**
     * Create a new OtpLoginCore instance
     */
    constructor(config: OtpLoginCoreConfig);

    /**
     * Set email address
     */
    setEmail(email: string): void;

    /**
     * Set OTP code (auto-filters to 9 digits)
     */
    setOtp(otp: string): void;

    /**
     * Request OTP code
     */
    requestOtp(): Promise<void>;

    /**
     * Verify OTP code
     */
    verifyOtp(): Promise<void>;

    /**
     * Go back to email step
     */
    goBack(): void;

    /**
     * Reset component state
     */
    reset(): void;

    /**
     * Get current state
     */
    getState(): OtpLoginState;

    /**
     * Subscribe to state changes
     * @returns Unsubscribe function
     */
    subscribe(listener: (state: OtpLoginState) => void): () => void;

    /**
     * Cleanup
     */
    destroy(): void;

    /**
     * Format countdown seconds to MM:SS
     */
    static formatCountdown(seconds: number): string;

    /**
     * Format rate limit countdown to human-readable string
     */
    static formatRateLimitCountdown(seconds: number): string;
  }

  /**
   * OTP Login Configuration
   */
  export interface OtpLoginCoreConfig {
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
    // otpEncryptionKey removed - service key encryption was obfuscation only, HTTPS provides transport security
  }

  /**
   * OTP Login State
   */
  export interface OtpLoginState {
    step: 'email' | 'otp';
    email: string;
    otp: string;
    loading: boolean;
    error: string | null;
    errorCode?: string;
    errorDetails?: RateLimitDetails;
    countdown: number;
    rateLimitResetAt: string | null;
    rateLimitCountdown: number;
  }

  /**
   * Login Success Data
   */
  export interface LoginSuccessData {
    customerId: string;
    email: string;
    displayName?: string | null;
    token: string;
    expiresAt?: number;
    data?: any;
  }

  /**
   * Rate Limit Details
   */
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
}

/**
 * OTP Login Svelte Library (window.OtpLoginSvelte)
 * 
 * Available when otp-login-svelte.js is loaded via CDN
 */
declare namespace OtpLoginSvelteLib {
  /**
   * Mount OTP Login component to a DOM element
   * 
   * @param options Mount options
   * @returns Svelte component instance (can call .$destroy() to unmount)
   */
  export function mountOtpLogin(options: OtpLoginMountOptions): any;

  /**
   * OTP Login Mount Options
   */
  export interface OtpLoginMountOptions {
    /** DOM element to mount the component to */
    target: HTMLElement;
    /** OTP Auth API base URL */
    apiUrl: string;
    /** Callback when login succeeds */
    onSuccess: (data: OtpLoginCoreLib.LoginSuccessData) => void;
    /** Callback when login fails */
    onError?: (error: string) => void;
    /** Optional: Custom API endpoints */
    endpoints?: {
      requestOtp?: string;
      verifyOtp?: string;
    };
    /** Optional: Custom headers to include in requests */
    customHeaders?: Record<string, string>;
    /** Login form title (default: "Sign In") */
    title?: string;
    /** Login form subtitle (default: "Enter your email to receive a verification code") */
    subtitle?: string;
    /** Show as modal overlay (default: false) */
    showAsModal?: boolean;
    /** Callback when modal is closed (only used when showAsModal: true) */
    onClose?: () => void;
  }

  /**
   * Re-export types from core library
   */
  export type LoginSuccessData = OtpLoginCoreLib.LoginSuccessData;
  export type OtpLoginState = OtpLoginCoreLib.OtpLoginState;
  export type OtpLoginConfig = OtpLoginCoreLib.OtpLoginCoreConfig;
}

/**
 * Global window extensions for CDN usage
 */
interface Window {
  /**
   * OTP Login Core (from otp-core.js)
   */
  OtpLoginCore: typeof OtpLoginCoreLib.OtpLoginCore;

  /**
   * OTP Login Svelte (from otp-login-svelte.js)
   */
  OtpLoginSvelte: typeof OtpLoginSvelteLib & {
    mountOtpLogin: typeof OtpLoginSvelteLib.mountOtpLogin;
  };
}

/**
 * Export types for module usage
 */
export type OtpLoginCore = OtpLoginCoreLib.OtpLoginCore;
export type OtpLoginCoreConfig = OtpLoginCoreLib.OtpLoginCoreConfig;
export type OtpLoginState = OtpLoginCoreLib.OtpLoginState;
export type LoginSuccessData = OtpLoginCoreLib.LoginSuccessData;
export type RateLimitDetails = OtpLoginCoreLib.RateLimitDetails;
export type OtpLoginMountOptions = OtpLoginSvelteLib.OtpLoginMountOptions;

