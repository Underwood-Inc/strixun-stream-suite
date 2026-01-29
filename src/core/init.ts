/**
 * Core Initialization
 * 
 * Initializes the core communication layer and service architecture.
 * This should be called early in the application lifecycle.
 */

import { initializeServices } from './services/implementations';
import { ServiceRegistry } from './services/ServiceRegistry';
import { SERVICE_KEYS } from './services/interfaces';
import { getModuleAdapter } from './communication/ModuleAdapter';
import { EventBus } from './events/EventBus';
import { initCloudStorage } from '../modules/cloud-storage';

/**
 * Initialize the core communication layer
 */
export async function initializeCore(): Promise<void> {
  // Initialize services
  initializeServices();

  // Initialize module adapter for legacy compatibility
  getModuleAdapter();

  // Setup event logging (optional, for debugging)
  // Only enable if explicitly requested via environment variable
  // This prevents excessive logging that can bog down the system
  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_EVENTS === 'true') {
    // Log all events in development (only when explicitly enabled)
    const originalEmit = EventBus.emit.bind(EventBus);
    EventBus.emit = async function(event: string, data?: any) {
      console.debug(`[EventBus] ${event}`, data);
      return originalEmit(event, data);
    };
  }

  // Initialize cloud storage (subscribes to auth state for automatic sync on login)
  initCloudStorage();

  // Emit initialization complete event
  EventBus.emitSync('core:initialized', {
    timestamp: new Date(),
    services: ServiceRegistry.keys().map(k => String(k))
  });

  // Log initialization - use store if available
  if (typeof window !== 'undefined' && (window as any).addLogEntry) {
    (window as any).addLogEntry('Communication layer initialized', 'success', 'CORE');
  }
}

/**
 * Get a service (convenience function)
 */
export function getService<T = any>(key: symbol): T {
  return ServiceRegistry.get<T>(key);
}

/**
 * Check if core is initialized
 */
export function isCoreInitialized(): boolean {
  return ServiceRegistry.has(SERVICE_KEYS.STORAGE) &&
         ServiceRegistry.has(SERVICE_KEYS.MODULE_REGISTRY);
}

