<script lang="ts">
  import { onMount } from 'svelte';
  import { apiClient } from '$lib/api-client';
  import type { LoginSuccessData } from '@shared-components/otp-login/core';
  import OtpLogin from '@shared-components/otp-login/svelte/OtpLogin.svelte';
  import UrlManager from './pages/UrlManager.svelte';

  let isAuthenticated = false;
  let userEmail: string | null = null;
  let loading = true;

  function getApiUrl(): string {
    if (typeof window === 'undefined') return '';
    // Use OTP auth service URL (same as main app)
    return 'https://auth.idling.app';
  }

  function getOtpEncryptionKey(): string | undefined {
    if (typeof window !== 'undefined' && (window as any).getOtpEncryptionKey) {
      return (window as any).getOtpEncryptionKey();
    }
    return undefined;
  }

  onMount(() => {
    // Check for stored token
    const token = apiClient.getToken();
    const storedEmail = typeof window !== 'undefined' 
      ? localStorage.getItem('urlShortenerEmail') 
      : null;
    
    if (token && storedEmail) {
      isAuthenticated = true;
      userEmail = storedEmail;
    }
    
    loading = false;
  });

  function handleLoginSuccess(data: LoginSuccessData): void {
    const token = data.access_token || data.token;
    const email = data.email;
    
    apiClient.setToken(token || null);
    if (typeof window !== 'undefined' && email) {
      localStorage.setItem('urlShortenerEmail', email);
    }
    
    isAuthenticated = true;
    userEmail = email;
  }

  function handleLoginError(error: string): void {
    console.error('Login error:', error);
  }

  function handleLogout(): void {
    apiClient.logout();
    isAuthenticated = false;
    userEmail = null;
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
        <h1>🔗 URL Shortener</h1>
        <p>Strixun Stream Suite - Create and manage short URLs with secure OTP authentication</p>
      </div>
      <OtpLogin
        apiUrl={getApiUrl()}
        onSuccess={handleLoginSuccess}
        onError={handleLoginError}
        otpEncryptionKey={getOtpEncryptionKey()}
        title="Sign In"
        subtitle="Enter your email to receive a verification code"
      />
    </div>
  {:else}
    <UrlManager {userEmail} on:logout={handleLogout} />
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
</style>

