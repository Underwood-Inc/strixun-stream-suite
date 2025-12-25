/**
 * Enhanced API Framework - Type Definition Registry
 * 
 * Centralized registry for type definitions across the application
 */

import type { TypeDefinition, ResponseFilterConfig } from '../types';

/**
 * Type Definition Registry
 * 
 * Singleton registry for managing type definitions
 */
export class TypeRegistry {
  private static instance: TypeRegistry;
  private definitions: Map<string, TypeDefinition> = new Map();
  private filterConfig: ResponseFilterConfig | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TypeRegistry {
    if (!TypeRegistry.instance) {
      TypeRegistry.instance = new TypeRegistry();
    }
    return TypeRegistry.instance;
  }

  /**
   * Register a type definition
   */
  register(name: string, definition: TypeDefinition): this {
    this.definitions.set(name, definition);
    return this;
  }

  /**
   * Register multiple type definitions
   */
  registerMany(definitions: Record<string, TypeDefinition>): this {
    for (const [name, def] of Object.entries(definitions)) {
      this.register(name, def);
    }
    return this;
  }

  /**
   * Get type definition
   */
  get(name: string): TypeDefinition | undefined {
    return this.definitions.get(name);
  }

  /**
   * Check if type is registered
   */
  has(name: string): boolean {
    return this.definitions.has(name);
  }

  /**
   * Get all registered types
   */
  getAll(): Map<string, TypeDefinition> {
    return new Map(this.definitions);
  }

  /**
   * Clear all type definitions
   */
  clear(): this {
    this.definitions.clear();
    return this;
  }

  /**
   * Set filter config
   */
  setFilterConfig(config: ResponseFilterConfig): this {
    this.filterConfig = config;
    return this;
  }

  /**
   * Get filter config
   */
  getFilterConfig(): ResponseFilterConfig | null {
    return this.filterConfig;
  }

  /**
   * Build filter config from registered types
   */
  buildFilterConfig(
    rootConfig: ResponseFilterConfig['rootConfig']
  ): ResponseFilterConfig {
    return {
      rootConfigType: {} as any, // Type reference
      rootConfig,
      typeDefinitions: this.definitions,
      tags: this.filterConfig?.tags || {},
    };
  }
}

/**
 * Get global type registry instance
 */
export function getTypeRegistry(): TypeRegistry {
  return TypeRegistry.getInstance();
}

/**
 * Register a type definition (convenience function)
 */
export function registerType(
  name: string,
  definition: TypeDefinition
): TypeRegistry {
  return getTypeRegistry().register(name, definition);
}

/**
 * Get type definition (convenience function)
 */
export function getType(name: string): TypeDefinition | undefined {
  return getTypeRegistry().get(name);
}

