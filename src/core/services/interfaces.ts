/**
 * Service Interfaces
 * 
 * Type definitions for core services used throughout the application.
 * These interfaces define contracts that services must implement,
 * enabling loose coupling and easy testing.
 */

import type { Writable, Readable } from 'svelte/store';
import type { Source } from '../../types';

// ============ Storage Service ============

export interface StorageService {
  // Async methods for encrypted storage (automatically encrypts/decrypts)
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T): Promise<boolean>;
  
  // Sync methods for non-encrypted operations
  remove(key: string): void;
  clear(): void;
  getRaw(key: string): any;
  setRaw(key: string, value: any): void;
  has(key: string): boolean;
  keys(): string[];
  isReady(): boolean;
  flush(): Promise<void>;
}

// ============ WebSocket Service ============

export interface WebSocketService {
  connect(): Promise<void>;
  disconnect(): void;
  send(method: string, params?: any): Promise<any>;
  request(method: string, params?: any): Promise<any>;
  isConnected(): boolean;
  getWebSocket(): WebSocket | null;
}

// ============ Connection State Service ============

export interface ConnectionStateService {
  connected: Writable<boolean>;
  currentScene: Writable<string>;
  sources: Writable<Source[]>;
  textSources: Writable<Source[]>;
  connectionState: Readable<{
    connected: boolean;
    currentScene: string;
    sources: Source[];
    textSources: Source[];
  }>;
  isReady: Readable<boolean>;
}

// ============ Logger Service ============

export type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'debug';

export interface LogEntry {
  message: string;
  level: LogLevel;
  timestamp: Date;
  flair?: string;
  icon?: string;
}

export interface LoggerService {
  log(message: string, level?: LogLevel, flair?: string, icon?: string): void;
  info(message: string, flair?: string, icon?: string): void;
  success(message: string, flair?: string, icon?: string): void;
  error(message: string, flair?: string, icon?: string): void;
  warning(message: string, flair?: string, icon?: string): void;
  debug(message: string, flair?: string, icon?: string): void;
  clear(): void;
  getEntries(): LogEntry[];
}

// ============ Navigation Service ============

export interface NavigationService {
  navigateTo(page: string, save?: boolean): void;
  getCurrentPage(): string;
  onPageChange(callback: (page: string) => void): () => void;
}

// ============ Module Communication Service ============

export interface ModuleService {
  register(name: string, module: any): void;
  get<T = any>(name: string): T | undefined;
  has(name: string): boolean;
  unregister(name: string): void;
  getAll(): Record<string, any>;
}

// ============ Service Keys ============

export const SERVICE_KEYS = {
  STORAGE: Symbol('storage'),
  WEBSOCKET: Symbol('websocket'),
  CONNECTION_STATE: Symbol('connectionState'),
  LOGGER: Symbol('logger'),
  NAVIGATION: Symbol('navigation'),
  MODULE_REGISTRY: Symbol('moduleRegistry'),
} as const;

