<script lang="ts">
  /**
   * Virtual List Component
   * 
   * Efficiently renders only visible items for large lists
   */
  
  import { onMount } from 'svelte';
  
  import type { LogEntry } from '../stores/activity-log';
  
  export let items: LogEntry[];
  export let itemHeight: number = 40;
  export let containerHeight: number = 400;
  export let overscan: number = 5; // Extra items to render above/below viewport
  
  let container: HTMLDivElement;
  let scrollTop = 0;
  
  // Reactive variables for virtual list calculations
  let visibleItems: LogEntry[] = [];
  let offsetY = 0;
  let totalHeight = 0;
  let visibleStart = 0;
  
  // Calculate visible items reactively
  $: {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    visibleItems = items.slice(start, end);
    offsetY = start * itemHeight;
    totalHeight = items.length * itemHeight;
    visibleStart = start;
  }
  
  function handleScroll(e: Event): void {
    const target = e.target as HTMLDivElement;
    scrollTop = target.scrollTop;
  }
  
  onMount(() => {
    // Auto-scroll to top when new items are added (newest first)
    if (container && items.length > 0) {
      container.scrollTop = 0;
    }
  });
</script>

<div 
  class="virtual-list"
  bind:this={container}
  style="height: {containerHeight}px;"
  on:scroll={handleScroll}
  role="log"
  aria-label="Activity log"
>
  <div 
    class="virtual-list__spacer"
    style="height: {totalHeight}px;"
  ></div>
  <div 
    class="virtual-list__viewport"
    style="transform: translateY({offsetY}px);"
  >
    {#each visibleItems as item, localIndex (item.id || `${visibleStart + localIndex}`)}
      <slot item={item} index={visibleStart + localIndex} />
    {/each}
  </div>
</div>

<style lang="scss">
  @use '@styles/mixins' as *;
  
  .virtual-list {
    position: relative;
    overflow-y: auto;
    overflow-x: hidden;
    @include scrollbar(6px);
  }
  
  .virtual-list__spacer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    pointer-events: none;
  }
  
  .virtual-list__viewport {
    position: relative;
  }
</style>

