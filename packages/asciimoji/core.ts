/**
 * ASCIImoji Core - Framework-Agnostic DOM Text Transformer
 * 
 * Transforms DOM text nodes that contain ASCIImoji patterns (like "(bear)" or "(shrug)")
 * into their corresponding ASCII art emoticons.
 * 
 * Can be used as:
 * - CDN provisioned script
 * - Injected module in same codebase
 * - Framework-agnostic utility
 * 
 * @example
 * ```typescript
 * import { AsciimojiTransformer } from '@strixun/asciimoji';
 * 
 * const transformer = new AsciimojiTransformer({
 *   selector: 'body',
 *   observe: true,
 *   transformOnInit: true
 * });
 * ```
 * 
 * @example
 * ```html
 * <!-- CDN Usage -->
 * <script src="https://cdn.example.com/asciimoji.min.js"></script>
 * <script>
 *   AsciimojiTransformer.init({ selector: 'body' });
 * </script>
 * ```
 */

import { ASCIIMOJI_PATTERNS, getAsciimoji } from './patterns.js';

/**
 * Configuration options for ASCIImoji transformer
 */
export interface AsciimojiConfig {
  /**
   * CSS selector for elements to transform (default: 'body')
   * Use '*' to transform all elements
   */
  selector?: string;
  
  /**
   * Whether to observe DOM changes and transform new content (default: true)
   * Uses MutationObserver to watch for new nodes
   */
  observe?: boolean;
  
  /**
   * Whether to transform existing content on initialization (default: true)
   */
  transformOnInit?: boolean;
  
  /**
   * Custom pattern matching regex (default: /\(([a-zA-Z0-9_-]+)\)/g)
   * Must have a capturing group for the pattern name
   */
  patternRegex?: RegExp;
  
  /**
   * Elements to exclude from transformation (default: ['script', 'style', 'noscript'])
   */
  excludeSelectors?: string[];
  
  /**
   * Whether to transform text in attributes (default: false)
   * If true, will also transform title, alt, placeholder, etc.
   */
  transformAttributes?: boolean;
  
  /**
   * Custom callback after transformation
   */
  onTransform?: (element: Node, originalText: string, transformedText: string) => void;
}

/**
 * ASCIImoji DOM Transformer
 * 
 * Transforms text nodes containing ASCIImoji patterns into ASCII art
 */
export class AsciimojiTransformer {
  private config: Required<AsciimojiConfig>;
  private observer: MutationObserver | null = null;
  private isTransforming = false;

  constructor(config: AsciimojiConfig = {}) {
    this.config = {
      selector: config.selector ?? 'body',
      observe: config.observe ?? true,
      transformOnInit: config.transformOnInit ?? true,
      patternRegex: config.patternRegex ?? /\(([a-zA-Z0-9_-]+)\)/g,
      excludeSelectors: config.excludeSelectors ?? ['script', 'style', 'noscript'],
      transformAttributes: config.transformAttributes ?? false,
      onTransform: config.onTransform ?? (() => {}),
    };

    if (this.config.transformOnInit) {
      this.transform();
    }

    if (this.config.observe) {
      this.startObserving();
    }
  }

  /**
   * Transform text content in a text node
   * @param textNode - Text node to transform
   * @returns true if transformation occurred
   */
  private transformTextNode(textNode: Text): boolean {
    if (!textNode.textContent) return false;

    const originalText = textNode.textContent;
    let transformedText = originalText;
    let hasChanges = false;

    // Match patterns like (bear), (shrug), etc.
    transformedText = transformedText.replace(
      this.config.patternRegex,
      (match, patternName) => {
        const asciimoji = getAsciimoji(patternName);
        if (asciimoji) {
          hasChanges = true;
          return asciimoji;
        }
        return match; // Keep original if pattern not found
      }
    );

    if (hasChanges) {
      textNode.textContent = transformedText;
      this.config.onTransform(textNode, originalText, transformedText);
      return true;
    }

    return false;
  }

  /**
   * Transform attribute values
   * @param element - Element with attributes to transform
   */
  private transformAttributes(element: Element): void {
    if (!this.config.transformAttributes) return;

    const attributesToTransform = ['title', 'alt', 'placeholder', 'aria-label'];
    
    for (const attrName of attributesToTransform) {
      const attr = element.getAttribute(attrName);
      if (!attr) continue;

      let transformedAttr = attr;
      let hasChanges = false;

      transformedAttr = transformedAttr.replace(
        this.config.patternRegex,
        (match, patternName) => {
          const asciimoji = getAsciimoji(patternName);
          if (asciimoji) {
            hasChanges = true;
            return asciimoji;
          }
          return match;
        }
      );

      if (hasChanges) {
        element.setAttribute(attrName, transformedAttr);
      }
    }
  }

  /**
   * Check if element should be excluded from transformation
   * @param element - Element to check
   * @returns true if element should be excluded
   */
  private shouldExcludeElement(element: Element): boolean {
    return this.config.excludeSelectors.some(selector => {
      if (selector === element.tagName.toLowerCase()) return true;
      return element.closest(selector) !== null;
    });
  }

  /**
   * Transform a single element and its descendants
   * @param element - Element to transform
   */
  private transformElement(element: Element | Document): void {
    if (this.isTransforming) return;
    this.isTransforming = true;

    try {
      // Transform attributes if enabled
      if (element instanceof Element) {
        this.transformAttributes(element);
      }

      // Walk through all text nodes
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Skip if parent is excluded
            const parent = node.parentElement;
            if (parent && this.shouldExcludeElement(parent)) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );

      const textNodes: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node instanceof Text) {
          textNodes.push(node);
        }
      }

      // Transform all text nodes
      for (const textNode of textNodes) {
        this.transformTextNode(textNode);
      }
    } finally {
      this.isTransforming = false;
    }
  }

  /**
   * Transform all matching elements in the document
   */
  public transform(): void {
    if (typeof document === 'undefined') {
      console.warn('AsciimojiTransformer: document is not available');
      return;
    }

    const elements = document.querySelectorAll(this.config.selector);
    
    if (elements.length === 0 && this.config.selector === 'body') {
      // Fallback to document if body selector finds nothing
      this.transformElement(document);
      return;
    }

    for (const element of elements) {
      this.transformElement(element);
    }
  }

  /**
   * Start observing DOM changes
   */
  private startObserving(): void {
    if (typeof window === 'undefined' || !window.MutationObserver) {
      console.warn('AsciimojiTransformer: MutationObserver is not available');
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Handle added nodes
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            // Skip if excluded
            if (this.shouldExcludeElement(node)) continue;
            
            // Transform the new element
            this.transformElement(node);
          } else if (node instanceof Text) {
            // Transform new text nodes
            const parent = node.parentElement;
            if (parent && !this.shouldExcludeElement(parent)) {
              this.transformTextNode(node);
            }
          }
        }

        // Handle attribute changes if enabled
        if (
          this.config.transformAttributes &&
          mutation.type === 'attributes' &&
          mutation.target instanceof Element
        ) {
          this.transformAttributes(mutation.target);
        }
      }
    });

    const target = this.config.selector === 'body' || this.config.selector === '*'
      ? document.body || document.documentElement
      : document.querySelector(this.config.selector);

    if (target) {
      this.observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: this.config.transformAttributes,
        attributeFilter: this.config.transformAttributes
          ? ['title', 'alt', 'placeholder', 'aria-label']
          : undefined,
      });
    }
  }

  /**
   * Stop observing DOM changes
   */
  public stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Destroy the transformer and clean up
   */
  public destroy(): void {
    this.stopObserving();
  }

  /**
   * Static initialization method for CDN usage
   * @param config - Configuration options
   * @returns Transformer instance
   */
  static init(config: AsciimojiConfig = {}): AsciimojiTransformer {
    return new AsciimojiTransformer(config);
  }
}

/**
 * Default export for convenience
 */
export default AsciimojiTransformer;

/**
 * Quick transform function for one-off transformations
 * @param text - Text to transform
 * @returns Transformed text
 */
export function transformText(text: string): string {
  const regex = /\(([a-zA-Z0-9_-]+)\)/g;
  return text.replace(regex, (match, patternName) => {
    const asciimoji = getAsciimoji(patternName);
    return asciimoji || match;
  });
}

/**
 * Auto-initialize if in browser environment and window.AsciimojiTransformer is not set
 * This allows CDN scripts to work automatically
 */
if (typeof window !== 'undefined') {
  // Expose to global scope for CDN usage
  (window as any).AsciimojiTransformer = AsciimojiTransformer;
  (window as any).transformAsciimojiText = transformText;
  
  // Auto-initialize if data-asciimoji attribute is present
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const autoInit = document.querySelector('[data-asciimoji-auto]');
      if (autoInit) {
        const config: AsciimojiConfig = {
          selector: autoInit.getAttribute('data-asciimoji-selector') || 'body',
          observe: autoInit.getAttribute('data-asciimoji-observe') !== 'false',
          transformOnInit: autoInit.getAttribute('data-asciimoji-transform-on-init') !== 'false',
        };
        AsciimojiTransformer.init(config);
      }
    });
  } else {
    const autoInit = document.querySelector('[data-asciimoji-auto]');
    if (autoInit) {
      const config: AsciimojiConfig = {
        selector: autoInit.getAttribute('data-asciimoji-selector') || 'body',
        observe: autoInit.getAttribute('data-asciimoji-observe') !== 'false',
        transformOnInit: autoInit.getAttribute('data-asciimoji-transform-on-init') !== 'false',
      };
      AsciimojiTransformer.init(config);
    }
  }
}
