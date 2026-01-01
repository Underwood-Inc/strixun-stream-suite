/**
 * OTP Login Component - React Wrapper
 * 
 * Reusable email OTP authentication component for React
 * Uses the shared OtpLoginCore for framework-agnostic logic
 */

import type { ChangeEvent, KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
// Service key encryption removed - it was obfuscation only (key is in bundle)
import { OtpLoginCore, type LoginSuccessData, type OtpLoginConfig, type OtpLoginState } from '../core';
import { OTP_LENGTH, OTP_HTML_PATTERN, OTP_PLACEHOLDER, OTP_LENGTH_DESCRIPTION } from '../../../shared-config/otp-config';
import './OtpLogin.scss';

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
  fancy?: boolean; // Show fancy authentication required screen first
  learnMoreUrl?: string; // URL for "Learn more" link (defaults to https://auth.idling.app)
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
  fancy = false,
  learnMoreUrl = 'https://auth.idling.app',
}: OtpLoginProps) {
  const coreRef = useRef<OtpLoginCore | null>(null);
  const [showFancyScreen, setShowFancyScreen] = useState(fancy);
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
    // Initialize core - no encryption key needed (service key encryption removed)
    const core = new OtpLoginCore({
      apiUrl,
      onSuccess,
      onError,
      endpoints,
      customHeaders,
      // otpEncryptionKey removed - service key encryption was obfuscation only
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

  const handleFancyScreenClick = () => {
    setShowFancyScreen(false);
  };

  // Render fancy authentication required screen
  if (fancy && showFancyScreen) {
    return (
      <div className="otp-login-fancy">
        <div className="otp-login-fancy__content">
          <div className="otp-login-fancy__icon"> ★ </div>
          <h1 className="otp-login-fancy__title">Authentication Required</h1>
          <p className="otp-login-fancy__description">
            Encryption is enabled for this application. You must authenticate via email OTP to access the app.
          </p>
          <p className="otp-login-fancy__subtext">
            Please sign in using your email address to continue.
          </p>
          <button
            type="button"
            className="otp-login-fancy__button"
            onClick={handleFancyScreenClick}
          >
            SIGN IN WITH EMAIL
          </button>
          <p className="otp-login-fancy__info-link">
            <a
              href={learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="otp-login-fancy__link"
            >
              Learn more about this authentication method
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (showAsModal) {
    return (
      <div
        className="otp-login-modal-overlay"
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
      >
        <div
          className="otp-login-modal"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="otp-login-title"
          tabIndex={-1}
        >
          <div className="otp-login-header">
            <h2 id="otp-login-title">
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
              >
                {'\u00D7'}
              </button>
            )}
          </div>
          <div className="otp-login-content">
            {state.error && (
              <div className="otp-login-error">
                {state.error}
              </div>
            )}
            {state.step === 'email' ? (
              <form
                className="otp-login-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRequestOtp();
                }}
              >
                <div className="otp-login-field">
                  <label htmlFor="otp-login-email" className="otp-login-label">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="otp-login-email"
                    className="otp-login-input"
                    value={state.email}
                    onChange={handleEmailChange}
                    onKeyDown={(e) => handleKeyPress(e, handleRequestOtp)}
                    disabled={state.loading}
                    required
                    autoComplete="email"
                    placeholder="your@email.com"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="otp-login-button otp-login-button--primary"
                  disabled={state.loading || !state.email}
                >
                  {state.loading ? 'Sending...' : 'Send OTP Code'}
                </button>
                <p className="otp-login-learn-more">
                  <a
                    href={learnMoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="otp-login-learn-more__link"
                  >
                    Learn more about this authentication method
                  </a>
                </p>
              </form>
            ) : (
              <form
                className="otp-login-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyOtp();
                }}
              >
                <div className="otp-login-field">
                  <label htmlFor="otp-login-otp" className="otp-login-label">
                    {OTP_LENGTH_DESCRIPTION} OTP Code
                  </label>
                  <input
                    type="tel"
                    id="otp-login-otp"
                    className="otp-login-input otp-login-input--otp"
                    value={state.otp}
                    onChange={handleOtpChange}
                    onKeyDown={(e) => handleKeyPress(e, handleVerifyOtp)}
                    disabled={state.loading}
                    required
                    maxLength={OTP_LENGTH}
                    pattern={OTP_HTML_PATTERN}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={OTP_PLACEHOLDER}
                    autoFocus
                  />
                  <p className="otp-login-hint">Check your email ({state.email}) for the code</p>
                  {state.countdown > 0 ? (
                    <p className="otp-login-countdown">
                      Code expires in: {formatCountdown(state.countdown)}
                    </p>
                  ) : state.countdown === 0 && state.step === 'otp' ? (
                    <p className="otp-login-countdown otp-login-countdown--expired">
                      Code expired. Request a new one.
                    </p>
                  ) : null}
                </div>
                <div className="otp-login-actions">
                  <button
                    type="button"
                    className="otp-login-button otp-login-button--secondary"
                    disabled={state.loading}
                    onClick={handleGoBack}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="otp-login-button otp-login-button--primary"
                    disabled={state.loading || state.otp.length !== OTP_LENGTH}
                  >
                    {state.loading ? 'Verifying...' : 'Verify & Login'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="otp-login">
      <div className="otp-login-container">
        <div className="otp-login-header">
          <h1 className="otp-login-title">
            {title}
          </h1>
          <p className="otp-login-subtitle">
            {subtitle}
          </p>
        </div>
        {state.error && (
          <div className="otp-login-error">
            {state.error}
          </div>
        )}
        {state.step === 'email' ? (
          <form
            className="otp-login-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleRequestOtp();
            }}
          >
            <div className="otp-login-field">
              <label htmlFor="otp-login-email" className="otp-login-label">
                Email Address
              </label>
              <input
                type="email"
                id="otp-login-email"
                className="otp-login-input"
                value={state.email}
                onChange={handleEmailChange}
                onKeyDown={(e) => handleKeyPress(e, handleRequestOtp)}
                disabled={state.loading}
                required
                autoComplete="email"
                placeholder="your@email.com"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="otp-login-button otp-login-button--primary"
              disabled={state.loading || !state.email}
            >
              {state.loading ? 'Sending...' : 'Send OTP Code'}
            </button>
            <p className="otp-login-learn-more">
              <a
                href={learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="otp-login-learn-more__link"
              >
                Learn more about this authentication method
              </a>
            </p>
          </form>
        ) : (
          <form
            className="otp-login-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyOtp();
            }}
          >
            <div className="otp-login-field">
              <label htmlFor="otp-login-otp" className="otp-login-label">
                {OTP_LENGTH_DESCRIPTION} OTP Code
              </label>
              <input
                type="tel"
                id="otp-login-otp"
                className="otp-login-input otp-login-input--otp"
                value={state.otp}
                onChange={handleOtpChange}
                onKeyDown={(e) => handleKeyPress(e, handleVerifyOtp)}
                disabled={state.loading}
                required
                maxLength={OTP_LENGTH}
                pattern={OTP_HTML_PATTERN}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={OTP_PLACEHOLDER}
                autoFocus
              />
              <p className="otp-login-hint">Check your email ({state.email}) for the code</p>
              {state.countdown > 0 ? (
                <p className="otp-login-countdown">
                  Code expires in: {formatCountdown(state.countdown)}
                </p>
              ) : state.countdown === 0 && state.step === 'otp' ? (
                <p className="otp-login-countdown otp-login-countdown--expired">
                  Code expired. Request a new one.
                </p>
              ) : null}
            </div>
            <div className="otp-login-actions">
              <button
                type="button"
                className="otp-login-button otp-login-button--secondary"
                disabled={state.loading}
                onClick={handleGoBack}
              >
                Back
              </button>
              <button
                type="submit"
                className="otp-login-button otp-login-button--primary"
                disabled={state.loading || state.otp.length !== OTP_LENGTH}
              >
                {state.loading ? 'Verifying...' : 'Verify & Login'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

