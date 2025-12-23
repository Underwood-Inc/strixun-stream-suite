<script lang="ts">
  /**
   * Header Component
   * 
   * Application header with status indicator and controls
   */
  
  import { onMount } from 'svelte';
  import { connected } from '../stores/connection';
  import { navigateTo } from '../stores/navigation';
  import { celebrateClick, celebrateConnection } from '../utils/particles';
  import { showSuccess, showError, showWarning, showInfo } from '../stores/toast-queue';
  import Tooltip from './Tooltip.svelte';
  import TruncatedText from './TruncatedText.svelte';
  import AlertsDropdown from './ui/AlertsDropdown.svelte';
  
  let statusClass = 'disconnected';
  let reloadButton: HTMLButtonElement;
  let connectButton: HTMLButtonElement;
  let alertsOpen = false;
  
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
    <AlertsDropdown open={alertsOpen} onToggle={toggleAlerts} />
    <Tooltip text="Test Toasts - Demonstrates toast system features" position="bottom">
      <button class="btn-icon" on:click={handleTestToasts} title="Test Toasts">
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
  @use '../styles/animations' as *;
  
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

