<script lang="ts">
  /**
   * Carousel Component
   * 
   * A performant carousel component using Embla Carousel.
   * Features 3D-style overlapping items with depth effects.
   * Supports automatic rotation and manual navigation.
   * 
   * @example
   * ```svelte
   * <Carousel autoRotate={true} interval={5000}>
   *   <Card>Item 1</Card>
   *   <Card>Item 2</Card>
   *   <Card>Item 3</Card>
   * </Carousel>
   * ```
   */

  import { onMount, onDestroy } from 'svelte';
  import EmblaCarousel from 'embla-carousel';
  import Autoplay from 'embla-carousel-autoplay';

  export let autoRotate: boolean = false;
  export let interval: number = 5000; // milliseconds
  export let showIndicators: boolean = true;
  export let showControls: boolean = true;
  export let className: string = '';
  export let loop: boolean = true;
  export let align: 'start' | 'center' | 'end' = 'center';
  export let slidesToScroll: number = 1;

  let emblaNode: HTMLElement;
  let containerNode: HTMLElement;
  let emblaApi: EmblaCarousel | null = null;
  let selectedIndex = 0;
  let autoplayPlugin: ReturnType<typeof Autoplay> | null = null;
  let slides: HTMLElement[] = [];

  function updateSlides(): void {
    if (!containerNode) return;
    slides = Array.from(containerNode.children) as HTMLElement[];
    slides.forEach((slide) => {
      slide.classList.add('carousel__slide');
    });
    updateSlideStyles();
  }

  function updateSlideStyles(): void {
    if (!emblaApi || slides.length === 0) return;
    
    const selected = emblaApi.selectedScrollSnap();
    
    slides.forEach((slide, index) => {
      const distance = Math.abs(index - selected);
      
      if (distance === 0) {
        // Active slide
        slide.style.opacity = '1';
        slide.style.transform = 'scale(1)';
        slide.style.filter = 'blur(0px)';
        slide.style.zIndex = '10';
      } else if (distance === 1) {
        // Adjacent slides
        slide.style.opacity = '0.6';
        slide.style.transform = 'scale(0.9)';
        slide.style.filter = 'blur(2px)';
        slide.style.zIndex = '5';
      } else {
        // Far slides
        slide.style.opacity = '0.3';
        slide.style.transform = 'scale(0.85)';
        slide.style.filter = 'blur(4px)';
        slide.style.zIndex = '1';
      }
    });
  }

  onMount(() => {
    if (!emblaNode) return;

    const plugins = [];
    if (autoRotate) {
      autoplayPlugin = Autoplay({ delay: interval, stopOnInteraction: true, stopOnMouseEnter: true });
      plugins.push(autoplayPlugin);
    }

    emblaApi = EmblaCarousel(emblaNode, {
      loop: loop,
      align: align,
      slidesToScroll: slidesToScroll,
      containScroll: 'trimSnaps'
    }, plugins);

    emblaApi.on('select', () => {
      selectedIndex = emblaApi.selectedScrollSnap();
      updateSlideStyles();
    });

    emblaApi.on('reInit', () => {
      updateSlides();
      updateSlideStyles();
    });

    // Use MutationObserver to detect when slot content changes
    const observer = new MutationObserver(() => {
      updateSlides();
    });

    if (containerNode) {
      observer.observe(containerNode, {
        childList: true,
        subtree: false
      });
    }

    // Initial update after a short delay to ensure DOM is ready
    setTimeout(() => {
      updateSlides();
    }, 0);

    return () => {
      observer.disconnect();
      if (emblaApi) {
        emblaApi.destroy();
      }
    };
  });

  onDestroy(() => {
    if (emblaApi) {
      emblaApi.destroy();
    }
    if (autoplayPlugin) {
      autoplayPlugin.stop();
    }
  });

  function scrollPrev(): void {
    emblaApi?.scrollPrev();
  }

  function scrollNext(): void {
    emblaApi?.scrollNext();
  }

  function scrollTo(index: number): void {
    emblaApi?.scrollTo(index);
  }

  $: if (emblaApi && autoRotate && autoplayPlugin) {
    // Check if updateDelay method exists before calling it
    // Some versions of embla-carousel-autoplay may not have this method
    if (typeof autoplayPlugin.updateDelay === 'function') {
      autoplayPlugin.updateDelay(interval);
    } else {
      // Fallback: stop and restart autoplay with new delay
      // This is less efficient but works if updateDelay is not available
      if (typeof autoplayPlugin.stop === 'function') {
        autoplayPlugin.stop();
      }
      // Note: We can't easily recreate the plugin without reinitializing the carousel
      // So we'll just log a warning and continue with the existing delay
      console.warn('Carousel: updateDelay method not available on autoplay plugin. Interval change ignored.');
    }
  }
</script>

<div class="carousel {className}">
  <div class="carousel__viewport" bind:this={emblaNode}>
    <div class="carousel__container" bind:this={containerNode}>
      <slot />
    </div>
  </div>

  {#if showControls && emblaApi}
    {#if emblaApi.canScrollPrev() || loop}
      <button
        class="carousel__control carousel__control--prev"
        on:click={scrollPrev}
        aria-label="Previous item"
        type="button"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
    {/if}
    {#if emblaApi.canScrollNext() || loop}
      <button
        class="carousel__control carousel__control--next"
        on:click={scrollNext}
        aria-label="Next item"
        type="button"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    {/if}
  {/if}

  {#if showIndicators && emblaApi}
    <div class="carousel__indicators">
      {#each Array(emblaApi.scrollSnapList().length) as _, index}
        <button
          class="carousel__indicator"
          class:carousel__indicator--active={selectedIndex === index}
          on:click={() => scrollTo(index)}
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
  }

  .carousel__viewport {
    overflow: hidden;
    width: 100%;
    padding: 20px 0;
    
    @media (max-width: 640px) {
      padding: 12px 0;
    }
  }

  .carousel__container {
    display: flex;
    touch-action: pan-y pinch-zoom;
    margin-left: -20px;
  }

  .carousel__container > * {
    flex: 0 0 calc(100% - 40px);
    min-width: 0;
    padding-left: 20px;
    padding-right: 20px;
    position: relative;
    
    // 3D effect transitions
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
                filter 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    @include gpu-accelerated;
    
    @media (max-width: 640px) {
      flex: 0 0 calc(100% - 24px);
      padding-left: 12px;
      padding-right: 12px;
    }
    
    @media (min-width: 1024px) {
      flex: 0 0 calc(85% - 40px);
    }
  }

  .carousel__control {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 48px;
    height: 48px;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: 50%;
    color: var(--text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    @include gpu-accelerated;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    
    svg {
      width: 20px;
      height: 20px;
      stroke: currentColor;
    }

    &:hover {
      background: var(--accent);
      border-color: var(--accent-dark);
      color: #000;
      transform: translateY(-50%) scale(1.1);
      box-shadow: 0 4px 12px rgba(237, 174, 73, 0.4);
    }

    &:active {
      transform: translateY(-50%) scale(0.95);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    
    @media (max-width: 640px) {
      width: 40px;
      height: 40px;
      
      svg {
        width: 18px;
        height: 18px;
      }
    }
  }

  .carousel__control--prev {
    left: clamp(8px, 2vw, 24px);
  }

  .carousel__control--next {
    right: clamp(8px, 2vw, 24px);
  }

  .carousel__indicators {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    padding: 20px 16px;
    z-index: 100;
    flex-shrink: 0;
    
    @media (max-width: 640px) {
      padding: 16px 12px;
      gap: 8px;
    }
  }

  .carousel__indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border);
    border: none;
    cursor: pointer;
    padding: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    @include gpu-accelerated;

    &:hover {
      background: var(--border-light);
      transform: scale(1.3);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .carousel__indicator--active {
    background: var(--accent);
    width: 28px;
    border-radius: 14px;
    box-shadow: 0 0 8px rgba(237, 174, 73, 0.5);
    
    @media (max-width: 640px) {
      width: 24px;
    }
  }
</style>
