<script lang="ts">
  /**
   * Auth Screen Component
   * 
   * Full-screen authentication blocker that shows when encryption is enabled
   * but user is not authenticated. The entire app is blocked until authentication.
   */
  
  import { LoginModal, TwitchAdCarousel } from '@components';
  
  let showLoginModal = false;
  
  // Reactive statement to track modal state changes
  $: {
    console.log('[AuthScreen] showLoginModal changed to:', showLoginModal);
  }
  
  function handleLoginClick(): void {
    console.log('[AuthScreen] Button clicked, setting showLoginModal to true');
    showLoginModal = true;
    console.log('[AuthScreen] showLoginModal is now:', showLoginModal);
  }
  
  function handleLoginClose(): void {
    console.log('[AuthScreen] Closing login modal');
    showLoginModal = false;
  }
</script>

<div class="auth-screen">
  <div class="auth-screen__content">
    <div class="auth-screen__icon">★</div>
    <h1 class="auth-screen__title">Authentication Required</h1>
    <p class="auth-screen__description">
      Encryption is enabled for this application. You must authenticate via email OTP to access the app.
    </p>
    <p class="auth-screen__subtext">
      Please sign in using your email address to continue.
    </p>
    <button 
      type="button"
      class="auth-screen__button"
      on:click|stopPropagation={handleLoginClick}
    >
      Sign In with Email
    </button>
    <p class="auth-screen__info-link">
      <a 
        href="https://auth.idling.app" 
        target="_blank" 
        rel="noopener noreferrer"
        class="auth-screen__link"
      >
        Learn more about this authentication method
      </a>
    </p>
  </div>
</div>

<TwitchAdCarousel
  position="bottom-left"
  supportUrl="https://www.twitch.tv/strixun"
  storageKey="ui_auth_ad_carousel_state"
/>

{#if showLoginModal}
  <LoginModal onClose={handleLoginClose} />
{/if}

<style lang="scss">
  @use '@styles/animations' as *;
  
  .auth-screen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    color: var(--text);
    font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    @include gpu-accelerated;
    animation: fade-in 0.3s ease-out;
  }
  
  .auth-screen__content {
    text-align: center;
    max-width: 650px;
    padding: 40px;
    @include gpu-accelerated;
    z-index: 1;
  }
  
  .auth-screen__icon {
    font-size: 4em;
    margin-bottom: 24px;
    animation: scale-in 0.5s ease-out;
  }
  
  .auth-screen__title {
    font-size: 2em;
    margin: 0 0 20px 0;
    color: var(--danger);
    font-weight: 600;
  }
  
  .auth-screen__description {
    font-size: 1.2em;
    margin: 0 0 16px 0;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  
  .auth-screen__subtext {
    font-size: 1em;
    margin: 0 0 40px 0;
    color: var(--muted);
    line-height: 1.5;
  }
  
  .auth-screen__button {
    padding: 16px 32px;
    font-size: 1.1em;
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s ease;
    @include gpu-accelerated;
    
    &:hover {
      background: var(--accent-dark);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    &:active {
      transform: translateY(0);
    }
  }

  .auth-screen__info-link {
    margin: 24px 0 0 0;
    font-size: 0.9em;
  }

  .auth-screen__link {
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.2s ease;
    border-bottom: 1px solid transparent;
    
    &:hover {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
    
    &:focus {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      border-radius: 2px;
    }
  }
</style>

