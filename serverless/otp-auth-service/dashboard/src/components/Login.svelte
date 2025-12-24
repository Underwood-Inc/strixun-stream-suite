<script lang="ts">
  import { apiClient } from '$lib/api-client';
  import type { LoginSuccessData } from '../../../../../shared-components/otp-login/core';
  import OtpLogin from '../../../../../shared-components/otp-login/svelte/OtpLogin.svelte';

  function handleLoginSuccess(data: LoginSuccessData) {
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

  // Get API URL - dashboard uses relative URLs via Vite proxy
  // In production, this would be the same origin
  function getApiUrl(): string {
    // Use current origin (works with Vite proxy in dev)
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
</script>

<OtpLogin
  apiUrl={getApiUrl()}
  onSuccess={handleLoginSuccess}
  title="Developer Dashboard"
  subtitle="Sign in with your email to access your dashboard"
/>
