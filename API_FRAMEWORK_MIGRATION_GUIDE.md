# API Framework Migration Guide

> **Complete guide for migrating all workers and apps to use the shared API framework** [DEPLOY]

---

## Overview

This guide covers migrating all Strixun Stream Suite workers and frontend apps to use the shared `@strixun/api-framework` package.

**Status**: [SUCCESS] Shared package created, [EMOJI] Migration in progress

---

## Workers to Migrate

1. [SUCCESS] **mods-api** - TypeScript, needs full migration
2. [EMOJI] **game-api** - JavaScript, needs full migration
3. [EMOJI] **otp-auth-service** - Uses `enhanced-router` wrapper (partial), needs full migration
4. [EMOJI] **url-shortener** - Uses `enhanced-router` wrapper (partial), needs full migration
5. [EMOJI] **chat-signaling** - Uses `enhanced-router` wrapper (partial), needs full migration
6. [EMOJI] **twitch-api** - Needs full migration

## Frontend Apps to Migrate

1. [EMOJI] **mods-hub** - React app, needs client migration

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

[SUCCESS] **Completed** for all packages

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

## Worker-Specific Migration Details

### mods-api

**Status**: [EMOJI] In Progress

**Changes Needed**:
1. Replace `getCorsHeaders` with framework CORS
2. Replace `authenticateRequest` with framework auth middleware
3. Convert handlers to use `createEnhancedHandler`
4. Add RFC 7807 error handling
5. Add type definitions for mods

**Files to Update**:
- `worker.ts` - Use `createWorkerHandler`
- `router/mod-routes.ts` - Use framework routing
- `handlers/mods/*.ts` - Use `createEnhancedHandler`
- `handlers/versions/*.ts` - Use `createEnhancedHandler`
- `utils/cors.ts` - Remove (use framework)
- `utils/auth.ts` - Remove (use framework)

### game-api

**Status**: [EMOJI] Pending

**Changes Needed**:
1. Convert to TypeScript
2. Replace manual CORS/auth with framework
3. Migrate all handlers

### otp-auth-service

**Status**: [EMOJI] Pending (Currently uses `enhanced-router` wrapper)

**Changes Needed**:
1. Replace `enhanced-router` wrapper with full framework
2. Migrate all handlers to use `createEnhancedHandler`
3. Remove duplicate CORS/auth utilities

### url-shortener

**Status**: [EMOJI] Pending (Currently uses `enhanced-router` wrapper)

**Changes Needed**:
1. Replace `enhanced-router` wrapper with full framework
2. Migrate handlers

### chat-signaling

**Status**: [EMOJI] Pending (Currently uses `enhanced-router` wrapper)

**Changes Needed**:
1. Replace `enhanced-router` wrapper with full framework
2. Migrate handlers

### twitch-api

**Status**: [EMOJI] Pending

**Changes Needed**:
1. Migrate to use framework
2. Replace manual CORS

---

## Frontend App Migration

### mods-hub

**Status**: [EMOJI] Pending

**Files to Update**:
- `src/services/api.ts` - Replace with framework client

**Benefits**:
- Automatic retry logic
- Request deduplication
- Caching
- Offline queue
- Optimistic updates

---

## Type Definitions

Create type definitions for all endpoints:

```typescript
import type { TypeDefinition } from '@strixun/api-framework/enhanced';

const modTypeDef: TypeDefinition = {
    typeName: 'Mod',
    required: ['modId', 'authorId', 'title', 'category'],
    optional: ['description', 'tags', 'thumbnailUrl'],
    metrics: {
        downloadCount: {
            required: false,
            compute: (data) => data.versions?.reduce((sum, v) => sum + v.downloads, 0) || 0,
        },
    },
};
```

---

## Testing Checklist

After migration, verify:

- [ ] CORS headers are correct
- [ ] Authentication works
- [ ] Error handling returns RFC 7807 format
- [ ] Response filtering works (if implemented)
- [ ] Type definitions are registered
- [ ] Frontend can make requests
- [ ] All endpoints work as before

---

## Rollback Plan

If issues arise:

1. Revert package.json changes
2. Restore original handler files
3. Remove framework imports
4. Restore manual CORS/auth utilities

---

## Next Steps

1. [SUCCESS] Create shared API framework package
2. [SUCCESS] Update all package.json files
3. [EMOJI] Migrate mods-api (in progress)
4. [EMOJI] Migrate game-api
5. [EMOJI] Migrate otp-auth-service
6. [EMOJI] Migrate url-shortener
7. [EMOJI] Migrate chat-signaling
8. [EMOJI] Migrate twitch-api
9. [EMOJI] Migrate mods-hub frontend
10. [EMOJI] Test all services
11. [EMOJI] Remove old utilities (cors.ts, auth.ts, etc.)

---

**Last Updated**: $(date)  
**Status**: Migration in progress

