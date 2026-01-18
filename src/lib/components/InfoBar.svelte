<script lang="ts">
  /**
   * Info Bar Component
   * 
   * Horizontal scrolling information bar showing high-level important information.
   * Positioned between header and navigation.
   * 
   * Features:
   * - Current scene display with smart picker
   * - Quick scene swap buttons (sorted by activity)
   * - Horizontal scrolling for multiple info items
   * - Animated value updates
   * - Connection status awareness
   */
  
  import { onMount } from 'svelte';
  import { connected, currentScene } from '../../stores/connection';
  import { animate } from '../../core/animations';
  import { Sources } from '../../modules/sources';
  import { sortScenesByActivity, getTopScenes } from '../../modules/scene-activity';
  import ScenePicker from './ScenePicker.svelte';
  
  let sceneList: Array<{ sceneName: string; sceneIndex: number }> = [];
  let hasLoadedScenes = false;
  let activityData: Array<{ sceneName: string; count: number }> = [];
  let scenePickerVisible = false;
  let scenePickerContainer: HTMLDivElement;
  let scenePickerTrigger: HTMLButtonElement;
  
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
      console.log('[InfoBar] Raw scenes from OBS:', Sources.allScenes);
      
      // Fetch scene activity data from API
      activityData = await getTopScenes(20);
      console.log('[InfoBar] Activity data from API:', activityData);
      
      // Sort scenes by activity (most used first), with OBS order as tiebreaker
      const beforeSort = [...Sources.allScenes];
      sceneList = sortScenesByActivity(Sources.allScenes, activityData);
      
      console.log('[InfoBar] BEFORE sort (OBS order):', 
        beforeSort.map(s => `${s.sceneName} [idx:${s.sceneIndex}]`)
      );
      console.log('[InfoBar] AFTER sort (activity-based):', 
        sceneList.map(s => {
          const activity = activityData.find(a => a.sceneName === s.sceneName);
          return `${s.sceneName} [idx:${s.sceneIndex}, count:${activity?.count || 0}]`;
        })
      );
      
      hasLoadedScenes = true;
    } catch (e) {
      console.error('[InfoBar] Failed to load scene list:', e);
    }
  }
  
  async function updateSceneList(): Promise<void> {
    // Update from Sources module without triggering a full refresh
    const currentScenes = Sources.allScenes;
    if (currentScenes.length > 0) {
      // Re-fetch activity data for up-to-date sorting
      try {
        const beforeSort = [...currentScenes];
        activityData = await getTopScenes(20);
        
        // Sort scenes by activity (most used first), with OBS order as tiebreaker
        sceneList = sortScenesByActivity(currentScenes, activityData);
        
        console.log('[InfoBar] Updated scene list - BEFORE:', 
          beforeSort.map(s => `${s.sceneName} [idx:${s.sceneIndex}]`)
        );
        console.log('[InfoBar] Updated scene list - AFTER:', 
          sceneList.map(s => {
            const activity = activityData.find(a => a.sceneName === s.sceneName);
            return `${s.sceneName} [idx:${s.sceneIndex}, count:${activity?.count || 0}]`;
          })
        );
      } catch (e) {
        console.warn('[InfoBar] Failed to fetch activity data, using unsorted list:', e);
        sceneList = currentScenes;
      }
    }
  }
  
  async function handleSceneSwitch(sceneName: string): Promise<void> {
    await Sources.switchToScene(sceneName);
    // Scene list will update automatically via the reactive statement when currentScene changes
  }
  
  function toggleScenePicker() {
    scenePickerVisible = !scenePickerVisible;
  }
  
  function handleScenePickerSelect(event: CustomEvent<string>) {
    handleSceneSwitch(event.detail);
  }
  
  onMount(() => {
    if ($connected) {
      loadSceneList();
    }
  });
</script>

<div class="info-bar">
  <!-- Fixed "Current Scene:" section (doesn't scroll) -->
  <div class="info-item info-item--fixed" bind:this={scenePickerContainer}>
    <span class="info-item__label">Current Scene:</span>
    {#if $connected && $currentScene}
      <button
        bind:this={scenePickerTrigger}
        class="info-item__value info-item__value--active info-item__value--clickable"
        on:click={toggleScenePicker}
        title="Click to open scene picker"
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
        <span class="info-item__dropdown-icon">▼</span>
      </button>
      
      <ScenePicker
        visible={scenePickerVisible}
        currentSceneName={$currentScene}
        triggerElement={scenePickerTrigger}
        on:select={handleScenePickerSelect}
        on:close={() => scenePickerVisible = false}
      />
    {:else}
      <span class="info-item__value info-item__value--inactive">Not connected</span>
    {/if}
  </div>
  
  <!-- Scrollable scene buttons section -->
  <div class="info-bar__content">
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
  </div>
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  
  .info-bar {
    background: var(--bg-dark);
    border-bottom: 1px solid var(--border);
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 16px;
    @include gpu-accelerated;
  }
  
  .info-bar__content {
    display: flex;
    gap: 24px;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1;
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
  
  .info-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    flex-shrink: 0;
    
    &.info-item--fixed {
      // Fixed position - doesn't scroll
      flex-shrink: 0;
      z-index: 10; // Above scrollable content, below dropdown
    }
  }
  
  .info-item .info-item__label {
    color: var(--text-secondary);
    font-size: 0.85em;
    font-weight: 500;
  }
  
  .info-item .info-item__value {
    font-size: 0.9em;
    font-weight: 600;
    
    &.info-item__value--clickable {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      
      &:hover {
        background: rgba(237, 174, 73, 0.1);
        border-color: var(--accent);
        
        .info-item__dropdown-icon {
          transform: translateY(1px);
        }
      }
      
      &:active {
        transform: scale(0.98);
      }
    }
  }
  
  .info-item .info-item__value--active {
    color: var(--accent);
  }
  
  .info-item .info-item__value--inactive {
    color: var(--muted);
    font-style: italic;
  }
  
  .info-item__dropdown-icon {
    font-size: 0.7em;
    opacity: 0.7;
    transition: transform 0.2s ease;
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

