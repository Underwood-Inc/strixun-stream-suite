/**
 * URL Shortener App
 * Main application component with React OTP login
 */

import { useState, useEffect } from 'react';
import { apiClient } from './lib/api-client';
import UrlManager from './pages/UrlManager';
import { OtpLogin } from '@strixun/otp-login/dist/react';
import type { LoginSuccessData } from '@strixun/otp-login/dist/react';
import '@strixun/otp-login/dist/react/otp-login.css';
import './app.scss';

function getApiUrl(): string {
  if (typeof window === 'undefined') return '';
  
  // CRITICAL: NO FALLBACKS ON LOCAL - Always use localhost in development
  // Check if we're running on localhost (development mode)
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      import.meta.env.DEV ||
                      import.meta.env.MODE === 'development';
  
  if (isLocalhost) {
    // NEVER fall back to production when on localhost
    return 'http://localhost:8787';
  }
  
  // Only use production URL if NOT on localhost
  // Environment variable override for production builds
  return import.meta.env.VITE_AUTH_API_URL || 'https://auth.idling.app';
}

async function fetchUserDisplayName(token: string): Promise<string | null> {
  try {
    const response = await fetch(`${getApiUrl()}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      // Check if response is encrypted
      const isEncrypted = response.headers.get('X-Encrypted') === 'true';
      let data: any = await response.json();
      
      // Decrypt if encrypted
      if (isEncrypted && data && typeof data === 'object' && 'encrypted' in data && data.encrypted) {
        try {
          if (typeof (window as any).decryptWithJWT !== 'function') {
            console.warn('[URL Shortener] Decryption library not loaded, trying to parse unencrypted response');
          } else {
            data = await (window as any).decryptWithJWT(data, token);
          }
        } catch (error) {
          console.error('[URL Shortener] Failed to decrypt response:', error);
          // Try to parse as unencrypted fallback
        }
      }
      
      return data?.displayName || null;
    }
  } catch (error) {
    console.error('[URL Shortener] Failed to fetch display name:', error);
  }
  return null;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const token = apiClient.getToken();
      
      if (token) {
        const displayName = await fetchUserDisplayName(token);
        if (displayName) {
          setIsAuthenticated(true);
          setUserDisplayName(displayName);
        }
      }
      
      setLoading(false);
    }
    
    checkAuth();
  }, []);

  async function handleLoginSuccess(data: LoginSuccessData): Promise<void> {
    const token = data.token;
    
    if (!token) {
      console.error('[URL Shortener] No token in login response');
      return;
    }
    
    apiClient.setToken(token);
    const displayName = await fetchUserDisplayName(token);
    
    setIsAuthenticated(true);
    setUserDisplayName(displayName);
  }

  function handleLoginError(error: string): void {
    console.error('[URL Shortener] Login error:', error);
  }

  function handleLogout(): void {
    apiClient.logout();
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
            apiUrl={getApiUrl()}
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

