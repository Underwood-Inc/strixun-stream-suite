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
    visibleLogEntries
  } from '../stores/activity-log';
  import ActivityLogFilterAside from './ActivityLogFilterAside.svelte';
  import LogEntry from './LogEntry.svelte';
  import Tooltip from './Tooltip.svelte';
  import VirtualList from './VirtualList.svelte';
  
  let collapsed = writable(false);
  let filterExpanded = false;
  
  function toggleFilters(): void {
    filterExpanded = !filterExpanded;
  }
  let splitLog: HTMLDivElement;
  let isResizing = false;
  let startY = 0;
  let startHeight = 0;
  let rafId: number | null = null;
  let pendingHeight: number | null = null;
  let logContainerHeight = 300;
  let resizeObserver: ResizeObserver | null = null;
  
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
        splitLog.classList.add('collapsed');
        splitLog.style.height = '34px';
      }
      const divider = document.getElementById('logDivider');
      if (divider) {
        divider.style.pointerEvents = 'none';
        divider.style.opacity = '0.3';
      }
    } else {
      await tick();
      if (splitLog) {
        splitLog.classList.remove('collapsed');
        if (saved?.height) {
          splitLog.style.height = `${saved.height}px`;
          logContainerHeight = saved.height - 34; // Subtract header height
        } else {
          // Default height if no saved height
          splitLog.style.height = '200px';
          logContainerHeight = 166;
        }
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
    
    // Set state immediately for instant UI update
    collapsed.set(newVal);
    
    let savedHeight = 200;
    if (splitLog && currentCollapsed === false) {
      savedHeight = splitLog.offsetHeight;
    } else if (splitLog && currentCollapsed === true) {
      const saved = storage.get('ui_split_panel') as { height?: number } | null;
      savedHeight = saved?.height || 200;
    }
    
    if (splitLog) {
      splitLog.classList.remove('resizing');
      
      if (newVal) {
        // Collapsing: immediate collapse
        splitLog.classList.add('collapsed');
        splitLog.style.height = '34px';
      } else {
        // Expanding: remove collapsed class and set height
        splitLog.classList.remove('collapsed');
        splitLog.style.height = `${savedHeight}px`;
        logContainerHeight = savedHeight - 34;
      }
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
    
    storage.set('ui_split_panel', { 
      collapsed: newVal,
      height: savedHeight
    });
  }
  
  function clearLog(): void {
    clearLogEntries();
    addLogEntry('Log cleared', 'info', 'CLEARED');
  }
  
  // Toggle filter is now handled by the reusable filter state system
  
</script>

<div class="split-log" bind:this={splitLog}>
  <div class="split-log__header">
    <Tooltip text="Toggle Log" position="top">
      <button class="split-log__toggle" on:click={toggleCollapse}>
        {$collapsed ? '▼' : '▲'}
      </button>
    </Tooltip>
    <span class="split-log__title">Activity Log</span>
    
    {#if !$collapsed}
      <div class="split-log__actions">
        <button class="split-log__clear btn-link" on:click={clearLog}>Clear</button>
        <div class="split-log__actions-spacer"></div>
        <Tooltip text={filterExpanded ? 'Hide filters' : 'Show filters'} position="top">
          <button 
            class="split-log__filter-toggle btn-link" 
            on:click={toggleFilters}
          >
            Filters {filterExpanded ? '◀' : '▶'}
          </button>
        </Tooltip>
      </div>
    {/if}
  </div>
  
  {#if !$collapsed}
    <div class="split-log__body">
      <ActivityLogFilterAside bind:expanded={filterExpanded} />
      <div class="split-log__content" id="log">
        {#if $visibleLogEntries.length > 0}
        <VirtualList
          items={$visibleLogEntries}
          itemHeight={28}
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
    </div>
  {/if}
</div>

<style lang="scss">
  @use '@styles/components/log';
  
  .split-log {
    position: relative;
    
    &__body {
      display: flex;
      flex: 1;
      overflow: hidden;
      position: relative;
      height: 100%;
      min-height: 0;
    }
    
    &__actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    &__actions-spacer {
      flex: 1;
      min-width: 20px;
    }
    
    &__content {
      flex: 1;
      overflow: hidden;
      transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      margin-right: var(--filter-aside-width, 0px);
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
  
  // Disable transition during manual resize for instant response
  :global(.filter-aside-resizing) .split-log__content {
    transition: none;
  }
</style>
