/**
 * React Example - OTP Authentication Integration
 * 
 * Example React component using the OTP Auth Service
 */

import React, { useState } from 'react';
import { OTPAuth } from '@otpauth/sdk';

const OTPAuthComponent: React.FC = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const client = new OTPAuth({
    apiKey: process.env.REACT_APP_OTP_API_KEY || '',
    baseUrl: process.env.REACT_APP_OTP_BASE_URL || 'https://otp-auth-service.workers.dev'
  });

  const handleRequestOTP = async () => {
    setLoading(true);
    setError(null);

    try {
      await client.requestOTP(email);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await client.verifyOTP(email, otp);
      setToken(response.token);
      // Store token in localStorage or state management
      localStorage.setItem('otp_token', response.token);
      localStorage.setItem('otp_user', JSON.stringify({
        userId: response.userId,
        email: response.email
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  if (token) {
    return (
      <div>
        <h2>Successfully Authenticated!</h2>
        <p>Token: {token.substring(0, 20)}...</p>
      </div>
    );
  }

  return (
    <div>
      {step === 'email' ? (
        <div>
          <h2>Enter Your Email</h2>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
          <button onClick={handleRequestOTP} disabled={loading || !email}>
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      ) : (
        <div>
          <h2>Enter OTP Code</h2>
          <p>Check your email for the 9-digit code</p>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456789"
            maxLength={9}
          />
          <button onClick={handleVerifyOTP} disabled={loading || otp.length !== 9}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button onClick={() => setStep('email')}>Back</button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      )}
    </div>
  );
};

export default OTPAuthComponent;

