/**
 * Login page
 * Uses shared OTP login component with full encryption support
 */

import { useEffect, useCallback } from 'react';
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
    const checkAuth = useAuthStore((s) => s.checkAuth);

    // Check authentication status on mount (HttpOnly cookie SSO)
    useEffect(() => {
        checkAuth().catch(() => {});
    }, [checkAuth]);

    const handleLoginError = useCallback((error: string) => {
        console.error('[Login] ✗ Login failed:', error);
    }, []);

    const handleLoginSuccess = useCallback(async (_data: LoginSuccessData) => {
        // CRITICAL: After OTP login, the backend sets an HttpOnly cookie
        // We immediately call checkAuth() to validate the cookie and fetch customer info
        console.log('[Login] ✓ OTP verification successful, validating HttpOnly cookie session...');
        
        try {
            const authSuccess = await checkAuth();
            if (authSuccess) {
                console.log('[Login] ✓ HttpOnly cookie session validated');
                navigate('/');
            } else {
                console.error('[Login] ✗ HttpOnly cookie session validation failed');
                handleLoginError('Session validation failed. Please try again.');
            }
        } catch (error) {
            console.error('[Login] ✗ Error validating session:', error);
            handleLoginError('Session validation error. Please try again.');
        }
    }, [checkAuth, navigate, handleLoginError]);

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

