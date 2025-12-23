/**
 * Scrollbar Compensation Utility
 * 
 * Prevents horizontal layout shift when scrollbars appear/disappear on any element.
 * 
 * This is a TypeScript port of the standalone scrollbar-compensation.js utility
 * for use within the Svelte application.
 * 
 * @version 1.0.0
 */

export interface ScrollbarCompensationConfig {
  /** CSS variable name for scrollbar width */
  cssVariable?: string;
  /** Transition duration for smooth compensation */
  transitionDuration?: string;
  /** Transition easing function */
  transitionEasing?: string;
  /** Auto-initialize on DOM ready */
  autoInit?: boolean;
  /** Selector for elements to watch (null = manual attach) */
  selector?: string | null;
  /** Namespace for CSS classes */
  namespace?: string;
}

interface CompensationState {
  hasScrollbar: boolean;
  scrollbarWidth: number;
  applied: boolean;
}

interface ObserverData {
  observer: ResizeObserver;
  cleanup: () => void;
}

const DEFAULT_CONFIG: Required<ScrollbarCompensationConfig> = {
  cssVariable: '--scrollbar-width',
  transitionDuration: '0.2s',
  transitionEasing: 'ease',
  autoInit: true,
  selector: null,
  namespace: 'scrollbar-compensation'
};

/**
 * Scrollbar Compensation Manager
 */
export class ScrollbarCompensation {
  private config: Required<ScrollbarCompensationConfig>;
  private elements: Map<HTMLElement, CompensationState>;
  private observers: Map<HTMLElement, ObserverData>;
  private scrollbarWidth: number;
  private isInitialized: boolean;
  private mutationObserver: MutationObserver | null = null;

  constructor(config: ScrollbarCompensationConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.elements = new Map();
    this.observers = new Map();
    this.scrollbarWidth = 0;
    this.isInitialized = false;
  }

  /**
   * Get the actual scrollbar width
   */
  getScrollbarWidth(): number {
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

    outer.parentNode?.removeChild(outer);
    return scrollbarWidth;
  }

  /**
   * Check if element has a visible vertical scrollbar
   */
  hasScrollbar(element: HTMLElement | null): boolean {
    if (!element) return false;
    return element.scrollHeight > element.clientHeight;
  }

  /**
   * Apply compensation to an element
   */
  private applyCompensation(element: HTMLElement): void {
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
  private removeCompensation(element: HTMLElement): void {
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
  update(element: HTMLElement | null): void {
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
  attach(element: HTMLElement | null): void {
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
  detach(element: HTMLElement | null): void {
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
  attachAll(selector: string): number {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    elements.forEach(el => this.attach(el));
    return elements.length;
  }

  /**
   * Detach from all elements
   */
  detachAll(): void {
    const elements = Array.from(this.elements.keys());
    elements.forEach(el => this.detach(el));
  }

  /**
   * Initialize the compensation system
   */
  init(): void {
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
        this.attachAll(this.config.selector!);
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
  destroy(): void {
    this.detachAll();

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    this.isInitialized = false;
  }
}

// Create and export global instance
let globalInstance: ScrollbarCompensation | null = null;

/**
 * Get or create global instance
 */
export function getScrollbarCompensation(config?: ScrollbarCompensationConfig): ScrollbarCompensation {
  if (!globalInstance) {
    globalInstance = new ScrollbarCompensation(config);
  }
  return globalInstance;
}

