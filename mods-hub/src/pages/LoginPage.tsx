/**
 * Login page
 * Uses shared OTP login component with full encryption support
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { OtpLogin } from '@strixun/otp-login/dist/react';
import type { LoginSuccessData } from '@strixun/otp-login/dist/react';
// Import CSS explicitly to ensure styles are included in build
import '@strixun/otp-login/dist/react/otp-login.css';

// Service key encryption removed - it was obfuscation only (key is in bundle)

// Use proxy in development (via Vite), direct URL in production
// E2E tests can override with VITE_AUTH_API_URL to use direct local worker URLs
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL 
  ? import.meta.env.VITE_AUTH_API_URL  // Explicit URL override (for E2E tests)
  : (import.meta.env.DEV 
    ? '/auth-api'  // Vite proxy in development
    : 'https://auth.idling.app');  // Production default

export function LoginPage() {
    const navigate = useNavigate();
    const { setCustomer, restoreSession } = useAuthStore();

    // Restore session from backend on mount (same as main app)
    // This enables cross-application session sharing for the same device
    // If customer already has a session, they'll be redirected automatically
    useEffect(() => {
        // Always try to restore - it will check if restoration is needed
        restoreSession().catch(error => {
            console.debug('[LoginPage] Session restoration failed (non-critical):', error);
        });
    }, [restoreSession]); // Only run once on mount

    const handleLoginSuccess = async (data: LoginSuccessData) => {
        // Decode JWT to extract isSuperAdmin from payload (matching main app)
        let isSuperAdmin = false;
        try {
            const token = data.token;
            if (token) {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payloadB64 = parts[1];
                    const payload = JSON.parse(
                        atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
                    );
                    isSuperAdmin = payload?.isSuperAdmin === true;
                }
            }
        } catch (error) {
            console.warn('[Login] Failed to decode JWT for super admin status:', error);
        }

        // Calculate expiration (matching main app)
        let expiresAt: string;
        if (data.expiresAt) {
            // expiresAt can be a number (timestamp) or string (ISO)
            expiresAt = typeof data.expiresAt === 'number' 
                ? new Date(data.expiresAt).toISOString()
                : data.expiresAt;
        } else {
            // Default to 7 hours (matching backend token expiration)
            expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString();
        }

        // Store customer data - ensure all required fields are present (matching main app)
        // CRITICAL: OTP Auth returns customerId, not userId
        const customerId = data.customerId || data.customerId; // Support both field names for backwards compatibility
        if (!customerId || !data.email || !data.token) {
            console.error('[Login] Missing required customer data:', data);
            handleLoginError('Invalid login response: missing required fields');
            return;
        }

        // Set authentication - CRITICAL: Trim token to ensure it matches the token used for encryption on backend
        const customerData = {
            customerId: customerId,
            email: data.email,
            displayName: data.displayName || undefined,
            token: data.token.trim(), // Trim token to prevent hash mismatches
            expiresAt: expiresAt,
            isSuperAdmin: isSuperAdmin,
        };

        setCustomer(customerData);

        console.log('[Login] ✓ Customer authenticated:', customerData.email, 'Token expires at:', expiresAt);

        // Don't call fetchCustomerInfo immediately after login - let the Layout component handle it
        // This avoids token mismatch issues that can occur when calling it too quickly after login
        // The Layout component's restoreSession will fetch customer info when it mounts, which gives
        // the store time to fully update and ensures the token is properly set

        navigate('/');
    };

    const handleLoginError = (error: string) => {
        console.error('[Login] ✗ Login failed:', error);
    };

    return (
        <OtpLogin
            apiUrl={AUTH_API_URL}
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            // Service key encryption removed - HTTPS provides transport security
            title="Login"
            subtitle="Enter your email to receive a verification code"
        />
    );
}

