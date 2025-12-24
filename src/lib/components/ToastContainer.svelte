<script lang="ts">
  /**
   * Toast Container Component
   * 
   * Renders all active toast notifications
   * Constrained to content area (below navigation, above activity log)
   * with independent scrolling
   */
  
  import { onDestroy, onMount, tick } from 'svelte';
  import { getToastConfig } from '../../config/toast.config';
  import { dismissToast, visibleToasts } from '../../stores/toast-queue';
  import { getScrollbarCompensation } from '../utils/scrollbar-compensation';
  import Toast from './Toast.svelte';
  
  let container: HTMLDivElement;
  let portalContainer: HTMLDivElement | null = null;
  const config = getToastConfig();
  
  let contentTop = 0;
  let contentBottom = 0;
  let contentLeft = 0;
  let contentRight = 0;
  
  // Scrollbar compensation instance with faster transitions for toast container
  const scrollbarComp = getScrollbarCompensation({
    cssVariable: '--toast-scrollbar-width',
    transitionDuration: '0.1s' // Faster transition to reduce jank
  });
  
  /**
   * Get current scrollbar width from CSS variable or calculate it
   */
  function getScrollbarWidth(): number {
    if (!container) return 0;
    
    // First, check if scrollbar is actually present
    if (!scrollbarComp.hasScrollbar(container)) {
      return 0;
    }
    
    // Try to get width from CSS variable (set by scrollbar compensation utility)
    const cssValue = container.style.getPropertyValue('--toast-scrollbar-width');
    if (cssValue) {
      const match = cssValue.match(/(\d+(?:\.\d+)?)px/);
      if (match) {
        const width = parseFloat(match[1]);
        if (!isNaN(width) && width > 0) {
          return width;
        }
      }
    }
    
    // Fallback: calculate scrollbar width directly
    return scrollbarComp.getScrollbarWidth();
  }
  
  function updateContentBounds(): void {
    const navigation = document.querySelector('nav.tabs');
    const contentArea = document.querySelector('.split-main.content');
    const activityLog = document.querySelector('.split-log');
    
    if (!contentArea || !container) return;
    
    const navRect = navigation?.getBoundingClientRect();
    const contentRect = contentArea.getBoundingClientRect();
    const logRect = activityLog?.getBoundingClientRect();
    
    // Top bound: below navigation
    contentTop = navRect ? navRect.bottom : contentRect.top;
    
    // Bottom bound: above activity log (or viewport bottom if log is collapsed)
    if (logRect && logRect.top < window.innerHeight) {
      contentBottom = logRect.top;
    } else {
      contentBottom = window.innerHeight;
    }
    
    // Left and right bounds: content area edges
    contentLeft = contentRect.left;
    contentRight = contentRect.right;
    
    // Calculate available height with spacing
    const spacing = 20;
    const availableHeight = contentBottom - contentTop - (spacing * 2);
    
    // Get main content's scrollbar width (if present)
    const mainContentScrollbarWidth = scrollbarComp.hasScrollbar(contentArea as HTMLElement)
      ? scrollbarComp.getScrollbarWidth()
      : 0;
    
    // Get toast container's scrollbar width
    const toastScrollbarWidth = getScrollbarWidth();
    
    // Update container positioning based on config position
    if (config.position.includes('top')) {
      container.style.top = `${contentTop + spacing}px`;
      container.style.bottom = 'auto';
    } else {
      container.style.top = 'auto';
      container.style.bottom = `${window.innerHeight - contentBottom + spacing}px`;
    }
    
    if (config.position.includes('right')) {
      // Position relative to viewport right edge
      // Account for main content scrollbar to prevent overlap
      const gap = 12;
      let rightOffset = gap;
      
      // If main content has scrollbar, position toasts to the left of it
      if (mainContentScrollbarWidth > 0) {
        rightOffset = mainContentScrollbarWidth + gap;
      }
      
      // Account for scrollbar compensation's negative margin-right
      // The compensation applies margin-right: -scrollbarWidth, which pushes container right
      // So we need to subtract that from our right offset
      if (toastScrollbarWidth > 0) {
        rightOffset -= toastScrollbarWidth;
      }
      
      container.style.right = `${rightOffset}px`;
      container.style.left = 'auto';
      container.style.transform = '';
    } else if (config.position.includes('left')) {
      container.style.left = `${contentLeft + 20}px`;
      container.style.right = 'auto';
      container.style.transform = '';
    } else if (config.position.includes('center')) {
      container.style.left = `${contentLeft + (contentRight - contentLeft) / 2}px`;
      container.style.right = 'auto';
      container.style.transform = 'translateX(-50%)';
    }
    
    // Constrain max height to available space
    container.style.maxHeight = `${Math.max(200, availableHeight)}px`;
  }
  
  function handleResize(): void {
    updateContentBounds();
  }
  
  onMount(async () => {
    // Create portal container at body level
    portalContainer = document.createElement('div');
    portalContainer.id = 'toast-portal-container-legacy';
    document.body.appendChild(portalContainer);
    
    // Move container to portal
    if (container && portalContainer) {
      portalContainer.appendChild(container);
    }
    
    // Wait for DOM to settle, then calculate initial bounds
    await tick();
    requestAnimationFrame(() => {
      updateContentBounds();
    });
    
    // Attach scrollbar compensation to container
    if (container) {
      scrollbarComp.attach(container);
    }
    
    // Update bounds on resize and scroll
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    
    // Use ResizeObserver to watch for layout changes
    const resizeObserver = new ResizeObserver(() => {
      // Update scrollbar compensation first, then update bounds
      if (container) {
        scrollbarComp.update(container);
      }
      updateContentBounds();
    });
    
    // Also observe the container itself for scrollbar changes
    if (container) {
      resizeObserver.observe(container);
    }
    
    const navigation = document.querySelector('nav.tabs');
    const contentArea = document.querySelector('.split-main.content');
    const activityLog = document.querySelector('.split-log');
    
    if (navigation) resizeObserver.observe(navigation);
    if (contentArea) resizeObserver.observe(contentArea);
    if (activityLog) resizeObserver.observe(activityLog);
  });
  
  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('scroll', handleResize, true);
    
    // Detach scrollbar compensation
    if (container) {
      scrollbarComp.detach(container);
    }
    
    // Clean up portal container
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });
  
  // Watch for toast changes and update scrollbar compensation
  $: if ($visibleToasts && container) {
    // Update immediately without waiting for animation frame to prevent jank
    scrollbarComp.update(container);
    // Update bounds after scrollbar compensation to adjust positioning
    requestAnimationFrame(() => {
      updateContentBounds();
    });
  }
</script>

<div 
  bind:this={container}
  class="toast-container"
>
  {#each $visibleToasts as toast (toast.id)}
    <Toast
      message={toast.message}
      type={toast.type}
      duration={toast.duration}
      action={toast.action}
      onDismiss={() => dismissToast(toast.id)}
    />
  {/each}
</div>

<style lang="scss">
  @use '@styles/variables' as *;
  @use '@styles/mixins' as *;
  
  :global(#toast-portal-container-legacy) {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 99999;
  }
  
  .toast-container {
    position: fixed;
    right: 20px;
    z-index: 99999;
    pointer-events: none;
    overflow-y: auto;
    overflow-x: hidden;
    width: auto;
    min-width: 300px;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    @include scrollbar(6px);
    
    // Scrollbar compensation is handled by the scrollbar-compensation utility
    // The utility applies margin-right and padding-right automatically via inline styles
    // CSS variable --toast-scrollbar-width is available for custom styling if needed
    
    :global(.toast) {
      pointer-events: auto;
      position: relative;
    }
  }
</style>

