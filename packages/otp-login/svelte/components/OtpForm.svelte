<svelte:options runes={false} />

<script lang="ts">
  /**
   * OtpForm Component
   * 
   * OTP verification form
   */
  
  import { OtpLoginCore } from '../../core';
  import type { OtpLoginState } from '../../core';
  import { OTP_LENGTH, OTP_LENGTH_DESCRIPTION, OTP_PLACEHOLDER, OTP_HTML_PATTERN } from '../../../../shared-config/otp-config.js';

  export let state: OtpLoginState;
  export let onOtpChange: (e: Event) => void;
  export let onVerifyOtp: () => void;
  export let onGoBack: () => void;
  export let onKeyPress: (e: KeyboardEvent, handler: () => void) => void;

  function formatCountdown(seconds: number): string {
    return OtpLoginCore.formatCountdown(seconds);
  }
</script>

<form class="otp-login-form" novalidate onsubmit={(e) => { e.preventDefault(); onVerifyOtp(); }}>
  <div class="otp-login-field">
    <label for="otp-login-otp" class="otp-login-label">{OTP_LENGTH_DESCRIPTION} OTP Code</label>
    <input
      type="tel"
      id="otp-login-otp"
      class="otp-login-input otp-login-input--otp"
      required
      autocomplete="one-time-code"
      inputmode="numeric"
      maxlength={OTP_LENGTH}
      pattern={OTP_HTML_PATTERN}
      placeholder={OTP_PLACEHOLDER}
      value={state.otp}
      disabled={state.loading}
      autofocus
      oninput={onOtpChange}
      onkeydown={(e) => onKeyPress(e, onVerifyOtp)}
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
      onclick={onGoBack}
    >
      Back
    </button>
    <button
      type="submit"
      class="otp-login-button otp-login-button--primary"
      disabled={state.loading || state.otp.length !== OTP_LENGTH}
    >
      {state.loading ? 'Verifying...' : 'Verify & Login'}
    </button>
  </div>
</form>

<style lang="scss">
  @use '../../../../shared-styles/mixins' as *;
  @use '../../../../shared-styles/animations' as *;

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
</style>

