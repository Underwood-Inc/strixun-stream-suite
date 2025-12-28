/**
 * Scrollbar CDN Handlers
 * 
 * Handles serving scrollbar customization JavaScript files
 * 
 * NOTE: Large inline code strings - can be extracted to separate files later
 */

import { getCorsHeaders } from '../utils/cors.js';

const SCROLLBAR_CODE = `(function(global) {
  'use strict';

  const DEFAULT_CONFIG = {
    width: 6,
    trackColor: 'transparent',
    thumbColor: '#3d3627',
    thumbHoverColor: '#888',
    borderRadius: 3,
    contentAdjustment: true,
    namespace: 'strixun-scrollbar'
  };

  class ScrollbarCustomizer {
    constructor(config = {}) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.styleId = \`\${this.config.namespace}-styles\`;
      this.isInitialized = false;
      this.scrollbarWidth = 0;
      this.observer = null;
      this.contentAdjustmentEnabled = this.config.contentAdjustment;
      
      this.init = this.init.bind(this);
      this.destroy = this.destroy.bind(this);
      this.toggleContentAdjustment = this.toggleContentAdjustment.bind(this);
      this.updateScrollbarWidth = this.updateScrollbarWidth.bind(this);
      this.applyContentAdjustment = this.applyContentAdjustment.bind(this);
      this.removeContentAdjustment = this.removeContentAdjustment.bind(this);
    }

    getScrollbarWidth() {
      const outer = document.createElement('div');
      outer.style.visibility = 'hidden';
      outer.style.overflow = 'scroll';
      outer.style.msOverflowStyle = 'scrollbar';
      document.body.appendChild(outer);

      const inner = document.createElement('div');
      outer.appendChild(inner);

      const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

      outer.parentNode.removeChild(outer);
      return scrollbarWidth;
    }

    hasScrollbar(element) {
      if (!element) return false;
      return element.scrollHeight > element.clientHeight || 
             element.scrollWidth > element.clientWidth;
    }

    generateScrollbarCSS() {
      const { width, trackColor, thumbColor, thumbHoverColor, borderRadius } = this.config;
      
      return \`
        ::-webkit-scrollbar {
          width: \${width}px;
          height: \${width}px;
        }

        ::-webkit-scrollbar-track {
          background: \${trackColor};
        }

        ::-webkit-scrollbar-thumb {
          background: \${thumbColor};
          border-radius: \${borderRadius}px;
          transition: background 0.2s ease;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: \${thumbHoverColor};
        }

        ::-webkit-scrollbar-corner {
          background: \${trackColor};
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: \${thumbColor} \${trackColor};
        }

        .\${this.config.namespace}-adjusted {
          transition: margin-right 0.2s ease, padding-right 0.2s ease;
        }
      \`;
    }

    injectCSS() {
      const existing = document.getElementById(this.styleId);
      if (existing) {
        existing.remove();
      }

      const style = document.createElement('style');
      style.id = this.styleId;
      style.textContent = this.generateScrollbarCSS();
      document.head.appendChild(style);
    }

    updateScrollbarWidth() {
      this.scrollbarWidth = this.getScrollbarWidth();
    }

    applyContentAdjustment() {
      if (!this.contentAdjustmentEnabled) return;

      const body = document.body;
      const html = document.documentElement;

      const hasScroll = this.hasScrollbar(body) || this.hasScrollbar(html);
      
      if (hasScroll) {
        const scrollbarWidth = this.getScrollbarWidth();
        
        if (scrollbarWidth > 0) {
          body.style.marginRight = \`-\${scrollbarWidth}px\`;
          body.style.paddingRight = \`\${scrollbarWidth}px\`;
          body.classList.add(\`\${this.config.namespace}-adjusted\`);
        }
      } else {
        this.removeContentAdjustment();
      }
    }

    removeContentAdjustment() {
      const body = document.body;
      body.style.marginRight = '';
      body.style.paddingRight = '';
      body.classList.remove(\`\${this.config.namespace}-adjusted\`);
    }

    setupObserver() {
      if (!this.contentAdjustmentEnabled) return;

      this.observer = new ResizeObserver(() => {
        this.applyContentAdjustment();
      });

      this.observer.observe(document.body);
      this.observer.observe(document.documentElement);

      window.addEventListener('resize', this.applyContentAdjustment);
    }

    cleanupObserver() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      window.removeEventListener('resize', this.applyContentAdjustment);
    }

    init() {
      if (this.isInitialized) {
        console.warn('ScrollbarCustomizer already initialized');
        return;
      }

      this.injectCSS();
      this.updateScrollbarWidth();

      if (this.contentAdjustmentEnabled) {
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

    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      
      if (this.isInitialized) {
        this.injectCSS();
        if (this.contentAdjustmentEnabled) {
          this.applyContentAdjustment();
        }
      }
    }

    destroy() {
      if (!this.isInitialized) return;

      const style = document.getElementById(this.styleId);
      if (style) {
        style.remove();
      }

      this.removeContentAdjustment();
      this.cleanupObserver();

      this.isInitialized = false;
    }
  }

  // Auto-initialize with defaults
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollbarCustomizer;
  } else {
    global.ScrollbarCustomizer = ScrollbarCustomizer;
  }

})(typeof window !== 'undefined' ? window : this);`;

/**
 * Scrollbar Customizer UI Tool
 * Includes base scrollbar functionality + UI controls that auto-update styles
 */
const SCROLLBAR_CUSTOMIZER_CODE = `(function(global) {
  'use strict';

  const DEFAULT_CONFIG = {
    width: 6,
    trackColor: 'transparent',
    thumbColor: '#3d3627',
    thumbHoverColor: '#888',
    borderRadius: 3,
    contentAdjustment: true,
    namespace: 'strixun-scrollbar'
  };

  class ScrollbarCustomizer {
    constructor(config = {}) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.styleId = \`\${this.config.namespace}-styles\`;
      this.isInitialized = false;
      this.scrollbarWidth = 0;
      this.observer = null;
      this.contentAdjustmentEnabled = this.config.contentAdjustment;
      
      this.init = this.init.bind(this);
      this.destroy = this.destroy.bind(this);
      this.toggleContentAdjustment = this.toggleContentAdjustment.bind(this);
      this.updateScrollbarWidth = this.updateScrollbarWidth.bind(this);
      this.applyContentAdjustment = this.applyContentAdjustment.bind(this);
      this.removeContentAdjustment = this.removeContentAdjustment.bind(this);
    }

    getScrollbarWidth() {
      const outer = document.createElement('div');
      outer.style.visibility = 'hidden';
      outer.style.overflow = 'scroll';
      outer.style.msOverflowStyle = 'scrollbar';
      document.body.appendChild(outer);

      const inner = document.createElement('div');
      outer.appendChild(inner);

      const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

      outer.parentNode.removeChild(outer);
      return scrollbarWidth;
    }

    hasScrollbar(element) {
      if (!element) return false;
      return element.scrollHeight > element.clientHeight || 
             element.scrollWidth > element.clientWidth;
    }

    generateScrollbarCSS() {
      const { width, trackColor, thumbColor, thumbHoverColor, borderRadius } = this.config;
      
      return \`
        ::-webkit-scrollbar {
          width: \${width}px;
          height: \${width}px;
        }

        ::-webkit-scrollbar-track {
          background: \${trackColor};
        }

        ::-webkit-scrollbar-thumb {
          background: \${thumbColor};
          border-radius: \${borderRadius}px;
          transition: background 0.2s ease;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: \${thumbHoverColor};
        }

        ::-webkit-scrollbar-corner {
          background: \${trackColor};
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: \${thumbColor} \${trackColor};
        }

        .\${this.config.namespace}-adjusted {
          transition: margin-right 0.2s ease, padding-right 0.2s ease;
        }
      \`;
    }

    injectCSS() {
      const existing = document.getElementById(this.styleId);
      if (existing) {
        existing.remove();
      }

      const style = document.createElement('style');
      style.id = this.styleId;
      style.textContent = this.generateScrollbarCSS();
      document.head.appendChild(style);
    }

    updateScrollbarWidth() {
      this.scrollbarWidth = this.getScrollbarWidth();
    }

    applyContentAdjustment() {
      if (!this.contentAdjustmentEnabled) return;

      const body = document.body;
      const html = document.documentElement;

      const hasScroll = this.hasScrollbar(body) || this.hasScrollbar(html);
      
      if (hasScroll) {
        const scrollbarWidth = this.getScrollbarWidth();
        
        if (scrollbarWidth > 0) {
          body.style.marginRight = \`-\${scrollbarWidth}px\`;
          body.style.paddingRight = \`\${scrollbarWidth}px\`;
          body.classList.add(\`\${this.config.namespace}-adjusted\`);
        }
      } else {
        this.removeContentAdjustment();
      }
    }

    removeContentAdjustment() {
      const body = document.body;
      body.style.marginRight = '';
      body.style.paddingRight = '';
      body.classList.remove(\`\${this.config.namespace}-adjusted\`);
    }

    setupObserver() {
      if (!this.contentAdjustmentEnabled) return;

      this.observer = new ResizeObserver(() => {
        this.applyContentAdjustment();
      });

      this.observer.observe(document.body);
      this.observer.observe(document.documentElement);

      window.addEventListener('resize', this.applyContentAdjustment);
    }

    cleanupObserver() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      window.removeEventListener('resize', this.applyContentAdjustment);
    }

    init() {
      if (this.isInitialized) {
        console.warn('ScrollbarCustomizer already initialized');
        return;
      }

      this.injectCSS();
      this.updateScrollbarWidth();

      if (this.contentAdjustmentEnabled) {
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

    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      
      if (this.isInitialized) {
        this.injectCSS();
        if (this.contentAdjustmentEnabled) {
          this.applyContentAdjustment();
        }
      }
    }

    destroy() {
      if (!this.isInitialized) return;

      const style = document.getElementById(this.styleId);
      if (style) {
        style.remove();
      }

      this.removeContentAdjustment();
      this.cleanupObserver();

      this.isInitialized = false;
    }
  }

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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollbarCustomizer;
  } else {
    global.ScrollbarCustomizer = ScrollbarCustomizer;
  }

})(typeof window !== 'undefined' ? window : this);`;

/**
 * Scrollbar Compensation Utility Code
 * Prevents horizontal layout shift when scrollbars appear/disappear
 */
const SCROLLBAR_COMPENSATION_CODE = `/**
 * Scrollbar Compensation Utility
 * 
 * A standalone, agnostic utility that prevents horizontal layout shift
 * when scrollbars appear/disappear on any element.
 * 
 * @version 1.0.0
 */

(function(global) {
  'use strict';

  const DEFAULT_CONFIG = {
    cssVariable: '--scrollbar-width',
    transitionDuration: '0.2s',
    transitionEasing: 'ease',
    autoInit: true,
    selector: null,
    namespace: 'scrollbar-compensation'
  };

  class ScrollbarCompensation {
    constructor(config = {}) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.elements = new Map();
      this.observers = new Map();
      this.scrollbarWidth = 0;
      this.isInitialized = false;
      
      this.attach = this.attach.bind(this);
      this.detach = this.detach.bind(this);
      this.update = this.update.bind(this);
      this.getScrollbarWidth = this.getScrollbarWidth.bind(this);
      this.hasScrollbar = this.hasScrollbar.bind(this);
      this.applyCompensation = this.applyCompensation.bind(this);
      this.removeCompensation = this.removeCompensation.bind(this);
    }

    getScrollbarWidth() {
      const outer = document.createElement('div');
      outer.style.visibility = 'hidden';
      outer.style.overflow = 'scroll';
      outer.style.msOverflowStyle = 'scrollbar';
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

    hasScrollbar(element) {
      if (!element) return false;
      return element.scrollHeight > element.clientHeight;
    }

    applyCompensation(element) {
      if (!element) return;

      const hasScroll = this.hasScrollbar(element);
      const scrollbarWidth = hasScroll ? this.scrollbarWidth : 0;

      element.style.setProperty(this.config.cssVariable, \`\${scrollbarWidth}px\`);

      const transition = \`margin-right \${this.config.transitionDuration} \${this.config.transitionEasing}, padding-right \${this.config.transitionDuration} \${this.config.transitionEasing}\`;
      
      const currentTransition = element.style.transition || '';
      if (!currentTransition.includes('margin-right')) {
        element.style.transition = currentTransition
          ? \`\${currentTransition}, \${transition}\`
          : transition;
      }

      element.style.marginRight = \`calc(\${this.config.cssVariable} * -1)\`;
      element.style.paddingRight = \`var(\${this.config.cssVariable}, 0px)\`;

      this.elements.set(element, {
        hasScrollbar: hasScroll,
        scrollbarWidth: scrollbarWidth,
        applied: true
      });
    }

    removeCompensation(element) {
      if (!element) return;

      element.style.removeProperty(this.config.cssVariable);
      element.style.removeProperty('margin-right');
      element.style.removeProperty('padding-right');

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

    update(element) {
      if (!element) return;

      this.scrollbarWidth = this.getScrollbarWidth();
      const hasScroll = this.hasScrollbar(element);
      const previousState = this.elements.get(element);

      if (!previousState || previousState.hasScrollbar !== hasScroll || previousState.scrollbarWidth !== this.scrollbarWidth) {
        if (hasScroll) {
          this.applyCompensation(element);
        } else {
          this.removeCompensation(element);
        }
      }
    }

    attach(element) {
      if (!element || this.elements.has(element)) return;

      this.update(element);

      const observer = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          this.update(element);
        });
      });

      observer.observe(element);

      const handleScroll = () => {
        requestAnimationFrame(() => {
          this.update(element);
        });
      };

      element.addEventListener('scroll', handleScroll, { passive: true });

      this.observers.set(element, {
        observer: observer,
        cleanup: () => {
          observer.disconnect();
          element.removeEventListener('scroll', handleScroll);
        }
      });
    }

    detach(element) {
      if (!element) return;

      this.removeCompensation(element);

      const observerData = this.observers.get(element);
      if (observerData) {
        observerData.cleanup();
        this.observers.delete(element);
      }
    }

    attachAll(selector) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => this.attach(el));
      return elements.length;
    }

    detachAll() {
      const elements = Array.from(this.elements.keys());
      elements.forEach(el => this.detach(el));
    }

    init() {
      if (this.isInitialized) {
        console.warn('ScrollbarCompensation already initialized');
        return;
      }

      this.scrollbarWidth = this.getScrollbarWidth();

      if (this.config.selector) {
        this.attachAll(this.config.selector);
      }

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

    destroy() {
      this.detachAll();

      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }

      this.isInitialized = false;
    }
  }

  let globalInstance = null;

  function getInstance(config) {
    if (!globalInstance) {
      globalInstance = new ScrollbarCompensation(config);
    }
    return globalInstance;
  }

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

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
    } else {
      initialize();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrollbarCompensation;
  } else {
    global.ScrollbarCompensation = ScrollbarCompensation;
    global.scrollbarCompensation = getInstance();
  }

})(typeof window !== 'undefined' ? window : this);`;

/**
 * Handle scrollbar compensation CDN endpoint
 * GET /cdn/scrollbar-compensation.js
 * Serves the scrollbar compensation utility
 */
export async function handleScrollbarCompensation(request, env) {
    try {
        return new Response(SCROLLBAR_COMPENSATION_CODE, {
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'public, max-age=31536000, immutable'
            },
        });
    } catch (error) {
        return new Response(`// Error loading scrollbar compensation: ${error.message}`, {
            status: 500,
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/javascript'
            },
        });
    }
}

/**
 * Handle scrollbar base styling CDN endpoint
 * GET /cdn/scrollbar.js
 * Serves the base scrollbar styling injection (defaults only)
 */
export async function handleScrollbar(request, env) {
    try {
        return new Response(SCROLLBAR_CODE, {
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'public, max-age=31536000, immutable'
            },
        });
    } catch (error) {
        return new Response(`// Error loading scrollbar: ${error.message}`, {
            status: 500,
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/javascript'
            },
        });
    }
}

/**
 * Handle scrollbar customizer UI CDN endpoint
 * GET /cdn/scrollbar-customizer.js
 * Serves the scrollbar customizer with UI controls that auto-update styles
 */
export async function handleScrollbarCustomizer(request, env) {
    try {
        const url = new URL(request.url);
        const workerUrl = url.origin;
        
        // Build the customizer code that includes base + UI
        const customizerCode = SCROLLBAR_CODE + `
        
// UI Customizer - Auto-updates scrollbar styles
(function() {
  'use strict';
  
  const workerUrl = '${workerUrl}';
  
  // Wait for base scrollbar to initialize
  function waitForBase(callback, maxAttempts = 50) {
    if (window.ScrollbarCustomizerInstance && window.ScrollbarCustomizerInstance.isInitialized) {
      callback(window.ScrollbarCustomizerInstance);
      return;
    }
    if (maxAttempts <= 0) {
      console.error('ScrollbarCustomizer base not initialized');
      return;
    }
    setTimeout(() => waitForBase(callback, maxAttempts - 1), 100);
  }
  
  waitForBase((customizer) => {
    // Create UI
    const ui = document.createElement('div');
    ui.id = 'strixun-scrollbar-ui';
    ui.innerHTML = \`
      <style>
        #strixun-scrollbar-ui {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #252017;
          border: 1px solid #3d3627;
          border-radius: 8px;
          padding: 20px;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #f9f9f9;
          min-width: 280px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        #strixun-scrollbar-ui h3 {
          margin: 0 0 16px 0;
          color: #edae49;
          font-size: 1rem;
        }
        #strixun-scrollbar-ui .control-group {
          margin-bottom: 16px;
        }
        #strixun-scrollbar-ui label {
          display: block;
          font-size: 0.85rem;
          color: #b8b8b8;
          margin-bottom: 6px;
        }
        #strixun-scrollbar-ui input[type="range"] {
          width: 100%;
          margin-bottom: 4px;
        }
        #strixun-scrollbar-ui .value {
          color: #edae49;
          font-weight: 600;
          font-size: 0.9rem;
        }
        #strixun-scrollbar-ui input[type="color"] {
          width: 50px;
          height: 40px;
          border: 1px solid #3d3627;
          border-radius: 4px;
          cursor: pointer;
        }
        #strixun-scrollbar-ui .color-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        #strixun-scrollbar-ui .color-preview {
          width: 40px;
          height: 40px;
          border: 1px solid #3d3627;
          border-radius: 4px;
          background: #3d3627;
        }
        #strixun-scrollbar-ui button {
          background: #edae49;
          color: #000;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.85rem;
          margin-top: 8px;
        }
        #strixun-scrollbar-ui button:hover {
          background: #f9df74;
        }
        #strixun-scrollbar-ui .toggle-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        #strixun-scrollbar-ui .toggle {
          width: 40px;
          height: 22px;
          background: #3d3627;
          border-radius: 11px;
          position: relative;
          cursor: pointer;
          transition: background 0.2s;
        }
        #strixun-scrollbar-ui .toggle.active {
          background: #edae49;
        }
        #strixun-scrollbar-ui .toggle-thumb {
          width: 18px;
          height: 18px;
          background: #fff;
          border-radius: 50%;
          position: absolute;
          top: 2px;
          left: 2px;
          transition: transform 0.2s;
        }
        #strixun-scrollbar-ui .toggle.active .toggle-thumb {
          transform: translateX(18px);
        }
      </style>
      <h3>[UI] Scrollbar Customizer</h3>
      <div class="control-group">
        <label>Width: <span class="value" id="width-val">6</span>px</label>
        <input type="range" id="width" min="4" max="20" value="6">
      </div>
      <div class="control-group">
        <label>Thumb Color</label>
        <div class="color-row">
          <div class="color-preview" id="thumb-preview"></div>
          <input type="color" id="thumb-color" value="#3d3627">
        </div>
      </div>
      <div class="control-group">
        <label>Hover Color</label>
        <div class="color-row">
          <div class="color-preview" id="hover-preview"></div>
          <input type="color" id="hover-color" value="#888888">
        </div>
      </div>
      <div class="control-group">
        <label>Track Color</label>
        <div class="color-row">
          <div class="color-preview" id="track-preview" style="background: transparent; border: 2px dashed #3d3627;"></div>
          <input type="color" id="track-color" value="#000000">
        </div>
      </div>
      <div class="control-group">
        <label>Radius: <span class="value" id="radius-val">3</span>px</label>
        <input type="range" id="radius" min="0" max="10" value="3">
      </div>
      <div class="control-group">
        <div class="toggle-row">
          <div class="toggle active" id="adjust-toggle">
            <div class="toggle-thumb"></div>
          </div>
          <label style="margin:0;font-size:0.8rem;">Content Adjustment</label>
        </div>
      </div>
      <button id="reset-btn">Reset</button>
    \`;
    document.body.appendChild(ui);
    
    // Controls
    const widthInput = ui.querySelector('#width');
    const widthVal = ui.querySelector('#width-val');
    const thumbColor = ui.querySelector('#thumb-color');
    const thumbPreview = ui.querySelector('#thumb-preview');
    const hoverColor = ui.querySelector('#hover-color');
    const hoverPreview = ui.querySelector('#hover-preview');
    const trackColor = ui.querySelector('#track-color');
    const trackPreview = ui.querySelector('#track-preview');
    const radiusInput = ui.querySelector('#radius');
    const radiusVal = ui.querySelector('#radius-val');
    const adjustToggle = ui.querySelector('#adjust-toggle');
    const resetBtn = ui.querySelector('#reset-btn');
    
    // Update previews
    thumbPreview.style.background = thumbColor.value;
    hoverPreview.style.background = hoverColor.value;
    
    // Event listeners - auto-update styles
    widthInput.addEventListener('input', (e) => {
      widthVal.textContent = e.target.value;
      customizer.updateConfig({ width: parseInt(e.target.value) });
    });
    
    thumbColor.addEventListener('input', (e) => {
      thumbPreview.style.background = e.target.value;
      customizer.updateConfig({ thumbColor: e.target.value });
    });
    
    hoverColor.addEventListener('input', (e) => {
      hoverPreview.style.background = e.target.value;
      customizer.updateConfig({ thumbHoverColor: e.target.value });
    });
    
    trackColor.addEventListener('input', (e) => {
      const color = e.target.value === '#000000' ? 'transparent' : e.target.value;
      if (color === 'transparent') {
        trackPreview.style.background = 'transparent';
        trackPreview.style.border = '2px dashed #3d3627';
      } else {
        trackPreview.style.background = color;
        trackPreview.style.border = '1px solid #3d3627';
      }
      customizer.updateConfig({ trackColor: color });
    });
    
    radiusInput.addEventListener('input', (e) => {
      radiusVal.textContent = e.target.value;
      customizer.updateConfig({ borderRadius: parseInt(e.target.value) });
    });
    
    adjustToggle.addEventListener('click', () => {
      adjustToggle.classList.toggle('active');
      const enabled = adjustToggle.classList.contains('active');
      customizer.toggleContentAdjustment(enabled);
    });
    
    resetBtn.addEventListener('click', () => {
      customizer.destroy();
      window.ScrollbarCustomizerInstance = new ScrollbarCustomizer();
      window.ScrollbarCustomizerInstance.init();
      customizer = window.ScrollbarCustomizerInstance;
      
      widthInput.value = 6;
      widthVal.textContent = '6';
      thumbColor.value = '#3d3627';
      thumbPreview.style.background = '#3d3627';
      hoverColor.value = '#888888';
      hoverPreview.style.background = '#888888';
      trackColor.value = '#000000';
      trackPreview.style.background = 'transparent';
      trackPreview.style.border = '2px dashed #3d3627';
      radiusInput.value = 3;
      radiusVal.textContent = '3';
      adjustToggle.classList.add('active');
    });
  });
})();
`;
        
        return new Response(customizerCode, {
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/javascript; charset=utf-8',
                'Cache-Control': 'public, max-age=3600'
            },
        });
    } catch (error) {
        return new Response(`// Error loading scrollbar customizer: ${error.message}`, {
            status: 500,
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/javascript'
            },
        });
    }
}

