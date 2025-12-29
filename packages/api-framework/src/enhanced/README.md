# Enhanced API Framework

Enhanced API framework with E2E encryption, response filtering, type-based building, and Cloudflare Worker support.

## Features

### ✅ Implemented

1. **E2E Encryption** - JWT-based encryption (only email holder can decrypt)
2. **Response Filtering** - Opt-in tag system and field-level filtering
3. **Type-Based Response Building** - Automatic root config inclusion
4. **RFC 7807 Error Handling** - Standardized error format with error legend integration
5. **Cloudflare Worker Support** - KV cache, CORS, platform detection
6. **Metric Computation** - On-demand metrics with caching

## Quick Start

### Basic Usage

```typescript
import { createEnhancedAPIClient } from '@/core/api/enhanced';

const client = createEnhancedAPIClient({
  baseURL: 'https://api.example.com',
  encryption: {
    enabled: true,
    tokenGetter: () => localStorage.getItem('token'),
  },
  filtering: {
    rootConfig: {
      alwaysInclude: ['id', 'customerId'],
    },
    typeDefinitions: new Map(),
    tags: {},
  },
  errorHandling: {
    useErrorLegend: true,
    rfc7807: true,
  },
  worker: {
    env: {
      CACHE_KV: env.CACHE_KV, // Cloudflare KV namespace
    },
    cors: true,
  },
});

// Make a request
const response = await client.get<MyResponseType>('/api/data');
// Response automatically includes id and customerId (root config)
```

### With Type Definitions

```typescript
import type { TypeDefinition } from '@/core/api/enhanced';

const userTypeDef: TypeDefinition = {
  typeName: 'User',
  required: ['id', 'customerId', 'email'],
  optional: ['name', 'avatar'],
  metrics: {
    fullName: {
      required: false,
      compute: (data) => `${data.firstName} ${data.lastName}`,
    },
  },
};

// Register type definition
client.configureEnhanced({
  filtering: {
    typeDefinitions: new Map([['user', userTypeDef]]),
  },
});
```

### Response Filtering

```typescript
// Include specific fields
const response = await client.get('/api/user', {
  include: 'name,email,avatar'
});

// Exclude fields
const response = await client.get('/api/user', {
  exclude: 'password,secret'
});

// Use tags
const response = await client.get('/api/user', {
  tags: 'summary,public'
});
```

### E2E Encryption

```typescript
const client = createEnhancedAPIClient({
  encryption: {
    enabled: true,
    tokenGetter: () => getJWTToken(),
    encryptCondition: (request, response) => {
      // Only encrypt sensitive endpoints
      return request.path.includes('/sensitive');
    },
  },
});

// Responses are automatically encrypted if token is present
const response = await client.get('/api/sensitive-data');
// Response.data is encrypted - only JWT holder can decrypt
```

### Cloudflare Worker Usage

```typescript
// In a Cloudflare Worker
import { createWorkerHandler, createEnhancedAPIClient } from '@/core/api/enhanced';

export default createWorkerHandler(async (request, env) => {
  const client = createEnhancedAPIClient({
    worker: {
      env,
      cors: true,
    },
  });

  // Use client in worker
  const response = await client.get('/api/data');
  return new Response(JSON.stringify(response.data));
});
```

## Architecture

### Root Config Type Enforcement

All responses automatically include root fields via TypeScript:

```typescript
interface RootResponseConfig {
  id: string;
  customerId: string;
}

type APIResponse<T> = RootResponseConfig & T;

// TypeScript enforces that all responses include id and customerId
interface UserResponse {
  name: string;
  email: string;
}

// UserResponseWithRoot = { id: string; customerId: string; name: string; email: string }
type UserResponseWithRoot = APIResponse<UserResponse>;
```

### Middleware Pipeline

Enhanced features are added as middleware:

1. Error Legend (first - catches all errors)
2. E2E Encryption (before response filtering)
3. Response Filtering
4. Response Building (server-side)

### Platform Detection

Automatically detects platform:
- `cloudflare-worker` - Cloudflare Workers
- `browser` - Browser environment
- `node` - Node.js (development only)

## API Reference

See `src/core/api/enhanced/index.ts` for full exports.

## Migration Guide

### From Base API Client

```typescript
// Before
import { createAPIClient } from '@/core/api/factory';
const client = createAPIClient();

// After
import { createEnhancedAPIClient } from '@/core/api/enhanced';
const client = createEnhancedAPIClient({
  // Enhanced features are opt-in
});
```

The enhanced client extends the base client, so all existing methods work.

## Next Steps

1. Migrate existing services to use enhanced framework
2. Add type definitions for all endpoints
3. Configure E2E encryption for sensitive endpoints
4. Set up response filtering tags
5. Test with Cloudflare Workers

