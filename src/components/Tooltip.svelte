<script lang="ts">
  /**
   * Tooltip Component
   * 
   * Agnostic, reusable tooltip component that shows instantly on hover.
   * Handles positioning automatically based on available space.
   * 
   * @example
   * <Tooltip text="Click me">
   *   <button>Hover me</button>
   * </Tooltip>
   * 
   * @example
   * <Tooltip text="Custom tooltip" position="bottom" delay={0}>
   *   <span>Hover target</span>
   * </Tooltip>
   */
  
  import { onMount, onDestroy } from 'svelte';
  
  // Portal action to render tooltip at body level
  function portal(node: HTMLElement, target: HTMLElement) {
    target.appendChild(node);
    return {
      update(newTarget: HTMLElement) {
        if (newTarget !== target) {
          newTarget.appendChild(node);
          target = newTarget;
        }
      },
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }
  
  // Props
  export let text: string = '';
  export let position: 'top' | 'bottom' | 'left' | 'right' | 'auto' = 'auto';
  export let delay: number = 0; // Instant by default
  export let disabled: boolean = false;
  export let maxWidth: string = '200px';
  
  // Internal state
  let show = false;
  let tooltipElement: HTMLDivElement;
  let triggerElement: HTMLElement;
  let actualPosition: 'top' | 'bottom' | 'left' | 'right' = position === 'auto' ? 'top' : position;
  let tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  let mouseX = 0;
  let mouseY = 0;
  let listenersActive = false;
  let portalContainer: HTMLDivElement | null = null;
  
  // Calculate position based on available space
  function calculatePosition(): void {
    if (!tooltipElement || !triggerElement) return;
    
    if (position !== 'auto') {
      actualPosition = position;
      updateTooltipPosition();
      return;
    }
    
    const triggerRect = triggerElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Check available space in each direction
    const spaceTop = triggerRect.top;
    const spaceBottom = viewportHeight - triggerRect.bottom;
    const spaceLeft = triggerRect.left;
    const spaceRight = viewportWidth - triggerRect.right;
    
    // Determine best position
    if (spaceBottom >= tooltipRect.height + 10) {
      actualPosition = 'bottom';
    } else if (spaceTop >= tooltipRect.height + 10) {
      actualPosition = 'top';
    } else if (spaceRight >= tooltipRect.width + 10) {
      actualPosition = 'right';
    } else if (spaceLeft >= tooltipRect.width + 10) {
      actualPosition = 'left';
    } else {
      // Default to bottom if no space available
      actualPosition = 'bottom';
    }
    
    updateTooltipPosition();
  }
  
  // Update tooltip position using fixed positioning
  function updateTooltipPosition(): void {
    if (!tooltipElement || !triggerElement) return;
    
    const triggerRect = triggerElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    
    let top = 0;
    let left = 0;
    
    switch (actualPosition) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        left = triggerRect.right + 8;
        break;
    }
    
    // Keep tooltip within viewport bounds
    const padding = 8;
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipRect.height > window.innerHeight - padding) {
      top = window.innerHeight - tooltipRect.height - padding;
    }
    
    tooltipElement.style.top = `${top}px`;
    tooltipElement.style.left = `${left}px`;
  }
  
  // Show tooltip
  function handleMouseEnter(): void {
    if (disabled || !text) return;
    
    if (delay > 0) {
      hoverTimeout = setTimeout(() => {
        show = true;
        hoverTimeout = null;
      }, delay);
    } else {
      show = true;
    }
  }
  
  // Hide tooltip
  function handleMouseLeave(): void {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    show = false;
  }
  
  // Update position when tooltip becomes visible
  $: if (show && tooltipElement && !listenersActive) {
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      calculatePosition();
      // Also update on window resize and scroll
      if (!listenersActive) {
        window.addEventListener('resize', updateTooltipPosition);
        window.addEventListener('scroll', updateTooltipPosition, true);
        listenersActive = true;
      }
    });
  }
  
  // Cleanup listeners when tooltip hides
  $: if (!show && listenersActive) {
    window.removeEventListener('resize', updateTooltipPosition);
    window.removeEventListener('scroll', updateTooltipPosition, true);
    listenersActive = false;
  }
  
  // Track mouse position for better positioning
  function handleMouseMove(e: MouseEvent): void {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
  
  onMount(() => {
    // Create portal container at body level for tooltip
    portalContainer = document.createElement('div');
    portalContainer.id = `tooltip-portal-${tooltipId}`;
    portalContainer.style.position = 'fixed';
    portalContainer.style.top = '0';
    portalContainer.style.left = '0';
    portalContainer.style.width = '0';
    portalContainer.style.height = '0';
    portalContainer.style.pointerEvents = 'none';
    portalContainer.style.zIndex = '99999';
    document.body.appendChild(portalContainer);
    
    // Find the trigger element (first child)
    if (triggerElement) {
      triggerElement.addEventListener('mouseenter', handleMouseEnter);
      triggerElement.addEventListener('mouseleave', handleMouseLeave);
      triggerElement.addEventListener('mousemove', handleMouseMove);
      triggerElement.setAttribute('aria-describedby', tooltipId);
    }
  });
  
  onDestroy(() => {
    if (triggerElement) {
      triggerElement.removeEventListener('mouseenter', handleMouseEnter);
      triggerElement.removeEventListener('mouseleave', handleMouseLeave);
      triggerElement.removeEventListener('mousemove', handleMouseMove);
      triggerElement.removeAttribute('aria-describedby');
    }
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }
    if (listenersActive) {
      window.removeEventListener('resize', updateTooltipPosition);
      window.removeEventListener('scroll', updateTooltipPosition, true);
      listenersActive = false;
    }
    // Clean up portal container
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });
</script>

<div class="tooltip-wrapper" bind:this={triggerElement}>
  <slot />
</div>

{#if show && text && portalContainer}
  <div
    class="tooltip"
    class:tooltip--top={actualPosition === 'top'}
    class:tooltip--bottom={actualPosition === 'bottom'}
    class:tooltip--left={actualPosition === 'left'}
    class:tooltip--right={actualPosition === 'right'}
    id={tooltipId}
    role="tooltip"
    bind:this={tooltipElement}
    style="max-width: {maxWidth};"
    use:portal={portalContainer}
  >
    {text}
  </div>
{/if}

<style lang="scss">
  @use '../styles/animations' as *;
  
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
  }
  
  .tooltip {
    position: fixed;
    z-index: 10000;
    padding: 6px 10px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 0.85em;
    line-height: 1.4;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    animation: fade-in 0.1s ease-out;
    @include gpu-accelerated;
    transform: none;
    
    // Top position - arrow points down
    &.tooltip--top {
      &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: var(--card);
      }
      
      &::before {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: var(--border);
        margin-top: -1px;
      }
    }
    
    // Bottom position - arrow points up
    &.tooltip--bottom {
      &::after {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-bottom-color: var(--card);
      }
      
      &::before {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-bottom-color: var(--border);
        margin-bottom: -1px;
      }
    }
    
    // Left position - arrow points right
    &.tooltip--left {
      &::after {
        content: '';
        position: absolute;
        left: 100%;
        top: 50%;
        transform: translateY(-50%);
        border: 5px solid transparent;
        border-left-color: var(--card);
      }
      
      &::before {
        content: '';
        position: absolute;
        left: 100%;
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-left-color: var(--border);
        margin-left: -1px;
      }
    }
    
    // Right position - arrow points left
    &.tooltip--right {
      &::after {
        content: '';
        position: absolute;
        right: 100%;
        top: 50%;
        transform: translateY(-50%);
        border: 5px solid transparent;
        border-right-color: var(--card);
      }
      
      &::before {
        content: '';
        position: absolute;
        right: 100%;
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-right-color: var(--border);
        margin-right: -1px;
      }
    }
    
    // Allow text wrapping for longer content
    white-space: normal;
    word-wrap: break-word;
    text-align: center;
  }
</style>

