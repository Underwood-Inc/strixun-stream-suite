<script lang="ts">
  /**
   * Toast Container Component
   * 
   * Manages and renders all toast notifications with:
   * - Stacked visible toasts (up to maxVisible)
   * - 3D card deck view for overflow toasts
   * - Portal rendering at body level
   * - Constrained to content area (between navigation and activity log)
   * - Smooth position animations when toasts are dismissed
   * 
   * Part of the agnostic UI component library.
   */
  
  import { onMount, onDestroy, tick, afterUpdate } from 'svelte';
  import { visibleToasts, overflowToasts, dismissToast } from '../../stores/toast-queue';
  import { getToastConfig } from '../../config/toast.config';
  import Toast from './Toast.svelte';
  
  let container: HTMLDivElement;
  let stackContainer: HTMLDivElement;
  let portalContainer: HTMLDivElement | null = null;
  const config = getToastConfig();
  
  let contentTop = 0;
  let contentBottom = 0;
  let contentLeft = 0;
  let contentRight = 0;
  
  // FLIP animation state
  let previousToastIds: string[] = [];
  let toastPositions = new Map<string, { top: number; height: number }>();
  let isAnimating = false;
  
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
    
    // Calculate available height with equal spacing top and bottom
    const spacing = 20;
    const availableHeight = contentBottom - contentTop - (spacing * 2); // Equal spacing top and bottom
    
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
    } else if (config.position.includes('left')) {
      container.style.left = `${contentLeft + 20}px`;
      container.style.right = 'auto';
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
  
  onMount(() => {
    // Create portal container at body level
    portalContainer = document.createElement('div');
    portalContainer.id = 'toast-portal-container';
    document.body.appendChild(portalContainer);
    
    // Move container to portal
    if (container && portalContainer) {
      portalContainer.appendChild(container);
    }
    
    // Calculate initial bounds
    updateContentBounds();
    
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
    
    // Clean up portal container
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });
  
  function handleDismiss(id: string): void {
    // Capture positions BEFORE dismissal (FLIP: First)
    if (stackContainer && !isAnimating) {
      captureToastPositions();
    }
    dismissToast(id);
  }
  
  /**
   * Capture current positions of all toasts (FLIP: First)
   */
  function captureToastPositions(): void {
    if (!stackContainer) return;
    
    const toastElements = Array.from(stackContainer.children) as HTMLElement[];
    toastPositions.clear();
    
    toastElements.forEach((element) => {
      const toastId = element.getAttribute('data-toast-id');
      if (toastId) {
        const rect = element.getBoundingClientRect();
        toastPositions.set(toastId, {
          top: rect.top,
          height: rect.height
        });
      }
    });
    
    // Store current IDs
    previousToastIds = $visibleToasts.map(t => t.id);
  }
  
  /**
   * Animate toast positions after DOM update (FLIP: Last, Invert, Play)
   */
  async function animateToastPositions(): Promise<void> {
    if (isAnimating || !stackContainer || toastPositions.size === 0) return;
    
    isAnimating = true;
    
    // Wait for DOM to update (FLIP: Last)
    await tick();
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    const currentIds = $visibleToasts.map(t => t.id);
    const removedIds = previousToastIds.filter(id => !currentIds.includes(id));
    
    // If no toasts were removed, just update state
    if (removedIds.length === 0) {
      toastPositions.clear();
      previousToastIds = currentIds;
      isAnimating = false;
      return;
    }
    
    // Get new positions after removal
    const toastElements = Array.from(stackContainer.children) as HTMLElement[];
    let animationCount = 0;
    let completedCount = 0;
    
    toastElements.forEach((element) => {
      const toastId = element.getAttribute('data-toast-id');
      if (!toastId) return;
      
      const oldPos = toastPositions.get(toastId);
      if (!oldPos) return; // This toast wasn't in the previous state
      
      const newRect = element.getBoundingClientRect();
      const newTop = newRect.top;
      
      // Calculate offset (FLIP: Invert)
      const offsetY = oldPos.top - newTop;
      
      if (Math.abs(offsetY) > 0.5) { // Only animate if there's actual movement
        animationCount++;
        
        // Set initial position (inverted)
        const currentTransform = element.style.transform || '';
        const baseTransform = currentTransform.replace(/translateY\([^)]+\)/g, '').trim();
        element.style.transform = `${baseTransform} translateY(${offsetY}px)`.trim();
        
        // Force reflow
        element.offsetHeight;
        
        // Animate to final position (FLIP: Play) using Web Animations API
        const anim = element.animate(
          [
            { transform: `${baseTransform} translateY(${offsetY}px)`.trim() },
            { transform: baseTransform || 'none' }
          ],
          {
            duration: 300,
            easing: 'cubic-bezier(0.33, 1, 0.68, 1)', // easeOutCubic
            fill: 'forwards'
          }
        );
        
        anim.addEventListener('finish', () => {
          // Clean up transform
          element.style.transform = baseTransform || '';
          completedCount++;
        });
      }
    });
    
    // Wait for all animations to complete (300ms duration + buffer)
    if (animationCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 350));
    }
    
    // Update state
    toastPositions.clear();
    previousToastIds = currentIds;
    isAnimating = false;
  }
  
  // Watch for changes and animate after DOM updates
  afterUpdate(() => {
    if (stackContainer && toastPositions.size > 0 && !isAnimating) {
      // Small delay to ensure DOM has fully updated
      setTimeout(() => {
        animateToastPositions();
      }, 10);
    }
  });
  
  $: positionClass = `toast-container--${config.position}`;
  $: stackSpacing = config.stackSpacing;
  $: containerClass = `toast-container ${positionClass}`;
</script>

<div 
  bind:this={container} 
  class={containerClass}
  style="--toast-stack-spacing: {stackSpacing}px;"
>
  <!-- Visible toasts stack -->
  <div class="toast-container__stack" bind:this={stackContainer}>
    {#each $visibleToasts as toast (toast.id)}
      <div data-toast-id={toast.id}>
        <Toast
          {toast}
          index={$visibleToasts.indexOf(toast)}
          inOverflow={false}
          overflowIndex={0}
          onDismiss={handleDismiss}
        />
      </div>
    {/each}
  </div>
  
  <!-- Overflow toasts (3D card deck) -->
  {#if $overflowToasts.length > 0}
    <div class="toast-container__overflow">
      {#each $overflowToasts as toast}
        <Toast
          {toast}
          index={0}
          inOverflow={true}
          overflowIndex={toast.overflowIndex}
          onDismiss={handleDismiss}
        />
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../../styles/variables' as *;
  @use '../../styles/mixins' as *;
  
  :global(#toast-portal-container) {
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
    pointer-events: none;
    z-index: 99999;
    overflow-y: auto;
    overflow-x: hidden;
    @include scrollbar(6px);
    
    // Position variants - constrained to content area
    &.toast-container--top-right {
      align-items: flex-end;
    }
    
    &.toast-container--top-left {
      align-items: flex-start;
    }
    
    &.toast-container--bottom-right {
      align-items: flex-end;
      flex-direction: column-reverse;
    }
    
    &.toast-container--bottom-left {
      align-items: flex-start;
      flex-direction: column-reverse;
    }
    
    &.toast-container--top-center {
      left: 50%;
      transform: translateX(-50%);
      align-items: center;
    }
    
    &.toast-container--bottom-center {
      left: 50%;
      transform: translateX(-50%);
      align-items: center;
      flex-direction: column-reverse;
    }
  }
  
  .toast-container__stack {
    display: flex;
    flex-direction: column;
    gap: var(--toast-stack-spacing, 12px);
    pointer-events: none;
    padding-right: 4px; // Space for scrollbar
    
    > div {
      pointer-events: none;
      flex-shrink: 0;
      
      :global(.toast) {
        pointer-events: auto;
      }
    }
  }
  
  .toast-container__overflow {
    position: absolute;
    top: 0;
    right: 0;
    width: 320px;
    height: 180px;
    perspective: 1200px;
    perspective-origin: right center;
    pointer-events: none;
    
    :global(.toast) {
      position: absolute;
      top: 0;
      right: 0;
      pointer-events: auto;
      transform-style: preserve-3d;
      transform-origin: right center;
    }
  }
</style>

