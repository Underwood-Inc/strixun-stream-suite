<script lang="ts">
  /**
   * Header Component
   * 
   * Application header with status indicator and controls.
   * Displays connection status, alerts dropdown, and navigation controls.
   * 
   * Features:
   * - Connection status indicator
   * - Alerts dropdown for toast notifications
   * - Reload and setup navigation buttons
   * - Particle effects on interactions
   */
  
  import { onMount, tick } from 'svelte';
  import { connected } from '../../stores/connection';
  import { navigateTo } from '../../stores/navigation';
  import { celebrateClick, celebrateConnection } from '../../utils/particles';
  import { showSuccess, showError, showWarning, showInfo } from '../../stores/toast-queue';
  import { isAuthenticated, logout as logoutUser, customer } from '../../stores/auth';
  import { themeSettingsVisible } from '../../stores/theme-settings';
  import Tooltip from './Tooltip.svelte';
  import TruncatedText from './TruncatedText.svelte';
  import AlertsDropdown from './ui/AlertsDropdown.svelte';
  import { StatusFlair } from '@strixun/status-flair';
  
  let statusClass = 'disconnected';
  let reloadButton: HTMLButtonElement;
  let connectButton: HTMLButtonElement;
  let alertsOpen = false;
  
  // Local reactive copies of auth state to ensure reactivity
  let authenticated = false;
  let currentCustomer: typeof $customer = null;
  
  // PWA Install prompt
  let deferredPrompt: any = null;
  let showPWAInstall = false;
  
  // CRITICAL: Manually sync auth state to local variables to force reactivity
  // This fixes the issue where header doesn't update after session restore
  $: {
    authenticated = $isAuthenticated;
    currentCustomer = $customer;
  }
  
  function toggleThemeSettings(): void {
    themeSettingsVisible.set(!$themeSettingsVisible);
  }
  
  // Computed values for super admin check - use local reactive variable
  $: isSuperAdmin = currentCustomer?.isSuperAdmin ?? false;
  
  function toggleAlerts(): void {
    alertsOpen = !alertsOpen;
  }
  
  // PWA install prompt handling
  onMount(() => {
    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      deferredPrompt = e;
      // Show the install button
      showPWAInstall = true;
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      showPWAInstall = false;
    }
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  });
  
  $: {
    if ($connected) {
      statusClass = 'connected';
    } else {
      statusClass = 'disconnected';
    }
  }
  
  // Celebrate connection when it changes to connected
  let wasConnected = false;
  $: {
    if ($connected && !wasConnected) {
      celebrateConnection();
    }
    wasConnected = $connected;
  }
  
  function handleReload(e: MouseEvent): void {
    celebrateClick(e.currentTarget as HTMLElement);
    setTimeout(() => location.reload(), 200);
  }
  
  function handleConnect(e: MouseEvent): void {
    celebrateClick(e.currentTarget as HTMLElement);
    navigateTo('setup');
  }
  
  async function handlePWAInstall(e: MouseEvent): Promise<void> {
    celebrateClick(e.currentTarget as HTMLElement);
    
    if (!deferredPrompt) {
      showInfo('App is already installed or install not available', { title: 'Install' });
      return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      showSuccess('App installed successfully! 🎉', { title: 'Success' });
      celebrateConnection();
    } else {
      showInfo('Install cancelled', { title: 'Install' });
    }
    
    // Clear the deferred prompt since it can only be used once
    deferredPrompt = null;
    showPWAInstall = false;
  }
  
  async function handleLogout(e: MouseEvent): Promise<void> {
    celebrateClick(e.currentTarget as HTMLElement);
    try {
      await logoutUser();
      showSuccess('Logged out successfully', { title: 'Logout' });
      // Small delay before reload to show the toast
      setTimeout(() => location.reload(), 300);
    } catch (error) {
      showError('Failed to logout. Please try again.', { title: 'Error' });
      console.error('[Header] Logout error:', error);
    }
  }
</script>

<header class="header">
  <h1>
    <Tooltip 
      text={$connected ? 'Connected to OBS' : 'Not connected to OBS\nClick Connect to establish connection'} 
      position="bottom"
      level={$connected ? 'log' : 'error'}
    >
      <span class="status-dot {statusClass}" id="statusDot"></span>
    </Tooltip>
    <TruncatedText position="bottom">
      <span class="title-text">Strixun's Stream Suite [SSS]</span>
    </TruncatedText>
  </h1>
  <div class="header-actions">
    <Tooltip text="Theme Settings | Customize fonts and UI appearance" position="bottom">
      <button class="btn-icon" on:click={toggleThemeSettings} title="Theme Settings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
    </Tooltip>
    <AlertsDropdown open={alertsOpen} onToggle={toggleAlerts} />
    {#if authenticated}
      <Tooltip text="Sign Out" position="bottom">
        <button class="btn-icon" on:click={handleLogout} title="Sign Out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </Tooltip>
    {/if}
    {#if showPWAInstall}
      <Tooltip text="Install App | Install as a standalone app for OBS dock usage with full functionality" position="bottom" level="info">
        <button 
          class="btn-icon btn-icon--pwa" 
          on:click={handlePWAInstall} 
          title="Install App"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </Tooltip>
    {/if}
    <Tooltip text="Reload Panel" position="bottom">
      <button class="btn-icon" bind:this={reloadButton} on:click={handleReload}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
        </svg>
      </button>
    </Tooltip>
    <button class="btn-primary" bind:this={connectButton} on:click={handleConnect} id="connectHeaderBtn">Connect</button>
  </div>
</header>

<style lang="scss">
  @use '@styles/animations' as *;
  @use '@styles/mixins' as *;
  
  .header {
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    background: var(--card);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 100;
    
    h1 {
      font-size: 1.1em;
      display: flex;
      align-items: center;
      justify-content: flex-start; // Ensure left alignment
      gap: 6px;
      margin: 0;
      flex-shrink: 0;
      flex-grow: 0; // Prevent unwanted growth
    }
    
    .title-text {
      white-space: nowrap;
    }
    
    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
      margin-left: auto;
    }
    
    @media (max-width: 768px) {
      .header {
        gap: 12px;
      }
      
      h1 {
        flex: 1;
        min-width: 0;
        justify-content: flex-start; // Ensure left alignment even when flexible
      }
      
      .title-text {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .header-actions {
        gap: 4px;
      }
      
      .btn-icon {
        padding: 6px 8px;
      }
      
      .btn-primary {
        padding: 6px 12px;
        font-size: 0.85em;
      }
    }
    
    @media (max-width: 480px) {
      .header-actions {
        .btn-icon:not(:last-child) {
          display: none;
        }
      }
    }
  
  .btn-icon {
    background: transparent;
    border: 2px solid var(--border);
    color: var(--text);
    padding: 8px 10px;
    border-radius: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 0 var(--border);
    position: relative;
    overflow: hidden;
    
    @include ripple-effect(rgba(255, 255, 255, 0.2));
    
    &:hover {
      background: var(--border);
      color: var(--text);
      transform: translateY(-1px);
      box-shadow: 0 3px 0 var(--border);
    }
    
    &:active {
      transform: translateY(1px);
      box-shadow: 0 1px 0 var(--border);
    }
    
    svg {
      display: block;
      transition: transform 0.2s;
    }
    
    &:hover svg {
      transform: rotate(90deg);
    }
    
    // PWA Install button special styling
    &.btn-icon--pwa {
      border-color: var(--accent);
      color: var(--accent);
      @include glow(var(--accent), 0.5);
      animation: pulse-subtle 2s ease-in-out infinite;
      
      &:hover {
        background: var(--accent);
        color: #000;
        @include glow(var(--accent), 1);
        
        svg {
          transform: translateY(2px) rotate(0deg);
        }
      }
    }
    
    // Disabled state - but StatusFlair will handle its own disabled styling
    &:disabled:not(:global(.status-flair > *)),
    &.disabled:not(:global(.status-flair > *)) {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
      
      &:hover {
        transform: none;
        box-shadow: 0 2px 0 var(--border);
      }
      
      svg {
        transform: none;
      }
    }
  }
  
  @keyframes pulse-subtle {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }
  
  .btn-primary {
    @include arcade-button(var(--accent), var(--accent-dark));
    padding: 8px 20px;
    font-size: 0.9em;
  }
}
  
  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--danger);
    transition: all 0.3s ease;
    position: relative;
    
    &.connected {
      background: var(--success);
      @include glow(var(--success), 1);
      animation: float 3s ease-in-out infinite;
    }
    
    &.connecting {
      background: var(--warning);
      @include status-pulse(var(--warning));
    }
  }
</style>

