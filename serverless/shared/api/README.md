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

- [SUCCESS] Type-safe API client
- [SUCCESS] Request deduplication
- [SUCCESS] Automatic retry with exponential backoff
- [SUCCESS] Multi-level caching
- [SUCCESS] Request queue with priorities
- [SUCCESS] Circuit breaker
- [SUCCESS] Offline queue
- [SUCCESS] Optimistic updates
- [SUCCESS] E2E encryption
- [SUCCESS] Response filtering
- [SUCCESS] Type-based response building
- [SUCCESS] RFC 7807 error handling
- [SUCCESS] Cloudflare Worker support

