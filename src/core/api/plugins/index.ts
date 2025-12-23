/**
 * API Framework - Plugin System
 * 
 * Extensible plugin architecture
 */

import type { Plugin, APIClient } from '../types';

export class PluginManager {
  private plugins = new Map<string, Plugin>();

  /**
   * Register plugin
   */
  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin ${plugin.name} is already registered`);
      return;
    }

    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Unregister plugin
   */
  unregister(name: string): void {
    const plugin = this.plugins.get(name);
    if (plugin?.teardown) {
      plugin.teardown();
    }
    this.plugins.delete(name);
  }

  /**
   * Setup all plugins
   */
  setup(client: APIClient): void {
    for (const plugin of this.plugins.values()) {
      if (plugin.setup) {
        plugin.setup(client);
      }
    }
  }

  /**
   * Teardown all plugins
   */
  teardown(): void {
    for (const plugin of this.plugins.values()) {
      if (plugin.teardown) {
        plugin.teardown();
      }
    }
  }

  /**
   * Get plugin
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all plugins
   */
  getAll(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}

export { createLoggingPlugin } from './logging';
export { createMetricsPlugin } from './metrics';
export { createAnalyticsPlugin } from './analytics';

export type { LoggingConfig } from './logging';
export type { MetricsConfig, Metric } from './metrics';
export type { AnalyticsConfig } from './analytics';
