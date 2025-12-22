/**
 * ResizableZone - Core Logic
 * 
 * Agnostic, composable, reusable resizable zone system
 * Supports infinite nesting and both vertical and horizontal resizing
 * 
 * @version 1.0.0
 */

export type ResizeDirection = 'vertical' | 'horizontal';
export type ResizeHandlePosition = 'start' | 'end';

export interface ResizableZoneConfig {
  direction: ResizeDirection;
  minSize?: number;
  maxSize?: number;
  defaultSize?: number;
  handlePosition?: ResizeHandlePosition;
  storageKey?: string;
  onResize?: (size: number) => void;
  disabled?: boolean;
}

export interface ResizeState {
  isResizing: boolean;
  startPosition: number;
  startSize: number;
  currentSize: number;
}

/**
 * ResizableZone Controller
 * Handles all resize logic without UI concerns
 */
export class ResizableZoneController {
  private config: Required<Omit<ResizableZoneConfig, 'onResize' | 'storageKey'>> & Pick<ResizableZoneConfig, 'onResize' | 'storageKey'>;
  private state: ResizeState;
  private rafId: number | null = null;
  private pendingSize: number | null = null;
  private element: HTMLElement | null = null;
  private storage: Storage | null = null;

  constructor(config: ResizableZoneConfig) {
    this.config = {
      direction: config.direction,
      minSize: config.minSize ?? 50,
      maxSize: config.maxSize ?? Infinity,
      defaultSize: config.defaultSize ?? 200,
      handlePosition: config.handlePosition ?? 'end',
      disabled: config.disabled ?? false,
      onResize: config.onResize,
      storageKey: config.storageKey
    };

    this.state = {
      isResizing: false,
      startPosition: 0,
      startSize: 0,
      currentSize: this.config.defaultSize
    };

    // Try to get storage if key is provided
    if (this.config.storageKey && typeof window !== 'undefined') {
      try {
        this.storage = window.localStorage;
        const saved = this.storage.getItem(this.config.storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.size === 'number') {
            this.state.currentSize = Math.max(
              this.config.minSize,
              Math.min(this.config.maxSize, parsed.size)
            );
          }
        }
      } catch (e) {
        // Storage not available or invalid, use default
      }
    }
  }

  /**
   * Attach to DOM element
   */
  attach(element: HTMLElement): void {
    this.element = element;
    this.applySize(this.state.currentSize);
  }

  /**
   * Detach from DOM element
   */
  detach(): void {
    this.element = null;
  }

  /**
   * Get current size
   */
  getSize(): number {
    return this.state.currentSize;
  }

  /**
   * Set size programmatically
   */
  setSize(size: number, save: boolean = true): void {
    const clamped = Math.max(
      this.config.minSize,
      Math.min(this.config.maxSize, size)
    );
    
    this.state.currentSize = clamped;
    this.applySize(clamped);
    
    if (save && this.config.storageKey && this.storage) {
      try {
        this.storage.setItem(
          this.config.storageKey,
          JSON.stringify({ size: clamped })
        );
      } catch (e) {
        // Storage write failed, ignore
      }
    }
    
    if (this.config.onResize) {
      this.config.onResize(clamped);
    }
  }

  private moveHandler: ((e: MouseEvent | TouchEvent) => void) | null = null;
  private endHandler: (() => void) | null = null;

  /**
   * Start resize operation
   */
  startResize(event: MouseEvent | TouchEvent): void {
    if (this.config.disabled || !this.element) return;

    const clientPos = 'touches' in event 
      ? (this.config.direction === 'vertical' ? event.touches[0].clientY : event.touches[0].clientX)
      : (this.config.direction === 'vertical' ? event.clientY : event.clientX);

    this.state.isResizing = true;
    this.state.startPosition = clientPos;
    this.state.startSize = this.config.direction === 'vertical'
      ? this.element.offsetHeight
      : this.element.offsetWidth;

    // Prevent text selection
    document.body.style.userSelect = 'none';
    document.body.style.cursor = this.config.direction === 'vertical' ? 'ns-resize' : 'ew-resize';

    // Add global event listeners
    this.moveHandler = (e: MouseEvent | TouchEvent) => this.handleResize(e);
    this.endHandler = () => this.endResize();

    document.addEventListener('mousemove', this.moveHandler as EventListener);
    document.addEventListener('mouseup', this.endHandler);
    document.addEventListener('touchmove', this.moveHandler as EventListener, { passive: false });
    document.addEventListener('touchend', this.endHandler);
  }

  /**
   * Handle resize during drag
   */
  private handleResize(event: MouseEvent | TouchEvent): void {
    if (!this.state.isResizing || !this.element) return;

    event.preventDefault();

    const clientPos = 'touches' in event
      ? (this.config.direction === 'vertical' ? event.touches[0].clientY : event.touches[0].clientX)
      : (this.config.direction === 'vertical' ? event.clientY : event.clientX);

    const delta = this.config.handlePosition === 'start'
      ? this.state.startPosition - clientPos
      : clientPos - this.state.startPosition;

    const newSize = Math.max(
      this.config.minSize,
      Math.min(this.config.maxSize, this.state.startSize + delta)
    );

    this.pendingSize = newSize;

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        if (this.element && this.pendingSize !== null) {
          this.applySize(this.pendingSize);
          this.state.currentSize = this.pendingSize;
          this.pendingSize = null;
          this.rafId = null;
        }
      });
    }
  }

  /**
   * End resize operation
   */
  private endResize(): void {
    if (!this.state.isResizing) return;

    this.state.isResizing = false;

    // Remove event listeners
    if (this.moveHandler) {
      document.removeEventListener('mousemove', this.moveHandler as EventListener);
      document.removeEventListener('touchmove', this.moveHandler as EventListener);
      this.moveHandler = null;
    }
    
    if (this.endHandler) {
      document.removeEventListener('mouseup', this.endHandler);
      document.removeEventListener('touchend', this.endHandler);
      this.endHandler = null;
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.element && this.pendingSize !== null) {
      this.applySize(this.pendingSize);
      this.state.currentSize = this.pendingSize;
      this.pendingSize = null;
    }

    // Clean up
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    // Save to storage
    if (this.config.storageKey && this.storage) {
      try {
        this.storage.setItem(
          this.config.storageKey,
          JSON.stringify({ size: this.state.currentSize })
        );
      } catch (e) {
        // Storage write failed, ignore
      }
    }

    // Call resize callback
    if (this.config.onResize) {
      this.config.onResize(this.state.currentSize);
    }
  }

  /**
   * Apply size to element
   */
  private applySize(size: number): void {
    if (!this.element) return;

    if (this.config.direction === 'vertical') {
      this.element.style.height = `${size}px`;
    } else {
      this.element.style.width = `${size}px`;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ResizableZoneConfig>): void {
    if (updates.minSize !== undefined) this.config.minSize = updates.minSize;
    if (updates.maxSize !== undefined) this.config.maxSize = updates.maxSize;
    if (updates.disabled !== undefined) this.config.disabled = updates.disabled;
    if (updates.onResize !== undefined) this.config.onResize = updates.onResize;
    
    // Re-clamp current size if bounds changed
    if (updates.minSize !== undefined || updates.maxSize !== undefined) {
      this.setSize(this.state.currentSize, false);
    }
  }

  /**
   * Check if currently resizing
   */
  isResizing(): boolean {
    return this.state.isResizing;
  }

  /**
   * Destroy and clean up
   */
  destroy(): void {
    // Clean up any active resize
    if (this.state.isResizing) {
      this.endResize();
    }
    
    this.detach();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }
}

