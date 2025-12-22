<script lang="ts">
  /**
   * ResizableZone Component
   * 
   * A composable, reusable component for creating resizable zones.
   * Supports infinite nesting and both vertical and horizontal resizing.
   * 
   * @example
   * ```svelte
   * <ResizableZone direction="vertical" minSize={100} maxSize={600} storageKey="my-zone">
   *   <div slot="content">Resizable content here</div>
   * </ResizableZone>
   * ```
   */

  import { onMount, onDestroy } from 'svelte';
  import { ResizableZoneController, type ResizableZoneConfig } from './ResizableZone';

  export let direction: 'vertical' | 'horizontal' = 'vertical';
  export let minSize: number = 50;
  export let maxSize: number = Infinity;
  export let defaultSize: number = 200;
  export let handlePosition: 'start' | 'end' = 'end';
  export let storageKey: string | undefined = undefined;
  export let disabled: boolean = false;
  export let onResize: ((size: number) => void) | undefined = undefined;
  export let class: string = '';

  let container: HTMLDivElement;
  let handle: HTMLDivElement;
  let controller: ResizableZoneController;

  $: config: ResizableZoneConfig = {
    direction,
    minSize,
    maxSize,
    defaultSize,
    handlePosition,
    storageKey,
    disabled,
    onResize
  };

  onMount(() => {
    controller = new ResizableZoneController(config);
    if (container) {
      controller.attach(container);
    }

    if (handle) {
      const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        controller.startResize(e);
      };

      const handleTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        controller.startResize(e);
      };

      handle.addEventListener('mousedown', handleMouseDown);
      handle.addEventListener('touchstart', handleTouchStart);

      return () => {
        handle.removeEventListener('mousedown', handleMouseDown);
        handle.removeEventListener('touchstart', handleTouchStart);
      };
    }
  });

  onDestroy(() => {
    if (controller) {
      controller.destroy();
    }
  });

  // Update controller when config changes
  $: if (controller) {
    controller.updateConfig(config);
  }
</script>

<div
  class="resizable-zone"
  class:resizable-zone--vertical={direction === 'vertical'}
  class:resizable-zone--horizontal={direction === 'horizontal'}
  class:resizable-zone--disabled={disabled}
  class:resizable-zone--resizing={controller?.isResizing()}
  class={class}
>
  <div class="resizable-zone__content" bind:this={container}>
    <slot name="content" />
  </div>
  
  {#if !disabled}
    <div
      class="resizable-zone__handle"
      class:resizable-zone__handle--start={handlePosition === 'start'}
      class:resizable-zone__handle--end={handlePosition === 'end'}
      bind:this={handle}
      role="separator"
      aria-orientation={direction === 'vertical' ? 'horizontal' : 'vertical'}
      aria-label={direction === 'vertical' ? 'Resize vertically' : 'Resize horizontally'}
      tabindex="0"
    />
  {/if}
</div>

<style>
  .resizable-zone {
    position: relative;
    display: flex;
    flex-shrink: 0;
  }

  .resizable-zone--vertical {
    flex-direction: column;
  }

  .resizable-zone--horizontal {
    flex-direction: row;
  }

  .resizable-zone__content {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .resizable-zone--vertical .resizable-zone__content {
    overflow-y: auto;
  }

  .resizable-zone--horizontal .resizable-zone__content {
    overflow-x: auto;
  }

  .resizable-zone__handle {
    flex-shrink: 0;
    background: var(--border);
    transition: background 0.2s ease;
    z-index: 10;
    user-select: none;
    -webkit-user-select: none;
  }

  .resizable-zone--vertical .resizable-zone__handle {
    width: 100%;
    height: 4px;
    cursor: ns-resize;
  }

  .resizable-zone--vertical .resizable-zone__handle:hover,
  .resizable-zone--vertical .resizable-zone__handle:focus {
    background: var(--border-light);
  }

  .resizable-zone--horizontal .resizable-zone__handle {
    width: 4px;
    height: 100%;
    cursor: ew-resize;
  }

  .resizable-zone--horizontal .resizable-zone__handle:hover,
  .resizable-zone--horizontal .resizable-zone__handle:focus {
    background: var(--border-light);
  }

  .resizable-zone--resizing .resizable-zone__handle {
    background: var(--accent);
  }

  .resizable-zone--resizing .resizable-zone__content {
    transition: none;
  }

  .resizable-zone--disabled .resizable-zone__handle {
    opacity: 0.3;
    pointer-events: none;
    cursor: default;
  }
</style>

