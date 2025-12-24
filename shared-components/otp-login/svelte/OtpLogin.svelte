<script lang="ts">
  /**
   * OTP Login Component - Svelte Wrapper
   * 
   * Reusable email OTP authentication component for Svelte
   */
  
  import { onMount, onDestroy } from 'svelte';
  import { OtpLoginCore, type OtpLoginConfig, type LoginSuccessData } from '../core';
  import type { OtpLoginState } from '../core';

  export let apiUrl: string;
  export let onSuccess: (data: LoginSuccessData) => void;
  export let onError: ((error: string) => void) | undefined = undefined;
  export let endpoints: OtpLoginConfig['endpoints'] | undefined = undefined;
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

  onMount(() => {
    core = new OtpLoginCore({
      apiUrl,
      onSuccess,
      onError,
      endpoints,
    });

    // Subscribe to state changes
    const unsubscribe = core.subscribe((newState) => {
      state = newState;
    });

    onDestroy(() => {
      unsubscribe();
      core.destroy();
    });
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

  function formatCountdown(seconds: number): string {
    return OtpLoginCore.formatCountdown(seconds);
  }

  function handleKeyPress(e: KeyboardEvent, handler: () => void) {
    if (e.key === 'Enter' && !state.loading) {
      handler();
    }
  }
</script>

{#if showAsModal}
  <div class="otp-login-modal-overlay" on:click={onClose} role="button" tabindex="0" on:keydown={(e) => e.key === 'Escape' && onClose?.()}>
    <div class="otp-login-modal" on:click|stopPropagation role="dialog" aria-labelledby="otp-login-title">
      <div class="otp-login-header">
        <h2 id="otp-login-title">{title}</h2>
        {#if onClose}
          <button class="otp-login-close" on:click={onClose} aria-label="Close">×</button>
        {/if}
      </div>
      <div class="otp-login-content">
        <OtpLoginContent />
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
      <OtpLoginContent />
    </div>
  </div>
{/if}

<!-- Content Component -->
{#snippet OtpLoginContent()}
  {#if state.error}
    <div class="otp-login-error">{state.error}</div>
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
          on:input={handleEmailChange}
          on:keydown={(e) => handleKeyPress(e, handleRequestOtp)}
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
    <form class="otp-login-form" onsubmit={(e) => { e.preventDefault(); handleVerifyOtp(); }}>
      <div class="otp-login-field">
        <label for="otp-login-otp" class="otp-login-label">6-Digit OTP Code</label>
        <input
          type="text"
          id="otp-login-otp"
          class="otp-login-input otp-login-input--otp"
          required
          autocomplete="one-time-code"
          inputmode="numeric"
          pattern="[0-9]{6}"
          maxlength="6"
          placeholder="123456"
          value={state.otp}
          disabled={state.loading}
          autofocus
          on:input={handleOtpChange}
          on:keydown={(e) => handleKeyPress(e, handleVerifyOtp)}
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
          on:click={handleGoBack}
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
  @use '../../shared-styles/animations' as *;
  @use '../../shared-styles/mixins' as *;

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
    pointer-events: auto !important;
    cursor: text !important;
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

    &--expired {
      color: var(--warning);
    }
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
    z-index: 1000000;
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

  .otp-login-modal .otp-login-title {
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
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
    
    &:hover {
      background: var(--bg-secondary);
      color: var(--text);
    }
  }

  .otp-login-modal .otp-login-content {
    padding: 24px;
  }
</style>

