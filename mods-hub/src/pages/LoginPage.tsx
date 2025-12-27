/**
 * Login page
 * Integrates with existing OTP auth service
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import { useAuthStore } from '../stores/auth';
import { createAPIClient } from '@strixun/api-framework/client';

const PageContainer = styled.div`
  max-width: 400px;
  margin: 0 auto;
  padding: ${spacing.xxl} 0;
`;

const Card = styled.div`
  background: ${colors.bgSecondary};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: ${spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${spacing.lg};
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 700;
  color: ${colors.text};
  text-align: center;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const Input = styled.input`
  padding: ${spacing.sm} ${spacing.md};
  background: ${colors.bg};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${colors.text};
  font-size: 0.875rem;
  
  &:focus {
    border-color: ${colors.accent};
    outline: none;
  }
`;

const Button = styled.button<{ disabled?: boolean }>`
  padding: ${spacing.md} ${spacing.lg};
  background: ${({ disabled }) => disabled ? colors.border : colors.accent};
  color: ${colors.bg};
  border-radius: 4px;
  font-weight: 500;
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  transition: background 0.2s ease;
  
  &:hover:not(:disabled) {
    background: ${colors.accentHover};
  }
`;

const ErrorMessage = styled.div`
  color: ${colors.danger};
  font-size: 0.875rem;
  text-align: center;
`;

const Info = styled.div`
  color: ${colors.textSecondary};
  font-size: 0.875rem;
  text-align: center;
`;

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'https://auth.idling.app';

// Create auth API client (uses secureFetch internally)
const authClient = createAPIClient({
    baseURL: AUTH_API_URL,
    timeout: 30000,
});

export function LoginPage() {
    const navigate = useNavigate();
    const { setUser } = useAuthStore();
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'email' | 'otp'>('email');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRequestOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authClient.post<{ success?: boolean; message?: string }>('/auth/request-otp', { email });

            if (response.status !== 200) {
                const errorData = response.data as { error?: string; detail?: string } | undefined;
                throw new Error(errorData?.error || errorData?.detail || 'Failed to request OTP');
            }

            setStep('otp');
        } catch (err: any) {
            setError(err.message || 'Failed to request OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await authClient.post<{
                access_token?: string;
                token?: string;
                userId?: string;
                sub?: string;
                email?: string;
                expiresAt?: string;
                expires_in?: number;
            }>('/auth/verify-otp', { email, otp });

            if (response.status !== 200 || !response.data) {
                const errorData = response.data as { error?: string; detail?: string } | undefined;
                throw new Error(errorData?.error || errorData?.detail || 'Failed to verify OTP');
            }

            const data = response.data;
            
            // Use expiresAt from backend response (it's already in ISO string format)
            // If not provided, calculate from expires_in (in seconds) or default to 7 hours
            let expiresAt: string;
            if (data.expiresAt) {
                expiresAt = data.expiresAt;
            } else if (data.expires_in) {
                expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
            } else {
                // Default to 7 hours (matching backend token expiration)
                expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString();
            }
            
            // Store user data with correct expiration
            const userData = {
                userId: data.userId || data.sub,
                email: data.email || email,
                token: data.access_token || data.token,
                expiresAt: expiresAt,
            };
            
            setUser(userData);

            // Store token in sessionStorage
            if (data.access_token || data.token) {
                sessionStorage.setItem('auth_token', data.access_token || data.token);
            }
            
            console.log('[Login] ✅ User authenticated:', userData.email, 'Token expires at:', expiresAt);

            navigate('/');
        } catch (err: any) {
            setError(err.message || 'Failed to verify OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageContainer>
            <Card>
                <Title>Login</Title>
                
                {step === 'email' ? (
                    <Form onSubmit={handleRequestOTP}>
                        <Input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Sending...' : 'Send OTP'}
                        </Button>
                        {error && <ErrorMessage>{error}</ErrorMessage>}
                    </Form>
                ) : (
                    <Form onSubmit={handleVerifyOTP}>
                        <Info>Check your email for the OTP code</Info>
                        <Input
                            type="text"
                            placeholder="Enter OTP code"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            required
                            maxLength={6}
                        />
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Verifying...' : 'Verify OTP'}
                        </Button>
                        <Button 
                            type="button" 
                            onClick={() => {
                                setStep('email');
                                setOtp('');
                                setError('');
                            }}
                            disabled={loading}
                            style={{ background: 'transparent', color: colors.text, border: `1px solid ${colors.border}` }}
                        >
                            Back
                        </Button>
                        {error && <ErrorMessage>{error}</ErrorMessage>}
                    </Form>
                )}
            </Card>
        </PageContainer>
    );
}

