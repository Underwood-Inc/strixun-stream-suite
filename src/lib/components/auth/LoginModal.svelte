<script lang="ts">
  /**
   * Login Modal Component
   * 
   * Wrapper around shared OTP Login component for modal display
   * Renders at body level to escape parent stacking contexts
   */
  
  import { onMount, onDestroy } from 'svelte';
  import { setAuth } from '../../../stores/auth';
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
   * Priority: VITE_AUTH_API_URL (for E2E tests) > window.getOtpAuthApiUrl() > fallback
   */
  function getOtpAuthApiUrl(): string {
    // Priority 1: VITE_AUTH_API_URL (set by playwright config for E2E tests, same as mods-hub)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH_API_URL) {
      const viteUrl = import.meta.env.VITE_AUTH_API_URL;
      if (viteUrl && typeof viteUrl === 'string' && viteUrl.length > 0) {
        return viteUrl;
      }
    }
    
    // Priority 2: window.getOtpAuthApiUrl() (from config.js)
    if (typeof window !== 'undefined' && (window as any).getOtpAuthApiUrl) {
      return (window as any).getOtpAuthApiUrl() || '';
    }
    
    // Fallback to custom domain if function doesn't exist
    return 'https://auth.idling.app';
  }
  
  function handleLoginSuccess(data: LoginSuccessData) {
    // Decode JWT to extract isSuperAdmin from payload
    let isSuperAdmin = false;
    try {
      const token = data.token;
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payloadB64 = parts[1];
          const payload = JSON.parse(
            atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
          );
          isSuperAdmin = payload?.isSuperAdmin === true;
        }
      }
    } catch (error) {
      console.warn('[LoginModal] Failed to decode JWT for super admin status:', error);
    }
    
    // Set authentication - support both old format and OAuth 2.0 format
    setAuth({
      userId: data.userId || '',
      email: data.email,
      displayName: data.displayName || undefined,
      token: data.token,
      expiresAt: data.expiresAt || new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
      isSuperAdmin: isSuperAdmin,
    });
    
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
