<script lang="ts">
  /**
   * OTP Login Component - Svelte Wrapper
   * 
   * Reusable email OTP authentication component for Svelte
   */
  
  import { onDestroy, onMount, tick } from 'svelte';
  import type { OtpLoginState } from '../core';
  import { OtpLoginCore, type LoginSuccessData, type OtpLoginConfig } from '../core';
  import Tooltip from '../../tooltip/Tooltip.svelte';
  import { getErrorInfo, generateRateLimitTooltip } from '../../error-mapping/error-legend';

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
  };

  // Portal rendering for modal
  let portalContainer: HTMLDivElement | null = null;
  let portalContainerId: string = '';
  
  // Store unsubscribe function for cleanup
  let unsubscribe: (() => void) | null = null;
  
  // Generate unique portal container ID
  function generatePortalId(): string {
    const prefix = 'otp-login-modal-portal';
    const unique = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    return `${prefix}-${unique}`;
  }

  // Portal action to render modal at body level
  function portal(node: HTMLElement, target: HTMLElement) {
    target.appendChild(node);
    return {
      update(newTarget: HTMLElement) {
        if (newTarget !== target) {
          newTarget.appendChild(node);
          target = newTarget;
        }
      },
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }

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

  function formatCountdown(seconds: number): string {
    return OtpLoginCore.formatCountdown(seconds);
  }

  function formatRateLimitCountdown(seconds: number): string {
    return OtpLoginCore.formatRateLimitCountdown(seconds);
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
        {@render OtpLoginContent()}
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
      {@render OtpLoginContent()}
    </div>
  </div>
{/if}

<!-- Content Component -->
{#snippet OtpLoginContent()}
  {#if state.error}
    {@const errorInfo = getErrorInfo(state.errorCode || 'rate_limit_exceeded')}
    {@const resetTime = state.rateLimitResetAt ? new Date(state.rateLimitResetAt).toLocaleString(navigator.language || 'en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : null}
    {@const tooltipContent = generateRateLimitTooltip(errorInfo, state.errorDetails)}
    <div class="otp-login-error">
      <div class="otp-login-error-message">
        {state.error}
        {#if state.errorCode}
          <Tooltip content={tooltipContent} position="top">
            <span class="otp-login-error-info-icon" aria-label="Error details">ℹ️</span>
          </Tooltip>
        {/if}
      </div>
      {#if state.rateLimitCountdown > 0}
        <div class="otp-login-rate-limit-countdown">
          <span class="otp-login-countdown-icon">⏱️</span>
          <span class="otp-login-countdown-text">
            Try again in: <strong>{formatRateLimitCountdown(state.rateLimitCountdown)}</strong>
            {#if resetTime}
              <span class="otp-login-reset-time">(at {resetTime})</span>
            {/if}
          </span>
        </div>
      {/if}
    </div>
  {/if}

  {#if state.step === 'email'}
    <form class="otp-login-form" onsubmit={(e) => { e.preventDefault(); handleRequestOtp(); }}>
      <div class="otp-login-field">
        <label for="otp-login-email" class="otp-login-label">Email Address</label>
        <input
          type="email"
          id="otp-login-email"
          class="otp-login-input"
          required
          autocomplete="email"
          placeholder="your@email.com"
          value={state.email}
          disabled={state.loading}
          autofocus
          oninput={handleEmailChange}
          onkeydown={(e) => handleKeyPress(e, handleRequestOtp)}
        />
      </div>
      <button
        type="submit"
        class="otp-login-button otp-login-button--primary"
        disabled={state.loading || !state.email}
      >
        {state.loading ? 'Sending...' : 'Send OTP Code'}
      </button>
    </form>
  {:else}
    <form class="otp-login-form" novalidate onsubmit={(e) => { e.preventDefault(); handleVerifyOtp(); }}>
      <div class="otp-login-field">
        <label for="otp-login-otp" class="otp-login-label">6-Digit OTP Code</label>
        <input
          type="tel"
          id="otp-login-otp"
          class="otp-login-input otp-login-input--otp"
          required
          autocomplete="one-time-code"
          inputmode="numeric"
          maxlength="6"
          placeholder="123456"
          value={state.otp}
          disabled={state.loading}
          autofocus
          oninput={handleOtpChange}
          onkeydown={(e) => handleKeyPress(e, handleVerifyOtp)}
        />
        <p class="otp-login-hint">Check your email ({state.email}) for the code</p>
        {#if state.countdown > 0}
          <p class="otp-login-countdown">Code expires in: {formatCountdown(state.countdown)}</p>
        {:else if state.countdown === 0 && state.step === 'otp'}
          <p class="otp-login-countdown otp-login-countdown--expired">Code expired. Request a new one.</p>
        {/if}
      </div>
      <div class="otp-login-actions">
        <button
          type="button"
          class="otp-login-button otp-login-button--secondary"
          disabled={state.loading}
          onclick={handleGoBack}
        >
          Back
        </button>
        <button
          type="submit"
          class="otp-login-button otp-login-button--primary"
          disabled={state.loading || state.otp.length !== 6}
        >
          {state.loading ? 'Verifying...' : 'Verify & Login'}
        </button>
      </div>
    </form>
  {/if}
{/snippet}

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

  .otp-login-error {
    background: var(--card);
    border: 1px solid var(--danger);
    border-left: 4px solid var(--danger);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    color: var(--danger);
    margin-bottom: var(--spacing-lg);
    animation: slide-down 0.3s ease-out;
  }

  .otp-login-error-message {
    margin-bottom: var(--spacing-sm);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }
  
  .otp-login-error-info-icon {
    cursor: help;
    font-size: 1rem;
    opacity: 0.7;
    transition: opacity 0.2s;
    
    &:hover {
      opacity: 1;
    }
  }
  
  .otp-login-reset-time {
    font-size: 0.875rem;
    opacity: 0.8;
    margin-left: var(--spacing-xs);
  }

  .otp-login-rate-limit-countdown {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-md);
    padding-top: var(--spacing-md);
    border-top: 1px solid rgba(234, 43, 31, 0.2);
    color: var(--text);
    font-size: 0.875rem;
  }

  .otp-login-countdown-icon {
    font-size: 1.25rem;
    animation: pulse 2s ease-in-out infinite;
  }

  .otp-login-countdown-text {
    flex: 1;
  }

  .otp-login-countdown-text strong {
    color: var(--accent);
    font-weight: 600;
    font-family: monospace;
    font-size: 1rem;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
  }

  .otp-login-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .otp-login-field {
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
    pointer-events: auto;
  }

  .otp-login-label {
    display: block;
    margin-bottom: var(--spacing-sm);
    color: var(--text-secondary);
    font-size: 0.875rem;
    pointer-events: none;
  }

  .otp-login-input {
    @include input;
    width: 100%;
    padding: var(--spacing-md);
    font-size: 1rem;
    box-sizing: border-box;
    position: relative;
    z-index: 10000;
    pointer-events: auto;
    cursor: text;
    user-select: text;
    -webkit-user-select: text;
    -moz-user-select: text;
    touch-action: manipulation;
  }

  .otp-login-input--otp {
    font-size: 1.5rem;
    text-align: center;
    letter-spacing: 0.5rem;
    font-family: monospace;
  }

  .otp-login-hint {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--muted);
  }

  .otp-login-countdown {
    margin-top: var(--spacing-xs);
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-align: center;
  }

  .otp-login-countdown--expired {
    color: var(--warning);
  }

  .otp-login-actions {
    display: flex;
    gap: var(--spacing-md);
  }

  .otp-login-button {
    flex: 1;
    padding: var(--spacing-md);
    font-size: 0.875rem;
  }

  .otp-login-button--primary {
    @include arcade-button(var(--accent), var(--accent-dark));
  }

  .otp-login-button--secondary {
    @include arcade-button(var(--border), var(--border-light));
    background: transparent;
    color: var(--text);
    
    &:hover:not(:disabled) {
      background: var(--bg-dark);
      color: var(--text);
    }
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

