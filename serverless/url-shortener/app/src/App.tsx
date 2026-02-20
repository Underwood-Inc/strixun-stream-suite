/**
 * URL Shortener App
 * Main application component with React OTP login
 *
 * Uses auth-store (same as mods-hub, chat-hub) - single source of truth for auth
 */

import { useState, useEffect } from 'react';
import UrlManager from './pages/UrlManager';
import { OtpLogin } from '@strixun/otp-login/dist/react';
import type { LoginSuccessData } from '@strixun/otp-login/dist/react';
import { useAuthStore } from './stores/auth';
import { getAuthApiUrl } from '@strixun/auth-store/core';
import { getAuthErrorMessage } from '@strixun/otp-auth-service/shared';
import '@strixun/otp-login/dist/react/otp-login.css';
import './app.scss';

export default function App() {
  const { isAuthenticated, customer, checkAuth, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        await checkAuth();
      } catch (err) {
        const errorMessage = getAuthErrorMessage(err);
        console.error('[URL Shortener] Critical auth error:', errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [checkAuth]);

  async function handleLoginSuccess(_data: LoginSuccessData): Promise<void> {
    try {
      const authSuccess = await checkAuth();
      if (!authSuccess) {
        setError('Session validation failed. Please try again.');
      } else {
        setError(null);
      }
    } catch (err) {
      const errorMessage = getAuthErrorMessage(err);
      console.error('[URL Shortener] Auth check after login failed:', errorMessage);
      setError(errorMessage);
    }
  }

  function handleLoginError(err: string): void {
    console.error('[URL Shortener] Login error:', err);
  }

  async function handleLogout(): Promise<void> {
    try {
      await logout();
    } catch (err) {
      console.warn('[URL Shortener] Logout failed (non-critical):', getAuthErrorMessage(err));
    }
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading">
          <div className="loading__spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ff4444' }}>
          <h2>Authentication Error</h2>
          <p>{error}</p>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#888' }}>
            Please check your connection and try refreshing the page. If the problem persists, contact support.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !customer) {
    return (
      <div className="app-container">
        <OtpLogin
          apiUrl={getAuthApiUrl()}
          onSuccess={handleLoginSuccess}
          onError={handleLoginError}
          title="Sign In"
          subtitle="Enter your email to receive a verification code"
          showAsModal={true}
          fancy={true}
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      <UrlManager userDisplayName={customer.displayName || null} onLogout={handleLogout} />
    </div>
  );
}
