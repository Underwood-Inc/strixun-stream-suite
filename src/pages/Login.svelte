<script lang="ts">
  /**
   * Login Page
   * 
   * The default landing page for the Stream Suite.
   * Handles authentication via email OTP and redirects to
   * the intended destination after successful login.
   * 
   * Features:
   * - Email OTP authentication via @strixun/otp-login
   * - Redirect URL support via query params (?redirect=/url-shortener)
   * - Automatic redirect if already authenticated
   * - Clean, focused login UI
   */
  
  import { onMount } from 'svelte';
  import { login, isAuthenticated, authCheckComplete } from '../stores/auth';
  import { showToast } from '../stores/toast-queue';
  import { navigate, getRedirectUrl } from '../router';
  import { DEFAULT_AUTHENTICATED_ROUTE } from '../router/routes';
  import OtpLogin from '@strixun/otp-login/svelte/OtpLogin.svelte';
  import type { LoginSuccessData } from '@strixun/otp-login';
  import { animate } from '../core/animations';
  
  // Track if login form is shown (vs landing screen)
  let showLoginForm = false;
  
  // Track if we're handling login - prevents reactive statement from double-navigating
  let isHandlingLogin = false;
  
  /**
   * Get OTP Auth API URL
   * Priority: localhost check > VITE_AUTH_API_URL (for E2E tests) > window.getOtpAuthApiUrl() > fallback
   */
  function getOtpAuthApiUrl(): string {
    // CRITICAL: Check localhost FIRST - NEVER call window.getOtpAuthApiUrl() on localhost
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      import.meta.env?.DEV ||
      import.meta.env?.MODE === 'development'
    );
    
    if (isLocalhost) {
      // Use Vite proxy to avoid CORS/cookie issues
      return '/auth-api';
    }
    
    // Priority 1: VITE_AUTH_API_URL (for E2E tests)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
      const viteUrl = import.meta.env.VITE_AUTH_API_URL;
      if (viteUrl && typeof viteUrl === 'string' && viteUrl.length > 0) {
        return viteUrl;
      }
    }
    
    // Priority 2: window.getOtpAuthApiUrl() (from config.js)
    if (typeof window !== 'undefined' && (window as any).getOtpAuthApiUrl) {
      const url = (window as any).getOtpAuthApiUrl();
      if (url) {
        return url;
      }
    }
    
    // Fallback to production
    return 'https://auth.idling.app';
  }
  
  /**
   * Handle successful login
   * Navigates to redirect URL or default dashboard
   */
  async function handleLoginSuccess(data: LoginSuccessData): Promise<void> {
    try {
      // Set flag to prevent reactive statement from double-navigating
      isHandlingLogin = true;
      
      // Get redirect URL BEFORE processing login (while we're still on /login)
      const redirectUrl = getRedirectUrl();
      const destination = redirectUrl || DEFAULT_AUTHENTICATED_ROUTE;
      
      // Process login with token
      await login(data.token);
      
      showToast({ message: 'Login successful! Welcome back.', type: 'success' });
      
      console.log('[Login] Success, navigating to:', destination);
      
      // Small delay to ensure auth state propagates, then navigate
      setTimeout(() => {
        navigate(destination, { replace: true });
      }, 100);
    } catch (error) {
      isHandlingLogin = false;
      console.error('[Login] Login processing failed:', error);
      showToast({ 
        message: 'Login failed. Please try again.', 
        type: 'error' 
      });
    }
  }
  
  /**
   * Handle login error
   */
  function handleLoginError(error: string): void {
    console.error('[Login] Error:', error);
    // Error is displayed by OtpLogin component
  }
  
  /**
   * Show the login form
   */
  function handleShowLoginForm(): void {
    showLoginForm = true;
  }
  
  /**
   * Hide the login form (back to landing)
   */
  function handleHideLoginForm(): void {
    showLoginForm = false;
  }
  
  // Check if we're actually on the login page (safety check)
  function isOnLoginPage(): boolean {
    return window.location.hash === '#/login' || 
           window.location.hash.startsWith('#/login?') ||
           window.location.hash === '' ||
           window.location.hash === '#' ||
           window.location.hash === '#/';
  }
  
  // Check if already authenticated on mount
  onMount(() => {
    // Only redirect if we're actually on the login page
    if (!isOnLoginPage()) {
      console.log('[Login] Not on login page, skipping redirect check');
      return;
    }
    
    // If auth check complete and authenticated, redirect immediately
    if ($authCheckComplete && $isAuthenticated) {
      const redirectUrl = getRedirectUrl();
      const destination = redirectUrl || DEFAULT_AUTHENTICATED_ROUTE;
      console.log('[Login] Already authenticated, redirecting to:', destination);
      navigate(destination, { replace: true });
    }
  });
  
  // Watch for auth state changes (SSO restore case)
  // Skip if we're already handling a login (handleLoginSuccess will navigate)
  // CRITICAL: Only redirect if actually on login page to prevent hijacking other routes
  $: if ($authCheckComplete && $isAuthenticated && !isHandlingLogin && isOnLoginPage()) {
    const redirectUrl = getRedirectUrl();
    const destination = redirectUrl || DEFAULT_AUTHENTICATED_ROUTE;
    navigate(destination, { replace: true });
  }
</script>

<div 
  class="login-page"
  use:animate={{
    preset: 'fadeIn',
    duration: 300,
    trigger: 'mount'
  }}
>
  {#if !showLoginForm}
    <!-- Landing Screen -->
    <div class="login-page__landing">
      <div class="login-page__content">
        <div class="login-page__icon">★</div>
        <h1 class="login-page__title">Strixun's Stream Suite</h1>
        <p class="login-page__description">
          Your comprehensive OBS Studio toolkit for animations, layouts, 
          text cycling, and Twitch integration.
        </p>
        <p class="login-page__subtext">
          Sign in with your email to access all features.
        </p>
        <button 
          type="button"
          class="login-page__button"
          on:click={handleShowLoginForm}
        >
          Sign In with Email
        </button>
        <p class="login-page__info-link">
          <a 
            href="https://auth.idling.app" 
            target="_blank" 
            rel="noopener noreferrer"
            class="login-page__link"
          >
            Learn more about authentication
          </a>
        </p>
      </div>
    </div>
  {:else}
    <!-- Login Form -->
    <div class="login-page__form-container">
      <button 
        type="button" 
        class="login-page__back-btn"
        on:click={handleHideLoginForm}
      >
        ← Back
      </button>
      <OtpLogin
        apiUrl={getOtpAuthApiUrl()}
        onSuccess={handleLoginSuccess}
        onError={handleLoginError}
        showAsModal={false}
        title="Sign In"
        subtitle="Enter your email to receive a verification code"
      />
    </div>
  {/if}
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  @use '@styles/mixins' as *;
  
  .login-page {
    position: relative;
    min-height: 100vh;
    background: var(--bg-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text);
    font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    @include gpu-accelerated;
  }
  
  .login-page__landing {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 40px 20px;
  }
  
  .login-page__content {
    text-align: center;
    max-width: 650px;
    padding: 40px;
    @include gpu-accelerated;
    z-index: 1;
  }
  
  .login-page__icon {
    font-size: 4em;
    margin-bottom: 24px;
    color: var(--accent);
    animation: pulse 2s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.9; }
  }
  
  .login-page__title {
    font-size: 2.5em;
    margin: 0 0 20px 0;
    color: var(--text);
    font-weight: 700;
    letter-spacing: -0.5px;
  }
  
  .login-page__description {
    font-size: 1.2em;
    margin: 0 0 16px 0;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  
  .login-page__subtext {
    font-size: 1em;
    margin: 0 0 40px 0;
    color: var(--muted);
    line-height: 1.5;
  }
  
  .login-page__button {
    padding: 16px 40px;
    font-size: 1.1em;
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
    @include gpu-accelerated;
    
    &:hover {
      background: var(--accent-dark);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    &:active {
      transform: translateY(0);
    }
    
    &:focus {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }
  
  .login-page__info-link {
    margin: 24px 0 0 0;
    font-size: 0.9em;
  }
  
  .login-page__link {
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.2s ease;
    border-bottom: 1px solid transparent;
    
    &:hover {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
    
    &:focus {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      border-radius: 2px;
    }
  }
  
  .login-page__form-container {
    width: 100%;
    max-width: 500px;
    padding: 20px;
    position: relative;
  }
  
  .login-page__back-btn {
    position: absolute;
    top: 0;
    left: 20px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.9em;
    padding: 8px 12px;
    border-radius: 4px;
    transition: all 0.2s ease;
    
    &:hover {
      background: var(--card);
      color: var(--text);
    }
    
    &:focus {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }
</style>
