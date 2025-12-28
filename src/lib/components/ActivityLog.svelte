<script lang="ts">
  /**
   * Enhanced Activity Log Component
   * 
   * SIMPLIFIED - Direct store subscription, no bullshit
   */

  import { onDestroy, onMount, tick } from 'svelte';
  import { storage } from '../../modules/storage';
  import {
    addLogEntry,
    clearLogEntries,
    logEntries,
    visibleLogEntries
  } from '../../stores/activity-log';
  import ActivityLogFilterAside from './ActivityLogFilterAside.svelte';
  import LogEntry from './LogEntry.svelte';
  import Tooltip from './Tooltip.svelte';
  import VirtualList from './VirtualList.svelte';
  import { ChevronButton } from './primitives/ChevronButton';

  let collapsed = false;
  let filterExpanded = false;
  let selectionMode = false;
  let selectedEntries = new Set<string>();

  // DIRECT store subscriptions - Svelte auto-subscription
  // These will trigger re-renders when stores update
  $: allEntries = $logEntries;
  $: visibleEntries = $visibleLogEntries;
  $: displayItems = visibleEntries.length > 0 ? visibleEntries : allEntries;
  $: hasEntries = displayItems.length > 0;

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

  // Helper to cast item to LogEntry
  function asLogEntry(item: unknown): import('../../stores/activity-log').LogEntry {
    return item as import('../../stores/activity-log').LogEntry;
  }

  onMount(async () => {
    await tick();
    
    // Restore collapsed state
    let saved: { collapsed?: boolean; height?: number } | null = null;
    try {
      saved = storage.get('ui_split_panel') as { collapsed?: boolean; height?: number } | null;
    } catch (err) {
      saved = null;
    }
    
    if (saved?.collapsed) {
      collapsed = true;
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
          logContainerHeight = saved.height - 34;
        } else {
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
      if (!collapsed && entries[0]) {
        logContainerHeight = entries[0].contentRect.height - 34;
      }
    });
    
    if (splitLog) {
      resizeObserver.observe(splitLog);
    }
  });

  function handleResizeStart(e: MouseEvent): void {
    if (collapsed) return;
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
        collapsed: collapsed,
        height: height
      });
    }
  }

  onDestroy(() => {
    // Cleanup event listeners and observers
    // Testing-library's cleanup() will handle component unmounting,
    // but we need to clean up our event listeners
    try {
      if (typeof document !== 'undefined') {
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
        if (document.body) {
          document.body.style.userSelect = '';
          document.body.style.cursor = '';
        }
      }
    } catch (error) {
      // Ignore errors during cleanup (e.g., in test environment)
      // This can happen if cleanup is called multiple times or in SSR context
    }
  });

  function toggleCollapse(): void {
    if (isResizing) {
      handleResizeEnd();
    }
    
    const currentCollapsed = collapsed;
    const newVal = !currentCollapsed;
    collapsed = newVal;
    
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
        splitLog.classList.add('collapsed');
        splitLog.style.height = '34px';
      } else {
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
    try {
      clearLogEntries();
      selectedEntries.clear();
      addLogEntry('Log cleared', 'info', 'CLEARED');
    } catch (error) {
      console.error('[ActivityLog] Error clearing log:', error);
    }
  }

  function toggleSelectionMode(): void {
    if (selectionMode) {
      selectedEntries.clear();
      selectedEntries = selectedEntries;
    }
    selectionMode = !selectionMode;
  }

  function toggleEntrySelection(entryId: string): void {
    if (selectedEntries.has(entryId)) {
      selectedEntries.delete(entryId);
    } else {
      selectedEntries.add(entryId);
    }
    selectedEntries = selectedEntries;
  }

  function selectAll(): void {
    displayItems.forEach(entry => {
      selectedEntries.add(entry.id);
    });
    selectedEntries = selectedEntries;
  }

  function deselectAll(): void {
    selectedEntries.clear();
    selectedEntries = selectedEntries;
  }

  function copySelected(): void {
    if (selectedEntries.size === 0) {
      addLogEntry('No entries selected', 'warning', 'COPY');
      return;
    }
    
    const selected = displayItems
      .filter(entry => selectedEntries.has(entry.id))
      .map(entry => {
        const timestamp = entry.timestamp instanceof Date 
          ? entry.timestamp.toLocaleString()
          : new Date(entry.timestamp).toLocaleString();
        const type = entry.type.toUpperCase().padEnd(7);
        const flair = entry.flair ? ` [${entry.flair}]` : '';
        const count = entry.count && entry.count > 1 ? ` (${entry.count})` : '';
        return `[${timestamp}] [${type}]${flair} ${entry.message}${count}`;
      })
      .join('\n');
    
    navigator.clipboard.writeText(selected).then(() => {
      addLogEntry(`Copied ${selectedEntries.size} log entr${selectedEntries.size === 1 ? 'y' : 'ies'} to clipboard`, 'success', 'COPY');
    }).catch(err => {
      addLogEntry(`Failed to copy: ${err instanceof Error ? err.message : String(err)}`, 'error', 'COPY');
    });
  }
</script>

<div class="split-log" bind:this={splitLog}>
  <div class="split-log__header">
    <Tooltip text="Toggle Log" position="top">
      <ChevronButton
        direction={collapsed ? 'down' : 'up'}
        onClick={toggleCollapse}
        ariaLabel="Toggle Log"
      />
    </Tooltip>
    <span class="split-log__title">Activity Log</span>
    
    {#if !collapsed}
      <div class="split-log__actions">
        {#if selectionMode}
          <button class="split-log__select-all btn-link" on:click={selectAll}>
            Select All
          </button>
          <button class="split-log__deselect-all btn-link" on:click={deselectAll}>
            Deselect All
          </button>
          <button 
            class="split-log__copy btn-link" 
            on:click={copySelected}
            disabled={selectedEntries.size === 0}
          >
            Copy ({selectedEntries.size})
          </button>
          <button class="split-log__cancel-select btn-link" on:click={toggleSelectionMode}>
            Cancel
          </button>
        {:else}
          <button class="split-log__clear btn-link" on:click={clearLog}>Clear</button>
          <button class="split-log__select-mode btn-link" on:click={toggleSelectionMode}>
            Select
          </button>
          <div class="split-log__actions-spacer"></div>
          <Tooltip text={filterExpanded ? 'Hide filters' : 'Show filters'} position="top">
            <button 
              class="split-log__filter-toggle btn-link" 
              on:click={toggleFilters}
            >
              Filters {filterExpanded ? '◀' : '▶'}
            </button>
          </Tooltip>
        {/if}
      </div>
    {/if}
  </div>
  
  {#if !collapsed}
    <div class="split-log__body">
      <ActivityLogFilterAside bind:expanded={filterExpanded} />
      <div class="split-log__content" id="log">
        {#if hasEntries}
          <VirtualList
            items={displayItems}
            itemHeight={28}
            containerHeight={logContainerHeight}
            overscan={3}
          >
            <svelte:fragment let:item let:index>
              <LogEntry 
                entry={asLogEntry(item)} 
                index={index}
                selectionMode={selectionMode}
                selected={selectedEntries.has(item.id)}
                onToggleSelect={() => toggleEntrySelection(item.id)}
              />
            </svelte:fragment>
          </VirtualList>
        {:else}
          <div class="split-log__empty">
            <p>No log entries yet</p>
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
  
  :global(.filter-aside-resizing) .split-log__content {
    transition: none;
  }
</style>
