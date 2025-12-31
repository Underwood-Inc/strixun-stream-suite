# API Framework Usage Audit

**Date**: 2024-12-19  
**Status**: ★ **Multiple projects NOT using API framework correctly**

## Summary

Several projects are using manual `fetch()` calls or only partially using the API framework. All projects should use the shared API framework for:
- ✓ HTTPS enforcement (secureFetch)
- ✓ Encryption/decryption
- ✓ Automatic retry, circuit breaker, queuing
- ✓ Consistent error handling
- ✓ CORS handling

---

## ✗ Projects NOT Using API Framework Correctly

### 1. **OTP Auth Service Dashboard** ★ **Location**: `serverless/otp-auth-service/dashboard/src/lib/api-client.ts`  
**Issue**: Using manual `fetch()` instead of `createAPIClient`  
**Impact**: No HTTPS enforcement, no automatic retry, no encryption handling

**Current Code**:
```typescript
private async request(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, config); // ✗ Manual fetch
    // ...
}
```

**Should Use**:
```typescript
import { createAPIClient } from '@strixun/api-framework/client';

const api = createAPIClient({
    baseURL: API_BASE_URL,
    // Framework handles HTTPS, retry, encryption automatically
});
```

**Also Check**: `serverless/otp-auth-service/src/dashboard/lib/api-client.ts` (likely same issue)

---

### 2. **OTP Auth Service Utils - Customer API Client** ★ **Location**: `serverless/otp-auth-service/utils/customer-api-client.ts`  
**Issue**: Using manual `fetch()` instead of API framework client  
**Impact**: No HTTPS enforcement, no automatic retry, manual encryption handling

**Current Code**:
```typescript
async function makeCustomerApiRequest(...): Promise<Response> {
    return fetch(url, options); // ✗ Manual fetch
}
```

**Should Use**:
```typescript
import { createAPIClient } from '@strixun/api-framework/client';

const customerApi = createAPIClient({
    baseURL: getCustomerApiUrl(env),
    // Framework handles HTTPS, retry, encryption automatically
});
```

---

### 3. **OTP Auth Service Utils - Customer API Service Client** ★ **Location**: `serverless/otp-auth-service/utils/customer-api-service-client.ts`  
**Issue**: Using manual `fetch()` for service-to-service calls  
**Impact**: No HTTPS enforcement, no automatic retry

**Current Code**:
```typescript
async function makeServiceRequest(...): Promise<Response> {
    const response = await fetch(url, options); // ✗ Manual fetch
    // ...
}
```

**Should Use**:
```typescript
import { createAPIClient } from '@strixun/api-framework/client';

const serviceApi = createAPIClient({
    baseURL: getCustomerApiUrl(env),
    defaultHeaders: {
        'X-Service-Key': env.SERVICE_API_KEY,
    },
    // Framework handles HTTPS, retry automatically
});
```

---

### 4. **Workers - Partial Framework Usage** ★ **Locations**:
- `serverless/twitch-api/worker.ts`
- `serverless/chat-signaling/worker.ts`
- `serverless/url-shortener/worker.ts`
- `serverless/game-api/worker.ts`
- `serverless/customer-api/worker.ts`
- `serverless/mods-api/worker.ts`

**Issue**: Using `createCORSHeaders` but NOT using `createWorkerHandler`  
**Impact**: Missing automatic CORS preflight handling, error handling, and other framework benefits

**Current Pattern**:
```typescript
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Manual CORS preflight handling
        if (request.method === 'OPTIONS') {
            const corsHeaders = createCORSHeaders(request, {...});
            return new Response(null, { headers: {...} });
        }
        // Manual routing
        return route(request, env);
    },
};
```

**Should Use**:
```typescript
import { createWorkerHandler } from '@strixun/api-framework/enhanced';

export default createWorkerHandler(
    async (request: Request, env: Env, ctx: ExecutionContext) => {
        return route(request, env);
    },
    {
        cors: true, // Automatic CORS handling
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    }
);
```

**Benefits**:
- ✓ Automatic CORS preflight handling
- ✓ Automatic error handling with RFC 7807 format
- ✓ Consistent response formatting
- ✓ Better type safety

---

## ✓ Projects Using API Framework Correctly

### 1. **Mods Hub Frontend** ✓
**Location**: `mods-hub/src/`  
**Status**: ✓ **FIXED** - Now using `createAPIClient` for all API calls
- `mods-hub/src/stores/auth.ts` - Uses `createAPIClient`
- `mods-hub/src/services/api.ts` - Uses `createAPIClient`
- `mods-hub/src/pages/LoginPage.tsx` - Uses `createAPIClient`

---

## ★ Migration Priority

### High Priority (Frontend Clients)
1. **OTP Auth Service Dashboard** - User-facing, needs HTTPS enforcement
2. **OTP Auth Service Utils** - Service-to-service calls, needs reliability

### Medium Priority (Workers)
3. **All Workers** - Migrate to `createWorkerHandler` for consistency and automatic features

---

## ★ Migration Steps

### For Frontend Clients

1. **Replace manual fetch with createAPIClient**:
```typescript
// Before
const response = await fetch(url, options);

// After
import { createAPIClient } from '@strixun/api-framework/client';
const api = createAPIClient({ baseURL: API_BASE_URL });
const response = await api.get('/endpoint');
```

2. **Remove manual HTTPS checks** - Framework handles this automatically

3. **Remove manual retry logic** - Framework handles this automatically

4. **Use framework encryption** - Framework handles encryption/decryption automatically

### For Workers

1. **Replace manual fetch handler with createWorkerHandler**:
```typescript
// Before
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        if (request.method === 'OPTIONS') {
            // Manual CORS...
        }
        return route(request, env);
    },
};

// After
import { createWorkerHandler } from '@strixun/api-framework/enhanced';

export default createWorkerHandler(
    async (request: Request, env: Env, ctx: ExecutionContext) => {
        return route(request, env);
    },
    {
        cors: true,
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    }
);
```

2. **Remove manual CORS handling** - Framework handles this automatically

3. **Remove manual error handling** - Framework provides RFC 7807 error format

---

## ★ Notes

- **Why This Matters**: The API framework provides:
  - **Security**: HTTPS enforcement prevents accidental HTTP calls
  - **Reliability**: Automatic retry, circuit breaker, queuing
  - **Consistency**: Same error format, same CORS handling across all services
  - **Maintainability**: One place to fix bugs, add features

- **Service-to-Service Calls**: Even internal calls should use the framework for consistency and reliability

- **Workers**: Using `createWorkerHandler` provides automatic CORS, error handling, and better type safety

---

## ✓ Completion Checklist

- [x] Fix OTP Auth Service Dashboard (`dashboard/src/lib/api-client.ts`) - **COMPLETED**
- [x] Fix OTP Auth Service Dashboard (`src/dashboard/lib/api-client.ts`) - **COMPLETED**
- [x] Fix OTP Auth Service Utils (`utils/customer-api-client.ts`) - **COMPLETED**
- [x] Fix OTP Auth Service Utils (`utils/customer-api-service-client.ts`) - **COMPLETED**
- [ ] Migrate `twitch-api/worker.ts` to use `createCORSMiddleware` (currently uses `createCORSHeaders` manually)
- [x] `chat-signaling/worker.ts` - **ALREADY USING** `createCORSMiddleware` ✓
- [x] `url-shortener/worker.ts` - **ALREADY USING** `createCORSMiddleware` ✓
- [ ] Migrate `game-api/worker.ts` to use `createCORSMiddleware` (currently uses `createCORSHeaders` manually)
- [ ] Migrate `customer-api/worker.ts` to use `createCORSMiddleware` (currently uses `createCORSHeaders` manually)
- [ ] Migrate `mods-api/worker.ts` to use `createCORSMiddleware` (currently uses `createCORSHeaders` manually)
- [x] Verify all frontend clients use framework correctly - **COMPLETED**
- [ ] Update documentation

##  Completed Work

All **critical** issues have been fixed:
- ✓ All frontend API clients now use `createAPIClient` from the framework
- ✓ All service-to-service clients now use `createAPIClient` from the framework
- ✓ HTTPS enforcement, retry, circuit breaker, encryption all handled automatically

## ★ Remaining Work (Optimization, Not Critical)

The remaining items are optimizations to use `createCORSMiddleware` instead of manual `createCORSHeaders` calls. These workers are already using framework utilities, just not the middleware pattern. This is a code quality improvement, not a functional issue.

