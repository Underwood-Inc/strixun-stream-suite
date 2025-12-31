# Shared API Framework

Shared API framework package for all Strixun Stream Suite workers and apps.

## Installation

This package is part of the pnpm workspace and is automatically available to all packages.

## Usage

### In Cloudflare Workers

```typescript
import { 
  createEnhancedHandler,
  createWorkerHandler,
  createCORSMiddleware,
  createRFC7807Error,
} from '@strixun/api-framework/enhanced';

// Create enhanced handler
export const handleRequest = createEnhancedHandler(
  async (request, context) => {
    // Your handler logic
    return { data: 'result' };
  },
  {
    requireAuth: true,
    cors: true,
    typeDef: myTypeDefinition,
  }
);
```

### In Frontend Apps

```typescript
import { getAPIClient, createAPIClient } from '@strixun/api-framework/client';

// Get default client
const api = getAPIClient();

// Or create custom client
const api = createAPIClient({
  baseURL: 'https://api.example.com',
  timeout: 30000,
});

// Use client
const response = await api.get('/endpoint');
```

## Exports

- `@strixun/api-framework` - Full framework (workers + client)
- `@strixun/api-framework/enhanced` - Enhanced features (workers only)
- `@strixun/api-framework/client` - Client-side only

## Features

- [OK] Type-safe API client
- [OK] Request deduplication
- [OK] Automatic retry with exponential backoff
- [OK] Multi-level caching
- [OK] Request queue with priorities
- [OK] Circuit breaker
- [OK] Offline queue
- [OK] Optimistic updates
- [OK] E2E encryption
- [OK] Response filtering
- [OK] Type-based response building
- [OK] RFC 7807 error handling
- [OK] Cloudflare Worker support

