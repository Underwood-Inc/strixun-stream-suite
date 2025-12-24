<script lang="ts">
  import { apiClient } from '$lib/api-client';

  let step: 'email' | 'otp' = 'email';
  let email = '';
  let otp = '';
  let loading = false;
  let error: string | null = null;

  async function handleRequestOTP() {
    const emailValue = email.trim().toLowerCase();
    
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      error = 'Please enter a valid email address';
      return;
    }

    email = emailValue;
    loading = true;
    error = null;

    try {
      await apiClient.requestOTP(email);
      step = 'otp';
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to send OTP. Please try again.';
      step = 'email';
    } finally {
      loading = false;
    }
  }

  async function handleVerifyOTP() {
    const otpValue = otp.trim();
    
    if (!otpValue || otpValue.length !== 6) {
      error = 'Please enter a valid 6-digit OTP code';
      return;
    }

    loading = true;
    error = null;

    try {
      const response = await apiClient.verifyOTP(email, otpValue);
      
      const token = response.access_token || response.token;
      if (token) {
        apiClient.setToken(token);
        window.dispatchEvent(new CustomEvent('auth:login', {
          detail: { user: response }
        }));
      } else {
        throw new Error('No token received from server');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Invalid OTP code. Please try again.';
    } finally {
      loading = false;
    }
  }

  function handleBack() {
    step = 'email';
    error = null;
    otp = '';
  }

  function handleOtpInput(e: Event) {
    const target = e.target as HTMLInputElement;
    target.value = target.value.replace(/\D/g, '').slice(0, 6);
    otp = target.value;
  }

  function handleKeyPress(e: KeyboardEvent, handler: () => void) {
    if (e.key === 'Enter' && !loading) {
      handler();
    }
  }
</script>

<div class="login">
  <div class="login__container">
    <div class="login__header">
      <h1 class="login__title">Developer Dashboard</h1>
      <p class="login__subtitle">Sign in with your email to access your dashboard</p>
    </div>

    {#if error}
      <div class="login__error">{error}</div>
    {/if}

    {#if step === 'email'}
      <form class="login__form" onsubmit={(e) => { e.preventDefault(); handleRequestOTP(); }}>
        <div class="login__field">
          <label for="login-email" class="login__label">Email Address</label>
          <input
            type="email"
            id="login-email"
            class="login__input"
            required
            autocomplete="email"
            placeholder="your@email.com"
            bind:value={email}
            disabled={loading}
            onkeypress={(e) => handleKeyPress(e, handleRequestOTP)}
          />
        </div>
        <button
          type="submit"
          class="login__button login__button--primary"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send OTP Code'}
        </button>
      </form>
    {:else}
      <form class="login__form" onsubmit={(e) => { e.preventDefault(); handleVerifyOTP(); }}>
        <div class="login__field">
          <label for="login-otp" class="login__label">6-Digit OTP Code</label>
          <input
            type="text"
            id="login-otp"
            class="login__input login__input--otp"
            required
            autocomplete="one-time-code"
            inputmode="numeric"
            pattern="[0-9]{6}"
            maxlength="6"
            placeholder="123456"
            bind:value={otp}
            disabled={loading}
            oninput={handleOtpInput}
            onkeypress={(e) => handleKeyPress(e, handleVerifyOTP)}
          />
          <p class="login__hint">Check your email ({email}) for the code</p>
        </div>
        <div class="login__actions">
          <button
            type="button"
            class="login__button login__button--secondary"
            disabled={loading}
            onclick={handleBack}
          >
            Back
          </button>
          <button
            type="submit"
            class="login__button login__button--primary"
            disabled={loading || otp.length !== 6}
          >
            {loading ? 'Verifying...' : 'Verify & Login'}
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>

<style>
  .login {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--spacing-xl);
  }

  .login__container {
    max-width: 400px;
    width: 100%;
  }

  .login__header {
    text-align: center;
    margin-bottom: var(--spacing-2xl);
  }

  .login__title {
    font-size: 2rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
  }

  .login__subtitle {
    color: var(--text-secondary);
  }

  .login__error {
    background: var(--card);
    border: 1px solid var(--danger);
    border-left: 4px solid var(--danger);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    color: var(--danger);
    margin-bottom: var(--spacing-lg);
  }

  .login__form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .login__field {
    display: flex;
    flex-direction: column;
  }

  .login__label {
    display: block;
    margin-bottom: var(--spacing-sm);
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .login__input {
    width: 100%;
    padding: var(--spacing-md);
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: 1rem;
    box-sizing: border-box;
  }

  .login__input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .login__input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .login__input--otp {
    font-size: 1.5rem;
    text-align: center;
    letter-spacing: 0.5rem;
    font-family: monospace;
  }

  .login__hint {
    margin-top: var(--spacing-sm);
    font-size: 0.875rem;
    color: var(--muted);
  }

  .login__actions {
    display: flex;
    gap: var(--spacing-md);
  }

  .login__button {
    flex: 1;
    padding: var(--spacing-md);
    border: 3px solid;
    border-radius: 0;
    font-weight: 700;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.1s;
  }

  .login__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .login__button--primary {
    background: var(--accent);
    border-color: var(--accent-dark);
    color: #000;
    box-shadow: 0 4px 0 var(--accent-dark);
  }

  .login__button--primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 var(--accent-dark);
  }

  .login__button--primary:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: 0 2px 0 var(--accent-dark);
  }

  .login__button--secondary {
    background: transparent;
    border-color: var(--border);
    color: var(--text);
  }

  .login__button--secondary:hover:not(:disabled) {
    background: var(--bg-dark);
  }
</style>

