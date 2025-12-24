<script lang="ts">
  /**
   * Login Modal Component
   * 
   * Email OTP authentication flow
   */
  
  import { onMount, onDestroy, tick } from 'svelte';
  import { isAuthenticated, setAuth, user } from '../../../stores/auth';
  import { showToast } from '../../../stores/toast-queue';
  import { animate } from '../../../core/animations';
  
  export let onClose: () => void;
  
  let email = '';
  let otp = '';
  let step: 'email' | 'otp' = 'email';
  let isLoading = false;
  let error = '';
  let countdown = 0;
  let countdownInterval: ReturnType<typeof setInterval> | null = null;
  let portalContainer: HTMLDivElement | null = null;
  let modalOverlay: HTMLDivElement | null = null;
  
  /**
   * Get API URL
   */
  function getApiUrl(): string {
    if (typeof window !== 'undefined' && (window as any).getWorkerApiUrl) {
      return (window as any).getWorkerApiUrl() || '';
    }
    return '';
  }
  
  /**
   * Request OTP
   */
  async function requestOTP(): Promise<void> {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error = 'Please enter a valid email address';
      return;
    }
    
    try {
      isLoading = true;
      error = '';
      
      const apiUrl = getApiUrl();
      if (!apiUrl) {
        error = 'API URL not configured';
        return;
      }
      
      const response = await fetch(`${apiUrl}/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        error = data.error || 'Failed to send OTP';
        return;
      }
      
      // Switch to OTP step
      step = 'otp';
      countdown = 600; // 10 minutes
      
      // Start countdown
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      countdownInterval = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
          }
        }
      }, 1000);
      
      showToast({ message: 'OTP sent to your email', type: 'success' });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to request OTP';
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Verify OTP
   */
  async function verifyOTP(): Promise<void> {
    if (!otp || !/^\d{6}$/.test(otp)) {
      error = 'Please enter a valid 6-digit OTP';
      return;
    }
    
    try {
      isLoading = true;
      error = '';
      
      const apiUrl = getApiUrl();
      if (!apiUrl) {
        error = 'API URL not configured';
        return;
      }
      
      const response = await fetch(`${apiUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        error = data.error || 'Invalid OTP';
        return;
      }
      
      // Set authentication
      setAuth({
        userId: data.userId,
        email: data.email || email,
        token: data.token,
        expiresAt: data.expiresAt,
      });
      
      showToast({ message: 'Login successful', type: 'success' });
      onClose();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to verify OTP';
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Format countdown
   */
  function formatCountdown(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  /**
   * Go back to email step
   */
  function goBack(): void {
    step = 'email';
    otp = '';
    error = '';
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    countdown = 0;
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
    // Clean up countdown interval
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    
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
    <div class="login-header">
      <h2 id="login-title">Sign In</h2>
      <button class="close-btn" on:click={onClose} aria-label="Close">×</button>
    </div>
    
    <div class="login-content">
      {#if step === 'email'}
        <div class="login-step">
          <p class="login-description">Enter your email to receive a verification code</p>
          
          <div class="form-group">
            <label for="email-input">Email</label>
            <input
              id="email-input"
              type="email"
              bind:value={email}
              placeholder="your@email.com"
              disabled={isLoading}
              on:keydown={(e) => e.key === 'Enter' && requestOTP()}
              autocomplete="email"
            />
          </div>
          
          {#if error}
            <div class="error-message">{error}</div>
          {/if}
          
          <button
            class="btn btn-primary btn-block"
            on:click={requestOTP}
            disabled={isLoading || !email}
          >
            {isLoading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </div>
      {:else}
        <div class="login-step">
          <p class="login-description">
            Enter the 6-digit code sent to <strong>{email}</strong>
          </p>
          
          {#if countdown > 0}
            <p class="countdown">Code expires in: {formatCountdown(countdown)}</p>
          {:else}
            <p class="countdown expired">Code expired. Request a new one.</p>
          {/if}
          
          <div class="form-group">
            <label for="otp-input">Verification Code</label>
            <input
              id="otp-input"
              type="text"
              bind:value={otp}
              placeholder="123456"
              maxlength="6"
              disabled={isLoading}
              on:keydown={(e) => e.key === 'Enter' && verifyOTP()}
              autocomplete="one-time-code"
              inputmode="numeric"
            />
          </div>
          
          {#if error}
            <div class="error-message">{error}</div>
          {/if}
          
          <div class="button-group">
            <button
              class="btn btn-primary btn-block"
              on:click={verifyOTP}
              disabled={isLoading || !otp || otp.length !== 6}
            >
              {isLoading ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            
            <button
              class="btn btn-secondary btn-block"
              on:click={goBack}
              disabled={isLoading}
            >
              ← Back
            </button>
          </div>
        </div>
      {/if}
    </div>
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
  
  .login-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px;
    border-bottom: 1px solid var(--border);
    
    h2 {
      margin: 0;
      font-size: 24px;
      color: var(--text);
    }
    
    .close-btn {
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
  }
  
  .login-content {
    padding: 24px;
  }
  
  .login-step {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .login-description {
    margin: 0;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.5;
    
    strong {
      color: var(--text);
    }
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    
    label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text);
    }
    
    input {
      width: 100%;
      padding: 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 16px;
      transition: all 0.2s;
      
      &:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 0, 122, 255), 0.1);
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
  
  .countdown {
    margin: 0;
    font-size: 12px;
    color: var(--text-secondary);
    text-align: center;
    
    &.expired {
      color: var(--warning);
    }
  }
  
  .error-message {
    padding: 12px;
    background: rgba(var(--error-rgb, 255, 0, 0), 0.1);
    border: 1px solid var(--error);
    border-radius: 6px;
    color: var(--error);
    font-size: 14px;
  }
  
  .button-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    
    &.btn-primary {
      background: var(--accent);
      color: white;
      
      &:hover:not(:disabled) {
        background: var(--accent-hover);
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
    
    &.btn-secondary {
      background: var(--bg-secondary);
      color: var(--text);
      border: 1px solid var(--border);
      
      &:hover:not(:disabled) {
        background: var(--card);
      }
      
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
    
    &.btn-block {
      width: 100%;
    }
  }
</style>

