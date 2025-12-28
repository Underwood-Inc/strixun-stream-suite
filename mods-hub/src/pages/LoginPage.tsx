/**
 * Login page
 * Uses shared OTP login component with full encryption support
 */

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { OtpLogin } from '../../../shared-components/otp-login/react/OtpLogin';
import type { LoginSuccessData } from '../../../shared-components/otp-login/core';

import { getOtpEncryptionKey } from '../../../shared-config/otp-encryption';

// Use proxy in development (via Vite), direct URL in production
const AUTH_API_URL = import.meta.env.DEV 
  ? '/auth-api'  // Vite proxy in development
  : (import.meta.env.VITE_AUTH_API_URL || 'https://auth.idling.app');

export function LoginPage() {
    const navigate = useNavigate();
    const { setUser } = useAuthStore();

    const handleLoginSuccess = async (data: LoginSuccessData) => {
        // Calculate expiration
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

        // Store user data - ensure all required fields are present
        if (!data.userId || !data.email || !data.token) {
            console.error('[Login] Missing required user data:', data);
            handleLoginError('Invalid login response: missing required fields');
            return;
        }

        const userData = {
            userId: data.userId,
            email: data.email,
            token: data.token,
            expiresAt: expiresAt,
        };

        setUser(userData);

        // Token is stored in user object, which is persisted to localStorage via Zustand
        // No need for separate sessionStorage

        // Fetch admin status after login
        const { useAuthStore } = await import('../stores/auth');
        const store = useAuthStore.getState();
        await store.fetchUserInfo();

        console.log('[Login] ✅ User authenticated:', userData.email, 'Token expires at:', expiresAt);

        navigate('/');
    };

    const handleLoginError = (error: string) => {
        console.error('[Login] ❌ Login failed:', error);
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

