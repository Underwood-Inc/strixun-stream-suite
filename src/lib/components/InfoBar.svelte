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
  import { Sources } from '../../modules/sources';
  import { sortScenesByActivity, getTopScenes } from '../../modules/scene-activity';
  import Select from './primitives/Select/Select.svelte';
  
  let sceneList: Array<{ sceneName: string; sceneIndex: number }> = [];
  let hasLoadedScenes = false;
  let activityData: Array<{ sceneName: string; count: number }> = [];
  
  // Convert scenes to Select component format
  $: sceneSelectItems = sceneList.map(scene => ({
    value: scene.sceneName,
    label: scene.sceneName,
    badge: activityData.find(a => a.sceneName === scene.sceneName)?.count
  }));
  
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
  
  function handleSceneSelectChange(event: CustomEvent<{ value: string }>) {
    handleSceneSwitch(event.detail.value);
  }
  
  onMount(() => {
    if ($connected) {
      loadSceneList();
    }
  });
</script>

<div class="info-bar">
  <!-- Fixed "Current Scene:" section with dropdown (doesn't scroll) -->
  <div class="info-item info-item--fixed info-item--with-dropdown">
    <span class="info-item__label">Current Scene:</span>
    {#if $connected && $currentScene}
      <div class="info-item__scene-select">
        <Select
          value={$currentScene}
          items={sceneSelectItems}
          placeholder="Select Scene"
          disabled={!$connected}
          searchable={true}
          on:change={handleSceneSelectChange}
        />
      </div>
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
      z-index: 1; // Below dropdown
    }
    
    &.info-item--with-dropdown {
      // Allow dropdown to overflow
      min-width: 200px;
    }
  }
  
  .info-item__scene-select {
    min-width: 150px;
    max-width: 250px;
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

