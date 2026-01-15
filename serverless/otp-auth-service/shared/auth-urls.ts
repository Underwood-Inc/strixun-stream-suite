/**
 * Shared Authentication URL Utilities
 * 
 * Provides unified URL resolution for auth and customer APIs across all apps.
 * Handles development (Vite proxy) vs production (direct URLs) automatically.
 * 
 * USAGE:
 *   import { getAuthApiUrl, getCustomerApiUrl } from '@strixun/otp-auth-service/shared/auth-urls';
 */

/**
 * Configuration for URL resolution
 */
export interface AuthUrlConfig {
    /** Override auth API URL (highest priority) */
    authApiUrl?: string;
    /** Override customer API URL (highest priority) */
    customerApiUrl?: string;
}

/**
 * Check if running in development/localhost
 */
export function isDevelopment(): boolean {
    if (typeof window === 'undefined') return false;
    
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           (typeof import.meta !== 'undefined' && (import.meta.env?.DEV || import.meta.env?.MODE === 'development'));
}

/**
 * Get OTP Auth API URL with proper fallback chain
 * 
 * Priority:
 * 1. Config override (authApiUrl)
 * 2. Window.VITE_AUTH_API_URL (for E2E tests)
 * 3. import.meta.env.VITE_AUTH_API_URL (for builds)
 * 4. window.getOtpAuthApiUrl() (from config.js)
 * 5. If localhost: '/auth-api' (Vite proxy) or 'http://localhost:8787'
 * 6. Production default: 'https://auth.idling.app'
 */
export function getAuthApiUrl(config?: AuthUrlConfig): string {
    // Priority 1: Config override
    if (config?.authApiUrl) {
        return config.authApiUrl;
    }
    
    // Priority 2: Window env (for E2E tests)
    if (typeof window !== 'undefined' && (window as any).VITE_AUTH_API_URL) {
        return (window as any).VITE_AUTH_API_URL;
    }
    
    // Priority 3: Vite env (for builds)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
        return import.meta.env.VITE_AUTH_API_URL;
    }
    
    // Priority 4: Window config (injected during build)
    if (typeof window !== 'undefined' && (window as any).getOtpAuthApiUrl) {
        const url = (window as any).getOtpAuthApiUrl();
        if (url) return url;
    }
    
    // Priority 5: Development detection
    if (isDevelopment()) {
        // Prefer Vite proxy for SSO (shares cookies across ports)
        return '/auth-api';
    }
    
    // Priority 6: Production default
    return 'https://auth.idling.app';
}

/**
 * Get Customer API URL with proper fallback chain
 * 
 * Priority:
 * 1. Config override (customerApiUrl)
 * 2. import.meta.env.VITE_CUSTOMER_API_URL (for builds)
 * 3. window.VITE_CUSTOMER_API_URL (for E2E tests)
 * 4. If localhost: '/customer-api' (Vite proxy)
 * 5. Production default: 'https://customer-api.idling.app'
 */
export function getCustomerApiUrl(config?: AuthUrlConfig): string {
    // Priority 1: Config override
    if (config?.customerApiUrl) {
        return config.customerApiUrl;
    }
    
    // Priority 2: Vite env (for builds)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CUSTOMER_API_URL) {
        return import.meta.env.VITE_CUSTOMER_API_URL;
    }
    
    // Priority 3: Window env (for E2E tests)
    if (typeof window !== 'undefined' && (window as any).VITE_CUSTOMER_API_URL) {
        return (window as any).VITE_CUSTOMER_API_URL;
    }
    
    // Priority 4: Development detection
    if (isDevelopment()) {
        // Use Vite proxy for SSO (shares cookies across ports)
        return '/customer-api';
    }
    
    // Priority 5: Production default
    return 'https://customer-api.idling.app';
}
