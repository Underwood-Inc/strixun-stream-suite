<script lang="ts">
  /**
   * Sliding Filter Aside for Activity Log
   * 
   * Slides in from off-screen (left) to push log content
   * Shares width with activity log area
   */
  
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
</script>

<div class="activity-log-filter-aside" class:expanded={expanded}>
  <div class="filter-aside__content">
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

<style lang="scss">
  @use '@styles/mixins' as *;
  
  .activity-log-filter-aside {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 280px;
    height: 100%;
    max-height: 100%;
    background: var(--card);
    border-left: 1px solid var(--border);
    transform: translateX(100%);
    transition: transform 0.3s ease;
    z-index: 10;
    display: flex;
    flex-direction: column;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    
    &.expanded {
      transform: translateX(0);
    }
    
    &__content {
      flex: 1 1 0;
      min-height: 0;
      max-height: 100%;
      padding: 20px;
      overflow-y: scroll;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 28px;
      -webkit-overflow-scrolling: touch;
      @include scrollbar(6px);
    }
    
    &__section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    &__title {
      font-size: 0.8em;
      font-weight: 600;
      color: var(--text);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin: 0 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    
    &__options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    &__search {
      position: relative;
      display: flex;
      align-items: center;
    }
    
    &__search-input {
      width: 100%;
      padding: 10px 32px 10px 12px;
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 0.9em;
      transition: all 0.2s ease;
      
      &:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(237, 174, 73, 0.1);
      }
      
      &::placeholder {
        color: var(--muted);
        font-size: 0.85em;
      }
    }
    
    &__search-clear {
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
      
      &:hover {
        color: var(--text);
        background: var(--border);
      }
    }
    
    &__search-hint {
      margin-top: 6px;
      color: var(--muted);
      
      small {
        font-size: 0.75em;
        line-height: 1.4;
      }
    }
    
    &__section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    
    &__quick-action {
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
      
      &:hover {
        background: rgba(237, 174, 73, 0.1);
      }
    }
    
    &__quick-filters {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    &__quick-filter {
      background: var(--bg-dark);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 8px 12px;
      font-size: 0.85em;
      text-align: left;
      transition: all 0.2s ease;
      
      &:hover {
        background: var(--border);
        border-color: var(--accent);
        color: var(--text);
      }
    }
  }
  
  .filter-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s ease;
    user-select: none;
    
    &:hover {
      background: var(--bg-dark);
      
      .filter-option__label {
        color: var(--text);
      }
    }
    
    &.active {
      background: rgba(237, 174, 73, 0.1);
      
      .filter-option__label {
        color: var(--accent);
        font-weight: 500;
      }
      
      &:hover {
        background: rgba(237, 174, 73, 0.15);
        
        .filter-option__label {
          color: var(--accent-light);
        }
      }
    }
    
    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      margin: 0;
      cursor: pointer;
      accent-color: var(--accent);
      flex-shrink: 0;
    }
    
    &__label {
      color: var(--text);
      font-size: 0.9em;
      text-transform: capitalize;
      flex: 1;
      transition: color 0.2s ease;
    }
    
    &:not(.active) &__label {
      color: var(--text-secondary);
    }
  }
</style>

