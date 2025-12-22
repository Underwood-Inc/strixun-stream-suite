<script lang="ts">
  /**
   * Activity Log Component
   * 
   * Displays application activity log with search and filtering
   */
  
  import { onMount, onDestroy, tick } from 'svelte';
  import { writable } from 'svelte/store';
  import { storage } from '../modules/storage';
  
  let collapsed = writable(false);
  let searchQuery = writable('');
  let logContainer: HTMLDivElement;
  let splitLog: HTMLDivElement;
  let isResizing = false;
  let startY = 0;
  let startHeight = 0;
  let rafId: number | null = null;
  let pendingHeight: number | null = null;
  
  onMount(async () => {
    // Restore collapsed state
    const saved = storage.get('ui_split_panel') as { collapsed?: boolean; height?: number } | null;
    if (saved?.collapsed) {
      collapsed.set(true);
      // Wait for DOM update
      await tick();
      // Set explicit height for smooth animation
      if (splitLog) {
        splitLog.style.height = '34px';
      }
      // Disable divider if collapsed (don't hide it)
      const divider = document.getElementById('logDivider');
      if (divider) {
        divider.style.pointerEvents = 'none';
        divider.style.opacity = '0.3';
      }
    } else {
      // Restore saved height if not collapsed
      await tick();
      if (saved?.height && splitLog) {
        splitLog.style.height = `${saved.height}px`;
      }
    }
    
    // Setup resize handlers
    const divider = document.getElementById('logDivider');
    if (divider) {
      divider.addEventListener('mousedown', handleResizeStart);
    }
    
    return () => {
      if (divider) {
        divider.removeEventListener('mousedown', handleResizeStart);
      }
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  });
  
  function handleResizeStart(e: MouseEvent): void {
    // Don't allow resizing when collapsed
    if ($collapsed) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    startY = e.clientY;
    if (splitLog) {
      // Read height once at start (single layout read)
      startHeight = splitLog.offsetHeight;
      // Disable CSS transitions during drag for immediate response
      splitLog.classList.add('resizing');
    }
    document.addEventListener('mousemove', handleResize, { passive: false });
    document.addEventListener('mouseup', handleResizeEnd, { once: true });
    const divider = document.getElementById('logDivider');
    if (divider) {
      divider.classList.add('dragging');
    }
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
  }
  
  function handleResize(e: MouseEvent): void {
    if (!isResizing || !splitLog) return;
    e.preventDefault();
    
    // Calculate new height (no DOM reads during drag)
    const deltaY = startY - e.clientY; // Inverted because we're resizing from bottom
    const newHeight = Math.max(100, Math.min(600, startHeight + deltaY));
    
    // Store pending height for RAF
    pendingHeight = newHeight;
    
    // Use RAF to throttle updates to 60fps (prevents layout thrashing)
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (splitLog && pendingHeight !== null) {
          // Single DOM write per frame
          splitLog.style.height = `${pendingHeight}px`;
          pendingHeight = null;
          rafId = null;
        }
      });
    }
  }
  
  function handleResizeEnd(): void {
    if (!isResizing) return;
    
    isResizing = false;
    
    // Cancel any pending RAF
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    
    // Apply final height if pending
    if (splitLog && pendingHeight !== null) {
      splitLog.style.height = `${pendingHeight}px`;
      pendingHeight = null;
    }
    
    // Clean up
    document.removeEventListener('mousemove', handleResize);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    const divider = document.getElementById('logDivider');
    if (divider) {
      divider.classList.remove('dragging');
    }
    
    // Re-enable CSS transitions
    if (splitLog) {
      splitLog.classList.remove('resizing');
      // Save height (single read at end)
      const height = splitLog.offsetHeight;
      storage.set('ui_split_panel', {
        collapsed: $collapsed,
        height: height
      });
    }
  }
  
  onDestroy(() => {
    // Clean up event listeners
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', handleResizeEnd);
    // Cancel any pending RAF
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    // Reset body styles
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
  
  function toggleCollapse(): void {
    // Stop any active resize operation
    if (isResizing) {
      handleResizeEnd();
    }
    
    const currentCollapsed = $collapsed;
    const newVal = !currentCollapsed;
    
    // Save current height before collapsing (if we're about to collapse)
    let savedHeight = 200;
    if (splitLog && currentCollapsed === false) {
      // We're collapsing, save current height first
      savedHeight = splitLog.offsetHeight;
    } else if (splitLog && currentCollapsed === true) {
      // We're expanding, get the saved height
      const saved = storage.get('ui_split_panel') as { height?: number } | null;
      savedHeight = saved?.height || 200;
    }
    
    // Ensure we're not in resizing state (disable drag during collapse)
    if (splitLog) {
      splitLog.classList.remove('resizing');
    }
    
    // Disable divider immediately when collapsing (don't hide it)
    const divider = document.getElementById('logDivider');
    if (divider) {
      if (newVal) {
        // Disable divider - make it non-interactive
        divider.style.pointerEvents = 'none';
        divider.style.opacity = '0.3';
      } else {
        // Re-enable divider when expanding
        divider.style.pointerEvents = '';
        divider.style.opacity = '';
      }
    }
    
    // Set height and class for animation - IMMEDIATE, NO DELAY
    if (splitLog) {
      if (newVal) {
        // Collapsing - capture current height and set inline
        const currentHeight = splitLog.offsetHeight;
        splitLog.style.height = `${currentHeight}px`;
        // Force immediate reflow to register inline height
        void splitLog.offsetHeight;
        // Add collapsed class immediately - browser will transition from inline to CSS height
        splitLog.classList.add('collapsed');
        // Remove inline height after transition completes (for cleanup only)
        setTimeout(() => {
          if (splitLog && $collapsed) {
            splitLog.style.removeProperty('height');
          }
        }, 300);
      } else {
        // Expanding - remove class and set height immediately
        splitLog.classList.remove('collapsed');
        splitLog.style.height = `${savedHeight}px`;
      }
    }
    
    // Update Svelte store
    collapsed.set(newVal);
    
    
    // Save state
    storage.set('ui_split_panel', { 
      collapsed: newVal,
      height: savedHeight
    });
  }
  
  function clearLog(): void {
    if (logContainer) {
      logContainer.innerHTML = '';
    }
    if (window.App?.log) {
      window.App.log('Log cleared', 'info');
    }
  }
  
  function clearSearch(): void {
    searchQuery.set('');
  }
</script>

<div class="split-log" bind:this={splitLog}>
  <div class="split-log__header">
    <button class="split-log__toggle" on:click={toggleCollapse} title="Toggle Log">
      {$collapsed ? '▲' : '▼'}
    </button>
    <span class="split-log__title">Activity Log</span>
    <div class="search-box split-log__search">
      <span class="search-box__icon">🔍</span>
      <input
        type="text"
        class="search-box__input"
        id="logSearchInput"
        placeholder="Search log..."
        bind:value={$searchQuery}
      />
      {#if $searchQuery}
        <button class="search-box__clear" onclick={clearSearch} title="Clear search" type="button">✕</button>
      {/if}
    </div>
    <button class="split-log__clear btn-link" onclick={clearLog}>Clear</button>
  </div>
  <div class="split-log__content" id="log" bind:this={logContainer}></div>
</div>

<style lang="scss">
  @use '@styles/components/log';
</style>

