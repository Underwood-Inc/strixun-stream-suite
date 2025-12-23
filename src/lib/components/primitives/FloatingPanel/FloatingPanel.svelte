<script lang="ts">
  /**
   * FloatingPanel Component
   * 
   * A floating panel that overlays content (doesn't shift it).
   * Supports expand/collapse and horizontal resizing.
   * Renders at body level via portal for proper z-index stacking.
   * 
   * @example
   * ```svelte
   * <FloatingPanel
   *   position="left"
   *   collapsedWidth={40}
   *   expandedWidth={320}
   *   minWidth={200}
   *   maxWidth={600}
   *   storageKey="ui_my-panel"
   * >
   *   <div slot="content">Panel content</div>
   * </FloatingPanel>
   * ```
   */

  import { onMount, onDestroy, tick } from 'svelte';
  import { storage } from '../../../../modules/storage';

  export let position: 'left' | 'right' = 'left';
  export let collapsedWidth: number = 40;
  export let expandedWidth: number = 320;
  export let minWidth: number = 200;
  export let maxWidth: number = 600;
  export let defaultExpanded: boolean = true;
  export let storageKey: string | undefined = undefined;
  export let className: string = '';

  let panel: HTMLDivElement;
  let resizeHandle: HTMLDivElement;
  let portalContainer: HTMLDivElement | null = null;
  
  let isExpanded = defaultExpanded;
  let currentWidth = expandedWidth;
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;
  
  // Store bounds during panel resize to prevent disappearing
  let savedTop = 0;
  let savedHeight = 0;
  
  // Track if activity log is being resized to prevent bounds updates during drag
  let boundsUpdateRaf: number | null = null;
  let lastBoundsUpdate = 0;
  let mutationObserver: MutationObserver | null = null;
  const BOUNDS_UPDATE_THROTTLE = 16; // ~60fps

  // Load persisted state
  $: if (storageKey) {
    const savedState = storage.get(storageKey);
    if (savedState && typeof savedState === 'object') {
      const state = savedState as { expanded?: boolean; width?: number };
      if (state.expanded !== undefined) {
        isExpanded = state.expanded;
      }
      if (state.width !== undefined) {
        currentWidth = Math.max(minWidth, Math.min(maxWidth, state.width));
      }
    }
  }

  // Calculate panel bounds (below nav, above activity log)
  let panelTop = 0;
  let panelBottom = 0;

  function updatePanelBounds(): void {
    if (!panel) return;
    
    // Skip updates when this panel itself is being resized
    // But ensure saved bounds are maintained
    if (isResizing) {
      // Preserve existing bounds during resize
      if (savedTop > 0 && savedHeight > 0) {
        panel.style.top = `${savedTop}px`;
        panel.style.height = `${savedHeight}px`;
      }
      return;
    }
    
    const navigation = document.querySelector('nav.tabs');
    const activityLog = document.querySelector('.split-log');
    const divider = document.getElementById('logDivider');
    
    // Check if activity log is currently being resized (same way activity log does it)
    const isLogResizing = activityLog?.classList.contains('resizing') || 
                          divider?.classList.contains('dragging') || false;
    
    // Skip updates during active resize - will update when resize completes
    if (isLogResizing) {
      return;
    }
    
    const navRect = navigation?.getBoundingClientRect();
    const logRect = activityLog?.getBoundingClientRect();
    
    // Top bound: below navigation
    panelTop = navRect ? navRect.bottom : 0;
    
    // Bottom bound: above activity log (or viewport bottom if log is collapsed)
    if (logRect && logRect.top < window.innerHeight && logRect.top > panelTop) {
      panelBottom = logRect.top;
    } else {
      panelBottom = window.innerHeight;
    }
    
    // Ensure panelTop is always less than panelBottom
    if (panelTop >= panelBottom) {
      // Fallback: use viewport height if calculation is invalid
      panelTop = navRect ? navRect.bottom : 0;
      panelBottom = window.innerHeight;
    }
    
    // Ensure minimum height to prevent panel from disappearing
    const minHeight = 100; // Minimum visible height
    const calculatedHeight = panelBottom - panelTop;
    const finalHeight = Math.max(minHeight, calculatedHeight);
    
    // Ensure final height doesn't exceed viewport
    const maxHeight = window.innerHeight - panelTop;
    const clampedHeight = Math.min(finalHeight, maxHeight);
    
    panel.style.top = `${panelTop}px`;
    panel.style.height = `${clampedHeight}px`;
  }
  
  // Throttled bounds update for ResizeObserver (same pattern as activity log resize)
  function throttledUpdateBounds(): void {
    const now = performance.now();
    
    // Throttle to ~60fps during rapid changes
    if (now - lastBoundsUpdate < BOUNDS_UPDATE_THROTTLE) {
      if (boundsUpdateRaf === null) {
        boundsUpdateRaf = requestAnimationFrame(() => {
          updatePanelBounds();
          lastBoundsUpdate = performance.now();
          boundsUpdateRaf = null;
        });
      }
      return;
    }
    
    // Update immediately if enough time has passed
    updatePanelBounds();
    lastBoundsUpdate = now;
  }

  function toggleExpanded(): void {
    isExpanded = !isExpanded;
    if (!isExpanded) {
      currentWidth = collapsedWidth;
    } else {
      currentWidth = expandedWidth;
    }
    saveState();
  }

  function saveState(): void {
    if (storageKey) {
      storage.set(storageKey, {
        expanded: isExpanded,
        width: currentWidth
      });
    }
  }

  function startResize(e: MouseEvent | TouchEvent): void {
    if (!isExpanded) return;
    
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    
    // Save current bounds before resize starts (use style values, not computed)
    if (panel) {
      const topValue = panel.style.top;
      const heightValue = panel.style.height;
      
      if (topValue) {
        savedTop = parseFloat(topValue) || 0;
      }
      if (heightValue) {
        savedHeight = parseFloat(heightValue) || 0;
      }
      
      // Fallback to getBoundingClientRect if styles aren't set yet
      if (savedTop === 0 || savedHeight === 0) {
        const rect = panel.getBoundingClientRect();
        savedTop = rect.top;
        savedHeight = rect.height;
      }
    }
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startX = clientX;
    startWidth = currentWidth;
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchmove', handleResize);
    document.addEventListener('touchend', stopResize);
  }

  function handleResize(e: MouseEvent | TouchEvent): void {
    if (!isResizing) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = position === 'left' 
      ? clientX - startX 
      : startX - clientX;
    
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
    currentWidth = newWidth;
  }

  function stopResize(): void {
    if (isResizing) {
      isResizing = false;
      saveState();
      
      // Clear saved bounds
      savedTop = 0;
      savedHeight = 0;
      
      // Update bounds after panel resize completes
      requestAnimationFrame(() => {
        updatePanelBounds();
      });
    }
    
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
    document.removeEventListener('touchmove', handleResize);
    document.removeEventListener('touchend', stopResize);
  }

  function handleResizeWindow(): void {
    updatePanelBounds();
  }

  onMount(async () => {
    // Create portal container at body level
    portalContainer = document.createElement('div');
    portalContainer.id = `floating-panel-portal-${position}`;
    portalContainer.style.cssText = 'position: fixed; z-index: 10000; pointer-events: none;';
    document.body.appendChild(portalContainer);
    
    // Move panel to portal
    if (panel && portalContainer) {
      portalContainer.appendChild(panel);
      panel.style.pointerEvents = 'auto';
    }
    
    // Wait for DOM to settle, then calculate initial bounds
    await tick();
    requestAnimationFrame(() => {
      updatePanelBounds();
    });
    
    // Update bounds on resize and scroll
    window.addEventListener('resize', handleResizeWindow);
    window.addEventListener('scroll', handleResizeWindow, true);
    
    // Use ResizeObserver to watch for layout changes (throttled like activity log resize)
    const resizeObserver = new ResizeObserver(() => {
      throttledUpdateBounds();
    });
    
    const navigation = document.querySelector('nav.tabs');
    const activityLog = document.querySelector('.split-log');
    
    if (navigation) resizeObserver.observe(navigation);
    if (activityLog) resizeObserver.observe(activityLog);
    
    // Also watch for when activity log resize completes (class removal)
    // This ensures bounds update immediately when drag ends
    mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target as HTMLElement;
          // If resizing class was removed, update bounds immediately
          if (target.classList.contains('split-log') && !target.classList.contains('resizing')) {
            requestAnimationFrame(() => {
              updatePanelBounds();
            });
          }
          // If dragging class was removed from divider, update bounds
          if (target.id === 'logDivider' && !target.classList.contains('dragging')) {
            requestAnimationFrame(() => {
              updatePanelBounds();
            });
          }
        }
      }
    });
    
    if (activityLog) {
      mutationObserver.observe(activityLog, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
    
    const divider = document.getElementById('logDivider');
    if (divider) {
      mutationObserver.observe(divider, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
    
    return () => {
      resizeObserver.disconnect();
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      if (boundsUpdateRaf !== null) {
        cancelAnimationFrame(boundsUpdateRaf);
      }
    };
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResizeWindow);
    window.removeEventListener('scroll', handleResizeWindow, true);
    stopResize();
    
    // Clean up observers
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    
    if (boundsUpdateRaf !== null) {
      cancelAnimationFrame(boundsUpdateRaf);
      boundsUpdateRaf = null;
    }
    
    // Clean up portal container
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });

  // Update width when expanded state changes
  $: if (!isExpanded) {
    currentWidth = collapsedWidth;
    // Update bounds after width change to ensure panel stays visible
    if (panel) {
      requestAnimationFrame(() => {
        updatePanelBounds();
      });
    }
  } else if (isExpanded && currentWidth === collapsedWidth) {
    currentWidth = expandedWidth;
    // Update bounds after width change to ensure panel stays visible
    if (panel) {
      requestAnimationFrame(() => {
        updatePanelBounds();
      });
    }
  }
</script>

<div
  bind:this={panel}
  class="floating-panel floating-panel--{position} {className}"
  class:floating-panel--expanded={isExpanded}
  class:floating-panel--resizing={isResizing}
  style="--panel-width: {currentWidth}px;"
>
  <div class="floating-panel__header">
    <button
      class="floating-panel__toggle"
      on:click={toggleExpanded}
      aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
      type="button"
    >
      {#if position === 'left'}
        {isExpanded ? '‹' : '›'}
      {:else}
        {isExpanded ? '›' : '‹'}
      {/if}
    </button>
  </div>
  
  {#if isExpanded}
    <div class="floating-panel__content">
      <slot />
    </div>
    
    <div
      class="floating-panel__resize-handle"
      bind:this={resizeHandle}
      on:mousedown={startResize}
      on:touchstart={startResize}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize panel"
      tabindex="0"
    />
  {/if}
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  @use '@styles/mixins' as *;

  .floating-panel {
    position: fixed;
    background: var(--card);
    border: 1px solid var(--border);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    @include gpu-accelerated;
  }

  .floating-panel--left {
    left: 0;
    border-right: 2px solid var(--border);
  }

  .floating-panel--right {
    right: 0;
    border-left: 2px solid var(--border);
  }

  .floating-panel {
    width: var(--panel-width);
  }

  .floating-panel__header {
    display: flex;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-dark);
    flex-shrink: 0;
  }

  .floating-panel__toggle {
    width: 32px;
    height: 32px;
    background: var(--border);
    border: none;
    border-radius: 4px;
    color: var(--text);
    font-size: 20px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    @include gpu-accelerated;

    &:hover {
      background: var(--accent);
      color: #000;
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .floating-panel__content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px;
    @include scrollbar(6px);
  }

  .floating-panel__resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: ew-resize;
    background: transparent;
    z-index: 10;
    transition: background 0.2s ease;
    user-select: none;
    -webkit-user-select: none;
  }

  .floating-panel--left .floating-panel__resize-handle {
    right: 0;
  }

  .floating-panel--right .floating-panel__resize-handle {
    left: 0;
  }

  .floating-panel__resize-handle:hover,
  .floating-panel--resizing .floating-panel__resize-handle {
    background: var(--accent);
  }

  .floating-panel--resizing {
    transition: none;
  }

  .floating-panel--resizing .floating-panel__content {
    transition: none;
  }
</style>

