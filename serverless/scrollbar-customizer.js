/**
 * Strixun Scrollbar Customizer
 * 
 * A standalone module that injects custom scrollbar styling into any website.
 * Can be served via CDN and works on any site without dependencies.
 * 
 * Features:
 * - Custom scrollbar styling (defaults to Strixun theme)
 * - Content adjustment to prevent layout shift when scrollbar appears
 * - Toggle for content adjustment (enabled by default)
 * - Works across all browsers (WebKit + Firefox)
 * 
 * @version 1.0.0
 */

(function(global) {
  'use strict';

  // Default configuration matching Strixun Svelte app
  const DEFAULT_CONFIG = {
    width: 6,
    trackColor: 'transparent',
    thumbColor: '#3d3627',
    thumbHoverColor: '#888',
    borderRadius: 3,
    contentAdjustment: true, // Enabled by default
    namespace: 'strixun-scrollbar'
  };

  /**
   * Scrollbar Customizer Class
   */
  class ScrollbarCustomizer {
    constructor(config = {}) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.styleId = `${this.config.namespace}-styles`;
      this.isInitialized = false;
      this.scrollbarWidth = 0;
      this.observer = null;
      this.contentAdjustmentEnabled = this.config.contentAdjustment;
      
      // Bind methods
      this.init = this.init.bind(this);
      this.destroy = this.destroy.bind(this);
      this.toggleContentAdjustment = this.toggleContentAdjustment.bind(this);
      this.updateScrollbarWidth = this.updateScrollbarWidth.bind(this);
      this.applyContentAdjustment = this.applyContentAdjustment.bind(this);
      this.removeContentAdjustment = this.removeContentAdjustment.bind(this);
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
      document.body.appendChild(outer);

      const inner = document.createElement('div');
      outer.appendChild(inner);

      const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

      outer.parentNode.removeChild(outer);
      return scrollbarWidth;
    }

    /**
     * Check if element has scrollbar
     */
    hasScrollbar(element) {
      if (!element) return false;
      return element.scrollHeight > element.clientHeight || 
             element.scrollWidth > element.clientWidth;
    }

    /**
     * Generate CSS for scrollbar styling
     */
    generateScrollbarCSS() {
      const { width, trackColor, thumbColor, thumbHoverColor, borderRadius } = this.config;
      
      return `
        /* WebKit Scrollbar Styles */
        ::-webkit-scrollbar {
          width: ${width}px;
          height: ${width}px;
        }

        ::-webkit-scrollbar-track {
          background: ${trackColor};
        }

        ::-webkit-scrollbar-thumb {
          background: ${thumbColor};
          border-radius: ${borderRadius}px;
          transition: background 0.2s ease;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: ${thumbHoverColor};
        }

        ::-webkit-scrollbar-corner {
          background: ${trackColor};
        }

        /* Firefox Scrollbar Styles */
        * {
          scrollbar-width: thin;
          scrollbar-color: ${thumbColor} ${trackColor};
        }

        /* Content adjustment styles */
        .${this.config.namespace}-adjusted {
          transition: margin-right 0.2s ease, padding-right 0.2s ease;
        }
      `;
    }

    /**
     * Inject CSS into the document
     */
    injectCSS() {
      // Remove existing styles if any
      const existing = document.getElementById(this.styleId);
      if (existing) {
        existing.remove();
      }

      const style = document.createElement('style');
      style.id = this.styleId;
      style.textContent = this.generateScrollbarCSS();
      document.head.appendChild(style);
    }

    /**
     * Update scrollbar width measurement
     */
    updateScrollbarWidth() {
      this.scrollbarWidth = this.getScrollbarWidth();
    }

    /**
     * Apply content adjustment to prevent layout shift
     */
    applyContentAdjustment() {
      if (!this.contentAdjustmentEnabled) return;

      const body = document.body;
      const html = document.documentElement;

      // Check if body has vertical scrollbar
      const hasScroll = this.hasScrollbar(body) || this.hasScrollbar(html);
      
      if (hasScroll) {
        const scrollbarWidth = this.getScrollbarWidth();
        
        if (scrollbarWidth > 0) {
          // Apply negative margin to compensate for scrollbar
          // This prevents content from shifting when scrollbar appears
          body.style.marginRight = `-${scrollbarWidth}px`;
          body.style.paddingRight = `${scrollbarWidth}px`;
          body.classList.add(`${this.config.namespace}-adjusted`);
        }
      } else {
        // Remove adjustment when scrollbar is not present
        this.removeContentAdjustment();
      }
    }

    /**
     * Remove content adjustment
     */
    removeContentAdjustment() {
      const body = document.body;
      body.style.marginRight = '';
      body.style.paddingRight = '';
      body.classList.remove(`${this.config.namespace}-adjusted`);
    }

    /**
     * Setup mutation observer to watch for scrollbar changes
     */
    setupObserver() {
      if (!this.contentAdjustmentEnabled) return;

      // Use ResizeObserver to watch for content changes
      this.observer = new ResizeObserver(() => {
        this.applyContentAdjustment();
      });

      // Observe body and html for size changes
      this.observer.observe(document.body);
      this.observer.observe(document.documentElement);

      // Also listen for window resize
      window.addEventListener('resize', this.applyContentAdjustment);
    }

    /**
     * Cleanup observer
     */
    cleanupObserver() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      window.removeEventListener('resize', this.applyContentAdjustment);
    }

    /**
     * Initialize the scrollbar customizer
     */
    init() {
      if (this.isInitialized) {
        console.warn('ScrollbarCustomizer already initialized');
        return;
      }

      // Inject CSS
      this.injectCSS();

      // Update scrollbar width
      this.updateScrollbarWidth();

      // Apply content adjustment if enabled
      if (this.contentAdjustmentEnabled) {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            this.applyContentAdjustment();
            this.setupObserver();
          });
        } else {
          this.applyContentAdjustment();
          this.setupObserver();
        }
      }

      this.isInitialized = true;
    }

    /**
     * Toggle content adjustment on/off
     */
    toggleContentAdjustment(enabled = null) {
      const newState = enabled !== null ? enabled : !this.contentAdjustmentEnabled;
      
      if (newState === this.contentAdjustmentEnabled) {
        return this.contentAdjustmentEnabled;
      }

      this.contentAdjustmentEnabled = newState;

      if (this.contentAdjustmentEnabled) {
        this.applyContentAdjustment();
        this.setupObserver();
      } else {
        this.removeContentAdjustment();
        this.cleanupObserver();
      }

      return this.contentAdjustmentEnabled;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      
      if (this.isInitialized) {
        this.injectCSS();
        if (this.contentAdjustmentEnabled) {
          this.applyContentAdjustment();
        }
      }
    }

    /**
     * Destroy the customizer and clean up
     */
    destroy() {
      if (!this.isInitialized) return;

      // Remove CSS
      const style = document.getElementById(this.styleId);
      if (style) {
        style.remove();
      }

      // Remove content adjustment
      this.removeContentAdjustment();
      this.cleanupObserver();

      this.isInitialized = false;
    }
  }

  // Auto-initialize if script is loaded directly
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (!window.ScrollbarCustomizerInstance) {
        window.ScrollbarCustomizerInstance = new ScrollbarCustomizer();
        window.ScrollbarCustomizerInstance.init();
      }
    });
  } else {
    if (!window.ScrollbarCustomizerInstance) {
      window.ScrollbarCustomizerInstance = new ScrollbarCustomizer();
      window.ScrollbarCustomizerInstance.init();
    }
  }

  // Export for manual usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollbarCustomizer;
  } else {
    global.ScrollbarCustomizer = ScrollbarCustomizer;
  }

})(typeof window !== 'undefined' ? window : this);

