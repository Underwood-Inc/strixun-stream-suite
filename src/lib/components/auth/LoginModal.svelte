<script lang="ts">
  /**
   * Login Modal Component
   * 
   * Wrapper around shared OTP Login component for modal display
   * Renders at body level to escape parent stacking contexts
   */
  
  import { onMount, onDestroy } from 'svelte';
  import { login } from '../../../stores/auth';
  import { showToast } from '../../../stores/toast-queue';
  import OtpLogin from '@strixun/otp-login/svelte/OtpLogin.svelte';
  import type { LoginSuccessData } from '@strixun/otp-login';
  
  export let onClose: () => void;
  
  let container: HTMLDivElement | null = null;
  
  onMount(() => {
    console.log('[LoginModal] Component mounted');
    // Create container at body level
    container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.zIndex = '1000000';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
  });
  
  onDestroy(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });
  
  /**
   * Get OTP Auth API URL
   * Priority: localhost check > VITE_AUTH_API_URL (for E2E tests) > window.getOtpAuthApiUrl() > fallback
   */
  function getOtpAuthApiUrl(): string {
    // CRITICAL: Check localhost FIRST - NEVER call window.getOtpAuthApiUrl() on localhost
    // This prevents any cached production URLs from being used
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      import.meta.env?.DEV ||
      import.meta.env?.MODE === 'development'
    );
    
    if (isLocalhost) {
      // NEVER fall back to production when on localhost
      // NEVER call window.getOtpAuthApiUrl() - it might have cached production URL
      return 'http://localhost:8787';
    }
    
    // Priority 1: VITE_AUTH_API_URL (set by playwright config for E2E tests, same as mods-hub)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
      const viteUrl = import.meta.env.VITE_AUTH_API_URL;
      if (viteUrl && typeof viteUrl === 'string' && viteUrl.length > 0) {
        return viteUrl;
      }
    }
    
    // Priority 2: window.getOtpAuthApiUrl() (from config.js) - only if NOT on localhost
    if (typeof window !== 'undefined' && (window as any).getOtpAuthApiUrl) {
      const url = (window as any).getOtpAuthApiUrl();
      if (url) {
        return url;
      }
    }
    
    // Only use production URL if NOT on localhost
    return 'https://auth.idling.app';
  }
  
  async function handleLoginSuccess(data: LoginSuccessData) {
    // Use the new login function - HttpOnly cookie is already set by the OTP auth service
    // Fetch full customer data from /auth/me
    await login(data.token);
    
    showToast({ message: 'Login successful', type: 'success' });
    onClose();
  }
  
  function handleLoginError(error: string) {
    // Error is already displayed by the component
    console.error('Login error:', error);
  }
  
  // Simple portal action to render at body level
  function portal(node: HTMLElement, target: HTMLElement | null) {
    if (!target) return { update() {}, destroy() {} };
    try {
      target.appendChild(node);
    } catch (error) {
      console.error('[LoginModal] Portal error:', error);
      return { update() {}, destroy() {} };
    }
    return {
      update(newTarget: HTMLElement | null) {
        if (newTarget && newTarget !== target) {
          try {
            newTarget.appendChild(node);
          } catch (error) {
            console.error('[LoginModal] Portal update error:', error);
          }
        }
      },
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }
</script>

{#if container}
  <div use:portal={container} style="pointer-events: auto;">
    <OtpLogin
      apiUrl={getOtpAuthApiUrl()}
      onSuccess={handleLoginSuccess}
      onError={handleLoginError}
      showAsModal={true}
      onClose={onClose}
      title="Sign In"
      subtitle="Enter your email to receive a verification code"
    />
  </div>
{/if}
