/**
 * Smooth Scroll Utility
 * 
 * Enable smooth scrolling for anchor links across all Strixun applications
 * Extracted from otp-auth-service/src/pages/LandingPage.svelte
 * 
 * @example
 * // Svelte
 * import { enableSmoothScroll } from '@strixun/dom-utils';
 * onMount(() => {
 *   const cleanup = enableSmoothScroll();
 *   return cleanup;
 * });
 * 
 * @example
 * // React
 * import { enableSmoothScroll } from '@strixun/dom-utils';
 * useEffect(() => {
 *   const cleanup = enableSmoothScroll();
 *   return cleanup;
 * }, []);
 */

export interface SmoothScrollOptions extends ScrollIntoViewOptions {
  /**
   * CSS selector for anchor links (default: 'a[href^="#"]')
   */
  selector?: string;
}

/**
 * Enable smooth scrolling for all anchor links on the page
 * 
 * @param options - Scroll options (selector, behavior, block, etc.)
 * @returns Cleanup function to remove event listeners
 */
export function enableSmoothScroll(
  options: SmoothScrollOptions = {}
): () => void {
  if (typeof window === 'undefined') {
    // SSR/server-side: return no-op cleanup
    return () => {};
  }

  const {
    selector = 'a[href^="#"]',
    behavior = 'smooth',
    block = 'start',
    ...scrollOptions
  } = options;

  const handleClick = (e: Event) => {
    e.preventDefault();
    const anchor = e.currentTarget as HTMLAnchorElement;
    const href = anchor.getAttribute('href');
    if (!href) return;

    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({
        behavior,
        block,
        ...scrollOptions,
      });
    }
  };

  const anchors = document.querySelectorAll<HTMLAnchorElement>(selector);
  anchors.forEach((anchor) => {
    anchor.addEventListener('click', handleClick);
  });

  // Return cleanup function
  return () => {
    anchors.forEach((anchor) => {
      anchor.removeEventListener('click', handleClick);
    });
  };
}

/**
 * Scroll to a specific element smoothly
 * 
 * @param target - CSS selector or HTMLElement
 * @param options - Scroll options
 */
export function scrollToElement(
  target: string | HTMLElement,
  options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'start' }
): void {
  if (typeof window === 'undefined') return;

  const element = typeof target === 'string' 
    ? document.querySelector<HTMLElement>(target)
    : target;

  if (element) {
    element.scrollIntoView(options);
  }
}

/**
 * Scroll to top of page smoothly
 * 
 * @param options - Scroll options
 */
export function scrollToTop(
  options: ScrollToOptions = { behavior: 'smooth', top: 0 }
): void {
  if (typeof window === 'undefined') return;

  window.scrollTo(options);
}
