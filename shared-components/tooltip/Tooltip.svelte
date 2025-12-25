<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import type { ComponentType } from 'svelte';
  
  export let content: string = '';
  export let component: ComponentType<any> | null = null;
  export let componentProps: Record<string, any> = {};
  export let position: 'top' | 'bottom' | 'left' | 'right' = 'top';
  export let delay: number = 200;
  export let maxWidth: string | null = null; // Optional override, null = use dynamic calculation
  export let maxHeight: string | null = null; // Optional max height, enables scrolling if content exceeds
  export let width: string | null = null; // Optional fixed width
  export let height: string | null = null; // Optional fixed height
  export let interactive: boolean = false; // If true, tooltip can be hovered and interacted with
  
  let showTooltip = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let tooltipWidth = '250px';
  let tooltipElement: HTMLDivElement;
  let wrapperElement: HTMLDivElement;
  let fixedStyle = '';
  let portalContainer: HTMLDivElement | null = null;
  let tooltipId = `tooltip-${Math.random().toString(36).substr(2, 9)}`;
  let isHoveringTooltip = false;
  let hideTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
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
  
  // Calculate fixed position for tooltip
  function calculateFixedPosition(): string {
    if (!wrapperElement || !tooltipElement) return '';
    
    const rect = wrapperElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let top = 0;
    let left = 0;
    
    switch (position) {
      case 'top':
        top = rect.top - tooltipRect.height - 8;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = rect.bottom + 8;
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
        left = rect.right + 8;
        break;
    }
    
    // Keep tooltip within viewport
    if (left < 8) left = 8;
    if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }
    if (top < 8) top = 8;
    if (top + tooltipRect.height > viewportHeight - 8) {
      top = viewportHeight - tooltipRect.height - 8;
    }
    
    return `top: ${top}px; left: ${left}px;`;
  }
  
  // Calculate dynamic width based on viewport, max 45%
  function calculateTooltipWidth(): string {
    // Use override if provided
    if (maxWidth !== null) {
      return maxWidth;
    }
    
    if (typeof window === 'undefined') return '250px';
    const viewportWidth = window.innerWidth;
    const calculatedMaxWidth = Math.floor(viewportWidth * 0.45);
    const minWidth = 250;
    return `${Math.max(minWidth, calculatedMaxWidth)}px`;
  }
  
  function updateTooltipWidth() {
    tooltipWidth = calculateTooltipWidth();
  }
  
  // Build dimension styles
  function buildDimensionStyles(): string {
    const styles: string[] = [];
    
    if (width !== null) {
      styles.push(`width: ${width}`);
    }
    if (height !== null) {
      styles.push(`height: ${height}`);
    }
    if (maxWidth !== null) {
      styles.push(`max-width: ${maxWidth}`);
    } else {
      // Use calculated width if maxWidth not provided
      styles.push(`max-width: ${tooltipWidth}`);
    }
    if (maxHeight !== null) {
      styles.push(`max-height: ${maxHeight}`);
    }
    
    return styles.join('; ');
  }
  
  // Update width when maxWidth prop changes
  $: if (maxWidth !== null || typeof window !== 'undefined') {
    tooltipWidth = calculateTooltipWidth();
  }
  
  // Reactive dimension styles
  $: dimensionStyles = buildDimensionStyles();
  
  async function handleMouseEnter() {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      showTooltip = true;
      updateTooltipWidth();
      
      // Wait for tooltip to render, then calculate position
      await tick();
      if (tooltipElement && wrapperElement) {
        await tick(); // Wait for tooltip to render
        fixedStyle = calculateFixedPosition();
      }
    }, delay);
  }
  
  function handleMouseLeave() {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
    
    if (!interactive) {
      // Non-interactive: hide immediately
      showTooltip = false;
      fixedStyle = '';
      return;
    }
    
    // Interactive: delay hiding to allow moving to tooltip
    if (hideTimeoutId) clearTimeout(hideTimeoutId);
    hideTimeoutId = setTimeout(() => {
      if (!isHoveringTooltip) {
        showTooltip = false;
        fixedStyle = '';
      }
      hideTimeoutId = null;
    }, 100); // Small delay to bridge gap between trigger and tooltip
  }
  
  function handleTooltipMouseEnter() {
    if (interactive) {
      // Cancel any pending hide
      if (hideTimeoutId) {
        clearTimeout(hideTimeoutId);
        hideTimeoutId = null;
      }
      isHoveringTooltip = true;
    }
  }
  
  function handleTooltipMouseLeave() {
    if (interactive) {
      isHoveringTooltip = false;
      // Small delay to allow moving mouse from tooltip back to trigger
      if (hideTimeoutId) clearTimeout(hideTimeoutId);
      hideTimeoutId = setTimeout(() => {
        if (!isHoveringTooltip) {
          showTooltip = false;
          fixedStyle = '';
        }
        hideTimeoutId = null;
      }, 100);
    }
  }
  
  function handleResize() {
    // Only update if using dynamic width (maxWidth is null)
    if (maxWidth === null) {
      updateTooltipWidth();
    }
    if (showTooltip && tooltipElement && wrapperElement) {
      fixedStyle = calculateFixedPosition();
    }
  }
  
  onMount(() => {
    tooltipWidth = calculateTooltipWidth();
    
    // Create portal container at body level for tooltip
    portalContainer = document.createElement('div');
    portalContainer.id = `tooltip-portal-${tooltipId}`;
    portalContainer.style.position = 'fixed';
    portalContainer.style.top = '0';
    portalContainer.style.left = '0';
    portalContainer.style.width = '0';
    portalContainer.style.height = '0';
    portalContainer.style.pointerEvents = 'none';
    portalContainer.style.zIndex = '1000001'; // Above modal (1000000)
    document.body.appendChild(portalContainer);
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
  });
  
  onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId);
    if (hideTimeoutId) clearTimeout(hideTimeoutId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    }
    // Clean up portal container
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });
  
  // Update position when tooltip is shown
  $: if (showTooltip && tooltipElement && wrapperElement) {
    tick().then(() => {
      fixedStyle = calculateFixedPosition();
    });
  }
</script>

<div 
  class="tooltip-wrapper"
  bind:this={wrapperElement}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
>
  <slot />
</div>

{#if showTooltip && portalContainer}
  <div 
    class="tooltip tooltip--{position}" 
    class:tooltip--interactive={interactive}
    class:tooltip--scrollable={maxHeight !== null || height !== null}
    role="tooltip" 
    style="{dimensionStyles}; {fixedStyle}"
    bind:this={tooltipElement}
    use:portal={portalContainer}
    onmouseenter={handleTooltipMouseEnter}
    onmouseleave={handleTooltipMouseLeave}
  >
    <div class="tooltip-content">
      {#if component}
        <svelte:component this={component} {...componentProps} />
      {:else if content}
        {@html content}
      {/if}
    </div>
    <div class="tooltip-arrow"></div>
  </div>
{/if}

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  
  .tooltip {
    position: fixed;
    z-index: 1000001; /* Above modal (1000000) */
    background: var(--tooltip-bg, #2a2a2a);
    color: var(--tooltip-text, #ffffff);
    padding: 16px 20px;
    border-radius: 8px;
    font-size: 0.875rem;
    line-height: 1.6;
    min-width: 280px;
    max-width: 500px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
    pointer-events: none;
    white-space: normal;
    word-wrap: break-word;
    transform: none;
    margin: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }
  
  .tooltip--interactive {
    pointer-events: auto;
  }
  
  .tooltip--scrollable {
    overflow: hidden;
  }
  
  .tooltip--scrollable .tooltip-content {
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
    min-height: 0;
    /* Custom scrollbar styling */
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
    /* Add padding to account for scrollbar */
    padding-right: 4px;
    margin-right: -4px;
  }
  
  .tooltip--scrollable .tooltip-content::-webkit-scrollbar {
    width: 8px;
  }
  
  .tooltip--scrollable .tooltip-content::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 4px;
    margin: 4px 0;
  }
  
  .tooltip--scrollable .tooltip-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  
  .tooltip--scrollable .tooltip-content::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
    background-clip: padding-box;
  }
  
  .tooltip-content {
    position: relative;
    z-index: 1;
  }
  
  .tooltip-arrow {
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
  }
  
  .tooltip--top .tooltip-arrow {
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px 6px 0 6px;
    border-color: var(--tooltip-bg, #2a2a2a) transparent transparent transparent;
  }
  
  .tooltip--bottom .tooltip-arrow {
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 0 6px 6px 6px;
    border-color: transparent transparent var(--tooltip-bg, #2a2a2a) transparent;
  }
  
  .tooltip--left .tooltip-arrow {
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-width: 6px 0 6px 6px;
    border-color: transparent transparent transparent var(--tooltip-bg, #2a2a2a);
  }
  
  .tooltip--right .tooltip-arrow {
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-width: 6px 6px 6px 0;
    border-color: transparent var(--tooltip-bg, #2a2a2a) transparent transparent;
  }
</style>

