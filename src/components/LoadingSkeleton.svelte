<script lang="ts">
  /**
   * Loading Skeleton Component
   * 
   * Animated placeholder content while data loads
   */
  
  export let lines: number = 3;
  export let width: string = '100%';
  export let height: string = '20px';
</script>

<div class="skeleton" style="width: {width};">
  {#each Array(lines) as _, i}
    <div 
      class="skeleton__line" 
      style="height: {height}; width: {i === lines - 1 ? '80%' : '100%'};"
    ></div>
  {/each}
</div>

<style lang="scss">
  @use '../styles/animations' as *;
  
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

