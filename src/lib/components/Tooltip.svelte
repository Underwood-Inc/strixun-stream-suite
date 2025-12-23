<script lang="ts">
  /**
   * Tooltip Component
   * 
   * Agnostic, reusable tooltip component that shows instantly on hover.
   * Handles positioning automatically based on available space.
   * Supports multiple alert levels with distinct visual styling.
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
   * 
   * @example
   * <Tooltip text="Connection required" level="warning">
   *   <button disabled>Disabled button</button>
   * </Tooltip>
   */
  
  import { onMount, onDestroy, tick } from 'svelte';
  import { animate } from '../../core/animations';
  
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
  export let maxWidth: string | null = null; // null = auto-calculate based on viewport
  export let level: 'log' | 'info' | 'warning' | 'error' = 'log';
  
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
  
  // Calculate reasonable max-width based on viewport
  function calculateMaxWidth(): string {
    if (maxWidth !== null) {
      return maxWidth;
    }
    
    const viewportWidth = window.innerWidth;
    // Use 40% of viewport width, but clamp between 250px and 500px for better readability
    const calculated = Math.max(250, Math.min(500, Math.floor(viewportWidth * 0.4)));
    return `${calculated}px`;
  }
  
  // Calculate minimum width to prevent text stacking
  function calculateMinWidth(): string {
    const viewportWidth = window.innerWidth;
    // Minimum width should be at least 200px, or 15% of viewport if larger
    const calculated = Math.max(200, Math.floor(viewportWidth * 0.15));
    return `${calculated}px`;
  }
  
  // Reactive calculated widths
  $: calculatedMaxWidth = calculateMaxWidth();
  $: calculatedMinWidth = calculateMinWidth();
  
  // Update calculated width on resize
  function handleResize(): void {
    if (tooltipElement) {
      tooltipElement.style.maxWidth = calculateMaxWidth();
      tooltipElement.style.minWidth = calculateMinWidth();
    }
  }
  
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
    
    // Update notch position based on mouse position
    updateNotchPosition();
  }
  
  // Calculate and update notch position to be closest to mouse cursor
  function updateNotchPosition(): void {
    if (!tooltipElement) return;
    
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const minOffsetPercent = 5; // Minimum distance from tooltip edge as percentage
    
    // Calculate mouse position relative to tooltip
    const mouseRelativeX = mouseX - tooltipRect.left;
    const mouseRelativeY = mouseY - tooltipRect.top;
    
    let notchOffset = '50%'; // Default to center
    
    if (actualPosition === 'top' || actualPosition === 'bottom') {
      // For top/bottom tooltips, notch moves horizontally
      // Calculate as percentage of tooltip width
      const mousePercentX = (mouseRelativeX / tooltipRect.width) * 100;
      // Clamp to keep notch within reasonable bounds (5% to 95% of width)
      const clampedPercent = Math.max(minOffsetPercent, Math.min(100 - minOffsetPercent, mousePercentX));
      notchOffset = `${clampedPercent}%`;
    } else if (actualPosition === 'left' || actualPosition === 'right') {
      // For left/right tooltips, notch moves vertically
      // Calculate as percentage of tooltip height
      const mousePercentY = (mouseRelativeY / tooltipRect.height) * 100;
      // Clamp to keep notch within reasonable bounds (5% to 95% of height)
      const clampedPercent = Math.max(minOffsetPercent, Math.min(100 - minOffsetPercent, mousePercentY));
      notchOffset = `${clampedPercent}%`;
    }
    
    // Set CSS custom property for notch position
    tooltipElement.style.setProperty('--notch-offset', notchOffset);
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
  
  // Update position and width when tooltip becomes visible
  $: if (show && tooltipElement && !listenersActive) {
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      // Double-check tooltipElement is still valid (might be destroyed between reactive update and RAF)
      if (!tooltipElement) return;
      
      // Apply width constraints
      tooltipElement.style.maxWidth = calculatedMaxWidth;
      tooltipElement.style.minWidth = calculatedMinWidth;
      calculatePosition();
      // Also update on window resize and scroll
      if (!listenersActive) {
        window.addEventListener('resize', updateTooltipPosition);
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', updateTooltipPosition, true);
        listenersActive = true;
      }
    });
  }
  
  // Update notch position when tooltip position changes
  $: if (show && tooltipElement && actualPosition) {
    requestAnimationFrame(() => {
      // Double-check tooltipElement is still valid
      if (!tooltipElement) return;
      updateNotchPosition();
    });
  }
  
  // Cleanup listeners when tooltip hides
  $: if (!show && listenersActive) {
    window.removeEventListener('resize', updateTooltipPosition);
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('scroll', updateTooltipPosition, true);
    listenersActive = false;
  }
  
  // Track mouse position for better positioning
  function handleMouseMove(e: MouseEvent): void {
    mouseX = e.clientX;
    mouseY = e.clientY;
    // Update notch position as mouse moves
    if (show && tooltipElement) {
      updateNotchPosition();
    }
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
    portalContainer.style.zIndex = '100002'; // Highest - above alerts (100001) and toasts (99999)
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
      window.removeEventListener('resize', handleResize);
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
    class:tooltip--log={level === 'log'}
    class:tooltip--info={level === 'info'}
    class:tooltip--warning={level === 'warning'}
    class:tooltip--error={level === 'error'}
    use:animate={{
      preset: 'fadeIn',
      duration: 150,
      easing: 'easeOutCubic',
      id: `tooltip-${tooltipId}`,
      trigger: 'mount'
    }}
    id={tooltipId}
    role="tooltip"
    bind:this={tooltipElement}
    style="max-width: {calculatedMaxWidth}; min-width: {calculatedMinWidth};"
    use:portal={portalContainer}
  >
    {text}
  </div>
{/if}

<style lang="scss">
  @use '@styles/animations' as *;
  
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
  }
  
  .tooltip {
    position: fixed;
    z-index: 100002; // Highest - above alerts (100001) and toasts (99999)
    padding: 6px 10px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 0.85em;
    line-height: 1.4;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    animation: fade-in 0.1s ease-out;
    @include gpu-accelerated;
    transform: none;
    position: relative;
    overflow: visible;
    white-space: normal;
    word-wrap: break-word;
    overflow-wrap: break-word;
    text-align: center;
    display: inline-block;
    
    // Log level (default) - no special styling
    &.tooltip--log {
      // Default styling already applied
    }
    
    // Info level - blue border and angled line pattern
    &.tooltip--info {
      border-color: var(--info);
      border-width: 2px;
      background-image: repeating-linear-gradient(
        45deg,
        var(--card),
        var(--card) 8px,
        rgba(100, 149, 237, 0.08) 8px,
        rgba(100, 149, 237, 0.08) 16px
      );
    }
    
    // Warning level - distinct orange/amber color to stand out from yellow/brown theme
    &.tooltip--warning {
      border-color: #ff8c00; // Dark orange - distinct from yellow/brown
      border-width: 2px;
      background: var(--card);
      background-image: repeating-linear-gradient(
        135deg,
        rgba(255, 140, 0, 0.1),
        rgba(255, 140, 0, 0.1) 4px,
        rgba(255, 140, 0, 0.15) 4px,
        rgba(255, 140, 0, 0.15) 8px
      );
    }
    
    // Error level - red border with diagonal stripe pattern
    &.tooltip--error {
      border-color: var(--danger);
      border-width: 2px;
      background: var(--card);
      background-image: repeating-linear-gradient(
        -45deg,
        rgba(234, 43, 31, 0.1),
        rgba(234, 43, 31, 0.1) 6px,
        rgba(234, 43, 31, 0.15) 6px,
        rgba(234, 43, 31, 0.15) 12px
      );
    }
    
    // Top position - arrow points down
    &.tooltip--top {
      &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: var(--notch-offset, 50%);
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: var(--card);
        z-index: 2;
      }
      
      // Border arrow - adjust color based on level
      &::before {
        content: '';
        position: absolute;
        top: 100%;
        left: var(--notch-offset, 50%);
        transform: translateX(-50%);
        border: 6px solid transparent;
        margin-top: -1px;
        z-index: 1;
      }
      
      &.tooltip--log::before {
        border-top-color: var(--border);
      }
      
      &.tooltip--info::before {
        border-top-color: var(--info);
      }
      
      &.tooltip--warning::before {
        border-top-color: #ff8c00;
      }
      
      &.tooltip--error::before {
        border-top-color: var(--danger);
      }
    }
    
    // Bottom position - arrow points up
    &.tooltip--bottom {
      &::after {
        content: '';
        position: absolute;
        bottom: 100%;
        left: var(--notch-offset, 50%);
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-bottom-color: var(--card);
        z-index: 2;
      }
      
      // Border arrow - adjust color based on level
      &::before {
        content: '';
        position: absolute;
        bottom: 100%;
        left: var(--notch-offset, 50%);
        transform: translateX(-50%);
        border: 6px solid transparent;
        margin-bottom: -1px;
        z-index: 1;
      }
      
      &.tooltip--log::before {
        border-bottom-color: var(--border);
      }
      
      &.tooltip--info::before {
        border-bottom-color: var(--info);
      }
      
      &.tooltip--warning::before {
        border-bottom-color: #ff8c00;
      }
      
      &.tooltip--error::before {
        border-bottom-color: var(--danger);
      }
    }
    
    // Left position - arrow points right
    &.tooltip--left {
      &::after {
        content: '';
        position: absolute;
        left: 100%;
        top: var(--notch-offset, 50%);
        transform: translateY(-50%);
        border: 5px solid transparent;
        border-left-color: var(--card);
        z-index: 2;
      }
      
      // Border arrow - adjust color based on level
      &::before {
        content: '';
        position: absolute;
        left: 100%;
        top: var(--notch-offset, 50%);
        transform: translateY(-50%);
        border: 6px solid transparent;
        margin-left: -1px;
        z-index: 1;
      }
      
      &.tooltip--log::before {
        border-left-color: var(--border);
      }
      
      &.tooltip--info::before {
        border-left-color: var(--info);
      }
      
      &.tooltip--warning::before {
        border-left-color: #ff8c00;
      }
      
      &.tooltip--error::before {
        border-left-color: var(--danger);
      }
    }
    
    // Right position - arrow points left
    &.tooltip--right {
      &::after {
        content: '';
        position: absolute;
        right: 100%;
        top: var(--notch-offset, 50%);
        transform: translateY(-50%);
        border: 5px solid transparent;
        border-right-color: var(--card);
        z-index: 2;
      }
      
      // Border arrow - adjust color based on level
      &::before {
        content: '';
        position: absolute;
        right: 100%;
        top: var(--notch-offset, 50%);
        transform: translateY(-50%);
        border: 6px solid transparent;
        margin-right: -1px;
        z-index: 1;
      }
      
      &.tooltip--log::before {
        border-right-color: var(--border);
      }
      
      &.tooltip--info::before {
        border-right-color: var(--info);
      }
      
      &.tooltip--warning::before {
        border-right-color: #ff8c00;
      }
      
      &.tooltip--error::before {
        border-right-color: var(--danger);
      }
    }
    
  }
</style>

