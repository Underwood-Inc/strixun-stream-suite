<script lang="ts">
  import { apiClient } from '$lib/api-client';
  import type { LoginSuccessData } from '@shared-components/otp-login/core';
  import OtpLogin from '@shared-components/otp-login/svelte/OtpLogin.svelte';

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
      // Use production worker in dev for real workflow testing
      return 'https://otp-auth-service.strixuns-script-suite.workers.dev';
    }
    
    // Production: use same origin
    return window.location.origin;
  }
  
  const apiUrl = getApiUrl();

  function handleLoginSuccess(data: LoginSuccessData) {
    console.log('[Login] Login successful:', data);
    
    // Store token in apiClient
    apiClient.setToken(data.token);
    
    // Dispatch login event for DashboardApp.svelte
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
  }

  console.log('[Login] Initialized with API URL:', apiUrl);
</script>

<OtpLogin
  {apiUrl}
  onSuccess={handleLoginSuccess}
  onError={handleLoginError}
  title="Developer Dashboard"
  subtitle="Sign in with your email to access your dashboard"
/>

