<script lang="ts">
  /**
   * Login Modal Component
   * 
   * Wrapper around shared OTP Login component for modal display
   */
  
  import { setAuth } from '../../../stores/auth';
  import { showToast } from '../../../stores/toast-queue';
  import OtpLogin from '../../../../shared-components/otp-login/svelte/OtpLogin.svelte';
  import type { LoginSuccessData } from '../../../../shared-components/otp-login/core';
  
  export let onClose: () => void;
  
  /**
   * Get OTP Auth API URL
   */
  function getOtpAuthApiUrl(): string {
    if (typeof window !== 'undefined' && (window as any).getOtpAuthApiUrl) {
      return (window as any).getOtpAuthApiUrl() || '';
    }
    // Fallback to workers.dev URL if function doesn't exist (more reliable than custom domain)
    return 'https://otp-auth-service.strixuns-script-suite.workers.dev';
  }
  
  function handleLoginSuccess(data: LoginSuccessData) {
    // Set authentication - support both old format and OAuth 2.0 format
    setAuth({
      userId: data.userId,
      email: data.email,
      token: data.token,
      expiresAt: data.expiresAt,
    });
    
    showToast({ message: 'Login successful', type: 'success' });
    onClose();
  }
  
  function handleLoginError(error: string) {
    // Error is already displayed by the component
    console.error('Login error:', error);
  }
</script>

<!-- Let OtpLogin handle its own modal rendering when showAsModal={true} -->
<OtpLogin
  apiUrl={getOtpAuthApiUrl()}
  onSuccess={handleLoginSuccess}
  onError={handleLoginError}
  showAsModal={true}
  onClose={onClose}
  title="Sign In"
  subtitle="Enter your email to receive a verification code"
/>
