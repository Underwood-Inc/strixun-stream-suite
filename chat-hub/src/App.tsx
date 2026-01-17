/**
 * Chat Hub - Main Application
 * Standalone P2P chat interface with landing page
 */

import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/auth';
import { useChatStore } from './stores/chat';
import { ChatClient, IntegrityBadge, type ChatIntegrityInfo } from '@strixun/chat/react';
import { OtpLogin } from '@strixun/otp-login/dist/react';
import type { LoginSuccessData } from '@strixun/otp-login/dist/react';
import { LandingPage } from './pages/LandingPage';
import '@strixun/otp-login/dist/react/otp-login.css';
import '@strixun/chat/react/chat.css';

// Use proxy in development (via Vite), direct URL in production
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL 
  ? import.meta.env.VITE_AUTH_API_URL
  : (import.meta.env.DEV 
    ? '/auth-api'
    : 'https://auth.idling.app');

// Simple hash-based router
function useHashRouter() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/');
  
  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash.slice(1) || '/');
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  return route;
}

export function App() {
  const route = useHashRouter();
  
  // Show landing page for root route
  if (route === '/' || route === '') {
    return <LandingPage />;
  }
  
  // Show chat for /chat route
  if (route === '/chat') {
    return <ChatApp />;
  }
  
  // Default to landing
  return <LandingPage />;
}

function ChatApp() {
  const { isAuthenticated, customer, checkAuth, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Check authentication on mount
  useEffect(() => {
    const init = async () => {
      try {
        await checkAuth();
      } catch {
        // Non-critical - user may not be logged in
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [checkAuth]);

  const handleLoginSuccess = async (_data: LoginSuccessData) => {
    console.log('[ChatHub] OTP verification successful, validating session...');
    setLoginError(null);
    
    try {
      const authSuccess = await checkAuth();
      if (!authSuccess) {
        setLoginError('Session validation failed. Please try again.');
      }
    } catch (error) {
      console.error('[ChatHub] Error validating session:', error);
      setLoginError('Session validation error. Please try again.');
    }
  };

  const handleLoginError = (error: string) => {
    console.error('[ChatHub] Login failed:', error);
    setLoginError(error);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('[ChatHub] Logout failed:', error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated || !customer) {
    return (
      <div className="login-container">
        <header className="login-header">
          <h1 className="login-header__title">Community Chat</h1>
          <span className="login-header__subtitle">Strixun Stream Suite</span>
        </header>
        
        {loginError && (
          <div className="error-banner">
            {loginError}
          </div>
        )}
        
        <OtpLogin
          apiUrl={AUTH_API_URL}
          onSuccess={handleLoginSuccess}
          onError={handleLoginError}
          title="Sign In"
          subtitle="Enter your email to join the community chat"
        />
      </div>
    );
  }

  // Authenticated - show chat
  return (
    <div className="app-container">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header__left">
          <h1 className="chat-header__title">Community Chat</h1>
          <span className="chat-header__subtitle">P2P Real-time Messaging</span>
        </div>
        
        <div className="chat-header__right">
          <div className="chat-header__user-info">
            <span className="chat-header__user-label">Logged in as:</span>
            <span className="chat-header__user-name">{customer.displayName || 'Customer'}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="chat-header__logout-btn"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Chat Interface */}
      <main className="chat-main">
        <div className="chat-client-container">
          <ChatClient
            useChatStore={useChatStore}
            userId={customer.customerId}
            userName={customer.displayName || 'Customer'}
            showRoomList={true}
            showRoomCreator={true}
            style={{ height: '100%' }}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="chat-footer">
        <p className="chat-footer__text">
          <a href="https://strixun.live" target="_blank" rel="noopener noreferrer">
            Strixun Stream Suite
          </a>
          {' '}&middot;{' '}
          Powered by WebRTC P2P
        </p>
      </footer>
    </div>
  );
}
