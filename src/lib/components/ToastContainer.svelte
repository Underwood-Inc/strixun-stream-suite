<script lang="ts">
  /**
   * Toast Container Component
   * 
   * Renders all active toast notifications
   * Constrained to content area (below navigation, above activity log)
   * with independent scrolling
   */
  
  import { onMount, onDestroy, tick } from 'svelte';
  import { visibleToasts, overflowToasts, dismissToast } from '../../stores/toast-queue';
  import Toast from './Toast.svelte';
  import { getToastConfig } from '../../config/toast.config';
  import { getScrollbarCompensation } from '../utils/scrollbar-compensation';
  
  let container: HTMLDivElement;
  let portalContainer: HTMLDivElement | null = null;
  const config = getToastConfig();
  
  let contentTop = 0;
  let contentBottom = 0;
  let contentLeft = 0;
  let contentRight = 0;
  
  // Scrollbar compensation instance
  const scrollbarComp = getScrollbarCompensation({
    cssVariable: '--toast-scrollbar-width'
  });
  
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
    
    // Update container positioning based on config position
    if (config.position.includes('top')) {
      container.style.top = `${contentTop + spacing}px`;
      container.style.bottom = 'auto';
    } else {
      container.style.top = 'auto';
      container.style.bottom = `${window.innerHeight - contentBottom + spacing}px`;
    }
    
    if (config.position.includes('right')) {
      container.style.right = `${window.innerWidth - contentRight + 20}px`;
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
      updateContentBounds();
    });
    
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
    requestAnimationFrame(() => {
      scrollbarComp.update(container);
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

