<script lang="ts">
  /**
   * Sliding Filter Aside for Activity Log
   * 
   * Slides in from off-screen (left) to push log content
   * Shares width with activity log area
   */
  
  import { onDestroy, onMount, tick } from 'svelte';
  import { storage } from '../../modules/storage';
  import {
    clearLogSearch,
    logFilters,
    setLogSearchQuery,
    toggleLogTypeFilter,
    type LogType
  } from '../../stores/activity-log';
  import AdvancedSearchInput from '../../../shared-components/search-query-parser/AdvancedSearchInput.svelte';
  
  const logTypes: LogType[] = ['info', 'success', 'error', 'warning', 'debug'];
  
  export let expanded = false;
  
  export function toggleExpanded(): void {
    expanded = !expanded;
  }
  
  let filterAside: HTMLDivElement;
  let contentWrapper: HTMLDivElement;
  let resizeObserver: ResizeObserver | null = null;
  let filterWidth = 280;
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  let rafId: number | null = null;
  let pendingWidth: number | null = null;
  let animationFrameId: number | null = null;
  let animationStartTime: number | null = null;
  let animationStartValue: number = 0;
  let animationTargetValue: number = 0;
  const TRANSITION_DURATION = 300; // 0.3s in milliseconds
  
  // Cubic bezier easing function for cubic-bezier(0.4, 0, 0.2, 1)
  // This matches the CSS transition timing function
  function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
    return (t: number): number => {
      // Use binary search to find the t value that produces the desired x
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      
      let low = 0;
      let high = 1;
      for (let i = 0; i < 10; i++) {
        const mid = (low + high) / 2;
        const x = 3 * (1 - mid) * (1 - mid) * mid * x1 + 3 * (1 - mid) * mid * mid * x2 + mid * mid * mid;
        if (x < t) {
          low = mid;
        } else {
          high = mid;
        }
      }
      const t2 = (low + high) / 2;
      return 3 * (1 - t2) * (1 - t2) * t2 * y1 + 3 * (1 - t2) * t2 * t2 * y2 + t2 * t2 * t2;
    };
  }
  
  const easeCubicBezier = cubicBezier(0.4, 0, 0.2, 1);
  
  // Animate CSS variable smoothly to match filter panel transition
  function animateFilterWidth(targetValue: number): void {
    if (typeof document === 'undefined') return;
    
    // Cancel any existing animation
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    // Get current value from CSS variable
    const currentValueStr = getComputedStyle(document.documentElement)
      .getPropertyValue('--filter-aside-width')
      .trim();
    const currentValue = currentValueStr === '' ? 0 : parseFloat(currentValueStr) || 0;
    
    // If we're already at the target, set it immediately
    if (Math.abs(currentValue - targetValue) < 0.1) {
      document.documentElement.style.setProperty('--filter-aside-width', `${targetValue}px`);
      return;
    }
    
    animationStartValue = currentValue;
    animationTargetValue = targetValue;
    animationStartTime = performance.now();
    
    function animate(currentTime: number): void {
      if (animationStartTime === null) return;
      
      const elapsed = currentTime - animationStartTime;
      const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
      
      // Use cubic-bezier easing to match CSS transition
      const eased = easeCubicBezier(progress);
      
      const current = animationStartValue + (animationTargetValue - animationStartValue) * eased;
      document.documentElement.style.setProperty('--filter-aside-width', `${current}px`);
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        animationFrameId = null;
        animationStartTime = null;
      }
    }
    
    animationFrameId = requestAnimationFrame(animate);
  }
  
  // Update CSS variable when expanded state or width changes
  // Skip animation during manual resize to prevent delay
  $: if (typeof document !== 'undefined' && !isResizing) {
    const targetValue = expanded ? filterWidth : 0;
    animateFilterWidth(targetValue);
  }
  
  onMount(() => {
    // Load saved width
    const saved = storage.get('ui_filter_aside_width') as { width?: number } | null;
    if (saved?.width) {
      filterWidth = Math.max(200, Math.min(600, saved.width));
    }
    
    // Initialize CSS variable immediately to prevent initial snap
    if (typeof document !== 'undefined') {
      const initialValue = expanded ? filterWidth : 0;
      document.documentElement.style.setProperty('--filter-aside-width', `${initialValue}px`);
    }
    
    if (filterAside) {
      filterAside.style.width = `${filterWidth}px`;
      
      // Watch for parent height changes to ensure proper scrolling
      resizeObserver = new ResizeObserver(() => {
        if (contentWrapper) {
          void contentWrapper.offsetHeight;
        }
      });
      
      resizeObserver.observe(filterAside);
      
      const parent = filterAside.parentElement;
      if (parent) {
        resizeObserver.observe(parent);
      }
      
      // Setup resize handle
      const handle = filterAside.querySelector('.filter-aside__resize-handle') as HTMLElement;
      if (handle) {
        const handleMouseDown = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          // Cancel any ongoing animation immediately
          if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            animationStartTime = null;
          }
          isResizing = true;
          startX = e.clientX;
          startWidth = filterAside.offsetWidth;
          filterAside.classList.add('resizing');
          // Add class to document root to disable transitions during resize
          document.documentElement.classList.add('filter-aside-resizing');
          document.addEventListener('mousemove', handleResize);
          document.addEventListener('mouseup', handleResizeEnd);
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'ew-resize';
        };
        
        const handleTouchStart = (e: TouchEvent) => {
          e.preventDefault();
          e.stopPropagation();
          // Cancel any ongoing animation immediately
          if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            animationStartTime = null;
          }
          isResizing = true;
          startX = e.touches[0].clientX;
          startWidth = filterAside.offsetWidth;
          filterAside.classList.add('resizing');
          // Add class to document root to disable transitions during resize
          document.documentElement.classList.add('filter-aside-resizing');
          document.addEventListener('touchmove', handleResizeTouch, { passive: false });
          document.addEventListener('touchend', handleResizeEnd);
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'ew-resize';
        };
        
        handle.addEventListener('mousedown', handleMouseDown);
        handle.addEventListener('touchstart', handleTouchStart);
      }
    }
  });
  
  function handleResize(e: MouseEvent): void {
    if (!isResizing || !filterAside) return;
    e.preventDefault();
    
    const deltaX = startX - e.clientX; // Inverted because handle is on left
    const newWidth = Math.max(200, Math.min(600, startWidth + deltaX));
    pendingWidth = newWidth;
    
    // Update CSS variable immediately for instant response during resize
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--filter-aside-width', `${newWidth}px`);
    }
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (filterAside && pendingWidth !== null) {
          filterWidth = pendingWidth;
          filterAside.style.width = `${pendingWidth}px`;
          pendingWidth = null;
          rafId = null;
        }
      });
    }
  }
  
  function handleResizeTouch(e: TouchEvent): void {
    if (!isResizing || !filterAside) return;
    e.preventDefault();
    
    const deltaX = startX - e.touches[0].clientX;
    const newWidth = Math.max(200, Math.min(600, startWidth + deltaX));
    pendingWidth = newWidth;
    
    // Update CSS variable immediately for instant response during resize
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--filter-aside-width', `${newWidth}px`);
    }
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (filterAside && pendingWidth !== null) {
          filterWidth = pendingWidth;
          filterAside.style.width = `${pendingWidth}px`;
          pendingWidth = null;
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
    
    if (filterAside && pendingWidth !== null) {
      filterWidth = pendingWidth;
      filterAside.style.width = `${pendingWidth}px`;
      // Update CSS variable immediately during resize (no animation)
      document.documentElement.style.setProperty('--filter-aside-width', `${pendingWidth}px`);
      pendingWidth = null;
    }
    
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('touchmove', handleResizeTouch);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.removeEventListener('touchend', handleResizeEnd);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    filterAside?.classList.remove('resizing');
    // Remove class from document root to re-enable transitions
    document.documentElement.classList.remove('filter-aside-resizing');
    
    // Save width (automatically triggers OBS sync via storage.set for 'ui_' keys)
    storage.set('ui_filter_aside_width', { width: filterWidth });
  }
  
  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('touchmove', handleResizeTouch);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.removeEventListener('touchend', handleResizeEnd);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
  
  // This reactive statement is now handled above with requestAnimationFrame for smooth transitions
</script>

<div class="activity-log-filter-aside" class:expanded={expanded} bind:this={filterAside} style="width: {expanded ? filterWidth + 'px' : '280px'}">
  <div class="filter-aside__resize-handle" />
  <div class="filter-aside__wrapper">
    <div class="filter-aside__content" bind:this={contentWrapper}>
    <!-- Search at the top -->
    <div class="filter-aside__section">
      <h3 class="filter-aside__title">Search</h3>
      <AdvancedSearchInput
        value={$logFilters.searchQuery}
        onInput={(value) => setLogSearchQuery(value)}
        onClear={clearLogSearch}
        placeholder='Search... (use "quotes" for exact, space for AND, | for OR)'
      />
    </div>
    
    <!-- Filter by Type -->
    <div class="filter-aside__section">
      <div class="filter-aside__section-header">
        <h3 class="filter-aside__title">Filter by Type</h3>
        <Tooltip 
          text={logTypes.every(type => $logFilters.activeFilters.has(type)) ? 'Deselect all' : 'Select all'} 
          position="bottom"
        >
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
          >
            {logTypes.every(type => $logFilters.activeFilters.has(type)) ? 'None' : 'All'}
          </button>
        </Tooltip>
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
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 10;
    display: flex;
    flex-direction: row;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  
  .activity-log-filter-aside.expanded {
    transform: translateX(0);
  }
  
  .activity-log-filter-aside .filter-aside__resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--border);
    cursor: ew-resize;
    z-index: 20;
    transition: background 0.2s ease;
    flex-shrink: 0;
  }
  
  .activity-log-filter-aside .filter-aside__resize-handle:hover {
    background: var(--border-light);
  }
  
  .activity-log-filter-aside:has(.filter-aside__resize-handle:active) .filter-aside__resize-handle,
  .activity-log-filter-aside.resizing .filter-aside__resize-handle {
    background: var(--accent);
  }
  
  .activity-log-filter-aside.resizing {
    transition: none;
  }
  
  .activity-log-filter-aside .filter-aside__wrapper {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    margin-left: 4px;
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

