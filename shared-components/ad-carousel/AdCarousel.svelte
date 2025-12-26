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
  
  // Observers for ensuring visibility
  let visibilityObserver: IntersectionObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let styleObserver: MutationObserver | null = null;
  let visibilityCheckInterval: ReturnType<typeof setInterval> | null = null;

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
  let isMounted = false;
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
    console.log('[AdCarousel] Dim state toggled:', isDimmed);
    
    // Explicitly remove inline opacity to let CSS class control it
    if (carouselContainer) {
      carouselContainer.style.removeProperty('opacity');
      // Ensure visibility is still enforced
      enforceVisibility();
    }
  }
  
  // Reactive statement to ensure CSS class updates when isDimmed changes
  $: if (carouselContainer && isMounted) {
    // Remove any inline opacity that might have been set
    carouselContainer.style.removeProperty('opacity');
    // Ensure visibility is maintained
    enforceVisibility();
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
    
    // Always set position: fixed to ensure it works even if CSS doesn't load
    styles.push('position: fixed;');
    
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
    // Ensure z-index is set inline as well
    styles.push('z-index: 99999;');
    
    return styles.join(' ');
  }

  onMount(async () => {
    isMounted = true;
    console.log('[AdCarousel] Component mounted, storageKey:', storageKey);
    
    loadPersistedState();
    
    // Wait for DOM to be ready
    await tick();
    
    // Initialize portal with multiple retry attempts
    // This ensures the portal is created even if there are timing issues
    const maxRetries = 5;
    let retryCount = 0;
    
    const tryInitialize = async (): Promise<void> => {
      try {
        // Ensure document.body exists before creating portal
        if (!document.body) {
          throw new Error('document.body not available');
        }
        
        await initializePortal();
        console.log('[AdCarousel] Portal initialized successfully');
      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[AdCarousel] Portal initialization attempt ${retryCount}/${maxRetries} failed:`, errorMessage);
        
        if (retryCount < maxRetries) {
          // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
          const delay = Math.min(100 * Math.pow(2, retryCount - 1), 2000);
          setTimeout(() => {
            tryInitialize().catch(() => {
              // Final error will be logged below
            });
          }, delay);
        } else {
          console.error('[AdCarousel] Failed to initialize portal after all retries:', error);
          // Last resort: try one more time after a longer delay
          setTimeout(() => {
            initializePortal().catch((finalError) => {
              console.error('[AdCarousel] Final portal initialization attempt failed:', finalError);
            });
          }, 3000);
        }
      }
    };
    
    // Start initialization
    tryInitialize();
  });

  async function initializePortal(): Promise<void> {
    // Ensure document.body exists
    if (!document.body) {
      throw new Error('document.body not available');
    }

    // Check if portal already exists (e.g., from a previous mount)
    const portalId = `ad-carousel-portal-${storageKey.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const existingPortal = document.getElementById(portalId);
    
    if (existingPortal) {
      portalContainer = existingPortal as HTMLDivElement;
      console.log('[AdCarousel] Using existing portal:', portalId);
    } else {
      // Create portal container at body level with unique ID based on storageKey
      // Portal should cover full viewport for proper positioning context
      portalContainer = document.createElement('div');
      portalContainer.id = portalId;
      portalContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; pointer-events: none;';
      
      // Append to body - this should always work if document.body exists
      try {
        document.body.appendChild(portalContainer);
        console.log('[AdCarousel] Portal container created and appended to body:', portalId);
      } catch (appendError) {
        console.error('[AdCarousel] Failed to append portal to body:', appendError);
        throw new Error(`Failed to append portal to body: ${appendError instanceof Error ? appendError.message : String(appendError)}`);
      }
      
      // Verify portal was actually added to DOM
      const verifyPortal = document.getElementById(portalId);
      if (!verifyPortal) {
        throw new Error('Portal was created but not found in DOM after append');
      }
    }
    
    // Wait for next tick to ensure carouselContainer is bound
    await tick();
    
    // Move carousel to portal
    if (!carouselContainer) {
      throw new Error('carouselContainer not bound - component may not be fully mounted');
    }
    
    if (!portalContainer) {
      throw new Error('portalContainer is null after initialization');
    }
    
    // Only move if not already in portal
    if (carouselContainer.parentNode !== portalContainer) {
      portalContainer.appendChild(carouselContainer);
      console.log('[AdCarousel] Carousel moved to portal');
    }
    
    // Ensure carousel is visible and interactive
    // Set critical styles inline to ensure visibility even if CSS doesn't load
    carouselContainer.style.pointerEvents = 'auto';
    carouselContainer.style.display = 'flex';
    carouselContainer.style.visibility = 'visible';
    // Set background color as fallback if CSS variables don't load
    if (!carouselContainer.style.backgroundColor) {
      carouselContainer.style.backgroundColor = '#252017'; // fallback for --card
    }
    // Don't set opacity inline - let CSS class handle it via .ad-carousel--dimmed
    
    console.log('[AdCarousel] Portal initialization complete', {
      portalId,
      carouselInPortal: carouselContainer.parentNode === portalContainer,
      portalInBody: portalContainer.parentNode === document.body
    });
    
    // Set up observers to ensure visibility
    setupVisibilityObservers();
    
    // Force visibility immediately after setup
    await tick();
    enforceVisibility();
    
    // Also enforce after a short delay to catch any late-loading CSS issues
    setTimeout(() => {
      enforceVisibility();
    }, 100);
  }
  
  /**
   * Force visibility by ensuring critical styles are applied
   */
  function enforceVisibility(): void {
    if (!carouselContainer) return;
    
    try {
      // Force critical styles
      carouselContainer.style.position = 'fixed';
      carouselContainer.style.display = 'flex';
      carouselContainer.style.visibility = 'visible';
      carouselContainer.style.pointerEvents = 'auto';
      carouselContainer.style.zIndex = '99999';
      
      // Apply positioning styles from getPositionStyles()
      const positionStyles = getPositionStyles();
      // Parse and apply each style property
      const stylePairs = positionStyles.split(';').filter(s => s.trim());
      stylePairs.forEach(stylePair => {
        const colonIndex = stylePair.indexOf(':');
        if (colonIndex > 0) {
          const prop = stylePair.substring(0, colonIndex).trim();
          const value = stylePair.substring(colonIndex + 1).trim();
          if (prop && value) {
            carouselContainer.style.setProperty(prop, value);
          }
        }
      });
      
      // Ensure background is set
      const computed = window.getComputedStyle(carouselContainer);
      const bgColor = computed.backgroundColor;
      if (!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
        carouselContainer.style.backgroundColor = '#252017'; // fallback for --card
      }
      
      // Check computed styles to ensure visibility
      if (computed.display === 'none' || computed.visibility === 'hidden') {
        console.warn('[AdCarousel] Element not visible, forcing visibility', {
          display: computed.display,
          visibility: computed.visibility,
          opacity: computed.opacity
        });
        carouselContainer.style.display = 'flex';
        carouselContainer.style.visibility = 'visible';
      }
      
      // Ensure opacity is correct (but don't override if dimmed class should handle it)
      if (!isDimmed && computed.opacity === '0') {
        carouselContainer.style.opacity = '1';
      }
    } catch (error) {
      console.error('[AdCarousel] Error enforcing visibility:', error);
    }
  }
  
  /**
   * Set up observers to ensure the carousel stays visible
   */
  function setupVisibilityObservers(): void {
    if (!carouselContainer) return;
    
    // IntersectionObserver to detect if element is in viewport
    visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting && entry.intersectionRatio === 0) {
            console.warn('[AdCarousel] Element not in viewport, enforcing visibility');
            enforceVisibility();
          }
        });
      },
      {
        threshold: [0, 0.1, 1.0],
        root: null // viewport
      }
    );
    visibilityObserver.observe(carouselContainer);
    
    // MutationObserver to watch for style changes
    styleObserver = new MutationObserver((mutations) => {
      let needsEnforcement = false;
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const computed = window.getComputedStyle(carouselContainer);
          if (computed.display === 'none' || computed.visibility === 'hidden') {
            needsEnforcement = true;
          }
        }
      });
      if (needsEnforcement) {
        console.warn('[AdCarousel] Style changed to hidden, enforcing visibility');
        enforceVisibility();
      }
    });
    styleObserver.observe(carouselContainer, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    // ResizeObserver to watch for size changes (might indicate positioning issues)
    resizeObserver = new ResizeObserver(() => {
      // Check if element is actually visible
      const rect = carouselContainer.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        console.warn('[AdCarousel] Element has zero size, enforcing visibility');
        enforceVisibility();
      }
    });
    resizeObserver.observe(carouselContainer);
    
    // Periodic visibility check as a fallback
    visibilityCheckInterval = setInterval(() => {
      if (!carouselContainer) {
        clearInterval(visibilityCheckInterval!);
        return;
      }
      
      const rect = carouselContainer.getBoundingClientRect();
      const computed = window.getComputedStyle(carouselContainer);
      const isVisible = 
        computed.display !== 'none' &&
        computed.visibility !== 'hidden' &&
        computed.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0;
      
      if (!isVisible) {
        console.warn('[AdCarousel] Periodic check: element not visible, enforcing', {
          display: computed.display,
          visibility: computed.visibility,
          opacity: computed.opacity,
          rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left }
        });
        enforceVisibility();
      }
    }, 2000); // Check every 2 seconds
    
    console.log('[AdCarousel] Visibility observers set up');
  }

  onDestroy(() => {
    // Clean up observers
    if (visibilityObserver) {
      visibilityObserver.disconnect();
      visibilityObserver = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (styleObserver) {
      styleObserver.disconnect();
      styleObserver = null;
    }
    if (visibilityCheckInterval) {
      clearInterval(visibilityCheckInterval);
      visibilityCheckInterval = null;
    }
    
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

