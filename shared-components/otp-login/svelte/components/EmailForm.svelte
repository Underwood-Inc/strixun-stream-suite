<script lang="ts">
  /**
   * EmailForm Component
   * 
   * Email input form for requesting OTP
   */
  
  import type { OtpLoginState } from '../../core';

  export let state: OtpLoginState;
  export let onEmailChange: (e: Event) => void;
  export let onRequestOtp: () => void;
  export let onKeyPress: (e: KeyboardEvent, handler: () => void) => void;
</script>

<form class="otp-login-form" onsubmit={(e) => { e.preventDefault(); onRequestOtp(); }}>
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
      oninput={onEmailChange}
      onkeydown={(e) => onKeyPress(e, onRequestOtp)}
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

  .otp-login-button {
    flex: 1;
    padding: var(--spacing-md);
    font-size: 0.875rem;
  }

  .otp-login-button--primary {
    @include arcade-button(var(--accent), var(--accent-dark));
  }
</style>

