/**
 * Module Adapter
 * 
 * Adapter layer that bridges the new service-based architecture
 * with legacy window-based module communication.
 * 
 * This allows gradual migration while maintaining backward compatibility.
 */

import { ServiceRegistry } from '../services/ServiceRegistry';
import { EventBus } from '../events/EventBus';
import { SERVICE_KEYS, type ModuleService } from '../services/interfaces';

/**
 * Legacy window adapter
 * Provides window.* access for legacy code while routing through services
 */
export class ModuleAdapter {
  private moduleRegistry: ModuleService;
  private windowExports: Map<string, any> = new Map();

  constructor() {
    this.moduleRegistry = ServiceRegistry.get<ModuleService>(SERVICE_KEYS.MODULE_REGISTRY);
    this.setupWindowExports();
  }

  /**
   * Register a module for legacy access
   */
  registerModule(name: string, module: any): void {
    this.moduleRegistry.register(name, module);
    this.updateWindowExport(name, module);
  }

  /**
   * Get a module (legacy access)
   */
  getModule<T = any>(name: string): T | undefined {
    return this.moduleRegistry.get<T>(name);
  }

  /**
   * Update window export for a module
   */
  private updateWindowExport(name: string, module: any): void {
    if (typeof window !== 'undefined') {
      (window as any)[name] = module;
      this.windowExports.set(name, module);
    }
  }

  /**
   * Setup initial window exports
   */
  private setupWindowExports(): void {
    if (typeof window === 'undefined') return;

    // Create proxy for dynamic module access
    const moduleProxy = new Proxy({}, {
      get: (_target, prop: string) => {
        return this.moduleRegistry.get(prop);
      },
      has: (_target, prop: string) => {
        return this.moduleRegistry.has(prop);
      }
    });

    // Expose modules namespace
    (window as any).Modules = moduleProxy;

    // Listen for module registrations
    EventBus.on('module:registered', (data: { name: string; module: any }) => {
      this.updateWindowExport(data.name, data.module);
    });
  }

  /**
   * Create a legacy-compatible function wrapper
   */
  createLegacyFunction<T extends (...args: any[]) => any>(
    fn: T,
    moduleName: string
  ): T {
    return ((...args: any[]) => {
      try {
        return fn(...args);
      } catch (error) {
        console.error(`[ModuleAdapter] Error in ${moduleName}:`, error);
        throw error;
      }
    }) as T;
  }

  /**
   * Expose function to window (legacy compatibility)
   */
  exposeFunction(name: string, fn: (...args: any[]) => any): void {
    if (typeof window !== 'undefined') {
      (window as any)[name] = fn;
    }
  }

  /**
   * Get all exposed modules
   */
  getExposedModules(): Record<string, any> {
    return Object.fromEntries(this.windowExports);
  }
}

// Singleton instance
let adapterInstance: ModuleAdapter | null = null;

export function getModuleAdapter(): ModuleAdapter {
  if (!adapterInstance) {
    adapterInstance = new ModuleAdapter();
  }
  return adapterInstance;
}

