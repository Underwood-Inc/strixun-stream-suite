<script lang="ts">
  export let content: string;
  export let position: 'top' | 'bottom' | 'left' | 'right' = 'top';
  export let delay: number = 200;
  
  let showTooltip = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  function handleMouseEnter() {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      showTooltip = true;
    }, delay);
  }
  
  function handleMouseLeave() {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
    showTooltip = false;
  }
</script>

<div 
  class="tooltip-wrapper"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
>
  <slot />
  {#if showTooltip}
    <div class="tooltip tooltip--{position}" role="tooltip">
      <div class="tooltip-content">
        {@html content}
      </div>
      <div class="tooltip-arrow"></div>
    </div>
  {/if}
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  
  .tooltip {
    position: absolute;
    z-index: 99999;
    background: var(--tooltip-bg, #1a1a1a);
    color: var(--tooltip-text, #ffffff);
    padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
    border-radius: var(--radius-sm, 4px);
    font-size: 0.875rem;
    line-height: 1.5;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: none;
    white-space: normal;
    word-wrap: break-word;
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
  
  .tooltip--top {
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
  }
  
  .tooltip--top .tooltip-arrow {
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px 6px 0 6px;
    border-color: var(--tooltip-bg, #1a1a1a) transparent transparent transparent;
  }
  
  .tooltip--bottom {
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 8px;
  }
  
  .tooltip--bottom .tooltip-arrow {
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 0 6px 6px 6px;
    border-color: transparent transparent var(--tooltip-bg, #1a1a1a) transparent;
  }
  
  .tooltip--left {
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-right: 8px;
  }
  
  .tooltip--left .tooltip-arrow {
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-width: 6px 0 6px 6px;
    border-color: transparent transparent transparent var(--tooltip-bg, #1a1a1a);
  }
  
  .tooltip--right {
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-left: 8px;
  }
  
  .tooltip--right .tooltip-arrow {
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-width: 6px 6px 6px 0;
    border-color: transparent var(--tooltip-bg, #1a1a1a) transparent transparent;
  }
</style>

