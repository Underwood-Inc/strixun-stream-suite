# Enhanced API Framework - Usage Guide

Complete guide for using the enhanced API framework in Cloudflare Workers and client applications.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Type Definitions](#type-definitions)
3. [Server-Side Usage](#server-side-usage)
4. [Client-Side Usage](#client-side-usage)
5. [Response Filtering](#response-filtering)
6. [E2E Encryption](#e2e-encryption)
7. [Error Handling](#error-handling)
8. [Migration Guide](#migration-guide)

## Quick Start

### Server-Side (Cloudflare Worker)

```typescript
import { createEnhancedHandler, registerType } from '@/core/api/enhanced';

// Define your response type
interface MyResponse {
  name: string;
  email: string;
}

// Register type definition
registerType('my-response', {
  typeName: 'MyResponse',
  required: ['id', 'customerId', 'name', 'email'],
  optional: [],
  metrics: {},
});

// Create handler
const handler = createEnhancedHandler<MyResponse>(
  async (request, context) => {
    return {
      name: 'John Doe',
      email: 'john@example.com',
    };
  },
  {
    typeDef: getType('my-response'),
    requireAuth: true,
    cors: true,
  }
);

// Use in Worker
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    return handler(request, env, ctx);
  },
};
```

### Client-Side

```typescript
import { createEnhancedAPIClient } from '@/core/api/enhanced';

const client = createEnhancedAPIClient({
  baseURL: 'https://api.example.com',
  encryption: {
    enabled: true,
    tokenGetter: () => localStorage.getItem('token'),
  },
});

// Make request - root config automatically included
const response = await client.get<MyResponse>('/api/data');
// response.data includes: { id, customerId, name, email }
```

## Type Definitions

### Basic Type Definition

```typescript
import { registerType, type TypeDefinition } from '@/core/api/enhanced';

const userTypeDef: TypeDefinition = {
  typeName: 'User',
  required: ['id', 'customerId', 'email'], // Always included
  optional: ['name', 'avatar', 'bio'],     // Included if requested
  metrics: {
    fullName: {
      required: false,
      compute: (data) => `${data.firstName} ${data.lastName}`,
      cache: {
        ttl: 3600,
        key: (data) => `user:${data.id}:fullName`,
      },
    },
  },
};

registerType('user', userTypeDef);
```

### Type Registry

```typescript
import { getTypeRegistry } from '@/core/api/enhanced';

const registry = getTypeRegistry();

// Register multiple types
registry.registerMany({
  'user': userTypeDef,
  'post': postTypeDef,
  'comment': commentTypeDef,
});

// Get type
const type = registry.get('user');

// Build filter config
const filterConfig = registry.buildFilterConfig({
  alwaysInclude: ['id', 'customerId'],
  defaultInclude: ['name', 'email'],
});
```

## Server-Side Usage

### Basic Handler

```typescript
import { createEnhancedHandler } from '@/core/api/enhanced/workers/handler';

const handler = createEnhancedHandler(
  async (request, context) => {
    // context.request - APIRequest
    // context.user - User info (if authenticated)
    // context.env - Cloudflare Worker env
    // context.adapter - WorkerAdapter

    const data = await fetchData();
    return data;
  },
  {
    typeDef: getType('my-type'),
    requireAuth: true,
    cors: true,
  }
);
```

### With Middleware

```typescript
import { withMiddleware } from '@/core/api/enhanced/middleware';
import { createE2EEncryptionMiddleware } from '@/core/api/enhanced';

const handler = withMiddleware(
  async (request, context) => {
    return { data: 'response' };
  },
  // Add encryption middleware
  createServerMiddleware(
    createE2EEncryptionMiddleware({
      enabled: true,
      tokenGetter: () => extractToken(request),
    })
  )
);
```

## Client-Side Usage

### Basic Client

```typescript
import { createEnhancedAPIClient } from '@/core/api/enhanced';

const client = createEnhancedAPIClient({
  baseURL: 'https://api.example.com',
});

// All standard methods available
await client.get('/api/data');
await client.post('/api/data', { name: 'John' });
await client.put('/api/data/1', { name: 'Jane' });
await client.delete('/api/data/1');
await client.patch('/api/data/1', { name: 'Bob' });
```

### With Enhanced Features

```typescript
const client = createEnhancedAPIClient({
  baseURL: 'https://api.example.com',
  
  // E2E Encryption
  encryption: {
    enabled: true,
    tokenGetter: () => getJWTToken(),
    encryptCondition: (request, response) => {
      return request.path.includes('/sensitive');
    },
  },
  
  // Response Filtering
  filtering: {
    rootConfig: {
      alwaysInclude: ['id', 'customerId'],
      defaultInclude: ['name', 'email'],
    },
    typeDefinitions: getTypeRegistry().getAll(),
    tags: {
      summary: ['id', 'name'],
      detailed: ['*'],
    },
  },
  
  // Error Handling
  errorHandling: {
    useErrorLegend: true,
    rfc7807: true,
  },
  
  // Worker Support
  worker: {
    env: {
      CACHE_KV: env.CACHE_KV,
    },
    cors: true,
  },
});

// Set user context (for root config)
client.setUser({
  id: 'user-123',
  customerId: 'customer-456',
  email: 'user@example.com',
});
```

## Response Filtering

### Query Parameters

```typescript
// Include specific fields
GET /api/user?include=name,email,avatar

// Exclude fields
GET /api/user?exclude=password,secret

// Use tags
GET /api/user?tags=summary,public

// Combine
GET /api/user?include=name,email&tags=summary&exclude=internal
```

### Server-Side Filtering

```typescript
import { applyFiltering, parseFilteringParams } from '@/core/api/enhanced';

const handler = createEnhancedHandler(
  async (request, context) => {
    const data = await fetchData();
    
    // Filtering is automatic in createEnhancedHandler
    // But you can also do it manually:
    const params = parseFilteringParams(context.request);
    const filtered = applyFiltering(
      data,
      params,
      filterConfig,
      typeDef
    );
    
    return filtered;
  },
  {
    filterConfig: myFilterConfig,
    typeDef: myTypeDef,
  }
);
```

## E2E Encryption

### Server-Side Encryption

```typescript
import { encryptWithJWT } from '@/core/api/enhanced';

const handler = async (request: Request) => {
  const data = { sensitive: 'information' };
  const token = extractToken(request);
  
  // Encrypt response
  const encrypted = await encryptWithJWT(data, token);
  
  return new Response(JSON.stringify(encrypted), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### Client-Side Decryption

```typescript
import { decryptWithJWT } from '@/core/api/enhanced';

const client = createEnhancedAPIClient({
  encryption: {
    enabled: true,
    tokenGetter: () => getJWTToken(),
  },
});

// Response is automatically decrypted
const response = await client.get('/api/sensitive-data');
// response.data is decrypted automatically
```

## Error Handling

### RFC 7807 Format

All errors are automatically formatted as RFC 7807:

```json
{
  "type": "https://tools.ietf.org/html/rfc7231#section-6.5.1",
  "title": "Bad Request",
  "status": 400,
  "detail": "Invalid input provided",
  "instance": "/api/data",
  "error_code": "invalid_input",
  "error_info": {
    "details": "The email field is required",
    "suggestion": "Please provide a valid email address"
  }
}
```

### Error Legend Integration

```typescript
import { getErrorInfo } from '@/shared-components/error-mapping/error-legend';

// Error info is automatically included in responses
// Client can use error legend to display user-friendly messages
```

## Migration Guide

### Step 1: Register Types

```typescript
// In your service initialization
import { registerType } from '@/core/api/enhanced';

registerType('user', userTypeDef);
registerType('post', postTypeDef);
// ... register all your types
```

### Step 2: Update Handlers

```typescript
// Before
export default {
  async fetch(request: Request, env: any) {
    const data = await getData();
    return new Response(JSON.stringify(data));
  },
};

// After
import { createEnhancedHandler } from '@/core/api/enhanced/workers/handler';

const handler = createEnhancedHandler(
  async (request, context) => {
    return await getData();
  },
  {
    typeDef: getType('my-type'),
    requireAuth: true,
    cors: true,
  }
);

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    return handler(request, env, ctx);
  },
};
```

### Step 3: Update Client

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

### Step 4: Test and Iterate

1. Test each endpoint
2. Verify root config is included
3. Test response filtering
4. Test error handling
5. Test E2E encryption (if enabled)

## Best Practices

1. **Always register types** - Enables type safety and filtering
2. **Use type registry** - Centralized type management
3. **Set user context** - Required for root config
4. **Enable CORS** - Required for browser clients
5. **Use error legend** - Consistent error messages
6. **Cache metrics** - Improve performance
7. **Test filtering** - Ensure correct fields returned

## Troubleshooting

### Root config not included

- Ensure `setUser()` is called on client
- Check type definition includes root fields
- Verify handler uses `createEnhancedHandler`

### Filtering not working

- Check filter config is set
- Verify type definition is registered
- Check query parameters are correct

### Encryption not working

- Verify JWT token is available
- Check `encryptCondition` if set
- Ensure token is valid

### Errors not formatted

- Check `errorHandling.useErrorLegend` is enabled
- Verify error legend is imported
- Check error is thrown correctly

