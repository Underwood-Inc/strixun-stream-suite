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
  console.log('[URL Shortener] fetchUserDisplayName called with token:', token ? `${token.substring(0, 20)}...` : 'null');
  try {
    const apiUrl = getApiUrl();
    console.log('[URL Shortener] Fetching display name from:', `${apiUrl}/auth/me`);
    const response = await fetch(`${apiUrl}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('[URL Shortener] /auth/me response status:', response.status, response.statusText);
    if (response.ok) {
      // Check if response is encrypted (headers are case-insensitive, but be defensive)
      const encryptedHeader = response.headers.get('X-Encrypted') || response.headers.get('x-encrypted');
      const isEncrypted = encryptedHeader === 'true';
      console.log('[URL Shortener] Response encryption check:', { encryptedHeader, isEncrypted });
      
      let data: any = await response.json();
      console.log('[URL Shortener] Response data type:', typeof data, 'keys:', data && typeof data === 'object' ? Object.keys(data) : 'not an object');
      
      // Check if data looks encrypted (even if header check failed)
      const looksEncrypted = data && typeof data === 'object' && 'encrypted' in data && data.encrypted === true;
      console.log('[URL Shortener] Data encryption check:', { looksEncrypted, hasEncryptedKey: data && typeof data === 'object' && 'encrypted' in data });
      
      if (isEncrypted || looksEncrypted) {
        // Wait for decryptWithJWT to be available (it's loaded via script tag)
        let decryptFn = (window as any).decryptWithJWT;
        
        // Poll for decryptWithJWT if not immediately available (script might still be loading)
        if (typeof decryptFn !== 'function') {
          console.warn('[URL Shortener] Decryption library not loaded yet, waiting...');
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            decryptFn = (window as any).decryptWithJWT;
            if (typeof decryptFn === 'function') {
              console.log('[URL Shortener] Decryption library loaded after wait');
              break;
            }
          }
        }
        
        if (typeof decryptFn !== 'function') {
          console.error('[URL Shortener] Decryption library not available after waiting. Response is encrypted but cannot decrypt.');
          return null;
        }
        
        try {
          // Trim token to ensure it matches what backend used for encryption
          const trimmedToken = token.trim();
          data = await decryptFn(data, trimmedToken);
          console.log('[URL Shortener] Successfully decrypted /auth/me response');
        } catch (error) {
          console.error('[URL Shortener] Failed to decrypt response:', error);
          // If decryption fails, we can't extract displayName from encrypted data
          return null;
        }
      }
      
      // Extract displayName from decrypted data
      const displayName = data?.displayName;
      console.log('[URL Shortener] Decrypted data:', { 
        hasDisplayName: !!displayName, 
        displayName, 
        allKeys: data ? Object.keys(data) : null,
        fullData: data 
      });
      if (displayName) {
        console.log('[URL Shortener] Found displayName:', displayName);
        return displayName;
      } else {
        console.warn('[URL Shortener] No displayName in response. Response keys:', data ? Object.keys(data) : 'null');
        return null;
      }
    } else {
      console.error('[URL Shortener] /auth/me returned non-OK status:', response.status, response.statusText);
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

