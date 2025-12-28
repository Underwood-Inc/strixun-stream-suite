<script lang="ts">
  /**
   * OTP Login Component - Svelte Wrapper
   * 
   * Reusable email OTP authentication component for Svelte
   */
  
  import { onDestroy, onMount } from 'svelte';
  import type { OtpLoginState } from '../core';
  import { OtpLoginCore, type LoginSuccessData, type OtpLoginConfig } from '../core';
  import { getOtpEncryptionKey } from '../../../shared-config/otp-encryption';
  import EmailForm from './components/EmailForm.svelte';
  import ErrorDisplay from './components/ErrorDisplay.svelte';
  import OtpForm from './components/OtpForm.svelte';

  export let apiUrl: string;
  export let onSuccess: (data: LoginSuccessData) => void;
  export let onError: ((error: string) => void) | undefined = undefined;
  export let endpoints: OtpLoginConfig['endpoints'] | undefined = undefined;
  export let customHeaders: OtpLoginConfig['customHeaders'] | undefined = undefined;
  export let otpEncryptionKey: string | undefined = undefined; // CRITICAL: OTP encryption key for encrypting requests
  export let title: string = 'Sign In';
  export let subtitle: string = 'Enter your email to receive a verification code';
  export let showAsModal: boolean = false;
  export let onClose: (() => void) | undefined = undefined;

  let core: OtpLoginCore;
  let state: OtpLoginState = {
    step: 'email',
    email: '',
    otp: '',
    loading: false,
    error: null,
    countdown: 0,
    rateLimitResetAt: null,
    rateLimitCountdown: 0,
  };

  // Store unsubscribe function for cleanup
  let unsubscribe: (() => void) | null = null;

  onMount(async () => {
    console.log('[OtpLogin] onMount - showAsModal:', showAsModal);
    
    // CRITICAL: Get encryption key - use prop if provided, otherwise use centralized config
    // This ensures we always use VITE_SERVICE_ENCRYPTION_KEY consistently across the codebase
    const encryptionKey = otpEncryptionKey || getOtpEncryptionKey();
    
    // CRITICAL: Verify encryption key is provided
    if (!encryptionKey) {
      console.error('[OtpLogin] [ERROR] CRITICAL ERROR: otpEncryptionKey is missing!');
      console.error('[OtpLogin] This will cause encryption to fail. Key status:', {
        hasKey: !!encryptionKey,
        keyType: typeof encryptionKey,
        keyLength: encryptionKey?.length || 0,
        apiUrl: apiUrl,
        usingCentralizedConfig: !otpEncryptionKey
      });
      if (onError) {
        onError('OTP encryption key is required. Please configure VITE_SERVICE_ENCRYPTION_KEY in your build environment.');
      }
      return;
    }
    
    if (encryptionKey.length < 32) {
      console.error('[OtpLogin] [ERROR] CRITICAL ERROR: otpEncryptionKey is too short!', {
        keyLength: encryptionKey.length,
        requiredLength: 32
      });
      if (onError) {
        onError('OTP encryption key must be at least 32 characters long.');
      }
      return;
    }
    
    console.log('[OtpLogin] [SUCCESS] Encryption key provided, length:', encryptionKey.length, otpEncryptionKey ? '(from prop)' : '(from VITE_SERVICE_ENCRYPTION_KEY)');
    
    try {
      core = new OtpLoginCore({
        apiUrl,
        onSuccess,
        onError,
        endpoints,
        customHeaders,
        otpEncryptionKey: encryptionKey, // CRITICAL: Pass encryption key for encrypting OTP requests
      });

      // Subscribe to state changes
      unsubscribe = core.subscribe((newState) => {
        state = newState;
      });
      
      console.log('[OtpLogin] Initialization complete');
    } catch (error) {
      console.error('[OtpLogin] Failed to initialize:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to initialize login');
    }
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    if (core) {
      core.destroy();
    }
  });

  function handleEmailChange(e: Event) {
    if (!core) return;
    const target = e.target as HTMLInputElement;
    core.setEmail(target.value);
  }

  function handleOtpChange(e: Event) {
    if (!core) return;
    const target = e.target as HTMLInputElement;
    core.setOtp(target.value);
  }

  function handleRequestOtp() {
    if (!core) return;
    core.requestOtp();
  }

  function handleVerifyOtp() {
    if (!core) return;
    core.verifyOtp();
  }

  function handleGoBack() {
    if (!core) return;
    core.goBack();
  }

  function handleClose(e: Event) {
    e.stopPropagation();
    if (onClose) {
      onClose();
    }
  }

  function handleKeyPress(e: KeyboardEvent, handler: () => void) {
    if (e.key === 'Enter' && !state.loading) {
      handler();
    }
  }
</script>

{#if showAsModal}
  <!-- Modal rendered inline with fixed positioning to escape parent containers -->
  <div 
    class="otp-login-modal-overlay" 
    onclick={() => onClose?.()} 
    role="button" 
    tabindex="0" 
    onkeydown={(e) => e.key === 'Escape' && onClose?.()}
  >
    <div class="otp-login-modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-labelledby="otp-login-title" tabindex="-1">
      <div class="otp-login-header">
        <h2 id="otp-login-title">{title}</h2>
        {#if onClose}
          <button 
            type="button"
            class="otp-login-close" 
            onclick={handleClose} 
            aria-label="Close"
          >×</button>
        {/if}
      </div>
      <div class="otp-login-content">
        <ErrorDisplay {state} />
        {#if state.step === 'email'}
          <EmailForm 
            {state}
            onEmailChange={handleEmailChange}
            onRequestOtp={handleRequestOtp}
            onKeyPress={handleKeyPress}
          />
        {:else}
          <OtpForm 
            {state}
            onOtpChange={handleOtpChange}
            onVerifyOtp={handleVerifyOtp}
            onGoBack={handleGoBack}
            onKeyPress={handleKeyPress}
          />
        {/if}
      </div>
    </div>
  </div>
{:else}
  <div class="otp-login">
    <div class="otp-login-container">
      <div class="otp-login-header">
        <h1 class="otp-login-title">{title}</h1>
        <p class="otp-login-subtitle">{subtitle}</p>
      </div>
      <ErrorDisplay {state} />
      {#if state.step === 'email'}
        <EmailForm 
          {state}
          onEmailChange={handleEmailChange}
          onRequestOtp={handleRequestOtp}
          onKeyPress={handleKeyPress}
        />
      {:else}
        <OtpForm 
          {state}
          onOtpChange={handleOtpChange}
          onVerifyOtp={handleVerifyOtp}
          onGoBack={handleGoBack}
          onKeyPress={handleKeyPress}
        />
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  @use '../../../shared-styles/animations' as *;
  @use '../../../shared-styles/mixins' as *;

  /* Standalone Login Form */
  .otp-login {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--spacing-xl);
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .otp-login-container {
    max-width: 400px;
    width: 100%;
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .otp-login-header {
    text-align: center;
    margin-bottom: var(--spacing-2xl);
  }

  .otp-login-title {
    font-size: 2rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
  }

  .otp-login-subtitle {
    color: var(--text-secondary);
  }

  /* Modal Variant */
  .otp-login-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000000; /* Must be higher than auth screen (999999) */
    animation: fade-in 0.3s ease-out;
    pointer-events: auto;
  }

  .otp-login-modal {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 90%;
    max-width: min(90vw, 500px);
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    @include gpu-accelerated;
  }

  .otp-login-modal .otp-login-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0;
    text-align: left;
  }

  .otp-login-modal h2 {
    margin: 0;
    font-size: 24px;
    color: var(--text);
  }

  .otp-login-close {
    background: none;
    border: none;
    font-size: 32px;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
    position: relative;
    z-index: 10;
    pointer-events: auto;
    
    &:hover {
      background: var(--bg-secondary);
      color: var(--text);
    }
    
    &:active {
      transform: scale(0.95);
    }
  }

  .otp-login-modal .otp-login-content {
    padding: 24px;
  }
</style>
