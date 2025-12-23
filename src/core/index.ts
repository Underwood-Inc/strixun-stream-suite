/**
 * Core Module Exports
 * 
 * Central export point for the core communication layer.
 * Import from here for clean, organized imports.
 */

// Services
export { ServiceRegistry } from './services/ServiceRegistry';
export { ModuleRegistry } from './services/ModuleRegistry';
export { SERVICE_KEYS } from './services/interfaces';
export type {
  StorageService,
  WebSocketService,
  ConnectionStateService,
  LoggerService,
  NavigationService,
  ModuleService,
  LogLevel,
  LogEntry
} from './services/interfaces';

// Events
export { EventBus } from './events/EventBus';
export type { EventHandler, EventFilter } from './events/EventBus';

// Communication
export { ModuleCommunicator } from './communication/ModuleCommunicator';
export { getModuleAdapter } from './communication/ModuleAdapter';
export type { ModuleAdapter } from './communication/ModuleAdapter';

// Modules
export { ModuleWrapper } from './modules/ModuleWrapper';
export type { ModuleWrapperOptions } from './modules/ModuleWrapper';

// Initialization
export { initializeCore, getService, isCoreInitialized } from './init';

