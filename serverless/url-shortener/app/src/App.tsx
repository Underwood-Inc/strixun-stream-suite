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
import '@strixun/otp-login/dist/react/otp-login.css';
import './app.scss';

/**
 * Get auth API URL for OTP login
 */
function getAuthApiUrl(): string {
  if (typeof window === 'undefined') return '';
  
  // CRITICAL: NO FALLBACKS ON LOCAL - Always use localhost in development
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      import.meta.env.DEV ||
                      import.meta.env.MODE === 'development';
  
  if (isLocalhost) {
    return 'http://localhost:8787';
  }
  
  return import.meta.env.VITE_AUTH_API_URL || 'https://auth.idling.app';
}

/**
 * Check authentication status by calling /auth/me
 * Cookie is sent automatically
 */
async function checkAuth(): Promise<{ customerId: string; displayName?: string | null } | null> {
  try {
    const apiUrl = getAuthApiUrl();
    const response = await fetch(`${apiUrl}/auth/me`, {
      method: 'GET',
      credentials: 'include', // Send cookies
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      return {
        customerId: data.customerId,
        displayName: data.displayName || null,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[URL Shortener] Auth check failed:', error);
    return null;
  }
}

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
    console.error('[URL Shortener] Logout failed:', error);
  }
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const authData = await checkAuth();
      if (authData) {
        setIsAuthenticated(true);
        setUserDisplayName(authData.displayName || null);
      }
      setLoading(false);
    }
    
    init();
  }, []);

  async function handleLoginSuccess(data: LoginSuccessData): Promise<void> {
    // Cookie is set by server, just update UI
    const authData = await checkAuth();
    if (authData) {
      setIsAuthenticated(true);
      setUserDisplayName(authData.displayName || null);
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
