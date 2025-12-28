/**
 * Login page
 * Uses shared OTP login component with full encryption support
 */

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { OtpLogin } from '../../../shared-components/otp-login/dist/react';
import type { LoginSuccessData } from '../../../shared-components/otp-login/dist/react';

import { getOtpEncryptionKey } from '../../../shared-config/otp-encryption';

// Use proxy in development (via Vite), direct URL in production
const AUTH_API_URL = import.meta.env.DEV 
  ? '/auth-api'  // Vite proxy in development
  : (import.meta.env.VITE_AUTH_API_URL || 'https://auth.idling.app');

export function LoginPage() {
    const navigate = useNavigate();
    const { setUser } = useAuthStore();

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

        // Store user data - ensure all required fields are present (matching main app)
        if (!data.userId || !data.email || !data.token) {
            console.error('[Login] Missing required user data:', data);
            handleLoginError('Invalid login response: missing required fields');
            return;
        }

        // Set authentication - support both old format and OAuth 2.0 format (matching main app)
        const userData = {
            userId: data.userId || '',
            email: data.email,
            displayName: data.displayName || undefined,
            token: data.token,
            expiresAt: expiresAt,
            isSuperAdmin: isSuperAdmin,
        };

        setUser(userData);

        // Fetch admin status after login (will update isSuperAdmin if different from JWT)
        const { useAuthStore } = await import('../stores/auth');
        const store = useAuthStore.getState();
        await store.fetchUserInfo();

        console.log('[Login] [SUCCESS] User authenticated:', userData.email, 'Token expires at:', expiresAt);

        navigate('/');
    };

    const handleLoginError = (error: string) => {
        console.error('[Login] [ERROR] Login failed:', error);
    };

    return (
        <OtpLogin
            apiUrl={AUTH_API_URL}
            onSuccess={handleLoginSuccess}
            onError={handleLoginError}
            otpEncryptionKey={getOtpEncryptionKey()}
            title="Login"
            subtitle="Enter your email to receive a verification code"
        />
    );
}

