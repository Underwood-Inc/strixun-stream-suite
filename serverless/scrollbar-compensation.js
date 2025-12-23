/**
 * Scrollbar Compensation Utility
 * 
 * A standalone, agnostic utility that prevents horizontal layout shift
 * when scrollbars appear/disappear on any element.
 * 
 * Features:
 * - Works on any element (not just body/html)
 * - Automatic scrollbar detection
 * - CSS variable-based compensation
 * - Zero dependencies
 * - Can be used globally or per-element
 * - Works with any CSS framework
 * 
 * @version 1.0.0
 */

(function(global) {
  'use strict';

  /**
   * Default configuration
   */
  const DEFAULT_CONFIG = {
    // CSS variable name for scrollbar width
    cssVariable: '--scrollbar-width',
    // Transition duration for smooth compensation
    transitionDuration: '0.2s',
    // Transition easing function
    transitionEasing: 'ease',
    // Auto-initialize on DOM ready
    autoInit: true,
    // Selector for elements to watch (null = manual attach)
    selector: null,
    // Namespace for CSS classes
    namespace: 'scrollbar-compensation'
  };

  /**
   * Scrollbar Compensation Manager
   */
  class ScrollbarCompensation {
    constructor(config = {}) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.elements = new Map(); // Map of element -> compensation state
      this.observers = new Map(); // Map of element -> ResizeObserver
      this.scrollbarWidth = 0;
      this.isInitialized = false;
      
      // Bind methods
      this.attach = this.attach.bind(this);
      this.detach = this.detach.bind(this);
      this.update = this.update.bind(this);
      this.getScrollbarWidth = this.getScrollbarWidth.bind(this);
      this.hasScrollbar = this.hasScrollbar.bind(this);
      this.applyCompensation = this.applyCompensation.bind(this);
      this.removeCompensation = this.removeCompensation.bind(this);
    }

    /**
     * Get the actual scrollbar width
     */
    getScrollbarWidth() {
      // Create a temporary div to measure scrollbar width
      const outer = document.createElement('div');
      outer.style.visibility = 'hidden';
      outer.style.overflow = 'scroll';
      outer.style.msOverflowStyle = 'scrollbar'; // Needed for IE
      outer.style.width = '100px';
      outer.style.position = 'absolute';
      outer.style.top = '-9999px';
      document.body.appendChild(outer);

      const inner = document.createElement('div');
      inner.style.width = '100%';
      outer.appendChild(inner);

      const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

      outer.parentNode.removeChild(outer);
      return scrollbarWidth;
    }

    /**
     * Check if element has a visible vertical scrollbar
     */
    hasScrollbar(element) {
      if (!element) return false;
      return element.scrollHeight > element.clientHeight;
    }

    /**
     * Apply compensation to an element
     */
    applyCompensation(element) {
      if (!element) return;

      const hasScroll = this.hasScrollbar(element);
      const scrollbarWidth = hasScroll ? this.scrollbarWidth : 0;

      // Set CSS variable on the element
      element.style.setProperty(
        this.config.cssVariable,
        `${scrollbarWidth}px`
      );

      // Add transition for smooth compensation
      const transition = `margin-right ${this.config.transitionDuration} ${this.config.transitionEasing}, padding-right ${this.config.transitionDuration} ${this.config.transitionEasing}`;
      
      // Check if transition is already set (to avoid overwriting)
      const currentTransition = element.style.transition || '';
      if (!currentTransition.includes('margin-right')) {
        element.style.transition = currentTransition
          ? `${currentTransition}, ${transition}`
          : transition;
      }

      // Apply compensation using CSS calc
      // Negative margin compensates for scrollbar space
      // Positive padding pushes content back
      element.style.marginRight = `calc(${this.config.cssVariable} * -1)`;
      element.style.paddingRight = `var(${this.config.cssVariable}, 0px)`;

      // Store compensation state
      this.elements.set(element, {
        hasScrollbar: hasScroll,
        scrollbarWidth: scrollbarWidth,
        applied: true
      });
    }

    /**
     * Remove compensation from an element
     */
    removeCompensation(element) {
      if (!element) return;

      element.style.removeProperty(this.config.cssVariable);
      element.style.removeProperty('margin-right');
      element.style.removeProperty('padding-right');

      // Remove transition (only if we added it)
      const transition = element.style.transition || '';
      if (transition.includes('margin-right')) {
        const newTransition = transition
          .split(',')
          .filter(t => !t.trim().includes('margin-right') && !t.trim().includes('padding-right'))
          .join(',')
          .trim();
        element.style.transition = newTransition || '';
      }

      this.elements.delete(element);
    }

    /**
     * Update compensation for an element
     */
    update(element) {
      if (!element) return;

      // Update scrollbar width measurement
      this.scrollbarWidth = this.getScrollbarWidth();

      const hasScroll = this.hasScrollbar(element);
      const previousState = this.elements.get(element);

      // Only update if state changed
      if (!previousState || previousState.hasScrollbar !== hasScroll || previousState.scrollbarWidth !== this.scrollbarWidth) {
        if (hasScroll) {
          this.applyCompensation(element);
        } else {
          this.removeCompensation(element);
        }
      }
    }

    /**
     * Attach compensation to an element
     */
    attach(element) {
      if (!element || this.elements.has(element)) {
        return; // Already attached
      }

      // Initial update
      this.update(element);

      // Create ResizeObserver to watch for changes
      const observer = new ResizeObserver(() => {
        // Use requestAnimationFrame to batch updates
        requestAnimationFrame(() => {
          this.update(element);
        });
      });

      // Observe the element
      observer.observe(element);

      // Also watch for scroll events (content might change)
      const handleScroll = () => {
        requestAnimationFrame(() => {
          this.update(element);
        });
      };

      element.addEventListener('scroll', handleScroll, { passive: true });

      // Store observer and cleanup function
      this.observers.set(element, {
        observer: observer,
        cleanup: () => {
          observer.disconnect();
          element.removeEventListener('scroll', handleScroll);
        }
      });
    }

    /**
     * Detach compensation from an element
     */
    detach(element) {
      if (!element) return;

      // Remove compensation
      this.removeCompensation(element);

      // Cleanup observer
      const observerData = this.observers.get(element);
      if (observerData) {
        observerData.cleanup();
        this.observers.delete(element);
      }
    }

    /**
     * Attach to multiple elements via selector
     */
    attachAll(selector) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => this.attach(el));
      return elements.length;
    }

    /**
     * Detach from all elements
     */
    detachAll() {
      const elements = Array.from(this.elements.keys());
      elements.forEach(el => this.detach(el));
    }

    /**
     * Initialize the compensation system
     */
    init() {
      if (this.isInitialized) {
        console.warn('ScrollbarCompensation already initialized');
        return;
      }

      // Update scrollbar width
      this.scrollbarWidth = this.getScrollbarWidth();

      // If selector is provided, attach to matching elements
      if (this.config.selector) {
        this.attachAll(this.config.selector);
      }

      // Watch for new elements matching selector (if provided)
      if (this.config.selector) {
        const mutationObserver = new MutationObserver(() => {
          this.attachAll(this.config.selector);
        });

        mutationObserver.observe(document.body, {
          childList: true,
          subtree: true
        });

        this.mutationObserver = mutationObserver;
      }

      this.isInitialized = true;
    }

    /**
     * Destroy and clean up
     */
    destroy() {
      this.detachAll();

      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }

      this.isInitialized = false;
    }
  }

  // Create global instance
  let globalInstance = null;

  /**
   * Get or create global instance
   */
  function getInstance(config) {
    if (!globalInstance) {
      globalInstance = new ScrollbarCompensation(config);
    }
    return globalInstance;
  }

  // Auto-initialize if enabled
  if (DEFAULT_CONFIG.autoInit) {
    function initialize() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          getInstance().init();
        });
      } else {
        getInstance().init();
      }
    }

    // Run immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
    } else {
      initialize();
    }
  }

  // Export for manual usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollbarCompensation;
  } else {
    global.ScrollbarCompensation = ScrollbarCompensation;
    global.scrollbarCompensation = getInstance();
  }

})(typeof window !== 'undefined' ? window : this);

