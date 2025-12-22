<script lang="ts">
  /**
   * Sliding Filter Aside for Activity Log
   * 
   * Slides in from off-screen (left) to push log content
   * Shares width with activity log area
   */
  
  import { onMount, onDestroy } from 'svelte';
  import {
    logFilters,
    toggleLogTypeFilter,
    setLogSearchQuery,
    clearLogSearch,
    type LogType
  } from '../stores/activity-log';
  
  const logTypes: LogType[] = ['info', 'success', 'error', 'warning', 'debug'];
  
  export let expanded = false;
  
  export function toggleExpanded(): void {
    expanded = !expanded;
  }
  
  let filterAside: HTMLDivElement;
  let contentWrapper: HTMLDivElement;
  let resizeObserver: ResizeObserver | null = null;
  
  onMount(() => {
    // Watch for parent height changes to ensure proper scrolling
    // The absolutely positioned element with top:0; bottom:0 should automatically
    // adjust to parent height, but we observe to ensure the scrollable content
    // area updates correctly when the split-log panel is resized
    if (filterAside) {
      resizeObserver = new ResizeObserver(() => {
        // Force browser to recalculate layout
        // The flex layout should handle this automatically, but this ensures
        // the scroll container is properly sized when parent height changes
        if (contentWrapper) {
          // Trigger a reflow to ensure scroll container updates
          void contentWrapper.offsetHeight;
        }
      });
      
      // Observe the filter aside container to respond to parent height changes
      resizeObserver.observe(filterAside);
      
      // Also try to observe the parent if available
      const parent = filterAside.parentElement;
      if (parent) {
        resizeObserver.observe(parent);
      }
    }
  });
  
  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });
</script>

<div class="activity-log-filter-aside" class:expanded={expanded} bind:this={filterAside}>
  <div class="filter-aside__wrapper">
    <div class="filter-aside__content" bind:this={contentWrapper}>
    <!-- Search at the top -->
    <div class="filter-aside__section">
      <h3 class="filter-aside__title">Search</h3>
      <div class="filter-aside__search">
        <input
          type="text"
          class="filter-aside__search-input"
          placeholder='Search... (use "quotes" for exact, space for AND, | for OR)'
          value={$logFilters.searchQuery}
          on:input={(e) => setLogSearchQuery(e.currentTarget.value)}
        />
        {#if $logFilters.searchQuery.trim()}
          <button
            class="filter-aside__search-clear"
            on:click={clearLogSearch}
            type="button"
            aria-label="Clear search"
            title="Clear search"
          >
            ✕
          </button>
        {/if}
      </div>
      <div class="filter-aside__search-hint">
        <small>Use quotes for exact phrases, space for AND, | for OR</small>
      </div>
    </div>
    
    <!-- Filter by Type -->
    <div class="filter-aside__section">
      <div class="filter-aside__section-header">
        <h3 class="filter-aside__title">Filter by Type</h3>
        <button
          class="filter-aside__quick-action"
          on:click={() => {
            const allActive = logTypes.every(type => $logFilters.activeFilters.has(type));
            logTypes.forEach(type => {
              if (allActive && $logFilters.activeFilters.has(type)) {
                toggleLogTypeFilter(type);
              } else if (!allActive && !$logFilters.activeFilters.has(type)) {
                toggleLogTypeFilter(type);
              }
            });
          }}
          type="button"
          title={logTypes.every(type => $logFilters.activeFilters.has(type)) ? 'Deselect all' : 'Select all'}
        >
          {logTypes.every(type => $logFilters.activeFilters.has(type)) ? 'None' : 'All'}
        </button>
      </div>
      <div class="filter-aside__options">
        {#each logTypes as type}
          {@const isActive = $logFilters.activeFilters.has(type)}
          <label class="filter-option" class:active={isActive}>
            <input
              type="checkbox"
              checked={isActive}
              on:change={() => toggleLogTypeFilter(type)}
            />
            <span class="filter-option__label">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
          </label>
        {/each}
      </div>
    </div>
    
    <!-- Quick Filters -->
    <div class="filter-aside__section">
      <h3 class="filter-aside__title">Quick Filters</h3>
      <div class="filter-aside__quick-filters">
        <button
          class="filter-aside__quick-filter"
          on:click={() => {
            logTypes.forEach(type => {
              if (type === 'error' && !$logFilters.activeFilters.has(type)) {
                toggleLogTypeFilter(type);
              } else if (type !== 'error' && $logFilters.activeFilters.has(type)) {
                toggleLogTypeFilter(type);
              }
            });
          }}
          type="button"
        >
          Errors Only
        </button>
        <button
          class="filter-aside__quick-filter"
          on:click={() => {
            logTypes.forEach(type => {
              if ((type === 'error' || type === 'warning') && !$logFilters.activeFilters.has(type)) {
                toggleLogTypeFilter(type);
              } else if (type !== 'error' && type !== 'warning' && $logFilters.activeFilters.has(type)) {
                toggleLogTypeFilter(type);
              }
            });
          }}
          type="button"
        >
          Errors & Warnings
        </button>
      </div>
    </div>
    </div>
  </div>
</div>

<style lang="scss">
  @use '@styles/mixins' as *;
  
  .activity-log-filter-aside {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    left: auto;
    width: 280px;
    background: var(--card);
    border-left: 1px solid var(--border);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    z-index: 10;
    display: flex;
    flex-direction: column;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  
  .activity-log-filter-aside.expanded {
    transform: translateX(0);
  }
  
  .activity-log-filter-aside .filter-aside__wrapper {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .activity-log-filter-aside .filter-aside__content {
    flex: 1;
    min-height: 0;
    padding: 20px;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: 24px;
    -webkit-overflow-scrolling: touch;
    box-sizing: border-box;
  }
  
  .activity-log-filter-aside .filter-aside__content::-webkit-scrollbar {
    width: 6px;
  }
  
  .activity-log-filter-aside .filter-aside__content::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .activity-log-filter-aside .filter-aside__content::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }
  
  .activity-log-filter-aside .filter-aside__content::-webkit-scrollbar-thumb:hover {
    background: var(--border-light);
  }
  
  .activity-log-filter-aside .filter-aside__section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex-shrink: 0;
  }
  
  .activity-log-filter-aside .filter-aside__title {
    font-size: 0.8em;
    font-weight: 600;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin: 0 0 12px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  
  .activity-log-filter-aside .filter-aside__options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .activity-log-filter-aside .filter-aside__search {
    position: relative;
    display: flex;
    align-items: center;
  }
  
  .activity-log-filter-aside .filter-aside__search-input {
    width: 100%;
    padding: 10px 32px 10px 12px;
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 0.9em;
    transition: all 0.2s ease;
  }
  
  .activity-log-filter-aside .filter-aside__search-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.1);
  }
  
  .activity-log-filter-aside .filter-aside__search-input::placeholder {
    color: var(--muted);
    font-size: 0.85em;
  }
  
  .activity-log-filter-aside .filter-aside__search-clear {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 4px 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85em;
    border-radius: 4px;
    transition: all 0.2s ease;
  }
  
  .activity-log-filter-aside .filter-aside__search-clear:hover {
    color: var(--text);
    background: var(--border);
  }
  
  .activity-log-filter-aside .filter-aside__search-hint {
    margin-top: 6px;
    color: var(--muted);
  }
  
  .activity-log-filter-aside .filter-aside__search-hint small {
    font-size: 0.75em;
    line-height: 1.4;
  }
  
  .activity-log-filter-aside .filter-aside__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  
  .activity-log-filter-aside .filter-aside__quick-action {
    background: transparent;
    border: none;
    color: var(--accent);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
    border-radius: 4px;
    transition: background 0.2s ease;
  }
  
  .activity-log-filter-aside .filter-aside__quick-action:hover {
    background: rgba(237, 174, 73, 0.1);
  }
  
  .activity-log-filter-aside .filter-aside__quick-filters {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .activity-log-filter-aside .filter-aside__quick-filter {
    background: var(--bg-dark);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 8px 12px;
    font-size: 0.85em;
    text-align: left;
    transition: all 0.2s ease;
  }
  
  .activity-log-filter-aside .filter-aside__quick-filter:hover {
    background: var(--border);
    border-color: var(--accent);
    color: var(--text);
  }
  
  .activity-log-filter-aside .filter-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  }
  
  .activity-log-filter-aside .filter-option:hover {
    background: var(--bg-dark);
  }
  
  .activity-log-filter-aside .filter-option:hover .filter-option__label {
    color: var(--text);
  }
  
  .activity-log-filter-aside .filter-option.active {
    background: rgba(237, 174, 73, 0.1);
  }
  
  .activity-log-filter-aside .filter-option.active .filter-option__label {
    color: var(--accent);
    font-weight: 500;
  }
  
  .activity-log-filter-aside .filter-option.active:hover {
    background: rgba(237, 174, 73, 0.15);
  }
  
  .activity-log-filter-aside .filter-option.active:hover .filter-option__label {
    color: var(--accent-light);
  }
  
  .activity-log-filter-aside .filter-option input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--accent);
    flex-shrink: 0;
  }
  
  .activity-log-filter-aside .filter-option__label {
    color: var(--text);
    font-size: 0.9em;
    text-transform: capitalize;
    flex: 1;
    transition: color 0.2s ease;
  }
  
  .activity-log-filter-aside .filter-option:not(.active) .filter-option__label {
    color: var(--text-secondary);
  }
</style>

