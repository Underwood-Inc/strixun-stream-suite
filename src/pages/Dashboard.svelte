<script lang="ts">
  /**
   * Dashboard Page
   * 
   * Main dashboard with system status and quick actions
   */
  
  import { onMount } from 'svelte';
  import { connected, currentScene } from '../stores/connection';
  import { navigateTo } from '../stores/navigation';
  
  let systemStatus = 'offline';
  
  onMount(() => {
    updateStatus();
  });
  
  $: {
    systemStatus = $connected ? 'online' : 'offline';
  }
  
  function updateStatus(): void {
    // Update system status display
  }
  
  function cycleAspect(): void {
    if (window.cycleAspect) {
      window.cycleAspect();
    }
  }
  
  function refreshScenes(): void {
    if (window.refreshScenes) {
      window.refreshScenes();
    }
  }
</script>

<div class="page active dashboard-page">
  <!-- Script Status Card -->
  <div class="card" id="dashboardStatusCard">
    <h3>📊 System Status</h3>
    <div id="dashboardScriptStatus">
      <div class="script-status-grid">
        <div class="script-status-item" class:missing={!$connected}>
          <span class="script-status-item__icon">🔌</span>
          <div class="script-status-item__content">
            <span class="script-status-item__name">OBS Connection</span>
            <span class="script-status-item__badge" class:badge-online={$connected} class:badge-offline={!$connected}>
              {$connected ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
      {#if !$connected}
        <p class="hint">
          <button onclick={() => navigateTo('setup')} class="btn-link">
            ⚙️ Go to Setup
          </button>
          to connect to OBS WebSocket
        </p>
      {/if}
    </div>
  </div>
  
  <div class="card">
    <h3>Quick Actions</h3>
    <div class="quick-actions-grid">
      <button
        class="source-btn requires-connection"
        onclick={cycleAspect}
        disabled={!$connected}
      >
        🔄 Cycle Aspect
      </button>
      <button
        class="source-btn requires-connection"
        onclick={refreshScenes}
        disabled={!$connected}
      >
        🔃 Refresh
      </button>
    </div>
  </div>
  
  <div class="card">
    <h3>Current Scene</h3>
    <div id="currentScene" class="current-scene-display">
      {#if $connected && $currentScene}
        <span class="scene-name">{$currentScene}</span>
      {:else}
        <span class="empty-state">Connect to OBS first</span>
      {/if}
    </div>
  </div>
  
  <div class="card">
    <h3>Quick Swaps</h3>
    <div class="quick-swaps-container" id="dashSwapGrid">
      <div class="empty-state">No quick swaps configured</div>
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
    }
  }
  
  .script-status-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .script-status-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-dark);
    border-radius: 6px;
    border: 1px solid var(--border);
    
    &__icon {
      font-size: 1.5em;
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
    }
    
    &__badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      
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
  
  .current-scene-display {
    padding: 16px;
    text-align: center;
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .scene-name {
      font-size: 1.2em;
      font-weight: 600;
      color: var(--accent);
    }
    
    .empty-state {
      color: var(--muted);
      font-style: italic;
    }
  }
  
  .hint {
    margin-top: 12px;
    font-size: 0.9em;
    color: var(--text-secondary);
    
    .btn-link {
      color: var(--accent);
      text-decoration: none;
      font-weight: 500;
      
      &:hover {
        text-decoration: underline;
      }
    }
  }
  
  .quick-actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    @include staggered-grid(0.1s);
  }
  
  .quick-swaps-container {
    min-height: 100px;
    
    .empty-state {
      margin: 0;
    }
  }
</style>

