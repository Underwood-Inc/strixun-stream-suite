<script lang="ts">
  import { apiClient } from '$dashboard/lib/api-client';
  import type { LoginSuccessData } from '@strixun/otp-login';

  // Get API URL - same logic as Login component
  function getApiUrl(): string {
    if (typeof window === 'undefined') return '';
    
    // CRITICAL: NO FALLBACKS ON LOCAL - Always use localhost in development
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        import.meta.env?.DEV ||
                        import.meta.env?.MODE === 'development';
    
    if (isLocalhost) {
      // Use Vite proxy in dev to avoid CORS issues
      return '';
    }
    
    // Only use production URL if NOT on localhost
    return window.location.origin;
  }

  const apiUrl = getApiUrl();

  import { onMount } from 'svelte';

  type SignupStep = 'form' | 'verify' | 'success';
  
  let step: SignupStep = 'form';
  let email = '';
  let companyName = '';
  let verificationCode = '';
  let loading = false;
  let error: string | null = null;
  let successData: { customerId: string; apiKey: string; message: string } | null = null;
  let showNoAccountMessage = false;

  onMount(() => {
    // Check if email was pre-filled from login attempt
    const prefillEmail = sessionStorage.getItem('signup-email');
    if (prefillEmail) {
      email = prefillEmail;
      showNoAccountMessage = true;
      sessionStorage.removeItem('signup-email');
    }
  });

  async function handleSignup(e: Event) {
    e.preventDefault();
    error = null;
    loading = true;

    try {
      const response = await fetch(`${apiUrl}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          companyName: companyName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a "signup already in progress" error - if so, move to verify step
        if (data.error && data.error.includes('Signup already in progress')) {
          step = 'verify';
          error = null; // Clear error since we're proceeding
        } else {
          throw new Error(data.error || data.detail || 'Failed to sign up');
        }
      } else {
        // Success - move to verification step
        // If alreadyInProgress is true, show a helpful message
        if (data.alreadyInProgress) {
          error = null; // Clear any previous errors
          showOtpAlreadySent = true; // Show info message that OTP was already sent
        } else {
          showOtpAlreadySent = false;
        }
        step = 'verify';
      }
    } catch (err: any) {
      error = err.message || 'Failed to sign up. Please try again.';
    } finally {
      loading = false;
    }
  }

  async function handleVerify(e: Event) {
    e.preventDefault();
    error = null;
    loading = true;

    try {
      const response = await fetch(`${apiUrl}/signup/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          otp: verificationCode, // Use 'otp' to match OTP system
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.detail || 'Invalid verification code');
      }

      // Store API key and customer info
      successData = {
        customerId: data.customerId,
        apiKey: data.apiKey,
        message: data.message,
      };

      // Auto-login if JWT token is provided (saves API limits!)
      if (data.access_token || data.token) {
        const token = data.access_token || data.token;
        apiClient.setToken(token);
        
        // Dispatch login event to auto-login the customer
        window.dispatchEvent(new CustomEvent('auth:login', {
          detail: { 
            customer: {
              userId: data.customerId || data.sub,
              email: data.email || email.toLowerCase().trim(),
              token: token,
            }
          }
        }));
        
        // Show success step briefly, then the app will handle the login
        step = 'success';
      } else {
        // Fallback: if no token, show success and let them login manually
        step = 'success';
      }
    } catch (err: any) {
      error = err.message || 'Failed to verify. Please try again.';
    } finally {
      loading = false;
    }
  }

  function handleGoBack() {
    step = 'form';
    verificationCode = '';
    error = null;
    showOtpAlreadySent = false;
  }

  function handleLoginAfterSignup() {
    // Dispatch event to show login
    window.dispatchEvent(new CustomEvent('auth:show-login'));
  }

  function handleKeyPress(e: KeyboardEvent, handler: () => void) {
    if (e.key === 'Enter' && !loading) {
      handler();
    }
  }
</script>

<div class="signup">
  <div class="signup-container">
    <div class="signup-header">
      <h1 class="signup-title">Create Account</h1>
      <p class="signup-subtitle">
        {#if step === 'form'}
          {#if showNoAccountMessage}
            You need a customer account to access the dashboard. Let's create one!
          {:else}
            Sign up to get started with OTP Auth API
          {/if}
        {:else if step === 'verify'}
          Check your email for the verification code
        {:else}
          Account created successfully!
        {/if}
      </p>
    </div>

    {#if showNoAccountMessage && step === 'form'}
      <div class="signup-info">
        <strong>No account found</strong> - We'll create your customer account now. Your email is pre-filled below.
      </div>
    {/if}

    {#if error}
      <div class="signup-error">{error}</div>
    {/if}

    {#if step === 'form'}
      <form class="signup-form" onsubmit={handleSignup}>
        <div class="signup-field">
          <label for="signup-email" class="signup-label">Email Address</label>
          <input
            type="email"
            id="signup-email"
            class="signup-input"
            required
            autocomplete="email"
            placeholder="your@email.com"
            bind:value={email}
            disabled={loading}
            autofocus
            onkeydown={(e) => handleKeyPress(e, handleSignup)}
          />
        </div>

        <div class="signup-field">
          <label for="signup-company" class="signup-label">Company Name</label>
          <input
            type="text"
            id="signup-company"
            class="signup-input"
            required
            autocomplete="organization"
            placeholder="Your Company"
            bind:value={companyName}
            disabled={loading}
            onkeydown={(e) => handleKeyPress(e, handleSignup)}
          />
        </div>

        <button
          type="submit"
          class="signup-button signup-button--primary"
          disabled={loading || !email || !companyName}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>

        <p class="signup-footer">
          Already have an account? 
          <button type="button" class="signup-link" onclick={handleLoginAfterSignup}>
            Sign in
          </button>
        </p>
      </form>
    {:else if step === 'verify'}
      {#if showOtpAlreadySent}
        <div class="signup-info">
          <strong>OTP Already Sent</strong> - A verification code was already sent to your email. Enter it below to complete signup.
        </div>
      {/if}
      
      <form class="signup-form" onsubmit={handleVerify}>
        <div class="signup-field">
          <label for="signup-code" class="signup-label">9-Digit Verification Code</label>
          <input
            type="tel"
            id="signup-code"
            class="signup-input signup-input--otp"
            required
            autocomplete="one-time-code"
            inputmode="numeric"
            maxlength="9"
            placeholder="123456789"
            bind:value={verificationCode}
            disabled={loading}
            autofocus
            onkeydown={(e) => handleKeyPress(e, handleVerify)}
          />
          <p class="signup-hint">Check your email ({email}) for the code</p>
        </div>

        <div class="signup-actions">
          <button
            type="button"
            class="signup-button signup-button--secondary"
            disabled={loading}
            onclick={handleGoBack}
          >
            Back
          </button>
          <button
            type="submit"
            class="signup-button signup-button--primary"
            disabled={loading || verificationCode.length !== 9}
          >
            {loading ? 'Verifying...' : 'Verify & Complete'}
          </button>
        </div>
      </form>
    {:else if step === 'success' && successData}
      <div class="signup-success">
        <div class="signup-success-icon"></div>
        <h2>Account Created Successfully!</h2>
        <p class="signup-success-message">{successData.message}</p>
        
        <div class="signup-api-key">
          <label class="signup-api-key-label">Your API Key (also available in the API Keys tab):</label>
          <div class="signup-api-key-value">
            <code>{successData.apiKey}</code>
            <button
              type="button"
              class="signup-copy-button"
              onclick={() => {
                navigator.clipboard.writeText(successData!.apiKey);
                alert('API key copied to clipboard!');
              }}
            >
              Copy
            </button>
          </div>
        </div>

        <button
          type="button"
          class="signup-button signup-button--primary"
          onclick={handleLoginAfterSignup}
        >
          Sign In to Dashboard
        </button>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  @use '../../../../../shared-styles/animations' as *;
  @use '../../../../../shared-styles/mixins' as *;

  .signup {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--spacing-xl);
  }

  .signup-container {
    max-width: 400px;
    width: 100%;
  }

  .signup-header {
    text-align: center;
    margin-bottom: var(--spacing-2xl);
  }

  .signup-title {
    font-size: 2rem;
    margin-bottom: var(--spacing-md);
    color: var(--accent);
  }

  .signup-subtitle {
    color: var(--text-secondary);
  }

  .signup-error {
    background: var(--card);
    border: 1px solid var(--danger);
    border-left: 4px solid var(--danger);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    color: var(--danger);
    margin-bottom: var(--spacing-lg);
    animation: slide-down 0.3s ease-out;
  }

  .signup-info {
    background: var(--card);
    border: 1px solid var(--accent);
    border-left: 4px solid var(--accent);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    color: var(--text);
    margin-bottom: var(--spacing-lg);
    animation: slide-down 0.3s ease-out;
  }

  .signup-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .signup-field {
    display: flex;
    flex-direction: column;
  }

  .signup-label {
    display: block;
    margin-bottom: var(--spacing-sm);
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .signup-input {
    @include input;
    width: 100%;
    padding: var(--spacing-md);
    font-size: 1rem;
    box-sizing: border-box;
  }

  .signup-input--otp {
    font-size: 1.5rem;
    text-align: center;
    letter-spacing: 0.5rem;
    font-family: monospace;
  }

  .signup-hint {
    margin-top: var(--spacing-xs);
    font-size: 0.875rem;
    color: var(--muted);
  }

  .signup-actions {
    display: flex;
    gap: var(--spacing-md);
  }

  .signup-button {
    flex: 1;
    padding: var(--spacing-md);
    font-size: 0.875rem;
  }

  .signup-button--primary {
    @include arcade-button(var(--accent), var(--accent-dark));
  }

  .signup-button--secondary {
    @include arcade-button(var(--border), var(--border-light));
    background: transparent;
    color: var(--text);
    
    &:hover:not(:disabled) {
      background: var(--bg-dark);
      color: var(--text);
    }
  }

  .signup-footer {
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-top: var(--spacing-md);
  }

  .signup-link {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    text-decoration: underline;
    font-size: inherit;
    padding: 0;
    margin-left: var(--spacing-xs);
    
    &:hover {
      color: var(--accent-dark);
    }
  }

  .signup-success {
    text-align: center;
    padding: var(--spacing-2xl) 0;
  }

  .signup-success-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--accent);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-weight: bold;
    margin: 0 auto var(--spacing-lg);
    animation: scale-in 0.3s ease-out;
  }

  .signup-success h2 {
    color: var(--text);
    margin-bottom: var(--spacing-md);
  }

  .signup-success-message {
    color: var(--text-secondary);
    margin-bottom: var(--spacing-xl);
  }

  .signup-api-key {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
    text-align: left;
  }

  .signup-api-key-label {
    display: block;
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin-bottom: var(--spacing-sm);
  }

  .signup-api-key-value {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
  }

  .signup-api-key-value code {
    flex: 1;
    background: var(--card);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-sm);
    font-family: monospace;
    font-size: 0.875rem;
    word-break: break-all;
    color: var(--accent);
  }

  .signup-copy-button {
    @include arcade-button(var(--border), var(--border-light));
    background: transparent;
    color: var(--text);
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 0.875rem;
    white-space: nowrap;
    
    &:hover {
      background: var(--bg-dark);
    }
  }
</style>

