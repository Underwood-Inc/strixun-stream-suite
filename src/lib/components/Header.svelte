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
  
  import { onMount } from 'svelte';
  import { connected } from '../../stores/connection';
  import { navigateTo } from '../../stores/navigation';
  import { celebrateClick, celebrateConnection } from '../../utils/particles';
  import { showSuccess, showError, showWarning, showInfo } from '../../stores/toast-queue';
  import { isAuthenticated, logout as logoutUser, user } from '../../stores/auth';
  import Tooltip from './Tooltip.svelte';
  import TruncatedText from './TruncatedText.svelte';
  import AlertsDropdown from './ui/AlertsDropdown.svelte';
  
  let statusClass = 'disconnected';
  let reloadButton: HTMLButtonElement;
  let connectButton: HTMLButtonElement;
  let alertsOpen = false;
  
  // Computed values for super admin check
  $: isSuperAdmin = $user?.isSuperAdmin ?? false;
  $: testToastsTooltip = isSuperAdmin 
    ? "Test Toasts | This feature is currently in testing" 
    : "Test Toasts | Super admin only";
  
  function toggleAlerts(): void {
    alertsOpen = !alertsOpen;
  }
  
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
  
  function handleTestToasts(e: MouseEvent): void {
    celebrateClick(e.currentTarget as HTMLElement);
    
    // Test various toast types and behaviors
    setTimeout(() => showSuccess('Operation completed successfully!', { title: 'Success' }), 0);
    setTimeout(() => showError('Failed to connect to server. Please try again.', { title: 'Error', persistent: true }), 100);
    setTimeout(() => showWarning('This action cannot be undone.', { title: 'Warning' }), 200);
    setTimeout(() => showInfo('New features are available. Check the updates page.', { title: 'Information' }), 300);
    setTimeout(() => showSuccess('Data saved successfully!', { title: 'Success' }), 400);
    setTimeout(() => showError('Network timeout. Retrying...', { title: 'Error' }), 500);
    setTimeout(() => showWarning('Low disk space detected.', { title: 'Warning', persistent: true, action: { label: 'Manage', handler: () => console.log('Manage storage') } }), 600);
    setTimeout(() => showInfo('System update available.', { title: 'Update', action: { label: 'Install', handler: () => console.log('Install update') } }), 700);
    setTimeout(() => showSuccess('Settings saved!', { title: 'Success' }), 800);
    setTimeout(() => showError('Permission denied.', { title: 'Error' }), 900);
    setTimeout(() => showWarning('Connection unstable.', { title: 'Warning' }), 1000);
    setTimeout(() => showInfo('Backup completed.', { title: 'Backup' }), 1100);
    
    // Test duplicate merging - trigger same toast multiple times
    setTimeout(() => showWarning('Duplicate test message', { title: 'Test' }), 1200);
    setTimeout(() => showWarning('Duplicate test message', { title: 'Test' }), 1300);
    setTimeout(() => showWarning('Duplicate test message', { title: 'Test' }), 1400);
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
    <Tooltip text="Floating Support Panel | This panel can be dragged, dimmed, and repositioned. Look for the support card in the bottom-right corner!" position="bottom">
      <button class="btn-icon" title="Support Panel Info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </button>
    </Tooltip>
    <AlertsDropdown open={alertsOpen} onToggle={toggleAlerts} />
    {#if $isAuthenticated}
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
    <Tooltip text={testToastsTooltip} position="bottom" level={isSuperAdmin ? "info" : "warning"}>
      <button 
        class="btn-icon in-testing" 
        class:disabled={!isSuperAdmin}
        on:click={handleTestToasts} 
        title="Test Toasts"
        disabled={!isSuperAdmin}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </button>
    </Tooltip>
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
    
    // Disabled state
    &:disabled,
    &.disabled {
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

    // IN TESTING state - override default styles
    &.in-testing {
      @include in-testing-state;
      box-shadow: 0 2px 0 var(--info);
      
      &:hover {
        border-color: var(--info);
        box-shadow: 0 3px 0 var(--info);
        background-image: repeating-linear-gradient(
          45deg,
          rgba(100, 149, 237, 0.12),
          rgba(100, 149, 237, 0.12) 6px,
          rgba(100, 149, 237, 0.16) 6px,
          rgba(100, 149, 237, 0.16) 12px
        );
      }
      
      &:disabled,
      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
        box-shadow: 0 2px 0 var(--border);
        
        &:hover {
          border-color: var(--border);
          box-shadow: 0 2px 0 var(--border);
          background-image: none;
        }
      }
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

