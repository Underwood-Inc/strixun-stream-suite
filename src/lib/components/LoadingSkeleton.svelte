<script lang="ts">
  /**
   * Loading Skeleton Component
   * 
   * Animated placeholder content while data loads.
   * Displays shimmering lines to indicate loading state.
   * 
   * @example
   * <LoadingSkeleton lines={3} width="100%" height="20px" />
   * 
   * @example
   * <LoadingSkeleton lines={5} width="300px" height="24px" />
   */
  
  /** Number of skeleton lines to display */
  export let lines: number = 3;
  
  /** Width of the skeleton container (CSS value) */
  export let width: string = '100%';
  
  /** Height of each skeleton line (CSS value) */
  export let height: string = '20px';
  
  // import ComponentDocsButton from './ComponentDocsButton.svelte';
</script>

<div class="loading-skeleton-wrapper" style="position: relative;">
  <!-- <ComponentDocsButton componentName="LoadingSkeleton" position="top-right" size="small" /> -->
  <div class="skeleton" style="width: {width};">
  {#each Array(lines) as _, i}
    <div 
      class="skeleton__line" 
      style="height: {height}; width: {i === lines - 1 ? '80%' : '100%'};"
    ></div>
  {/each}
</div>

<style lang="scss">
  @use '@styles/animations' as *;
  
  .skeleton {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }
  
  .skeleton__line {
    background: var(--border);
    border-radius: 0; // Retro blocky
    @include shimmer-loading();
    @include gpu-accelerated;
  }
</style>

</div>

