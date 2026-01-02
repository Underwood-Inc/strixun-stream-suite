# API Framework Migration Guide

> **Complete guide for migrating all workers and apps to use the shared API framework**

**Date:** 2025-12-29  
**Status:** Migration Complete

---

## Overview

This guide covers migrating all Strixun Stream Suite workers and frontend apps to use the shared `@strixun/api-framework` package.

**Status**: ✓ Shared package created, ✓ Migration complete

---

## Workers Migrated

1. ✓ **mods-api** - TypeScript, fully migrated
2. ✓ **game-api** - JavaScript, fully migrated
3. ✓ **otp-auth-service** - Fully migrated (replaced enhanced-router wrapper)
4. ✓ **url-shortener** - Fully migrated (replaced enhanced-router wrapper)
5. ✓ **chat-signaling** - Fully migrated (replaced enhanced-router wrapper)
6. ✓ **twitch-api** - Fully migrated

## Frontend Apps Migrated

1. ✓ **mods-hub** - React app, fully migrated

---

## Migration Steps

### Step 1: Update Package Dependencies

All packages now have `@strixun/api-framework` as a dependency:

```json
{
  "dependencies": {
    "@strixun/api-framework": "workspace:*"
  }
}
```

✓ **Completed** for all packages

### Step 2: Migrate Worker Handlers

#### Before (Manual Pattern)

```typescript
import { getCorsHeaders } from '../utils/cors.js';
import { authenticateRequest } from '../utils/auth.js';

export async function handleRequest(
    request: Request,
    env: Env,
    auth: AuthResult
): Promise<Response> {
    try {
        // Manual CORS
        const headers = { ...getCorsHeaders(env, request), ... };
        
        // Business logic
        const data = await doSomething();
        
        return new Response(JSON.stringify(data), {
            status: 200,
            headers,
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: '...' }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), ... },
        });
    }
}
```

#### After (Framework Pattern)

```typescript
import { 
    createEnhancedHandler,
    createRFC7807Error,
    type HandlerContext,
} from '@strixun/api-framework/enhanced';

export const handleRequest = createEnhancedHandler(
    async (request: Request, context: HandlerContext) => {
        // Automatic auth check (requireAuth: true)
        // Automatic CORS handling
        // Automatic error handling (RFC 7807)
        
        // Business logic
        const data = await doSomething();
        
        // Return data (framework handles response building)
        return data;
    },
    {
        requireAuth: true,
        cors: true,
        typeDef: myTypeDefinition, // Optional
    }
);
```

### Step 3: Migrate Worker Entry Points

#### Before

```typescript
import { getCorsHeaders } from './utils/cors.js';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: getCorsHeaders(env, request) });
        }
        
        // Manual routing
        return await route(request, env);
    },
};
```

#### After

```typescript
import { createWorkerHandler } from '@strixun/api-framework/enhanced';
import { route } from './router.js';

export default createWorkerHandler(
    async (request: Request, env: Env, ctx: ExecutionContext) => {
        // Automatic CORS preflight handling
        return await route(request, env);
    },
    {
        cors: true,
    }
);
```

### Step 4: Migrate Frontend API Clients

#### Before (Manual Fetch)

```typescript
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = getAuthToken();
    const headers = new Headers(options.headers);
    
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    
    return fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers,
    });
}

export async function listMods(params: any) {
    const response = await fetchWithAuth(`/mods?${searchParams}`);
    if (!response.ok) {
        throw new Error(`Failed: ${response.statusText}`);
    }
    return response.json();
}
```

#### After (Framework Client)

```typescript
import { createAPIClient } from '@strixun/api-framework/client';

const api = createAPIClient({
    baseURL: import.meta.env.VITE_MODS_API_URL || 'https://mods-api.idling.app',
    defaultHeaders: {
        'Content-Type': 'application/json',
    },
});

// Add auth middleware
api.useMiddleware(async (request, next) => {
    const token = getAuthToken();
    if (token) {
        request.headers.set('Authorization', `Bearer ${token}`);
    }
    return next(request);
});

export async function listMods(params: any) {
    const response = await api.get('/mods', params);
    return response.data;
}
```

---

## Benefits Achieved

1. **Unified Architecture** - All services use the same framework
2. **Standardized Errors** - RFC 7807 format across all endpoints
3. **Better Frontend** - Caching, retry, and offline support
4. **Easier Maintenance** - Single source of truth for API utilities
5. **Type Safety** - Full TypeScript support
6. **Scalability** - Framework designed for growth

---

## Next Steps (Optional Cleanup)

1. **Remove Old Utilities** (after testing)
   - `serverless/mods-api/utils/cors.ts` - Can be removed
   - `serverless/mods-api/utils/auth.ts` - Can be removed (or keep if still used)
   - `serverless/game-api/utils/cors.js` - Can be removed
   - `serverless/twitch-api/utils/cors.js` - Can be removed (or keep for backward compat)
   - `serverless/shared/enhanced-router.ts` - Can be removed (replaced by framework)

2. **Test All Services**
   - Verify CORS works correctly
   - Verify error handling returns RFC 7807 format
   - Verify frontend can make requests
   - Test all endpoints

3. **Update Documentation**
   - Update API documentation with RFC 7807 error format
   - Document framework usage patterns

---

**Migration Completed**: 2025-12-29  
**Status**: ✓ All services migrated and ready for testing

