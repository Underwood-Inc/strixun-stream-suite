<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api-client';
  import UrlManager from './pages/UrlManager.svelte';
  import { OtpLoginCore } from '@strixun/otp-login';
  import type { OtpLoginState, LoginSuccessData } from '@strixun/otp-login';
  import { getOtpEncryptionKey as getKey } from '../../../../shared-config/otp-encryption';

  let isAuthenticated = false;
  let userDisplayName: string | null = null;
  let loading = true;
  let loginState: OtpLoginState = {
    step: 'email',
    email: '',
    otp: '',
    loading: false,
    error: null,
    countdown: 0,
    rateLimitResetAt: null,
    rateLimitCountdown: 0,
  };
  let core: OtpLoginCore | null = null;

  function getApiUrl(): string {
    if (typeof window === 'undefined') return '';
    return 'https://auth.idling.app';
  }

  function getOtpEncryptionKey(): string | undefined {
    return getKey();
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
        const data = await response.json();
        return data.displayName || null;
      }
    } catch (error) {
      console.error('[URL Shortener] Failed to fetch display name:', error);
    }
    return null;
  }

  async function handleLoginSuccess(data: LoginSuccessData): Promise<void> {
    const token = data.access_token || data.token;
    
    if (!token) {
      console.error('[URL Shortener] No token in login response');
      return;
    }
    
    apiClient.setToken(token);
    const displayName = await fetchUserDisplayName(token);
    
    isAuthenticated = true;
    userDisplayName = displayName;
  }

  function handleLoginError(error: string): void {
    console.error('Login error:', error);
  }

  onMount(async () => {
    const token = apiClient.getToken();
    
    if (token) {
      const displayName = await fetchUserDisplayName(token);
      if (displayName) {
        isAuthenticated = true;
        userDisplayName = displayName;
      }
    }
    
    const encryptionKey = getOtpEncryptionKey();
    if (encryptionKey) {
      core = new OtpLoginCore({
        apiUrl: getApiUrl(),
        onSuccess: handleLoginSuccess,
        onError: handleLoginError,
        otpEncryptionKey: encryptionKey,
      });
      
      core.subscribe((state) => {
        loginState = state;
      });
    }
    
    loading = false;
  });

  function handleEmailChange(e: Event) {
    const target = e.target as HTMLInputElement;
    core?.setEmail(target.value);
  }

  function handleOtpChange(e: Event) {
    const target = e.target as HTMLInputElement;
    core?.setOtp(target.value);
  }

  function handleRequestOtp() {
    core?.requestOtp();
  }

  function handleVerifyOtp() {
    core?.verifyOtp();
  }

  function handleGoBack() {
    core?.goBack();
  }

  function handleKeyPress(e: KeyboardEvent, handler: () => void) {
    if (e.key === 'Enter' && !loginState.loading) {
      handler();
    }
  }

  function handleLogout(): void {
    apiClient.logout();
    isAuthenticated = false;
    userDisplayName = null;
  }
</script>

<div class="app-container">
  {#if loading}
    <div class="loading">
      <div class="loading__spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if !isAuthenticated}
    <div class="auth-container">
      <div class="auth-header">
        <h1>URL Shortener</h1>
        <p>Strixun Stream Suite - Create and manage short URLs with secure OTP authentication</p>
      </div>
      <div class="login-form">
        {#if loginState.error}
          <div class="error-message" role="alert">
            {loginState.error}
          </div>
        {/if}
        
        {#if loginState.step === 'email'}
          <form onsubmit|preventDefault={handleRequestOtp}>
            <div class="form-group">
              <label for="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={loginState.email}
                oninput={handleEmailChange}
                onkeypress={(e) => handleKeyPress(e, handleRequestOtp)}
                placeholder="your@email.com"
                disabled={loginState.loading}
                required
                autocomplete="email"
              />
            </div>
            <button type="submit" disabled={loginState.loading}>
              {loginState.loading ? 'Sending...' : 'Send OTP Code'}
            </button>
          </form>
        {:else}
          <form onsubmit|preventDefault={handleVerifyOtp}>
            <div class="form-group">
              <label for="otp">9-Digit OTP Code</label>
              <input
                type="text"
                id="otp"
                value={loginState.otp}
                oninput={handleOtpChange}
                onkeypress={(e) => handleKeyPress(e, handleVerifyOtp)}
                placeholder="123456789"
                disabled={loginState.loading}
                required
                autocomplete="one-time-code"
                inputmode="numeric"
                pattern="[0-9]{9}"
                maxlength="9"
              />
              <p class="otp-hint">Check your email ({loginState.email}) for the code</p>
            </div>
            <div class="button-group">
              <button type="button" onclick={handleGoBack} disabled={loginState.loading}>
                Back
              </button>
              <button type="submit" disabled={loginState.loading}>
                {loginState.loading ? 'Verifying...' : 'Verify & Login'}
              </button>
            </div>
          </form>
        {/if}
      </div>
    </div>
  {:else}
    <UrlManager {userDisplayName} on:logout={handleLogout} />
  {/if}
</div>

<style>
  .app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: var(--text-secondary);
  }

  .loading__spinner {
    display: inline-block;
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: var(--spacing-md);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .auth-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--spacing-xl);
  }

  .auth-header {
    text-align: center;
    margin-bottom: var(--spacing-2xl);
  }

  .auth-header h1 {
    font-size: 2.5rem;
    font-weight: 600;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
    text-shadow: 0 2px 4px rgba(237, 174, 73, 0.3);
  }

  .auth-header p {
    color: var(--text-secondary);
    font-size: 1.1rem;
  }

  .login-form {
    max-width: 400px;
    width: 100%;
  }

  .error-message {
    background: var(--error);
    color: var(--text);
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-lg);
    text-align: center;
  }

  .form-group {
    margin-bottom: var(--spacing-lg);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-sm);
    color: var(--text-secondary);
    font-weight: 500;
  }

  .form-group input {
    width: 100%;
    padding: var(--spacing-md);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: 1rem;
    box-sizing: border-box;
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .otp-hint {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--muted);
  }

  .login-form button[type="submit"] {
    width: 100%;
    padding: var(--spacing-md);
    background: var(--accent);
    border: 3px solid var(--accent-dark);
    border-radius: 0;
    color: #000;
    font-weight: 700;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.1s;
    box-shadow: 0 4px 0 var(--accent-dark);
  }

  .login-form button[type="submit"]:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 var(--accent-dark);
  }

  .login-form button[type="submit"]:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .button-group {
    display: flex;
    gap: var(--spacing-md);
  }

  .button-group button {
    flex: 1;
    padding: var(--spacing-md);
    border-radius: 0;
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.1s;
  }

  .button-group button[type="button"] {
    background: transparent;
    border: 2px solid var(--border);
    color: var(--text);
  }

  .button-group button[type="button"]:hover:not(:disabled) {
    background: var(--bg-secondary);
  }

  .button-group button[type="submit"] {
    background: var(--accent);
    border: 3px solid var(--accent-dark);
    color: #000;
    font-weight: 700;
    box-shadow: 0 4px 0 var(--accent-dark);
  }

  .button-group button[type="submit"]:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 var(--accent-dark);
  }

  .button-group button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
</style>

