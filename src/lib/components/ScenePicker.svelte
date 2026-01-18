<script lang="ts">
  /**
   * Scene Picker Component
   * 
   * Smart dropdown for quick scene switching with:
   * - Real-time search/filter
   * - Scene activity indicators
   * - Keyboard navigation
   * - Click-to-close behavior
   */
  
  import { createEventDispatcher, onMount } from 'svelte';
  import { Sources } from '../../modules/sources';
  import { getTopScenes, sortScenesByActivity } from '../../modules/scene-activity';
  import { currentScene } from '../../stores/connection';
  
  export let visible = false;
  export let currentSceneName = '';
  export let triggerElement: HTMLElement | null = null; // Reference to the button that triggers this
  
  const dispatch = createEventDispatcher();
  
  let sceneList: Array<{ sceneName: string; sceneIndex: number; activityCount?: number }> = [];
  let filteredScenes: Array<{ sceneName: string; sceneIndex: number; activityCount?: number }> = [];
  let searchInput = '';
  let dropdownElement: HTMLDivElement;
  let searchElement: HTMLInputElement;
  let selectedIndex = 0;
  let dropdownPosition = { top: 0, left: 0 };
  
  // Load scenes with activity data
  async function loadScenes() {
    try {
      await Sources.refreshSceneList();
      const activityData = await getTopScenes(50);
      
      // Sort by activity
      const sortedScenes = sortScenesByActivity(Sources.allScenes, activityData);
      
      // Add activity counts
      sceneList = sortedScenes.map(scene => ({
        ...scene,
        activityCount: activityData.find(a => a.sceneName === scene.sceneName)?.count || 0
      }));
      
      filterScenes();
    } catch (e) {
      console.error('[ScenePicker] Failed to load scenes:', e);
    }
  }
  
  // Filter scenes based on search input
  function filterScenes() {
    const query = searchInput.toLowerCase().trim();
    
    if (!query) {
      filteredScenes = sceneList;
    } else {
      filteredScenes = sceneList.filter(scene => 
        scene.sceneName.toLowerCase().includes(query)
      );
    }
    
    // Reset selected index when filter changes
    selectedIndex = 0;
  }
  
  // Handle scene selection
  function selectScene(sceneName: string) {
    dispatch('select', sceneName);
    close();
  }
  
  // Close dropdown
  function close() {
    visible = false;
    searchInput = '';
    dispatch('close');
  }
  
  // Handle keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    if (!visible) return;
    
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredScenes.length - 1);
        scrollToSelected();
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollToSelected();
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredScenes[selectedIndex]) {
          selectScene(filteredScenes[selectedIndex].sceneName);
        }
        break;
    }
  }
  
  // Scroll to selected item
  function scrollToSelected() {
    const selectedElement = dropdownElement?.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  
  // Calculate dropdown position based on trigger element
  function updateDropdownPosition() {
    if (triggerElement) {
      const rect = triggerElement.getBoundingClientRect();
      dropdownPosition = {
        top: rect.bottom + 8,
        left: rect.left
      };
    }
  }
  
  // Click outside to close
  function handleClickOutside(event: MouseEvent) {
    if (visible && dropdownElement && !dropdownElement.contains(event.target as Node)) {
      // Also check if click is on the trigger element
      if (triggerElement && !triggerElement.contains(event.target as Node)) {
        close();
      }
    }
  }
  
  // Watch for visibility changes
  $: if (visible) {
    loadScenes();
    updateDropdownPosition();
    // Focus search input after dropdown opens
    setTimeout(() => searchElement?.focus(), 50);
  }
  
  // Watch for search input changes
  $: {
    searchInput;
    filterScenes();
  }
  
  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

{#if visible}
  <div 
    class="scene-picker" 
    bind:this={dropdownElement}
    style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px;"
  >
    <div class="scene-picker__header">
      <input
        type="text"
        class="scene-picker__search"
        placeholder="Search scenes..."
        bind:value={searchInput}
        bind:this={searchElement}
      />
      <button class="scene-picker__close" on:click={close} title="Close (Esc)">
        ✕
      </button>
    </div>
    
    <div class="scene-picker__list">
      {#if filteredScenes.length === 0}
        <div class="scene-picker__empty">
          {searchInput ? `No scenes matching "${searchInput}"` : 'No scenes available'}
        </div>
      {:else}
        {#each filteredScenes as scene, index}
          <button
            class="scene-picker__item"
            class:scene-picker__item--active={scene.sceneName === currentSceneName}
            class:scene-picker__item--selected={index === selectedIndex}
            data-index={index}
            on:click={() => selectScene(scene.sceneName)}
            on:mouseenter={() => selectedIndex = index}
          >
            <span class="scene-picker__item-name">{scene.sceneName}</span>
            {#if scene.activityCount > 0}
              <span class="scene-picker__item-count" title="{scene.activityCount} switches">
                {scene.activityCount}
              </span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
    
    <div class="scene-picker__footer">
      <span class="scene-picker__hint">↑↓ Navigate • Enter Select • Esc Close</span>
    </div>
  </div>
{/if}

<style lang="scss">
  @use '@styles/animations' as *;
  @use '@styles/mixins' as *;
  
  .scene-picker {
    position: fixed; // Changed from absolute to fixed to escape parent stacking context
    top: auto; // Will be positioned dynamically below the button
    left: auto;
    min-width: 300px;
    max-width: 400px;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 10000; // Very high z-index to appear above everything
    display: flex;
    flex-direction: column;
    max-height: 400px;
    animation: fadeInDown 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    @include gpu-accelerated;
    
    @keyframes fadeInDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  }
  
  .scene-picker__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--border);
  }
  
  .scene-picker__search {
    flex: 1;
    padding: 8px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 0.9em;
    outline: none;
    transition: border-color 0.2s ease;
    
    &:focus {
      border-color: var(--accent);
    }
    
    &::placeholder {
      color: var(--muted);
    }
  }
  
  .scene-picker__close {
    padding: 6px 10px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 1em;
    transition: all 0.2s ease;
    
    &:hover {
      background: var(--danger);
      border-color: var(--danger);
      color: white;
    }
  }
  
  .scene-picker__list {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
    @include scrollbar(8px);
  }
  
  .scene-picker__empty {
    padding: 24px;
    text-align: center;
    color: var(--muted);
    font-size: 0.9em;
    font-style: italic;
  }
  
  .scene-picker__item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    font-size: 0.9em;
    text-align: left;
    @include gpu-accelerated;
    
    &:hover,
    &.scene-picker__item--selected {
      background: rgba(237, 174, 73, 0.1);
      border-color: var(--accent);
      color: var(--text);
    }
    
    &.scene-picker__item--active {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--bg-dark);
      font-weight: 600;
      
      .scene-picker__item-count {
        background: rgba(0, 0, 0, 0.2);
        color: white;
      }
    }
  }
  
  .scene-picker__item-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .scene-picker__item-count {
    margin-left: 8px;
    padding: 2px 8px;
    background: rgba(237, 174, 73, 0.2);
    border-radius: 12px;
    color: var(--accent);
    font-size: 0.75em;
    font-weight: 600;
    min-width: 24px;
    text-align: center;
  }
  
  .scene-picker__footer {
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    background: rgba(0, 0, 0, 0.2);
  }
  
  .scene-picker__hint {
    display: block;
    font-size: 0.75em;
    color: var(--muted);
    text-align: center;
  }
</style>
