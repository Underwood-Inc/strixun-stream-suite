<script lang="ts">
  /**
   * Enhanced Activity Log Component
   * 
   * Features:
   * - Color-coded messages by type
   * - Flairs/badges for special messages
   * - List virtualization for 500+ entries
   * - Type filtering
   * - Search functionality
   * - Auto-scroll to top
   */
  
  import { onDestroy, onMount, tick } from 'svelte';
  import { writable } from 'svelte/store';
  import { storage } from '../modules/storage';
  import {
    addLogEntry,
    clearLogEntries,
    logEntries,
    logFilters,
    visibleLogEntries,
    type LogType
  } from '../stores/activity-log';
  import LogEntry from './LogEntry.svelte';
  import VirtualList from './VirtualList.svelte';
  
  let collapsed = writable(false);
  let splitLog: HTMLDivElement;
  let isResizing = false;
  let startY = 0;
  let startHeight = 0;
  let rafId: number | null = null;
  let pendingHeight: number | null = null;
  let logContainerHeight = 300;
  let resizeObserver: ResizeObserver | null = null;
  
  // Type filter toggles
  const enabledTypes = writable<Set<LogType>>(new Set(['info', 'success', 'error', 'warning', 'debug']));
  
  // Helper to check if type is enabled
  function isTypeEnabled(type: string): boolean {
    return $enabledTypes.has(type as LogType);
  }
  
  // Helper to convert string to LogType
  function toLogType(type: string): LogType {
    return type as LogType;
  }
  
  // Helper to handle search input
  function handleSearchInput(e: Event): void {
    const target = e.target as HTMLInputElement;
    const query = target.value;
    logFilters.update(filters => ({
      ...filters,
      searchQuery: query
    }));
  }
  
  // Helper to clear search
  function clearSearch(): void {
    logFilters.update(filters => ({ ...filters, searchQuery: '' }));
    const input = document.getElementById('logSearchInput') as HTMLInputElement;
    if (input) input.value = '';
  }
  
  // Helper to cast item to LogEntry (for slot typing)
  function asLogEntry(item: unknown): import('../stores/activity-log').LogEntry {
    return item as import('../stores/activity-log').LogEntry;
  }
  
  onMount(async () => {
    // Restore collapsed state
    const saved = storage.get('ui_split_panel') as { collapsed?: boolean; height?: number } | null;
    if (saved?.collapsed) {
      collapsed.set(true);
      await tick();
      if (splitLog) {
        splitLog.style.height = '34px';
      }
      const divider = document.getElementById('logDivider');
      if (divider) {
        divider.style.pointerEvents = 'none';
        divider.style.opacity = '0.3';
      }
    } else {
      await tick();
      if (saved?.height && splitLog) {
        splitLog.style.height = `${saved.height}px`;
        logContainerHeight = saved.height - 34; // Subtract header height
      }
    }
    
    // Setup resize handlers
    const divider = document.getElementById('logDivider');
    if (divider) {
      divider.addEventListener('mousedown', handleResizeStart);
    }
    
    // Update log container height when split log resizes
    resizeObserver = new ResizeObserver(entries => {
      if (!$collapsed && entries[0]) {
        logContainerHeight = entries[0].contentRect.height - 34;
      }
    });
    
    if (splitLog) {
      resizeObserver.observe(splitLog);
    }
  });
  
  function handleResizeStart(e: MouseEvent): void {
    if ($collapsed) return;
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    startY = e.clientY;
    if (splitLog) {
      startHeight = splitLog.offsetHeight;
      splitLog.classList.add('resizing');
    }
    document.addEventListener('mousemove', handleResize, { passive: false });
    document.addEventListener('mouseup', handleResizeEnd, { once: true });
    const divider = document.getElementById('logDivider');
    if (divider) {
      divider.classList.add('dragging');
    }
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
  }
  
  function handleResize(e: MouseEvent): void {
    if (!isResizing || !splitLog) return;
    e.preventDefault();
    
    const deltaY = startY - e.clientY;
    const newHeight = Math.max(100, Math.min(600, startHeight + deltaY));
    pendingHeight = newHeight;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (splitLog && pendingHeight !== null) {
          splitLog.style.height = `${pendingHeight}px`;
          logContainerHeight = pendingHeight - 34;
          pendingHeight = null;
          rafId = null;
        }
      });
    }
  }
  
  function handleResizeEnd(): void {
    if (!isResizing) return;
    
    isResizing = false;
    
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    
    if (splitLog && pendingHeight !== null) {
      splitLog.style.height = `${pendingHeight}px`;
      logContainerHeight = pendingHeight - 34;
      pendingHeight = null;
    }
    
    document.removeEventListener('mousemove', handleResize);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    const divider = document.getElementById('logDivider');
    if (divider) {
      divider.classList.remove('dragging');
    }
    
    if (splitLog) {
      splitLog.classList.remove('resizing');
      const height = splitLog.offsetHeight;
      logContainerHeight = height - 34;
      storage.set('ui_split_panel', {
        collapsed: $collapsed,
        height: height
      });
    }
  }
  
  onDestroy(() => {
    const divider = document.getElementById('logDivider');
    if (divider) {
      divider.removeEventListener('mousedown', handleResizeStart);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', handleResizeEnd);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
  
  function toggleCollapse(): void {
    if (isResizing) {
      handleResizeEnd();
    }
    
    const currentCollapsed = $collapsed;
    const newVal = !currentCollapsed;
    
    let savedHeight = 200;
    if (splitLog && currentCollapsed === false) {
      savedHeight = splitLog.offsetHeight;
    } else if (splitLog && currentCollapsed === true) {
      const saved = storage.get('ui_split_panel') as { height?: number } | null;
      savedHeight = saved?.height || 200;
    }
    
    if (splitLog) {
      splitLog.classList.remove('resizing');
    }
    
    const divider = document.getElementById('logDivider');
    if (divider) {
      if (newVal) {
        divider.style.pointerEvents = 'none';
        divider.style.opacity = '0.3';
      } else {
        divider.style.pointerEvents = '';
        divider.style.opacity = '';
      }
    }
    
    if (splitLog) {
      if (newVal) {
        const currentHeight = splitLog.offsetHeight;
        splitLog.style.height = `${currentHeight}px`;
        void splitLog.offsetHeight;
        splitLog.classList.add('collapsed');
        setTimeout(() => {
          if (splitLog && $collapsed) {
            splitLog.style.removeProperty('height');
          }
        }, 300);
      } else {
        splitLog.classList.remove('collapsed');
        splitLog.style.height = `${savedHeight}px`;
        logContainerHeight = savedHeight - 34;
      }
    }
    
    collapsed.set(newVal);
    
    storage.set('ui_split_panel', { 
      collapsed: newVal,
      height: savedHeight
    });
  }
  
  function clearLog(): void {
    clearLogEntries();
    addLogEntry('Log cleared', 'info', 'CLEARED');
  }
  
  function toggleTypeFilter(type: LogType): void {
    enabledTypes.update(types => {
      const newTypes = new Set(types);
      if (newTypes.has(type)) {
        newTypes.delete(type);
      } else {
        newTypes.add(type);
      }
      logFilters.update(filters => ({
        ...filters,
        types: newTypes
      }));
      return newTypes;
    });
  }
  
</script>

<div class="split-log" bind:this={splitLog}>
  <div class="split-log__header">
    <button class="split-log__toggle" on:click={toggleCollapse} title="Toggle Log">
      {$collapsed ? '▲' : '▼'}
    </button>
    <span class="split-log__title">Activity Log</span>
    
    {#if !$collapsed}
      <div class="split-log__filters">
        {#each ['info', 'success', 'error', 'warning', 'debug'] as type}
          <button
            class="split-log__filter-btn"
            class:active={isTypeEnabled(type)}
            on:click={() => toggleTypeFilter(toLogType(type))}
            title="Toggle {type} messages"
            aria-label="Toggle {type} messages"
          >
            {#if type === 'success'}✅
            {:else if type === 'error'}❌
            {:else if type === 'warning'}⚠️
            {:else if type === 'debug'}🔍
            {:else}ℹ️{/if}
          </button>
        {/each}
      </div>
      
      <div class="split-log__search">
        <div class="search-box">
          <span class="search-box__icon">🔍</span>
          <input
            type="text"
            id="logSearchInput"
            class="search-box__input"
            placeholder="Search log..."
            on:input={handleSearchInput}
          />
          {#if $logFilters.searchQuery}
            <button
              class="search-box__clear"
              on:click={clearSearch}
              title="Clear search"
              type="button"
            >
              ✕
            </button>
          {/if}
        </div>
      </div>
    {/if}
    
    <button class="split-log__clear btn-link" on:click={clearLog}>Clear</button>
  </div>
  
  {#if !$collapsed}
    <div class="split-log__content" id="log">
      {#if $visibleLogEntries.length > 0}
        <VirtualList
          items={$visibleLogEntries}
          itemHeight={60}
          containerHeight={logContainerHeight}
          overscan={3}
        >
          <svelte:fragment let:item let:index>
            <LogEntry entry={asLogEntry(item)} index={index} />
          </svelte:fragment>
        </VirtualList>
      {:else}
        <div class="split-log__empty">
          {#if $logEntries.length === 0}
            <p>No log entries yet</p>
          {:else}
            <p>No entries match your filters</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  @use '@styles/components/log';
  
  .split-log {
    &__filters {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    
    &__filter-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.9em;
      transition: all 0.2s;
      
      &:hover {
        background: var(--border);
        color: var(--text);
      }
      
      &.active {
        background: var(--accent);
        color: #000;
        border-color: var(--accent);
      }
    }
    
    &__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--muted);
      font-style: italic;
    }
  }
</style>
