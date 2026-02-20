/**
 * URL Shortener App
 * Main application component with React OTP login
 * 
 * SIMPLIFIED: HttpOnly cookie-based authentication
 * - No localStorage token storage
 * - Cookies handle everything
 */

import { useState, useEffect } from 'react';
import UrlManager from './pages/UrlManager';
import { OtpLogin } from '@strixun/otp-login/dist/react';
import type { LoginSuccessData } from '@strixun/otp-login/dist/react';
import { getAuthApiUrl } from '@strixun/auth-store/core';
import { checkAuth as checkAuthShared, getAuthErrorMessage } from '@strixun/otp-auth-service/shared';
import '@strixun/otp-login/dist/react/otp-login.css';
import './app.scss';

/**
 * Logout by calling /auth/logout
 * This clears the HttpOnly cookie
 */
async function logout(): Promise<void> {
  try {
    const apiUrl = getAuthApiUrl();
    await fetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include', // Send cookies
    });
  } catch (error) {
    // Logout errors are non-critical - we clear local state anyway
    console.warn('[URL Shortener] Logout API call failed (non-critical):', getAuthErrorMessage(error));
  }
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const authData = await checkAuthShared();
        
        if (authData) {
          setIsAuthenticated(true);
          setUserDisplayName(authData.displayName || null);
        } else {
          // Not authenticated - this is expected, show login screen
          setIsAuthenticated(false);
        }
      } catch (error) {
        // Critical error - show error message to user
        const errorMessage = getAuthErrorMessage(error);
        console.error('[URL Shortener] Critical auth error:', errorMessage);
        setError(errorMessage);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    }
    
    init();
  }, []);

  async function handleLoginSuccess(data: LoginSuccessData): Promise<void> {
    // Cookie is set by server, just update UI
    try {
      const authData = await checkAuthShared();
      if (authData) {
        setIsAuthenticated(true);
        setUserDisplayName(authData.displayName || null);
        setError(null); // Clear any previous errors
      }
    } catch (error) {
      const errorMessage = getAuthErrorMessage(error);
      console.error('[URL Shortener] Auth check after login failed:', errorMessage);
      setError(errorMessage);
    }
  }

  function handleLoginError(error: string): void {
    console.error('[URL Shortener] Login error:', error);
  }

  async function handleLogout(): Promise<void> {
    await logout();
    setIsAuthenticated(false);
    setUserDisplayName(null);
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

  if (!isAuthenticated) {
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
      <UrlManager userDisplayName={userDisplayName} onLogout={handleLogout} />
    </div>
  );
}
