# Core Communication Layer Architecture

This directory contains the core communication and service architecture for Strixun Stream Suite. It provides a scalable, decoupled, and maintainable foundation for module communication.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│              (Svelte Components, Pages)                  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Module Communication Layer                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Module       │  │ Module       │  │ Module       │  │
│  │ Communicator │  │ Communicator │  │ Communicator │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼─────────────────┼─────────────────┼──────────┘
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼──────────┐
│              Core Services Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Event Bus    │  │ Service      │  │ Module       │  │
│  │              │  │ Registry    │  │ Registry     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────────┐
│              Service Implementations                     │
│  Storage │ WebSocket │ Logger │ Navigation │ etc.      │
└─────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Service Registry (`services/ServiceRegistry.ts`)

Centralized dependency injection system. Services are registered once and can be accessed from anywhere.

```typescript
// Register a service
ServiceRegistry.register(SERVICE_KEYS.STORAGE, storageService);

// Get a service
const storage = ServiceRegistry.get<StorageService>(SERVICE_KEYS.STORAGE);
```

### 2. Event Bus (`events/EventBus.ts`)

Decoupled event communication system. Modules can emit and listen to events without direct dependencies.

```typescript
// Emit an event
EventBus.emit('sources:updated', { sources: [...] });

// Listen to events
EventBus.on('sources:updated', (data) => {
  console.log('Sources updated:', data);
});
```

### 3. Module Communicator (`communication/ModuleCommunicator.ts`)

High-level API for module-to-module communication.

```typescript
const communicator = new ModuleCommunicator('MyModule');

// Call another module
await communicator.call('SourceSwaps', 'executeSwap', sourceA, sourceB);

// Emit events
communicator.emit('action-completed', { result: 'success' });
```

### 4. Module Registry (`services/ModuleRegistry.ts`)

Centralized registry for all application modules.

```typescript
ModuleRegistry.register('SourceSwaps', sourceSwapsModule);
const module = ModuleRegistry.get('SourceSwaps');
```

### 5. Module Adapter (`communication/ModuleAdapter.ts`)

Bridges new architecture with legacy window-based code for gradual migration.

## Usage Examples

### Registering a Module

```typescript
import { ModuleRegistry } from '@/core/services/ModuleRegistry';
import { ModuleWrapper } from '@/core/modules/ModuleWrapper';

// Wrap and register
ModuleWrapper.register('SourceSwaps', sourceSwapsModule, {
  dependencies: {
    storage: ServiceRegistry.get(SERVICE_KEYS.STORAGE),
    logger: ServiceRegistry.get(SERVICE_KEYS.LOGGER)
  }
});
```

### Using Services

```typescript
import { ServiceRegistry, SERVICE_KEYS } from '@/core';
import type { StorageService } from '@/core/services/interfaces';

const storage = ServiceRegistry.get<StorageService>(SERVICE_KEYS.STORAGE);
storage.set('key', 'value');
```

### Module Communication

```typescript
import { ModuleCommunicator } from '@/core/communication/ModuleCommunicator';

class MyModule {
  private communicator = new ModuleCommunicator('MyModule');
  
  async doSomething() {
    // Call another module
    await this.communicator.call('SourceSwaps', 'executeSwap', 'sourceA', 'sourceB');
    
    // Emit event
    this.communicator.emit('my-module:action-completed', { result: 'success' });
  }
}
```

### Event-Driven Communication

```typescript
import { EventBus } from '@/core/events/EventBus';

// In module A
EventBus.emit('sources:updated', { sources: [...] });

// In module B
EventBus.on('sources:updated', (data) => {
  // React to sources update
  updateUI(data.sources);
});
```

## Benefits

1. **Decoupled**: Modules don't need direct references to each other
2. **Testable**: Services can be easily mocked for testing
3. **Scalable**: Easy to add new modules and services
4. **Type-Safe**: Full TypeScript support with interfaces
5. **Maintainable**: Clear separation of concerns
6. **Backward Compatible**: Legacy code continues to work via adapters

## Migration Strategy

1. **Phase 1**: Core infrastructure (✓ Complete)
2. **Phase 2**: Register existing modules with adapters
3. **Phase 3**: Migrate modules to use new APIs gradually
4. **Phase 4**: Remove legacy window globals

## Service Interfaces

All services implement interfaces defined in `services/interfaces.ts`:

- `StorageService`: Data persistence
- `WebSocketService`: OBS WebSocket communication
- `ConnectionStateService`: Connection state management
- `LoggerService`: Logging functionality
- `NavigationService`: Page navigation
- `ModuleService`: Module registry

## Event Naming Convention

Events follow the pattern: `module:action` or `module:entity:action`

Examples:
- `sources:updated`
- `connection:established`
- `swap:executed`
- `text-cycler:started`

## Best Practices

1. **Use services, not direct imports**: Access shared functionality through services
2. **Emit events for state changes**: Let other modules react to changes
3. **Use ModuleCommunicator for direct calls**: When you need to call another module
4. **Keep modules focused**: Each module should have a single responsibility
5. **Document your events**: Add JSDoc comments for events your module emits

