<script lang="ts">
  /**
   * AdCarousel Component
   * 
   * A floating, agnostic carousel component for displaying advertisements.
   * Supports any type of ad content: Google Analytics custom ads, other services,
   * custom media images, HTML content, etc.
   * 
   * Renders at body level via portal for proper z-index stacking.
   * 
   * @example
   * ```svelte
   * <AdCarousel position="bottom-right" autoRotate={true} interval={8000}>
   *   <TwitchSupportCard />
   *   <CustomAdCard />
   * </AdCarousel>
   * ```
   */

  import { onDestroy, onMount, tick } from 'svelte';
  import Carousel from './Carousel.svelte';
  import { localStorageAdapter, type StorageAdapter } from './storage';

  export let position: 'bottom-left' | 'bottom-right' | 'bottom-center' = 'bottom-right';
  export let autoRotate: boolean = true;
  export let interval: number = 8000; // milliseconds
  export let showIndicators: boolean = false;
  export let showControls: boolean = false; // Hidden by default for ads
  export let width: number = 320;
  export let maxHeight: number = 200;
  export let storageKey: string = 'ui_ad_carousel_state';
  export let defaultDimmed: boolean = false;
  export let className: string = '';
  export let storage: StorageAdapter = localStorageAdapter; // Allow custom storage adapter

  let carouselContainer: HTMLDivElement;
  let portalContainer: HTMLDivElement | null = null;
  let isDimmed = defaultDimmed;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let currentX = 0;
  let currentY = 0;
  let initialX = 0;
  let initialY = 0;

  interface SavedState {
    dimmed: boolean;
    x?: number;
    y?: number;
  }

  // Load persisted state
  function loadPersistedState(): void {
    const savedState = storage.get(storageKey);
    if (savedState && typeof savedState === 'object') {
      const state = savedState as SavedState;
      if (state.dimmed !== undefined) {
        isDimmed = state.dimmed;
      }
      if (state.x !== undefined && state.y !== undefined) {
        currentX = state.x;
        currentY = state.y;
      }
    }
  }

  function saveState(): void {
    const state: SavedState = {
      dimmed: isDimmed,
      x: currentX,
      y: currentY
    };
    storage.set(storageKey, state);
  }

  function toggleDimmed(): void {
    isDimmed = !isDimmed;
    saveState();
  }

  function startDrag(e: MouseEvent | TouchEvent): void {
    const target = e.target as HTMLElement;
    // Only allow dragging from header area, not from buttons or content
    if (!target.closest('.ad-carousel__header') || target.closest('.ad-carousel__dim-button')) {
      return;
    }
    
    isDragging = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // If we haven't dragged before, convert from bottom-based to top-based positioning
    if (currentX === 0 && currentY === 0 && carouselContainer) {
      const rect = carouselContainer.getBoundingClientRect();
      currentX = rect.left;
      currentY = rect.top;
    }
    
    dragStartX = clientX - currentX;
    dragStartY = clientY - currentY;
    initialX = currentX;
    initialY = currentY;
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', handleDrag);
    document.addEventListener('touchend', stopDrag);
    
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrag(e: MouseEvent | TouchEvent): void {
    if (!isDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    currentX = clientX - dragStartX;
    currentY = clientY - dragStartY;
    
    // Constrain to viewport
    const maxX = window.innerWidth - width;
    const maxY = window.innerHeight - (carouselContainer?.offsetHeight || maxHeight);
    
    currentX = Math.max(0, Math.min(currentX, maxX));
    currentY = Math.max(0, Math.min(currentY, maxY));
    
    if (carouselContainer) {
      carouselContainer.style.left = `${currentX}px`;
      carouselContainer.style.top = `${currentY}px`;
      carouselContainer.style.right = 'auto';
      carouselContainer.style.bottom = 'auto';
      carouselContainer.style.transform = 'none';
    }
  }

  function stopDrag(): void {
    if (isDragging) {
      isDragging = false;
      saveState();
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('touchmove', handleDrag);
      document.removeEventListener('touchend', stopDrag);
    }
  }

  function getPositionStyles(): string {
    const styles: string[] = [];
    
    // If dragged, use absolute positioning
    if (currentX !== 0 || currentY !== 0) {
      styles.push(`left: ${currentX}px;`);
      styles.push(`top: ${currentY}px;`);
      styles.push('right: auto;');
      styles.push('bottom: auto;');
      styles.push('transform: none;');
    } else {
      // Use default position
      switch (position) {
        case 'bottom-left':
          styles.push('left: 20px;');
          styles.push('right: auto;');
          break;
        case 'bottom-right':
          styles.push('right: 20px;');
          styles.push('left: auto;');
          break;
        case 'bottom-center':
          styles.push('left: 50%;');
          styles.push('right: auto;');
          styles.push('transform: translateX(-50%);');
          break;
      }
      styles.push('bottom: 20px;');
      styles.push('top: auto;');
    }
    
    styles.push(`width: ${width}px;`);
    styles.push(`max-height: ${maxHeight}px;`);
    
    return styles.join(' ');
  }

  onMount(async () => {
    loadPersistedState();
    
    // Wait for DOM to be ready
    await tick();
    
    // Ensure document.body exists before creating portal
    if (!document.body) {
      console.error('[AdCarousel] document.body not available, retrying...');
      // Retry after a short delay
      setTimeout(() => {
        if (document.body && !portalContainer) {
          initializePortal();
        }
      }, 100);
      return;
    }
    
    initializePortal();
  });

  async function initializePortal(): Promise<void> {
    try {
      // Check if portal already exists (e.g., from a previous mount)
      const existingPortal = document.getElementById(`ad-carousel-portal-${storageKey.replace(/[^a-zA-Z0-9]/g, '-')}`);
      if (existingPortal) {
        portalContainer = existingPortal as HTMLDivElement;
      } else {
        // Create portal container at body level with unique ID based on storageKey
        portalContainer = document.createElement('div');
        portalContainer.id = `ad-carousel-portal-${storageKey.replace(/[^a-zA-Z0-9]/g, '-')}`;
        portalContainer.style.cssText = 'position: fixed; z-index: 99999; pointer-events: none;';
        document.body.appendChild(portalContainer);
      }
      
      // Wait for next tick to ensure carouselContainer is bound
      await tick();
      
      // Move carousel to portal
      if (carouselContainer && portalContainer) {
        // Only move if not already in portal
        if (carouselContainer.parentNode !== portalContainer) {
          portalContainer.appendChild(carouselContainer);
        }
        carouselContainer.style.pointerEvents = 'auto';
      } else {
        console.warn('[AdCarousel] carouselContainer or portalContainer not available');
      }
    } catch (error) {
      console.error('[AdCarousel] Failed to initialize portal:', error);
    }
  }

  onDestroy(() => {
    // Clean up portal container
    if (portalContainer && portalContainer.parentNode) {
      portalContainer.parentNode.removeChild(portalContainer);
    }
  });
</script>

<div
  bind:this={carouselContainer}
  class="ad-carousel ad-carousel--{position} {className}"
  class:ad-carousel--dimmed={isDimmed}
  class:ad-carousel--dragging={isDragging}
  style={getPositionStyles()}
>
  <div class="ad-carousel__header" on:mousedown={startDrag} on:touchstart={startDrag}>
    <div class="ad-carousel__drag-handle" title="Drag to move">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="5" r="1"/>
        <circle cx="9" cy="12" r="1"/>
        <circle cx="9" cy="19" r="1"/>
        <circle cx="15" cy="5" r="1"/>
        <circle cx="15" cy="12" r="1"/>
        <circle cx="15" cy="19" r="1"/>
      </svg>
    </div>
    <button
      class="ad-carousel__dim-button"
      on:click|stopPropagation={toggleDimmed}
      aria-label={isDimmed ? 'Show ad carousel' : 'Dim ad carousel'}
      type="button"
    >
      {isDimmed ? 'Show' : 'Dim'}
    </button>
  </div>
  
  <div class="ad-carousel__content">
    <Carousel
      {autoRotate}
      {interval}
      {showIndicators}
      {showControls}
      effect="slide"
      loop={false}
    >
      <slot />
    </Carousel>
  </div>
</div>

<style lang="scss">
  .ad-carousel {
    position: fixed;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    overflow: visible;
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform, opacity;
    z-index: 99999;
    user-select: none;
  }

  .ad-carousel--dimmed {
    opacity: 0.4;
    
    &:hover {
      opacity: 0.7;
    }
  }

  .ad-carousel--dragging {
    cursor: grabbing;
    transition: none;
    z-index: 100000;
  }

  .ad-carousel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-dark);
    flex-shrink: 0;
    cursor: grab;
  }

  .ad-carousel__drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    cursor: grab;
    padding: 4px;
    
    svg {
      width: 14px;
      height: 14px;
    }

    .ad-carousel--dragging & {
      cursor: grabbing;
    }
  }

  .ad-carousel__dim-button {
    padding: 4px 8px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
    flex-shrink: 0;
    white-space: nowrap;

    &:hover {
      background: var(--border);
      color: var(--text);
      border-color: var(--border-light);
    }

    &:active {
      transform: scale(0.95);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
  }

  .ad-carousel__content {
    flex: 1;
    overflow: visible;
    min-height: 0;
    height: 100%;
    cursor: default;
    padding: 6px 8px 12px 8px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;

    // Override Carousel container padding and height
    :global(.carousel__swiper) {
      padding: 0;
      height: 100%;
    }

    // Override Carousel slide width and height for ad carousel - slides should take full width
    // Scoped to this component only to avoid conflicts with other carousels
    // More specific selector to override base Carousel styles
    :global(.swiper-slide) {
      width: 100%;
      min-width: 100%;
      max-width: 100%;
      padding: 0;
      height: 100%;
      max-height: 100%;
      box-sizing: border-box;
      display: flex;
      overflow: visible;
      align-items: stretch;
    }

    // Ensure carousel wrapper allows overflow for hover effects
    :global(.swiper-wrapper) {
      align-items: stretch;
      height: 100%;
    }

    // Carousel container - scoped to this component
    :global(.swiper) {
      height: 100%;
      flex: 1;
      min-height: 0;
      overflow: visible;
    }
    
    :global(.swiper-wrapper) {
      overflow: visible;
    }
  }

  // Responsive adjustments
  @media (max-width: 768px) {
    .ad-carousel {
      width: calc(100vw - 40px);
      max-width: 320px;
    }
  }

  @media (max-width: 480px) {
    .ad-carousel {
      width: calc(100vw - 32px);
      max-width: 300px;
    }
  }
</style>

