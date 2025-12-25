/**
 * Advanced Tooltip System
 * 
 * High fantasy tooltips with smart z-index management and nested tooltip support
 */

// ================================
// Tooltip Types
// ================================

export interface TooltipConfig {
  id: string;
  content: TooltipContent;
  position: TooltipPosition;
  style: TooltipStyle;
  behavior: TooltipBehavior;
  zIndex?: number; // Auto-calculated if not provided
  parentTooltipId?: string; // For nested tooltips
}

export interface TooltipContent {
  type: 'text' | 'html' | 'component' | 'custom';
  data: string | HTMLElement | TooltipComponent;
  title?: string;
  description?: string;
  footer?: string;
}

export interface TooltipComponent {
  component: string; // Component name
  props?: Record<string, unknown>;
}

export interface TooltipPosition {
  placement: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  offset: { x: number; y: number };
  anchor?: HTMLElement; // Element to position relative to
  viewportPadding: number; // Padding from viewport edges
}

export interface TooltipStyle {
  theme: 'default' | 'fantasy' | 'dark' | 'light' | 'custom';
  size: 'small' | 'medium' | 'large' | 'auto';
  customCss?: string; // User-defined CSS
  customClasses?: string[]; // User-defined classes
  animations?: {
    enter: string;
    exit: string;
    duration: number;
  };
}

export interface TooltipBehavior {
  trigger: 'hover' | 'click' | 'focus' | 'manual';
  delay: number; // ms before showing
  hideDelay: number; // ms before hiding
  persistent: boolean; // Don't hide on mouse leave
  closeOnClick: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

// ================================
// Item Tooltip (Specialized)
// ================================

export interface ItemTooltipData {
  item: {
    name: string;
    rarity: string;
    itemLevel: number;
    quality?: number;
    fullName?: string; // With prefixes/suffixes
  };
  stats: Record<string, number>;
  modifiers?: {
    prefixes: Array<{ name: string; stats: Record<string, number> }>;
    suffixes: Array<{ name: string; stats: Record<string, number> }>;
  };
  description?: string;
  flavorText?: string; // High fantasy flavor text
  requirements?: {
    level?: number;
    stats?: Record<string, number>;
  };
  sellPrice?: number;
  customContent?: string; // User-defined HTML
}

// ================================
// Tooltip Manager
// ================================

export class TooltipManager {
  private tooltips: Map<string, TooltipConfig>;
  private zIndexStack: number[];
  private baseZIndex: number;
  private portalContainer: HTMLElement | null;
  private nestedTooltipMap: Map<string, string[]>; // parent -> children

  constructor(baseZIndex: number = 10000) {
    this.tooltips = new Map();
    this.zIndexStack = [];
    this.baseZIndex = baseZIndex;
    this.portalContainer = null;
    this.nestedTooltipMap = new Map();
    this.initializePortal();
  }

  /**
   * Initialize portal container for tooltips
   */
  private initializePortal(): void {
    if (typeof document === 'undefined') return;

    // Create portal container if it doesn't exist
    let container = document.getElementById('tooltip-portal-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tooltip-portal-container';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: ${this.baseZIndex};
      `;
      document.body.appendChild(container);
    }

    this.portalContainer = container;
  }

  /**
   * Calculate smart z-index for a tooltip
   */
  private calculateZIndex(parentTooltipId?: string): number {
    if (!parentTooltipId) {
      // Root tooltip - get highest z-index + 1
      const maxZIndex = this.zIndexStack.length > 0
        ? Math.max(...this.zIndexStack)
        : this.baseZIndex;
      return maxZIndex + 1;
    }

    // Nested tooltip - get parent z-index + 1
    const parentTooltip = this.tooltips.get(parentTooltipId);
    if (!parentTooltip) {
      return this.calculateZIndex(); // Fallback to root
    }

    const parentZIndex = parentTooltip.zIndex || this.baseZIndex;
    return parentZIndex + 1;
  }

  /**
   * Show a tooltip
   */
  show(config: TooltipConfig): string {
    // Calculate z-index
    config.zIndex = config.zIndex || this.calculateZIndex(config.parentTooltipId);

    // Track nested tooltips
    if (config.parentTooltipId) {
      const children = this.nestedTooltipMap.get(config.parentTooltipId) || [];
      children.push(config.id);
      this.nestedTooltipMap.set(config.parentTooltipId, children);
    }

    // Add to stack
    this.zIndexStack.push(config.zIndex);
    this.tooltips.set(config.id, config);

    // Render tooltip (this would be handled by the component)
    this.renderTooltip(config);

    return config.id;
  }

  /**
   * Hide a tooltip and all nested tooltips
   */
  hide(tooltipId: string): void {
    const tooltip = this.tooltips.get(tooltipId);
    if (!tooltip) return;

    // Hide all nested tooltips first
    const children = this.nestedTooltipMap.get(tooltipId) || [];
    children.forEach(childId => this.hide(childId));
    this.nestedTooltipMap.delete(tooltipId);

    // Remove from stack
    const index = this.zIndexStack.indexOf(tooltip.zIndex!);
    if (index > -1) {
      this.zIndexStack.splice(index, 1);
    }

    // Remove tooltip
    this.tooltips.delete(tooltipId);
    this.removeTooltipElement(tooltipId);
  }

  /**
   * Update tooltip position (for dynamic content)
   */
  updatePosition(tooltipId: string, position: Partial<TooltipPosition>): void {
    const tooltip = this.tooltips.get(tooltipId);
    if (!tooltip) return;

    tooltip.position = { ...tooltip.position, ...position };
    this.renderTooltip(tooltip);
  }

  /**
   * Render tooltip element (called by component)
   */
  private renderTooltip(config: TooltipConfig): void {
    // This would be handled by the Svelte component
    // The manager just tracks state
  }

  /**
   * Remove tooltip element from DOM
   */
  private removeTooltipElement(tooltipId: string): void {
    const element = document.getElementById(`tooltip-${tooltipId}`);
    if (element) {
      element.remove();
    }
  }

  /**
   * Get portal container
   */
  getPortalContainer(): HTMLElement | null {
    return this.portalContainer;
  }

  /**
   * Cleanup all tooltips
   */
  cleanup(): void {
    this.tooltips.forEach((_, id) => this.hide(id));
    this.tooltips.clear();
    this.zIndexStack = [];
    this.nestedTooltipMap.clear();
  }
}

// ================================
// Default Tooltip Manager Instance
// ================================

export const tooltipManager = new TooltipManager(10000);

// ================================
// Tooltip Presets
// ================================

export const TOOLTIP_PRESETS = {
  fantasy: {
    style: {
      theme: 'fantasy' as const,
      size: 'medium' as const,
      animations: {
        enter: 'fadeInScale',
        exit: 'fadeOutScale',
        duration: 200
      }
    },
    behavior: {
      trigger: 'hover' as const,
      delay: 300,
      hideDelay: 100,
      persistent: false,
      closeOnClick: false
    }
  },
  item: {
    style: {
      theme: 'fantasy' as const,
      size: 'large' as const,
      animations: {
        enter: 'slideInFade',
        exit: 'slideOutFade',
        duration: 250
      }
    },
    behavior: {
      trigger: 'hover' as const,
      delay: 200,
      hideDelay: 150,
      persistent: false,
      closeOnClick: false,
      maxWidth: 400
    }
  },
  quick: {
    style: {
      theme: 'default' as const,
      size: 'small' as const,
      animations: {
        enter: 'fadeIn',
        exit: 'fadeOut',
        duration: 150
      }
    },
    behavior: {
      trigger: 'hover' as const,
      delay: 100,
      hideDelay: 50,
      persistent: false,
      closeOnClick: false
    }
  }
};

