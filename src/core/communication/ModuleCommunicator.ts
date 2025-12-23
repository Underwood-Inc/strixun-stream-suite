/**
 * Module Communicator
 * 
 * High-level communication layer for modules.
 * Provides a clean API for module-to-module communication
 * without direct dependencies.
 * 
 * @example
 * ```typescript
 * // In a module
 * const communicator = new ModuleCommunicator('MyModule');
 * 
 * // Call another module's function
 * await communicator.call('SourceSwaps', 'executeSwap', sourceA, sourceB);
 * 
 * // Emit an event
 * communicator.emit('my-module:action-completed', { result: 'success' });
 * 
 * // Listen to events
 * communicator.on('sources:updated', (data) => {
 *   // Handle sources update
 * });
 * ```
 */

import { ServiceRegistry } from '../services/ServiceRegistry';
import { EventBus } from '../events/EventBus';
import { SERVICE_KEYS, type ModuleService } from '../services/interfaces';
import type { EventHandler } from '../events/EventBus';

export class ModuleCommunicator {
  private moduleName: string;
  private moduleRegistry: ModuleService;
  private eventUnsubscribers: Array<() => void> = [];

  constructor(moduleName: string) {
    this.moduleName = moduleName;
    this.moduleRegistry = ServiceRegistry.get<ModuleService>(SERVICE_KEYS.MODULE_REGISTRY);
  }

  /**
   * Call a function on another module
   */
  async call<T = any>(
    targetModule: string,
    functionName: string,
    ...args: any[]
  ): Promise<T> {
    const module = this.moduleRegistry.get(targetModule);
    
    if (!module) {
      throw new Error(`Module "${targetModule}" not found`);
    }

    const fn = module[functionName];
    
    if (typeof fn !== 'function') {
      throw new Error(
        `Function "${functionName}" not found in module "${targetModule}"`
      );
    }

    try {
      return await fn.apply(module, args);
    } catch (error) {
      console.error(
        `[ModuleCommunicator] Error calling ${targetModule}.${functionName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Call a function synchronously
   */
  callSync<T = any>(
    targetModule: string,
    functionName: string,
    ...args: any[]
  ): T {
    const module = this.moduleRegistry.get(targetModule);
    
    if (!module) {
      throw new Error(`Module "${targetModule}" not found`);
    }

    const fn = module[functionName];
    
    if (typeof fn !== 'function') {
      throw new Error(
        `Function "${functionName}" not found in module "${targetModule}"`
      );
    }

    try {
      return fn.apply(module, args);
    } catch (error) {
      console.error(
        `[ModuleCommunicator] Error calling ${targetModule}.${functionName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Check if a module exists
   */
  hasModule(name: string): boolean {
    return this.moduleRegistry.has(name);
  }

  /**
   * Get a module instance
   */
  getModule<T = any>(name: string): T | undefined {
    return this.moduleRegistry.get<T>(name);
  }

  /**
   * Emit an event
   */
  emit<T = any>(event: string, data?: T): Promise<void> {
    const namespacedEvent = `${this.moduleName}:${event}`;
    return EventBus.emit(namespacedEvent, data);
  }

  /**
   * Emit an event synchronously
   */
  emitSync<T = any>(event: string, data?: T): void {
    const namespacedEvent = `${this.moduleName}:${event}`;
    EventBus.emitSync(namespacedEvent, data);
  }

  /**
   * Listen to an event
   */
  on<T = any>(
    event: string,
    handler: EventHandler<T>,
    options?: { priority?: number; once?: boolean }
  ): () => void {
    const unsubscribe = EventBus.on(event, handler, options);
    this.eventUnsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Listen to an event once
   */
  once<T = any>(event: string, handler: EventHandler<T>): () => void {
    return this.on(event, handler, { once: true });
  }

  /**
   * Remove an event listener
   */
  off<T = any>(event: string, handler: EventHandler<T>): void {
    EventBus.off(event, handler);
  }

  /**
   * Cleanup all event listeners
   */
  cleanup(): void {
    this.eventUnsubscribers.forEach(unsubscribe => unsubscribe());
    this.eventUnsubscribers = [];
  }
}

