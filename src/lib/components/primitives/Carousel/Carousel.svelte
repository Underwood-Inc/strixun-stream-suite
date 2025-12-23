<script lang="ts">
  /**
   * Carousel Component
   * 
   * A performant 3D carousel component using Swiper.
   * Features true 3D rotation effects (cube/coverflow) with perspective transforms.
   * Supports automatic rotation and manual navigation with smooth animations.
   * 
   * @example
   * ```svelte
   * <Carousel autoRotate={true} interval={5000} effect="cube">
   *   <Card>Item 1</Card>
   *   <Card>Item 2</Card>
   *   <Card>Item 3</Card>
   * </Carousel>
   * ```
   */

  import { onDestroy, onMount } from 'svelte';
  import Swiper from 'swiper';
  import 'swiper/css';
  import 'swiper/css/effect-coverflow';
  import 'swiper/css/effect-cube';
  import 'swiper/css/navigation';
  import 'swiper/css/pagination';
  import { Autoplay, EffectCoverflow, EffectCube, Navigation, Pagination } from 'swiper/modules';

  export let autoRotate: boolean = false;
  export let interval: number = 5000; // milliseconds
  export let showIndicators: boolean = true;
  export let showControls: boolean = true;
  export let className: string = '';
  export let loop: boolean = true;
  export let effect: 'cube' | 'coverflow' | 'slide' = 'coverflow';
  export let slidesPerView: number = 3;
  export let spaceBetween: number = 30;

  let swiperContainer: HTMLElement;
  let swiperWrapper: HTMLElement;
  let swiper: Swiper | null = null;
  let observer: MutationObserver | null = null;
  let isInitializing = false;

  function wrapChildrenInSlides(): boolean {
    if (!swiperWrapper) return false;
    
    const children = Array.from(swiperWrapper.children);
    let hasNewChildren = false;
    
    children.forEach((child) => {
      // Skip if already a swiper-slide
      if (child.classList.contains('swiper-slide')) return;
      
      // Skip if child is already inside a swiper-slide
      let parent = child.parentElement;
      while (parent && parent !== swiperWrapper) {
        if (parent.classList.contains('swiper-slide')) {
          return; // Already wrapped
        }
        parent = parent.parentElement;
      }
      
      hasNewChildren = true;
      
      // Create wrapper div
      const slideWrapper = document.createElement('div');
      slideWrapper.className = 'swiper-slide';
      
      // Insert wrapper before child, then move child into wrapper
      swiperWrapper.insertBefore(slideWrapper, child);
      slideWrapper.appendChild(child);
    });
    
    return hasNewChildren;
  }

  onMount(() => {
    if (!swiperContainer || !swiperWrapper) return;

    // Wait for slot content to render, then wrap children
    const initSwiper = () => {
      // Wrap children in swiper-slide divs BEFORE initializing Swiper
      wrapChildrenInSlides();
      
      // Verify we have slides before initializing
      const slides = swiperWrapper.querySelectorAll('.swiper-slide');
      if (slides.length === 0) {
        console.warn('Carousel: No slides found, retrying...');
        setTimeout(initSwiper, 50);
        return;
      }
      
      isInitializing = true;
      
      // Watch for new children and wrap them (but don't interfere during init)
      observer = new MutationObserver((mutations) => {
        // Only process if Swiper is already initialized
        if (!swiper || isInitializing) return;
        
        let shouldUpdate = false;
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && 
                !(node as Element).classList.contains('swiper-slide') &&
                node.parentElement === swiperWrapper) {
              shouldUpdate = true;
            }
          });
        });
        
        if (shouldUpdate) {
          const hadNewChildren = wrapChildrenInSlides();
          if (hadNewChildren && swiper) {
            swiper.update();
          }
        }
      });
      
      observer.observe(swiperWrapper, {
        childList: true,
        subtree: false
      });

      const modules = [];
      if (effect === 'cube') {
        modules.push(EffectCube);
      } else if (effect === 'coverflow') {
        modules.push(EffectCoverflow);
      }
      
      if (showControls) {
        modules.push(Navigation);
      }
      
      if (showIndicators) {
        modules.push(Pagination);
      }
      
      if (autoRotate) {
        modules.push(Autoplay);
      }

      swiper = new Swiper(swiperContainer, {
        modules: modules,
        effect: effect,
        loop: loop,
        slidesPerView: effect === 'coverflow' ? 'auto' : 1, // Use auto for coverflow to respect slide widths
        spaceBetween: spaceBetween,
        centeredSlides: true, // Center the active slide
        watchOverflow: true, // Watch for overflow
        autoplay: autoRotate ? {
          delay: interval,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
          enabled: true
        } : false,
        navigation: showControls ? {
          nextEl: '.carousel__control--next',
          prevEl: '.carousel__control--prev',
          disabledClass: 'carousel__control--disabled'
        } : false,
        pagination: showIndicators ? {
          el: '.carousel__pagination',
          clickable: true,
          type: 'bullets'
        } : false,
        cubeEffect: effect === 'cube' ? {
          shadow: true,
          slideShadows: true,
          shadowOffset: 20,
          shadowScale: 0.94
        } : undefined,
        coverflowEffect: effect === 'coverflow' ? {
          rotate: 20, // Reduced from 50 to prevent flipping
          stretch: 0,
          depth: 50, // Reduced depth for better visibility
          modifier: 1,
          slideShadows: true
        } : undefined,
        speed: 800, // Animation speed - increased for smoother animation
        allowTouchMove: true,
        grabCursor: true,
        on: {
          init: () => {
            isInitializing = false;
            // Start autoplay if enabled
            if (autoRotate && swiper?.autoplay) {
              swiper.autoplay.start();
            }
          },
          slideChange: () => {
            // Slide changed - can add custom logic here if needed
          }
        }
      });
      
      // Fallback in case init event doesn't fire
      setTimeout(() => {
        isInitializing = false;
      }, 100);
    };

    // Wait for next tick to ensure slot content is rendered
    setTimeout(initSwiper, 0);
  });

  onDestroy(() => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (swiper) {
      swiper.destroy(true, true);
      swiper = null;
    }
  });

  function scrollPrev(): void {
    if (swiper) {
      swiper.slidePrev();
    }
  }

  function scrollNext(): void {
    if (swiper) {
      swiper.slideNext();
    }
  }

  function scrollTo(index: number): void {
    if (swiper) {
      swiper.slideTo(index);
    }
  }

  // Update autoplay when interval changes
  $: if (swiper && autoRotate && swiper.autoplay && !isInitializing) {
    swiper.autoplay.stop();
    swiper.params.autoplay = {
      delay: interval,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
      enabled: true
    };
    swiper.autoplay.start();
  }

  // Handle autoplay toggle
  $: if (swiper && swiper.autoplay && !isInitializing) {
    if (autoRotate) {
      swiper.autoplay.start();
    } else {
      swiper.autoplay.stop();
    }
  }
</script>

<div class="carousel {className}">
  <div class="swiper carousel__swiper" bind:this={swiperContainer}>
    <div class="swiper-wrapper carousel__wrapper" bind:this={swiperWrapper}>
      <slot />
    </div>

    {#if showControls}
      <button
        class="carousel__control carousel__control--prev"
        on:click={scrollPrev}
        aria-label="Previous item"
        type="button"
        disabled={!swiper}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <button
        class="carousel__control carousel__control--next"
        on:click={scrollNext}
        aria-label="Next item"
        type="button"
        disabled={!swiper}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    {/if}

    {#if showIndicators}
      <div class="carousel__pagination"></div>
    {/if}
  </div>
</div>

<style lang="scss">
  @use '@styles/animations' as *;

  .carousel {
    position: relative;
    width: 100%;
    height: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden; // Clip to container but allow 3D transforms
  }

  .carousel__swiper {
    width: 100%;
    height: 100%;
    padding: 20px 0;
    overflow: hidden; // Clip overflow to prevent layout issues
    position: relative;
    
    // Ensure proper perspective for 3D effects
    :global(.swiper-wrapper) {
      perspective: 1000px; // Reduced perspective for less extreme 3D
      perspective-origin: center center;
    }
    
    @media (max-width: 640px) {
      padding: 12px 0;
    }
  }

  .carousel__wrapper {
    display: flex;
    align-items: stretch;
    height: 100%;
  }

  // Style Swiper slides - make them wider but constrained and responsive
  :global(.swiper-slide) {
    height: auto;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 60% !important; // Each slide takes 60% of viewport (wider but not too wide)
    min-width: 280px; // Reduced for narrow views
    max-width: 600px; // Maximum width to prevent overflow issues
    flex-shrink: 0;
    
    // Prevent text flipping on 3D transforms
    backface-visibility: hidden;
    transform-style: preserve-3d;
    
    // Responsive adjustments for narrow views
    @media (max-width: 768px) {
      width: 80% !important;
      min-width: 250px;
      max-width: 500px;
    }
    
    @media (max-width: 480px) {
      width: 90% !important;
      min-width: 200px;
      max-width: 100%;
    }
    
    > * {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      // Ensure content doesn't flip
      transform: translateZ(0);
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

  .carousel__pagination {
    position: relative;
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

  // Style Swiper pagination bullets
  :global(.swiper-pagination-bullet) {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border);
    opacity: 1;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    @include gpu-accelerated;

    &:hover {
      background: var(--border-light);
      transform: scale(1.3);
    }
  }

  :global(.swiper-pagination-bullet-active) {
    background: var(--accent);
    width: 28px;
    border-radius: 14px;
    box-shadow: 0 0 8px rgba(237, 174, 73, 0.5);
    
    @media (max-width: 640px) {
      width: 24px;
    }
  }
</style>
