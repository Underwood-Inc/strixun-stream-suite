# API Framework

> **Facebook/Meta-level API framework for Strixun Stream Suite**

A production-grade, scalable API framework with intelligent request management, caching, retry logic, and more.

## Features

- ✅ **Type-Safe API Client** - Full TypeScript support with auto-generated types
- ✅ **Request Deduplication** - Prevents duplicate simultaneous requests
- ✅ **Automatic Retry** - Exponential backoff with configurable strategies
- ✅ **Multi-Level Caching** - Memory + IndexedDB with smart invalidation
- ✅ **Request Queue** - Priority-based queuing with concurrency control
- ✅ **Circuit Breaker** - Prevents cascading failures
- ✅ **Offline Queue** - Queue requests when offline, sync on reconnect
- ✅ **Optimistic Updates** - Instant UI updates with rollback on error
- ✅ **Request Batching** - Batch multiple requests into single network call
- ✅ **WebSocket Integration** - Automatic reconnection and message queuing
- ✅ **Plugin System** - Extensible architecture with pre-built plugins
- ✅ **Middleware Pipeline** - Request/response transformation
- ✅ **Request Cancellation** - Cancel in-flight requests
- ✅ **Observability** - Built-in logging, metrics, and analytics

## Quick Start

### Basic Usage

```typescript
import { getAPIClient } from '@/core/api';

const api = getAPIClient();

// Simple GET request
const response = await api.get('/clips', { channel: 'ninja', limit: 10 });
console.log(response.data);

// POST request
const saveResponse = await api.post('/cloud-save/save', {
  configs: { /* ... */ }
});

// With caching
const cachedResponse = await api.getCached('/clips', { channel: 'ninja' }, {
  strategy: 'stale-while-revalidate',
  ttl: 5 * 60 * 1000, // 5 minutes
});
```

### Advanced Usage

```typescript
import { createAPIClient } from '@/core/api';

// Create custom client
const api = createAPIClient({
  baseURL: 'https://api.example.com',
  timeout: 30000,
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
  },
  cache: {
    enabled: true,
    defaultStrategy: 'network-first',
  },
});

// Request with priority
await api.get('/important-data', {}, {
  priority: 'high',
});

// Request with cancellation
const controller = new AbortController();
const promise = api.get('/data', {}, {
  signal: controller.signal,
});
controller.abort(); // Cancel request

// Optimistic update
await api.requestOptimistic(
  api.request().method('POST').path('/save').body(data).build(),
  {
    data: { success: true },
    rollback: (error) => {
      console.error('Rollback:', error);
    },
  }
);
```

### WebSocket Usage

```typescript
import { WebSocketClient } from '@/core/api';

const ws = new WebSocketClient({
  url: 'ws://localhost:4455',
  reconnectDelay: 1000,
});

// Send message
ws.send({ type: 'GetSceneList', data: {} });

// Request/response pattern
const response = await ws.request('GetSceneList', {}, 5000);

// Event listeners
ws.on('open', () => console.log('Connected'));
ws.on('message', (data) => console.log('Message:', data));
ws.on('error', (error) => console.error('Error:', error));
```

## Architecture

### Core Components

1. **APIClient** - Base client with middleware pipeline
2. **EnhancedAPIClient** - Full-featured client with all features
3. **Request Management** - Deduplication, queuing, cancellation
4. **Resilience** - Retry, circuit breaker, offline queue
5. **Cache** - Multi-level caching with strategies
6. **Batching** - Request batching and debouncing
7. **Plugins** - Extensible plugin system

### Middleware Pipeline

Request flow:
1. Request transformation
2. Authentication
3. Caching (check)
4. Request deduplication
5. Request queue
6. Retry logic
7. Network request
8. Response transformation
9. Caching (store)
10. Error handling

## Configuration

### Default Configuration

```typescript
{
  baseURL: '', // Auto-detected from window.getWorkerApiUrl()
  timeout: 30000,
  retry: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 10000,
  },
  cache: {
    enabled: true,
    defaultStrategy: 'network-first',
    defaultTTL: 5 * 60 * 1000,
  },
  offline: {
    enabled: true,
    queueSize: 100,
    syncOnReconnect: true,
  },
}
```

## Migration Guide

### From Old API Calls

**Before:**
```typescript
const response = await fetch(`${apiUrl}/clips?channel=ninja`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
const data = await response.json();
```

**After:**
```typescript
import { getAPIClient } from '@/core/api';

const api = getAPIClient();
const response = await api.get('/clips', { channel: 'ninja' });
const data = response.data;
```

### From authenticatedFetch

**Before:**
```typescript
import { authenticatedFetch } from '@/stores/auth';

const response = await authenticatedFetch('/cloud-save/save', {
  method: 'POST',
  body: JSON.stringify({ configs }),
});
```

**After:**
```typescript
import { getAPIClient } from '@/core/api';

const api = getAPIClient();
const response = await api.post('/cloud-save/save', { configs });
```

## API Reference

See [API_FRAMEWORK_PROPOSAL.md](../../docs/API_FRAMEWORK_PROPOSAL.md) for complete API reference.

## License

Part of Strixun Stream Suite

