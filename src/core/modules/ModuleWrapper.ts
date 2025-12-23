/**
 * Module Wrapper
 * 
 * Utility for wrapping existing modules to work with the new architecture.
 * Provides a clean way to migrate modules gradually.
 * 
 * @example
 * ```typescript
 * // Wrap an existing module
 * const wrapped = ModuleWrapper.wrap('SourceSwaps', sourceSwapsModule, {
 *   dependencies: {
 *     storage: ServiceRegistry.get(SERVICE_KEYS.STORAGE),
 *     logger: ServiceRegistry.get(SERVICE_KEYS.LOGGER)
 *   }
 * });
 * 
 * // Register it
 * ModuleRegistry.register('SourceSwaps', wrapped);
 * ```
 */

import { ServiceRegistry } from '../services/ServiceRegistry';
import { ModuleRegistry } from '../services/ModuleRegistry';
import { ModuleCommunicator } from '../communication/ModuleCommunicator';
import { EventBus } from '../events/EventBus';
import type { ModuleService } from '../services/interfaces';

export interface ModuleWrapperOptions {
  dependencies?: Record<string, any>;
  events?: {
    emit?: string[];
    listen?: string[];
  };
  expose?: string[];
}

export class ModuleWrapper {
  /**
   * Wrap a module for use with the new architecture
   */
  static wrap(
    moduleName: string,
    module: any,
    options: ModuleWrapperOptions = {}
  ): any {
    const communicator = new ModuleCommunicator(moduleName);
    
    // Create wrapper that provides services
    const wrapper = {
      ...module,
      
      // Add communicator
      _communicator: communicator,
      
      // Add dependency access
      _services: options.dependencies || {},
      
      // Helper to get a service
      _getService<T = any>(key: string): T {
        return this._services[key];
      },
      
      // Helper to call another module
      async _callModule<T = any>(
        targetModule: string,
        functionName: string,
        ...args: any[]
      ): Promise<T> {
        return communicator.call<T>(targetModule, functionName, ...args);
      },
      
      // Helper to emit events
      _emit(event: string, data?: any): void {
        communicator.emitSync(event, data);
      },
      
      // Cleanup function
      _cleanup(): void {
        communicator.cleanup();
      }
    };

    // Setup event listeners if specified
    if (options.events?.listen) {
      options.events.listen.forEach(event => {
        EventBus.on(event, (data) => {
          if (typeof module.onEvent === 'function') {
            module.onEvent(event, data);
          }
        });
      });
    }

    return wrapper;
  }

  /**
   * Register a module with automatic wrapping
   */
  static register(
    moduleName: string,
    module: any,
    options: ModuleWrapperOptions = {}
  ): void {
    const wrapped = this.wrap(moduleName, module, options);
    ModuleRegistry.register(moduleName, wrapped);
    
    // Also expose to window for legacy compatibility
    if (typeof window !== 'undefined') {
      (window as any)[moduleName] = wrapped;
    }
  }

  /**
   * Create a module adapter that bridges old and new APIs
   */
  static createAdapter(
    moduleName: string,
    legacyModule: any,
    newModule: any
  ): any {
    return new Proxy({}, {
      get(target, prop: string) {
        // Try new module first
        if (prop in newModule) {
          return newModule[prop];
        }
        
        // Fall back to legacy
        if (prop in legacyModule) {
          console.warn(
            `[ModuleWrapper] Using legacy API for ${moduleName}.${prop}. ` +
            `Consider migrating to new API.`
          );
          return legacyModule[prop];
        }
        
        return undefined;
      },
      
      has(target, prop: string) {
        return prop in newModule || prop in legacyModule;
      }
    });
  }
}

