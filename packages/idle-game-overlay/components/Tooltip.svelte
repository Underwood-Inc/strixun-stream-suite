<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { tooltipManager, type TooltipConfig } from '../core/tooltip-system';
  import { createEventDispatcher } from 'svelte';

  export let config: TooltipConfig;
  export let visible = false;

  const dispatch = createEventDispatcher();

  let tooltipElement: HTMLElement;
  let portalContainer: HTMLElement | null = null;
  let position = { x: 0, y: 0 };
  let isPositioned = false;

  onMount(() => {
    portalContainer = tooltipManager.getPortalContainer();
    if (portalContainer && visible) {
      calculatePosition();
    }
  });

  onDestroy(() => {
    if (tooltipElement) {
      tooltipElement.remove();
    }
  });

  function calculatePosition() {
    if (!config.position.anchor) return;

    const anchor = config.position.anchor;
    const rect = anchor.getBoundingClientRect();
    const tooltipRect = tooltipElement?.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let x = 0;
    let y = 0;
    let placement = config.position.placement;

    // Auto placement logic
    if (placement === 'auto') {
      const space = {
        top: rect.top,
        bottom: viewport.height - rect.bottom,
        left: rect.left,
        right: viewport.width - rect.right
      };

      if (space.bottom >= space.top && space.bottom >= 200) {
        placement = 'bottom';
      } else if (space.top >= 200) {
        placement = 'top';
      } else if (space.right >= space.left && space.right >= 200) {
        placement = 'right';
      } else {
        placement = 'left';
      }
    }

    // Calculate position based on placement
    const offset = config.position.offset;
    const padding = config.position.viewportPadding;

    switch (placement) {
      case 'top':
        x = rect.left + (rect.width / 2);
        y = rect.top - (tooltipRect?.height || 0) - offset.y;
        break;
      case 'bottom':
        x = rect.left + (rect.width / 2);
        y = rect.bottom + offset.y;
        break;
      case 'left':
        x = rect.left - (tooltipRect?.width || 0) - offset.x;
        y = rect.top + (rect.height / 2);
        break;
      case 'right':
        x = rect.right + offset.x;
        y = rect.top + (rect.height / 2);
        break;
    }

    // Keep within viewport
    if (tooltipRect) {
      x = Math.max(padding, Math.min(x, viewport.width - tooltipRect.width - padding));
      y = Math.max(padding, Math.min(y, viewport.height - tooltipRect.height - padding));
    }

    position = { x, y };
    isPositioned = true;
  }

  $: if (visible && config.position.anchor) {
    calculatePosition();
  }
</script>

{#if visible && portalContainer}
  <div
    bind:this={tooltipElement}
    id="tooltip-{config.id}"
    class="tooltip tooltip--{config.style.theme} tooltip--{config.style.size}"
    class:tooltip--nested={!!config.parentTooltipId}
    style="
      position: fixed;
      left: {position.x}px;
      top: {position.y}px;
      z-index: {config.zIndex || 10000};
      {config.style.customCss || ''}
    "
    role="tooltip"
    aria-live="polite"
  >
    <div class="tooltip__content">
      {#if config.content.title}
        <div class="tooltip__title">{config.content.title}</div>
      {/if}
      
      {#if config.content.type === 'text'}
        <div class="tooltip__text">{config.content.data}</div>
      {:else if config.content.type === 'html'}
        {@html config.content.data}
      {:else if config.content.type === 'component'}
        <svelte:component this={config.content.data.component} {...config.content.data.props} />
      {/if}
      
      {#if config.content.description}
        <div class="tooltip__description">{config.content.description}</div>
      {/if}
      
      {#if config.content.footer}
        <div class="tooltip__footer">{config.content.footer}</div>
      {/if}
    </div>
    
    {#if config.style.theme === 'fantasy'}
      <div class="tooltip__decoration tooltip__decoration--top"></div>
      <div class="tooltip__decoration tooltip__decoration--bottom"></div>
    {/if}
  </div>
{/if}

<style lang="scss">
  @use '../shared-styles/_variables.scss' as *;
  @use '../shared-styles/_animations.scss' as *;

  .tooltip {
    pointer-events: auto;
    max-width: var(--tooltip-max-width, 400px);
    animation: tooltipEnter 0.2s ease-out;
  }

  .tooltip--fantasy {
    background: linear-gradient(135deg, var(--tooltip-bg-start, #1a1a2e) 0%, var(--tooltip-bg-end, #16213e) 100%);
    border: 2px solid var(--tooltip-border, #4a90e2);
    border-radius: 8px;
    box-shadow: 
      0 4px 20px rgba(0, 0, 0, 0.5),
      0 0 20px rgba(74, 144, 226, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    padding: 12px 16px;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--tooltip-accent, #4a90e2), transparent);
      animation: shimmer 2s infinite;
    }
  }

  .tooltip--nested {
    /* Nested tooltips get additional styling */
    box-shadow: 
      0 6px 30px rgba(0, 0, 0, 0.6),
      0 0 30px rgba(74, 144, 226, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .tooltip__content {
    position: relative;
    z-index: 1;
  }

  .tooltip__title {
    font-size: 1.1em;
    font-weight: bold;
    color: var(--tooltip-title-color, #e6cc80);
    margin-bottom: 8px;
    text-shadow: 0 0 10px rgba(230, 204, 128, 0.5);
  }

  .tooltip__text {
    color: var(--tooltip-text-color, #f0f0f0);
    line-height: 1.5;
  }

  .tooltip__description {
    color: var(--tooltip-desc-color, #b0b0b0);
    font-size: 0.9em;
    margin-top: 8px;
    line-height: 1.4;
  }

  .tooltip__footer {
    color: var(--tooltip-footer-color, #888);
    font-size: 0.85em;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tooltip__decoration {
    position: absolute;
    width: 20px;
    height: 20px;
    pointer-events: none;
    
    &--top {
      top: -2px;
      left: 50%;
      transform: translateX(-50%);
      background: radial-gradient(circle, var(--tooltip-accent, #4a90e2) 0%, transparent 70%);
      opacity: 0.6;
    }
    
    &--bottom {
      bottom: -2px;
      left: 50%;
      transform: translateX(-50%);
      background: radial-gradient(circle, var(--tooltip-accent, #4a90e2) 0%, transparent 70%);
      opacity: 0.6;
    }
  }

  @keyframes tooltipEnter {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-5px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes shimmer {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  .tooltip--small {
    font-size: 0.85em;
    padding: 8px 12px;
    max-width: 200px;
  }

  .tooltip--large {
    font-size: 1.1em;
    padding: 16px 20px;
    max-width: 500px;
  }
</style>

