/**
 * Event Bus
 * 
 * Decoupled event communication system for modules.
 * Allows modules to communicate without direct dependencies.
 * 
 * @example
 * ```typescript
 * // Emit an event
 * EventBus.emit('sources:updated', { sources: [...] });
 * 
 * // Listen to events
 * EventBus.on('sources:updated', (data) => {
 *   console.log('Sources updated:', data);
 * });
 * 
 * // One-time listener
 * EventBus.once('connection:established', () => {
 *   console.log('Connected!');
 * });
 * 
 * // Remove listener
 * const handler = () => {};
 * EventBus.on('event', handler);
 * EventBus.off('event', handler);
 * ```
 */

export type EventHandler<T = any> = (data: T, event: string) => void | Promise<void>;
export type EventFilter = (event: string, data: any) => boolean;

interface EventListener {
  handler: EventHandler;
  once: boolean;
  priority: number;
}

class EventBusImpl {
  private listeners = new Map<string, EventListener[]>();
  private globalFilters: EventFilter[] = [];

  /**
   * Register an event listener
   */
  on<T = any>(
    event: string,
    handler: EventHandler<T>,
    options: { priority?: number; once?: boolean } = {}
  ): () => void {
    const { priority = 0, once = false } = options;
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listeners = this.listeners.get(event)!;
    listeners.push({ handler, once, priority });
    
    // Sort by priority (higher priority first)
    listeners.sort((a, b) => b.priority - a.priority);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Register a one-time event listener
   */
  once<T = any>(event: string, handler: EventHandler<T>, priority: number = 0): () => void {
    return this.on(event, handler, { once: true, priority });
  }

  /**
   * Remove an event listener
   */
  off<T = any>(event: string, handler: EventHandler<T>): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    const index = listeners.findIndex(l => l.handler === handler);
    if (index !== -1) {
      listeners.splice(index, 1);
    }

    if (listeners.length === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit an event
   */
  async emit<T = any>(event: string, data?: T): Promise<void> {
    // Apply global filters
    for (const filter of this.globalFilters) {
      if (!filter(event, data)) {
        return;
      }
    }

    const listeners = this.listeners.get(event);
    if (!listeners || listeners.length === 0) {
      return;
    }

    // Create a copy to avoid issues if listeners modify the array
    const listenersToCall = [...listeners];

    // Call listeners in priority order
    for (const listener of listenersToCall) {
      try {
        await listener.handler(data, event);
        
        // Remove one-time listeners
        if (listener.once) {
          this.off(event, listener.handler);
        }
      } catch (error) {
        console.error(`[EventBus] Error in handler for "${event}":`, error);
      }
    }
  }

  /**
   * Emit an event synchronously (fire and forget)
   */
  emitSync<T = any>(event: string, data?: T): void {
    this.emit(event, data).catch(error => {
      console.error(`[EventBus] Error emitting "${event}":`, error);
    });
  }

  /**
   * Add a global event filter
   */
  addFilter(filter: EventFilter): () => void {
    this.globalFilters.push(filter);
    return () => {
      const index = this.globalFilters.indexOf(filter);
      if (index !== -1) {
        this.globalFilters.splice(index, 1);
      }
    };
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }

  /**
   * Get all registered event names
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
}

export const EventBus = new EventBusImpl();

