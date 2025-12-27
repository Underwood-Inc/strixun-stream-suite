/**
 * OTP Login Component - React Wrapper
 * 
 * Reusable email OTP authentication component for React
 * Uses the shared OtpLoginCore for framework-agnostic logic
 */

import type { ChangeEvent, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { getOtpEncryptionKey } from '../../../shared-config/otp-encryption';
import { OtpLoginCore, type LoginSuccessData, type OtpLoginConfig, type OtpLoginState } from '../core';

export interface OtpLoginProps {
  apiUrl: string;
  onSuccess: (data: LoginSuccessData) => void;
  onError?: (error: string) => void;
  endpoints?: OtpLoginConfig['endpoints'];
  customHeaders?: OtpLoginConfig['customHeaders'];
  otpEncryptionKey?: string; // CRITICAL: OTP encryption key for encrypting requests
  title?: string;
  subtitle?: string;
  showAsModal?: boolean;
  onClose?: () => void;
}

export function OtpLogin({
  apiUrl,
  onSuccess,
  onError,
  endpoints,
  customHeaders,
  otpEncryptionKey,
  title = 'Sign In',
  subtitle = 'Enter your email to receive a verification code',
  showAsModal = false,
  onClose,
}: OtpLoginProps) {
  const coreRef = useRef<OtpLoginCore | null>(null);
  const [state, setState] = useState<OtpLoginState>({
    step: 'email',
    email: '',
    otp: '',
    loading: false,
    error: null,
    countdown: 0,
    rateLimitResetAt: null,
    rateLimitCountdown: 0,
  });

  useEffect(() => {
    // CRITICAL: Get encryption key - use prop if provided, otherwise use centralized config
    // This ensures we always use VITE_SERVICE_ENCRYPTION_KEY consistently across the codebase
    const encryptionKey = otpEncryptionKey || getOtpEncryptionKey();
    
    // CRITICAL: Verify encryption key is provided
    if (!encryptionKey) {
      console.error('[OtpLogin] ❌ CRITICAL ERROR: otpEncryptionKey is missing!');
      console.error('[OtpLogin] This will cause encryption to fail. Key status:', {
        hasKey: !!encryptionKey,
        keyType: typeof encryptionKey,
        keyLength: encryptionKey?.length || 0,
        apiUrl: apiUrl,
        usingCentralizedConfig: !otpEncryptionKey
      });
      if (onError) {
        onError('OTP encryption key is required. Please configure VITE_SERVICE_ENCRYPTION_KEY in your build environment.');
      }
      return;
    }
    
    if (encryptionKey.length < 32) {
      console.error('[OtpLogin] ❌ CRITICAL ERROR: otpEncryptionKey is too short!', {
        keyLength: encryptionKey.length,
        requiredLength: 32
      });
      if (onError) {
        onError('OTP encryption key must be at least 32 characters long.');
      }
      return;
    }
    
    console.log('[OtpLogin] ✅ Encryption key provided, length:', encryptionKey.length, otpEncryptionKey ? '(from prop)' : '(from VITE_SERVICE_ENCRYPTION_KEY)');
    
    // Initialize core
    const core = new OtpLoginCore({
      apiUrl,
      onSuccess,
      onError,
      endpoints,
      customHeaders,
      otpEncryptionKey: encryptionKey, // CRITICAL: Pass encryption key for encrypting OTP requests
    });

    coreRef.current = core;

    // Subscribe to state changes
    const unsubscribe = core.subscribe((newState) => {
      setState(newState);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
      core.destroy();
    };
  }, [apiUrl, onSuccess, onError, endpoints, customHeaders, otpEncryptionKey]); // Note: getOtpEncryptionKey() is stable, so we don't need it in deps

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    coreRef.current?.setEmail(e.target.value);
  };

  const handleOtpChange = (e: ChangeEvent<HTMLInputElement>) => {
    coreRef.current?.setOtp(e.target.value);
  };

  const handleRequestOtp = () => {
    coreRef.current?.requestOtp();
  };

  const handleVerifyOtp = () => {
    coreRef.current?.verifyOtp();
  };

  const handleGoBack = () => {
    coreRef.current?.goBack();
  };

  const handleKeyPress = (e: KeyboardEvent, handler: () => void) => {
    if (e.key === 'Enter' && !state.loading) {
      handler();
    }
  };

  const formatCountdown = (seconds: number): string => {
    return OtpLoginCore.formatCountdown(seconds);
  };

  if (showAsModal) {
    return (
      <div
        className="otp-login-modal-overlay"
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000000,
        }}
      >
        <div
          className="otp-login-modal"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="otp-login-title"
          tabIndex={-1}
          style={{
            background: 'var(--card, #fff)',
            border: '1px solid var(--border, #ddd)',
            borderRadius: '12px',
            width: '90%',
            maxWidth: 'min(90vw, 500px)',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            className="otp-login-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px',
              borderBottom: '1px solid var(--border, #ddd)',
            }}
          >
            <h2 id="otp-login-title" style={{ margin: 0, fontSize: '24px' }}>
              {title}
            </h2>
            {onClose && (
              <button
                type="button"
                className="otp-login-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '32px',
                  cursor: 'pointer',
                  padding: 0,
                  width: '32px',
                  height: '32px',
                }}
              >
                ×
              </button>
            )}
          </div>
          <div className="otp-login-content" style={{ padding: '24px' }}>
            {state.error && (
              <div style={{ color: 'var(--danger, #f00)', marginBottom: '16px', textAlign: 'center' }}>
                {state.error}
              </div>
            )}
            {state.step === 'email' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRequestOtp();
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                <div>
                  <label htmlFor="otp-login-email" style={{ display: 'block', marginBottom: '8px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="otp-login-email"
                    value={state.email}
                    onChange={handleEmailChange}
                    onKeyDown={(e) => handleKeyPress(e, handleRequestOtp)}
                    disabled={state.loading}
                    required
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid var(--border, #ddd)',
                      borderRadius: '4px',
                      fontSize: '16px',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={state.loading}
                  style={{
                    padding: '12px 24px',
                    background: state.loading ? 'var(--border, #ddd)' : 'var(--accent, #007bff)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: state.loading ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 500,
                  }}
                >
                  {state.loading ? 'Sending...' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyOtp();
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                <div style={{ textAlign: 'center', color: 'var(--text-secondary, #666)', marginBottom: '16px' }}>
                  Check your email for the OTP code
                </div>
                <div>
                  <label htmlFor="otp-login-otp" style={{ display: 'block', marginBottom: '8px' }}>
                    6-Digit OTP Code
                  </label>
                  <input
                    type="tel"
                    id="otp-login-otp"
                    value={state.otp}
                    onChange={handleOtpChange}
                    onKeyDown={(e) => handleKeyPress(e, handleVerifyOtp)}
                    disabled={state.loading}
                    required
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid var(--border, #ddd)',
                      borderRadius: '4px',
                      fontSize: '16px',
                      textAlign: 'center',
                      letterSpacing: '8px',
                    }}
                  />
                  {state.countdown > 0 && (
                    <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-secondary, #666)' }}>
                      Code expires in: {formatCountdown(state.countdown)}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={state.loading}
                  style={{
                    padding: '12px 24px',
                    background: state.loading ? 'var(--border, #ddd)' : 'var(--accent, #007bff)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: state.loading ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 500,
                  }}
                >
                  {state.loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button
                  type="button"
                  onClick={handleGoBack}
                  disabled={state.loading}
                  style={{
                    padding: '12px 24px',
                    background: 'transparent',
                    color: 'var(--text, #000)',
                    border: '1px solid var(--border, #ddd)',
                    borderRadius: '4px',
                    cursor: state.loading ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                  }}
                >
                  Back
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="otp-login"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px',
      }}
    >
      <div
        className="otp-login-container"
        style={{
          maxWidth: '400px',
          width: '100%',
        }}
      >
        <div className="otp-login-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 className="otp-login-title" style={{ fontSize: '2rem', marginBottom: '16px' }}>
            {title}
          </h1>
          <p className="otp-login-subtitle" style={{ color: 'var(--text-secondary, #666)' }}>
            {subtitle}
          </p>
        </div>
        {state.error && (
          <div style={{ color: 'var(--danger, #f00)', marginBottom: '16px', textAlign: 'center' }}>
            {state.error}
          </div>
        )}
        {state.step === 'email' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRequestOtp();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <input
              type="email"
              placeholder="Email address"
              value={state.email}
              onChange={handleEmailChange}
              onKeyDown={(e) => handleKeyPress(e, handleRequestOtp)}
              disabled={state.loading}
              required
              style={{
                padding: '12px',
                border: '1px solid var(--border, #ddd)',
                borderRadius: '4px',
                fontSize: '16px',
              }}
            />
            <button
              type="submit"
              disabled={state.loading}
              style={{
                padding: '12px 24px',
                background: state.loading ? 'var(--border, #ddd)' : 'var(--accent, #007bff)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: state.loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 500,
              }}
            >
              {state.loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyOtp();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div style={{ textAlign: 'center', color: 'var(--text-secondary, #666)', marginBottom: '16px' }}>
              Check your email for the OTP code
            </div>
            <input
              type="tel"
              placeholder="Enter OTP code"
              value={state.otp}
              onChange={handleOtpChange}
              onKeyDown={(e) => handleKeyPress(e, handleVerifyOtp)}
              disabled={state.loading}
              required
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              style={{
                padding: '12px',
                border: '1px solid var(--border, #ddd)',
                borderRadius: '4px',
                fontSize: '16px',
                textAlign: 'center',
                letterSpacing: '8px',
              }}
            />
            {state.countdown > 0 && (
              <div style={{ fontSize: '14px', color: 'var(--text-secondary, #666)', textAlign: 'center' }}>
                Code expires in: {formatCountdown(state.countdown)}
              </div>
            )}
            <button
              type="submit"
              disabled={state.loading}
              style={{
                padding: '12px 24px',
                background: state.loading ? 'var(--border, #ddd)' : 'var(--accent, #007bff)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: state.loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 500,
              }}
            >
              {state.loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              type="button"
              onClick={handleGoBack}
              disabled={state.loading}
              style={{
                padding: '12px 24px',
                background: 'transparent',
                color: 'var(--text, #000)',
                border: '1px solid var(--border, #ddd)',
                borderRadius: '4px',
                cursor: state.loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
              }}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

