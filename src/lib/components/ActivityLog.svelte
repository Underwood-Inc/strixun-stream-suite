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
  let selectedEntries = new Set<string>(); // Set of log entry IDs
  
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
  function asLogEntry(item: unknown): import('../../stores/activity-log').LogEntry {
    return item as import('../../stores/activity-log').LogEntry;
  }
  
  onMount(async () => {
    // Migrate any existing DOM-based log entries to the store
    // This needs to happen BEFORE the component renders to avoid showing old entries
    await tick();
    const logElement = document.getElementById('log');
    if (logElement) {
      const domEntries = Array.from(logElement.querySelectorAll('.log-entry'));
      if (domEntries.length > 0) {
        // Parse existing DOM entries and add them to the store (in reverse order to maintain chronological order)
        const entriesToMigrate: Array<{ message: string; type: 'info' | 'success' | 'error' | 'warning' | 'debug' }> = [];
        
        domEntries.forEach((entry) => {
          const textEl = entry.querySelector('.log-entry__text');
          if (textEl) {
            const message = textEl.textContent || '';
            const className = entry.className || '';
            let type: 'info' | 'success' | 'error' | 'warning' | 'debug' = 'info';
            if (className.includes('success')) type = 'success';
            else if (className.includes('error')) type = 'error';
            else if (className.includes('warning')) type = 'warning';
            else if (className.includes('debug')) type = 'debug';
            
            entriesToMigrate.push({ message, type });
          }
        });
        
        // Add entries to store in reverse order (oldest first, so they appear at bottom)
        for (let i = entriesToMigrate.length - 1; i >= 0; i--) {
          const { message, type } = entriesToMigrate[i];
          addLogEntry(message, type);
        }
        
        // Clear the DOM entries after migration
        logElement.innerHTML = '';
      }
    }
    
    // Restore collapsed state
    const saved = storage.get('ui_split_panel') as { collapsed?: boolean; height?: number } | null;
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
    
    const currentCollapsed = collapsed;
    const newVal = !currentCollapsed;
    
    // Set state immediately for instant UI update
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
    try {
      clearLogEntries();
      selectedEntries.clear();
      addLogEntry('Log cleared', 'info', 'CLEARED');
    } catch (error) {
      // Error already handled, just log to console as fallback
      console.error('[ActivityLog] Error clearing log:', error);
    }
  }
  
  function toggleSelectionMode(): void {
    if (selectionMode) {
      // Exiting selection mode - clear all selections
      selectedEntries.clear();
      selectedEntries = selectedEntries; // Trigger reactivity
    }
    selectionMode = !selectionMode;
  }
  
  function toggleEntrySelection(entryId: string): void {
    if (selectedEntries.has(entryId)) {
      selectedEntries.delete(entryId);
    } else {
      selectedEntries.add(entryId);
    }
    selectedEntries = selectedEntries; // Trigger reactivity
  }
  
  function selectAll(): void {
    $visibleLogEntries.forEach(entry => {
      selectedEntries.add(entry.id);
    });
    selectedEntries = selectedEntries; // Trigger reactivity
  }
  
  function deselectAll(): void {
    selectedEntries.clear();
    selectedEntries = selectedEntries; // Trigger reactivity
  }
  
  function copySelected(): void {
    if (selectedEntries.size === 0) {
      addLogEntry('No entries selected', 'warning', 'COPY');
      return;
    }
    
    // Get selected entries in order (newest first, matching display order)
    const selected = $visibleLogEntries
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
    
    // Copy to clipboard
    navigator.clipboard.writeText(selected).then(() => {
      addLogEntry(`Copied ${selectedEntries.size} log entr${selectedEntries.size === 1 ? 'y' : 'ies'} to clipboard`, 'success', 'COPY');
      // Optionally exit selection mode after copying
      // selectionMode = false;
      // selectedEntries.clear();
    }).catch(err => {
      addLogEntry(`Failed to copy: ${err instanceof Error ? err.message : String(err)}`, 'error', 'COPY');
    });
  }
  
  // Toggle filter is now handled by the reusable filter state system
  
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
        {#if $visibleLogEntries.length > 0}
          <VirtualList
          items={$visibleLogEntries}
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
