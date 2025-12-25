<script lang="ts">
  /**
   * OTP Login Component - Svelte Wrapper
   * 
   * Reusable email OTP authentication component for Svelte
   */
  
  import { onDestroy, onMount, tick } from 'svelte';
  import type { OtpLoginState } from '../core';
  import { OtpLoginCore, type LoginSuccessData, type OtpLoginConfig } from '../core';
  import EmailForm from './components/EmailForm.svelte';
  import ErrorDisplay from './components/ErrorDisplay.svelte';
  import OtpForm from './components/OtpForm.svelte';
  import { generatePortalId, portal } from './utils';

  export let apiUrl: string;
  export let onSuccess: (data: LoginSuccessData) => void;
  export let onError: ((error: string) => void) | undefined = undefined;
  export let endpoints: OtpLoginConfig['endpoints'] | undefined = undefined;
  export let customHeaders: OtpLoginConfig['customHeaders'] | undefined = undefined;
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

  // Portal rendering for modal
  let portalContainer: HTMLDivElement | null = null;
  let portalContainerId: string = '';
  
  // Store unsubscribe function for cleanup
  let unsubscribe: (() => void) | null = null;

  onMount(async () => {
    core = new OtpLoginCore({
      apiUrl,
      onSuccess,
      onError,
      endpoints,
      customHeaders,
    });

    // Subscribe to state changes
    unsubscribe = core.subscribe((newState) => {
      state = newState;
    });

    // Setup portal for modal rendering
    if (showAsModal) {
      await tick();
      
      // Generate unique ID for this instance
      portalContainerId = generatePortalId();
      
      // Create portal container at body level
      portalContainer = document.createElement('div');
      portalContainer.id = portalContainerId;
      portalContainer.style.position = 'fixed';
      portalContainer.style.top = '0';
      portalContainer.style.left = '0';
      portalContainer.style.width = '0';
      portalContainer.style.height = '0';
      portalContainer.style.pointerEvents = 'none';
      portalContainer.style.zIndex = '1000000'; // Must be higher than auth screen (999999)
      document.body.appendChild(portalContainer);
    }
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
    if (core) {
      core.destroy();
    }
    
    // Clean up portal container
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });

  function handleEmailChange(e: Event) {
    const target = e.target as HTMLInputElement;
    core.setEmail(target.value);
  }

  function handleOtpChange(e: Event) {
    const target = e.target as HTMLInputElement;
    core.setOtp(target.value);
  }

  function handleRequestOtp() {
    core.requestOtp();
  }

  function handleVerifyOtp() {
    core.verifyOtp();
  }

  function handleGoBack() {
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

{#if showAsModal && portalContainer}
  <div 
    class="otp-login-modal-overlay" 
    onclick={onClose} 
    role="button" 
    tabindex="0" 
    onkeydown={(e) => e.key === 'Escape' && onClose?.()}
    use:portal={portalContainer}
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
  }

  .otp-login-modal {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 90%;
    max-width: 400px;
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
