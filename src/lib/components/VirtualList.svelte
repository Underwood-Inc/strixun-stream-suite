<script lang="ts">
  /**
   * Virtual List Component
   * 
   * Efficiently renders only visible items for large lists.
   * Generic component that works with any item type that has an 'id' property.
   */
  
  import { onMount } from 'svelte';
  
  // Generic type constraint - items must have an id property
  type ItemWithId = { id: string | number; [key: string]: any };
  
  export let items: ItemWithId[] = [];
  export let itemHeight: number = 40;
  export let containerHeight: number = 400;
  export let overscan: number = 5; // Extra items to render above/below viewport
  
  let container: HTMLDivElement;
  let scrollTop = 0;
  
  // Reactive variables for virtual list calculations
  let visibleItems: Array<{ item: ItemWithId; index: number }> = [];
  let offsetY = 0;
  let totalHeight = 0;
  let visibleStart = 0;
  
  // Cache to preserve object references and prevent unnecessary re-renders
  let itemCache = new Map<string | number, { item: ItemWithId; index: number }>();
  let lastItemsLength = 0;
  let lastStart = -1;
  let lastEnd = -1;
  let previousItemsLengthForScroll = 0;
  
  // Calculate visible items reactively with error handling and memoization
  $: {
    try {
      if (!items || !Array.isArray(items) || items.length === 0) {
        visibleItems = [];
        offsetY = 0;
        totalHeight = 0;
        visibleStart = 0;
        itemCache.clear();
        lastItemsLength = 0;
        lastStart = -1;
        lastEnd = -1;
      } else {
        const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const end = Math.min(
          items.length,
          Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
        );
        
        // Only recalculate if the visible range or items actually changed
        const itemsChanged = items.length !== lastItemsLength;
        const rangeChanged = start !== lastStart || end !== lastEnd;
        
        if (itemsChanged || rangeChanged) {
          // Clear cache if items length changed (items were added/removed)
          if (itemsChanged) {
            itemCache.clear();
          }
          
          // Build visible items, reusing cached objects when possible
          const newVisibleItems: Array<{ item: ItemWithId; index: number }> = [];
          const slice = items.slice(start, end).filter(item => item != null);
          
          for (let i = 0; i < slice.length; i++) {
            const item = slice[i];
            const index = start + i;
            const cacheKey = item.id;
            
            // Reuse cached object if item and index haven't changed
            let cached = itemCache.get(cacheKey);
            if (cached && cached.item === item && cached.index === index) {
              newVisibleItems.push(cached);
            } else {
              // Create new wrapper object
              cached = { item, index };
              itemCache.set(cacheKey, cached);
              newVisibleItems.push(cached);
            }
          }
          
          // Clean up cache - remove items that are no longer in the visible range
          const visibleIds = new Set(slice.map(item => item.id));
          for (const [id] of itemCache) {
            if (!visibleIds.has(id)) {
              itemCache.delete(id);
            }
          }
          
          visibleItems = newVisibleItems;
          offsetY = start * itemHeight;
          totalHeight = items.length * itemHeight;
          visibleStart = start;
          lastItemsLength = items.length;
          lastStart = start;
          lastEnd = end;
        }
      }
    } catch (error) {
      console.error('Error calculating virtual list items:', error);
      visibleItems = [];
      offsetY = 0;
      totalHeight = 0;
      visibleStart = 0;
      itemCache.clear();
      lastItemsLength = 0;
      lastStart = -1;
      lastEnd = -1;
    }
  }
  
  function handleScroll(e: Event): void {
    const target = e.target as HTMLDivElement;
    scrollTop = target.scrollTop;
  }
  
  // Auto-scroll to top when new items are added (newest first)
  // Watch for items length changes and scroll to top
  $: {
    if (items.length > previousItemsLengthForScroll && container) {
      // New items added - scroll to top
      container.scrollTop = 0;
    }
    previousItemsLengthForScroll = items.length;
  }
  
  onMount(() => {
    // Initial scroll to top if items exist
    if (container && items.length > 0) {
      container.scrollTop = 0;
      previousItemsLengthForScroll = items.length;
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
    {#each visibleItems as { item, index } (item.id)}
      <slot {item} {index} />
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

