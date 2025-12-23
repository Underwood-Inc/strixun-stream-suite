<script lang="ts">
  /**
   * Carousel Component
   * 
   * A performant, composable carousel component with smooth animations.
   * Supports automatic rotation and manual navigation.
   * 
   * @example
   * ```svelte
   * <Carousel autoRotate={true} interval={5000}>
   *   <div slot="items">
   *     <Card>Item 1</Card>
   *     <Card>Item 2</Card>
   *     <Card>Item 3</Card>
   *   </div>
   * </Carousel>
   * ```
   */

  import { onMount, onDestroy } from 'svelte';

  export let autoRotate: boolean = false;
  export let interval: number = 5000; // milliseconds
  export let showIndicators: boolean = true;
  export let showControls: boolean = true;
  export let transitionDuration: number = 500; // milliseconds
  export let className: string = '';

  let container: HTMLDivElement;
  let currentIndex = 0;
  let items: HTMLElement[] = [];
  let autoRotateTimer: ReturnType<typeof setInterval> | null = null;
  let isTransitioning = false;

  // Get all carousel items from slot
  function updateItems(): void {
    if (!container) return;
    items = Array.from(container.querySelectorAll(':scope > *')) as HTMLElement[];
    if (items.length > 0) {
      updateCarousel();
    }
  }

  // Update carousel position
  function updateCarousel(): void {
    if (!container || items.length === 0) return;
    
    const translateX = -currentIndex * 100;
    container.style.transform = `translateX(${translateX}%)`;
  }

  // Go to specific index
  function goToIndex(index: number): void {
    if (isTransitioning || items.length === 0) return;
    if (index < 0 || index >= items.length) return;
    
    isTransitioning = true;
    currentIndex = index;
    updateCarousel();
    
    setTimeout(() => {
      isTransitioning = false;
    }, transitionDuration);
  }

  // Navigate to next item
  function next(): void {
    const nextIndex = (currentIndex + 1) % items.length;
    goToIndex(nextIndex);
  }

  // Navigate to previous item
  function previous(): void {
    const prevIndex = (currentIndex - 1 + items.length) % items.length;
    goToIndex(prevIndex);
  }

  // Start auto-rotation
  function startAutoRotate(): void {
    if (!autoRotate || items.length <= 1) return;
    
    stopAutoRotate();
    autoRotateTimer = setInterval(() => {
      next();
    }, interval);
  }

  // Stop auto-rotation
  function stopAutoRotate(): void {
    if (autoRotateTimer) {
      clearInterval(autoRotateTimer);
      autoRotateTimer = null;
    }
  }

  // Pause on hover
  function handleMouseEnter(): void {
    if (autoRotate) {
      stopAutoRotate();
    }
  }

  // Resume on mouse leave
  function handleMouseLeave(): void {
    if (autoRotate) {
      startAutoRotate();
    }
  }

  // Reactive: update when autoRotate or interval changes
  $: {
    if (autoRotate) {
      startAutoRotate();
    } else {
      stopAutoRotate();
    }
  }

  onMount(() => {
    // Use MutationObserver to detect slot content changes
    const observer = new MutationObserver(() => {
      updateItems();
    });

    if (container) {
      observer.observe(container, {
        childList: true,
        subtree: false
      });
      updateItems();
      
      if (autoRotate) {
        startAutoRotate();
      }
    }

    return () => {
      observer.disconnect();
    };
  });

  onDestroy(() => {
    stopAutoRotate();
  });
</script>

<div
  class="carousel {className}"
  style="--carousel-transition-duration: {transitionDuration}ms;"
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
>
  <div class="carousel__viewport">
    <div class="carousel__container" bind:this={container}>
      <slot />
    </div>
  </div>

  {#if showControls && items.length > 1}
    <button
      class="carousel__control carousel__control--prev"
      on:click={previous}
      aria-label="Previous item"
      type="button"
    >
      ‹
    </button>
    <button
      class="carousel__control carousel__control--next"
      on:click={next}
      aria-label="Next item"
      type="button"
    >
      ›
    </button>
  {/if}

  {#if showIndicators && items.length > 1}
    <div class="carousel__indicators">
      {#each Array(items.length) as _, index}
        <button
          class="carousel__indicator"
          class:carousel__indicator--active={currentIndex === index}
          on:click={() => goToIndex(index)}
          aria-label="Go to item {index + 1}"
          type="button"
        />
      {/each}
    </div>
  {/if}
</div>

<style lang="scss">
  @use '@styles/animations' as *;

  .carousel {
    position: relative;
    width: 100%;
    overflow: hidden;
  }

  .carousel__viewport {
    position: relative;
    width: 100%;
    overflow: hidden;
  }

  .carousel__container {
    display: flex;
    width: 100%;
    transition: transform var(--carousel-transition-duration, 500ms) cubic-bezier(0.4, 0, 0.2, 1);
    @include gpu-accelerated;
  }

  .carousel__container > * {
    flex: 0 0 100%;
    min-width: 0;
  }

  .carousel__control {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 40px;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: 50%;
    color: var(--text);
    font-size: 24px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    @include gpu-accelerated;

    &:hover {
      background: var(--accent);
      border-color: var(--accent-dark);
      color: #000;
      transform: translateY(-50%) scale(1.1);
    }

    &:active {
      transform: translateY(-50%) scale(0.95);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .carousel__control--prev {
    left: 16px;
  }

  .carousel__control--next {
    right: 16px;
  }

  .carousel__indicators {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    z-index: 10;
  }

  .carousel__indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border);
    border: none;
    cursor: pointer;
    padding: 0;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    @include gpu-accelerated;

    &:hover {
      background: var(--border-light);
      transform: scale(1.2);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .carousel__indicator--active {
    background: var(--accent);
    width: 24px;
    border-radius: 5px;
  }
</style>

