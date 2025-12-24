<script lang="ts">
  /**
   * Log Entry Component
   * 
   * Renders a single log entry with timestamp, message, flair, and type styling
   */
  
  import type { LogEntry as LogEntryType } from '../../stores/activity-log';
  
  export let entry: LogEntryType;
  export let index: number;
  export let selectionMode = false;
  export let selected = false;
  export let onToggleSelect: () => void = () => {};
  
  // Format timestamp
  $: timestamp = entry.timestamp instanceof Date 
    ? entry.timestamp.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
      })
    : new Date(entry.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
      });
  
  // Alternating background colors (dark blue and dark green)
  $: isEven = index % 2 === 0;
  
  function handleClick(e: MouseEvent): void {
    if (selectionMode) {
      e.preventDefault();
      onToggleSelect();
    }
  }
</script>

<div 
  class="log-entry log-entry--{entry.type}" 
  class:log-entry--even={isEven} 
  class:log-entry--odd={!isEven}
  class:log-entry--selection-mode={selectionMode}
  class:log-entry--selected={selected}
  on:click={handleClick}
  role={selectionMode ? 'checkbox' : undefined}
  aria-checked={selectionMode ? selected : undefined}
  tabindex={selectionMode ? 0 : undefined}
  on:keydown={(e) => {
    if (selectionMode && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onToggleSelect();
    }
  }}
>
  {#if selectionMode}
    <input
      type="checkbox"
      class="log-entry__checkbox"
      checked={selected}
      on:change={onToggleSelect}
      on:click|stopPropagation
    />
  {/if}
  <span class="log-entry__time">[{timestamp}]</span>
  {#if entry.icon}
    <span class="log-entry__icon">{entry.icon}</span>
  {/if}
  <span class="log-entry__text">{entry.message}</span>
  {#if entry.flair}
    <span class="log-entry__flair">{entry.flair}</span>
  {/if}
  {#if entry.count && entry.count > 1}
    <span class="log-entry__count">({entry.count})</span>
  {/if}
</div>

<style lang="scss">
  @use '@styles/variables' as *;
  
  .log-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    font-size: 0.85em;
    border-radius: 4px;
    margin-bottom: 2px;
    min-height: 28px;
    transition: background-color 0.1s ease, border-color 0.1s ease;
    
    &--selection-mode {
      cursor: pointer;
      user-select: none;
      
      &:hover {
        background: rgba(237, 174, 73, 0.15);
      }
    }
    
    &--selected {
      border: 2px solid var(--accent);
      background: rgba(237, 174, 73, 0.2);
    }
    
    &__checkbox {
      width: 16px;
      height: 16px;
      margin: 0;
      cursor: pointer;
      accent-color: var(--accent);
      flex-shrink: 0;
    }
    
    &__time {
      color: var(--muted);
      font-family: monospace;
      min-width: 100px;
      flex-shrink: 0;
    }
    
    &__icon {
      font-size: 1em;
      flex-shrink: 0;
    }
    
    &__text {
      flex: 1;
      color: var(--text);
      word-break: break-word;
    }
    
    &__flair {
      background: var(--accent);
      color: var(--bg);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.75em;
      font-weight: 600;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    
    &__count {
      color: var(--muted);
      font-size: 0.8em;
      flex-shrink: 0;
    }
    
    // Alternating background colors
    &--even {
      background: rgba(100, 149, 237, 0.08); // Dark blue
    }
    
    &--odd {
      background: rgba(40, 167, 69, 0.08); // Dark green
    }
    
    // Type-specific styling
    &--info {
      .log-entry__text {
        color: var(--info);
      }
    }
    
    &--success {
      .log-entry__text {
        color: var(--success);
      }
    }
    
    &--error {
      .log-entry__text {
        color: var(--danger);
      }
    }
    
    &--warning {
      .log-entry__text {
        color: var(--warning);
      }
    }
    
    &--debug {
      .log-entry__text {
        color: var(--muted);
      }
    }
  }
</style>

