<script lang="ts">
  /**
   * Info Bar Component
   * 
   * Horizontal scrolling information bar showing high-level important information.
   * Positioned between header and navigation.
   * 
   * Features:
   * - Current scene display
   * - Quick scene swap buttons
   * - Horizontal scrolling for multiple info items
   * - Animated value updates
   * - Connection status awareness
   */
  
  import { onMount } from 'svelte';
  import { connected, currentScene } from '../../stores/connection';
  import { animate } from '../../core/animations';
  import { Sources } from '../../modules/sources';
  import { sortScenesByActivity } from '../../modules/scene-activity';
  
  let sceneList: Array<{ sceneName: string; sceneIndex: number }> = [];
  let hasLoadedScenes = false;
  
  // Load scene list when connected (only once, or when connection is re-established)
  $: if ($connected && !hasLoadedScenes) {
    loadSceneList();
  }
  
  // Update scene list from Sources module when current scene changes
  // This ensures we have the latest scene list if it was refreshed elsewhere
  $: if ($currentScene && $connected) {
    updateSceneList();
  }
  
  async function loadSceneList(): Promise<void> {
    try {
      await Sources.refreshSceneList();
      // Sort scenes by activity (most used first)
      sceneList = sortScenesByActivity(Sources.allScenes);
      hasLoadedScenes = true;
    } catch (e) {
      console.error('[InfoBar] Failed to load scene list:', e);
    }
  }
  
  function updateSceneList(): void {
    // Update from Sources module without triggering a full refresh
    const currentScenes = Sources.allScenes;
    if (currentScenes.length > 0) {
      // Sort scenes by activity (most used first)
      sceneList = sortScenesByActivity(currentScenes);
    }
  }
  
  async function handleSceneSwitch(sceneName: string): Promise<void> {
    await Sources.switchToScene(sceneName);
    // Scene list will update automatically via the reactive statement when currentScene changes
  }
  
  onMount(() => {
    if ($connected) {
      loadSceneList();
    }
  });
</script>

<div class="info-bar">
  <div class="info-bar__content">
    <div class="info-item">
      <span class="info-item__label">Current Scene:</span>
      {#if $connected && $currentScene}
        <span 
          class="info-item__value info-item__value--active"
          use:animate={{
            preset: 'pulse',
            duration: 400,
            easing: 'easeOutCubic',
            id: 'info-scene-value',
            trigger: 'change',
            enabled: $connected && $currentScene
          }}
        >
          {$currentScene}
        </span>
      {:else}
        <span class="info-item__value info-item__value--inactive">Not connected</span>
      {/if}
    </div>
    
    {#if $connected && sceneList.length > 0}
      <div class="scene-swap-buttons">
        {#each sceneList as scene}
          <button
            class="scene-swap-button"
            class:scene-swap-button--active={scene.sceneName === $currentScene}
            on:click={() => handleSceneSwitch(scene.sceneName)}
            title="Switch to {scene.sceneName}"
          >
            {scene.sceneName}
          </button>
        {/each}
      </div>
    {/if}
    
    <!-- Future info items can be added here for horizontal scrolling -->
  </div>
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  
  .info-bar {
    background: var(--bg-dark);
    border-bottom: 1px solid var(--border);
    padding: 8px 16px;
    overflow-x: auto;
    overflow-y: hidden;
    @include gpu-accelerated;
    
    // Custom scrollbar styling (horizontal scrollbar - thinner)
    &::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 2px;
      
      &:hover {
        background: var(--muted);
      }
    }
    
    &::-webkit-scrollbar-corner {
      background: transparent;
    }
    
    // Firefox scrollbar
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  
  .info-bar__content {
    display: flex;
    gap: 24px;
    align-items: center;
    min-width: max-content;
  }
  
  .info-item {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .info-item .info-item__label {
    color: var(--text-secondary);
    font-size: 0.85em;
    font-weight: 500;
  }
  
  .info-item .info-item__value {
    font-size: 0.9em;
    font-weight: 600;
  }
  
  .info-item .info-item__value--active {
    color: var(--accent);
  }
  
  .info-item .info-item__value--inactive {
    color: var(--muted);
    font-style: italic;
  }
  
  .scene-swap-buttons {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-shrink: 0;
    margin-left: 16px;
  }
  
  .scene-swap-button {
    padding: 4px 12px;
    font-size: 0.8em;
    font-weight: 500;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    @include gpu-accelerated;
  }
  
  .scene-swap-button:hover {
    background: var(--bg-light);
    border-color: var(--accent);
    color: var(--text);
  }
  
  .scene-swap-button:active {
    transform: scale(0.95);
  }
  
  .scene-swap-button.scene-swap-button--active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg-dark);
    font-weight: 600;
  }
  
  .scene-swap-button.scene-swap-button--active:hover {
    background: var(--accent);
    opacity: 0.9;
  }
</style>

