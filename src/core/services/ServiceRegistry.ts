/**
 * Service Registry
 * 
 * Centralized dependency injection and service management system.
 * Provides a clean, type-safe way for modules to access shared services
 * without tight coupling.
 * 
 * @example
 * ```typescript
 * // Register a service
 * ServiceRegistry.register('storage', storageService);
 * 
 * // Get a service
 * const storage = ServiceRegistry.get<StorageService>('storage');
 * 
 * // Check if service exists
 * if (ServiceRegistry.has('storage')) {
 *   // Use service
 * }
 * ```
 */

export type ServiceKey = string | symbol;
export type ServiceFactory<T = any> = () => T;
export type ServiceInstance<T = any> = T;

interface ServiceEntry<T = any> {
  instance?: ServiceInstance<T>;
  factory?: ServiceFactory<T>;
  singleton: boolean;
}

class ServiceRegistryImpl {
  private services = new Map<ServiceKey, ServiceEntry>();
  private instances = new Map<ServiceKey, any>();

  /**
   * Register a service instance
   */
  register<T>(key: ServiceKey, instance: ServiceInstance<T>, singleton: boolean = true): void {
    this.services.set(key, {
      instance,
      singleton
    });
    
    if (singleton) {
      this.instances.set(key, instance);
    }
  }

  /**
   * Register a service factory
   */
  registerFactory<T>(key: ServiceKey, factory: ServiceFactory<T>, singleton: boolean = true): void {
    this.services.set(key, {
      factory,
      singleton
    });
  }

  /**
   * Get a service instance
   */
  get<T = any>(key: ServiceKey): T {
    const entry = this.services.get(key);
    
    if (!entry) {
      throw new Error(`Service "${String(key)}" not registered`);
    }

    // If singleton and already instantiated, return cached instance
    if (entry.singleton && this.instances.has(key)) {
      return this.instances.get(key) as T;
    }

    // Get or create instance
    let instance: T;
    if (entry.instance !== undefined) {
      instance = entry.instance as T;
    } else if (entry.factory) {
      instance = entry.factory() as T;
    } else {
      throw new Error(`Service "${String(key)}" has no instance or factory`);
    }

    // Cache singleton instances
    if (entry.singleton) {
      this.instances.set(key, instance);
    }

    return instance;
  }

  /**
   * Check if a service is registered
   */
  has(key: ServiceKey): boolean {
    return this.services.has(key);
  }

  /**
   * Unregister a service
   */
  unregister(key: ServiceKey): void {
    this.services.delete(key);
    this.instances.delete(key);
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.instances.clear();
  }

  /**
   * Get all registered service keys
   */
  keys(): ServiceKey[] {
    return Array.from(this.services.keys());
  }
}

export const ServiceRegistry = new ServiceRegistryImpl();

