<script lang="ts">
  import { apiClient } from '$lib/api-client';
  import type { LoginSuccessData } from '../../../../../shared-components/otp-login/core';
  import OtpLogin from '../../../../../shared-components/otp-login/svelte/OtpLogin.svelte';

  // Get API URL - dashboard uses relative URLs via Vite proxy
  // In production, this would be the same origin
  // Compute once at component initialization
  const apiUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function handleLoginSuccess(data: LoginSuccessData) {
    console.log('[Login] Login successful:', data);
    
    // Store token in apiClient
    apiClient.setToken(data.token);
    
    // Dispatch login event for App.svelte
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
