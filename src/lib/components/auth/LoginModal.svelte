<script lang="ts">
  /**
   * Login Modal Component
   * 
   * Wrapper around shared OTP Login component for modal display
   */
  
  import { onMount, onDestroy, tick } from 'svelte';
  import { setAuth } from '../../../stores/auth';
  import { showToast } from '../../../stores/toast-queue';
  import { animate } from '../../../core/animations';
  import OtpLogin from '../../../../shared-components/otp-login/svelte/OtpLogin.svelte';
  import type { LoginSuccessData } from '../../../../shared-components/otp-login/core';
  
  export let onClose: () => void;
  
  let portalContainer: HTMLDivElement | null = null;
  let modalOverlay: HTMLDivElement | null = null;
  
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
  
  onMount(async () => {
    // Wait for DOM to settle first
    await tick();
    
    // Create portal container at body level
    portalContainer = document.createElement('div');
    portalContainer.id = 'login-modal-portal';
    portalContainer.style.cssText = 'position: fixed; z-index: 1000000; pointer-events: none;';
    document.body.appendChild(portalContainer);
    
    // Move modal overlay to portal
    if (modalOverlay && portalContainer) {
      portalContainer.appendChild(modalOverlay);
      modalOverlay.style.pointerEvents = 'auto';
    }
  });
  
  onDestroy(() => {
    // Clean up portal container
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });
</script>

<div bind:this={modalOverlay} class="login-modal-overlay" on:click={onClose} role="button" tabindex="0" on:keydown={(e) => e.key === 'Escape' && onClose()}>
  <div 
    class="login-modal" 
    on:click|stopPropagation 
    use:animate={{
      preset: 'scaleIn',
      duration: 300,
      easing: 'easeOutBack',
      id: 'login-modal'
    }}
    role="dialog" 
    aria-labelledby="login-title"
  >
    <OtpLogin
      apiUrl={getOtpAuthApiUrl()}
      onSuccess={handleLoginSuccess}
      onError={handleLoginError}
      showAsModal={true}
      onClose={onClose}
      title="Sign In"
      subtitle="Enter your email to receive a verification code"
    />
  </div>
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  
  .login-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000000;
    animation: fade-in 0.3s ease-out;
  }
  
  .login-modal {
    background: transparent;
    border: none;
    border-radius: 0;
    width: 90%;
    max-width: 400px;
    max-height: 90vh;
    overflow: visible;
    box-shadow: none;
    @include gpu-accelerated;
  }
</style>
