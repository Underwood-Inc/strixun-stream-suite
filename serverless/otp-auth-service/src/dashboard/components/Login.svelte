<script lang="ts">
  import { apiClient } from '$lib/api-client';
  import type { LoginSuccessData } from '@strixun/otp-login';
  import OtpLogin from '@strixun/otp-login/svelte/OtpLogin.svelte';

  // Get API URL - dashboard uses production worker in dev for testing real workflow
  // In production, this would be the same origin
  function getApiUrl(): string {
    if (typeof window === 'undefined') return '';
    
    // In development, use production worker to test real workflow
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isDev) {
      // Allow override via window.OTP_AUTH_API_URL for testing
      if ((window as any).OTP_AUTH_API_URL) {
        return (window as any).OTP_AUTH_API_URL;
      }
      // Use custom domain in dev for real workflow testing
      return 'https://auth.idling.app';
    }
    
    // Production: use same origin
    return window.location.origin;
  }
  
  const apiUrl = getApiUrl();
  
  import { getOtpEncryptionKey as getKey } from '@shared-config/otp-encryption';
  
  /**
   * Get OTP encryption key from centralized config
   */
  function getOtpEncryptionKey(): string | undefined {
    return getKey();
  }

  let showNoAccountError = false;
  let noAccountError: string | null = null;

  async function handleLoginSuccess(data: LoginSuccessData) {
    console.log('[Login] Login successful:', data);
    
    // Store token in apiClient
    apiClient.setToken(data.token);
    
    // Try to load customer data to check if they have an account
    try {
      const customer = await apiClient.getCustomer();
      if (customer) {
        // Customer exists, proceed with login
        window.dispatchEvent(new CustomEvent('auth:login', {
          detail: { 
            user: {
              userId: data.userId,
              email: data.email,
              token: data.token,
            }
          }
        }));
        return;
      }
    } catch (error: any) {
      // Check if error is "no customer account"
      const errorMessage = error?.message || error?.toString() || '';
      const errorCode = error?.code || '';
      
      if (errorCode === 'AUTHENTICATION_REQUIRED' || 
          errorMessage.includes('No customer account') || 
          errorMessage.includes('customer account found') ||
          errorMessage.includes('Please sign up')) {
        // No customer account - show visible error and prompt to sign up
        console.log('[Login] No customer account found, showing error and prompting signup');
        noAccountError = 'No customer account found for your email. You need to create a customer account to access the dashboard.';
        showNoAccountError = true;
        
        // Wait 2 seconds to show the error, then switch to signup
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('auth:no-customer-account', {
            detail: { 
              email: data.email,
              message: 'You need to create a customer account first. Would you like to sign up?'
            }
          }));
        }, 2000);
        return;
      }
      
      // Other error - still try to proceed (might be temporary)
      console.warn('[Login] Customer lookup failed, but proceeding:', error);
    }
    
    // Default: proceed with login even if customer lookup failed
    window.dispatchEvent(new CustomEvent('auth:login', {
      detail: { 
        user: {
          userId: data.userId,
          email: data.email,
          token: data.token,
        }
      }
    }));
  }

  function handleLoginError(error: string) {
    // Error is already displayed by the component
    console.error('[Login] Login error:', error);
    
    // Check if error indicates no customer account
    if (error.includes('No customer account') || 
        error.includes('customer account found') ||
        error.includes('Please sign up')) {
      // Show visible error and prompt to sign up
      noAccountError = error;
      showNoAccountError = true;
      
      // Wait 2 seconds to show the error, then switch to signup
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('auth:no-customer-account', {
          detail: { 
            message: error
          }
        }));
      }, 2000);
    }
  }

  console.log('[Login] Initialized with API URL:', apiUrl);
</script>

<div class="login-wrapper">
  <div class="login-content">
    {#if showNoAccountError && noAccountError}
      <div class="login-error-banner">
        <div class="login-error-icon">[WARNING]</div>
        <div class="login-error-content">
          <strong>Account Required</strong>
          <p>{noAccountError}</p>
          <p class="login-error-action">Redirecting to signup...</p>
        </div>
      </div>
    {/if}
    
    <OtpLogin
      {apiUrl}
      onSuccess={handleLoginSuccess}
      onError={handleLoginError}
      otpEncryptionKey={getOtpEncryptionKey()}
      customHeaders={{ 'X-Dashboard-Request': 'true' }}
      title="Developer Dashboard"
      subtitle="Sign in with your email to access your dashboard"
    />
    <p class="login-footer">
      Don't have an account? 
      <button type="button" class="login-link" onclick={() => window.dispatchEvent(new CustomEvent('auth:show-signup'))}>
        Sign up
      </button>
    </p>
  </div>
</div>

<style>
  .login-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--spacing-xl);
  }

  .login-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 400px;
  }

  .login-wrapper :global(.otp-login) {
    min-height: auto !important;
    padding: 0 !important;
    width: 100%;
  }

  .login-wrapper :global(.otp-login-container) {
    width: 100%;
  }

  .login-footer {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-top: var(--spacing-xl);
    padding: 0;
    width: 100%;
  }

  .login-link {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    text-decoration: underline;
    font-size: inherit;
    padding: 0;
    margin-left: var(--spacing-xs);
    
    &:hover {
      color: var(--accent-dark);
    }
  }

  .login-error-banner {
    background: var(--card);
    border: 2px solid var(--warning);
    border-left: 6px solid var(--warning);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
    width: 100%;
    max-width: 400px;
    display: flex;
    gap: var(--spacing-md);
    animation: slide-down 0.3s ease-out;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .login-error-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .login-error-content {
    flex: 1;
  }

  .login-error-content strong {
    display: block;
    color: var(--warning);
    font-size: 1rem;
    margin-bottom: var(--spacing-xs);
  }

  .login-error-content p {
    color: var(--text);
    font-size: 0.875rem;
    margin: var(--spacing-xs) 0;
    line-height: 1.5;
  }

  .login-error-action {
    color: var(--text-secondary);
    font-style: italic;
    margin-top: var(--spacing-sm);
  }

  @keyframes slide-down {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>

