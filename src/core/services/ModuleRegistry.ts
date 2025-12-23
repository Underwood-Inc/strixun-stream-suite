/**
 * Module Registry Service
 * 
 * Centralized registry for all application modules.
 * Implements the ModuleService interface.
 */

import type { ModuleService } from './interfaces';
import { EventBus } from '../events/EventBus';

class ModuleRegistryImpl implements ModuleService {
  private modules = new Map<string, any>();

  register(name: string, module: any): void {
    if (this.modules.has(name)) {
      console.warn(`[ModuleRegistry] Module "${name}" already registered, overwriting`);
    }

    this.modules.set(name, module);
    
    // Emit event for adapter
    EventBus.emitSync('module:registered', { name, module });
  }

  get<T = any>(name: string): T | undefined {
    return this.modules.get(name) as T | undefined;
  }

  has(name: string): boolean {
    return this.modules.has(name);
  }

  unregister(name: string): void {
    if (this.modules.delete(name)) {
      EventBus.emitSync('module:unregistered', { name });
    }
  }

  getAll(): Record<string, any> {
    return Object.fromEntries(this.modules);
  }

  /**
   * Get all registered module names
   */
  getModuleNames(): string[] {
    return Array.from(this.modules.keys());
  }
}

export const ModuleRegistry = new ModuleRegistryImpl();

