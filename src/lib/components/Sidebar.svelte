<script lang="ts">
  /**
   * Sidebar Component
   * 
   * Collapsible sidebar content for the FloatingPanel.
   * Displays useful information, quick links, and shortcuts.
   */

  import { onMount } from 'svelte';
  import { connected, currentScene } from '../../stores/connection';

  interface SwapConfig {
    name: string;
    sourceA: string;
    sourceB: string;
    style?: string;
    duration?: number;
    easing?: string;
    preserveAspect?: boolean;
  }

  let swapConfigs: SwapConfig[] = [];

  function loadSwapConfigs(): void {
    if ((window as any).SourceSwaps?.getConfigs) {
      swapConfigs = (window as any).SourceSwaps.getConfigs() || [];
    }
  }

  function handleLoadSwapConfig(index: number): void {
    if ((window as any).SourceSwaps?.loadSwapConfig) {
      (window as any).SourceSwaps.loadSwapConfig(index);
    }
  }

  function handleCycleAspect(): void {
    if ($connected && (window as any).cycleAspect) {
      (window as any).cycleAspect();
    }
  }

  async function handleRefreshScenes(): Promise<void> {
    if ($connected && (window as any).Sources?.refreshScenes) {
      await (window as any).Sources.refreshScenes();
    }
  }

  function handleToggleTextCycler(): void {
    if ((window as any).TextCycler) {
      const isRunning = (window as any).TextCycler.isRunning();
      if (isRunning) {
        (window as any).TextCycler.stopTextCycler();
      } else {
        (window as any).TextCycler.startTextCycler();
      }
    }
  }

  // Load swap configs on mount and when connection changes
  onMount(() => {
    loadSwapConfigs();
    
    // Listen for swap config changes
    const handleSwapConfigsChanged = () => {
      loadSwapConfigs();
    };
    
    window.addEventListener('swapConfigsChanged', handleSwapConfigsChanged);
    
    return () => {
      window.removeEventListener('swapConfigsChanged', handleSwapConfigsChanged);
    };
  });

  // Reload configs when connection changes
  $: if ($connected) {
    loadSwapConfigs();
  }
</script>

<div class="sidebar">
  <!-- System Status -->
  <div class="sidebar__section">
    <h3 class="sidebar__title">System Status</h3>
    <div class="sidebar__status">
      <div class="sidebar__status-item">
        <span class="sidebar__status-icon">❓</span>
        <span class="sidebar__status-label">OBS</span>
        <span class="sidebar__status-badge" class:sidebar__status-badge--online={$connected} class:sidebar__status-badge--offline={!$connected}>
          {$connected ? 'Online' : 'Offline'}
        </span>
      </div>
      {#if $connected && $currentScene}
        <div class="sidebar__status-item">
          <span class="sidebar__status-icon">❓</span>
          <span class="sidebar__status-label">Scene</span>
          <span class="sidebar__status-value">{$currentScene}</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="sidebar__section">
    <h3 class="sidebar__title">Quick Actions</h3>
    <div class="sidebar__actions">
      <button
        class="sidebar__action"
        on:click={handleCycleAspect}
        disabled={!$connected}
        title="Cycle aspect ratio override"
      >
        🔄 Cycle Aspect
      </button>
      <button
        class="sidebar__action"
        on:click={handleRefreshScenes}
        disabled={!$connected}
        title="Refresh scene sources"
      >
        ❓ Refresh
      </button>
      <button
        class="sidebar__action"
        on:click={handleToggleTextCycler}
        disabled={!$connected}
        title="Toggle text cycler (Space)"
      >
        📝 Toggle Text Cycler
      </button>
    </div>
  </div>

  <!-- Quick Swaps -->
  {#if swapConfigs.length > 0}
    <div class="sidebar__section">
      <h3 class="sidebar__title">Quick Swaps</h3>
      <div class="sidebar__swaps">
        {#each swapConfigs.slice(0, 9) as config, index}
          <button
            class="sidebar__swap-item"
            on:click={() => handleLoadSwapConfig(index)}
            disabled={!$connected}
            title="Press {index + 1} or click to load"
          >
            <span class="sidebar__swap-key">{index + 1}</span>
            <span class="sidebar__swap-name">{config.name}</span>
          </button>
        {/each}
        {#if swapConfigs.length > 9}
          <div class="sidebar__swap-more">
            +{swapConfigs.length - 9} more (see Swaps page)
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Hotkey Reference -->
  <div class="sidebar__section">
    <h3 class="sidebar__title">Hotkeys</h3>
    <div class="sidebar__hotkeys">
      <div class="sidebar__hotkey-item">
        <span class="sidebar__hotkey-key">1-9</span>
        <span class="sidebar__hotkey-desc">Load swap config</span>
      </div>
      <div class="sidebar__hotkey-item">
        <span class="sidebar__hotkey-key">Space</span>
        <span class="sidebar__hotkey-desc">Toggle text cycler</span>
      </div>
      <div class="sidebar__hotkey-item">
        <span class="sidebar__hotkey-key">OBS</span>
        <span class="sidebar__hotkey-desc">Cycle aspect (assign in OBS)</span>
      </div>
    </div>
  </div>

  <!-- Quick Links -->
  <div class="sidebar__section">
    <h3 class="sidebar__title">Quick Links</h3>
    <div class="sidebar__links">
      <a
        href="https://modrinth.com/user/strixun"
        target="_blank"
        rel="noopener noreferrer"
        class="sidebar__link"
      >
        📦 Modrinth Profile
      </a>
      <a
        href="https://github.com/strixun"
        target="_blank"
        rel="noopener noreferrer"
        class="sidebar__link"
      >
        💻 GitHub
      </a>
    </div>
  </div>

</div>

<style lang="scss">
  @use '@styles/mixins' as *;

  .sidebar {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
    @include scrollbar(6px);
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .sidebar__section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sidebar__title {
    margin: 0;
    font-size: 0.85em;
    font-weight: 600;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  .sidebar__status {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sidebar__status-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9em;
  }

  .sidebar__status-icon {
    font-size: 1.1em;
    flex-shrink: 0;
  }

  .sidebar__status-label {
    flex: 1;
    color: var(--text-secondary);
  }

  .sidebar__status-badge {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    
    &.sidebar__status-badge--online {
      background: rgba(40, 167, 69, 0.2);
      color: var(--success);
      border: 1px solid var(--success);
    }
    
    &.sidebar__status-badge--offline {
      background: rgba(234, 43, 31, 0.2);
      color: var(--danger);
      border: 1px solid var(--danger);
    }
  }

  .sidebar__status-value {
    color: var(--text);
    font-weight: 500;
    font-size: 0.9em;
  }

  .sidebar__actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sidebar__action {
    padding: 8px 12px;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 0.9em;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    
    &:hover:not(:disabled) {
      background: var(--card);
      border-color: var(--accent);
      color: var(--accent);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .sidebar__links {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sidebar__link {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    text-decoration: none;
    font-size: 0.9em;
    transition: all 0.2s;
    
    &:hover {
      background: var(--card);
      border-color: var(--accent);
      color: var(--accent);
    }
  }


  .sidebar__swaps {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sidebar__swap-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 0.85em;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    
    &:hover:not(:disabled) {
      background: var(--card);
      border-color: var(--accent);
      color: var(--accent);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .sidebar__swap-key {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    background: var(--accent);
    color: #000;
    border-radius: 3px;
    font-size: 0.75em;
    font-weight: 700;
    flex-shrink: 0;
  }

  .sidebar__swap-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar__swap-more {
    padding: 6px 10px;
    color: var(--text-secondary);
    font-size: 0.8em;
    font-style: italic;
    text-align: center;
  }

  .sidebar__hotkeys {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sidebar__hotkey-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.85em;
  }

  .sidebar__hotkey-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 50px;
    padding: 4px 8px;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--text);
    font-size: 0.75em;
    font-weight: 600;
    font-family: 'Courier New', monospace;
    flex-shrink: 0;
  }

  .sidebar__hotkey-desc {
    flex: 1;
    color: var(--text-secondary);
    font-size: 0.85em;
  }
</style>

