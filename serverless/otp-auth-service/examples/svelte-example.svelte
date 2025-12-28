<!--
  Svelte Example - OTP Authentication Integration
  
  Example Svelte component using the OTP Auth Service
-->

<script lang="ts">
  import { OTPAuth } from '@otpauth/sdk';
  import { onMount } from 'svelte';

  let email = '';
  let otp = '';
  let step: 'email' | 'otp' = 'email';
  let loading = false;
  let error: string | null = null;
  let token: string | null = null;

  const client = new OTPAuth({
    apiKey: import.meta.env.VITE_OTP_API_KEY || '',
    baseUrl: import.meta.env.VITE_OTP_BASE_URL || 'https://otp-auth-service.workers.dev'
  });

  async function handleRequestOTP() {
    loading = true;
    error = null;

    try {
      await client.requestOTP(email);
      step = 'otp';
    } catch (err: any) {
      error = err.message || 'Failed to request OTP';
    } finally {
      loading = false;
    }
  }

  async function handleVerifyOTP() {
    loading = true;
    error = null;

    try {
      const response = await client.verifyOTP(email, otp);
      token = response.token;
      // Store in localStorage or Svelte store
      localStorage.setItem('otp_token', response.token);
    } catch (err: any) {
      error = err.message || 'Failed to verify OTP';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    // Check for existing token
    const storedToken = localStorage.getItem('otp_token');
    if (storedToken) {
      token = storedToken;
    }
  });
</script>

{#if token}
  <div class="success">
    <h2>Successfully Authenticated!</h2>
    <p>Token: {token.substring(0, 20)}...</p>
    <button on:click={() => { token = null; localStorage.removeItem('otp_token'); }}>
      Logout
    </button>
  </div>
{:else if step === 'email'}
  <div class="auth-form">
    <h2>Enter Your Email</h2>
    <input
      type="email"
      bind:value={email}
      placeholder="user@example.com"
      disabled={loading}
    />
    <button on:click={handleRequestOTP} disabled={loading || !email}>
      {loading ? 'Sending...' : 'Send OTP'}
    </button>
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>
{:else}
  <div class="auth-form">
    <h2>Enter OTP Code</h2>
    <p>Check your email for the 9-digit code</p>
    <input
      type="text"
      bind:value={otp}
      placeholder="123456789"
      maxlength="9"
      disabled={loading}
    />
    <button on:click={handleVerifyOTP} disabled={loading || otp.length !== 9}>
      {loading ? 'Verifying...' : 'Verify OTP'}
    </button>
    <button on:click={() => step = 'email'}>Back</button>
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>
{/if}

<style>
  .auth-form {
    max-width: 400px;
    margin: 0 auto;
    padding: 20px;
  }

  input {
    width: 100%;
    padding: 10px;
    margin: 10px 0;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  button {
    padding: 10px 20px;
    margin: 5px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .error {
    color: red;
    margin-top: 10px;
  }

  .success {
    text-align: center;
    padding: 20px;
  }
</style>

