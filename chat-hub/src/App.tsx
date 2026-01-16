/**
 * Chat Hub - Main Application
 * Standalone P2P chat interface
 */

import React, { useEffect, useState } from 'react';
import { useAuthStore } from './stores/auth';
import { useChatStore } from './stores/chat';
import { ChatClient } from '@strixun/chat/react';
import { OtpLogin } from '@strixun/otp-login/dist/react';
import type { LoginSuccessData } from '@strixun/otp-login/dist/react';
import '@strixun/otp-login/dist/react/otp-login.css';

// Use proxy in development (via Vite), direct URL in production
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL 
  ? import.meta.env.VITE_AUTH_API_URL
  : (import.meta.env.DEV 
    ? '/auth-api'
    : 'https://auth.idling.app');

export function App() {
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
    console.log('[ChatHub] ✓ OTP verification successful, validating session...');
    setLoginError(null);
    
    try {
      const authSuccess = await checkAuth();
      if (!authSuccess) {
        setLoginError('Session validation failed. Please try again.');
      }
    } catch (error) {
      console.error('[ChatHub] ✗ Error validating session:', error);
      setLoginError('Session validation error. Please try again.');
    }
  };

  const handleLoginError = (error: string) => {
    console.error('[ChatHub] ✗ Login failed:', error);
    setLoginError(error);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('[ChatHub] ✗ Logout failed:', error);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner} />
        <p style={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated || !customer) {
    return (
      <div style={styles.loginContainer}>
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>Community Chat</h1>
          <span style={styles.headerSubtitle}>Strixun Stream Suite</span>
        </header>
        
        {loginError && (
          <div style={styles.errorBanner}>
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
    <div style={styles.appContainer}>
      {/* Header */}
      <header style={styles.chatHeader}>
        <div style={styles.headerLeft}>
          <h1 style={styles.chatTitle}>Community Chat</h1>
          <span style={styles.chatSubtitle}>P2P Real-time Messaging</span>
        </div>
        
        <div style={styles.headerRight}>
          <div style={styles.userInfo}>
            <span style={styles.userLabel}>Logged in as:</span>
            <span style={styles.userName}>{customer.displayName || 'Customer'}</span>
          </div>
          <button 
            onClick={handleLogout}
            style={styles.logoutButton}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Chat Interface */}
      <main style={styles.chatMain}>
        <ChatClient
          useChatStore={useChatStore}
          userId={customer.customerId}
          userName={customer.displayName || 'Customer'}
          showRoomList={true}
          showRoomCreator={true}
          style={styles.chatClient}
        />
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>
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

// Styles (inline for standalone app simplicity)
const styles: Record<string, React.CSSProperties> = {
  // Loading
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px',
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid var(--border)',
    borderTopColor: 'var(--gold-primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
  },
  
  // Login
  loginContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '24px',
    gap: '24px',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '16px',
  },
  headerTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '2.5rem',
    fontWeight: 400,
    color: 'var(--gold-primary)',
    marginBottom: '8px',
  },
  headerSubtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  },
  errorBanner: {
    padding: '12px 16px',
    background: 'rgba(244, 67, 54, 0.1)',
    border: '1px solid rgba(244, 67, 54, 0.3)',
    borderRadius: '8px',
    color: 'var(--danger)',
    fontSize: '0.875rem',
    maxWidth: '400px',
    textAlign: 'center' as const,
  },
  
  // App
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  
  // Chat Header
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  chatTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.5rem',
    fontWeight: 400,
    color: 'var(--gold-primary)',
    margin: 0,
  },
  chatSubtitle: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '2px',
  },
  userLabel: {
    fontSize: '0.625rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  userName: {
    fontSize: '0.875rem',
    color: 'var(--gold-primary)',
    fontWeight: 500,
  },
  logoutButton: {
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--border-radius-sm)',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  
  // Chat Main
  chatMain: {
    flex: 1,
    padding: '24px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  chatClient: {
    flex: 1,
    minHeight: 0,
    border: '1px solid var(--border)',
    borderRadius: 'var(--border-radius)',
  },
  
  // Footer
  footer: {
    padding: '12px 24px',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  footerText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
};
