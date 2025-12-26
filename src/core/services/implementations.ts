/**
 * Service Implementations
 * 
 * Concrete implementations of service interfaces.
 * These wrap existing modules and provide clean service interfaces.
 */

import { ServiceRegistry } from './ServiceRegistry';
import { SERVICE_KEYS, type StorageService, type LoggerService, type NavigationService } from './interfaces';
import { ModuleRegistry } from './ModuleRegistry';
import { encryptedStorage } from './encrypted-storage';
import { storage } from '../../modules/storage';
import { connected, currentScene, sources, textSources, connectionState, isReady } from '../../stores/connection';
import type { ConnectionStateService } from './interfaces';
import { navigateTo } from '../../stores/navigation';

// ============ Storage Service Implementation ============

/**
 * Storage Service Implementation
 * 
 * CRITICAL: Uses encryptedStorage to ensure all data is encrypted when encryption is enabled.
 * This is the main entry point for storage access through the Service Registry.
 */
class StorageServiceImpl implements StorageService {
  /**
   * Get a value from storage (automatically decrypts if encrypted)
   */
  async get<T = any>(key: string): Promise<T | null> {
    const value = await encryptedStorage.get(key);
    return value as T | null;
  }

  /**
   * Set a value in storage (automatically encrypts if encryption enabled)
   */
  async set<T = any>(key: string, value: T): Promise<boolean> {
    return await encryptedStorage.set(key, value);
  }

  /**
   * Remove a value from storage
   */
  remove(key: string): void {
    encryptedStorage.remove(key);
  }

  /**
   * Clear all storage
   */
  clear(): void {
    storage.clear();
  }

  /**
   * Get a raw string value (NOT encrypted - for system keys only)
   */
  getRaw(key: string): any {
    return encryptedStorage.getRaw(key);
  }

  /**
   * Set a raw string value (NOT encrypted - for system keys only)
   */
  setRaw(key: string, value: any): void {
    encryptedStorage.setRaw(key, value);
  }

  /**
   * Check if a key exists in storage
   */
  has(key: string): boolean {
    return storage.has(key);
  }

  /**
   * Get all storage keys
   */
  keys(): string[] {
    return storage.keys();
  }

  /**
   * Check if storage system is ready
   */
  isReady(): boolean {
    return encryptedStorage.isReady();
  }

  /**
   * Force sync all cached data
   */
  async flush(): Promise<void> {
    await encryptedStorage.flush();
  }
}

// ============ Connection State Service Implementation ============

class ConnectionStateServiceImpl implements ConnectionStateService {
  connected = connected;
  currentScene = currentScene;
  sources = sources;
  textSources = textSources;
  connectionState = connectionState;
  isReady = isReady;
}

// ============ Logger Service Implementation ============

class LoggerServiceImpl implements LoggerService {
  private entries: Array<{
    message: string;
    level: 'info' | 'success' | 'error' | 'warning' | 'debug';
    timestamp: Date;
    flair?: string;
    icon?: string;
  }> = [];
  private maxEntries = 1000;

  log(message: string, level: 'info' | 'success' | 'error' | 'warning' | 'debug' = 'info', flair?: string, icon?: string): void {
    const entry = {
      message,
      level,
      timestamp: new Date(),
      flair,
      icon
    };

    this.entries.push(entry);
    
    // Limit entries
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // CRITICAL: Directly call addLogEntry if available (set up by bootstrap)
    // This ensures logs reach the activity log store immediately
    if (typeof window !== 'undefined' && (window as any).addLogEntry && typeof (window as any).addLogEntry === 'function') {
      try {
        (window as any).addLogEntry(message, level, flair, icon);
      } catch (err) {
        console.warn('[LoggerService] Failed to call window.addLogEntry:', err);
      }
    }

    // Emit event for UI components (backup/alternative path)
    import('../../core/events/EventBus').then(({ EventBus }) => {
      EventBus.emitSync('log:entry', entry);
    }).catch(() => {
      // EventBus import failed, but we already logged via window.addLogEntry above
    });

    // Also call legacy logger if available
    if (typeof window !== 'undefined' && (window as any).App?.log) {
      (window as any).App.log(message, level, flair, icon);
    }
  }

  info(message: string, flair?: string, icon?: string): void {
    this.log(message, 'info', flair, icon);
  }

  success(message: string, flair?: string, icon?: string): void {
    this.log(message, 'success', flair, icon);
  }

  error(message: string, flair?: string, icon?: string): void {
    this.log(message, 'error', flair, icon);
  }

  warning(message: string, flair?: string, icon?: string): void {
    this.log(message, 'warning', flair, icon);
  }

  debug(message: string, flair?: string, icon?: string): void {
    this.log(message, 'debug', flair, icon);
  }

  clear(): void {
    this.entries = [];
    
    // CRITICAL: Directly call clearLogEntries if available (set up by bootstrap)
    if (typeof window !== 'undefined' && (window as any).clearLogEntries && typeof (window as any).clearLogEntries === 'function') {
      try {
        (window as any).clearLogEntries();
      } catch (err) {
        console.warn('[LoggerService] Failed to call window.clearLogEntries:', err);
      }
    }
    
    // Emit event for UI components (backup/alternative path)
    import('../../core/events/EventBus').then(({ EventBus }) => {
      EventBus.emitSync('log:cleared', {});
    }).catch(() => {
      // EventBus import failed, but we already cleared via window.clearLogEntries above
    });
  }

  getEntries() {
    return [...this.entries];
  }
}

// ============ Navigation Service Implementation ============

import { currentPage, navigateTo as navigateToStore } from '../../stores/navigation';
import { get } from 'svelte/store';

class NavigationServiceImpl implements NavigationService {
  navigateTo(page: string, save: boolean = true): void {
    const previousPage = get(currentPage);
    
    // Use store navigation
    navigateToStore(page, save);

    // Emit event
    import('../../core/events/EventBus').then(({ EventBus }) => {
      EventBus.emitSync('navigation:page-changed', { page, previousPage });
    });
  }

  getCurrentPage(): string {
    return get(currentPage);
  }

  onPageChange(callback: (page: string) => void): () => void {
    // Subscribe to store changes
    const unsubscribe = currentPage.subscribe(page => {
      callback(page);
    });
    
    return unsubscribe;
  }
}

// ============ Initialize Services ============

export function initializeServices(): void {
  // Register core services
  ServiceRegistry.register(SERVICE_KEYS.STORAGE, new StorageServiceImpl(), true);
  ServiceRegistry.register(SERVICE_KEYS.CONNECTION_STATE, new ConnectionStateServiceImpl(), true);
  ServiceRegistry.register(SERVICE_KEYS.LOGGER, new LoggerServiceImpl(), true);
  ServiceRegistry.register(SERVICE_KEYS.NAVIGATION, new NavigationServiceImpl(), true);
  ServiceRegistry.register(SERVICE_KEYS.MODULE_REGISTRY, ModuleRegistry, true);
}

