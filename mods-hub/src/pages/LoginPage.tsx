/**
 * Login page
 * Uses shared OTP login component with full encryption support
 */

import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { OtpLogin } from '../../../shared-components/otp-login/react/OtpLogin';
import type { LoginSuccessData } from '../../../shared-components/otp-login/core';

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'https://auth.idling.app';
// CRITICAL: OTP encryption key must match server-side OTP_ENCRYPTION_KEY or JWT_SECRET
// This should be set via environment variable for security
const OTP_ENCRYPTION_KEY = import.meta.env.VITE_OTP_ENCRYPTION_KEY || import.meta.env.VITE_JWT_SECRET;

export function LoginPage() {
    const navigate = useNavigate();
    const { setUser } = useAuthStore();

    const handleLoginSuccess = (data: LoginSuccessData) => {
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

        // Store user data
        const userData = {
            userId: data.userId,
            email: data.email,
            token: data.token,
            expiresAt: expiresAt,
        };

        setUser(userData);

        // Store token in sessionStorage
        if (data.token) {
            sessionStorage.setItem('auth_token', data.token);
        }

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
            otpEncryptionKey={OTP_ENCRYPTION_KEY} // CRITICAL: Pass encryption key for encrypting OTP requests
            title="Login"
            subtitle="Enter your email to receive a verification code"
        />
    );
}

