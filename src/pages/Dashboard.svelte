<script lang="ts">
  /**
   * Dashboard Page
   * 
   * Main dashboard with system status and quick actions
   */
  
  import { ModrinthProducts, Tooltip } from '@components';
  import { onMount } from 'svelte';
  import { stagger } from '../core/animations';
  import { EventBus } from '../core/events/EventBus';
  import { connected } from '../stores/connection';
  import { navigateTo } from '../stores/navigation';
  import type { SwapConfig } from '../types';
  
  let hasRefreshedOnConnect = false;
  let swapConfigs: SwapConfig[] = [];
  
  // Track previous connection state to detect changes
  let previousConnected: boolean | undefined = undefined;
  
  // Function to refresh swap configs
  function refreshSwapConfigs(): void {
    if ((window as any).SourceSwaps?.getConfigs) {
      swapConfigs = (window as any).SourceSwaps.getConfigs();
    } else {
      swapConfigs = [];
    }
  }
  
  // Reactive statement to refresh configs when connection actually changes (not on every update)
  $: {
    if ($connected !== previousConnected) {
      previousConnected = $connected;
      if ($connected !== undefined) {
        refreshSwapConfigs();
      }
    }
  }
  
  onMount(() => {
    // Update dashboard status when page loads
    updateDashboardStatus();
    
    // Load swap configs
    if ((window as any).SourceSwaps?.loadConfigs) {
      (window as any).SourceSwaps.loadConfigs();
    }
    refreshSwapConfigs();
    
    // Refresh scenes to get current scene if already connected
    if ($connected && !hasRefreshedOnConnect) {
      handleRefreshScenes();
      hasRefreshedOnConnect = true;
    }
    
    // Listen for swap config changes via EventBus (replaces window events)
    const unsubscribeSwapConfigs = EventBus.on('source-swaps:configs-changed', () => {
      refreshSwapConfigs();
    });
    
    // Also listen for legacy window events (for backward compatibility during migration)
    const handleSwapConfigsChange = () => {
      refreshSwapConfigs();
    };
    window.addEventListener('swapConfigsChanged', handleSwapConfigsChange);
    
    return () => {
      unsubscribeSwapConfigs();
      window.removeEventListener('swapConfigsChanged', handleSwapConfigsChange);
    };
  });
  
  // Update dashboard when connection state actually changes (with change detection)
  $: {
    if ($connected !== previousConnected) {
      previousConnected = $connected;
      
      if ($connected) {
        updateDashboardStatus();
        
        // Refresh scenes to get current scene when connection is established (only once)
        if (!hasRefreshedOnConnect) {
          handleRefreshScenes();
          hasRefreshedOnConnect = true;
        }
      } else {
        // Reset flag when disconnected
        hasRefreshedOnConnect = false;
      }
    }
  }
  
  function updateDashboardStatus(): void {
    // Update system status display
    if ((window as any).ScriptStatus?.updateDashboardStatus) {
      (window as any).ScriptStatus.updateDashboardStatus();
    }
  }
  
  function handleLoadSwapConfig(index: number): void {
    if ((window as any).SourceSwaps?.loadSwapConfig) {
      (window as any).SourceSwaps.loadSwapConfig(index);
    }
  }
  
  async function handleCycleAspect(): Promise<void> {
    // cycleAspect is handled by the Quick Controls Lua script
    // This button triggers the script's hotkey functionality
    if ($connected && (window as any).cycleAspect) {
      (window as any).cycleAspect();
    } else if ($connected) {
      // Fallback: try to trigger via OBS WebSocket if available
      console.log('Cycle Aspect: Requires Quick Controls script to be loaded in OBS');
    }
  }
  
  async function handleRefreshScenes(): Promise<void> {
    if ($connected && (window as any).Sources?.refreshScenes) {
      await (window as any).Sources.refreshScenes();
    }
  }
</script>

<div class="page dashboard-page" use:stagger={{ preset: 'fadeIn', stagger: 100, config: { duration: 300 } }}>
  <!-- Featured Products Carousel - High Visibility -->
  <div class="card featured-products-card">
    <ModrinthProducts />
  </div>
  
  <!-- Status Card -->
  <div class="card status-card" id="dashboardStatusCard">
    <div id="dashboardScriptStatus">
      <div class="script-status-item" class:missing={!$connected}>
        <span class="script-status-item__icon"></span>
        <div class="script-status-item__content">
          <span class="script-status-item__name">OBS Connection</span>
          <span class="script-status-item__badge" class:badge-online={$connected} class:badge-offline={!$connected}>
            {$connected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
      {#if !$connected}
        <div class="status-actions">
          <div class="status-action-item">
            <button 
              on:click={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Dashboard] Navigating to setup...');
                navigateTo('setup');
              }} 
              class="btn-link"
            >
              [SETTINGS] Go to Setup
            </button>
            <span class="action-hint">to connect to OBS WebSocket</span>
          </div>
          <div class="status-action-item">
            <button 
              on:click={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Dashboard] Navigating to installer...');
                navigateTo('install');
              }} 
              class="btn-link"
            >
               Install Scripts
            </button>
            <span class="action-hint">if you haven't already</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Combined Actions and Swaps -->
  <div class="card actions-card">
    <div class="actions-layout">
      <div class="actions-section">
        <h3>Quick Actions</h3>
        <div class="quick-actions-grid">
          <Tooltip 
            text={$connected ? 'Cycle aspect ratio override' : 'Connect to OBS first to use this feature'} 
            position="bottom"
            level={$connected ? 'log' : 'warning'}
          >
            <button
              class="source-btn requires-connection"
              on:click={handleCycleAspect}
              disabled={!$connected}
            >
              [EMOJI] Cycle Aspect
            </button>
          </Tooltip>
          <Tooltip 
            text={$connected ? 'Refresh scene sources' : 'Connect to OBS first to use this feature'} 
            position="bottom"
            level={$connected ? 'log' : 'warning'}
          >
            <button
              class="source-btn requires-connection"
              on:click={handleRefreshScenes}
              disabled={!$connected}
            >
               Refresh
            </button>
          </Tooltip>
        </div>
      </div>
      
      <div class="swaps-section">
        <h3>Quick Swaps</h3>
        <div class="quick-swaps-container">
          <div class="grid">
            {#if swapConfigs.length === 0}
              <div class="empty-state">No quick swaps configured</div>
            {:else}
              {#each swapConfigs as config, index}
                <Tooltip 
                  text={$connected ? `Load swap config: ${config.name}` : 'Connect to OBS first to use quick swaps'} 
                  position="bottom"
                  level={$connected ? 'log' : 'warning'}
                >
                  <button
                    class="source-btn"
                    class:requires-connection={!$connected}
                    on:click={() => handleLoadSwapConfig(index)}
                    disabled={!$connected}
                  >
                    {config.name}
                  </button>
                </Tooltip>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  @use '@styles/components/cards';
  @use '@styles/components/sources';
  @use '../styles/components/staggered' as *;
  
  .dashboard-page {
    max-width: 1200px;
    margin: 0 auto;
    
    > .card {
      @include staggered-cards(0.1s);
      margin-bottom: 20px;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
  }
  
  .featured-products-card {
    overflow: hidden;
    padding: 24px 24px 0 24px;
    margin-bottom: 24px;
    
    // Ensure carousel has proper height
    :global(.modrinth-products) {
      width: 100%;
      height: 300px;
      margin-block-end: 1rem;
    }
    
    :global(.modrinth-products__wrapper) {
      height: 280px;
      max-height: 280px;
      
      @media (max-width: 768px) {
        height: 280px;
        max-height: 280px;
      }
      
      @media (max-width: 480px) {
        height: 280px;
        max-height: 280px;
      }
    }
  }
  
  .status-card {
    padding: 16px;
    
    #dashboardScriptStatus {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
  }
  
  .script-status-item {
    display: flex;
    align-items: center;
    gap: 10px;
    
    &__icon {
      font-size: 1.3em;
      flex-shrink: 0;
    }
    
    &__content {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    
    &__name {
      font-weight: 500;
      color: var(--text);
      font-size: 0.95em;
    }
    
    &__badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.8em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      flex-shrink: 0;
      
      &.badge-online {
        background: rgba(40, 167, 69, 0.2);
        color: var(--success);
        border: 1px solid var(--success);
      }
      
      &.badge-offline {
        background: rgba(234, 43, 31, 0.2);
        color: var(--danger);
        border: 1px solid var(--danger);
      }
    }
    
    &.missing {
      opacity: 0.7;
    }
  }
  
  .status-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
  }
  
  .status-action-item {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    
    .btn-link {
      color: var(--accent);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.9em;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
      transition: all 0.2s;
      white-space: nowrap;
      
      &:hover {
        text-decoration: underline;
      }
    }
    
    .action-hint {
      color: var(--text-secondary);
      font-size: 0.85em;
    }
  }
  
  .actions-card {
    padding: 16px;
  }
  
  .actions-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
      gap: 20px;
    }
  }
  
  .actions-section,
  .swaps-section {
    h3 {
      margin: 0 0 12px 0;
      font-size: 1em;
      font-weight: 600;
      color: var(--text);
    }
  }
  
  .quick-actions-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    @include staggered-grid(0.1s);
    
    > * {
      flex: 0 1 auto;
      min-width: 120px;
      max-width: 200px;
    }
  }
  
  .quick-swaps-container {
    .grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      
      > * {
        flex: 0 1 auto;
        min-width: 120px;
        max-width: 200px;
      }
    }
    
    .empty-state {
      margin: 0;
      text-align: center;
      padding: 12px;
      color: var(--muted);
      font-size: 0.9em;
    }
  }
</style>

