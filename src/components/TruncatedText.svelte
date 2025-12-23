<script lang="ts">
  /**
   * TruncatedText Component
   * 
   * Reusable wrapper that automatically shows a tooltip with full text
   * only when the content is actually truncated.
   * 
   * @example
   * <TruncatedText>
   *   <span class="title-text">Long text that might be truncated</span>
   * </TruncatedText>
   * 
   * @example
   * <TruncatedText position="bottom" level="info">
   *   <div class="truncated-content">Some content</div>
   * </TruncatedText>
   */
  
  import { onMount, onDestroy } from 'svelte';
  import Tooltip from './Tooltip.svelte';
  
  export let position: 'top' | 'bottom' | 'left' | 'right' | 'auto' = 'auto';
  export let level: 'log' | 'info' | 'warning' | 'error' = 'log';
  export let delay: number = 0;
  
  let containerElement: HTMLElement;
  let isTruncated = false;
  let fullText = '';
  let resizeObserver: ResizeObserver | null = null;
  let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  
  /**
   * Check if the text content is truncated using custom JavaScript measurement
   * Creates a temporary clone to measure the full text width vs actual width
   */
  function checkTruncation(): void {
    if (!containerElement) {
      isTruncated = false;
      fullText = '';
      return;
    }
    
    // Find the first text node or element that contains text
    const textElement = findTextElement(containerElement);
    if (!textElement) {
      isTruncated = false;
      fullText = '';
      return;
    }
    
    // Get the full text content
    const text = textElement.textContent || textElement.innerText || '';
    
    if (!text.trim()) {
      isTruncated = false;
      fullText = '';
      return;
    }
    
    // Use custom JavaScript to detect truncation by measuring text width
    const isTruncatedResult = detectTextTruncation(textElement);
    
    isTruncated = isTruncatedResult;
    
    // Only set fullText if actually truncated
    if (isTruncated) {
      fullText = text;
    } else {
      fullText = '';
    }
  }
  
  /**
   * Custom JavaScript function to detect if text is truncated
   * Uses a temporary clone element to measure the full text width
   */
  function detectTextTruncation(element: HTMLElement): boolean {
    // Get computed styles
    const computedStyle = window.getComputedStyle(element);
    const whiteSpace = computedStyle.whiteSpace;
    const overflow = computedStyle.overflow;
    const overflowX = computedStyle.overflowX;
    const textOverflow = computedStyle.textOverflow;
    const maxWidth = computedStyle.maxWidth;
    const width = computedStyle.width;
    
    // Check if element has truncation styles applied
    const hasTruncationStyles = 
      (overflow === 'hidden' || overflowX === 'hidden') &&
      (textOverflow === 'ellipsis' || textOverflow === 'clip');
    
    // If no truncation styles, definitely not truncated
    if (!hasTruncationStyles && maxWidth === 'none' && !width.includes('px')) {
      return false;
    }
    
    // Method 1: Compare scrollWidth to clientWidth (most reliable for horizontal truncation)
    const scrollWidth = element.scrollWidth;
    const clientWidth = element.clientWidth;
    
    // Use a small threshold to account for sub-pixel rendering (1px is usually enough)
    const threshold = 1;
    const isHorizontallyTruncated = scrollWidth > clientWidth + threshold;
    
    // Method 2: For vertical truncation (line-clamp, max-height)
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    const isVerticallyTruncated = scrollHeight > clientHeight + threshold;
    
    // Method 3: Create a temporary clone to measure full text width
    // This is the most accurate method for detecting truncation
    let isTruncatedByMeasurement = false;
    
    try {
      // Create a temporary clone
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Set styles to measure full width
      clone.style.position = 'absolute';
      clone.style.visibility = 'hidden';
      clone.style.width = 'auto';
      clone.style.maxWidth = 'none';
      clone.style.overflow = 'visible';
      clone.style.whiteSpace = whiteSpace;
      clone.style.fontSize = computedStyle.fontSize;
      clone.style.fontFamily = computedStyle.fontFamily;
      clone.style.fontWeight = computedStyle.fontWeight;
      clone.style.fontStyle = computedStyle.fontStyle;
      clone.style.letterSpacing = computedStyle.letterSpacing;
      clone.style.textTransform = computedStyle.textTransform;
      clone.style.padding = computedStyle.padding;
      clone.style.border = computedStyle.border;
      clone.style.boxSizing = computedStyle.boxSizing;
      
      // Append to body temporarily
      document.body.appendChild(clone);
      
      // Measure the full width
      const fullWidth = clone.offsetWidth;
      const actualWidth = element.offsetWidth;
      
      // Clean up
      document.body.removeChild(clone);
      
      // Compare: if full width is greater than actual width, it's truncated
      // Use threshold to account for rounding
      isTruncatedByMeasurement = fullWidth > actualWidth + threshold;
    } catch (error) {
      // If cloning fails, fall back to scrollWidth method
      console.warn('Truncation detection: clone method failed, using scrollWidth', error);
    }
    
    // Return true if any method detects truncation
    // Prefer the measurement method if available, otherwise use scrollWidth
    return isTruncatedByMeasurement || isHorizontallyTruncated || isVerticallyTruncated;
  }
  
  /**
   * Find the element that actually contains the text
   * Traverses the DOM to find the deepest element with text content
   */
  function findTextElement(element: HTMLElement): HTMLElement | null {
    // If this element has text and is likely the text container, return it
    if (element.textContent && element.textContent.trim()) {
      // Check if it's a direct text container (span, div, p, etc.)
      const tagName = element.tagName.toLowerCase();
      if (['span', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'label', 'button'].includes(tagName)) {
        return element;
      }
    }
    
    // Otherwise, look for the first child element that has text
    for (const child of Array.from(element.children)) {
      const result = findTextElement(child as HTMLElement);
      if (result) return result;
    }
    
    // If no child element found, return the element itself if it has text
    if (element.textContent && element.textContent.trim()) {
      return element;
    }
    
    return null;
  }
  
  function handleResize(): void {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      requestAnimationFrame(() => {
        checkTruncation();
      });
    }, 100);
  }
  
  onMount(() => {
    // Wait for next frame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      // Initial check after a small delay to ensure styles are applied
      setTimeout(() => {
        checkTruncation();
      }, 50);
      
      // Watch for resize changes (window resize, content changes, etc.)
      resizeObserver = new ResizeObserver(() => {
        // Debounce resize checks slightly to avoid excessive calculations
        requestAnimationFrame(() => {
          checkTruncation();
        });
      });
      
      if (containerElement) {
        resizeObserver.observe(containerElement);
        // Also observe the text element if we can find it
        const textElement = findTextElement(containerElement);
        if (textElement && textElement !== containerElement) {
          resizeObserver.observe(textElement);
        }
      }
    });
    
    // Also check on window resize (debounced)
    window.addEventListener('resize', handleResize);
  });
  
  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    window.removeEventListener('resize', handleResize);
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
      resizeTimeout = null;
    }
  });
  
  // Re-check when slot content changes
  $: if (containerElement) {
    // Use requestAnimationFrame to check after DOM updates
    requestAnimationFrame(() => {
      checkTruncation();
    });
  }
</script>

<div class="truncated-text-wrapper" bind:this={containerElement}>
  {#if isTruncated && fullText}
    <Tooltip text={fullText} position={position} level={level} delay={delay}>
      <slot />
    </Tooltip>
  {:else}
    <slot />
  {/if}
</div>

<style lang="scss">
  .truncated-text-wrapper {
    display: inline-block;
    min-width: 0;
    max-width: 100%;
    width: 100%;
  }
  
  // Let the child handle its own truncation - just ensure it respects wrapper width
  .truncated-text-wrapper :global(> *) {
    max-width: 100%;
    min-width: 0;
  }
</style>

