/**
 * Login page
 * Integrates with existing OTP auth service
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { colors, spacing } from '../theme';
import { useAuthStore } from '../stores/auth';

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

const Error = styled.div`
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
            const response = await fetch(`${AUTH_API_URL}/auth/request-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const data = await response.json() as { error?: string };
                throw new Error(data.error || 'Failed to request OTP');
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
            const response = await fetch(`${AUTH_API_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp }),
            });

            if (!response.ok) {
                const data = await response.json() as { error?: string };
                throw new Error(data.error || 'Failed to verify OTP');
            }

            const data = await response.json();
            
            // Store user data
            setUser({
                userId: data.userId || data.sub,
                email: email,
                token: data.access_token || data.token,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            });

            // Store token in sessionStorage
            if (data.access_token || data.token) {
                sessionStorage.setItem('auth_token', data.access_token || data.token);
            }

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
                        {error && <Error>{error}</Error>}
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
                        {error && <Error>{error}</Error>}
                    </Form>
                )}
            </Card>
        </PageContainer>
    );
}

